import { useEffect, useMemo, useState } from 'react';
import { IconAlertTriangle, IconCalendarEvent, IconCalendarRepeat, IconCircleCheck, IconCircleOff, IconEye, IconChecks, IconPencil, IconPlayerPause, IconPlus } from '@tabler/icons-react';
import { Badge, Button, Card, EmptyState, KpiCard, Stack, TableColumn, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { formatDate, formatNumber, normalize } from '../../admin/shared/format';
import { useHashState } from '../../admin/shared/useHashState';
import { FilterControl } from '../../admin/shared/FilterControl';
import { useColumnPrefs } from '../../admin/shared/ColumnsControl';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { Plan } from './data';
import { ListFilters, ResponsiveTable } from './ListKit';
import { PlanStatusDialog } from './PlanStatusDialog';
import {
  PlanStats, SITUATION, SITUATION_OPTIONS, TODAY, addDays, compliance, describeFrequency, executorOf, isLate, isSoon, planEquipmentNames, planUnitIds,
  planUnitNames, plansVisible, statsOf, withMore,
} from './preventivas';
import { useSubSession } from './store';
import { CellPair, Col, Grid, RowAction, RowActions, goTo, param, takeFlash } from './ui';

/** Estados: idle · noresults (busca sem resultados) · pause / activate (RF602 - confirmação) · empty (sem planos) */
const STATES = ['idle', 'noresults', 'pause', 'activate', 'empty'] as const;
type Mode = (typeof STATES)[number];

const STATUS_OPTIONS = [{ value: 'todos', label: 'Todos os status' }, { value: 'ativo', label: 'Ativo' }, { value: 'pausado', label: 'Pausado' }];
const SITUATION_FILTER_OPTIONS = SITUATION_OPTIONS.map((o) => (o.value === 'todas' ? { ...o, value: 'todos' } : o));
const FILTER_TO_SITUATION: Record<string, string> = { overdue: 'atrasado', upcoming: 'em-breve' };

type Row = Record<string, unknown> & { id: string; plan: Plan; stats: PlanStats; equipments: string[]; units: string[] };

function PlanosScreen() {
  const toast = useToast();
  const { db, user, can, unitIds } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('todos');
  const [situation, setSituation] = useState(() => FILTER_TO_SITUATION[param('filter') ?? ''] ?? 'todos');
  const [executor, setExecutor] = useState('todos');
  const [unit, setUnit] = useState('todos');
  const [toggling, setToggling] = useState<Plan | null>(null);

  const plans = useMemo(() => (mode === 'empty' ? [] : plansVisible(db, user, unitIds)), [db, user, unitIds, mode]);

  useEffect(() => {
    if (mode === 'noresults') setQuery('Preventiva trimestral das chapas');
    if (mode === 'pause') setToggling(plans.find((p) => p.status === 'ativo') ?? null);
    if (mode === 'activate') setToggling(plans.find((p) => p.status === 'pausado') ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows: Row[] = useMemo(() => plans.map((p) => ({ id: p.id, plan: p, stats: statsOf(db, p), equipments: planEquipmentNames(db, p), units: planUnitNames(db, p) })), [db, plans]);

  // Indicadores (CTA002: batem com a lista - mesmos planos visíveis)
  const kpis = useMemo(() => {
    const execs = rows.flatMap((r) => r.stats.executions);
    return {
      active: rows.filter((r) => r.plan.status === 'ativo').length,
      late: execs.filter(isLate).length,
      soon: execs.filter(isSoon).length,
      compliance: compliance(execs),
    };
  }, [rows]);

  const executorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    plans.forEach((p) => seen.set(p.executor.kind === 'interno' ? `u:${p.executor.userId}` : `p:${p.executor.providerId}`, executorOf(db, p.executor).primary));
    return [{ value: 'todos', label: 'Todos os executores' }, ...[...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))];
  }, [db, plans]);
  const unitOptions = [{ value: 'todos', label: 'Todas as unidades' }, ...db.units.filter((u) => unitIds.includes(u.id)).map((u) => ({ value: u.id, label: u.name }))];

  const filtered = rows.filter((r) => {
    const p = r.plan;
    const q = normalize(query);
    const exKey = p.executor.kind === 'interno' ? `u:${p.executor.userId}` : `p:${p.executor.providerId}`;
    return (status === 'todos' || p.status === status)
      && (situation === 'todos' || r.stats.situation === situation)
      && (executor === 'todos' || exKey === executor)
      && (unit === 'todos' ||planUnitIds(db, p).includes(unit))
      && (!q || normalize(`${p.name} ${r.equipments.join(' ')} ${r.units.join(' ')} ${executorOf(db, p.executor).primary}`).includes(q));
  });
  const resetKey = `${query}|${status}|${situation}|${executor}|${unit}`;

  const actions = (r: Row) => {
    const p = r.plan; const activate = p.status === 'pausado';
    return (
      <RowActions>
        <RowAction icon={<IconEye size={16} />} label="Abrir plano" target={p.name} onClick={() => goTo(`plano.html?id=${p.id}`)} />
        {can('planos', 'editar') && <RowAction icon={<IconPencil size={16} />} label="Editar plano" target={p.name} onClick={() => goTo(`plano-form.html?id=${p.id}`)} />}
        {can('planos', 'ativar') && (
          <RowAction icon={activate ? <IconCircleCheck size={16} /> : <IconPlayerPause size={16} />} label={activate ? 'Ativar plano' : 'Pausar plano'} target={p.name} onClick={() => setToggling(p)} />
        )}
      </RowActions>
    );
  };
  const statusBadge = (p: Plan) => <Badge status={p.status === 'ativo' ? 'success' : 'neutral'} dot>{p.status === 'ativo' ? 'Ativo' : 'Pausado'}</Badge>;
  const situationBadge = (s: PlanStats['situation']) => (s ? <Badge status={SITUATION[s].badge} dot>{SITUATION[s].label}</Badge> : '-');
  const dateOrDash = (s?: string) => (s ? formatDate(s) : '-');

  const columns: TableColumn<Row>[] = [
    { key: 'status', label: 'Status', render: (_, r) => statusBadge(r.plan) },
    { key: 'name', label: 'Plano', render: (_, r) => <a className="text-link" href={`plano.html?id=${r.plan.id}`}>{r.plan.name}</a> },
    { key: 'equipments', label: 'Equipamento(s)', render: (_, r) => withMore(r.equipments) },
    { key: 'units', label: 'Unidade(s)', render: (_, r) => withMore(r.units) },
    { key: 'frequency', label: 'Frequência', render: (_, r) => describeFrequency(r.plan) },
    { key: 'executorName', label: 'Executor', render: (_, r) => { const e = executorOf(db, r.plan.executor); return <CellPair primary={e.primary} secondary={e.secondary} />; } },
    { key: 'last', label: 'Última execução', render: (_, r) => dateOrDash(r.stats.last?.doneAt ?? r.stats.last?.dueDate) },
    { key: 'next', label: 'Próxima execução', render: (_, r) => dateOrDash(r.stats.next?.dueDate) },
    { key: 'situation', label: 'Situação', render: (_, r) => situationBadge(r.stats.situation) },
    { key: 'actions', label: 'Ações', sticky: 'right', render: (_, r) => actions(r) },
  ];

  const { columns: shownColumns, control, fieldsFor } = useColumnPrefs('sub-planos', columns, { mobileFixed: ['situation', 'executorName'] });
  const filterControl = (
    <FilterControl
      note="Filtros agrupados (status, situação, executor, unidade). Status do plano: Ativo ou Pausado (RF602-RGN003); pausado não gera novas execuções. Situação (RF602-RGN001): Atrasado = há execução com data prevista ultrapassada sem conclusão (inclui as 'Não realizada' pendentes de regularização); Em breve = próxima execução em até 7 dias; Em dia = demais. Plano pausado e sem atraso fica sem situação. Abre já filtrado por situação quando vem dos cards do Início (?filter=overdue|upcoming)."
      filters={[
        { id: 'status', label: 'Status', options: STATUS_OPTIONS, value: status, onChange: setStatus },
        { id: 'situation', label: 'Situação', options: SITUATION_FILTER_OPTIONS, value: situation, onChange: setSituation },
        { id: 'executor', label: 'Executor', options: executorOptions, value: executor, onChange: setExecutor },
        { id: 'unit', label: 'Unidade', options: unitOptions, value: unit, onChange: setUnit },
      ]}
    />
  );
  const toolbar = <ListFilters searchLabel="Buscar plano por nome, equipamento, unidade ou executor" placeholder="Buscar por plano, equipamento ou executor" query={query} onQuery={setQuery} filterControl={filterControl} columns={control} />;
  const noPlans = plans.length === 0;

  return (
    <AppLayout active="planos" screen="planos">
      <Stack gap="xl">
        <PageHeader
          title="Planos de manutenção"
          subtitle="Acompanhe as preventivas, as execuções atrasadas e o cumprimento dos planos"
          actions={can('planos', 'cadastrar') && (
            <DevNote note="Abre o wizard de 6 passos (RF601). Visível só para perfis com permissão “Cadastrar” em Planos. Aprovação do plano pelo gestor é FE006 (fora do escopo). O botão não deve ser exibido para usuários sem a permissão “Cadastrar” em Planos.">
              <Button iconLeft={<IconPlus size={20} />} onClick={() => goTo('plano-form.html')}>Novo plano</Button>
            </DevNote>
          )}
        />

        <Grid>
          <Col span={3} fill>
            <DevNote note="Planos com status Ativo entre os planos listados (RF602-CTA002: os cards batem com a lista).">
              <KpiCard label="Planos ativos" value={formatNumber(kpis.active)} description={`${formatNumber(rows.length)} planos no total`} icon={<IconCalendarRepeat size={20} />} />
            </DevNote>
          </Col>
          <Col span={3} fill>
            <DevNote note="RF602-RGN001: execuções com data prevista ultrapassada sem conclusão. O card conta execuções; a lista (filtro Situação = Atrasado) mostra os planos que têm ao menos uma. Execuções 'Não realizada' continuam pesando no cumprimento (RF601-RGN005).">
              <KpiCard label="Execuções atrasadas" value={formatNumber(kpis.late)} description="Previstas e ainda não concluídas" icon={<IconAlertTriangle size={20} />} />
            </DevNote>
          </Col>
          <Col span={3} mobileFull fill>
            <DevNote note="Execuções pendentes com data prevista entre hoje e os próximos 7 dias.">
              <KpiCard label="Próximas execuções · 7 dias" value={formatNumber(kpis.soon)} description={`Até ${formatDate(addDays(TODAY, 7))}`} icon={<IconCalendarEvent size={20} />} />
            </DevNote>
          </Col>
          <Col span={3} mobileFull fill>
            <DevNote note="RF602-RGN002: cumprimento = execuções concluídas ÷ execuções previstas nos últimos 30 dias (data prevista no período; atrasadas e 'Não realizada' contam como não cumpridas).">
              <KpiCard
                label="Cumprimento · 30 dias" value={kpis.compliance.pct === null ? '-' : `${kpis.compliance.pct}%`}
                description={kpis.compliance.planned ? `${kpis.compliance.done} de ${kpis.compliance.planned} execuções concluídas` : 'Sem execuções previstas no período'} icon={<IconChecks size={20} />}
              />
            </DevNote>
          </Col>
        </Grid>

        {noPlans ? (
          <Card>
            <EmptyState
              icon={<IconCircleOff size={32} />} title="Nenhum plano de manutenção cadastrado"
              description={can('planos', 'cadastrar') ? 'Crie o primeiro plano para gerar as preventivas automaticamente.' : 'Quando houver planos, eles aparecem aqui.'}
              headingLevel={2}
              action={can('planos', 'cadastrar') ? <Button iconLeft={<IconPlus size={20} />} onClick={() => goTo('plano-form.html')}>Novo plano</Button> : undefined}
            />
          </Card>
        ) : (
          <DevNote note="RF602: listagem paginada (10) com busca e filtros combinados (status, situação, executor, unidade). Equipamento(s) e Unidade(s) mostram o primeiro + “+N”. Clique no plano abre o histórico (plano.html). “Salvar visualização” é FE010 (fora do escopo). Colunas personalizáveis (botão “Exibição”) entram a pedido, para avaliação. Executor só vê os planos em que é o executor. No mobile vira lista de cards.">
            <ResponsiveTable<Row>
              id="plans-title" title="Lista de planos de manutenção" titleHidden toolbar={toolbar} columns={shownColumns} rows={filtered} resetKey={resetKey}
              emptyTitle="Nenhum plano encontrado" emptyDescription="Revise a busca ou os filtros."
              card={(r) => {
                const e = executorOf(db, r.plan.executor);
                return {
                  id: r.id, title: r.plan.name, subtitle: `${e.primary} · ${e.secondary}`, badge: situationBadge(r.stats.situation),
                  fields: fieldsFor([
                    { label: 'Status', value: statusBadge(r.plan) }, { label: 'Frequência', value: describeFrequency(r.plan) },
                    { label: 'Equipamento(s)', value: withMore(r.equipments) }, { label: 'Unidade(s)', value: withMore(r.units) },
                    { label: 'Última execução', value: dateOrDash(r.stats.last?.doneAt ?? r.stats.last?.dueDate) }, { label: 'Próxima execução', value: dateOrDash(r.stats.next?.dueDate) },
                  ]),
                  actions: actions(r),
                };
              }}
            />
          </DevNote>
        )}
      </Stack>
      <PlanStatusDialog plan={toggling} onClose={() => setToggling(null)} />
    </AppLayout>
  );
}

mountApp(<PlanosScreen />);
