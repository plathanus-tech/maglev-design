import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Button } from '../Button/Button';
import styles from './Pagination.module.css';

export interface PaginationProps {
  /** Página atual (começa em 1). */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Quantas páginas mostrar de cada lado da atual. */
  siblings?: number;
  /** Textos para i18n. */
  labels?: { nav: string; previous: string; next: string; page: (n: number) => string };
}

const DEFAULT_LABELS = {
  nav: 'Paginação',
  previous: 'Página anterior',
  next: 'Próxima página',
  page: (n: number) => `Página ${n}`,
};

/** Números de página com reticências: 1 … 4 5 [6] 7 8 … 20 */
function pageItems(page: number, count: number, siblings: number): Array<number | 'gap'> {
  const items: Array<number | 'gap'> = [];
  const start = Math.max(2, page - siblings);
  const end = Math.min(count - 1, page + siblings);
  items.push(1);
  if (start > 2) items.push('gap');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < count - 1) items.push('gap');
  if (count > 1) items.push(count);
  return items;
}

/** Navegação entre páginas de listas e tabelas. */
export function Pagination({ page, pageCount, onPageChange, siblings = 1, labels = DEFAULT_LABELS }: PaginationProps) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={labels.nav} className={styles.nav}>
      <Button
        variant="ghost" size="sm" iconOnly iconLeft={<IconChevronLeft size={16} />}
        aria-label={labels.previous} disabled={page <= 1} onClick={() => onPageChange(page - 1)}
      />
      {pageItems(page, pageCount, siblings).map((item, i) =>
        item === 'gap'
          ? <span key={`gap-${i}`} className={styles.gap} aria-hidden="true">…</span>
          : (
            <Button
              key={item} size="sm"
              variant={item === page ? 'primary' : 'ghost'}
              aria-label={labels.page(item)}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          ),
      )}
      <Button
        variant="ghost" size="sm" iconOnly iconLeft={<IconChevronRight size={16} />}
        aria-label={labels.next} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}
      />
    </nav>
  );
}
