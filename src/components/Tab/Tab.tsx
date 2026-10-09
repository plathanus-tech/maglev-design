import { KeyboardEvent, ReactNode, useId, useRef, useState } from 'react';
import { cx } from '../../utils/cx';
import styles from './Tab.module.css';

export interface TabItem { label: string; content: ReactNode; }

export interface TabProps {
  tabs: TabItem[];
  defaultIndex?: number;
  onChange?: (index: number) => void;
  /** Nome acessível da lista de abas (recomendado quando há mais de um grupo na página). */
  'aria-label'?: string;
}

/** Abas com navegação por setas, Home e End (padrão ARIA Tabs). */
export function Tab({ tabs, defaultIndex = 0, onChange, 'aria-label': ariaLabel }: TabProps) {
  const [active, setActive] = useState(defaultIndex);
  const baseId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const select = (i: number, focus = false) => {
    setActive(i);
    onChange?.(i);
    if (focus) refs.current[i]?.focus();
    // Com muitas abas (mobile), a selecionada nunca fica parcialmente fora da área visível; só rola a lista na horizontal (a página não se move)
    const list = listRef.current;
    const el = refs.current[i];
    if (list && el) {
      const left = el.offsetLeft;
      const right = left + el.offsetWidth;
      if (left < list.scrollLeft) list.scrollTo?.({ left, behavior: 'smooth' });
      else if (right > list.scrollLeft + list.clientWidth) list.scrollTo?.({ left: right - list.clientWidth, behavior: 'smooth' });
    }
  };

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const last = tabs.length - 1;
    const next =
      e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) :
      e.key === 'ArrowLeft'  ? (i === 0 ? last : i - 1) :
      e.key === 'Home' ? 0 :
      e.key === 'End' ? last : null;
    if (next === null) return;
    e.preventDefault();
    select(next, true);
  };

  return (
    <div className={styles.wrapper}>
      <div ref={listRef} className={styles.list} role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab, i) => (
          <button
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            id={`${baseId}-tab-${i}`}
            role="tab"
            type="button"
            aria-selected={active === i}
            aria-controls={`${baseId}-panel-${i}`}
            tabIndex={active === i ? 0 : -1}
            className={cx(styles.tab, active === i && styles.active)}
            onClick={() => select(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={i}
          id={`${baseId}-panel-${i}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${i}`}
          hidden={active !== i}
          tabIndex={0}
          className={styles.panel}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
