import { ReactNode, useEffect, useId, useRef } from 'react';
import { IconX } from '@tabler/icons-react';
import { cx } from '../../utils/cx';
import { FOCUSABLE_SELECTOR } from '../../utils/focusable';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Título (também é o nome acessível do diálogo). */
  title: string;
  /** Texto de apoio sob o título (descreve o diálogo para leitores de tela). */
  subtitle?: string;
  /** Conteúdo do corpo. Pode ser omitido (`null`) quando título e subtítulo bastam. */
  children?: ReactNode;
  /** Botões do rodapé, normalmente `<Button>`s (ação principal à direita). */
  actions?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Ajuste pontual de largura/aparência (ex.: `max-width` entre dois tamanhos). */
  className?: string;
  /** Rótulo do botão de fechar (i18n). */
  closeLabel?: string;
}

/**
 * Diálogo modal: prende o foco, fecha com Esc/clique fora, trava o scroll do fundo
 * e devolve o foco ao elemento que o abriu.
 */
export function Dialog({ open, onClose, title, subtitle, children, actions, size = 'md', className, closeLabel = 'Fechar' }: DialogProps) {
  const titleId = useId();
  const subtitleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const el = dialogRef.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
    (focusables()[0] ?? el)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className={cx(styles.dialog, styles[size], className)}
      >
        <div className={styles.header}>
          <div className={styles.headings}>
            <h2 id={titleId} className={styles.title}>{title}</h2>
            {subtitle && <p id={subtitleId} className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label={closeLabel} type="button"><IconX size={18} aria-hidden="true" /></button>
        </div>
        {children != null && <div className={styles.body}>{children}</div>}
        {actions && <div className={styles.footer}>{actions}</div>}
      </div>
    </div>
  );
}
