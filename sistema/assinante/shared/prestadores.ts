/** Regras de Prestadores (RF701-RF703), só lógica - sem tela. */
import { Provider, SubDb, WorkOrder } from './data';
import { TODAY, addDays } from './preventivas';

/** Todas as OS atribuídas ao prestador (RF703-CTA001): executor do tipo prestador com `providerId`. */
export const providerOrders = (db: SubDb, providerId: string, unitIds?: string[]): WorkOrder[] =>
  db.orders.filter((o) => o.executor.kind === 'prestador' && o.executor.providerId === providerId
    && (!unitIds || unitIds.includes(db.equipments.find((e) => e.id === o.equipmentId)?.unitId ?? '')));

/** Data de conclusão da OS: validação do solicitante, execução da preventiva ou último registro do log. */
export const orderCompletedAt = (db: SubDb, o: WorkOrder) =>
  o.validation?.at ?? db.executions.find((x) => x.id === o.executionId)?.doneAt ?? o.activities[o.activities.length - 1]?.at ?? o.createdAt;
export const orderCostCents = (o: WorkOrder) => o.costs.reduce((n, c) => n + c.cents, 0);

export const providerName = (p: Pick<Provider, 'name' | 'tradeName'>) => p.tradeName ?? p.name;
export const mainContact = (p: Provider) => p.contacts.find((c) => c.main) ?? p.contacts[0];
export const PROVIDER_KIND_LABEL: Record<Provider['kind'], string> = { empresa: 'Empresa', autonomo: 'Profissional autônomo' };

export const lastOrder = (orders: WorkOrder[]) => [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
export const withinDays = (iso: string, days: number) => iso.slice(0, 10) >= addDays(TODAY, -days) && iso.slice(0, 10) <= TODAY;

/** CPF válido: 11 dígitos, não repetidos, com dígitos verificadores corretos. */
export function isValidCpf(v: string) {
  const d = v.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    const sum = d.slice(0, len).split('').reduce((s, n, i) => s + Number(n) * (len + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}
export const formatCpf = (v: string) => v.replace(/\D/g, '').slice(0, 11)
  .replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
