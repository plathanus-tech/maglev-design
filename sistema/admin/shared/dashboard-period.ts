import { KpiTrend } from '@maglev/ds';
import { formatDate } from './format';
import { todayIso } from './clock';

/**
 * Período do Dashboard (RF101): atalhos + intervalo personalizado (De/Até). Os indicadores de carteira e de operação são a SITUAÇÃO ATUAL
 * e não mudam com o período; o período define (a) o comparativo de cada indicador com o período anterior de mesma duração e
 * (b) os indicadores de "Movimento no período" (volume que entrou/saiu dentro do intervalo). Valores históricos são dados de demonstração.
 */
export type PeriodKey = 'today' | '7d' | '30d' | 'month' | 'prevmonth' | 'custom';

export const PERIOD_OPTIONS: Array<{ value: PeriodKey; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'month', label: 'Mês atual' },
  { value: 'prevmonth', label: 'Mês anterior' },
  { value: 'custom', label: 'Período personalizado' },
];

export interface Range { from: string; to: string }

const toDate = (iso: string) => new Date(`${iso}T00:00:00`);
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const shiftDays = (iso: string, n: number) => { const d = toDate(iso); d.setDate(d.getDate() + n); return toIso(d); };
export const daysIn = (r: Range) => Math.round((toDate(r.to).getTime() - toDate(r.from).getTime()) / 86400000) + 1;

/** Intervalo de cada atalho, a partir da data-base da demonstração (relógio único). */
export function rangeOf(key: PeriodKey, custom: Range): Range {
  const today = todayIso();
  const t = toDate(today);
  switch (key) {
    case 'today': return { from: today, to: today };
    case '7d': return { from: shiftDays(today, -6), to: today };
    case '30d': return { from: shiftDays(today, -29), to: today };
    case 'month': return { from: toIso(new Date(t.getFullYear(), t.getMonth(), 1)), to: today };
    case 'prevmonth': return { from: toIso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: toIso(new Date(t.getFullYear(), t.getMonth(), 0)) };
    default: return custom;
  }
}

/**
 * Período de comparação: mesma duração imediatamente antes; nos atalhos de mês, o mês civil anterior (Mês anterior = o mês inteiro antes;
 * Mês atual = do dia 1 até o mesmo dia do mês anterior).
 */
export function previousOf(r: Range, key?: PeriodKey): Range {
  if (key === 'prevmonth' || key === 'month') {
    const from = toDate(r.from);
    const start = new Date(from.getFullYear(), from.getMonth() - 1, 1);
    const monthEnd = new Date(from.getFullYear(), from.getMonth(), 0);
    const end = key === 'prevmonth' ? monthEnd : new Date(start.getFullYear(), start.getMonth(), Math.min(toDate(r.to).getDate(), monthEnd.getDate()));
    return { from: toIso(start), to: toIso(end) };
  }
  const n = daysIn(r);
  return { from: shiftDays(r.from, -n), to: shiftDays(r.from, -1) };
}

export const rangeText = (r: Range) => (r.from === r.to ? formatDate(r.from) : `${formatDate(r.from)} a ${formatDate(r.to)}`);

// ─── Dados de demonstração ───────────────────────────────────────
const hash = (s: string) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
/** Variação determinística (−1…1) por texto, para o histórico de demonstração parecer real sem aleatoriedade. */
const wobble = (s: string) => ((hash(s) % 2001) / 1000) - 1;

/** Volume do movimento no período (solicitações abertas, OS abertas, OS concluídas): taxa diária × dias, com variação por data. */
const DAILY: Record<string, number> = { solicitacoes: 6, osAbertas: 4, osConcluidas: 3.5 };
export function movement(kind: keyof typeof DAILY, r: Range): number {
  let total = 0;
  for (let d = r.from, i = 0; d <= r.to && i < 400; d = shiftDays(d, 1), i++) total += Math.max(0, DAILY[kind] * (1 + 0.35 * wobble(`${kind}${d}`)));
  return Math.round(total);
}

type TrendMock = Omit<KpiTrend, 'reference'>;
/** Mais é bom ou ruim para cada indicador (inadimplentes, solicitações e OS em aberto subindo = negativo). */
const HIGHER_IS_WORSE = new Set(['inadimplentes', 'solicitacoes', 'os', 'solicitacoesPeriodo', 'osAbertasPeriodo']);

export function trendBetween(key: string, now: number, before: number): TrendMock {
  if (before === 0 || now === before) return { direction: 'flat', percent: 0, sentiment: 'neutral' };
  const up = now > before;
  const percent = Math.round((Math.abs(now - before) / before) * 1000) / 10;
  const bad = HIGHER_IS_WORSE.has(key);
  return { direction: up ? 'up' : 'down', percent, sentiment: up === bad ? 'negative' : 'positive' };
}

/** Comparativo de um indicador de situação atual para atalhos sem tabela fixa (30 dias, mês, personalizado): variação pequena e estável por período. */
export function snapshotTrend(key: string, r: Range): TrendMock {
  const w = wobble(`${key}${r.from}${r.to}`);
  if (Math.abs(w) < 0.12) return { direction: 'flat', percent: 0, sentiment: 'neutral' };
  const percent = Math.round(Math.abs(w) * 90) / 10;
  const up = w > 0;
  return { direction: up ? 'up' : 'down', percent, sentiment: up === HIGHER_IS_WORSE.has(key) ? 'negative' : 'positive' };
}

/** Planos de preventiva cadastrados no período (dado de demonstração). */
export const newPlansIn = (r: Range) => Math.round(daysIn(r) * 0.55 + 1.5 * (wobble(`pl${r.from}${r.to}`) + 1));

/** Texto do comparativo nos cards, dizendo contra o quê: ontem, 7/30 dias anteriores, o mês anterior (por nome) ou N dias anteriores. */
export function referenceText(key: PeriodKey, range: Range, previous: Range): string {
  const month = (iso: string) => toDate(iso).toLocaleDateString('pt-BR', { month: 'long' });
  switch (key) {
    case 'today': return 'vs. ontem';
    case '7d': return 'vs. 7 dias anteriores';
    case '30d': return 'vs. 30 dias anteriores';
    case 'prevmonth': return `vs. ${month(previous.from)}`;
    case 'month': return `vs. 1 a ${toDate(previous.to).getDate()} de ${month(previous.from)}`;
    default: return `vs. ${daysIn(range)} ${daysIn(range) === 1 ? 'dia anterior' : 'dias anteriores'}`;
  }
}
