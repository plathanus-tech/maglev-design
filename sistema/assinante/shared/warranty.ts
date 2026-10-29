import type { Equipment, Provider, SubDb, WorkOrder } from './data';
import { todayIso } from '../../admin/shared/clock';

/**
 * Garantia do equipamento: aviso com antecedência antes do fim. 💡 30 dias é uma sugestão (tempo de marcar algo antes de vencer): a confirmar com o cliente.
 * Em operação, a notificação sai por um processo agendado; no protótipo há uma notificação de demonstração e o aviso também sai ao salvar o equipamento.
 */
export const WARRANTY_ALERT_DAYS = 30;
/** Faixa mais próxima do fim: o indicador fica em tom crítico e mostra os dias restantes na lista. 💡 15 dias, a confirmar junto com os 30. */
export const WARRANTY_URGENT_DAYS = 15;

export type WarrantyKind = 'none' | 'future' | 'active' | 'expiring' | 'expired';
export interface WarrantyState { kind: WarrantyKind; start?: string; end?: string; daysLeft?: number; urgent?: boolean }

const dayDiff = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000);

/** Situação da garantia hoje (relógio da demonstração): sem garantia · ainda não iniciada · em garantia · vence em até 30 dias · expirada. */
export function warrantyOf(w: Equipment['warranty'], today = todayIso()): WarrantyState {
  if (!w.has) return { kind: 'none' };
  const state = { start: w.start, end: w.end };
  if (w.end && w.end < today) return { kind: 'expired', ...state };
  if (w.start && w.start > today) return { kind: 'future', ...state };
  const daysLeft = w.end ? dayDiff(today, w.end) : undefined;
  const expiring = daysLeft !== undefined && daysLeft <= WARRANTY_ALERT_DAYS;
  return { kind: expiring ? 'expiring' : 'active', daysLeft, urgent: expiring && (daysLeft ?? 0) <= WARRANTY_URGENT_DAYS, ...state };
}

export const daysText = (n: number) => (n <= 0 ? 'vence hoje' : n === 1 ? 'vence amanhã' : `vence em ${n} dias`);

/** Equipamentos com garantia a vencer (até 30 dias), do mais próximo ao mais distante. */
export const expiringWarranties = (db: SubDb) => db.equipments
  .map((e) => ({ e, w: warrantyOf(e.warranty) }))
  .filter((x) => x.w.kind === 'expiring')
  .sort((a, b) => (a.w.daysLeft ?? 0) - (b.w.daysLeft ?? 0));

// ─── Garantia de serviço do prestador (informativa: quanto tempo depois do serviço o prestador cobre um retorno) ───
export const serviceWarrantyText = (p: Provider) => (p.serviceWarranty?.has ? (p.serviceWarranty.days ? `${p.serviceWarranty.days} dias após a conclusão do serviço` : 'Sim, prazo não informado') : 'Não oferece');

/**
 * Dica para quem confere "Relacionado a reparo anterior": o último serviço concluído no equipamento, quem executou, há quantos dias e se está dentro da
 * garantia de serviço informada pelo prestador. É só um apoio: se o problema é o MESMO do serviço anterior continua sendo avaliação de quem lê a solicitação.
 */
export interface PreviousServiceHint { order?: WorkOrder; completedAt?: string; ago?: number; provider?: Provider; technician?: string; internal?: boolean; coverage?: 'within' | 'outside' | 'unknown' | 'none'; daysLeft?: number }
export function previousServiceHint(db: SubDb, equipmentId: string, completedAtOf: (o: WorkOrder) => string): PreviousServiceHint {
  const done = db.orders
    .filter((o) => o.equipmentId === equipmentId && o.statusId === 'STO-08')
    .map((o) => ({ o, at: completedAtOf(o).slice(0, 10) }))
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!done) return {};
  const ago = Math.max(0, dayDiff(done.at, todayIso()));
  const ex = done.o.executor;
  if (ex.kind !== 'prestador') return { order: done.o, completedAt: done.at, ago, internal: true };
  const provider = db.providers.find((p) => p.id === ex.providerId);
  const sw = provider?.serviceWarranty;
  if (!sw?.has) return { order: done.o, completedAt: done.at, ago, provider, technician: ex.technician, coverage: sw ? 'none' : 'unknown' };
  if (!sw.days) return { order: done.o, completedAt: done.at, ago, provider, technician: ex.technician, coverage: 'unknown' };
  const daysLeft = sw.days - ago;
  return { order: done.o, completedAt: done.at, ago, provider, technician: ex.technician, coverage: daysLeft >= 0 ? 'within' : 'outside', daysLeft };
}

