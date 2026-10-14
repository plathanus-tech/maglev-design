import { useId, useMemo, useRef, useState } from 'react';
import { WorkOrder } from '../../assinante/shared/data';
import { IconAdjustmentsHorizontal, IconCalendar, IconClipboardList, IconFilterOff, IconMapPin, IconTool } from '@tabler/icons-react';
import { Badge, Button, Card, Dialog, Dropdown, EmptyState, Popover, RadioButton, Stack } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useHashState } from '../../admin/shared/useHashState';
import { useMediaQuery } from '../../admin/shared/useMediaQuery';
import { ExternalLayout, mountApp } from '../../externo/shared/ExternalLayout';
import { overdueDays } from '../../assinante/shared/os-common';
import { CategoryIcon } from '../../admin/shared/IconPicker';
import { providerName } from '../../assinante/shared/prestadores';
import { useRefs } from '../../assinante/shared/ui';
import { AddressLink, BlockedAccess, dueInfo, linkTo, ordersOfLink, priorityRank, unitAddress, useProviderLink } from './lib';

/** Estados: idle · empty (sem OS atribuídas) · inactive (prestador inativo - CTA002) · invalid (link inválido) */
const STATES = ['idle', 'empty', 'inactive', 'invalid'] as const;
type Mode = (typeof STATES)[number];

/** Ordenação (não é filtro): fica numa seção própria do painel, separada dos filtros */
const SORTS = [
  { value: 'default', label: 'Prioridade e prazo' },
  { value: 'due', label: 'Prazo mais próximo' },
  { value: 'priority', label: 'Maior prioridade' },
];

/**
 * Minhas OS (Prestador RF101): lista das OS atribuídas ao prestador (ou ao técnico do link), pensada para o celular (RGN003).
 * Campos: número, equipamento, unidade (com endereço), ambiente, problema relatado, prioridade, prazo e status.
 * Ordenação padrão: prioridade (maior primeiro) e prazo (mais próximo primeiro) - RGN002.
 */
function MinhasOsScreen() {
  const refs = useRefs();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const { db, provider, technician, state } = useProviderLink(mode === 'inactive' ? 'inactive' : undefined);
  const [status, setStatus] = useState('todos');
  const [sort, setSort] = useState('default');
  const [tech, setTech] = useState('todos');
  // Celular: botão só com ícone no cabeçalho + bottom sheet; desktop: botão com texto + popover ancorado
  const narrow = useMediaQuery('(max-width: 639px)');
  const [panelOpen, setPanelOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const hintId = useId();
  const shell = (content: React.ReactNode) => <ExternalLayout area="Área do prestador" wide>{content}</ExternalLayout>;

  const all = useMemo(() => (provider && mode !== 'empty' ? ordersOfLink(db, provider, technician) : []), [db, provider, technician, mode]);
  // Só OS em andamento: o link deixa de valer quando a OS é encerrada/cancelada (RF001-RGN004, 💡 sugestão)
  const active = all.filter((o) => ['aberto', 'andamento', 'aguardando'].includes(refs.base(o.statusId) ?? ''));

  if (mode === 'invalid' || !provider || state === 'invalid') return shell(<BlockedAccess state="invalid" />);
  if (state === 'inactive') return shell(<BlockedAccess state="inactive" />);

  const statusOptions = [{ value: 'todos', label: 'Todos os status' }, ...[...new Set(active.map((o) => o.statusId))].map((id) => ({ value: id, label: refs.status(id)?.name ?? id }))];
  const techOptions = [{ value: 'todos', label: 'Todos os técnicos' }, { value: 'none', label: 'Sem técnico definido' }, ...provider.technicians.map((t) => ({ value: t.name, label: t.name }))];
  // A empresa vê as OS de todos os seus técnicos e pode filtrar por técnico; no link individual (ou autônomo) o filtro não faz sentido
  const showTechFilter = provider.kind === 'empresa' && !technician && provider.technicians.length > 0;

  const list = active
    .filter((o) => (status === 'todos' || o.statusId === status))
    .filter((o) => (tech === 'todos' || (tech === 'none' ? !(o.executor.kind === 'prestador' && o.executor.technician) : o.executor.kind === 'prestador' && o.executor.technician === tech)))
    .sort((a, b) => {
      const byPriority = priorityRank(a.priorityId) - priorityRank(b.priorityId);
      const byDue = a.dueAt.localeCompare(b.dueAt);
      return sort === 'due' ? byDue || byPriority : byPriority || byDue;
    });
  const activeFilters = (status !== 'todos' ? 1 : 0) + (showTechFilter && tech !== 'todos' ? 1 : 0);
  const clear = () => { setStatus('todos'); setTech('todos'); setSort('default'); };
  const trigger = (
    <span ref={anchorRef} className="ext-filter-trigger">
      <Button
        variant="ghost" size="sm" iconLeft={<IconAdjustmentsHorizontal size={20} />} aria-haspopup="dialog" aria-expanded={panelOpen} aria-describedby={activeFilters ? hintId : undefined}
        onClick={() => setPanelOpen((v) => !v)}
      >
        {narrow ? 'Filtrar' : 'Filtros e ordenação'}
        {activeFilters > 0 && <span className="ext-filter-count" aria-hidden="true">{activeFilters}</span>}
      </Button>
      {activeFilters > 0 && <span id={hintId} className="sr-only">{activeFilters} {activeFilters === 1 ? 'filtro ativo' : 'filtros ativos'}</span>}
    </span>
  );
  const panel = (
    <Stack gap="lg">
      <section aria-labelledby={`${hintId}-f`} className="ext-panel-section">
        <h3 id={`${hintId}-f`} className="ext-panel-title">Filtros</h3>
        <Dropdown label="Status" options={statusOptions} value={status} onChange={setStatus} />
        {showTechFilter && <Dropdown label="Técnico" options={techOptions} value={tech} onChange={setTech} />}
      </section>
      <section aria-labelledby={`${hintId}-o`} className="ext-panel-section">
        <h3 id={`${hintId}-o`} className="ext-panel-title">Ordenar por</h3>
        <RadioButton name="os-sort" options={SORTS} value={sort} onChange={setSort} />
      </section>
    </Stack>
  );
  const renderItem = (o: WorkOrder) => {
    const eq = db.equipments.find((e) => e.id === o.equipmentId);
    const env = db.environments.find((x) => x.id === eq?.environmentId);
    const unit = db.units.find((u) => u.id === eq?.unitId);
    const categoryIcon = refs.category(eq?.categoryId)?.icon;
    const due = dueInfo(o, refs.base(o.statusId));
    return (
      <li key={o.id}>
        <a className="ext-link-card ext-os" href={linkTo('os.html', provider, technician, { os: o.id })} aria-label={`Abrir ${o.id}: ${eq?.name ?? ''}`}>
          <Card padding="none">
            <div className="ext-os-card">
              <div className="ext-os-head">
                <span className="ext-os-cat" aria-hidden="true">{categoryIcon ? <CategoryIcon id={categoryIcon} size={24} /> : <IconTool size={24} />}</span>
                <div className="ext-os-lead">
                  <span className="ext-os-equipment">{eq?.name ?? '-'}</span>
                  <span className="ext-os-number">{o.id}{o.kind === 'preventiva' && <span className="ext-os-kind">Preventiva</span>}</span>
                </div>
              </div>
              <p className="ext-os-problem">{o.reported}</p>
              <div className="ext-os-badges">
                <span className="ext-os-tags">
                  {refs.priorityBadge(o.priorityId)}
                </span>
                <span className="ext-os-status">{refs.statusBadge(o.statusId)}</span>
              </div>
              <div className="ext-os-meta">
                <div className="ext-os-due">
                  <IconCalendar size={16} aria-hidden="true" />
                  <div>
                    <span className="ext-os-due-date">{due.date}</span>
                    {due.text && <span className={`ext-os-due-rel is-${due.tone}`}>{due.text}</span>}
                  </div>
                </div>
                <div className="ext-os-where">
                  <IconMapPin size={16} aria-hidden="true" />
                  <div>
                    <span className="ext-os-unit">{unit?.name}{env && <span className="ext-os-env">{env.name}</span>}</span>
                    <span className="ext-os-address"><AddressLink address={unitAddress(db, eq)} inCard /></span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </a>
      </li>
    );
  };
  const late = list.filter((o) => overdueDays(o, refs.base(o.statusId)) > 0).length;

  return shell(
    <Stack gap="lg">
      <DevNote note="Prestador RF001/RF101: acesso por link, sem login e sem aplicativo. Só aparecem as OS atribuídas ao prestador, do assinante que o cadastrou (RGN002 / CTA001). 💡 P09: a empresa enxerga as OS de todos os seus técnicos (filtro por técnico); o link individual do técnico mostra só as dele. 💡 RGN004: o link deixa de valer quando a OS é encerrada. Filtros e ordenação ficam num único acionador (bottom sheet no celular, popover no desktop); a ordenação padrão (prioridade e prazo, RGN002) não conta como filtro ativo.">
        <header className="ext-os-header">
          <div className="ext-os-header-text">
            <h1 className="page-title">Minhas OS</h1>
            <p className="page-text">{technician ? `${technician.name} · ${providerName(provider)}` : providerName(provider)}</p>
          </div>
        </header>
      </DevNote>

      <div className="ext-os-toolbar">
        <p className="ext-count" role="status">
          {list.length} OS{late > 0 ? ` · ${late} ${late === 1 ? 'atrasada' : 'atrasadas'}` : ''}
        </p>
        {active.length > 0 && trigger}
      </div>

      {narrow ? (
        <Dialog sheet open={panelOpen} onClose={() => setPanelOpen(false)} size="sm" title="Filtros e ordenação" actions={(
          <>
            <Button variant="secondary" onClick={clear} disabled={activeFilters === 0 && sort === 'default'}>Limpar</Button>
            <Button onClick={() => setPanelOpen(false)}>Ver {list.length} OS</Button>
          </>
        )}>
          {panel}
        </Dialog>
      ) : (
        <Popover open={panelOpen} onClose={() => setPanelOpen(false)} anchorRef={anchorRef} label="Filtros e ordenação" align="end">
          <div className="ext-panel">
            {panel}
            <div className="ext-panel-foot"><Button variant="ghost" size="sm" onClick={clear} disabled={activeFilters === 0 && sort === 'default'}>Limpar</Button></div>
          </div>
        </Popover>
      )}

      {list.length === 0 ? (
        <div className="ext-empty">
          {active.length === 0 ? (
            <EmptyState compact icon={<IconClipboardList size={32} />} headingLevel={2} title="Nenhuma OS atribuída" description="Quando uma OS for atribuída a você, ela aparecerá aqui." />
          ) : (
            <EmptyState
              compact icon={<IconFilterOff size={32} />} headingLevel={2} title="Nenhuma OS encontrada" description="Nenhuma ordem de serviço corresponde aos filtros selecionados."
              action={<Button variant="secondary" size="sm" onClick={clear}>Limpar filtros</Button>}
            />
          )}
        </div>
      ) : (
        <ul className="ext-os-list">{list.map(renderItem)}</ul>
      )}
    </Stack>,
  );
}

mountApp(<MinhasOsScreen />);
