import { ReactNode, useEffect, useMemo, useState, ReactElement } from 'react';
import {
  IconAdjustmentsHorizontal, IconAlertTriangle, IconCircleCheck, IconCircleX, IconClipboardList, IconEye, IconFileInvoice,
  IconHourglass, IconPencil, IconPackage, IconSearch, IconThumbUp, IconTool, IconTruck, IconChecklist, IconUserEdit,
} from '@tabler/icons-react';
import { Badge, Button, Card, EmptyState, Feedback, Input, Stack, Table, TableColumn, Tooltip, useToast } from '@maglev/ds';
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
import { RowMenu, RowMenuItem } from './RowMenu';
import { CellPair, Col, Grid, RowAction, RowActions, TableToolbar, goTo, param, takeFlash, useRefs } from './ui';
import { ClassifyDialog, ReassignDialog, STO, executorInfo, isEditable, overdueDays } from './os-common';
import type { WorkOrder } from './data';
import './os-summary.css';

/** Estados: idle · empty (sem nenhuma OS) · noresults (busca sem resultado) · reassign (diálogo de reatribuição aberto) */
const STATES = ['idle', 'empty', 'noresults', 'reassign'] as const;
type Mode = (typeof STATES)[number];

const PAGE_SIZE = 10;
type Quick = 'todos' | 'assigned-me' | 'active' | 'action' | 'awaiting-validation' | 'awaiting-technician';
const QUICK_OPTIONS: Array<{ value: Quick; label: string }> = [
  { value: 'todos', label: 'Todas as OS' },
  { value: 'assigned-me', label: 'Atribuídas a mim' },
  { value: 'active', label: 'Ativas' },
  { value: 'action', label: 'Ação necessária' },
  { value: 'awaiting-validation', label: 'Aguardando validação' },
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
  // Atalhos que têm filtro próprio na tela (Status) chegam com esse filtro já selecionado; os demais vêm como aviso removível
  const QUICK_TO_STATUS: Record<string, string> = { 'awaiting-validation': STO.VALIDACAO, 'awaiting-technician': STO.PRESTADOR };
  const [quick, setQuick] = useState<Quick>(() => (QUICK_OPTIONS.some((o) => o.value === quickParam) && !QUICK_TO_STATUS[quickParam as string] ? (quickParam as Quick) : 'todos'));
  const SUBS = { new: 'Novas (abertas)', approval: 'Necessitam de aprovação', overdue: 'Em atraso' } as const;
  type Sub = keyof typeof SUBS;
  const subParam = param('sub') as Sub | null;
  const [sub, setSub] = useState<Sub | null>(() => (quickParam === 'assigned-me' && subParam && subParam in SUBS ? subParam : null));
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(() => param('status') ?? QUICK_TO_STATUS[quickParam as string] ?? 'todos');
  const [type, setType] = useState('todos');
  const [priority, setPriority] = useState('todos');
  const [unit, setUnit] = useState(() => param('unit') ?? 'todos');
  const [executor, setExecutor] = useState('todos');
  const [period, setPeriod] = useState('todos');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [equipment, setEquipment] = useState<string | null>(() => param('equipment'));
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'attention', dir: 'asc' });   // 'attention' = padrão “Atenção necessária”
  const [page, setPage] = useState(1);
  const [reassigning, setReassigning] = useState<WorkOrder | null>(null);
  const [classifying, setClassifying] = useState<WorkOrder | null>(null);
  const [hot, setHot] = useState<string | null>(null);   // status destacado (hover/foco) na barra e na legenda

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
    return refs.activeStatuses('os').map((s) => ({ id: s.id, name: s.name, visual: s.visual, count: recent.filter((o) => o.statusId === s.id).length }));
  }, [visible, refs, last30]);
  const total30 = summary.reduce((n, s) => n + s.count, 0);
  const pct = (n: number) => (total30 ? ((n / total30) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '0');

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
      case 'awaiting-technician': return o.statusId === STO.PRESTADOR;
      default: return true;
    }
  };
  const executorKey = (o: WorkOrder) => (o.executor.kind === 'interno' ? `u:${o.executor.userId}` : `p:${o.executor.providerId}`);

  /** Ordenação padrão “Atenção necessária”: 1) vencidas (prazo mais antigo primeiro); 2) não vencidas por etapa do fluxo e, dentro dela, prazo mais próximo (sem prazo por último); 3) encerradas, atualização mais recente primeiro. */
  const FLOW = [STO.APROVACAO, STO.ABERTA, STO.VALIDACAO, STO.ANDAMENTO, STO.ORCAMENTO, STO.PECA, STO.PRESTADOR] as string[];
  const lastUpdate = (o: WorkOrder) => o.activities[o.activities.length - 1]?.at ?? o.createdAt;
  const attentionOrder = (a: WorkOrder, b: WorkOrder) => {
    const group = (o: WorkOrder) => { const base = refs.base(o.statusId); return !isEditable(base) ? 2 : overdueDays(o, base) > 0 ? 0 : 1; };
    const ga = group(a), gb = group(b);
    if (ga !== gb) return ga - gb;
    if (ga === 2) return lastUpdate(b).localeCompare(lastUpdate(a));
    if (ga === 1) {
      const fa = FLOW.indexOf(a.statusId), fb = FLOW.indexOf(b.statusId);
      if (fa !== fb) return (fa < 0 ? FLOW.length : fa) - (fb < 0 ? FLOW.length : fb);
      if (!a.dueAt !== !b.dueAt) return a.dueAt ? -1 : 1;
    }
    return (a.dueAt || '').localeCompare(b.dueAt || '');
  };

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
    if (sort.key === 'attention') return rows.sort(attentionOrder);
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
  /** Indicador clicado: lista só as OS criadas nos últimos 30 dias, do status escolhido (ou de todos), então o número é o total da listagem (CTA001). */
  const applyIndicator = (statusId: string | null) => {
    applySummary(statusId); setPeriod('custom'); setFrom(last30); setTo('');
  };

  const dueNode = (r: Row) => (r.late > 0
    ? <CellPair primary={<Badge status="error" solid icon={<IconAlertTriangle size={14} />}>{formatDate(r.dueAt)}</Badge>} secondary={`Vencida há ${r.late} ${r.late === 1 ? 'dia' : 'dias'}`} />
    : formatDate(r.dueAt));

  /** Desktop: olho + menu ⋮ (Editar, Classificar, Reatribuir). Cards no mobile: as quatro ações já abertas, como ícones. */
  const actions = (r: Row) => {
    const closed = !isEditable(refs.base(r.statusId));
    const manage: RowMenuItem[] = canPlan && !closed ? [
      { label: 'Editar', icon: <IconPencil size={16} />, onClick: () => goTo(`os-form.html?id=${r.id}`) },
      { label: 'Classificar', icon: <IconAdjustmentsHorizontal size={16} />, onClick: () => setClassifying(r.order) },
      { label: 'Reatribuir', icon: <IconUserEdit size={16} />, onClick: () => setReassigning(r.order) },
    ] : [];
    return (
      <RowActions>
        <RowAction icon={<IconEye size={16} />} label="Visualizar OS" target={r.id} onClick={() => goTo(`os.html?id=${r.id}`)} />
        {isMobile
          ? manage.map((it) => <RowAction key={it.label} icon={it.icon as ReactElement} label={`${it.label} OS`} target={r.id} onClick={it.onClick} />)
          : <RowMenu target={r.id} label={`Mais ações da ${r.id}`} items={manage} />}
      </RowActions>
    );
  };

  const columns: TableColumn<Row>[] = [
    { key: 'id', label: 'Nº da OS', sortable: true, render: (v) => <a className="text-link" href={`os.html?id=${v}`}>{String(v)}</a> },
    { key: 'subject', label: 'Assunto' },
    { key: 'statusId', label: 'Status', render: (v) => refs.statusBadge(String(v)) },
    { key: 'priorityId', label: 'Prioridade', render: (v) => refs.priorityBadge(String(v)) },
    { key: 'unit', label: 'Unidade' },
    { key: 'equipment', label: 'Equipamento' },
    { key: 'maintTypeId', label: 'Tipo de manutenção', render: (v) => refs.maintType(String(v))?.name ?? '-' },
    { key: 'dueAt', label: 'Prazo', sortable: true, render: (_, r) => dueNode(r) },
    { key: 'executorName', label: 'Executor / Prestador', render: (_, r) => <CellPair primary={r.executorName} secondary={r.executorKind} /> },
    { key: 'responsible', label: 'Responsável' },
    { key: 'createdAt', label: 'Criada em', sortable: true, render: (v) => formatDate(String(v)) },
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
    <Stack gap="md" className="toolbar-fill">
      <TableToolbar
        search={(
          <Input type="search" aria-label="Buscar por número da OS, assunto, equipamento ou unidade" placeholder="Buscar por nº, assunto, equipamento ou unidade" iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)} />
        )}
        filters={(
          <FilterControl
            note="RF501: filtros cumulativos agrupados - Status, Tipo de manutenção, Prioridade, Unidade, Executor/Prestador e Período (data de criação; não filtra pelo prazo). A “Visão rápida” não é mais um filtro do popover: ela só chega por ?filter= nos cards do Início e aparece como aviso removível acima da tabela: Atribuídas a mim · Ativas · Ação necessária (aguardando aprovação, peça ou validação) · Aguardando validação · Aguardando prestador/técnico. ?status= e ?unit= também chegam já aplicados."
            filters={[
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
      {quick !== 'todos' && (
        <Feedback
          type="info" title={`Filtrando por: ${QUICK_OPTIONS.find((o) => o.value === quick)?.label ?? ''}`}
          message={quick === 'assigned-me' && sub ? `Refinado por: ${SUBS[sub]}. Remova o filtro para ver todas as OS` : 'Remova o filtro para ver todas as OS'}
          dismissible dismissLabel="Remover filtro" onDismiss={() => { setQuick('todos'); setSub(null); }}
        />
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
            <DevNote note="RF501: total de OS e quantidade por status, todos nos últimos 30 dias (período identificado uma vez, no cabeçalho). Cada OS conta só no status atual, então a soma dos status é o total. Clicar no total ou num status lista as OS dos últimos 30 dias (e do status), então o número é o total da listagem (CTA001). Status sem OS continuam na relação, com zero.">
              <Card className="os-summary" title="Resumo das ordens de serviço" subtitle="Últimos 30 dias">
                <div className="os-summary-body">
                  <button type="button" className="os-total" onClick={() => applyIndicator(null)}>
                    <span className="os-total-label">Total de OS</span>
                    <span className="os-total-value">{formatNumber(total30)}</span>
                  </button>
                  <div className="os-dist">
                    <div
                      className={`os-bar${hot ? ' has-hot' : ''}`} role="group" aria-label="Distribuição das OS dos últimos 30 dias por status"
                      style={{ gridTemplateColumns: summary.filter((x) => x.count > 0).map((x) => `${x.count}fr`).join(' ') }}
                    >
                      {summary.filter((x) => x.count > 0).map((x) => (
                        <Tooltip key={x.id} content={`${x.name}: ${x.count} OS · ${pct(x.count)}% do total`}>
                          <button
                            type="button" className={`os-seg is-${x.visual}${hot === x.id ? ' is-hot' : ''}`}
                            aria-label={`${x.name}: ${x.count} OS, ${pct(x.count)}% do total. Listar`}
                            onMouseEnter={() => setHot(x.id)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(x.id)} onBlur={() => setHot(null)}
                            onClick={() => applyIndicator(x.id)}
                          />
                        </Tooltip>
                      ))}
                    </div>
                    {total30 === 0 && <p className="os-none">Nenhuma OS criada nos últimos 30 dias</p>}
                    <ul className="os-legend" aria-label="OS por status">
                      {summary.map((x) => (
                        <li key={x.id}>
                          <button
                            type="button" className={`os-legend-item${x.count === 0 ? ' is-zero' : ''}${hot === x.id ? ' is-hot' : ''}`} onClick={() => applyIndicator(x.id)}
                            onMouseEnter={() => x.count > 0 && setHot(x.id)} onMouseLeave={() => setHot(null)} onFocus={() => x.count > 0 && setHot(x.id)} onBlur={() => setHot(null)}
                          >
                            <span className={`os-dot is-${x.visual}`} aria-hidden="true" />
                            <span className="os-legend-name">{x.name}</span>
                            <span className="os-legend-count">{formatNumber(x.count)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            </DevNote>

            <DevNote note="RF501: Executor/Prestador e Responsável são colunas separadas. Prazo vencido e não concluído é destacado em vermelho com o atraso (RGN003) - SLA configurável é FE001, fora do escopo. Ações por linha: ícone de olho (Visualizar, RF503, somente leitura, sempre permitido) e menu ⋮ com Editar (abre o formulário de edição), Classificar (diálogo rápido só com tipo de manutenção e prioridade, RF502-FLU006) e Reatribuir (diálogo rápido). O menu só aparece para quem pode editar e enquanto a OS não estiver concluída/cancelada. Colunas personalizáveis (botão “Exibição”) entram a pedido, para avaliação.">
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
      <ClassifyDialog order={classifying} onClose={() => setClassifying(null)} />
    </AppLayout>
  );
}

mountApp(<OrdensScreen />);
