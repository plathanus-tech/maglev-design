import { KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
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
  className?: string;
}

/** Igual a `--breakpoint-sm` (media queries e matchMedia não aceitam var()). */
const MOBILE_QUERY = '(max-width: 640px)';
/** Altura aproximada do menu (15rem) usada para decidir se abre para cima. */
const MENU_SPACE = 260;

/**
 * Seleção de uma opção em lista (padrão ARIA select-only combobox, com teclado).
 * No desktop abre um menu abaixo do campo (ou acima, se faltar espaço); em telas pequenas
 * (≤ 640px) abre como folha inferior com fundo escurecido e itens maiores para o toque.
 */
export function Dropdown({
  options, value, onChange, placeholder = 'Selecione...', disabled = false,
  label, 'aria-label': ariaLabel, helperText, error, required, className,
}: DropdownProps) {
  if (import.meta.env.DEV && !label && !ariaLabel) {
    console.warn('Dropdown: forneça `label` ou `aria-label` para que o campo tenha um nome acessível.');
  }
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedIndex = options.findIndex(o => o.value === value);
  const selected = options[selectedIndex];

  // Fecha ao clicar fora (a folha mobile fecha pelo próprio fundo escurecido).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      setPlacement(below < MENU_SPACE && rect.top > below ? 'top' : 'bottom');
    }
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
    <FormField label={label} helperText={helperText} error={error} required={required} className={className}>
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
          {open && (
            <>
              <div className={styles.backdrop} aria-hidden="true" onClick={() => setOpen(false)} />
              <ul id={listId} role="listbox" aria-label={label ?? ariaLabel} data-placement={placement} className={styles.menu}>
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
            </>
          )}
        </div>
      )}
    </FormField>
  );
}
