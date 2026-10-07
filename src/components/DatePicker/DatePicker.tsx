import { ChangeEvent, KeyboardEvent, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IconCalendar, IconChevronDown, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { cx } from '../../utils/cx';
import { FOCUSABLE_SELECTOR } from '../../utils/focusable';
import {
  addDays, addMonths, clampDate, formatDisplay, fromISO, isSameDay, maskDigits, parseDisplay, toISO,
} from './dateUtils';
import styles from './DatePicker.module.css';

interface InlineOption { label: string; value: string; }

/**
 * Seletor compacto de mês/ano do cabeçalho do calendário — mesmo padrão visual e de teclado
 * do componente `Dropdown` (menu, opções, seta que inverte), só que sem o `FormField` ao redor
 * (não há label visível aqui) e num tamanho mais compacto, adequado ao cabeçalho.
 */
function InlineSelect({ options, value, ariaLabel, onChange, className }: {
  options: InlineOption[]; value: string; ariaLabel: string; onChange: (value: string) => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedIndex = options.findIndex(o => o.value === value);
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, listId]);

  const openMenu = () => { setActive(selectedIndex >= 0 ? selectedIndex : 0); setOpen(true); };
  const commit = (i: number) => { const opt = options[i]; if (opt) onChange(opt.value); setOpen(false); };

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
    <div ref={ref} className={cx(styles.selectAnchor, open && styles.open, className)}>
      <button
        type="button"
        role="combobox"
        className={styles.select}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span>{selected?.label}</span>
        <IconChevronDown size={14} className={styles.selectChevron} aria-hidden="true" />
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label={ariaLabel} className={styles.selectMenu}>
          {options.map((opt, i) => (
            <li
              key={opt.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={opt.value === value}
              data-active={i === active}
              className={styles.selectOption}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(i)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface DatePickerLabels {
  openCalendar: string;
  calendar: string;
  previousMonth: string;
  nextMonth: string;
  month: string;
  year: string;
  today: string;
  clear: string;
  invalid: string;
  outOfRange: string;
}

const DEFAULT_LABELS: DatePickerLabels = {
  openCalendar: 'Abrir calendário',
  calendar: 'Escolher data',
  previousMonth: 'Mês anterior',
  nextMonth: 'Próximo mês',
  month: 'Mês',
  year: 'Ano',
  today: 'Hoje',
  clear: 'Limpar',
  invalid: 'Data inválida.',
  outOfRange: 'Data fora do período permitido.',
};

export interface DatePickerProps {
  /** Data selecionada em ISO local `YYYY-MM-DD` ('' = vazio). */
  value?: string;
  onChange?: (value: string) => void;
  /** Rótulo visível (recomendado). Sem ele, passe `aria-label`. */
  label?: string;
  'aria-label'?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  /** Campo opcional: mostra “(opcional)” ao lado do rótulo. */
  optional?: boolean;
  disabled?: boolean;
  /** Menor data permitida (ISO). */
  min?: string;
  /** Maior data permitida (ISO). */
  max?: string;
  /** Idioma/formato (ex.: 'pt-BR', 'en-US'). Também define a ordem dia/mês/ano digitada. */
  locale?: string;
  /** 0 = domingo (padrão) · 1 = segunda. */
  weekStartsOn?: 0 | 1;
  /** Dica do formato digitado; ajuste ao trocar `locale`. */
  placeholder?: string;
  /** Mostra os botões "Hoje" e "Limpar" no calendário. */
  showShortcuts?: boolean;
  /** Textos de acessibilidade/mensagens (i18n). */
  labels?: Partial<DatePickerLabels>;
  className?: string;
  /** Atributo `autocomplete` do campo (ex.: `bday` para data de nascimento). */
  autoComplete?: string;
  /** `sm`: campo compacto de 36px com texto de 14px, para filtros de tabela. */
  size?: 'md' | 'sm';
}

/**
 * Seleção de data: campo digitável com máscara + calendário acessível (teclado completo).
 * Valor em ISO `YYYY-MM-DD`. Prefira-o a `<input type="date">`, cujo calendário é do navegador
 * e não segue a identidade visual.
 */
export function DatePicker({
  value = '', onChange, label, 'aria-label': ariaLabel, helperText, error, required, optional, disabled = false,
  min, max, locale = 'pt-BR', weekStartsOn = 0, placeholder = 'dd/mm/aaaa', showShortcuts = true,
  labels: labelsProp, className, autoComplete, size = 'md',
}: DatePickerProps) {
  if (import.meta.env.DEV && !label && !ariaLabel) {
    console.warn('DatePicker: forneça `label` ou `aria-label` para que o campo tenha um nome acessível.');
  }
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const minDate = useMemo(() => fromISO(min), [min]);
  const maxDate = useMemo(() => fromISO(max), [max]);
  const selected = fromISO(value);
  const today = new Date();

  const [text, setText] = useState(() => formatDisplay(selected, locale));
  const [touchedInvalid, setTouchedInvalid] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<Date>(() => selected ?? clampDate(today, minDate, maxDate));

  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  // Posição do calendário: abre para cima quando falta espaço embaixo (e há mais em cima) e alinha à direita quando passaria da borda da tela
  const [dropUp, setDropUp] = useState(false);
  const [alignEnd, setAlignEnd] = useState(false);
  const focusDay = useRef(false);

  // Mantém o texto sincronizado quando `value` muda por fora.
  useEffect(() => { setText(formatDisplay(fromISO(value), locale)); setTouchedInvalid(null); }, [value, locale]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!anchorRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Leva o foco ao dia do cursor após navegação por teclado / abertura.
  useEffect(() => {
    if (open && focusDay.current) {
      focusDay.current = false;
      popupRef.current?.querySelector<HTMLButtonElement>('[data-cursor="true"]')?.focus();
    }
  });

  // Prende o foco dentro do calendário enquanto aberto (diálogo modal — padrão WAI-ARIA APG).
  useEffect(() => {
    if (!open) return;
    const popup = popupRef.current;
    const focusables = () => Array.from(popup?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const inRange = (d: Date) => (!minDate || d >= minDate) && (!maxDate || d <= maxDate);

  const commit = (d: Date | null) => {
    onChange?.(d ? toISO(d) : '');
    setText(formatDisplay(d, locale));
    setTouchedInvalid(null);
  };

  const onTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    const masked = maskDigits(e.target.value, locale);
    setText(masked);
    setTouchedInvalid(null);
    if (masked === '') { onChange?.(''); return; }
    const parsed = parseDisplay(masked, locale);
    if (parsed && inRange(parsed)) { onChange?.(toISO(parsed)); setCursor(parsed); }
  };

  const onTextBlur = () => {
    if (text === '') return;
    const parsed = parseDisplay(text, locale);
    if (!parsed) setTouchedInvalid(labels.invalid);
    else if (!inRange(parsed)) setTouchedInvalid(labels.outOfRange);
  };

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !popupRef.current) return;
    const a = anchorRef.current.getBoundingClientRect();
    const p = popupRef.current.getBoundingClientRect();
    const gap = 16;
    setDropUp(window.innerHeight - a.bottom < p.height + gap && a.top > window.innerHeight - a.bottom);
    setAlignEnd(a.left + p.width > window.innerWidth - gap && a.right - p.width >= gap);
  }, [open]);

  const openCalendar = () => {
    setCursor(selected ?? clampDate(today, minDate, maxDate));
    focusDay.current = true;
    setOpen(true);
  };

  const closeCalendar = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const move = (next: Date) => { focusDay.current = true; setCursor(clampDate(next, minDate, maxDate)); };

  const onGridKeyDown = (e: KeyboardEvent) => {
    const step: Record<string, () => Date> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      Home: () => addDays(cursor, -((cursor.getDay() - weekStartsOn + 7) % 7)),
      End: () => addDays(cursor, 6 - ((cursor.getDay() - weekStartsOn + 7) % 7)),
      PageUp: () => addMonths(cursor, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(cursor, e.shiftKey ? 12 : 1),
    };
    const fn = step[e.key];
    if (fn) { e.preventDefault(); move(fn()); }
  };

  const onAnchorKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); closeCalendar(); }
  };

  // Estrutura do mês exibido
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(cursor);
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, i, 1))),
    [locale],
  );
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 7 + ((i + weekStartsOn) % 7)); // 7/jan/2024 = domingo
    return {
      short: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d),
      long: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d),
    };
  }), [locale, weekStartsOn]);

  const currentYear = today.getFullYear();
  const yearMin = Math.min(minDate?.getFullYear() ?? currentYear - 100, year);
  const yearMax = Math.max(maxDate?.getFullYear() ?? currentYear + 20, year);
  const years = Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMin + i);

  const leading = (new Date(year, month, 1).getDay() - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const dayFormat = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const prevMonthDisabled = minDate ? new Date(year, month, 0) < minDate : false;
  const nextMonthDisabled = maxDate ? new Date(year, month + 1, 1) > maxDate : false;

  return (
    <FormField
      label={label} helperText={helperText} error={error ?? touchedInvalid ?? undefined}
      required={required} optional={optional} className={className} size={size}
    >
      {(control) => (
        <div ref={anchorRef} className={styles.anchor} onKeyDown={onAnchorKeyDown}>
          <div className={styles.inputWrap}>
            <input
              {...control}
              type="text"
              inputMode="numeric"
              className={cx(styles.input, size === 'sm' && styles.inputSm)}
              value={text}
              placeholder={placeholder}
              disabled={disabled}
              autoComplete={autoComplete}
              aria-label={label ? undefined : ariaLabel}
              onChange={onTextChange}
              onBlur={onTextBlur}
            />
            <button
              ref={triggerRef}
              type="button"
              className={styles.trigger}
              disabled={disabled}
              aria-label={labels.openCalendar}
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => (open ? closeCalendar(false) : openCalendar())}
            >
              <IconCalendar size={18} aria-hidden="true" />
            </button>
          </div>

          {open && (
            <div ref={popupRef} role="dialog" aria-modal="true" aria-label={labels.calendar} className={cx(styles.popup, dropUp && styles.popupUp, alignEnd && styles.popupEnd)}>
              <div className={styles.header}>
                <button
                  type="button" className={styles.navBtn} aria-label={labels.previousMonth}
                  disabled={prevMonthDisabled} onClick={() => setCursor(clampDate(addMonths(cursor, -1), minDate, maxDate))}
                >
                  <IconChevronLeft size={18} aria-hidden="true" />
                </button>
                <div className={styles.selects}>
                  <InlineSelect
                    className={styles.monthAnchor}
                    ariaLabel={labels.month}
                    value={String(month)}
                    options={monthNames.map((n, i) => ({ label: n, value: String(i) }))}
                    onChange={(v) => setCursor(clampDate(new Date(year, +v, Math.min(cursor.getDate(), new Date(year, +v + 1, 0).getDate())), minDate, maxDate))}
                  />
                  <InlineSelect
                    className={styles.yearAnchor}
                    ariaLabel={labels.year}
                    value={String(year)}
                    options={years.map(y => ({ label: String(y), value: String(y) }))}
                    onChange={(v) => setCursor(clampDate(addMonths(cursor, (+v - year) * 12), minDate, maxDate))}
                  />
                </div>
                <button
                  type="button" className={styles.navBtn} aria-label={labels.nextMonth}
                  disabled={nextMonthDisabled} onClick={() => setCursor(clampDate(addMonths(cursor, 1), minDate, maxDate))}
                >
                  <IconChevronRight size={18} aria-hidden="true" />
                </button>
              </div>

              <span className={styles.srOnly} aria-live="polite">{monthLabel}</span>

              <table className={styles.grid} role="grid" aria-label={monthLabel} onKeyDown={onGridKeyDown}>
                <thead>
                  <tr>
                    {weekdays.map(w => (
                      <th key={w.long} scope="col" className={styles.weekday} abbr={w.long}>{w.short}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => (
                    <tr key={wi}>
                      {week.map((d, di) => {
                        if (!d) return <td key={di} className={styles.cell} />;
                        const isSelected = selected ? isSameDay(d, selected) : false;
                        const isCursor = isSameDay(d, cursor);
                        return (
                          <td key={di} className={styles.cell} role="gridcell" aria-selected={isSelected}>
                            <button
                              type="button"
                              className={cx(styles.day, isSameDay(d, today) && styles.today)}
                              aria-label={dayFormat.format(d)}
                              aria-pressed={isSelected}
                              aria-current={isSameDay(d, today) ? 'date' : undefined}
                              data-cursor={isCursor}
                              tabIndex={isCursor ? 0 : -1}
                              disabled={!inRange(d)}
                              onClick={() => { commit(d); closeCalendar(); }}
                            >
                              {d.getDate()}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {showShortcuts && (
                <div className={styles.footer}>
                  <Button
                    size="sm" variant="ghost" disabled={!inRange(today)}
                    onClick={() => { commit(clampDate(today, minDate, maxDate)); closeCalendar(); }}
                  >
                    {labels.today}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { commit(null); closeCalendar(); }}>
                    {labels.clear}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </FormField>
  );
}
