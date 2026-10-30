import { useEffect, useMemo, useState } from 'react';
import {
  IconAlertOctagon, IconAlertTriangle, IconBuilding, IconCalendarRepeat, IconChecks, IconClipboardList, IconFridge, IconMessageReport, IconSearch, IconTool, IconUserCheck, IconUserExclamation,
} from '@tabler/icons-react';
import { Button, Card, Dialog, Dropdown, Input, KpiCard, KpiTrend, Stack, Table, TableColumn } from '@maglev/ds';
import { FilterControl } from './FilterControl';
import { DashboardPeriod } from './DashboardPeriod';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { MobileCardList } from './MobileCardList';
import { useIsMobile } from './useMediaQuery';
import { updateDb, useSession } from './store';
import { ContactChannelDialog } from './ContactChannelDialog';
import { SessionConflictModal } from './SessionConflictModal';
import { Db, LevelItem, Ticket, subscriberName, visualBadge } from './data';
import { formatDateTime, formatNumber, normalize, openedAgo } from './format';
import { KpiCount } from './kpi-value';
import { useColumnPrefs } from './ColumnsControl';
import { useHashState } from './useHashState';
import { PERIOD_OPTIONS, PeriodKey, Range, movement, newPlansIn, previousOf, rangeOf, referenceText, rangeText, shiftDays, snapshotTrend, trendBetween } from './dashboard-period';
import { todayIso } from './clock';
import { Col, Grid, ReadField, param, SectionLabel, TableToolbar, levelBadgeOf, statusBadgeOf } from './ui';

/** Estados: idle · empty (nenhum chamado em aberto - todos resolvidos) */
const STATES = ['idle', 'empty', 'session', 'firstaccess'] as const;
type Mode = (typeof STATES)[number];
const PAGE_SIZE = 10;

type Period = PeriodKey;

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
const NEW_PLANS: Partial<Record<Period, number>> = { '7d': 12, today: 2 };
const NEW_PLANS_TEXT: Partial<Record<Period, string>> = { '7d': 'cadastradas nos últimos 7 dias', today: 'cadastradas hoje' };
const TREND_DEMO: Partial<Record<Period, Partial<Record<string, TrendMock>>>> = {
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
function AttentionItem({ tone, icon, value, label, active, onClick }: { tone: 'critical' | 'warning'; icon: JSX.Element; value: number; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`attention-item attention-${tone}`} aria-pressed={active} onClick={onClick}>
      <span className="attention-icon" aria-hidden="true">{icon}</span>
      <span className="attention-text">
        <span className="attention-value">{formatNumber(value)}</span>
        <span className="attention-label">{label}</span>
      </span>
    </button>
  );
}

type Row = Record<string, unknown> & Ticket & { subscriber: string; openedAgo: string; updatedAgo: string; kind: string };
const NO_RESPONSIBLE = 'sem-responsavel';

function DashboardScreen() {
  const { db, can, user } = useSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  // Sessão única (variante #state=session): a conta já está aberta em outra sessão; nada do painel aparece até a pessoa escolher
  const [sessionChoice, setSessionChoice] = useState<'pending' | 'here'>('pending');
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<Period>('7d');
  // Período personalizado: já abre preenchido com os últimos 7 dias, para nunca ficar sem intervalo
  const [custom, setCustom] = useState<Range>(() => rangeOf('7d', { from: '', to: '' }));
  const today = todayIso();
  // Personalizado vale só com as duas datas e fim ≥ início (o painel de filtros limita ao máximo de hoje)
  const customValid = !!custom.from && !!custom.to && custom.to >= custom.from;
  // Enquanto o intervalo personalizado está incompleto ou incorreto, os números seguem o último período válido (7 dias)
  const range = period === 'custom' && !customValid ? rangeOf('7d', custom) : rangeOf(period, custom);
  const previous = previousOf(range, period === 'custom' && !customValid ? '7d' : period);
  const reference = referenceText(period === 'custom' && !customValid ? '7d' : period, range, previous);
  const [query, setQuery] = useState('');
  // ?tipo=solicitacao|os (cards Solicitações abertas / Ordens de serviço em andamento): abre a lista de chamados já filtrada
  const [type, setType] = useState(() => (['solicitacao', 'os'].includes(param('tipo') ?? '') ? (param('tipo') as string) : 'todos'));
  const [situation, setSituation] = useState('todos');
  const [responsible, setResponsible] = useState('todos');
  const [criticality, setCriticality] = useState('todos');
  const [priority, setPriority] = useState('todos');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const tickets = useMemo(() => openTickets(db, mode), [db, mode]);
  useEffect(() => setPage(1), [query, type, situation, responsible, criticality, priority]);
  useEffect(() => { if (type !== 'todos' && param('tipo')) window.setTimeout(() => document.getElementById('chamados-em-aberto')?.scrollIntoView({ block: 'start' }), 100); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const toRow = (t: Ticket): Row => ({
    ...t,
    kind: t.type === 'os' ? 'Ordem de serviço' : 'Solicitação',
    subscriber: subscriberName(sub(t.subscriberId)),
    openedAgo: openedAgo(t.hoursAgo),
    updatedAgo: openedAgo(t.updatedHoursAgo),
  });
  // Filtros da lista (situação, responsável, criticidade) + busca por protocolo, assinante, unidade ou equipamento; os destaques e KPIs seguem contando tudo
  const visible = useMemo(() => tickets.filter((t) => {
    const q = normalize(query);
    return (type === 'todos' || t.type === type)
      && (situation === 'todos' || t.statusId === situation)
      && (responsible === 'todos' || (responsible === NO_RESPONSIBLE ? !t.responsible : t.responsible === responsible))
      && (criticality === 'todos' || t.criticalityId === criticality)
      && (priority === 'todos' || t.priorityId === priority)
      && (!q || normalize(`${t.id} ${subscriberName(db.subscribers.find((s) => s.id === t.subscriberId)!)} ${t.unit} ${t.equipment}`).includes(q));
  }), [tickets, db, query, type, situation, responsible, criticality, priority]);
  // Clicar no destaque filtra a lista abaixo para esses chamados (clicar de novo limpa); os demais filtros e a busca são zerados para a lista bater com o número do card
  const focusAttention = (kind: 'criticality' | 'priority') => {
    const on = kind === 'criticality' ? criticality === 'CRI-A' && priority === 'todos' : priority === 'PRI-1' && criticality === 'todos';
    setQuery(''); setType('todos'); setSituation('todos'); setResponsible('todos');
    setCriticality(kind === 'criticality' && !on ? 'CRI-A' : 'todos');
    setPriority(kind === 'priority' && !on ? 'PRI-1' : 'todos');
    if (!on) window.setTimeout(() => document.getElementById('chamados-em-aberto')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };
  const rows: Row[] = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(toRow);

  const typeOptions = [{ value: 'todos', label: 'Todos os tipos' }, { value: 'solicitacao', label: 'Solicitações' }, { value: 'os', label: 'Ordens de serviço' }];
  const situationOptions = [
    { value: 'todos', label: 'Todas as situações' },
    ...db.statuses.filter((s) => tickets.some((t) => t.statusId === s.id)).map((s) => ({ value: s.id, label: s.name })),
  ];
  const responsibleOptions = [
    { value: 'todos', label: 'Todos os responsáveis' },
    ...[...new Set(tickets.map((t) => t.responsible).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((r) => ({ value: r, label: r })),
    { value: NO_RESPONSIBLE, label: 'Sem responsável' },
  ];
  const criticalityOptions = [{ value: 'todos', label: 'Todas as criticidades' }, ...db.criticalities.map((c) => ({ value: c.id, label: c.name }))];
  const priorityOptions = [{ value: 'todos', label: 'Todas as prioridades' }, ...db.priorities.map((p) => ({ value: p.id, label: p.name }))];
  const subscriberLink = (t: Row) => <a className="text-link" href={`assinante.html?id=${t.subscriberId}`}>{t.subscriber}</a>;
  const protocolLink = (t: Ticket) => <button type="button" className="text-link link-button" aria-haspopup="dialog" onClick={() => setSelected(t)}>{t.id}</button>;

  const columns: TableColumn<Row>[] = [
    { key: 'id', label: 'Protocolo', render: (_, r) => protocolLink(r) },
    { key: 'subscriber', label: 'Assinante', render: (_, r) => (can('assinantes') ? subscriberLink(r) : r.subscriber) },
    { key: 'unit', label: 'Unidade' },
    { key: 'equipment', label: 'Equipamento' },
    { key: 'priorityId', label: 'Prioridade', render: (v) => levelBadge(prio(String(v))) },
    { key: 'criticalityId', label: 'Criticidade', render: (v) => levelBadge(crit(String(v))) },
    { key: 'statusId', label: 'Situação', render: (v) => statusBadge(String(v)) },
    { key: 'openedAgo', label: 'Aberto há', align: 'right' },
    { key: 'updatedAgo', label: 'Última atualização', align: 'right', render: (v) => `há ${v}` },
  ];
  const { columns: shownColumns, control, fieldsFor } = useColumnPrefs('dashboard-chamados', columns, { mobileFixed: ['subscriber', 'statusId'] });
  const toolbar = (
    <TableToolbar
      search={<Input type="search" aria-label="Buscar chamado por protocolo, assinante, unidade ou equipamento" placeholder="Buscar por protocolo, assinante ou unidade" iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)} />}
      filters={(
        <FilterControl
          note="Filtros da lista de chamados: Tipo (Solicitações ou Ordens de serviço; os cards Solicitações abertas e Ordens de serviço em andamento abrem a lista já filtrada por tipo), Situação (status atual do chamado), Responsável (quem atende; inclui “Sem responsável”) , Criticidade e Prioridade. Os destaques e os KPIs acima continuam contando todos os chamados em aberto."
          filters={[
            { id: 'type', label: 'Tipo', options: typeOptions, value: type, onChange: setType },
            { id: 'situation', label: 'Situação', options: situationOptions, value: situation, onChange: setSituation },
            { id: 'responsible', label: 'Responsável', options: responsibleOptions, value: responsible, onChange: setResponsible },
            { id: 'criticality', label: 'Criticidade', options: criticalityOptions, value: criticality, onChange: setCriticality },
            { id: 'priority', label: 'Prioridade', options: priorityOptions, value: priority, onChange: setPriority },
          ]}
        />
      )}
      columns={control}
    />
  );


  const kpi = (note: string, label: string, value: number, icon: JSX.Element, description?: string, href?: string) => {
    const key = TREND_KEY[label];
    const t = TREND_DEMO[period] ? TREND_DEMO[period]![key] : key === 'preventivas' ? undefined : snapshotTrend(key, range);
    const trend = t && { ...t, reference: reference };
    const full = `${note} O valor é a situação atual e não muda com o período.`
      + (trend ? ` O comparativo (dado de demonstração) muda com o período: ${reference} (período anterior de mesma duração; nos atalhos de mês, o mês civil anterior).` : ' Sem comparativo: não há histórico adequado para esta métrica.');
    return (
      <Col span={3} key={label} fill>
        <DevNote note={full}><KpiCard label={label} value={<KpiCount value={value} />} icon={icon} trend={trend} description={description} href={href} /></DevNote>
      </Col>
    );
  };
  const mov = (trendKey: string, label: string, kind: 'solicitacoes' | 'osAbertas' | 'osConcluidas', icon: JSX.Element, note: string) => {
    const now = movement(kind, range);
    const trend = { ...trendBetween(trendKey, now, movement(kind, previous)), reference: reference };
    return (
      <Col span={3} key={label} fill>
        <DevNote note={`${note} Varia com o período (dado de demonstração); o comparativo é com o período anterior de mesma duração.`}><KpiCard label={label} value={<KpiCount value={now} />} icon={icon} trend={trend} /></DevNote>
      </Col>
    );
  };
  const empty = { title: 'Nenhum chamado em aberto', description: 'Todas as solicitações e ordens de serviço dos assinantes estão resolvidas.' };

  const blocked = mode === 'session' && sessionChoice === 'pending';
  // Primeiro acesso (variante #state=firstaccess): orientação sobre o canal de avisos (WhatsApp) e conferência do telefone
  const [contactOpen, setContactOpen] = useState(mode === 'firstaccess');

  return (
    <AppLayout active="dashboard" screen="dashboard">
      {contactOpen && (
        <ContactChannelDialog
          initial={{ phone: user.phone, notifyEmail: user.notifyEmail ?? true, notifyWhatsapp: user.notifyWhatsapp ?? false }}
          email={user.email}
          notices={['Alertas de segurança da sua conta, como acesso de um novo dispositivo', 'Assinantes inadimplentes e prazos de inativação do ambiente', 'Convites aceitos e mudanças de acesso da equipe da plataforma']}
          onSave={(c) => updateDb((d) => ({ ...d, adminUsers: d.adminUsers.map((u) => (u.id === user.id ? { ...u, ...c } : u)) }))}
          onClose={() => setContactOpen(false)}
        />
      )}
      <div aria-hidden={blocked || undefined} {...(blocked ? ({ inert: '' } as object) : {})}>
      <Stack gap="xl">
        <PageHeader
          title="Dashboard"
          subtitle="Acompanhe a operação dos assinantes e antecipe problemas antes de o suporte ser acionado"
          actions={(
              <DashboardPeriod period={period} onPeriod={setPeriod} custom={custom} onCustom={setCustom} max={todayIso()} note="Filtro global de período (💡 sugerido pela cliente - a confirmar se global). Atalhos: Hoje, Últimos 7 dias (inicial), Últimos 30 dias, Mês atual, Mês anterior e Período personalizado (data inicial e final, até hoje; a final não pode ser anterior à inicial). Critérios: os indicadores de Carteira e de Operação são a situação atual e não mudam com o período; o período define o comparativo de cada indicador (com o período anterior de mesma duração, imediatamente antes; nos atalhos de mês, com o mês civil anterior) e os indicadores de Movimento no período (solicitações abertas, OS abertas e OS concluídas dentro do intervalo, pela data de abertura/conclusão). O texto sob o seletor mostra o intervalo consultado e o de comparação. Não filtra a lista de chamados, que mostra tudo o que está aberto independentemente da data (RF101-RGN002). Valores históricos e comparativos são dados de demonstração; em desenvolvimento vêm do histórico real. Consultas detalhadas ficam para relatórios. Na tela: Dropdown com os atalhos; Período personalizado abre um painel com De/Até (até hoje) e Aplicar/Limpar, como os filtros de período das demais telas; fechar sem aplicar mantém o período anterior." />
          )}
        />

        <DevNote note="RF101-RGN003: sem filtro de período por card; o seletor global só altera o comparativo dos KPIs e o Movimento no período. Indicadores consideram só assinantes com ambiente ativo (RGN001). Novos indicadores (estágio de implantação, acessos via QR Code, dashboard personalizável) são Fora do Escopo (FE013, FE016, FE014).">
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
                {kpi('Solicitações não encerradas, de todos os assinantes.', 'Solicitações abertas', kpis.requests, <IconMessageReport size={20} />, undefined, 'dashboard.html?tipo=solicitacao#chamados-em-aberto')}
                {kpi('Ordens de serviço não concluídas nem canceladas.', 'Ordens de serviço em andamento', kpis.orders, <IconTool size={20} />, undefined, 'dashboard.html?tipo=os#chamados-em-aberto')}
                {kpi('Planos de manutenção preventiva existentes, de todos os assinantes. A linha “+N cadastradas” é a quantidade de planos criados no período (dado de demonstração).', 'Preventivas cadastradas', kpis.plans, <IconCalendarRepeat size={20} />, `+${NEW_PLANS[period] ?? newPlansIn(range)} ${NEW_PLANS_TEXT[period] ?? 'cadastradas no período'}`)}
              </Grid>
            </Stack>
            <Stack gap="sm" as="section">
              <SectionLabel>{`Movimento no período · ${rangeText(range)}`}</SectionLabel>
              <Grid>
                {mov('solicitacoesPeriodo', 'Solicitações abertas no período', 'solicitacoes', <IconMessageReport size={20} />, 'Solicitações abertas dentro do intervalo, pela data de abertura (inclui as já encerradas).')}
                {mov('osAbertasPeriodo', 'OS abertas no período', 'osAbertas', <IconClipboardList size={20} />, 'Ordens de serviço criadas dentro do intervalo, pela data de abertura.')}
                {mov('osConcluidasPeriodo', 'OS concluídas no período', 'osConcluidas', <IconChecks size={20} />, 'Ordens de serviço concluídas dentro do intervalo, pela data de conclusão.')}
              </Grid>
            </Stack>
          </Stack>
        </DevNote>

        <DevNote note="Resumo de atenção (RF101-RGN004): chamados em aberto (solicitações + OS) com Criticidade A e com Prioridade Emergência, destacados em vermelho (crítico) e warning. Um chamado pode entrar nos dois destaques. A distribuição completa por nível não é exibida aqui. Cada destaque é clicável: filtra a lista “Chamados em aberto” logo abaixo para esses chamados (criticidade A ou prioridade Emergência), zera os demais filtros e rola até a lista; clicar de novo remove o filtro.">
          <Card
            title="Chamados que exigem atenção"
            subtitle={`${tickets.length} ${tickets.length === 1 ? 'chamado em aberto no total' : 'chamados em aberto no total'}`}
          >
            <div className="card-body-tight">
              <div className="attention-grid">
                <AttentionItem tone="critical" icon={<IconAlertOctagon size={24} />} value={tickets.filter((t) => t.criticalityId === 'CRI-A').length} label={`Criticidade ${crit('CRI-A').name.replace(' - ', ' — ')}`} active={criticality === 'CRI-A' && priority === 'todos'} onClick={() => focusAttention('criticality')} />
                <AttentionItem tone="warning" icon={<IconAlertTriangle size={24} />} value={tickets.filter((t) => t.priorityId === 'PRI-1').length} label={`Prioridade ${prio('PRI-1').name}`} active={priority === 'PRI-1' && criticality === 'todos'} onClick={() => focusAttention('priority')} />
              </div>
            </div>
          </Card>
        </DevNote>

        <div id="chamados-em-aberto">
        <DevNote note="Lista tudo o que não está fechado, independentemente da data (RF101-RGN002): solicitações com status ≠ encerrada e OS ≠ concluída/cancelada. Ordem: criticidade (A › B › C), depois prioridade (Emergência › Baixa), depois o mais antigo - críticos no topo e destacados (CTA003). Status com o tipo visual configurado (RF407). 10 por página; no mobile vira lista de cards.">
          {isMobile ? (
            <MobileCardList
              onItemClick={(i) => setSelected(rows[i] as Ticket)}
              headingId="open-tickets-title"
              title="Chamados em aberto"
              subtitle="Solicitações e ordens de serviço ainda não resolvidas"
              toolbar={toolbar}
              emptyTitle={empty.title}
              page={page}
              pageSize={PAGE_SIZE}
              total={visible.length}
              onPageChange={setPage}
              items={rows.map((t) => ({
                id: t.id,
                title: can('assinantes') ? subscriberLink(t) : t.subscriber,
                badge: statusBadge(t.statusId),
                fields: fieldsFor([
                  { label: 'Protocolo', value: protocolLink(t) },
                  { label: 'Solicitante', value: t.requester },
                  { label: 'Responsável', value: t.responsible ?? 'Sem responsável' },
                  { label: 'Unidade', value: t.unit },
                  { label: 'Equipamento', value: t.equipment },
                  { label: 'Prioridade', value: levelBadge(prio(t.priorityId)) },
                  { label: 'Criticidade', value: levelBadge(crit(t.criticalityId)) },
                  { label: 'Aberto há', value: t.openedAgo },
                  { label: 'Última atualização', value: `há ${t.updatedAgo}` },
                ]),
              }))}
            />
          ) : (
            <Table<Row>
              onRowClick={(r) => setSelected(r as Ticket)}
              title="Chamados em aberto"
              subtitle="Solicitações e ordens de serviço ainda não resolvidas, de todos os assinantes"
              toolbar={toolbar}
              columns={shownColumns}
              rows={rows}
              empty={empty}
              pagination={{ page, pageSize: PAGE_SIZE, total: visible.length, onPageChange: setPage }}
            />
          )}
        </DevNote>
        </div>
      </Stack>
      </div>
      {blocked && (
        <SessionConflictModal
          device="Chrome · Windows" since={formatDateTime(new Date(Date.now() - 3 * 3_600_000).toISOString())}
          onContinueHere={() => setSessionChoice('here')}
        />
      )}

      {selected && (() => {
        const r = toRow(selected);
        return (
          <Dialog
            open onClose={() => setSelected(null)} size="md"
            title={`Chamado ${r.id}`} subtitle={`${r.kind} · ${r.subscriber}`}
            actions={(
              <>
                {can('assinantes') && <Button size="sm" onClick={() => { window.location.href = `assinante.html?id=${r.subscriberId}`; }}>Ver perfil do assinante</Button>}
              </>
            )}
          >
            <DevNote note="Ficha resumida do chamado (protocolo): o operador vê o que originou o alerta sem abrir o perfil da empresa. Assinante leva ao perfil do assinante; unidade, solicitante, situação, criticidade e última atualização vêm do chamado. O chamado em si é tratado na Área do assinante; o Admin só acompanha (RF101).">
              <Grid>
                <Col span={6} mobileFull><ReadField label="Assinante" value={can('assinantes') ? subscriberLink(r) : r.subscriber} /></Col>
                <Col span={6} mobileFull><ReadField label="Unidade" value={r.unit} /></Col>
                <Col span={6} mobileFull><ReadField label="Solicitante" value={r.requester} /></Col>
                <Col span={6} mobileFull><ReadField label="Responsável" value={r.responsible ?? 'Sem responsável'} /></Col>
                <Col span={6} mobileFull><ReadField label="Situação" value={statusBadge(r.statusId)} /></Col>
                <Col span={6} mobileFull><ReadField label="Criticidade" value={levelBadge(crit(r.criticalityId))} /></Col>
                <Col span={6} mobileFull><ReadField label="Prioridade" value={levelBadge(prio(r.priorityId))} /></Col>
                <Col span={6} mobileFull><ReadField label="Equipamento" value={r.equipment} /></Col>
                <Col span={6} mobileFull><ReadField label="Aberto há" value={r.openedAgo} /></Col>
                <Col span={6} mobileFull><ReadField label="Última atualização" value={`${formatDateTime(new Date(Date.now() - r.updatedHoursAgo * 3_600_000).toISOString())} (há ${r.updatedAgo})`} /></Col>
              </Grid>
            </DevNote>
          </Dialog>
        );
      })()}
    </AppLayout>
  );
}

mountApp(<DashboardScreen />);
