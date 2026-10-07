import { ReactElement, useEffect, useMemo, useState } from 'react';
import { IconCircleCheck, IconCircleOff, IconEye, IconPencil, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { Button, Dropdown, Input, Stack, Table, TableColumn, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useColumnPrefs } from '../../admin/shared/ColumnsControl';
import { MobileCardList } from '../../admin/shared/MobileCardList';
import { useHashState } from '../../admin/shared/useHashState';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { normalize } from '../../admin/shared/format';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { Unit } from './data';
import { nextSeq, userName, useSubSession } from './store';
import { cityUf, unitLinks } from './estrutura-utils';
import { RowMenu, RowMenuItem } from './RowMenu';
import { UnitDialogs, demoDeletableUnit } from './unidade-dialogs';
import { CellPair, RowAction, RowActions, TableToolbar, goTo, recordStatusBadge, takeFlash } from './ui';

/** Estados: idle · noresults · deactivate (confirmar inativação) · deleteblocked (excluir com vínculos) · delete (excluir sem vínculos) · menu (menu ⋮ aberto na 1ª linha) */
const STATES = ['idle', 'noresults', 'deactivate', 'deleteblocked', 'delete', 'menu'] as const;
type Mode = (typeof STATES)[number];
const PAGE_SIZE = 10;

type Row = Record<string, unknown> & { id: string; name: string; code: string; city: string; manager: string; environments: number; equipments: number; status: Unit['status']; unit: Unit };

function UnidadesScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const { db, can, unitIds, company } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('todos');
  const [page, setPage] = useState(1);
  const [toggling, setToggling] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState<Unit | null>(null);

  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), [query, status]);
  useEffect(() => {
    if (mode === 'noresults') setQuery('Pinheiros');
    if (mode === 'deactivate') setToggling(db.units.find((u) => u.status === 'ativo') ?? null);
    if (mode === 'deleteblocked') setDeleting(db.units.find((u) => unitLinks(db, u.id).total > 0) ?? null);
    if (mode === 'delete') setDeleting(demoDeletableUnit(db, company.tradeName, nextSeq('UNI', db.units.map((u) => u.id), 3)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const visible = db.units.filter((u) => unitIds.includes(u.id));
  const filtered = useMemo(() => {
    const t = normalize(query);
    return visible
      .filter((u) => (status === 'todos' || u.status === status) && (!t || normalize(`${u.name} ${u.code} ${u.city}`).includes(t)))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [visible, query, status]);
  const rows: Row[] = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((u) => {
    const l = unitLinks(db, u.id);
    return { id: u.id, name: u.name, code: u.code, city: cityUf(u), manager: userName(db, u.managerId), environments: l.environments, equipments: l.equipments, status: u.status, unit: u };
  });

  /** Visualizar + menu ⋮ (Editar, Ativar/Inativar, Excluir - só as permitidas ao perfil). */
  const actions = (r: Row) => {
    const u = r.unit;
    const items: RowMenuItem[] = [];
    if (can('unidades', 'editar')) items.push({ label: 'Editar', icon: <IconPencil size={16} />, onClick: () => goTo(`unidade-form.html?id=${u.id}`) });
    if (can('unidades', 'ativar')) {
      items.push(u.status === 'ativo'
        ? { label: 'Inativar', icon: <IconCircleOff size={16} />, onClick: () => setToggling(u) }
        : { label: 'Ativar', icon: <IconCircleCheck size={16} />, onClick: () => setToggling(u) });
    }
    if (can('unidades', 'excluir')) items.push({ label: 'Excluir', icon: <IconTrash size={16} />, danger: true, onClick: () => setDeleting(u) });
    return (
      <RowActions>
        <RowAction icon={<IconEye size={16} />} label="Visualizar unidade" target={u.name} onClick={() => goTo(`unidade.html?id=${u.id}`)} />
        {/* Mobile: os cards têm espaço, então todas as ações aparecem como ícones (sem o menu ⋮) */}
        {isMobile && items.map((it) => <RowAction key={it.label} icon={it.icon as ReactElement} label={`${it.label} unidade`} target={u.name} onClick={it.onClick} />)}
        {!isMobile && <RowMenu target={u.name} items={items} defaultOpen={mode === 'menu' && r.id === rows[0]?.id} />}
      </RowActions>
    );
  };

  const columns: TableColumn<Row>[] = [
    { key: 'name', label: 'Unidade', render: (v, r) => (r.code ? <CellPair primary={String(v)} secondary={`Código ${r.code}`} /> : String(v)) },
    { key: 'city', label: 'Cidade / UF' },
    { key: 'manager', label: 'Responsável' },
    { key: 'environments', label: 'Ambientes', align: 'right' },
    { key: 'equipments', label: 'Equipamentos', align: 'right' },
    { key: 'status', label: 'Status', render: (v) => recordStatusBadge(v as Unit['status']) },
    { key: 'id', label: 'Ações', sticky: 'right', render: (_, r) => actions(r) },
  ];

  const { columns: shownColumns, control, fieldsFor } = useColumnPrefs('sub-unidades', columns, { mobileFixed: ['name', 'status'] });
  const toolbar = (
    <TableToolbar
      search={<Input type="search" aria-label="Buscar unidade por nome, código ou cidade" placeholder="Buscar por nome, código ou cidade" iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)} />}
      status={<Dropdown aria-label="Filtrar por status" options={[{ value: 'todos', label: 'Todos os status' }, { value: 'ativo', label: 'Ativa' }, { value: 'inativo', label: 'Inativa' }]} value={status} onChange={setStatus} />}
      columns={control}
    />
  );
  const empty = { title: 'Nenhuma unidade encontrada', description: 'Revise a busca ou o filtro de status' };

  return (
    <AppLayout active="unidades" screen="unidades">
      <Stack gap="xl">
        <PageHeader
          title="Unidades"
          subtitle="Gerencie as unidades da sua empresa"
          actions={can('unidades', 'cadastrar') && (
            <DevNote note="Abre o cadastro de unidade (RF202-FLU003). O botão não deve ser exibido para usuários sem a permissão “Cadastrar” em Unidades.">
              <Button iconLeft={<IconPlus size={20} />} onClick={() => goTo('unidade-form.html')}>Nova unidade</Button>
            </DevNote>
          )}
        />

        <DevNote note="RF202-FLU002/FLU003: listagem com busca e filtro de status, paginada (10). Colunas da spec: nome, cidade/UF, responsável, qtde. de ambientes, qtde. de equipamentos e status. Ações por linha: Visualizar e o menu ⋮ (Editar, Ativar/Inativar com confirmação e Excluir), só as permitidas ao perfil. Exibição (colunas personalizáveis) é a FE011, incluída a pedido para avaliação. 💡 RGN004: limite de unidades por plano a confirmar (P01/FE012).">
          {isMobile ? (
            <MobileCardList
              headingId="units-title" title="Lista de unidades" titleHidden toolbar={toolbar} emptyTitle={empty.title}
              page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage}
              items={rows.map((r) => ({
                id: r.id, title: r.name, subtitle: r.code ? `Código ${r.code}` : undefined, badge: recordStatusBadge(r.status),
                fields: fieldsFor([
                  { label: 'Cidade / UF', value: r.city }, { label: 'Responsável', value: r.manager },
                  { label: 'Ambientes', value: r.environments }, { label: 'Equipamentos', value: r.equipments },
                ]),
                actions: actions(r),
              }))}
            />
          ) : (
            <Table<Row>
              caption="Lista de unidades" toolbar={toolbar} columns={shownColumns} rows={rows} empty={empty}
              pagination={{ page, pageSize: PAGE_SIZE, total: filtered.length, onPageChange: setPage }}
            />
          )}
        </DevNote>
      </Stack>

      <UnitDialogs toggling={toggling} deleting={deleting} setToggling={setToggling} setDeleting={setDeleting} />
    </AppLayout>
  );
}

mountApp(<UnidadesScreen />);
