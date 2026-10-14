import { useDb as useAdminDb } from '../../admin/shared/store';
import { formatDate } from '../../admin/shared/format';
import { Equipment, Request, SubDb, WorkOrder } from '../../assinante/shared/data';
import { STO } from '../../assinante/shared/os-common';
import { STS, isOpenBase } from '../../assinante/shared/solicitacoes-shared';
import { param, useRefs } from '../../assinante/shared/ui';
import { userName } from '../../assinante/shared/store';

/**
 * Peças do Colaborador/Solicitante (PWA via QR Code): tela sem login. O equipamento vem do QR Code (`?q=` = identificador
 * não adivinhável do RF305-RGN004; `?e=` aceita o id só para o protótipo) e o acompanhamento é pelo protocolo (`?p=`).
 */

export const equipmentFromLink = (db: SubDb): Equipment | undefined => {
  const q = param('q');
  const e = param('e');
  return db.equipments.find((x) => (q ? x.qrToken === q : e ? x.id === e : false));
};
export const linkToEquipment = (e: Pick<Equipment, 'qrToken'>) => `equipamento.html?q=${e.qrToken}`;
export { linkToRequestByToken, publicTokenOf } from './token';
export const linkToRequest = (id: string) => `acompanhar.html?p=${id}`;

/** Por que o equipamento não aceita solicitação (RF001-RGN003): equipamento inativo ou ambiente do assinante desativado. */
export function useBlockedReason(db: SubDb, e: Equipment | undefined, simulated?: 'inactive' | 'envinactive'): 'inactive' | 'envinactive' | null {
  const admin = useAdminDb();
  const subscriber = admin.subscribers.find((s) => s.id === db.subscriberId);
  if (simulated === 'envinactive' || subscriber?.status === 'inativo') return 'envinactive';
  if (simulated === 'inactive' || e?.statusId === 'STE-05') return 'inactive';
  return null;
}

// ─── Status simplificado (RF004-RGN002): os status internos na linguagem do colaborador ───
export type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'error' | 'brand';
export interface SimpleStatus { label: string; tone: Tone }

export const orderOfRequest = (db: SubDb, r: Request): WorkOrder | undefined => db.orders.find((o) => o.id === r.osId || o.requestId === r.id);

export function simpleStatus(db: SubDb, base: (id?: string) => string | undefined, r: Request): SimpleStatus {
  const o = orderOfRequest(db, r);
  if (o) {
    const b = base(o.statusId);
    if (b === 'concluido') return { label: 'Concluída', tone: 'success' };
    if (b === 'cancelado') return { label: 'Em análise', tone: 'info' };
    if (o.statusId === STO.VALIDACAO) return { label: 'Aguardando sua confirmação', tone: 'warning' };
    return { label: 'Em atendimento', tone: 'brand' };
  }
  switch (r.statusId) {
    case STS.NEW: return { label: 'Recebida', tone: 'neutral' };
    case STS.TRIAGE: return { label: 'Em análise', tone: 'info' };
    case STS.WAITING: return { label: 'Aguardando sua informação', tone: 'warning' };
    case STS.APPROVED: return { label: 'Em atendimento', tone: 'brand' };
    case STS.CONVERTED: return { label: 'Em atendimento', tone: 'brand' };
    case STS.REJECTED: return { label: 'Recusada', tone: 'error' };
    case STS.DONE: return { label: 'Concluída', tone: 'success' };
    default: return { label: 'Em análise', tone: 'info' };
  }
}

/** Nome do técnico/responsável (RF003/RF004): técnico ou prestador da OS; sem OS, o responsável definido na triagem. */
export function responsibleOf(db: SubDb, r: Request): string {
  const o = orderOfRequest(db, r);
  if (o) {
    if (o.executor.kind === 'prestador') {
      const p = db.providers.find((x) => x.id === (o.executor as { providerId: string }).providerId);
      return o.executor.technician ?? (p ? p.tradeName ?? p.name : '');
    }
    return userName(db, o.executor.userId);
  }
  return r.responsibleId ? userName(db, r.responsibleId) : '';
}

/**
 * Técnico responsável pelo atendimento, só o nome (RF003/RF004): quem executa a OS vinculada (técnico do prestador ou executor
 * interno). Não é o responsável administrativo da triagem e não expõe empresa prestadora, contato ou documento. Vazio sem OS
 * ou quando a OS não tem técnico definido.
 */
export function technicianOf(db: SubDb, r: Request): string {
  const o = orderOfRequest(db, r);
  if (!o) return '';
  return o.executor.kind === 'prestador' ? o.executor.technician ?? '' : userName(db, o.executor.userId);
}

/**
 * Atendimento agendado: data e horário da próxima visita ainda sem chegada registrada (a mais recente, se houver reagendamento)
 * ou, sem visitas, o agendamento da OS. Sem OS, OS encerrada ou cancelada, ou sem agendamento: vazio. Não usa prazo nem abertura.
 */
export function scheduledOf(db: SubDb, base: (id?: string) => string | undefined, r: Request): { date: string; time: string } | null {
  const o = orderOfRequest(db, r);
  if (!o) return null;
  const b = base(o.statusId);
  if (b === 'concluido' || b === 'cancelado') return null;
  const pending = o.visits.filter((v) => !v.arrivedAt).sort((a, c) => `${c.date}${c.from}`.localeCompare(`${a.date}${a.from}`))[0];
  const hit = pending ? { date: pending.date, time: pending.from } : o.schedule ? { date: o.schedule.date, time: o.schedule.from } : null;
  return hit?.date ? { date: hit.date, time: hit.time } : null;
}

/** "16/10/2026 às 14:00" */
export const scheduleText = (s: { date: string; time: string }) => `${formatDate(s.date)}${s.time ? ` às ${s.time}` : ''}`;

/** Previsão de atendimento: data agendada da OS, quando houver. */
export function forecastOf(db: SubDb, r: Request): string {
  const o = orderOfRequest(db, r);
  const date = o?.schedule?.date;
  return date ? formatDate(date) : '';
}

export interface PublicEvent { at: string; text: string; tone: Tone; detail?: string }

/**
 * Histórico para o solicitante (RF004-FLU002): só eventos públicos que realmente aconteceram, em linguagem simples, vindos do
 * histórico da própria solicitação (o mesmo que a tela administrativa mostra). Lista de permissão: nome de quem fez, observações
 * internas, motivos, prestador, responsável, custos e eventos operacionais da OS (visitas, execução) não saem daqui.
 * Cor do indicador = cor semântica do status/evento: recebida neutro · triagem informativo · aguardando informação atenção ·
 * convertida em OS informativo · concluída sem OS sucesso · recusada erro.
 */
export function publicHistoryOf(db: SubDb, r: Request): PublicEvent[] {
  const out: PublicEvent[] = [];
  const rules: Array<[RegExp, string, Tone]> = [
    [/^Abriu a solicitação/, 'Solicitação recebida', 'neutral'],
    [/^Iniciou a triagem/, 'Em triagem', 'info'],
    [/^Solicitou complementação/, 'Aguardando informação', 'warning'],
    [/^Respondeu ao pedido de complementação/, 'Você respondeu ao pedido de informação', 'neutral'],
    [/^Aprovou a solicitação/, 'Solicitação aprovada', 'info'],
    [/^Recusou/, 'Solicitação recusada', 'error'],
    [/^Concluiu sem OS|^Concluída sem OS/, 'Concluída sem OS', 'success'],
  ];
  r.log.forEach((l) => { const hit = rules.find(([re]) => re.test(l.text)); if (hit) out.push({ at: l.at, text: hit[1], tone: hit[2] }); });
  if (!out.some((e) => e.text === 'Solicitação recebida')) out.push({ at: r.openedAt, text: 'Solicitação recebida', tone: 'neutral' });
  if (r.complement && !out.some((e) => e.text === 'Aguardando informação')) out.push({ at: r.complement.askedAt, text: 'Aguardando informação', tone: 'warning' });
  if (r.complement?.answeredAt && !out.some((e) => e.text.startsWith('Você respondeu'))) out.push({ at: r.complement.answeredAt, text: 'Você respondeu ao pedido de informação', tone: 'neutral' });
  const o = orderOfRequest(db, r);
  if (o) {
    out.push({ at: o.createdAt, text: 'Convertida em OS', tone: 'info' });
    // Confirmação do próprio solicitante (RF004-FLU004/FLU005)
    if (o.validation) out.push({ at: o.validation.requestedAt, text: 'Aguardando a sua confirmação', tone: 'warning' });
    if (o.validation?.result && o.validation.at) {
      const yes = o.validation.result === 'sim';
      // Conclusão primeiro: no mesmo instante ela aparece acima da confirmação (lista em ordem decrescente)
      if (yes) out.push({ at: o.validation.at, text: 'Solicitação concluída', tone: 'success' });
      out.push({ at: o.validation.at, text: yes ? 'Você confirmou que o problema foi resolvido' : 'Você informou que o problema persiste', tone: yes ? 'success' : 'warning', detail: o.validation.comment || undefined });
    }
  }
  return out.sort((x, y) => y.at.localeCompare(x.at));
}

/** Solicitações em aberto do equipamento (RF003), mais recentes primeiro. */
export const openRequestsOf = (db: SubDb, base: (id?: string) => string | undefined, equipmentId: string): Request[] =>
  db.requests.filter((r) => r.equipmentId === equipmentId && isOpenBase(base(r.statusId))).sort((a, b) => b.openedAt.localeCompare(a.openedAt));

// ─── Nome e telefone lembrados no dispositivo (RF002-RGN011) ───
const REMEMBER_KEY = 'maglev.v2.requester';
export function recall(): { name: string; phone: string } {
  try { const v = JSON.parse(localStorage.getItem(REMEMBER_KEY) ?? 'null') as { name?: string; phone?: string } | null; return { name: v?.name ?? '', phone: v?.phone ?? '' }; } catch { return { name: '', phone: '' }; }
}
export function remember(name: string, phone: string) { try { localStorage.setItem(REMEMBER_KEY, JSON.stringify({ name, phone })); } catch { /* sem storage */ } }

export { useRefs };
