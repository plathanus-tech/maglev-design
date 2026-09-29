import { ReactNode } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import styles from './Breadcrumb.module.css';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: ReactNode;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={styles.nav}>
      <ol className={styles.list}>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className={styles.item}>
              {isLast ? (
                /* Selected — texto bold + ícone opcional */
                <span className={styles.current} aria-current="page">
                  {item.label}
                  {item.icon && <span className={styles.icon} aria-hidden="true">{item.icon}</span>}
                </span>
              ) : (
                /* Default — link + separador chevron embutido */
                <a href={item.href ?? '#'} className={styles.link}>
                  {item.label}
                  <span className={styles.sep} aria-hidden="true">
                    <IconChevronRight size={12} />
                  </span>
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
