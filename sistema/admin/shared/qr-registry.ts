import type { QrEvent, Subscriber } from './data';

/**
 * Cadastro de QR Codes por assinante (visão do Admin). Cada equipamento tem UM código ativo por vez; o código é o
 * identificador do link da etiqueta (`maglev.com.br/q/<código>`). Reimprimir a etiqueta não muda o código. Quando o código
 * precisa deixar de valer, ele é inativado com motivo e o sistema gera um novo na hora; o código antigo continua no
 * histórico do equipamento (nada é excluído) e o equipamento mantém o mesmo cadastro, vínculos e histórico.
 *
 * DADOS DE DEMONSTRAÇÃO: a lista de equipamentos de cada assinante é gerada a partir das quantidades do cadastro (unidades e
 * equipamentos), de forma determinística; só as inativações de código (`qrEvents`) são gravadas no banco do protótipo.
 */
export type QrReason = 'danificada' | 'ilegivel' | 'perdida' | 'uso-indevido' | 'outro';
export const QR_REASONS: Array<{ value: QrReason; label: string }> = [
  { value: 'danificada', label: 'Etiqueta danificada' },
  { value: 'ilegivel', label: 'Etiqueta ilegível ou desgastada' },
  { value: 'perdida', label: 'Etiqueta perdida ou extraviada' },
  { value: 'uso-indevido', label: 'Suspeita de uso indevido do código' },
  { value: 'outro', label: 'Outro motivo' },
];
export const qrReasonLabel = (r: QrReason) => QR_REASONS.find((x) => x.value === r)?.label ?? r;

export interface RegEquipment {
  id: string; subscriberId: string; name: string; /** Patrimônio / código interno. */ code: string;
  unit: string; unitId: string; environment: string; category: string; createdAt: string;
  /** Código QR original (o primeiro emitido). O código atual considera as inativações (`currentToken`). */
  token: string;
}

const pad = (n: number, l: number) => String(n).padStart(l, '0');
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** Código não sequencial (RF305-RGN004 do assinante). */
export const tokenFor = (seed: string) => `q${hash(seed).toString(36)}${hash(`${seed}#`).toString(36).slice(0, 3)}`;
export const qrUrl = (token: string) => `https://maglev.com.br/q/${token}`;

const TEMPLATES: Array<[name: string, category: string, env: string]> = [
  ['Câmara fria', 'Refrigeração', 'Câmara frigorífica'], ['Forno combinado', 'Cocção', 'Cozinha quente'], ['Fritadeira', 'Cocção', 'Cozinha quente'],
  ['Coifa', 'Exaustão', 'Cozinha quente'], ['Freezer vertical', 'Refrigeração', 'Cozinha fria'], ['Mesa refrigerada', 'Refrigeração', 'Cozinha fria'],
  ['Lava-louças', 'Lavagem', 'Cozinha fria'], ['Chapa', 'Cocção', 'Cozinha quente'], ['Fogão industrial', 'Cocção', 'Cozinha quente'],
  ['Balcão refrigerado', 'Refrigeração', 'Salão'], ['Máquina de gelo', 'Produção de gelo', 'Bar'], ['Ar-condicionado', 'Climatização', 'Salão'],
  ['Refrigerador de bebidas', 'Bebidas', 'Bar'], ['Chopeira', 'Bebidas', 'Bar'], ['Salamandra', 'Cocção', 'Cozinha quente'],
];
const UNIT_SUFFIX = ['Centro', 'Beira-Mar', 'Trindade', 'Shopping', 'Norte', 'Aeroporto', 'Cozinha central', 'Lagoa'];

const cache = new Map<string, RegEquipment[]>();
const addDays = (iso: string, days: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

/** Equipamentos do assinante (um por unidade em rodízio), com o código QR original de cada um. */
export function subscriberEquipments(s: Pick<Subscriber, 'id' | 'tradeName' | 'since' | 'units' | 'equipments'>): RegEquipment[] {
  const key = `${s.id}|${s.units}|${s.equipments}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const units = Math.max(1, s.units);
  const counter: Record<string, number> = {};
  const out: RegEquipment[] = Array.from({ length: s.equipments }, (_, i) => {
    const u = i % units;
    const round = Math.floor(i / units);
    const [name, category, environment] = TEMPLATES[(u * 3 + round * 4 + (round > 5 ? 1 : 0) + hash(s.id) % 5) % TEMPLATES.length];
    const unit = `${s.tradeName} ${UNIT_SUFFIX[u % UNIT_SUFFIX.length]}`;
    const k = `${u}-${name}`;
    counter[k] = (counter[k] ?? 0) + 1;
    const created = addDays(s.since.slice(0, 10), 7 + ((i * 5) % 90));
    return {
      id: `EQP-${pad(i + 1, 4)}`, subscriberId: s.id, name: `${name} ${pad(counter[k], 2)}`, code: `PAT-${pad(1000 + i * 7, 4)}`,
      unit, unitId: `UNI-${pad(u + 1, 3)}`, environment, category, createdAt: created > '2026-10-20' ? '2026-10-20' : created,
      token: tokenFor(`${s.id}-${i}`),
    };
  });
  cache.set(key, out);
  return out;
}

/** Uma versão do código do equipamento: o atual e os já inativados (histórico de vínculo, nunca excluído). */
export interface QrVersion { token: string; issuedAt: string; inactivatedAt?: string; reason?: QrReason; detail?: string; byUserId?: string; current: boolean }

export function qrHistory(e: RegEquipment, events: QrEvent[]): QrVersion[] {
  const mine = events.filter((x) => x.subscriberId === e.subscriberId && x.equipmentId === e.id).sort((a, b) => a.at.localeCompare(b.at));
  const versions: QrVersion[] = [{ token: e.token, issuedAt: e.createdAt, current: true }];
  mine.forEach((ev) => {
    const prev = versions[versions.length - 1];
    Object.assign(prev, { inactivatedAt: ev.at, reason: ev.reason, detail: ev.detail, byUserId: ev.byUserId, current: false });
    versions.push({ token: ev.newToken, issuedAt: ev.at, current: true });
  });
  return versions;
}
export const currentQr = (e: RegEquipment, events: QrEvent[]) => qrHistory(e, events).slice(-1)[0];

/** DADOS DE DEMONSTRAÇÃO - algumas inativações de código já feitas, para o histórico aparecer. */
export function seedQrEvents(subscribers: Array<Pick<Subscriber, 'id'>>): QrEvent[] {
  const out: QrEvent[] = [];
  const add = (si: number, idx: number, at: string, byUserId: string, reason: QrReason, detail?: string, times = 1) => {
    const s = subscribers[si];
    if (!s) return;
    const eq = pad(idx + 1, 4);
    let old = tokenFor(`${s.id}-${idx}`);
    for (let n = 1; n <= times; n++) {
      const next = tokenFor(`${s.id}-${idx}-r${n}`);
      out.push({ id: `QRE-${s.id}-${eq}-${n}`, subscriberId: s.id, equipmentId: `EQP-${eq}`, at: n === 1 ? at : addDays(at.slice(0, 10), 40 * (n - 1)) + at.slice(10), byUserId, reason: n === 1 ? reason : 'perdida', detail: n === 1 ? detail : undefined, oldToken: old, newToken: next });
      old = next;
    }
  };
  add(0, 2, '2026-08-12T14:20:00.000Z', 'USR-0003', 'danificada');
  add(0, 5, '2026-07-03T10:05:00.000Z', 'USR-0004', 'ilegivel', undefined, 2);
  add(0, 9, '2026-09-21T16:40:00.000Z', 'USR-0003', 'outro', 'Etiqueta colada em equipamento trocado e precisou ser refeita');
  add(1, 0, '2026-09-02T09:30:00.000Z', 'USR-0001', 'uso-indevido');
  add(2, 3, '2026-10-08T11:15:00.000Z', 'USR-0003', 'perdida');
  return out;
}
