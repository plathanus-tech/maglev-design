/** Junta nomes de classe ignorando valores falsos. Use em vez de `[a, b].filter(Boolean).join(' ')`. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
