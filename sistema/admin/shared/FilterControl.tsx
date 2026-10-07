import { useRef, useState } from 'react';
import { IconChevronDown, IconAdjustmentsHorizontal } from '@tabler/icons-react';
import { Badge, Button, DatePicker, Dialog, Dropdown, Popover, Stack } from '@maglev/ds';
import { DevNote } from './dev-notes/DevNote';
import { useIsMobile } from './useMediaQuery';

/**
 * Filtros agrupados de uma listagem. Regra: com UM filtro, ele fica solto na barra (Dropdown); a partir de DOIS, todos
 * entram neste botão "Filtros" (mesmo formato do "Exibição"). Desktop: popover ancorado ao botão (com seta). Mobile: modal
 * (botão sem seta). Os valores só mudam ao clicar em "Aplicar"; "Limpar" volta tudo para "Todos" e aplica na hora.
 * O botão mostra quantos filtros estão ativos.
 */
export interface FilterDef {
  id: string;
  label: string;
  /** Primeira opção, com value `all` ("Todos os status"): significa "sem filtro". */
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  /** Valor que significa “sem filtro” (não conta como ativo e é o que “Limpar” restaura). Padrão: `todos`. */
  defaultValue?: string;
  /** Intervalo de datas (De/Até) que aparece quando o filtro tem o valor `when` (ex.: Período personalizado). Datas ISO `YYYY-MM-DD`. */
  range?: { when: string; from: string; to: string; onChange: (from: string, to: string) => void };
}
const ALL = 'todos';

export function FilterControl({ filters, note }: { filters: FilterDef[]; note?: string }) {
  const isMobile = useIsMobile();
  const anchor = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const defOf = (f: FilterDef) => f.defaultValue ?? ALL;
  const active = filters.filter((f) => f.value !== defOf(f)).length;
  const openPanel = () => {
    setDraft(Object.fromEntries(filters.flatMap((f) => [[f.id, f.value], ...(f.range ? [[`${f.id}:from`, f.range.from], [`${f.id}:to`, f.range.to]] : [])])));
    setOpen(true);
  };
  const apply = () => {
    filters.forEach((f) => {
      const v = draft[f.id] ?? f.value;
      f.onChange(v);
      if (f.range) f.range.onChange(v === f.range.when ? draft[`${f.id}:from`] ?? '' : '', v === f.range.when ? draft[`${f.id}:to`] ?? '' : '');
    });
    setOpen(false);
  };
  const clear = () => { filters.forEach((f) => { f.onChange(defOf(f)); f.range?.onChange('', ''); }); setOpen(false); };

  const fields = (
    <Stack gap="sm">
      {filters.map((f) => {
        const cur = draft[f.id] ?? f.value;
        const from = draft[`${f.id}:from`] ?? '';
        const to = draft[`${f.id}:to`] ?? '';
        return (
          <Stack key={f.id} gap="sm">
            <Dropdown size="sm" label={f.label} options={f.options} value={cur} onChange={(v) => setDraft((d) => ({ ...d, [f.id]: v }))} />
            {f.range && cur === f.range.when && (
              <Stack direction="horizontal" gap="sm">
                <DatePicker size="sm" label="De" value={from} max={to || undefined} onChange={(v) => setDraft((d) => ({ ...d, [`${f.id}:from`]: v }))} showShortcuts={false} />
                <DatePicker size="sm" label="Até" value={to} min={from || undefined} onChange={(v) => setDraft((d) => ({ ...d, [`${f.id}:to`]: v }))} showShortcuts={false} />
              </Stack>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
  const buttons = (
    <>
      <Button size="sm" variant="secondary" onClick={clear}>Limpar</Button>
      <Button size="sm" onClick={apply}>Aplicar</Button>
    </>
  );

  return (
    <>
      <DevNote note={note ?? 'Filtros agrupados: com mais de um filtro na listagem, eles ficam num botão “Filtros” (popover no desktop, modal no mobile) em vez de soltos na barra. Aplicar confirma; Limpar remove todos. O botão mostra a quantidade de filtros ativos.'}>
        <div ref={anchor} className="filter-anchor">
          <Button
            variant="outline"
            className={isMobile ? 'btn-block' : undefined}
            iconLeft={<IconAdjustmentsHorizontal size={16} />}
            iconRight={isMobile ? undefined : <IconChevronDown size={16} />}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => (open ? setOpen(false) : openPanel())}
          >
            Filtros{active > 0 && <> <Badge status="neutral">{active}</Badge></>}
          </Button>
        </div>
      </DevNote>
      {isMobile ? (
        <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="Filtros" actions={<div className="dialog-actions-row">{buttons}</div>}>
          {fields}
        </Dialog>
      ) : (
        <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} label="Filtros">
          <Stack gap="md">
            {fields}
            <Stack direction="horizontal" justify="end" gap="sm">{buttons}</Stack>
          </Stack>
        </Popover>
      )}
    </>
  );
}
