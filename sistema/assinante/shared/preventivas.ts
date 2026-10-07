/**
 * Regras de Preventivas (RF601-RF603), só lógica - sem tela. Usado por planos, plano, plano-form e execucao-preventiva.
 * Tudo deriva de `db.plans` / `db.executions` / `db.orders` e do "hoje" do protótipo (DEMO_NOW).
 */
import {
  Executor, FREQUENCY_LABEL, Frequency, Plan, PlanExecution, SubDb, SubUser, WorkOrder, dayOnly, nowLocal,
} from './data';
import { logEntry, nextSeq, notify, updateSubDb } from './store';

export const TODAY = dayOnly(0);
const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (s: string) => new Date(`${s}T00:00:00`);
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (s: string, n: number) => { const d = toDate(s); d.setDate(d.getDate() + n); return toIso(d); };
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export const WEEKDAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
export const WEEKDAY_OPTIONS = WEEKDAYS.map((label, i) => ({ value: String(i + 1), label }));
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const FREQUENCY_OPTIONS = (Object.keys(FREQUENCY_LABEL) as Frequency[]).map((value) => ({ value, label: FREQUENCY_LABEL[value] }));
export const EVERY_UNIT: Record<Frequency, string> = { diaria: 'dias', semanal: 'semanas', mensal: 'meses', anual: 'anos' };

export type Schedule = Pick<Plan, 'startDate' | 'endDate' | 'frequency' | 'every' | 'refDay'>;

/** Datas previstas (AAAA-MM-DD) a partir de `from`, no calendário fixo do plano (RF601-RGN005). */
export function occurrences(p: Schedule, from: string, count: number): string[] {
  const out: string[] = [];
  const every = Math.max(1, Math.floor(p.every) || 1);
  if (!p.startDate || count <= 0) return out;
  const within = (s: string) => !p.endDate || s <= p.endDate;
  const push = (s: string) => { if (s >= p.startDate && s >= from && within(s)) out.push(s); };
  const stepDays = (first: string, step: number) => {
    let cur = first;
    if (cur < from) {
      const diff = Math.round((toDate(from).getTime() - toDate(cur).getTime()) / 86_400_000);
      cur = addDays(cur, Math.ceil(diff / step) * step);
    }
    for (let i = 0; i < 400 && out.length < count && within(cur); i++) { push(cur); cur = addDays(cur, step); }
  };
  if (p.frequency === 'diaria') stepDays(p.startDate, every);
  else if (p.frequency === 'semanal') {
    const sd = toDate(p.startDate);
    const delta = (((p.refDay % 7) - sd.getDay()) + 7) % 7;
    stepDays(addDays(p.startDate, delta), 7 * every);
  } else {
    const sd = toDate(p.startDate);
    const base = p.frequency === 'mensal' ? sd.getFullYear() * 12 + sd.getMonth() : sd.getFullYear();
    for (let k = 0; k < 600 && out.length < count; k++) {
      const idx = base + k * every;
      const y = p.frequency === 'mensal' ? Math.floor(idx / 12) : idx;
      const m = p.frequency === 'mensal' ? idx % 12 : sd.getMonth();
      const s = toIso(new Date(y, m, Math.min(Math.max(1, p.refDay), lastDay(y, m))));
      if (!within(s) && s > p.startDate) break;
      push(s);
    }
  }
  return out;
}

/** "Mensal, dia 5" · "A cada 3 meses, dia 15" · "Semanal, segunda-feira" · "Diária". */
export function describeFrequency(p: Pick<Plan, 'frequency' | 'every' | 'refDay' | 'startDate'>): string {
  const n = p.every > 1;
  if (p.frequency === 'diaria') return n ? `A cada ${p.every} dias` : 'Diária';
  if (p.frequency === 'semanal') return `${n ? `A cada ${p.every} semanas` : 'Semanal'}, ${WEEKDAYS[(p.refDay || 1) - 1]?.toLowerCase() ?? ''}`;
  if (p.frequency === 'mensal') return `${n ? `A cada ${p.every} meses` : 'Mensal'}, dia ${p.refDay}`;
  const month = p.startDate ? MONTHS[toDate(p.startDate).getMonth()] : '';
  return `${n ? `A cada ${p.every} anos` : 'Anual'}, dia ${p.refDay}${month ? ` de ${month}` : ''}`;
}

// ═══ Situação do plano e indicadores (RF602) ═════════════════════════
export type Situation = 'atrasado' | 'em-breve' | 'em-dia';
export const SITUATION: Record<Situation, { label: string; badge: 'success' | 'warning' | 'error' }> = {
  'em-dia': { label: 'Em dia', badge: 'success' },
  'em-breve': { label: 'Em breve', badge: 'warning' },
  atrasado: { label: 'Atrasado', badge: 'error' },
};
export const SITUATION_OPTIONS = [
  { value: 'todas', label: 'Todas as situações' },
  { value: 'em-dia', label: 'Em dia' }, { value: 'em-breve', label: 'Em breve' }, { value: 'atrasado', label: 'Atrasado' },
];

/** Execução atrasada = data prevista ultrapassada sem conclusão (RF602-RGN001). */
export const isLate = (e: PlanExecution) => e.status === 'pendente' && e.dueDate < TODAY;
export const isSoon = (e: PlanExecution) => e.status === 'pendente' && e.dueDate >= TODAY && e.dueDate <= addDays(TODAY, 7);

export interface PlanStats {
  executions: PlanExecution[]; late: PlanExecution[]; pending: PlanExecution[]; history: PlanExecution[];
  last?: PlanExecution; next?: PlanExecution; situation: Situation | null;
}
export function statsOf(db: SubDb, plan: Plan): PlanStats {
  const executions = db.executions.filter((e) => e.planId === plan.id);
  const pending = executions.filter((e) => e.status === 'pendente').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const late = pending.filter(isLate);
  const history = executions.filter((e) => e.status !== 'pendente').sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const last = history.find((e) => e.status === 'concluida');
  const next = pending[0];
  const situation: Situation | null = late.length ? 'atrasado' : pending.some(isSoon) ? 'em-breve' : plan.status === 'pausado' ? null : 'em-dia';
  return { executions, late, pending, history, last, next, situation };
}

/** Cumprimento = execuções concluídas ÷ previstas no período (RF602-RGN002); "Não realizada" e atrasadas contam como não cumpridas. */
export function compliance(execs: PlanExecution[], days = 30) {
  const from = addDays(TODAY, -days);
  const due = execs.filter((e) => e.dueDate >= from && e.dueDate <= TODAY);
  const done = due.filter((e) => e.status === 'concluida').length;
  return { planned: due.length, done, pct: due.length ? Math.round((done / due.length) * 100) : null };
}

// ═══ Rótulos ════════════════════════════════════════════════════════
export function executorOf(db: SubDb, ex: Executor): { primary: string; secondary: string; active: boolean } {
  if (ex.kind === 'interno') {
    const u = db.users.find((x) => x.id === ex.userId);
    return { primary: u?.name ?? '-', secondary: 'Equipe interna', active: u?.status === 'ativo' };
  }
  const p = db.providers.find((x) => x.id === ex.providerId);
  return { primary: p ? (p.tradeName ?? p.name) : '-', secondary: ex.technician ? `Técnico: ${ex.technician}` : 'Prestador externo', active: p?.status === 'ativo' };
}
/** Primeiro equipamento + "+N" (colunas Equipamento(s) e Unidade(s)). */
export const withMore = (names: string[]) => (names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0] ?? '-');
export const planEquipmentNames = (db: SubDb, plan: Plan) => plan.equipmentIds.map((id) => db.equipments.find((e) => e.id === id)?.name ?? id);
export const planUnitNames = (db: SubDb, plan: Plan) => [...new Set(plan.equipmentIds.map((id) => db.equipments.find((e) => e.id === id)?.unitId).filter(Boolean))]
  .map((uid) => db.units.find((u) => u.id === uid)?.name ?? '-');
export const planUnitIds = (db: SubDb, plan: Plan) => [...new Set(plan.equipmentIds.map((id) => db.equipments.find((e) => e.id === id)?.unitId ?? ''))];

/** Planos que o usuário enxerga: com equipamento em unidade visível; o Executor só vê os planos em que ele é o executor (RF602). */
export function plansVisible(db: SubDb, user: SubUser, unitIds: string[]): Plan[] {
  return db.plans.filter((p) => planUnitIds(db, p).some((u) => unitIds.includes(u))
    && (user.profile !== 'executor' || (p.executor.kind === 'interno' && p.executor.userId === user.id)));
}

// ═══ Geração de execuções e OS preventivas (RF601-CTA001, RGN002/RGN003) ═══════
const newOrder = (orders: WorkOrder[], plan: Plan, eq: { id: string; name: string }, ex: PlanExecution, by: SubUser): WorkOrder => ({
  id: nextSeq('OS', orders.map((o) => o.id)), kind: 'preventiva', planId: plan.id, executionId: ex.id,
  subject: `${plan.name} - ${eq.name}`, equipmentId: eq.id, maintTypeId: 'TMA-003', priorityId: 'PRI-4', statusId: 'STO-01',
  createdAt: nowLocal(), dueAt: ex.dueDate, responsibleId: by.id, executor: plan.executor,
  schedule: { date: ex.dueDate, from: plan.window?.from ?? '09:00', to: plan.window?.to ?? '11:00' },
  contactName: by.name, contactPhone: by.phone, reported: plan.description ?? plan.name,
  visits: [], costs: [], files: [],
  activities: [logEntry('Sistema', `OS gerada automaticamente pelo plano ${plan.name}`)],
});

/**
 * Gera as próximas execuções (até 3 pendentes futuras por equipamento) a partir de hoje, no calendário fixo do plano.
 * 💡 RGN002/RGN003 (a confirmar): uma execução/OS por equipamento; a OS só é aberta para a próxima execução de cada
 * equipamento (antecedência de geração a confirmar) - as demais ficam previstas, sem OS.
 */
export function generateFor(db: SubDb, plan: Plan, by: SubUser, count = 3) {
  const executions = [...db.executions];
  const orders = [...db.orders];
  let newExecutions = 0; let newOrders = 0;
  for (const eid of plan.equipmentIds) {
    const eq = db.equipments.find((e) => e.id === eid);
    if (!eq) continue;
    const mine = executions.filter((x) => x.planId === plan.id && x.equipmentId === eid);
    const lastDue = mine.reduce((m, x) => (x.dueDate > m ? x.dueDate : m), '');
    const from = lastDue && addDays(lastDue, 1) > TODAY ? addDays(lastDue, 1) : TODAY;
    const future = mine.filter((x) => x.status === 'pendente' && x.dueDate >= TODAY);
    const haveOs = future.some((x) => x.osId);
    occurrences(plan, from, Math.max(0, count - future.length)).forEach((date, i) => {
      const ex: PlanExecution = { id: `${plan.id}-${eid}-${date}`, planId: plan.id, equipmentId: eid, dueDate: date, status: 'pendente' };
      if (i === 0 && !haveOs) { const o = newOrder(orders, plan, eq, ex, by); orders.push(o); ex.osId = o.id; newOrders++; }
      executions.push(ex); newExecutions++;
    });
  }
  return { db: { ...db, executions, orders }, newExecutions, newOrders };
}

/** Cancela as execuções futuras ainda não iniciadas (OS aberta) - RGN004: alterar o plano afeta só as futuras. */
function cancelFuture(db: SubDb, planId: string, equipmentIds?: string[], reason = 'Plano alterado') {
  const drop = new Set<string>();
  const cancel = new Set<string>();
  db.executions.forEach((x) => {
    if (x.planId !== planId || x.status !== 'pendente' || x.dueDate <= TODAY || (equipmentIds && !equipmentIds.includes(x.equipmentId))) return;
    const os = x.osId ? db.orders.find((o) => o.id === x.osId) : undefined;
    if (os && os.statusId !== 'STO-01') return; // em andamento: mantém
    drop.add(x.id); if (os) cancel.add(os.id);
  });
  return {
    ...db,
    executions: db.executions.filter((x) => !drop.has(x.id)),
    orders: db.orders.map((o) => (cancel.has(o.id)
      ? { ...o, statusId: 'STO-09', cancelReason: reason, activities: [...o.activities, logEntry('Sistema', `OS cancelada: ${reason.toLowerCase()}`)] }
      : o)),
  };
}

const executorUserIds = (plan: Plan, me: SubUser) => [plan.executor.kind === 'interno' ? plan.executor.userId : '', me.id];
const planNotice = (plan: Plan, title: string, text: string) => ({ title, text: `${plan.name}: ${text}`, href: `plano.html?id=${plan.id}`, kind: 'preventiva' as const });

/** Salva (cria/edita) o plano, recalcula as execuções futuras e notifica o responsável/executor. */
export function savePlan(plan: Plan, me: SubUser, editing: boolean) {
  const result = { newExecutions: 0, newOrders: 0 };
  updateSubDb((db) => {
    let next: SubDb = { ...db, plans: editing ? db.plans.map((p) => (p.id === plan.id ? plan : p)) : [...db.plans, plan] };
    if (editing) next = cancelFuture(next, plan.id);
    if (plan.status === 'ativo') {
      const g = generateFor(next, plan, me);
      next = g.db; result.newExecutions = g.newExecutions; result.newOrders = g.newOrders;
    }
    return next;
  });
  if (!editing || result.newOrders) {
    notify(executorUserIds(plan, me), planNotice(plan, editing ? 'Plano de preventiva atualizado' : 'Novo plano de preventiva',
      editing ? 'as próximas execuções foram recalculadas' : `${result.newOrders} OS preventiva${result.newOrders === 1 ? '' : 's'} gerada${result.newOrders === 1 ? '' : 's'}`));
  }
  return result;
}

/** Pausar interrompe novas execuções (CTA001); reativar recalcula a partir de hoje (RGN003). As OS já geradas são mantidas. */
export function setPlanStatus(plan: Plan, status: Plan['status'], me: SubUser) {
  const result = { newExecutions: 0, newOrders: 0 };
  const updated: Plan = { ...plan, status };
  updateSubDb((db) => {
    let next: SubDb = { ...db, plans: db.plans.map((p) => (p.id === plan.id ? updated : p)) };
    if (status === 'ativo') { const g = generateFor(next, updated, me); next = g.db; result.newExecutions = g.newExecutions; result.newOrders = g.newOrders; }
    return next;
  });
  if (status === 'ativo' && result.newOrders) notify(executorUserIds(updated, me), planNotice(updated, 'Plano de preventiva reativado', `${result.newOrders} OS preventiva${result.newOrders === 1 ? '' : 's'} gerada${result.newOrders === 1 ? '' : 's'}`));
  return result;
}

/** Associar/desassociar equipamentos depois de criado (RF601-FLU008). */
export function setPlanEquipments(plan: Plan, equipmentIds: string[], me: SubUser) {
  const removed = plan.equipmentIds.filter((id) => !equipmentIds.includes(id));
  const updated: Plan = { ...plan, equipmentIds };
  const result = { newExecutions: 0, newOrders: 0 };
  updateSubDb((db) => {
    let next: SubDb = { ...db, plans: db.plans.map((p) => (p.id === plan.id ? updated : p)) };
    if (removed.length) next = cancelFuture(next, plan.id, removed, 'Equipamento desassociado do plano');
    if (updated.status === 'ativo') { const g = generateFor(next, updated, me); next = g.db; result.newExecutions = g.newExecutions; result.newOrders = g.newOrders; }
    return next;
  });
  return result;
}

/** Nome do arquivo simulado de uma evidência anexada na execução. */
export const evidenceFile = (label: string) => `${label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.${/relat/i.test(label) ? 'pdf' : 'jpg'}`;
