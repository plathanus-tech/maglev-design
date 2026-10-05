import { useEffect, useMemo, useState } from 'react';
import {
  IconCircleCheck, IconCircleOff, IconEye, IconMessageReport, IconPencil, IconPlus, IconReportMoney, IconSearch,
  IconUserCheck, IconUserExclamation,
} from '@tabler/icons-react';
import { Button, Dropdown, Input, KpiCard, KpiTrend, Stack, Table, TableColumn, useToast } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { EnvironmentDialog } from './EnvironmentDialog';
import { MobileCardList } from './MobileCardList';
import { useColumnPrefs } from './ColumnsControl';
import { useHashState } from './useHashState';
import { useIsMobile } from './useMediaQuery';
import { useSession } from './store';
import { KPI_HISTORY, Subscriber, activeUsersCount, subscriberName } from './data';
import { formatCnpj, formatDate, formatMoney, formatNumber, formatSince, noBreak, onlyDigits, tenureMonths } from './format';
import { CellPair, Col, Grid, RowAction, RowActions, TableToolbar, goTo, param, subscriberStatusBadge, takeFlash } from './ui';

/** Estados: idle · overdue (filtro Inadimplente) · noresults (busca sem resultados) · deactivate (RF204 pela listagem) */
const STATES = ['idle', 'overdue', 'noresults', 'deactivate', 'columns'] as const;
type Mode = (typeof STATES)[number];

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'inadimplente', label: 'Inadimplente' },
  { value: 'inativo', label: 'Inativo' },
];

const matches = (s: Subscriber, q: string) => {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const digits = onlyDigits(term);
  return s.legalName.toLowerCase().includes(term) || s.tradeName.toLowerCase().includes(term)
    || (digits.length >= 3 && s.cnpj.includes(digits));
};

/** Variação percentual no padrão do Dashboard (KpiCard.trend). */
function trendOf(now: number, before: number, upIs: KpiTrend['sentiment'], reference: string): KpiTrend {
  const diff = now - before;
  const direction = diff === 0 ? 'flat' : diff > 0 ? 'up' : 'down';
  const opposite = upIs === 'positive' ? 'negative' : upIs === 'negative' ? 'positive' : 'neutral';
  return {
    direction,
    percent: before ? Math.abs((diff / before) * 100) : 0,
    sentiment: direction === 'flat' ? 'neutral' : direction === 'up' ? upIs : opposite,
    reference,
  };
}
const VS_WEEK = 'vs. há 7 dias';

type Row = Record<string, unknown> & Subscriber & { activeUsers: number };

function AssinantesScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const { db, can } = useSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(() => { const p = param('status'); return STATUS_OPTIONS.some((o) => o.value === p) ? (p as string) : 'todos'; });
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [toggling, setToggling] = useState<Subscriber | null>(null);

  useEffect(() => {
    if (mode === 'noresults') setQuery('Padaria Central');
    if (mode === 'overdue') setStatus('inadimplente');
    if (mode === 'columns') openColumns();
    if (mode === 'deactivate') setToggling(db.subscribers.find((s) => s.status === 'ativo') ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), [query, status, sortDir]);

  const kpis = useMemo(() => {
    const active = db.subscribers.filter((s) => s.status === 'ativo').length;
    const overdue = db.subscribers.filter((s) => s.status === 'inadimplente').length;
    const spent = db.subscribers.reduce((n, s) => n + s.maintenanceCents, 0);
    return {
      active,
      overdue,
      spent,
      activeTrend: trendOf(active, KPI_HISTORY.activeWeekAgo, 'positive', VS_WEEK),
      overdueTrend: trendOf(overdue, KPI_HISTORY.overdueWeekAgo, 'negative', VS_WEEK),
      spentTrend: trendOf(spent, spent - KPI_HISTORY.spent7dCents, 'neutral', VS_WEEK),
      ranking: [...db.subscribers].filter((s) => s.status !== 'inativo').sort((a, b) => b.requests30d - a.requests30d).slice(0, 3)
        .map((s) => ({ label: subscriberName(s), value: s.requests30d })),
    };
  }, [db]);

  const filtered = useMemo(() => db.subscribers
    .filter((s) => (status === 'todos' || s.status === status) && matches(s, query))
    .sort((a, b) => subscriberName(a).localeCompare(subscriberName(b), 'pt-BR') * (sortDir === 'asc' ? 1 : -1)), [db, query, status, sortDir]);
  const pageRows: Row[] = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((s) => ({ ...s, activeUsers: activeUsersCount(s) }));

  const actions = (s: Subscriber) => {
    const name = subscriberName(s);
    const activate = s.status === 'inativo';
    return (
      <RowActions>
        <RowAction icon={<IconEye size={16} />} label="Visualizar assinante" target={name} onClick={() => goTo(`assinante.html?id=${s.id}`)} />
        {can('assinantes', 'editar') && <RowAction icon={<IconPencil size={16} />} label="Editar assinante" target={name} onClick={() => goTo(`assinante-form.html?id=${s.id}`)} />}
        {can('assinantes', 'ativar') && (
          <RowAction
            icon={activate ? <IconCircleCheck size={16} /> : <IconCircleOff size={16} />}
            label={activate ? 'Ativar ambiente' : 'Inativar ambiente'} target={name}
            onClick={() => setToggling(s)}
          />
        )}
      </RowActions>
    );
  };

  const columns: TableColumn<Row>[] = [
    {
      key: 'tradeName', label: 'Nome fantasia / Razão social', sortable: true,
      render: (_, r) => <CellPair primary={r.tradeName} secondary={r.legalName} />,
    },
    { key: 'cnpj', label: 'CNPJ', render: (v) => noBreak(formatCnpj(String(v))) },
    { key: 'status', label: 'Status', render: (v) => subscriberStatusBadge(v as Subscriber['status']) },
    {
      key: 'since', label: 'Cliente desde',
      render: (v) => <CellPair primary={formatDate(String(v))} secondary={tenureMonths(String(v))} />,
    },
    { key: 'units', label: 'Unidades', align: 'right' },
    { key: 'activeUsers', label: 'Usuários ativos', align: 'right' },
    { key: 'maintenanceCents', label: 'Gasto em manutenção', align: 'right', render: (v) => formatMoney(Number(v)) },
    { key: 'equipments', label: 'Equipamentos', align: 'right', render: (v) => formatNumber(Number(v)) },
    { key: 'plan', label: 'Plano / contratação' },
    { key: 'id', label: 'Ações', sticky: 'right', render: (_, r) => actions(r) },
  ];

  const { columns: shownColumns, control, openColumns, fieldsFor } = useColumnPrefs('assinantes', columns, { mobileFixed: ['status'] });
  const toolbarFor = (withColumns: boolean) => (
    <TableToolbar
      search={(
        <Input
          type="search"
          aria-label="Buscar assinante por nome fantasia, razão social ou CNPJ"
          placeholder="Buscar por nome ou CNPJ"
          iconLeft={<IconSearch size={20} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      status={(
        <DevNote note="Status do assinante: Ativo · Inadimplente · Inativo (RF201-RGN002), alterado manualmente - a cobrança é feita fora da plataforma.">
          <Dropdown aria-label="Filtrar por status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        </DevNote>
      )}
      columns={withColumns ? control : undefined}
    />
  );
  const empty = { title: 'Nenhum assinante encontrado', description: 'Revise a busca ou o filtro de status.' };

  return (
    <AppLayout active="assinantes" screen="assinantes">
      <Stack gap="xl">
        <PageHeader
          title="Assinantes"
          subtitle="Gerencie os assinantes da plataforma"
          actions={can('assinantes', 'cadastrar') && (
            <DevNote note="Abre o cadastro (RF202). O cadastro inicial é feito pela equipe de implantação Maglev (RGN006). Visível só para perfis com permissão “Cadastrar” em Assinantes (RF303).">
              <Button iconLeft={<IconPlus size={20} />} onClick={() => goTo('assinante-form.html')}>Novo assinante</Button>
            </DevNote>
          )}
        />

        <Grid>
          <Col span={3} fill>
            <DevNote note="Quantidade atual de assinantes com status Ativo, comparada com a de há 7 dias (dado de demonstração).">
              <KpiCard label="Clientes ativos" value={formatNumber(kpis.active)} trend={kpis.activeTrend} icon={<IconUserCheck size={20} />} />
            </DevNote>
          </Col>
          <Col span={3} fill>
            <DevNote note="Quantidade atual de assinantes com status Inadimplente (controle manual - RF202-RGN002), comparada com a de há 7 dias; aumento é negativo.">
              <KpiCard label="Inadimplentes" value={formatNumber(kpis.overdue)} trend={kpis.overdueTrend} icon={<IconUserExclamation size={20} />} />
            </DevNote>
          </Col>
          <Col span={3} mobileFull fill>
            <DevNote note="Soma dos custos realizados das ordens de serviço de todos os assinantes (RF201), comparada com o total de há 7 dias. Variação em cinza (neutra): gastar mais ou menos não é, por si só, bom ou ruim para a plataforma - confirmar. Pagamentos não passam pela plataforma.">
              <KpiCard label="Valor total gasto em manutenção" value={formatMoney(kpis.spent)} trend={kpis.spentTrend} icon={<IconReportMoney size={20} />} />
            </DevNote>
          </Col>
          <Col span={3} mobileFull fill>
            <DevNote note="RF201-RGN003: ranking por quantidade de solicitações abertas no período. 💡 Período a confirmar - aqui, últimos 30 dias. Top 3; nomes longos são truncados.">
              <KpiCard label="Clientes com mais solicitações · 30 dias" ranking={kpis.ranking} icon={<IconMessageReport size={20} />} />
            </DevNote>
          </Col>
        </Grid>

        <DevNote note="RF201: listagem paginada (10), ordenada por nome (clique no cabeçalho inverte - RGN001). Busca por nome fantasia, razão social ou CNPJ + filtro de status, combinados (CTA002). Usuários ativos = só quem tem conta (sem solicitantes anônimos via QR). Gasto = soma dos custos realizados das OS. Ações por linha conforme o perfil: visualizar (RF203), editar (RF202), ativar/inativar ambiente (RF204). Coluna “Estágio de implantação” é FE013 (fora do escopo). No mobile vira lista de cards.">
          {isMobile ? (
            <MobileCardList
              headingId="subscribers-title"
              title="Lista de assinantes"
              titleHidden
              toolbar={toolbarFor(true)}
              emptyTitle={empty.title}
              page={page}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPageChange={setPage}
              items={pageRows.map((s) => ({
                id: s.id,
                title: s.tradeName,
                subtitle: s.legalName,
                badge: subscriberStatusBadge(s.status),
                fields: fieldsFor([
                  { label: 'CNPJ', value: formatCnpj(s.cnpj) },
                  { label: 'Cliente desde', value: formatSince(s.since) },
                  { label: 'Unidades', value: s.units },
                  { label: 'Usuários ativos', value: s.activeUsers },
                  { label: 'Gasto em manutenção', value: formatMoney(s.maintenanceCents) },
                  { label: 'Equipamentos', value: formatNumber(s.equipments) },
                  { label: 'Plano / contratação', value: s.plan },
                ]),
                actions: actions(s),
              }))}
            />
          ) : (
            <Table<Row>
              caption="Lista de assinantes"
              toolbar={toolbarFor(true)}
              columns={shownColumns}
              rows={pageRows}
              sortKey="tradeName"
              sortDir={sortDir}
              onSort={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              empty={empty}
              pagination={{ page, pageSize: PAGE_SIZE, total: filtered.length, onPageChange: setPage }}
            />
          )}
        </DevNote>
      </Stack>
      <EnvironmentDialog subscriber={toggling} onClose={() => setToggling(null)} />
    </AppLayout>
  );
}

mountApp(<AssinantesScreen />);
