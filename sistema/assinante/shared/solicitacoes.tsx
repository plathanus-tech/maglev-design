import { useEffect, useMemo, useState } from 'react';
import { IconCircleCheck, IconClipboardList, IconClockHour4, IconEye, IconInbox, IconListCheck, IconPlus, IconSearch } from '@tabler/icons-react';
import { Button, Feedback, Input, KpiCard, Stack, Table, TableColumn, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { FilterControl } from '../../admin/shared/FilterControl';
import { useColumnPrefs } from '../../admin/shared/ColumnsControl';
import { MobileCardList } from '../../admin/shared/MobileCardList';
import { useHashState } from '../../admin/shared/useHashState';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { formatDateTime, formatNumber, noBreak, openedAgo } from '../../admin/shared/format';
import { DEMO_NOW, Request } from './data';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { requestsVisible, unitIdOfEquipment, unitName, userName, useSubSession } from './store';
import { CellPair, Col, Grid, RowAction, RowActions, TableToolbar, goTo, param, takeFlash, useRefs } from './ui';
import { ConcludeDialog, STS, canConclude, hoursSince, isOpenBase } from './solicitacoes-shared';

/** Estados: idle · noresults (busca sem resultado) · conclude (RF401-FLU006: abre "Concluir sem OS" da primeira solicitação elegível) */
const STATES = ['idle', 'noresults', 'conclude'] as const;
type Mode = (typeof STATES)[number];

const PAGE_SIZE = 10;
const DAY = 24 * 3_600_000;
/** Período pela data de abertura: todo o período ou um intervalo De/Até. A visão “em aberto” é do filtro de Status (padrão). */
const PERIOD_OPTIONS = [
  { value: 'todos', label: 'Todo o período' },
  { value: 'custom', label: 'Período personalizado' },
];
const OPEN = 'aberto';
/** Filtros por URL (README): `?filter=` → status / atribuição. */
const URL_STATUS: Record<string, string> = { new: STS.NEW, triage: STS.TRIAGE, converted: STS.CONVERTED, pending: 'pending' };

const URL_SUB: Record<string, string> = { new: STS.NEW, approved: STS.APPROVED, 'awaiting-info': STS.WAITING };

interface View { r: Request; unitId: string; base?: string }
type Row = Record<string, unknown> & { id: string; v: View };

function SolicitacoesScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const refs = useRefs();
  const { db, user, can, unitIds } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');

  const urlFilter = param('filter') ?? '';
  const urlEquipment = param('equipment');
  const urlUnit = param('unit');
  // `&sub=new|approved|awaiting-info` refina `assigned-me`/`pending` (números do Início batem com a lista)
  const urlSub = URL_SUB[param('sub') ?? ''];
  // Padrão: só as abertas; filtro por equipamento/unidade (links do Equipamento e do Início) abre todos os status
  const initialStatus = urlSub && (urlFilter === 'assigned-me' || urlFilter === 'pending') ? urlSub : URL_STATUS[urlFilter] ?? (param('equipment') || param('unit') ? 'todos' : OPEN);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState('todos');
  const [unit, setUnit] = useState(() => (urlUnit && unitIds.includes(urlUnit) ? urlUnit : 'todos'));
  const [equipment, setEquipment] = useState(() => (urlEquipment && db.equipments.some((e) => e.id === urlEquipment && unitIds.includes(e.unitId)) ? urlEquipment : 'todos'));
  const [requester, setRequester] = useState('todos');
  const [assign, setAssign] = useState(urlFilter === 'assigned-me' ? 'me' : 'todos');
  const [period, setPeriod] = useState('todos');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [concluding, setConcluding] = useState<Request | null>(null);

  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), [query, status, priority, unit, equipment, requester, assign, period, from, to]);

  const views: View[] = useMemo(() => requestsVisible(db, unitIds).map((r) => ({ r, unitId: unitIdOfEquipment(db, r.equipmentId), base: refs.base(r.statusId) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, unitIds, refs.admin]);

  useEffect(() => {
    if (mode === 'noresults') setQuery('zzzz');
    if (mode === 'conclude') {
      setPeriod('todos'); setStatus(OPEN);
      const first = views.find((v) => canConclude(v.r, v.base));
      if (first) setConcluding(first.r);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // KPIs: situação atual das solicitações visíveis ao perfil (RGN004)
  const kpis = useMemo(() => {
    const count = (id: string) => views.filter((v) => v.r.statusId === id).length;
    // 💡 Tempo médio de triagem: da abertura até a primeira ação da equipe (2º registro do histórico)
    const spans = views.map((v) => { const first = [...v.r.log].sort((a, b) => a.at.localeCompare(b.at))[1]; return first ? (new Date(first.at).getTime() - new Date(v.r.openedAt).getTime()) / 3_600_000 : null; })
      .filter((h): h is number => h !== null && h >= 0);
    const avg = spans.length ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length) : null;
    return { fresh: count(STS.NEW), triage: count(STS.TRIAGE), converted: count(STS.CONVERTED), avg };
  }, [views]);

  const equipmentOf = (id: string) => db.equipments.find((e) => e.id === id)!;
  const probName = (r: Request) => refs.requestType(r.problemId)?.name ?? '-';

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return views.filter(({ r, unitId, base }) => {
      const e = equipmentOf(r.equipmentId);
      if (term && !(r.id.toLowerCase().includes(term) || e.name.toLowerCase().includes(term) || e.code.toLowerCase().includes(term)
        || unitName(db, unitId).toLowerCase().includes(term) || r.requesterName.toLowerCase().includes(term))) return false;
      if (status === OPEN ? !isOpenBase(base) : status === 'pending' ? ![STS.APPROVED, STS.WAITING].includes(r.statusId as never) : status !== 'todos' && r.statusId !== status) return false;
      if (priority !== 'todos' && (priority === 'none' ? !!r.priorityId : r.priorityId !== priority)) return false;
      if (unit !== 'todos' && unitId !== unit) return false;
      if (equipment !== 'todos' && r.equipmentId !== equipment) return false;
      if (requester !== 'todos' && r.requesterName !== requester) return false;
      if (assign === 'me' && r.responsibleId !== user.id) return false;
      if (period === 'custom') {
        const day = r.openedAt.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
      }
      return true;
    }).sort((a, b) => b.r.openedAt.localeCompare(a.r.openedAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views, query, status, priority, unit, equipment, requester, assign, period, from, to, user.id]);

  const pageViews = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rows: Row[] = pageViews.map((v) => ({ id: v.r.id, v }));
  const filtersActive = status !== OPEN || priority !== 'todos' || unit !== 'todos' || equipment !== 'todos' || requester !== 'todos' || assign !== 'todos' || period !== 'todos' || !!query;
  const clearFilters = () => { setQuery(''); setStatus(OPEN); setPriority('todos'); setUnit('todos'); setEquipment('todos'); setRequester('todos'); setAssign('todos'); setPeriod('todos'); setFrom(''); setTo(''); };

  const waiting = (v: View) => (isOpenBase(v.base) ? openedAgo(hoursSince(v.r.statusChangedAt)) : '-');
  const link = (id: string) => <a className="text-link" href={`solicitacao.html?id=${id}`}>{noBreak(id)}</a>;
  const osLink = (id?: string) => (id ? <a className="text-link" href={`os.html?id=${id}`}>{noBreak(id)}</a> : '-');

  const actions = (v: View) => (
    <RowActions>
      <RowAction icon={<IconEye size={16} />} label="Abrir solicitação" target={v.r.id} onClick={() => goTo(`solicitacao.html?id=${v.r.id}`)} />
      {can('solicitacoes', 'editar') && (canConclude(v.r, v.base)
        ? <RowAction icon={<IconCircleCheck size={16} />} label="Concluir sem OS" target={v.r.id} onClick={() => setConcluding(v.r)} />
        : v.r.osId && <RowAction icon={<IconCircleCheck size={16} />} label="Indisponível, a solicitação segue o status da OS" target={v.r.id} onClick={() => undefined} disabled />)}
    </RowActions>
  );

  const columns: TableColumn<Row>[] = [
    { key: 'v', label: 'Protocolo', render: (_, row) => link(row.v.r.id) },
    { key: 'subject', label: 'Assunto / Tipo de problema', render: (_, row) => <CellPair primary={probName(row.v.r)} secondary={row.v.r.description.length > 48 ? `${row.v.r.description.slice(0, 48)}…` : row.v.r.description} /> },
    { key: 'id', label: 'Status', render: (_, row) => refs.statusBadge(row.v.r.statusId) },
    { key: 'waiting', label: 'Aguardando há', render: (_, row) => waiting(row.v) },
    { key: 'unit', label: 'Unidade', render: (_, row) => unitName(db, row.v.unitId) },
    { key: 'equipment', label: 'Equipamento', render: (_, row) => { const e = equipmentOf(row.v.r.equipmentId); return <CellPair primary={e.name} secondary={e.code} />; } },
    { key: 'eqStatus', label: 'Situação do equipamento', render: (_, row) => refs.statusBadge(equipmentOf(row.v.r.equipmentId).statusId) },
    { key: 'assignee', label: 'Atribuído para', render: (_, row) => userName(db, row.v.r.responsibleId) },
    { key: 'osId', label: 'OS vinculada', render: (_, row) => osLink(row.v.r.osId) },
    { key: 'openedAt', label: 'Solicitado em', render: (_, row) => noBreak(formatDateTime(row.v.r.openedAt)) },
    { key: 'actions', label: 'Ações', sticky: 'right', render: (_, row) => actions(row.v) },
  ];

  const statuses = refs.activeStatuses('solicitacao');
  const unitsInScope = db.units.filter((u) => unitIds.includes(u.id));
  const equipmentsWithRequests = [...new Set(views.map((v) => v.r.equipmentId))].map(equipmentOf).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const requesters = [...new Set(views.map((v) => v.r.requesterName))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const { columns: shownColumns, control, fieldsFor } = useColumnPrefs('sub-solicitacoes', columns, { locked: ['v'], mobileFixed: ['id', 'v', 'subject'] });
  const toolbar = (
    <Stack gap="md" className="toolbar-fill">
      <TableToolbar
        search={(
          <Input type="search" aria-label="Buscar por protocolo, equipamento, unidade ou solicitante" placeholder="Buscar por protocolo, equipamento, unidade ou solicitante" iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)} />
        )}
        filters={(
          <FilterControl
            note="RF401-RGN001/RGN002 e CTA001: filtros cumulativos por status, prioridade, unidade, equipamento, solicitante e período/histórico, agrupados no botão “Filtros” (a busca também é cumulativa). Aceita ?filter=assigned-me|new|pending|triage|converted, ?equipment= e ?unit= (links do Início e do Equipamento): o filtro aplicado aparece no controle e conta no botão. 💡 “Status”: Em aberto é o padrão (não conta como filtro ativo); as encerradas (convertidas, recusadas, concluídas) aparecem em “Todos os status” ou no status específico (CTA002). “Período de abertura”: Todo o período (padrão) ou Período personalizado, com De e Até pela data de abertura (inclui as encerradas se o Status permitir). Ambiente (FLU003) não é filtro previsto no contrato (RGN001) e não foi incluído."
            filters={[
              { id: 'status', label: 'Status', value: status, onChange: setStatus, defaultValue: OPEN, options: [{ value: OPEN, label: 'Em aberto' }, { value: 'todos', label: 'Todos os status' }, ...statuses.map((s) => ({ value: s.id, label: s.name })), { value: 'pending', label: 'Pendentes (aprovadas e aguardando informação)' }] },
              { id: 'priority', label: 'Prioridade', value: priority, onChange: setPriority, options: [{ value: 'todos', label: 'Todas as prioridades' }, ...refs.admin.priorities.map((p) => ({ value: p.id, label: p.name })), { value: 'none', label: 'Sem prioridade' }] },
              { id: 'unit', label: 'Unidade', value: unit, onChange: setUnit, options: [{ value: 'todos', label: 'Todas as unidades' }, ...unitsInScope.map((u) => ({ value: u.id, label: u.name }))] },
              { id: 'equipment', label: 'Equipamento', value: equipment, onChange: setEquipment, options: [{ value: 'todos', label: 'Todos os equipamentos' }, ...equipmentsWithRequests.map((e) => ({ value: e.id, label: `${e.name} · ${e.code}` }))] },
              { id: 'requester', label: 'Solicitante', value: requester, onChange: setRequester, options: [{ value: 'todos', label: 'Todos os solicitantes' }, ...requesters.map((n) => ({ value: n, label: n }))] },
              { id: 'period', label: 'Período de abertura', value: period, onChange: setPeriod, options: PERIOD_OPTIONS, range: { when: 'custom', from, to, onChange: (f, t) => { setFrom(f); setTo(t); } } },
            ]}
          />
        )}
        columns={control}
      />
      {assign === 'me' && (
        <Feedback type="info" title="Atribuídas a mim" message="Mostrando só as solicitações sob sua responsabilidade (vindo do Início). Remova o filtro para ver todas." dismissible dismissLabel="Remover filtro Atribuídas a mim" onDismiss={() => setAssign('todos')} />
      )}
      {filtersActive && (
        <Stack direction="horizontal" justify="start"><Button variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button></Stack>
      )}
    </Stack>
  );
  const empty = { title: 'Nenhuma solicitação encontrada', description: 'Revise a busca e os filtros, ou escolha Todo o histórico no período' };

  return (
    <AppLayout active="solicitacoes" screen="solicitacoes">
      <Stack gap="xl">
        <PageHeader
          title="Solicitações"
          subtitle="Acompanhe e trate as solicitações de manutenção das suas unidades"
          actions={can('solicitacoes', 'cadastrar') && (
            <DevNote note="RF401-FLU005: abre RF404 (Nova solicitação). Visível só para perfis com permissão “Cadastrar” em Solicitações. O botão não deve ser exibido para usuários sem a permissão “Cadastrar” em Solicitações.">
              <Button iconLeft={<IconPlus size={20} />} onClick={() => goTo('solicitacao-form.html')}>Nova solicitação</Button>
            </DevNote>
          )}
        />

        <Grid>
          <Col span={3} fill><KpiCard label="Novas" value={formatNumber(kpis.fresh)} icon={<IconInbox size={20} />} description="Aguardando triagem" /></Col>
          <Col span={3} fill><KpiCard label="Em triagem" value={formatNumber(kpis.triage)} icon={<IconListCheck size={20} />} description="Em análise pela equipe" /></Col>
          <Col span={3} mobileFull fill><KpiCard label="Convertidas em OS" value={formatNumber(kpis.converted)} icon={<IconClipboardList size={20} />} description="Seguem o status da OS" /></Col>
          <Col span={3} mobileFull fill>
            <DevNote note="💡 Tempo médio de triagem (RF401): aqui, média entre a abertura e a primeira ação da equipe registrada no histórico. Definição a confirmar com o cliente. Os cards mostram a situação atual das solicitações visíveis ao perfil (RGN004), sem comparativo de período.">
              <KpiCard label="Tempo médio de triagem" value={kpis.avg === null ? '-' : openedAgo(kpis.avg)} icon={<IconClockHour4 size={20} />} description="Da abertura à primeira ação" />
            </DevNote>
          </Col>
        </Grid>

        <DevNote note="RF401: tabela paginada (10). “Aguardando há” = tempo desde a última mudança de status, só para solicitações não encerradas (RGN003). Perfil Solicitante/Gestor da unidade vê apenas as solicitações das suas unidades (RGN004). Concluir sem OS (FLU006): só para quem ainda não virou OS; convertida segue o status da OS (RGN007). SLA/prazos fora do escopo (FE001). No mobile vira lista de cards.">
          {isMobile ? (
            <MobileCardList
              headingId="requests-title" title="Lista de solicitações" titleHidden toolbar={toolbar} emptyTitle={empty.title}
              page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage}
              items={pageViews.map((v) => {
                const e = equipmentOf(v.r.equipmentId);
                return {
                  id: v.r.id, title: link(v.r.id), subtitle: probName(v.r), badge: refs.statusBadge(v.r.statusId),
                  fields: fieldsFor([
                    { label: 'Unidade', value: unitName(db, v.unitId) },
                    { label: 'Equipamento', value: e.name },
                    { label: 'Situação do equipamento', value: refs.statusBadge(e.statusId) },
                    { label: 'Atribuído para', value: userName(db, v.r.responsibleId) },
                    { label: 'OS vinculada', value: osLink(v.r.osId) },
                    { label: 'Solicitado em', value: formatDateTime(v.r.openedAt) },
                    { label: 'Aguardando há', value: waiting(v) },
                  ]),
                  actions: actions(v),
                };
              })}
            />
          ) : (
            <Table<Row>
              caption="Lista de solicitações" toolbar={toolbar} columns={shownColumns} rows={rows} empty={empty}
              pagination={{ page, pageSize: PAGE_SIZE, total: filtered.length, onPageChange: setPage }}
            />
          )}
        </DevNote>
      </Stack>
      {concluding && <ConcludeDialog request={concluding} onClose={() => setConcluding(null)} />}
    </AppLayout>
  );
}

mountApp(<SolicitacoesScreen />);
