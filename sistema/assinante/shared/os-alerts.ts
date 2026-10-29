import { SubDb, WorkOrder, dayOnly } from './data';

/** Aviso ao gestor quando uma OS de prestador ainda não tem agendamento e o prazo está a esta distância (dias). 💡 2 dias, a confirmar com o cliente. */
export const SCHEDULE_ALERT_DAYS = 2;

export type AttendanceAlertKind = 'sem-agendamento' | 'nao-compareceu';
export interface AttendanceAlert { order: WorkOrder; kind: AttendanceAlertKind; /** sem-agendamento: dias até o prazo (negativo = vencido); nao-compareceu: data da visita agendada. */ days?: number; date?: string }

/** OS ainda em atendimento: fora Aguardando validação (STO-07), Concluída (STO-08) e Cancelada (STO-09). */
const inService = (o: WorkOrder) => !['STO-07', 'STO-08', 'STO-09'].includes(o.statusId);
const daysUntil = (iso: string) => Math.round((new Date(iso).getTime() - new Date(dayOnly(0)).getTime()) / 86_400_000);

/**
 * Alertas de atendimento do prestador (informativos, só avisam o gestor; a reatribuição segue manual):
 * - sem agendamento: OS com prestador, sem agenda nem visita futura, e prazo em até SCHEDULE_ALERT_DAYS (inclui vencido);
 * - não compareceu: visita agendada em data passada sem registro de chegada.
 * Em operação roda em processo agendado (notificação única por OS e tipo); no protótipo vem dos dados de demonstração.
 */
export const attendanceAlerts = (db: Pick<SubDb, 'orders'>): AttendanceAlert[] => db.orders.flatMap((o): AttendanceAlert[] => {
  if (o.executor.kind !== 'prestador' || !inService(o)) return [];
  const today = dayOnly(0);
  if (o.schedule && o.schedule.date < today && !o.visits.some((v) => v.arrivedAt && v.date === o.schedule!.date)) return [{ order: o, kind: 'nao-compareceu', date: o.schedule.date }];
  const hasFuture = !!o.schedule || o.visits.some((v) => v.date >= today);
  const left = daysUntil(o.dueAt);
  if (!hasFuture && left <= SCHEDULE_ALERT_DAYS) return [{ order: o, kind: 'sem-agendamento', days: left }];
  return [];
});

const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const alertText = (a: AttendanceAlert): { title: string; text: string } => a.kind === 'nao-compareceu'
  ? { title: 'Prestador não compareceu', text: `${a.order.id}: visita agendada para ${br(a.date!)} sem registro de chegada` }
  : { title: 'OS sem agendamento', text: `${a.order.id}: ${(a.days ?? 0) < 0 ? `prazo vencido há ${-(a.days ?? 0)} ${a.days === -1 ? 'dia' : 'dias'}` : a.days === 0 ? 'prazo é hoje' : `prazo em ${a.days} ${a.days === 1 ? 'dia' : 'dias'}`} e o prestador ainda não agendou` };
