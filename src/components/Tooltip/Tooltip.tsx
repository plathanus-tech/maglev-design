import { cloneElement, ReactElement, useId, useState } from 'react';
import { cx } from '../../utils/cx';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  /** Texto curto de apoio. Não coloque conteúdo essencial ou interativo aqui. */
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Elemento focável (botão, link, input) que recebe `aria-describedby`. */
  children: ReactElement<{ 'aria-describedby'?: string }>;
}

/** Dica contextual: aparece em hover/foco, permanece ao pairar sobre ela e fecha com Esc. */
export function Tooltip({ content, placement = 'top', children }: TooltipProps) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);

  return (
    <span
      className={styles.wrapper}
      data-dismissed={dismissed || undefined}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setDismissed(true); } }}
      onMouseLeave={() => setDismissed(false)}
      onBlur={() => setDismissed(false)}
    >
      {cloneElement(children, { 'aria-describedby': id })}
      <span id={id} role="tooltip" className={cx(styles.tip, styles[placement])}>
        <span className={styles.arrow} aria-hidden="true" />
        {content}
      </span>
    </span>
  );
}
