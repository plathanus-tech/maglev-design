import { useRef, useState } from 'react';
import { Button, DatePicker, Dialog, Dropdown, Popover, Stack } from '@maglev/ds';
import { DevNote } from './dev-notes/DevNote';
import { useIsMobile } from './useMediaQuery';
import { PERIOD_OPTIONS, PeriodKey, Range, rangeText } from './dashboard-period';

/**
 * Seletor de período do Dashboard: o Dropdown de sempre com os atalhos; "Período personalizado" abre um painel com De/Até (até hoje)
 * e Aplicar/Limpar, como os filtros de período das demais telas. Cancelar (fechar o painel) mantém o período anterior. Com o
 * personalizado ativo, o Dropdown mostra o intervalo e o item do intervalo, com "Alterar datas" pequeno, reabre o painel (sem botão extra, para o campo não se deslocar).
 */
export function DashboardPeriod({ period, onPeriod, custom, onCustom, max, note }: {
  period: PeriodKey; onPeriod: (p: PeriodKey) => void; custom: Range; onCustom: (r: Range) => void; max: string; note: string;
}) {
  const isMobile = useIsMobile();
  const anchor = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Range>(custom);
  // O campo fica à direita no desktop largo e à esquerda quando o cabeçalho empilha: o painel alinha à borda que cabe na tela
  const [align, setAlign] = useState<'start' | 'end'>('end');
  const complete = !!draft.from && !!draft.to && draft.to >= draft.from;

  const openPanel = () => {
    const r = anchor.current?.getBoundingClientRect();
    if (r) setAlign(r.left + r.width / 2 < document.documentElement.clientWidth / 2 ? 'start' : 'end');
    setDraft(custom.from && custom.to ? custom : { from: '', to: '' });
    setOpen(true);
  };
  const apply = () => { if (!complete) return; onCustom(draft); onPeriod('custom'); setOpen(false); };
  const clear = () => { onPeriod('7d'); setOpen(false); };
  // O calendário do DatePicker abre em outra camada: clicar nele não é "clicar fora" do painel
  const close = () => { if (document.querySelector('[role="dialog"][aria-modal="true"]')) return; setOpen(false); };

  // Personalizado ativo: o item mostra o intervalo com "Alterar datas" pequeno na lista e, ao escolhê-lo, reabre o painel (o campo continua só com o intervalo, em uma linha)
  const options: Array<{ value: string; label: string; description?: string }> = PERIOD_OPTIONS.map((o) => (o.value === 'custom' && period === 'custom' ? { ...o, label: rangeText(custom), description: 'Alterar datas' } : o));

  const fields = (
    <Stack direction="horizontal" gap="sm">
      <DatePicker size="sm" label="De" value={draft.from} max={draft.to || max} onChange={(v) => setDraft((d) => ({ ...d, from: v }))} showShortcuts={false} />
      <DatePicker size="sm" label="Até" value={draft.to} min={draft.from || undefined} max={max} onChange={(v) => setDraft((d) => ({ ...d, to: v }))} showShortcuts={false} />
    </Stack>
  );
  const buttons = (
    <>
      <Button size="sm" variant="secondary" onClick={clear}>Limpar</Button>
      <Button size="sm" disabled={!complete} onClick={apply}>Aplicar</Button>
    </>
  );

  return (
    <>
      <DevNote note={note}>
        <div ref={anchor} className="period-select">
          <Stack direction="horizontal" gap="sm" align="end">
            <Dropdown label="Período" options={options} value={period} summary={period === 'custom' ? rangeText(custom) : undefined} onChange={(v) => (v === 'custom' ? openPanel() : onPeriod(v as PeriodKey))} />
          </Stack>
        </div>
      </DevNote>
      {isMobile ? (
        <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="Período personalizado" actions={<div className="dialog-actions-row">{buttons}</div>}>
          {fields}
        </Dialog>
      ) : (
        <Popover open={open} onClose={close} anchorRef={anchor} label="Período personalizado" align={align}>
          <Stack gap="md">
            {fields}
            <Stack direction="horizontal" justify="end" gap="sm">{buttons}</Stack>
          </Stack>
        </Popover>
      )}
    </>
  );
}
