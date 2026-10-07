import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  IconAdjustmentsHorizontal, IconAlertTriangle, IconCircleCheck, IconCircleX, IconClipboardList, IconEye, IconFileInvoice,
  IconHourglass, IconPackage, IconSearch, IconThumbUp, IconTool, IconTruck, IconChecklist, IconUserEdit,
} from '@tabler/icons-react';
import { Badge, Button, Card, EmptyState, Feedback, Input, KpiCard, Stack, Table, TableColumn, useToast } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { MobileCardList } from '../../admin/shared/MobileCardList';
import { useHashState } from '../../admin/shared/useHashState';
import { FilterControl } from '../../admin/shared/FilterControl';
import { useColumnPrefs } from '../../admin/shared/ColumnsControl';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { formatDate, formatNumber, normalize } from '../../admin/shared/format';
import { daysAgo, dayOnly } from './data';
import { ordersVisible, unitName, equipmentOf, userName } from './store';
import { useSubSession } from './store';
import { CellPair, Col, Grid, RowAction, RowActions, TableToolbar, goTo, param, takeFlash, useRefs } from './ui';
import { ReassignDialog, STO, executorInfo, isEditable, overdueDays } from './os-common';
import type { WorkOrder } from './data';

/** Estados: idle · empty (sem nenhuma OS) · noresults (busca sem resultado) · reassign (diálogo de reatribuição aberto) */
const STATES = ['idle', 'empty', 'noresults', 'reassign'] as const;
type Mode = (typeof STATES)[number];

const PAGE_SIZE = 10;
type Quick = 'todos' | 'assigned-me' | 'active' | 'action' | 'awaiting-validation' | 'overdue' | 'awaiting-technician';
const QUICK_OPTIONS: Array<{ value: Quick; label: string }> = [
  { value: 'todos', label: 'Todas as OS' },
  { value: 'assigned-me', label: 'Atribuídas a mim' },
  { value: 'active', label: 'Ativas' },
  { value: 'action', label: 'Ação necessária' },
  { value: 'awaiting-validation', label: 'Aguardando validação' },
  { value: 'overdue', label: 'Prazo vencido' },
  { value: 'awaiting-technician', label: 'Aguardando prestador/técnico' },
];
const PERIOD_OPTIONS = [
  { value: 'todos', label: 'Todo o período' },
  { value: 'custom', label: 'Período personalizado' },
];
const STATUS_ICON: Record<string, ReactNode> = {
  [STO.ABERTA]: <IconClipboardList size={20} />, [STO.ANDAMENTO]: <IconTool size={20} />, [STO.ORCAMENTO]: <IconFileInvoice size={20} />,
  [STO.APROVACAO]: <IconThumbUp size={20} />, [STO.PECA]: <IconPackage size={20} />, [STO.PRESTADOR]: <IconTruck size={20} />,
  [STO.VALIDACAO]: <IconChecklist size={20} />, [STO.CONCLUIDA]: <IconCircleCheck size={20} />, [STO.CANCELADA]: <IconCircleX size={20} />,
};

type Row = Record<string, unknown> & {
  id: string; statusId: string; subject: string; maintTypeId: string; priorityId: string; unit: string; equipment: string;
  createdAt: string; dueAt: string; late: number; executorName: string; executorKind: string; responsible: string; actions: string; order: WorkOrder;
};

function OrdensScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const refs = useRefs();
  const { db, user, can, unitIds } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const isExecutor = user.profile === 'executor';
  const canPlan = can('os', 'editar') && !isExecutor;

  const quickParam = param('filter') as Quick | null;
  const [quick, setQuick] = useState<Quick>(() => (QUICK_OPTIONS.some((o) => o.value === quickParam) ? (quickParam as Quick) : 'todos'));
  const SUBS = { new: 'Novas (abertas)', approval: 'Necessitam de aprovação', overdue: 'Em atraso' } as const;
  type Sub = keyof typeof SUBS;
  const subParam = param('sub') as Sub | null;
  const [sub, setSub] = useState<Sub | null>(() => (quickParam === 'assigned-me' && subParam && subParam in SUBS ? subParam : null));
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(() => param('status') ?? 'todos');
  const [type, setType] = useState('todos');
  const [priority, setPriority] = useState('todos');
  const [unit, setUnit] = useState(() => param('unit') ?? 'todos');
  const [executor, setExecutor] = useState('todos');
  const [period, setPeriod] = useState('todos');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [equipment, setEquipment] = useState<string | null>(() => param('equipment'));
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [reassigning, setReassigning] = useState<WorkOrder | null>(null);

  const visible = useMemo(() => (mode === 'empty' ? [] : ordersVisible(db, unitIds, user.id, isExecutor)), [db, unitIds, user.id, isExecutor, mode]);

  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode === 'noresults') setQuery('triturador de resíduos');
    if (mode === 'reassign') setReassigning(visible.find((o) => isEditable(refs.base(o.statusId)) && o.executor.kind === 'prestador') ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  useEffect(() => setPage(1), [quick, sub, query, status, type, priority, unit, executor, period, from, to, equipment, sort]);

  const eqName = (o: WorkOrder) => equipmentOf(db, o.equipmentId)?.name ?? '-';
  const unitOf = (o: WorkOrder) => equipmentOf(db, o.equipmentId)?.unitId ?? '';

  /** Resumo por status: últimos 30 dias (RF501). Clicar filtra a tabela (CTA001: resumo = listagem filtrada). */
  const last30 = dayOnly(30);
  const summary = useMemo(() => {
    const recent = visible.filter((o) => o.createdAt.slice(0, 10) >= last30);
    return refs.activeStatuses('os').map((s) => ({ id: s.id, name: s.name, count: recent.filter((o) => o.statusId === s.id).length }));
  }, [visible, refs, last30]);

  const quickMatch = (o: WorkOrder) => {
    const base = refs.base(o.statusId);
    if (quick === 'assigned-me' && sub) {
      const mine = o.responsibleId === user.id || (o.executor.kind === 'interno' && o.executor.userId === user.id);
      if (!mine) return false;
      return sub === 'new' ? o.statusId === STO.ABERTA : sub === 'approval' ? o.statusId === STO.APROVACAO : overdueDays(o, base) > 0;
    }
    switch (quick) {
      case 'assigned-me': return o.responsibleId === user.id || (o.executor.kind === 'interno' && o.executor.userId === user.id);
      case 'active': return base === 'aberto' || base === 'andamento' || base === 'aguardando';
      case 'action': return [STO.APROVACAO, STO.PECA, STO.VALIDACAO].includes(o.statusId as never);
      case 'awaiting-validation': return o.statusId === STO.VALIDACAO;
      case 'overdue': return overdueDays(o, base) > 0;
      case 'awaiting-technician': return o.statusId === STO.PRESTADOR;
      default: return true;
    }
  };
  const executorKey = (o: WorkOrder) => (o.executor.kind === 'interno' ? `u:${o.executor.userId}` : `p:${o.executor.providerId}`);

  const filtered = useMemo(() => {
    const term = normalize(query);
    const rows = visible.filter((o) => quickMatch(o)
      && (status === 'todos' || o.statusId === status)
      && (type === 'todos' || o.maintTypeId === type)
      && (priority === 'todos' || o.priorityId === priority)
      && (unit === 'todos' || unitOf(o) === unit)
      && (!equipment || o.equipmentId === equipment)
      && (executor === 'todos' || executorKey(o) === executor)
      && (period !== 'custom' || ((!from || o.createdAt.slice(0, 10) >= from) && (!to || o.createdAt.slice(0, 10) <= to)))
      && (!term || normalize(`${o.id} ${o.subject} ${eqName(o)} ${unitName(db, unitOf(o))}`).includes(term)));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const va = sort.key === 'dueAt' ? a.dueAt : sort.key === 'id' ? a.id : a.createdAt;
      const vb = sort.key === 'dueAt' ? b.dueAt : sort.key === 'id' ? b.id : b.createdAt;
      return va.localeCompare(vb) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, quick, sub, query, status, type, priority, unit, executor, period, from, to, equipment, sort, db]);

  const pageRows: Row[] = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((o) => {
    const ex = executorInfo(db, o.executor);
    return {
      id: o.id, statusId: o.statusId, subject: o.subject, maintTypeId: o.maintTypeId, priorityId: o.priorityId,
      unit: unitName(db, unitOf(o)), equipment: eqName(o), createdAt: o.createdAt, dueAt: o.dueAt, late: overdueDays(o, refs.base(o.statusId)),
      executorName: ex.name, executorKind: ex.technician ? `Prestador · ${ex.technician}` : ex.kind, responsible: userName(db, o.responsibleId), actions: o.id, order: o,
    };
  });

  const applySummary = (statusId: string | null) => {
    setQuick('todos'); setSub(null); setQuery(''); setType('todos'); setPriority('todos'); setUnit('todos'); setExecutor('todos'); setEquipment(null);
    setStatus(statusId ?? 'todos'); setPeriod(statusId ? '30' : 'todos');
  };
  const clearAll = () => { applySummary(null); };

  const dueNode = (r: Row) => (r.late > 0
    ? <CellPair primary={<Badge status="error" icon={<IconAlertTriangle size={14} />}>{formatDate(r.dueAt)}</Badge>} secondary={`Vencida há ${r.late} ${r.late === 1 ? 'dia' : 'dias'}`} />
    : formatDate(r.dueAt));

  const actions = (r: Row) => {
    const closed = !isEditable(refs.base(r.statusId));
    return (
      <RowActions>
        <RowAction icon={<IconEye size={16} />} label="Ver OS" target={r.id} onClick={() => goTo(`os.html?id=${r.id}`)} />
        {canPlan && !closed && <RowAction icon={<IconAdjustmentsHorizontal size={16} />} label="Classificar OS" target={r.id} onClick={() => goTo(`os-form.html?id=${r.id}`)} />}
        {canPlan && !closed && <RowAction icon={<IconUserEdit size={16} />} label="Reatribuir OS" target={r.id} onClick={() => setReassigning(r.order)} />}
      </RowActions>
    );
  };

  const columns: TableColumn<Row>[] = [
    { key: 'statusId', label: 'Status', render: (v) => refs.statusBadge(String(v)) },
    { key: 'id', label: 'Nº da OS', sortable: true, render: (v) => <a className="text-link" href={`os.html?id=${v}`}>{String(v)}</a> },
    { key: 'subject', label: 'Assunto' },
    { key: 'maintTypeId', label: 'Tipo de manutenção', render: (v) => refs.maintType(String(v))?.name ?? '-' },
    { key: 'priorityId', label: 'Prioridade', render: (v) => refs.priorityBadge(String(v)) },
    { key: 'unit', label: 'Unidade' },
    { key: 'equipment', label: 'Equipamento' },
    { key: 'createdAt', label: 'Criada em', sortable: true, render: (v) => formatDate(String(v)) },
    { key: 'dueAt', label: 'Prazo', sortable: true, render: (_, r) => dueNode(r) },
    { key: 'executorName', label: 'Executor / Prestador', render: (_, r) => <CellPair primary={r.executorName} secondary={r.executorKind} /> },
    { key: 'responsible', label: 'Responsável' },
    { key: 'actions', label: 'Ações', sticky: 'right', render: (_, r) => actions(r) },
  ];

  const typeOptions = [{ value: 'todos', label: 'Todos os tipos' }, ...refs.admin.maintenanceTypes.filter((t) => t.status === 'ativo').map((t) => ({ value: t.id, label: t.name }))];
  const priorityOptions = [{ value: 'todos', label: 'Todas as prioridades' }, ...refs.admin.priorities.map((p) => ({ value: p.id, label: p.name }))];
  const unitOptions = [{ value: 'todos', label: 'Todas as unidades' }, ...db.units.filter((u) => unitIds.includes(u.id)).map((u) => ({ value: u.id, label: u.name }))];
  const statusOptions = [{ value: 'todos', label: 'Todos os status' }, ...refs.activeStatuses('os').map((s) => ({ value: s.id, label: s.name }))];
  const executorOptions = [
    { value: 'todos', label: 'Todos os executores' },
    ...db.users.filter((u) => u.profile === 'executor' && u.status === 'ativo').map((u) => ({ value: `u:${u.id}`, label: `${u.name} (interno)` })),
    ...db.providers.map((p) => ({ value: `p:${p.id}`, label: `${p.tradeName ?? p.name} (prestador)` })),
  ];

  const { columns: shownColumns, control, fieldsFor } = useColumnPrefs('sub-ordens-servico', columns, { locked: ['id'], mobileFixed: ['statusId', 'id', 'subject', 'equipment'] });
  const toolbar = (
    <Stack gap="md">
      <TableToolbar
        search={(
          <Input type="search" aria-label="Buscar por número da OS, assunto, equipamento ou unidade" placeholder="Buscar por nº, assunto, equipamento ou unidade" iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)} />
        )}
        filters={(
          <FilterControl
            note="RF501: filtros cumulativos agrupados - Visão rápida, Status, Tipo de manutenção, Prioridade, Unidade, Executor/Prestador e Período (data de criação; não filtra pelo prazo). A Visão rápida também vem por ?filter= nos cards do Início: Atribuídas a mim · Ativas · Ação necessária (aguardando aprovação, peça ou validação) · Aguardando validação · Prazo vencido · Aguardando prestador/técnico. ?status= e ?unit= também chegam já aplicados."
            filters={[
              { id: 'quick', label: 'Visão rápida', options: QUICK_OPTIONS, value: quick, onChange: (v) => { setQuick(v as Quick); setSub(null); } },
              { id: 'status', label: 'Status', options: statusOptions, value: status, onChange: setStatus },
              { id: 'type', label: 'Tipo de manutenção', options: typeOptions, value: type, onChange: setType },
              { id: 'priority', label: 'Prioridade', options: priorityOptions, value: priority, onChange: setPriority },
              { id: 'unit', label: 'Unidade', options: unitOptions, value: unit, onChange: setUnit },
              { id: 'executor', label: 'Executor / Prestador', options: executorOptions, value: executor, onChange: setExecutor },
              { id: 'period', label: 'Período de criação', options: PERIOD_OPTIONS, value: period, onChange: setPeriod, range: { when: 'custom', from, to, onChange: (f, t) => { setFrom(f); setTo(t); } } },
            ]}
          />
        )}
        columns={control}
      />
      {quick === 'assigned-me' && sub && (
        <Feedback type="info" title="Atribuídas a mim" message={`Refinado por: ${SUBS[sub]}. Remova o refinamento para ver todas as suas OS.`} dismissible dismissLabel="Remover refinamento" onDismiss={() => setSub(null)} />
      )}
      {equipment && (
        <Feedback type="info" title="Filtrando por equipamento" message={`Mostrando só as OS de ${equipmentOf(db, equipment)?.name ?? equipment}. Remova o filtro para ver todas.`} dismissible dismissLabel="Remover filtro de equipamento" onDismiss={() => setEquipment(null)} />
      )}
    </Stack>
  );

  const empty = visible.length === 0
    ? { title: 'Nenhuma ordem de serviço por aqui', description: 'As OS nascem de solicitações aprovadas na triagem ou dos planos de preventiva.' }
    : { title: 'Nenhuma OS encontrada', description: 'Revise a busca ou os filtros aplicados.' };

  const subtitle = isExecutor ? 'Você vê apenas as OS atribuídas a você' : user.profile === 'solicitante' ? 'Acompanhe as OS das suas unidades' : 'Acompanhe e gerencie as ordens de serviço de manutenção';

  return (
    <AppLayout active="os" screen="os">
      <Stack gap="xl">
        <DevNote note="RF501-FLU005 / RGN004 / CTA003: NÃO existe botão “Adicionar OS” nesta tela. Toda OS corretiva nasce de uma solicitação aprovada na triagem (“Criar OS” no RF402) e toda preventiva, de um plano (RF601) - não há OS avulsa (decisão 29/09). Indicadores “Concluídas no prazo” e “Teto de gastos” são FE001/FD002 (fora do escopo).">
          <PageHeader title="Ordens de serviço" subtitle={subtitle} />
        </DevNote>

        {isExecutor && (
          <DevNote note="RGN002 / CTA002: o perfil Executor vê apenas as OS atribuídas a ele; nunca as de outros executores. O resumo e a tabela já respeitam isso.">
            <Feedback type="info" message="Seu perfil de Executor mostra somente as OS atribuídas a você" />
          </DevNote>
        )}

        {visible.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconClipboardList size={32} />} title={empty.title} description={empty.description} headingLevel={2}
              action={can('solicitacoes') ? <Button variant="secondary" onClick={() => goTo('solicitacoes.html')}>Ir para Solicitações</Button> : undefined}
            />
          </Card>
        ) : (
          <>
            <DevNote note="RF501: quantidade de OS por status nos últimos 30 dias + total de OS. Clicar num card filtra a tabela pelo status e pelo período de 30 dias, então o número do card é o total da listagem (CTA001). O card Total mostra todas as OS, sem filtro.">
              {/* intercepta o clique nos cards (links) para filtrar na própria tela */}
              <div onClickCapture={(e) => {
                const a = (e.target as HTMLElement).closest('a[data-os-status]');
                if (!a) return;
                e.preventDefault();
                const s = a.getAttribute('data-os-status');
                applySummary(s === 'total' ? null : s);
              }}
              >
                <Grid>
                  <Col span={3} fill><KpiCard label="Total de OS" value={formatNumber(visible.length)} icon={<IconClipboardList size={20} />} description="Todas as OS · sem filtro" href="#total" /></Col>
                  {summary.map((s) => (
                    <Col key={s.id} span={3} fill><KpiCard label={s.name} value={formatNumber(s.count)} icon={STATUS_ICON[s.id] ?? <IconHourglass size={20} />} description="Últimos 30 dias" href={`#${s.id}`} /></Col>
                  ))}
                </Grid>
              </div>
            </DevNote>

            <DevNote note="RF501: Executor/Prestador e Responsável são colunas separadas. Prazo vencido e não concluído é destacado em vermelho com o atraso (RGN003) - SLA configurável é FE001, fora do escopo. Ações por linha: ver/editar (RF503), classificar (RF502 - edição) e reatribuir (diálogo rápido). Ver é sempre permitido; classificar e reatribuir só para quem pode editar e enquanto a OS não estiver concluída/cancelada. Colunas personalizáveis (botão “Exibição”) entram a pedido, para avaliação.">
              {isMobile ? (
                <MobileCardList
                  headingId="os-title" title="Lista de ordens de serviço" titleHidden toolbar={toolbar} emptyTitle={empty.title}
                  page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage}
                  items={pageRows.map((r) => ({
                    id: r.id, title: r.subject, subtitle: `${r.id} · ${r.equipment}`, badge: refs.statusBadge(r.statusId),
                    fields: fieldsFor([
                      { label: 'Prioridade', value: refs.priorityBadge(r.priorityId) },
                      { label: 'Prazo', value: dueNode(r) },
                      { label: 'Tipo de manutenção', value: refs.maintType(r.maintTypeId)?.name ?? '-' },
                      { label: 'Unidade', value: r.unit },
                      { label: 'Criada em', value: formatDate(r.createdAt) },
                      { label: 'Executor / Prestador', value: `${r.executorName} · ${r.executorKind}` },
                      { label: 'Responsável', value: r.responsible },
                    ]),
                    actions: actions(r),
                  }))}
                />
              ) : (
                <Table<Row>
                  caption="Lista de ordens de serviço" toolbar={toolbar} columns={shownColumns} rows={pageRows}
                  sortKey={sort.key as keyof Row} sortDir={sort.dir}
                  onSort={(k) => setSort((s) => (s.key === k ? { key: s.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: String(k), dir: 'desc' }))}
                  empty={{ ...empty, action: filtered.length === 0 && visible.length > 0 ? <Button variant="secondary" size="sm" onClick={clearAll}>Limpar filtros</Button> : undefined }}
                  pagination={{ page, pageSize: PAGE_SIZE, total: filtered.length, onPageChange: setPage }}
                />
              )}
            </DevNote>
          </>
        )}
      </Stack>
      <ReassignDialog order={reassigning} onClose={() => setReassigning(null)} />
    </AppLayout>
  );
}

mountApp(<OrdensScreen />);
