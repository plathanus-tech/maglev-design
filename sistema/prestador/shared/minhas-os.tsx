import { useId, useMemo, useRef, useState } from 'react';
import { WorkOrder } from '../../assinante/shared/data';
import { IconAdjustmentsHorizontal, IconCalendar, IconClipboardList, IconFilterOff, IconHistory, IconLogout, IconMapPin, IconTool } from '@tabler/icons-react';
import { Badge, Button, Card, Dialog, Dropdown, EmptyState, Popover, RadioButton, Stack, Tab } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { formatDate } from '../../admin/shared/format';
import { useHashState } from '../../admin/shared/useHashState';
import { useMediaQuery } from '../../admin/shared/useMediaQuery';
import { ExternalLayout, mountApp } from '../../externo/shared/ExternalLayout';
import { overdueDays } from '../../assinante/shared/os-common';
import { CategoryIcon } from '../../admin/shared/IconPicker';
import { orderCompletedAt, providerName } from '../../assinante/shared/prestadores';
import { useRefs } from '../../assinante/shared/ui';
import { AddressLink, BlockedAccess, dueInfo, linkTo, ordersOfLink, priorityRank, unitAddress, useProviderLink } from './lib';
import { endSession } from './otp-session';

/** Estados: idle · empty (sem OS atribuídas) · inactive (prestador inativo - CTA002) · invalid (link inválido) · history (abre na aba Histórico) · nohistory (Histórico vazio) */
const STATES = ['idle', 'empty', 'inactive', 'invalid', 'history', 'nohistory'] as const;
type Mode = (typeof STATES)[number];

type Kind = 'active' | 'history';

/** Ordenação (não é filtro): fica numa seção própria do painel, separada dos filtros */
const SORTS: Record<Kind, Array<{ value: string; label: string }>> = {
  active: [
    { value: 'default', label: 'Prioridade e prazo' },
    { value: 'due', label: 'Prazo mais próximo' },
    { value: 'priority', label: 'Maior prioridade' },
  ],
  history: [
    { value: 'default', label: 'Mais recentes primeiro' },
    { value: 'oldest', label: 'Mais antigas primeiro' },
  ],
};

const HISTORY_PAGE = 10;

/**
 * Minhas OS (Prestador RF101): lista das OS atribuídas ao prestador (ou ao técnico do link), pensada para o celular (RGN003).
 * Duas abas: Ativas (em andamento, ordenadas por prioridade e prazo - RGN002) e Histórico (concluídas e canceladas, só consulta).
 * Campos: número, equipamento, unidade (com endereço), ambiente, problema relatado, prioridade, prazo (ou data de encerramento) e status.
 */
function MinhasOsScreen() {
  const refs = useRefs();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const { db, provider, technician, state } = useProviderLink(mode === 'inactive' ? 'inactive' : undefined);
  const shell = (content: React.ReactNode) => <ExternalLayout area="Área do prestador" wide>{content}</ExternalLayout>;

  const all = useMemo(() => (provider && mode !== 'empty' ? ordersOfLink(db, provider, technician) : []), [db, provider, technician, mode]);
  // Ativas: OS em andamento (inclui "Aguardando validação": o prestador já indicou a conclusão, mas a OS ainda não foi encerrada)
  const active = all.filter((o) => ['aberto', 'andamento', 'aguardando'].includes(refs.base(o.statusId) ?? ''));
  // Histórico: OS encerradas (concluídas e canceladas), só para consulta
  const history = mode === 'nohistory' ? [] : all.filter((o) => ['concluido', 'cancelado'].includes(refs.base(o.statusId) ?? ''));

  if (mode === 'invalid' || !provider || state === 'invalid') return shell(<BlockedAccess state="invalid" />);
  if (state === 'inactive') return shell(<BlockedAccess state="inactive" />);
  if (state === 'auth') return null;   // sem sessão: redireciona para o acesso (celular + código)

  const logout = () => { endSession(); window.location.href = 'acesso.html'; };
  // A empresa vê as OS de todos os seus técnicos e pode filtrar por técnico; no link individual (ou autônomo) o filtro não faz sentido
  const showTechFilter = provider.kind === 'empresa' && !technician && provider.technicians.length > 0;
  const ctx = { db, provider, technician, refs, showTechFilter };

  return shell(
    <Stack gap="lg">
      <DevNote note="Prestador RF001/RF101: acesso por link + celular e código (sem senha e sem aplicativo). Só aparecem as OS atribuídas ao prestador, do assinante que o cadastrou (RGN002 / CTA001). 💡 P09: a empresa enxerga as OS de todos os seus técnicos (filtro por técnico); quem entra com o celular de um técnico vê só as dele. Duas abas: Ativas (em atendimento) e Histórico (concluídas e canceladas, só consulta, a pedido do cliente); a OS encerrada deixou de “expirar” porque o acesso agora é protegido pelo código. Filtros e ordenação ficam num único acionador (bottom sheet no celular, popover no desktop); a ordenação padrão não conta como filtro ativo.">
        <header className="ext-os-header">
          <div className="ext-os-header-text">
            <h1 className="page-title">Minhas OS</h1>
            <p className="page-text">{technician ? `${technician.name} · ${providerName(provider)}` : providerName(provider)}</p>
          </div>
          <Button variant="ghost" size="sm" iconLeft={<IconLogout size={16} />} onClick={logout}>Sair</Button>
        </header>
      </DevNote>

      <Tab
        aria-label="Minhas OS"
        defaultIndex={mode === 'history' || mode === 'nohistory' ? 1 : 0}
        tabs={[
          { label: `Ativas (${active.length})`, content: <OsList kind="active" orders={active} otherCount={history.length} {...ctx} /> },
          { label: `Histórico (${history.length})`, content: <OsList kind="history" orders={history} otherCount={active.length} {...ctx} /> },
        ]}
      />
    </Stack>,
  );
}

type Ctx = {
  db: ReturnType<typeof useProviderLink>['db'];
  provider: NonNullable<ReturnType<typeof useProviderLink>['provider']>;
  technician: ReturnType<typeof useProviderLink>['technician'];
  refs: ReturnType<typeof useRefs>;
  showTechFilter: boolean;
};

/** Lista de uma aba, com o próprio acionador de filtros e ordenação (cada aba guarda os seus filtros). */
function OsList({ kind, orders, otherCount, db, provider, technician, refs, showTechFilter }: Ctx & { kind: Kind; orders: WorkOrder[]; otherCount: number }) {
  const isHistory = kind === 'history';
  const [status, setStatus] = useState('todos');
  const [sort, setSort] = useState('default');
  const [tech, setTech] = useState('todos');
  const [shown, setShown] = useState(HISTORY_PAGE);
  // Celular: botão só com ícone no cabeçalho + bottom sheet; desktop: botão com texto + popover ancorado
  const narrow = useMediaQuery('(max-width: 639px)');
  const [panelOpen, setPanelOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const hintId = useId();

  const statusOptions = [{ value: 'todos', label: 'Todos os status' }, ...[...new Set(orders.map((o) => o.statusId))].map((id) => ({ value: id, label: refs.status(id)?.name ?? id }))];
  const techOptions = [{ value: 'todos', label: 'Todos os técnicos' }, { value: 'none', label: 'Sem técnico definido' }, ...provider.technicians.map((t) => ({ value: t.name, label: t.name }))];

  const closedAt = (o: WorkOrder) => orderCompletedAt(db, o);
  const list = orders
    .filter((o) => (status === 'todos' || o.statusId === status))
    .filter((o) => (tech === 'todos' || (tech === 'none' ? !(o.executor.kind === 'prestador' && o.executor.technician) : o.executor.kind === 'prestador' && o.executor.technician === tech)))
    .sort((a, b) => {
      if (isHistory) return sort === 'oldest' ? closedAt(a).localeCompare(closedAt(b)) : closedAt(b).localeCompare(closedAt(a));
      const byPriority = priorityRank(a.priorityId) - priorityRank(b.priorityId);
      const byDue = a.dueAt.localeCompare(b.dueAt);
      return sort === 'due' ? byDue || byPriority : byPriority || byDue;
    });
  const activeFilters = (status !== 'todos' ? 1 : 0) + (showTechFilter && tech !== 'todos' ? 1 : 0);
  const clear = () => { setStatus('todos'); setTech('todos'); setSort('default'); setShown(HISTORY_PAGE); };
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
        <Dropdown label="Status" options={statusOptions} value={status} onChange={(v) => { setStatus(v); setShown(HISTORY_PAGE); }} />
        {showTechFilter && <Dropdown label="Técnico" options={techOptions} value={tech} onChange={(v) => { setTech(v); setShown(HISTORY_PAGE); }} />}
      </section>
      <section aria-labelledby={`${hintId}-o`} className="ext-panel-section">
        <h3 id={`${hintId}-o`} className="ext-panel-title">Ordenar por</h3>
        <RadioButton name={`os-sort-${kind}`} options={SORTS[kind]} value={sort} onChange={setSort} />
      </section>
    </Stack>
  );

  const renderItem = (o: WorkOrder) => {
    const eq = db.equipments.find((e) => e.id === o.equipmentId);
    const env = db.environments.find((x) => x.id === eq?.environmentId);
    const unit = db.units.find((u) => u.id === eq?.unitId);
    const categoryIcon = refs.category(eq?.categoryId)?.icon;
    const base = refs.base(o.statusId);
    const due = dueInfo(o, base);
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
                    {isHistory ? (
                      <>
                        <span className="ext-os-due-date">{formatDate(closedAt(o).slice(0, 10))}</span>
                        <span className="ext-os-due-rel is-neutral">{base === 'cancelado' ? 'Cancelada' : 'Concluída'}</span>
                      </>
                    ) : (
                      <>
                        <span className="ext-os-due-date">{due.date}</span>
                        {due.text && <span className={`ext-os-due-rel is-${due.tone}`}>{due.text}</span>}
                      </>
                    )}
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

  const late = isHistory ? 0 : list.filter((o) => overdueDays(o, refs.base(o.statusId)) > 0).length;
  const visible = isHistory ? list.slice(0, shown) : list;
  const count = isHistory
    ? `${list.length} ${list.length === 1 ? 'OS encerrada' : 'OS encerradas'}`
    : `${list.length} OS${late > 0 ? ` · ${late} ${late === 1 ? 'atrasada' : 'atrasadas'}` : ''}`;

  return (
    <Stack gap="lg">
      <div className="ext-os-toolbar">
        <p className="ext-count" role="status">{count}</p>
        {orders.length > 0 && trigger}
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
          {orders.length === 0 ? (
            isHistory ? (
              <EmptyState compact icon={<IconHistory size={32} />} headingLevel={2} title="Nenhuma OS no histórico" description="As OS concluídas ou canceladas aparecem aqui, só para consulta." />
            ) : (
              <EmptyState
                compact icon={<IconClipboardList size={32} />} headingLevel={2} title={otherCount > 0 ? 'Nenhuma OS em atendimento' : 'Nenhuma OS atribuída'}
                description={otherCount > 0 ? 'Quando uma nova OS for atribuída a você, ela aparecerá aqui. As encerradas estão no Histórico.' : 'Quando uma OS for atribuída a você, ela aparecerá aqui.'}
              />
            )
          ) : (
            <EmptyState
              compact icon={<IconFilterOff size={32} />} headingLevel={2} title="Nenhuma OS encontrada" description="Nenhuma ordem de serviço corresponde aos filtros selecionados."
              action={<Button variant="secondary" size="sm" onClick={clear}>Limpar filtros</Button>}
            />
          )}
        </div>
      ) : (
        <>
          <ul className="ext-os-list">{visible.map(renderItem)}</ul>
          {isHistory && list.length > shown && (
            <div className="ext-actions"><Button variant="secondary" onClick={() => setShown((n) => n + HISTORY_PAGE)}>Mostrar mais ({list.length - shown})</Button></div>
          )}
        </>
      )}
    </Stack>
  );
}

mountApp(<MinhasOsScreen />);
