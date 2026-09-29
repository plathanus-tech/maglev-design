import { ReactNode, useId, useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import { cx } from '../../utils/cx';
import styles from './Accordion.module.css';

export interface AccordionItem { title: string; content: ReactNode; }

export interface AccordionProps {
  items: AccordionItem[];
  /** Permite vários itens abertos ao mesmo tempo. */
  allowMultiple?: boolean;
  defaultOpenIndex?: number[];
  /** Nível do heading que envolve cada título (2–6), para manter a hierarquia da página. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
}

export function Accordion({ items, allowMultiple = false, defaultOpenIndex = [], headingLevel = 3 }: AccordionProps) {
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(new Set(defaultOpenIndex));
  const baseId = useId();
  const Heading = `h${headingLevel}` as const;

  const toggle = (i: number) => {
    setOpenIndexes(prev => {
      const next = new Set(prev);
      if (next.has(i)) { next.delete(i); }
      else {
        if (!allowMultiple) next.clear();
        next.add(i);
      }
      return next;
    });
  };

  return (
    <div className={styles.accordion}>
      {items.map((item, i) => {
        const isOpen = openIndexes.has(i);
        return (
          <div key={i} className={cx(styles.item, isOpen && styles.open)}>
            <Heading className={styles.heading}>
              <button
                id={`${baseId}-trigger-${i}`}
                className={styles.trigger}
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                aria-controls={`${baseId}-panel-${i}`}
                type="button"
              >
                <span>{item.title}</span>
                <span className={styles.chevron} aria-hidden="true"><IconChevronDown size={16} /></span>
              </button>
            </Heading>
            <div
              id={`${baseId}-panel-${i}`}
              role="region"
              aria-labelledby={`${baseId}-trigger-${i}`}
              className={styles.panel}
            >
              <div className={styles.panelInner}>
                <div className={styles.content}>{item.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
