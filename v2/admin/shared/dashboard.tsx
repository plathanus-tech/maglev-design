import { useMemo, useState } from 'react';
import {
  IconAlertOctagon, IconAlertTriangle, IconBuilding, IconCalendarRepeat, IconFridge, IconMessageReport, IconTool, IconUserCheck, IconUserExclamation,
} from '@tabler/icons-react';
import { Badge, Card, Dropdown, KpiCard, KpiTrend, Stack, Table, TableColumn } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { MobileCardList } from './MobileCardList';
import { useIsMobile } from './useMediaQuery';
import { useSession } from './store';
import { Db, LevelItem, Ticket, subscriberName, visualBadge } from './data';
import { formatNumber, openedAgo } from './format';
import { useColumnPrefs } from './ColumnsControl';
import { useHashState } from './useHashState';
import { Col, Grid, SectionLabel, TableToolbar, levelBadgeOf, statusBadgeOf } from './ui';

/** Estados: idle · empty (nenhum chamado em aberto - todos resolvidos) */
const STATES = ['idle', 'empty'] as const;
type Mode = (typeof STATES)[number];
const PAGE_SIZE = 10;

type Period = 'today' | '7d';
const PERIODS = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
];
const REFERENCE: Record<Period, string> = { '7d': 'vs. 7 dias anteriores', today: 'vs. ontem' };

/**
 * DADOS DE DEMONSTRAÇÃO - comparativo com o período anterior, só para avaliar o visual do KPI.
 * Hoje -> compara com ontem; Últimos 7 dias -> compara com os 7 dias anteriores. O sentimento é definido por KPI
 * (inadimplentes subindo é negativo; solicitações abertas caindo é positivo). "Preventivas cadastradas" fica sem
 * comparativo para mostrar o caso em que não há histórico adequado.
 */
type TrendMock = Omit<KpiTrend, 'reference'>;
const TREND_KEY: Record<string, string> = {
  'Assinantes ativos': 'ativos', 'Assinantes inadimplentes': 'inadimplentes', 'Total de unidades': 'unidades',
  'Equipamentos cadastrados': 'equipamentos', 'Solicitações abertas': 'solicitacoes', 'Ordens de serviço em andamento': 'os',
  'Preventivas cadastradas': 'preventivas',
};
/** Planos de preventiva novos no período (dado de demonstração). */
const NEW_PLANS: Record<Period, number> = { '7d': 12, today: 2 };
const NEW_PLANS_TEXT: Record<Period, string> = { '7d': 'cadastradas nos últimos 7 dias', today: 'cadastradas hoje' };
const TREND_DEMO: Record<Period, Partial<Record<string, TrendMock>>> = {
  '7d': {
    ativos: { direction: 'up', percent: 4.1, sentiment: 'positive' },
    inadimplentes: { direction: 'up', percent: 20, sentiment: 'negative' },
    unidades: { direction: 'up', percent: 1.8, sentiment: 'positive' },
    equipamentos: { direction: 'up', percent: 2.3, sentiment: 'positive' },
    solicitacoes: { direction: 'down', percent: 8, sentiment: 'positive' },
    os: { direction: 'up', percent: 13.3, sentiment: 'negative' },
    preventivas: { direction: 'up', percent: 5.9, sentiment: 'positive' },
  },
  today: {
    ativos: { direction: 'flat', percent: 0, sentiment: 'neutral' },
    inadimplentes: { direction: 'flat', percent: 0, sentiment: 'neutral' },
    unidades: { direction: 'up', percent: 0.3, sentiment: 'positive' },
    equipamentos: { direction: 'up', percent: 0.5, sentiment: 'positive' },
    solicitacoes: { direction: 'up', percent: 4.5, sentiment: 'negative' },
    os: { direction: 'down', percent: 5.6, sentiment: 'positive' },
    preventivas: { direction: 'up', percent: 0.9, sentiment: 'positive' },
  },
};

/** Chamados em aberto de assinantes com ambiente ativo (RF101-RGN001), por atenção (RGN002, CTA003). */
function openTickets(db: Db, mode: Mode) {
  if (mode === 'empty') return [];
  const active = new Set(db.subscribers.filter((s) => s.status !== 'inativo').map((s) => s.id));
  const crit = (id: string) => db.criticalities.findIndex((c) => c.id === id);
  const prio = (id: string) => db.priorities.findIndex((p) => p.id === id);
  return db.tickets
    .filter((t) => active.has(t.subscriberId))
    .sort((a, b) => crit(a.criticalityId) - crit(b.criticalityId) || prio(a.priorityId) - prio(b.priorityId) || b.hoursAgo - a.hoursAgo);
}

/** Destaque de atenção: número grande + rótulo sobre superfície semântica suave (tokens status-error / status-warning). */
function AttentionItem({ tone, icon, value, label }: { tone: 'critical' | 'warning'; icon: JSX.Element; value: number; label: string }) {
  return (
    <div className={`attention-item attention-${tone}`}>
      <span className="attention-icon" aria-hidden="true">{icon}</span>
      <div className="attention-text">
        <span className="attention-value">{formatNumber(value)}</span>
        <span className="attention-label">{label}</span>
      </div>
    </div>
  );
}

type Row = Record<string, unknown> & Ticket & { subscriber: string; openedAgo: string; kind: string };

function DashboardScreen() {
  const { db, can } = useSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<Period>('7d');
  const tickets = useMemo(() => openTickets(db, mode), [db, mode]);

  const live = db.subscribers.filter((s) => s.status !== 'inativo');
  const kpis = {
    active: db.subscribers.filter((s) => s.status === 'ativo').length,
    overdue: db.subscribers.filter((s) => s.status === 'inadimplente').length,
    units: live.reduce((n, s) => n + s.units, 0),
    equipments: live.reduce((n, s) => n + s.equipments, 0),
    requests: tickets.filter((t) => t.type === 'solicitacao').length,
    orders: tickets.filter((t) => t.type === 'os').length,
    plans: db.preventivePlans,
  };

  const prio = (id: string) => db.priorities.find((p) => p.id === id)!;
  const crit = (id: string) => db.criticalities.find((c) => c.id === id)!;
  const sub = (id: string) => db.subscribers.find((s) => s.id === id)!;
  const levelBadge = (l: LevelItem) => levelBadgeOf(l.visual, l.name);
  const statusBadge = (id: string) => { const s = db.statuses.find((x) => x.id === id)!; return statusBadgeOf(s.visual, s.name); };

  const rows: Row[] = tickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((t) => ({
    ...t,
    kind: t.type === 'os' ? 'Ordem de serviço' : 'Solicitação',
    subscriber: subscriberName(sub(t.subscriberId)),
    openedAgo: openedAgo(t.hoursAgo),
  }));

  const subscriberLink = (t: Row) => <a className="text-link" href={`assinante.html?id=${t.subscriberId}`}>{t.subscriber}</a>;

  const columns: TableColumn<Row>[] = [
    { key: 'subscriber', label: 'Assinante', render: (_, r) => (can('assinantes') ? subscriberLink(r) : r.subscriber) },
    { key: 'unit', label: 'Unidade' },
    { key: 'equipment', label: 'Equipamento' },
    { key: 'priorityId', label: 'Prioridade', render: (v) => levelBadge(prio(String(v))) },
    { key: 'criticalityId', label: 'Criticidade', render: (v) => levelBadge(crit(String(v))) },
    { key: 'statusId', label: 'Status', render: (v) => statusBadge(String(v)) },
    { key: 'openedAgo', label: 'Aberto há', align: 'right' },
  ];
  const { columns: shownColumns, control, fieldsFor } = useColumnPrefs('dashboard-chamados', columns, { mobileFixed: ['subscriber', 'statusId'] });

  const kpi = (note: string, label: string, value: number, icon: JSX.Element, description?: string, href?: string) => {
    const t = TREND_DEMO[period][TREND_KEY[label]];
    const trend = t && { ...t, reference: REFERENCE[period] };
    const full = `${note} O valor é a situação atual e não muda com o período.`
      + (trend ? ` O comparativo (dado de demonstração) muda com o período: ${REFERENCE[period]}.` : ' Sem comparativo: não há histórico adequado para esta métrica.');
    return (
      <Col span={3} key={label} fill>
        <DevNote note={full}><KpiCard label={label} value={formatNumber(value)} icon={icon} trend={trend} description={description} href={href} /></DevNote>
      </Col>
    );
  };
  const empty = { title: 'Nenhum chamado em aberto', description: 'Todas as solicitações e ordens de serviço dos assinantes estão resolvidas.' };

  return (
    <AppLayout active="dashboard" screen="dashboard">
      <Stack gap="xl">
        <PageHeader
          title="Dashboard"
          subtitle="Acompanhe a operação dos assinantes e antecipe problemas antes de o suporte ser acionado"
          actions={(
            <DevNote note="Filtro global de período (💡 sugerido pela cliente - a confirmar se global). Seleção inicial: Últimos 7 dias. Os valores dos KPIs são a situação atual e não mudam; o que muda é o comparativo de cada KPI: vs. ontem (Hoje) ou vs. 7 dias anteriores. Não filtra a lista de chamados, que mostra tudo o que está aberto independentemente da data (RF101-RGN002). Consultas por período detalhadas ficam para relatórios.">
              <Dropdown label="Período" options={PERIODS} value={period} onChange={(v) => setPeriod(v as Period)} />
            </DevNote>
          )}
        />

        <DevNote note="RF101-RGN003: sem filtro de período por card; o seletor global “Hoje / Últimos 7 dias” só altera o comparativo dos KPIs. Indicadores consideram só assinantes com ambiente ativo (RGN001). Novos indicadores (estágio de implantação, acessos via QR Code, dashboard personalizável) são Fora do Escopo (FE013, FE016, FE014).">
          <Stack gap="lg">
            <Stack gap="sm" as="section">
              <SectionLabel>Carteira de assinantes</SectionLabel>
              <Grid>
                {kpi('Quantidade de assinantes com status Ativo.', 'Assinantes ativos', kpis.active, <IconUserCheck size={20} />, undefined, can('assinantes') ? 'assinantes.html?status=ativo' : undefined)}
                {kpi('Quantidade de assinantes com status Inadimplente - controle manual; a cobrança é feita fora da plataforma (RF201-RGN002).', 'Assinantes inadimplentes', kpis.overdue, <IconUserExclamation size={20} />, undefined, can('assinantes') ? 'assinantes.html?status=inadimplente' : undefined)}
                {kpi('Soma das unidades dos assinantes com ambiente ativo.', 'Total de unidades', kpis.units, <IconBuilding size={20} />)}
                {kpi('Soma dos equipamentos cadastrados pelos assinantes com ambiente ativo.', 'Equipamentos cadastrados', kpis.equipments, <IconFridge size={20} />)}
              </Grid>
            </Stack>
            <Stack gap="sm" as="section">
              <SectionLabel>Operação</SectionLabel>
              <Grid>
                {kpi('Solicitações não encerradas, de todos os assinantes.', 'Solicitações abertas', kpis.requests, <IconMessageReport size={20} />)}
                {kpi('Ordens de serviço não concluídas nem canceladas.', 'Ordens de serviço em andamento', kpis.orders, <IconTool size={20} />)}
                {kpi('Planos de manutenção preventiva existentes, de todos os assinantes. A linha “+N cadastradas” é a quantidade de planos criados no período (dado de demonstração).', 'Preventivas cadastradas', kpis.plans, <IconCalendarRepeat size={20} />, `+${NEW_PLANS[period]} ${NEW_PLANS_TEXT[period]}`)}
              </Grid>
            </Stack>
          </Stack>
        </DevNote>

        <DevNote note="Resumo de atenção (RF101-RGN004): chamados em aberto (solicitações + OS) com Criticidade A e com Prioridade Emergência, destacados em vermelho (crítico) e warning. Um chamado pode entrar nos dois destaques. A distribuição completa por nível não é exibida aqui.">
          <Card
            title="Chamados que exigem atenção"
            subtitle={`${tickets.length} ${tickets.length === 1 ? 'chamado em aberto no total' : 'chamados em aberto no total'}`}
          >
            <div className="card-body-tight">
              <div className="attention-grid">
                <AttentionItem tone="critical" icon={<IconAlertOctagon size={24} />} value={tickets.filter((t) => t.criticalityId === 'CRI-A').length} label={`Criticidade ${crit('CRI-A').name.replace(' - ', ' — ')}`} />
                <AttentionItem tone="warning" icon={<IconAlertTriangle size={24} />} value={tickets.filter((t) => t.priorityId === 'PRI-1').length} label={`Prioridade ${prio('PRI-1').name}`} />
              </div>
            </div>
          </Card>
        </DevNote>

        <DevNote note="Lista tudo o que não está fechado, independentemente da data (RF101-RGN002): solicitações com status ≠ encerrada e OS ≠ concluída/cancelada. Ordem: criticidade (A › B › C), depois prioridade (Emergência › Baixa), depois o mais antigo - críticos no topo e destacados (CTA003). Status com o tipo visual configurado (RF407). 10 por página; no mobile vira lista de cards.">
          {isMobile ? (
            <MobileCardList
              headingId="open-tickets-title"
              title="Chamados em aberto"
              subtitle="Solicitações e ordens de serviço ainda não resolvidas"
              toolbar={<TableToolbar columns={control} />}
              emptyTitle={empty.title}
              page={page}
              pageSize={PAGE_SIZE}
              total={tickets.length}
              onPageChange={setPage}
              items={rows.map((t) => ({
                id: t.id,
                title: can('assinantes') ? subscriberLink(t) : t.subscriber,
                badge: statusBadge(t.statusId),
                fields: fieldsFor([
                  { label: 'Unidade', value: t.unit },
                  { label: 'Equipamento', value: t.equipment },
                  { label: 'Prioridade', value: levelBadge(prio(t.priorityId)) },
                  { label: 'Criticidade', value: levelBadge(crit(t.criticalityId)) },
                  { label: 'Aberto há', value: t.openedAgo },
                ]),
              }))}
            />
          ) : (
            <Table<Row>
              title="Chamados em aberto"
              subtitle="Solicitações e ordens de serviço ainda não resolvidas, de todos os assinantes"
              columns={shownColumns}
              actions={control}
              rows={rows}
              empty={empty}
              pagination={{ page, pageSize: PAGE_SIZE, total: tickets.length, onPageChange: setPage }}
            />
          )}
        </DevNote>
      </Stack>
    </AppLayout>
  );
}

mountApp(<DashboardScreen />);
