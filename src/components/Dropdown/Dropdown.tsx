import { CSSProperties, KeyboardEvent, ReactNode, RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronDown, IconSearch } from '@tabler/icons-react';
import { FormField } from '../FormField/FormField';
import { cx } from '../../utils/cx';
import styles from './Dropdown.module.css';

export interface DropdownOption {
  label: string;
  value: string;
  /** Informação secundária sob o nome (ex.: fabricante · modelo). */
  description?: string;
  /** Elemento à esquerda (ex.: miniatura). Use `var(--option-leading-size)` para acompanhar o tamanho: 40px na lista, menor no campo. */
  leading?: ReactNode;
  /** Texto extra considerado na busca (a busca já usa `label` e `description`). */
  keywords?: string;
}

export interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Rótulo visível (recomendado). Sem ele, passe `aria-label`. */
  label?: string;
  /** Ação ao lado do rótulo (ex.: botão de ajuda). */
  labelAction?: ReactNode;
  'aria-label'?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  /** Campo opcional: mostra “(opcional)” ao lado do rótulo. */
  optional?: boolean;
  className?: string;
  /** `sm`: campo compacto de 36px com texto de 14px (visual do botão da toolbar), para filtros de tabela. Formulários usam o padrão (`md`). */
  size?: 'md' | 'sm';
  /** Mostra um campo de busca no topo da lista (filtra por nome, descrição e palavras-chave). */
  searchable?: boolean;
  searchPlaceholder?: string;
  searchLabel?: string;
  /** Texto quando a busca não encontra nada. */
  emptyText?: string;
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
  label, labelAction, 'aria-label': ariaLabel, helperText, error, required, optional, className, size = 'md',
  searchable = false, searchPlaceholder = 'Buscar', searchLabel = 'Buscar na lista', emptyText = 'Nenhum resultado',
}: DropdownProps) {
  if (import.meta.env.DEV && !label && !ariaLabel) {
    console.warn('Dropdown: forneça `label` ou `aria-label` para que o campo tenha um nome acessível.');
  }
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const listId = useId();
  const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = norm(query.trim());
  const visible = searchable && q ? options.filter(o => norm(`${o.label} ${o.description ?? ''} ${o.keywords ?? ''}`).includes(q)) : options;
  const selected = options.find(o => o.value === value);

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
    setQuery('');
    setActive(Math.max(options.findIndex(o => o.value === value), 0));
    setOpen(true);
  };
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) triggerRef.current?.focus(); };
  const commit = (i: number) => {
    const opt = visible[i];
    if (opt) onChange?.(opt.value);
    close(searchable);
  };
  // Com busca, o foco vai para o campo de busca ao abrir
  useEffect(() => { if (open && searchable) window.setTimeout(() => searchRef.current?.focus(), 0); }, [open, searchable]);
  // Ao filtrar, a primeira opção vira a ativa
  useEffect(() => { if (open && searchable) setActive(visible.length ? 0 : -1); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const last = visible.length - 1;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); open ? setActive(i => Math.min(i + 1, last)) : openMenu(); break;
      case 'ArrowUp':   e.preventDefault(); open ? setActive(i => Math.max(i - 1, 0)) : openMenu(); break;
      case 'Home':      if (open && !searchable) { e.preventDefault(); setActive(0); } break;
      case 'End':       if (open && !searchable) { e.preventDefault(); setActive(last); } break;
      case 'Enter':     e.preventDefault(); open ? commit(active) : openMenu(); break;
      case ' ':         if (e.target instanceof HTMLInputElement) break; e.preventDefault(); open ? commit(active) : openMenu(); break;
      case 'Escape':    if (open) { e.preventDefault(); e.stopPropagation(); close(searchable); } break;
      case 'Tab':       setOpen(false); break;
    }
  };

  return (
    <FormField label={label} labelAction={labelAction} helperText={helperText} error={error} required={required} optional={optional} className={className} size={size}>
      {(control) => (
        <div ref={ref} className={cx(styles.anchor, open && styles.open)}>
          <button
            {...control}
            ref={triggerRef}
            type="button"
            role="combobox"
            className={cx(styles.trigger, size === 'sm' && styles.triggerSm)}
            disabled={disabled}
            aria-label={label ? undefined : ariaLabel}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
            onClick={() => (open ? setOpen(false) : openMenu())}
            onKeyDown={onKeyDown}
          >
            {selected ? (
              <span className={styles.value}>
                {selected.leading && <span className={styles.triggerLeading} aria-hidden="true">{selected.leading}</span>}
                <span className={styles.valueText}>
                  <span className={styles.valueLabel}>{selected.label}</span>
                  {selected.description && <span className={styles.valueDesc}>{selected.description}</span>}
                </span>
              </span>
            ) : <span className={styles.placeholder}>{placeholder}</span>}
            <span className={styles.chevron} aria-hidden="true"><IconChevronDown size={16} /></span>
          </button>
          {open && createPortal(
            <>
              <div className={styles.backdrop} aria-hidden="true" onClick={() => setOpen(false)} />
              {(() => {
                const items = visible.map((opt, i) => (
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
                    {opt.leading && <span className={styles.optionLeading} aria-hidden="true">{opt.leading}</span>}
                    <span className={styles.optionText}>
                      <span>{opt.label}</span>
                      {opt.description && <span className={styles.optionDesc}>{opt.description}</span>}
                    </span>
                  </li>
                ));
                if (!searchable) {
                  return <ul ref={menuRef as RefObject<HTMLUListElement>} id={listId} role="listbox" aria-label={label ?? ariaLabel} className={styles.menu} style={menuStyle}>{items}</ul>;
                }
                return (
                  <div ref={menuRef as RefObject<HTMLDivElement>} className={cx(styles.menu, styles.menuSearchable)} style={menuStyle}>
                    <div className={styles.search}>
                      <IconSearch size={16} aria-hidden="true" className={styles.searchIcon} />
                      <input
                        ref={searchRef} type="search" className={styles.searchInput} placeholder={searchPlaceholder} aria-label={searchLabel}
                        autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown}
                        aria-controls={listId} aria-activedescendant={active >= 0 && visible.length ? `${listId}-${active}` : undefined}
                      />
                    </div>
                    <ul id={listId} role="listbox" aria-label={label ?? ariaLabel} className={styles.list}>{items}</ul>
                    {visible.length === 0 && <p className={styles.empty} role="status">{emptyText}</p>}
                  </div>
                );
              })()}
            </>,
            document.body,
          )}
        </div>
      )}
    </FormField>
  );
}
