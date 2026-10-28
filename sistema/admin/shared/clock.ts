/**
 * Relógio único da demonstração (Admin, Área do assinante e Prestador): toda a carga inicial, todos os cálculos de prazo (Vence em,
 * Atrasada, Em breve, próximos 7 dias) e todos os registros novos usam a MESMA data-base. A hora do dia é a do computador, para os
 * registros novos saírem em ordem. O navegador de protótipo mostra esta data como “relógio simulado”.
 * Em operação, os prazos usam a data corrente e o fuso configurados do sistema (aqui, só `DEMO_DATE` muda).
 */
export const DEMO_DATE = '2026-10-27';

const pad = (n: number) => String(n).padStart(2, '0');

/** Agora simulado: a data-base com a hora real do computador. */
export const clockNow = (): Date => {
  const real = new Date();
  const d = new Date(`${DEMO_DATE}T00:00:00`);
  d.setHours(real.getHours(), real.getMinutes(), real.getSeconds(), real.getMilliseconds());
  return d;
};
/** Data de hoje (AAAA-MM-DD) no relógio simulado. */
export const todayIso = () => DEMO_DATE;
/** Instante atual no relógio simulado, em ISO (UTC, como o `toISOString` que já era usado). */
export const clockIso = () => clockNow().toISOString();
/** Data-base para exibição (dd/mm/aaaa). */
export const demoDateText = () => `${DEMO_DATE.slice(8)}/${DEMO_DATE.slice(5, 7)}/${DEMO_DATE.slice(0, 4)}`;
export const clockLocal = (d = clockNow()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
