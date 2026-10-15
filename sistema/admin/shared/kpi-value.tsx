import { Tooltip } from '@maglev/ds';
import { formatCountCompact, formatMoney, formatMoneyCompact, formatNumber, isCountCompact, isMoneyCompact } from './format';

/**
 * Valor monetário de um KPI (centavos): completo abaixo de R$ 100 mil; abreviado (mil, mi, bi) a partir daí, com o valor completo em
 * tooltip (mouse e teclado). Use só em indicadores e resumos; tabelas, formulários e detalhes mostram `formatMoney`.
 */
export function KpiMoney({ cents, className }: { cents: number; className?: string }) {
  if (!isMoneyCompact(cents)) return <>{formatMoney(cents)}</>;
  return (
    <Tooltip content={formatMoney(cents)}>
      <span tabIndex={0} className={className ? `kpi-nowrap ${className}` : 'kpi-nowrap'}>{formatMoneyCompact(cents)}</span>
    </Tooltip>
  );
}

/** Quantidade de um KPI: completa (1.802); só números a partir de 1 milhão abreviam, com o valor completo em tooltip. */
export function KpiCount({ value }: { value: number }) {
  if (!isCountCompact(value)) return <>{formatNumber(value)}</>;
  return (
    <Tooltip content={formatNumber(value)}>
      <span tabIndex={0} className="kpi-nowrap">{formatCountCompact(value)}</span>
    </Tooltip>
  );
}
