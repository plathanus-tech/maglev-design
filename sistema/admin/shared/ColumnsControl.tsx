import { PointerEvent, ReactNode, useRef, useState } from 'react';
import { IconArrowBackUp, IconArrowDown, IconArrowUp, IconColumns3, IconGripVertical } from '@tabler/icons-react';
import { Badge, Button, Checkbox, Dialog, Stack, TableColumn } from '@maglev/ds';
import { DevNote } from './dev-notes/DevNote';
import { useIsMobile } from './useMediaQuery';
import { Text } from './ui';

/**
 * Colunas da tabela escolhidas pelo usuário: quais aparecem e em que ordem.
 *
 *   const { columns: shown, control } = useColumnPrefs('assinantes', columns);
 *   <Table columns={shown} toolbar={<...>{control}</...>} />
 *
 * - "Ações" (coluna fixa à direita, `sticky: 'right'`) fica fora do controle: sempre visível e por último.
 * - A primeira coluna (identificação do registro) é obrigatória e não pode ser ocultada.
 * - Mobile (< 768px): a tabela vira lista de cards e o mesmo controle segue como "Exibição" e decide quais campos
 *   aparecem em cada card e em que ordem (`fieldsFor`). O que já é título, subtítulo ou status do card (`mobileFixed`)
 *   não entra na lista. A preferência é a mesma do desktop.
 * - Reordenar é por botões subir/descer (funciona por teclado, sem depender de arrastar).
 * - A preferência é salva por tabela. No protótipo fica no navegador (localStorage).
 */
interface Prefs { order: string[]; hidden: string[] }

const storageKey = (tableId: string) => `maglev.v2.columns.${tableId}`;
const load = (tableId: string): Prefs | null => {
  try { return JSON.parse(localStorage.getItem(storageKey(tableId)) ?? 'null'); } catch { return null; }
};
const save = (tableId: string, prefs: Prefs | null) => {
  try { prefs ? localStorage.setItem(storageKey(tableId), JSON.stringify(prefs)) : localStorage.removeItem(storageKey(tableId)); } catch { /* sem storage */ }
};

const isPinned = <T,>(c: TableColumn<T>) => c.sticky === 'right' || c.type === 'actions';

export function useColumnPrefs<T extends Record<string, unknown>>(
  tableId: string,
  columns: TableColumn<T>[],
  options: { locked?: string[]; mobileFixed?: string[] } = {},
) {
  const isMobile = useIsMobile();
  const [prefs, setPrefs] = useState<Prefs | null>(() => load(tableId));
  const [open, setOpen] = useState(false);

  const configurable = columns.filter((c) => !isPinned(c));
  const pinned = columns.filter(isPinned);
  const keys = configurable.map((c) => String(c.key));
  const locked = options.locked ?? keys.slice(0, 1);

  // Ordem efetiva: a salva (só colunas que ainda existem) + colunas novas no fim.
  const known = (prefs?.order ?? []).filter((k) => keys.includes(k));
  const order = [...known, ...keys.filter((k) => !known.includes(k))];
  const hidden = new Set((prefs?.hidden ?? []).filter((k) => keys.includes(k) && !locked.includes(k)));

  // No mobile, o que já é título/subtítulo/status do card não é escolhido aqui.
  const fixedOnMobile = new Set([...locked, ...(options.mobileFixed ?? [])]);
  const listed = (k: string) => !isMobile || !fixedOnMobile.has(k);
  const listedKeys = order.filter(listed);

  const byKey = (k: string) => configurable.find((c) => String(c.key) === k)!;
  const shown = [...order.filter((k) => !hidden.has(k)).map(byKey), ...pinned];
  const customized = hidden.size > 0 || order.some((k, i) => k !== keys[i]);

  const apply = (partial: { order: string[]; hidden: string[] }) => {
    // O diálogo só vê as colunas listadas: as demais mantêm posição e visibilidade.
    const it = partial.order[Symbol.iterator]();
    const next = {
      order: order.map((k) => (listed(k) ? it.next().value as string : k)),
      hidden: [...hidden.values()].filter((k) => !listed(k)).concat(partial.hidden.filter(listed)),
    };
    const isDefault = next.hidden.length === 0 && next.order.every((k, i) => k === keys[i]);
    const value = isDefault ? null : next;
    setPrefs(value);
    save(tableId, value);
  };

  const control = (
    <>
      <DevNote note="Colunas personalizáveis: o usuário escolhe quais colunas aparecem e a ordem delas. O botão se chama “Exibição” no desktop e no mobile; no mobile (cards) decide os campos exibidos em cada card. ⚠️ Na especificação isto é o FE011 (fora do escopo, a negociar) - incluído no protótipo a pedido para avaliação. A coluna principal é obrigatória e “Ações” fica sempre à direita. Reordenar arrastando pela alça (mouse e toque) ou pelos botões subir/descer, que são a alternativa por teclado e leitor de tela. Preferência salva por tabela; 💡 por usuário no backend quando aprovado.">
        <Button
          variant="outline"
          className={isMobile ? "btn-block" : undefined}
          iconLeft={<IconColumns3 size={16} />}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          Exibição
        </Button>
      </DevNote>
      {open && (
        <ColumnsDialog
          columns={configurable}
          keys={keys.filter(listed)}
          order={listedKeys}
          hidden={[...hidden].filter(listed)}
          locked={locked}
          mobile={isMobile}
          onClose={() => setOpen(false)}
          onApply={(next) => { apply(next); setOpen(false); }}
        />
      )}
    </>
  );

  /** Mobile: filtra e ordena os campos do card conforme a preferência (campos sem coluna correspondente ficam no fim). */
  const fieldsFor = <F extends { label: string }>(fields: F[]): F[] => {
    const keyOf = (label: string) => configurable.find((c) => c.label === label)?.key as string | undefined;
    const rank = (f: F) => { const k = keyOf(f.label); return k ? order.indexOf(k) : order.length; };
    return fields.filter((f) => { const k = keyOf(f.label); return !k || !hidden.has(k); }).sort((a, b) => rank(a) - rank(b));
  };

  return { columns: shown, control, openColumns: () => setOpen(true), fieldsFor };
}

function ColumnsDialog<T>({ columns, keys, order, hidden, locked, mobile, onClose, onApply }: {
  columns: TableColumn<T>[];
  keys: string[];
  order: string[];
  hidden: string[];
  locked: string[];
  mobile: boolean;
  onClose: () => void;
  onApply: (next: { order: string[]; hidden: string[] }) => void;
}) {
  const [draftOrder, setDraftOrder] = useState(order);
  const [draftHidden, setDraftHidden] = useState(new Set(hidden));

  const label = (k: string) => columns.find((c) => String(c.key) === k)?.label ?? k;
  const move = (k: string, delta: -1 | 1) => setDraftOrder((o) => {
    const i = o.indexOf(k);
    const j = i + delta;
    if (j < 0 || j >= o.length) return o;
    const next = [...o];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const toggle = (k: string, visible: boolean) => setDraftHidden((h) => {
    const next = new Set(h);
    if (visible) next.delete(k); else next.add(k);
    return next;
  });
  const reset = () => { setDraftOrder(keys); setDraftHidden(new Set()); };

  // Arrastar pela alça (mouse e toque): a linha acompanha o ponteiro e a ordem é atualizada ao passar pelas vizinhas.
  const listRef = useRef<HTMLDivElement>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const startDrag = (k: string) => (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragKey(k);
  };
  const onDrag = (e: PointerEvent<HTMLElement>) => {
    if (!dragKey || !listRef.current) return;
    const others = [...listRef.current.querySelectorAll<HTMLElement>('[data-col]')].filter((r) => r.dataset.col !== dragKey);
    const target = others.filter((r) => { const b = r.getBoundingClientRect(); return e.clientY > b.top + b.height / 2; }).length;
    setDraftOrder((o) => {
      const rest = o.filter((x) => x !== dragKey);
      rest.splice(target, 0, dragKey);
      return rest.every((x, i) => x === o[i]) ? o : rest;
    });
  };
  const endDrag = () => setDragKey(null);

  const row = (k: string, i: number): ReactNode => {
    const isLocked = locked.includes(k);
    return (
      <div key={k} data-col={k} className={`drag-row${dragKey === k ? ' is-dragging' : ''}`}>
      <Stack direction="horizontal" justify="between" align="center" gap="sm">
        <Stack direction="horizontal" align="center" gap="sm">
          <span
            className="drag-handle"
            aria-hidden="true"
            onPointerDown={startDrag(k)}
            onPointerMove={onDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          ><IconGripVertical size={16} /></span>
          <Checkbox
            label={label(k)}
            checked={!draftHidden.has(k)}
            disabled={isLocked}
            onChange={(e) => toggle(k, e.target.checked)}
          />
          {isLocked && <Badge status="neutral">Obrigatória</Badge>}
        </Stack>
        <Stack direction="horizontal" gap="2xs">
          <Button variant="ghost" size="sm" iconOnly iconLeft={<IconArrowUp size={16} />} aria-label={`Mover ${label(k)} para cima`} disabled={i === 0} onClick={() => move(k, -1)} />
          <Button variant="ghost" size="sm" iconOnly iconLeft={<IconArrowDown size={16} />} aria-label={`Mover ${label(k)} para baixo`} disabled={i === draftOrder.length - 1} onClick={() => move(k, 1)} />
        </Stack>
      </Stack>
      </div>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      className="dialog-columns"
      title={mobile ? 'Personalizar campos' : 'Personalizar colunas'}
      actions={(
        <Stack gap="sm" align="stretch" className="dialog-actions-full">
          <Stack direction="horizontal">
            <Button variant="ghost" size="sm" iconLeft={<IconArrowBackUp size={16} />} onClick={reset}>Restaurar padrão</Button>
          </Stack>
          <div className="dialog-actions-row">
            <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={() => onApply({ order: draftOrder, hidden: [...draftHidden] })}>Aplicar</Button>
          </div>
        </Stack>
      )}
    >
      <Stack gap="md">
        <Text>{mobile
          ? 'Selecione os campos exibidos e arraste ou use as setas para reordená-los.'
          : 'Selecione as colunas exibidas e arraste ou use as setas para reordená-las.'}</Text>
        <div ref={listRef}><Stack gap="xs">{draftOrder.map(row)}</Stack></div>
      </Stack>
    </Dialog>
  );
}
