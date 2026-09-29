/** Datas em ISO local `YYYY-MM-DD` (sem fuso), para evitar deslocamentos de um dia. */

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

export function toISO(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Converte `YYYY-MM-DD` em Date local; retorna null se inválido (ex.: 2026-02-31). */
export function fromISO(iso?: string): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1000) return null;
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Soma meses mantendo o dia (ajustado ao último dia do mês de destino). */
export function addMonths(d: Date, n: number): Date {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last));
}

export function clampDate(d: Date, min: Date | null, max: Date | null): Date {
  if (min && d < min) return min;
  if (max && d > max) return max;
  return d;
}

export const isSameDay = (a: Date, b: Date) => toISO(a) === toISO(b);

/* ── Formato por idioma ──────────────────────────────────────────────── */

type Part = 'day' | 'month' | 'year';
const LENGTH: Record<Part, number> = { day: 2, month: 2, year: 4 };

export function localeFormat(locale: string): { order: Part[]; separator: string } {
  const parts = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
    .formatToParts(new Date(2000, 10, 22));
  const order = parts.map(p => p.type).filter((t): t is Part => t === 'day' || t === 'month' || t === 'year');
  const separator = parts.find(p => p.type === 'literal')?.value.trim() || '/';
  return { order, separator };
}

export function formatDisplay(date: Date | null, locale: string): string {
  if (!date) return '';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

/** Aplica a máscara enquanto o usuário digita (ex.: 18092026 → 18/09/2026). */
export function maskDigits(text: string, locale: string): string {
  const { order, separator } = localeFormat(locale);
  const digits = text.replace(/\D/g, '').slice(0, 8);
  const chunks: string[] = [];
  let i = 0;
  for (const part of order) {
    const chunk = digits.slice(i, i + LENGTH[part]);
    if (!chunk) break;
    chunks.push(chunk);
    i += LENGTH[part];
  }
  return chunks.join(separator);
}

/** Lê o texto digitado (8 dígitos) segundo o idioma; null se incompleto ou inexistente. */
export function parseDisplay(text: string, locale: string): Date | null {
  const digits = text.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const { order } = localeFormat(locale);
  const values: Record<Part, string> = { day: '', month: '', year: '' };
  let i = 0;
  for (const part of order) { values[part] = digits.slice(i, i + LENGTH[part]); i += LENGTH[part]; }
  return fromISO(`${values.year}-${values.month}-${values.day}`);
}
