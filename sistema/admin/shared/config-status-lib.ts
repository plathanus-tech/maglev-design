import { StatusItem, StatusModule } from './data';

/**
 * Posição no fluxo: o usuário escolhe "No início", "Depois de <status>" ou "No final" entre os status do módulo; a ordem numérica
 * é só interna. `start` | `end` | `after:<id>`.
 */
export const siblingsOf = (all: StatusItem[], module: StatusModule | '', selfId?: string) =>
  all.filter((s) => s.module === module && s.id !== selfId).sort((a, b) => a.order - b.order);
export const positionKey = (siblings: StatusItem[], index: number) => (index <= 0 ? 'start' : index >= siblings.length ? 'end' : `after:${siblings[index - 1].id}`);
export const positionOptions = (siblings: StatusItem[]) => [
  { value: 'start', label: 'No início' },
  // “Depois do último” equivale a “No final”: não é oferecido duas vezes
  ...siblings.slice(0, -1).map((s) => ({ value: `after:${s.id}`, label: `Depois de “${s.name}”` })),
  { value: 'end', label: 'No final' },
];
/** Insere `id` na posição escolhida entre os status do módulo e renumera a ordem (1..n) sem repetir nem pular posições. */
export const placeStatus = (list: StatusItem[], id: string, position: string): StatusItem[] => {
  const target = list.find((s) => s.id === id)!;
  const siblings = siblingsOf(list, target.module, id);
  const index = position === 'start' ? 0 : position === 'end' ? siblings.length : siblings.findIndex((s) => s.id === position.slice(6)) + 1;
  const ordered = [...siblings.slice(0, index), target, ...siblings.slice(index)];
  const order = new Map(ordered.map((s, i) => [s.id, i + 1]));
  return list.map((s) => (order.has(s.id) ? { ...s, order: order.get(s.id)! } : s));
};
/** Renumera um módulo (1..n) mantendo a ordem atual: usado quando um status sai dele. */
export const renumber = (list: StatusItem[], module: StatusModule): StatusItem[] => {
  const order = new Map(siblingsOf(list, module).map((s, i) => [s.id, i + 1]));
  return list.map((s) => (order.has(s.id) ? { ...s, order: order.get(s.id)! } : s));
};
