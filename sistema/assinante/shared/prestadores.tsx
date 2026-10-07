import { useEffect, useMemo, useState } from 'react';
import { IconCircleCheck, IconCircleOff, IconClipboardList, IconEye, IconPencil, IconPlus, IconTools, IconTruck } from '@tabler/icons-react';
import { IconSearch } from '@tabler/icons-react';
import { Button, Card, EmptyState, Input, KpiCard, Stack, TableColumn, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { formatDate, formatNumber, formatPhone, noBreak, normalize } from '../../admin/shared/format';
import { useHashState } from '../../admin/shared/useHashState';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { Provider, SPECIALTIES, WorkOrder } from './data';
import { ResponsiveTable } from './ListKit';
import { FilterControl } from '../../admin/shared/FilterControl';
import { useColumnPrefs } from '../../admin/shared/ColumnsControl';
import { lastOrder, mainContact, orderCompletedAt, providerName, providerOrders, withinDays } from './prestadores';
import { ProviderStatusDialog } from './ProviderStatusDialog';
import { useSubSession } from './store';
import { CellPair, Col, Grid, RowAction, RowActions, TableToolbar, goTo, recordStatusBadge, takeFlash, useRefs } from './ui';

/** Estados: idle · noresults (busca sem resultados) · inactivate / activate (RF701 - confirmação) · empty (sem prestadores) */
const STATES = ['idle', 'noresults', 'inactivate', 'activate', 'empty'] as const;
type Mode = (typeof STATES)[number];

const STATUS_OPTIONS = [{ value: 'todos', label: 'Todos os status' }, { value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }];

type Row = Record<string, unknown> & { id: string; provider: Provider; orders: WorkOrder[]; last?: WorkOrder; categories: string };

function PrestadoresScreen() {
  const toast = useToast();
  const refs = useRefs();
  const { db, can, unitIds } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('todos');
  const [specialty, setSpecialty] = useState('todos');
  const [category, setCategory] = useState('todos');
  const [region, setRegion] = useState('todos');
  const [toggling, setToggling] = useState<Provider | null>(null);

  const providers = mode === 'empty' ? [] : db.providers;

  useEffect(() => {
    if (mode === 'noresults') setQuery('Climatização Ártico');
    if (mode === 'inactivate') setToggling(providers.find((p) => p.status === 'ativo') ?? null);
    if (mode === 'activate') setToggling(providers.find((p) => p.status === 'inativo') ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isOpen = (o: WorkOrder) => ['aberto', 'andamento', 'aguardando'].includes(refs.base(o.statusId) ?? '');
  const rows: Row[] = useMemo(() => providers.map((p) => {
    const orders = providerOrders(db, p.id, unitIds);
    return { id: p.id, provider: p, orders, last: lastOrder(orders), categories: p.categoryIds.map((c) => refs.category(c)?.name ?? c).join(', ') };
  }), [db, providers, unitIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpis = useMemo(() => {
    const all = rows.flatMap((r) => r.orders);
    return {
      active: rows.filter((r) => r.provider.status === 'ativo').length,
      busy: rows.filter((r) => r.orders.some(isOpen)).length,
      done30: all.filter((o) => refs.base(o.statusId) === 'concluido' && withinDays(orderCompletedAt(db, o), 30)).length,
    };
  }, [rows, db]); // eslint-disable-line react-hooks/exhaustive-deps

  const regions = [...new Set(providers.flatMap((p) => p.regions))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const filtered = rows.filter((r) => {
    const p = r.provider; const q = normalize(query);
    return (status === 'todos' || p.status === status)
      && (specialty === 'todos' || p.specialties.includes(specialty))
      && (category === 'todos' || p.categoryIds.includes(category))
      && (region === 'todos' || p.regions.includes(region))
      && (!q || normalize(`${p.name} ${p.tradeName ?? ''} ${p.specialties.join(' ')} ${p.regions.join(' ')}`).includes(q));
  });

  const actions = (r: Row) => {
    const p = r.provider; const activate = p.status === 'inativo'; const name = providerName(p);
    return (
      <RowActions>
        <RowAction icon={<IconEye size={16} />} label="Visualizar prestador" target={name} onClick={() => goTo(`prestador.html?id=${p.id}`)} />
        {can('prestadores', 'editar') && <RowAction icon={<IconPencil size={16} />} label="Editar prestador" target={name} onClick={() => goTo(`prestador-form.html?id=${p.id}`)} />}
        {can('prestadores', 'ativar') && (
          <RowAction icon={activate ? <IconCircleCheck size={16} /> : <IconCircleOff size={16} />} label={activate ? 'Ativar prestador' : 'Inativar prestador'} target={name} onClick={() => setToggling(p)} />
        )}
      </RowActions>
    );
  };
  const phoneOf = (p: Provider) => { const c = mainContact(p); return c ? noBreak(formatPhone(c.phone)) : '-'; };
  const regionText = (p: Provider) => (p.regions.length > 1 ? `${p.regions[0]} +${p.regions.length - 1}` : p.regions[0] ?? '-');
  const lastCell = (r: Row) => (r.last ? <CellPair primary={<a className="text-link" href={`os.html?id=${r.last.id}`}>{r.last.id}</a>} secondary={formatDate(r.last.createdAt)} /> : '-');

  const columns: TableColumn<Row>[] = [
    { key: 'name', label: 'Prestador', render: (_, r) => <CellPair primary={<a className="text-link" href={`prestador.html?id=${r.provider.id}`}>{providerName(r.provider)}</a>} secondary={phoneOf(r.provider)} /> },
    { key: 'specialties', label: 'Especialidades / categorias', render: (_, r) => <CellPair primary={r.provider.specialties.join(', ')} secondary={r.categories} /> },
    { key: 'region', label: 'Cidade/UF', render: (_, r) => regionText(r.provider) },
    { key: 'status', label: 'Status', render: (_, r) => recordStatusBadge(r.provider.status) },
    { key: 'last', label: 'Última OS', render: (_, r) => lastCell(r) },
    { key: 'actions', label: 'Ações', sticky: 'right', render: (_, r) => actions(r) },
  ];

  const { columns: shownColumns, control, fieldsFor } = useColumnPrefs('sub-prestadores', columns, { mobileFixed: ['name', 'status'] });
  const toolbar = (
    <TableToolbar
      search={<Input type="search" aria-label="Buscar prestador por nome, especialidade ou cidade" placeholder="Buscar por nome, especialidade ou cidade" iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)} />}
      filters={(
        <FilterControl
          note="RF701 filtros: especialidade, categoria, cidade/UF e status, combinados com a busca (CTA001). Categorias são as do Admin (RF402)."
          filters={[
            { id: 'specialty', label: 'Especialidade', options: [{ value: 'todos', label: 'Todas as especialidades' }, ...SPECIALTIES.map((s) => ({ value: s, label: s }))], value: specialty, onChange: setSpecialty },
            { id: 'category', label: 'Categoria', options: [{ value: 'todos', label: 'Todas as categorias' }, ...refs.admin.categories.filter((c) => c.status === 'ativo').map((c) => ({ value: c.id, label: c.name }))], value: category, onChange: setCategory },
            { id: 'region', label: 'Cidade/UF', options: [{ value: 'todos', label: 'Todas as cidades' }, ...regions.map((r) => ({ value: r, label: r }))], value: region, onChange: setRegion },
            { id: 'status', label: 'Status', options: STATUS_OPTIONS, value: status, onChange: setStatus },
          ]}
        />
      )}
      columns={control}
    />
  );

  return (
    <AppLayout active="prestadores" screen="prestadores">
      <Stack gap="xl">
        <PageHeader
          title="Prestadores"
          subtitle="Gerencie os prestadores de serviço e os técnicos que atendem seus equipamentos"
          actions={can('prestadores', 'cadastrar') && (
            <DevNote note="Abre o cadastro (RF702). Visível só para perfis com permissão “Cadastrar” em Prestadores. O botão não deve ser exibido para usuários sem a permissão “Cadastrar” em Prestadores.">
              <Button iconLeft={<IconPlus size={20} />} onClick={() => goTo('prestador-form.html')}>Novo prestador</Button>
            </DevNote>
          )}
        />

        <Grid>
          <Col span={4} fill>
            <DevNote note="Prestadores com status Ativo. Só os ativos são ofertados em novas OS e planos (RF701-RGN001).">
              <KpiCard label="Prestadores ativos" value={formatNumber(kpis.active)} description={`${formatNumber(rows.length)} cadastrados`} icon={<IconTruck size={20} />} />
            </DevNote>
          </Col>
          <Col span={4} fill>
            <DevNote note="Prestadores com ao menos uma OS em aberto, em andamento ou aguardando (situação-base do status da OS).">
              <KpiCard label="Com serviços em andamento" value={formatNumber(kpis.busy)} description="Com OS aberta atribuída" icon={<IconTools size={20} />} />
            </DevNote>
          </Col>
          <Col span={4} mobileFull fill>
            <DevNote note="OS atribuídas a prestadores e concluídas nos últimos 30 dias (data da validação/conclusão).">
              <KpiCard label="OS concluídas · 30 dias" value={formatNumber(kpis.done30)} description="Concluídas por prestadores" icon={<IconClipboardList size={20} />} />
            </DevNote>
          </Col>
        </Grid>

        {providers.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconTruck size={32} />} title="Nenhum prestador cadastrado"
              description={can('prestadores', 'cadastrar') ? 'Cadastre o primeiro prestador para atribuí-lo a OS e planos.' : 'Quando houver prestadores, eles aparecem aqui.'} headingLevel={2}
              action={can('prestadores', 'cadastrar') ? <Button iconLeft={<IconPlus size={20} />} onClick={() => goTo('prestador-form.html')}>Novo prestador</Button> : undefined}
            />
          </Card>
        ) : (
          <DevNote note="RF701: listagem paginada (10) com busca (nome, especialidade, cidade) e filtros. Sem ranking nem avaliação de prestadores (RGN002, fora do MVP). Cidade/UF mostra a primeira região + “+N”. Última OS = a mais recente atribuída ao prestador. No mobile vira lista de cards.">
            <ResponsiveTable<Row>
              id="providers-title" title="Lista de prestadores" titleHidden toolbar={toolbar} columns={shownColumns} rows={filtered} resetKey={`${query}|${status}|${specialty}|${category}|${region}`}
              emptyTitle="Nenhum prestador encontrado" emptyDescription="Revise a busca ou os filtros."
              card={(r) => ({
                id: r.id, title: providerName(r.provider), subtitle: phoneOf(r.provider) === '-' ? undefined : formatPhone(mainContact(r.provider).phone), badge: recordStatusBadge(r.provider.status),
                fields: fieldsFor([
                  { label: 'Especialidades / categorias', value: [r.provider.specialties.join(', '), r.categories].filter(Boolean).join(' · ') },
                  { label: 'Cidade/UF', value: regionText(r.provider) }, { label: 'Última OS', value: r.last ? <a className="text-link" href={`os.html?id=${r.last.id}`}>{r.last.id}</a> : '-' },
                ]),
                actions: actions(r),
              })}
            />
          </DevNote>
        )}
      </Stack>
      <ProviderStatusDialog provider={toggling} onClose={() => setToggling(null)} />
    </AppLayout>
  );
}

mountApp(<PrestadoresScreen />);
