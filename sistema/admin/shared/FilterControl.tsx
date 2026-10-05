import { useRef, useState } from 'react';
import { IconChevronDown, IconFilter } from '@tabler/icons-react';
import { Badge, Button, Dialog, Dropdown, Popover, Stack } from '@maglev/ds';
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
}
const ALL = 'todos';

export function FilterControl({ filters, note }: { filters: FilterDef[]; note?: string }) {
  const isMobile = useIsMobile();
  const anchor = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const active = filters.filter((f) => f.value !== ALL).length;
  const openPanel = () => { setDraft(Object.fromEntries(filters.map((f) => [f.id, f.value]))); setOpen(true); };
  const apply = () => { filters.forEach((f) => f.onChange(draft[f.id] ?? f.value)); setOpen(false); };
  const clear = () => { filters.forEach((f) => f.onChange(ALL)); setOpen(false); };

  const fields = (
    <Stack gap="md">
      {filters.map((f) => (
        <Dropdown key={f.id} label={f.label} options={f.options} value={draft[f.id] ?? f.value} onChange={(v) => setDraft((d) => ({ ...d, [f.id]: v }))} />
      ))}
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
            iconLeft={<IconFilter size={16} />}
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
