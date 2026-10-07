import { CSSProperties, ReactNode, RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Popover.module.css';

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** Elemento que abre o popover (botão). O painel se posiciona sob ele e cliques nele não contam como "fora". */
  anchorRef: RefObject<HTMLElement>;
  /** Nome acessível do painel. */
  label: string;
  /** Alinhamento da borda do painel com a do botão. */
  align?: 'start' | 'end';
  /** Menu de ações curto: no mobile o painel se ajusta ao conteúdo (em vez da largura padrão) e fica dentro da margem da tela. */
  fit?: boolean;
  children: ReactNode;
}

/**
 * Painel flutuante ancorado a um botão, para controles de apoio (ex.: filtros de uma tabela). Renderiza em um portal
 * (não é cortado por overflow), fecha com Esc e ao clicar fora, e devolve o foco ao botão. Campos com menu próprio
 * (Dropdown) funcionam dentro dele: enquanto um menu está aberto, o clique não fecha o painel.
 * Para conteúdo que exige decisão ou foco preso, use `Dialog`.
 */
export function Popover({ open, onClose, anchorRef, label, align = 'end', fit = false, children }: PopoverProps) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      setStyle({ top: r.bottom + 4, ...(align === 'end' ? { right: document.documentElement.clientWidth - r.right } : { left: r.left }) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, align, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const close = (restoreFocus: boolean) => { onCloseRef.current(); if (restoreFocus) (anchorRef.current?.querySelector<HTMLElement>('button, [href], input') ?? anchorRef.current)?.focus(); };
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      if (document.querySelector('[role="listbox"]')) return; // há um menu aberto: o clique é dele
      close(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[role="listbox"]')) return;
      e.stopPropagation();
      close(true);
    };
    document.addEventListener('mousedown', down, true);
    document.addEventListener('keydown', key);
    panelRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
    return () => { document.removeEventListener('mousedown', down, true); document.removeEventListener('keydown', key); };
  }, [open, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div ref={panelRef} id={id} role="dialog" aria-label={label} className={fit ? `${styles.panel} ${styles.fit}` : styles.panel} style={style}>
      {children}
    </div>,
    document.body,
  );
}
