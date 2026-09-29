import { ReactNode } from 'react';
import { IconSelector, IconChevronUp, IconChevronDown, IconInbox } from '@tabler/icons-react';
import { Avatar } from '../Avatar/Avatar';
import { Badge, BadgeStatus } from '../Badge/Badge';
import { Card } from '../Card/Card';
import { EmptyState, EmptyStateProps } from '../EmptyState/EmptyState';
import { Spinner } from '../Spinner/Spinner';
import { Toggle } from '../Toggle/Toggle';
import { cx } from '../../utils/cx';
import styles from './Table.module.css';

/* ── Types ─────────────────────────────────────────────────────────────── */

export type StatusType = BadgeStatus;

export type ActionItem<T> = {
  icon: ReactNode;
  label: string;
  onClick: (row: T) => void;
  danger?: boolean;
};

export type TableColumn<T> = {
  key: keyof T;
  label: string;
  sortable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';

  /** Custom render always takes priority over `type`. */
  render?: (value: unknown, row: T) => ReactNode;

  /** 'text' (default) | 'link' | 'badge' | 'avatar' | 'toggle' | 'actions' */
  type?: 'text' | 'link' | 'badge' | 'avatar' | 'toggle' | 'actions';

  /** type='badge': mapeia o valor da célula → { label, status } */
  statusMap?: Record<string, { label: string; status: StatusType }>;
  /** type='toggle': chamado quando o interruptor muda */
  onToggle?: (row: T, value: boolean) => void;
  /** type='actions': botões de ícone exibidos na célula */
  actionItems?: ActionItem<T>[];
  /** type='link': monta o href a partir da linha */
  getHref?: (row: T) => string;
  /** type='link': chamado ao clicar (cancela a navegação padrão) */
  onLinkClick?: (row: T) => void;
  /** type='avatar': coluna cujo valor é o nome exibido/iniciais (padrão: o próprio valor da célula) */
  nameKey?: keyof T;
};

export type TableProps<T extends Record<string, unknown>> = {
  title?: string;
  subtitle?: string;
  /** Nome acessível da tabela quando não há `title`. */
  caption?: string;
  columns: TableColumn<T>[];
  rows: T[];
  loading?: boolean;
  /** Conteúdo do `EmptyState` exibido quando não há linhas (título, descrição, ícone, ação). */
  empty?: Partial<EmptyStateProps>;
  loadingLabel?: string;
  onSort?: (key: keyof T) => void;
  sortKey?: keyof T;
  sortDir?: 'asc' | 'desc';
};

/* ── Cell renderer ──────────────────────────────────────────────────────── */

function renderCell<T extends Record<string, unknown>>(col: TableColumn<T>, row: T): ReactNode {
  const value = row[col.key];

  if (col.render) return col.render(value, row);

  switch (col.type) {
    case 'badge': {
      const s = col.statusMap?.[String(value)];
      return s ? <Badge status={s.status} dot>{s.label}</Badge> : String(value ?? '');
    }

    case 'link':
      return (
        <a
          href={col.getHref ? col.getHref(row) : '#'}
          className={styles.cellLink}
          onClick={e => {
            if (col.onLinkClick) { e.preventDefault(); col.onLinkClick(row); }
          }}
        >
          {String(value ?? '')}
        </a>
      );

    case 'avatar':
      return <Avatar size="sm" src={String(value ?? '')} name={String(col.nameKey ? row[col.nameKey] : col.label)} />;

    case 'toggle':
      return (
        <Toggle
          size="sm"
          aria-label={col.label}
          checked={Boolean(value)}
          onChange={e => col.onToggle?.(row, e.target.checked)}
        />
      );

    case 'actions':
      return (
        <div className={styles.cellActions}>
          {col.actionItems?.map((action, i) => (
            <button
              key={i}
              className={cx(styles.actionBtn, action.danger && styles.actionDanger)}
              onClick={() => action.onClick(row)}
              title={action.label}
              aria-label={action.label}
              type="button"
            >
              {action.icon}
            </button>
          ))}
        </div>
      );

    default:
      return String(value ?? '');
  }
}

/* ── Table ──────────────────────────────────────────────────────────────── */

/**
 * Tabela de dados dentro de um Card. Configure por colunas (`type`: text, link, badge,
 * avatar, toggle, actions) em vez de criar tabelas novas. Ordenação é controlada pelo pai.
 */
export function Table<T extends Record<string, unknown>>({
  title,
  subtitle,
  caption,
  columns,
  rows,
  loading,
  empty,
  loadingLabel = 'Carregando',
  onSort,
  sortKey,
  sortDir,
}: TableProps<T>) {
  const ariaSort = (col: TableColumn<T>): 'ascending' | 'descending' | 'none' | undefined => {
    if (!col.sortable) return undefined;
    if (sortKey !== col.key) return 'none';
    return sortDir === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <Card title={title} subtitle={subtitle} padding="none">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          {caption && <caption className={styles.srOnly}>{caption}</caption>}
          <thead>
            <tr className={styles.headerRow}>
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  scope="col"
                  className={styles.th}
                  style={{ width: col.width ?? undefined, textAlign: col.align ?? 'left' }}
                  aria-sort={ariaSort(col)}
                >
                  {col.sortable ? (
                    <button type="button" className={styles.sortBtn} onClick={() => onSort?.(col.key)}>
                      {col.label}
                      <span className={styles.sortIcon} aria-hidden="true">
                        {sortKey === col.key
                          ? sortDir === 'asc' ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />
                          : <IconSelector size={12} />}
                      </span>
                    </button>
                  ) : col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className={styles.stateCell}>
                  <Spinner size="sm" label={loadingLabel} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={styles.emptyCell}>
                  <EmptyState
                    icon={<IconInbox size={40} />}
                    title="Nenhum resultado encontrado"
                    {...empty}
                  />
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className={styles.tr}>
                  {columns.map(col => (
                    <td
                      key={String(col.key)}
                      className={cx(styles.td, col.type === 'actions' && styles.tdActions)}
                      style={{ textAlign: col.align ?? 'left' }}
                    >
                      {renderCell(col, row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
