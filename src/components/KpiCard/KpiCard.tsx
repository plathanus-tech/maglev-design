import { ReactNode } from 'react';
import { IconArrowDown, IconArrowUp, IconMinus } from '@tabler/icons-react';
import { Card } from '../Card/Card';
import { cx } from '../../utils/cx';
import styles from './KpiCard.module.css';

/** Comparação do KPI com o período anterior. */
export interface KpiTrend {
  /** Sentido da mudança do número. */
  direction: 'up' | 'down' | 'flat';
  /** Variação percentual, sempre positiva (o sentido vem de `direction`). */
  percent: number;
  /**
   * Se a mudança é boa ou ruim **para este KPI** — não é deduzido da seta.
   * Ex.: inadimplentes subindo = `negative`; chamados abertos caindo = `positive`.
   */
  sentiment: 'positive' | 'negative' | 'neutral';
  /** Referência da comparação (ex.: "vs. 7 dias anteriores", "vs. ontem"). */
  reference: string;
}

export interface KpiCardProps {
  /** Nome da métrica. */
  label: string;
  /** Valor atual. Números são formatados em `locale`; texto é exibido como veio. Ignorado com `ranking`. */
  value?: number | string;
  /**
   * Ranking compacto (ex.: top 3 clientes) no lugar do valor. Nomes longos são truncados para o card
   * manter a altura dos demais KPIs; o `label` do card já diz o que o número representa.
   */
  ranking?: Array<{ label: string; value: number }>;
  /** Ícone Tabler de 20px (decorativo — o `label` já nomeia a métrica). */
  icon?: ReactNode;
  /** Comparativo com o período anterior. Use só quando houver histórico real da métrica. */
  trend?: KpiTrend;
  /**
   * Linha complementar abaixo do valor, quando o KPI precisa de contexto (ex.: valor = nome do
   * cliente, descrição = "38 solicitações nos últimos 30 dias"). Mesmo estilo da referência do `trend`.
   */
  description?: string;
  /** Locale para formatar números. Padrão: `pt-BR`. */
  locale?: string;
  /** Textos para leitores de tela (i18n). */
  labels?: { up: string; down: string; flat: string };
  /**
   * Torna o card inteiro clicável (link para a tela que detalha a métrica). O `label` vira o link
   * (nome acessível) e se estende por todo o card.
   */
  href?: string;
  /**
   * Semântica de cor do indicador (ícone e valor): `neutral` (cinza), `error` (crítico), `warning` (atenção), `info`.
   * A superfície do card continua neutra. Sem `tone`, o ícone segue a identidade da marca.
   */
  tone?: 'neutral' | 'error' | 'warning' | 'info';
  className?: string;
}

const ARROW = { up: IconArrowUp, down: IconArrowDown, flat: IconMinus };
const DEFAULT_LABELS = { up: 'Aumento de', down: 'Redução de', flat: 'Sem variação:' };

/**
 * Indicador compacto para dashboards: label + ícone, valor em destaque e, opcionalmente,
 * o comparativo com o período anterior. A cor do comparativo vem de `trend.sentiment`.
 */
export function KpiCard({
  label, value, ranking, icon, trend, description, locale = 'pt-BR', labels = DEFAULT_LABELS, href, tone, className,
}: KpiCardProps) {
  const Arrow = trend && ARROW[trend.direction];
  const pct = trend
    && `${trend.percent.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  return (
    <Card className={cx(styles.kpi, href && styles.clickable, className)} padding="none">
      <div className={styles.body}>
        <div className={styles.head}>
          {href
            ? <a className={cx(styles.label, styles.link)} href={href}>{label}</a>
            : <span className={styles.label}>{label}</span>}
          {icon && <span className={cx(styles.icon, tone && styles[`tone-${tone}`])} aria-hidden="true">{icon}</span>}
        </div>

        {ranking ? (
          // Ranking compacto: três linhas do mesmo nível, menores que o label do card.
          <ol className={styles.ranking}>
            {ranking.map((r, i) => (
              <li key={r.label} className={cx(styles.rankItem, i === 0 && styles.rankTop)}>
                <span className={styles.rankPos} aria-hidden="true">{i + 1}</span>
                <span className={styles.rankLabel} title={r.label}>{r.label}</span>
                <span className={styles.rankValue}>{r.value.toLocaleString(locale)}</span>
              </li>
            ))}
          </ol>
        ) : (
        <div className={styles.main}>
          <span className={cx(styles.value, tone && styles[`valueTone-${tone}`])}>{typeof value === 'number' ? value.toLocaleString(locale) : value}</span>
          {trend && Arrow && (
            // Percentual e referência lado a lado; se faltar espaço, quebram juntos abaixo do valor.
            <span className={styles.compare}>
              <span className={cx(styles.trend, styles[trend.sentiment])}>
                <Arrow size={14} aria-hidden="true" />
                <span aria-hidden="true">{pct}</span>
                <span className={styles.srOnly}>{`${labels[trend.direction]} ${pct} ${trend.reference}`}</span>
              </span>
              <span className={styles.reference} aria-hidden="true">{trend.reference}</span>
            </span>
          )}
        </div>
        )}

        {description && <span className={styles.reference}>{description}</span>}
      </div>
    </Card>
  );
}
