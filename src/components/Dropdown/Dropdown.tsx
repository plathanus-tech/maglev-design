import { CSSProperties, KeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronDown } from '@tabler/icons-react';
import { FormField } from '../FormField/FormField';
import { cx } from '../../utils/cx';
import styles from './Dropdown.module.css';

export interface DropdownOption { label: string; value: string; }

export interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Rótulo visível (recomendado). Sem ele, passe `aria-label`. */
  label?: string;
  'aria-label'?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  /** Campo opcional: mostra “(opcional)” ao lado do rótulo. */
  optional?: boolean;
  className?: string;
}

/** Igual a `--breakpoint-sm` (media queries e matchMedia não aceitam var()). */
const MOBILE_QUERY = '(max-width: 640px)';

/**
 * Seleção de uma opção em lista (padrão ARIA select-only combobox, com teclado).
 * No desktop abre sempre um menu abaixo do campo (a página rola se faltar espaço); em telas pequenas
 * (≤ 640px) abre como folha inferior com fundo escurecido e itens maiores para o toque.
 */
export function Dropdown({
  options, value, onChange, placeholder = 'Selecione...', disabled = false,
  label, 'aria-label': ariaLabel, helperText, error, required, optional, className,
}: DropdownProps) {
  if (import.meta.env.DEV && !label && !ariaLabel) {
    console.warn('Dropdown: forneça `label` ou `aria-label` para que o campo tenha um nome acessível.');
  }
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const listId = useId();
  const selectedIndex = options.findIndex(o => o.value === value);
  const selected = options[selectedIndex];

  // Fecha ao clicar fora (a folha mobile fecha pelo próprio fundo escurecido).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // O menu é renderizado em um portal no <body> (posição fixa sob o campo): assim não é cortado por
  // containers com overflow, como o corpo rolável de um Dialog ou um Card. Na folha mobile o CSS cuida da posição.
  useLayoutEffect(() => {
    if (!open || window.matchMedia(MOBILE_QUERY).matches) { setMenuStyle(undefined); return; }
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const room = window.innerHeight - r.bottom - 16;
      setMenuStyle({ top: r.bottom + 4, left: r.left, width: r.width, maxHeight: Math.max(room, 128) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  // Na folha mobile, trava o scroll do fundo enquanto está aberta.
  useEffect(() => {
    if (!open || !window.matchMedia(MOBILE_QUERY).matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // Mantém a opção ativa visível ao navegar por teclado.
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, listId]);

  const openMenu = () => {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };
  const commit = (i: number) => {
    const opt = options[i];
    if (opt) onChange?.(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); open ? setActive(i => Math.min(i + 1, last)) : openMenu(); break;
      case 'ArrowUp':   e.preventDefault(); open ? setActive(i => Math.max(i - 1, 0)) : openMenu(); break;
      case 'Home':      if (open) { e.preventDefault(); setActive(0); } break;
      case 'End':       if (open) { e.preventDefault(); setActive(last); } break;
      case 'Enter':
      case ' ':         e.preventDefault(); open ? commit(active) : openMenu(); break;
      case 'Escape':    if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); } break;
      case 'Tab':       setOpen(false); break;
    }
  };

  return (
    <FormField label={label} helperText={helperText} error={error} required={required} optional={optional} className={className}>
      {(control) => (
        <div ref={ref} className={cx(styles.anchor, open && styles.open)}>
          <button
            {...control}
            type="button"
            role="combobox"
            className={styles.trigger}
            disabled={disabled}
            aria-label={label ? undefined : ariaLabel}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
            onClick={() => (open ? setOpen(false) : openMenu())}
            onKeyDown={onKeyDown}
          >
            <span className={selected ? undefined : styles.placeholder}>{selected?.label ?? placeholder}</span>
            <span className={styles.chevron} aria-hidden="true"><IconChevronDown size={16} /></span>
          </button>
          {open && createPortal(
            <>
              <div className={styles.backdrop} aria-hidden="true" onClick={() => setOpen(false)} />
              <ul ref={menuRef} id={listId} role="listbox" aria-label={label ?? ariaLabel} className={styles.menu} style={menuStyle}>
                {options.map((opt, i) => (
                  <li
                    key={opt.value}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={opt.value === value}
                    data-active={i === active}
                    className={styles.option}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commit(i)}
                  >
                    {opt.label}
                  </li>
                ))}
              </ul>
            </>,
            document.body,
          )}
        </div>
      )}
    </FormField>
  );
}
