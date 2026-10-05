import { useEffect, useMemo, useState } from 'react';
import { IconCircleCheck, IconCircleOff, IconEye, IconPencil, IconPlus, IconSearch } from '@tabler/icons-react';
import { Badge, Button, Input, Stack, Table, TableColumn, useToast } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { MobileCardList } from './MobileCardList';
import { UserStatusDialog } from './UserStatusDialog';
import { useColumnPrefs } from './ColumnsControl';
import { useHashState } from './useHashState';
import { useIsMobile } from './useMediaQuery';
import { useSession } from './store';
import { AdminUser } from './data';
import { maskPhone, noBreak } from './format';
import { maskEmail } from './recovery';
import { FilterControl } from './FilterControl';
import { RowAction, RowActions, TableToolbar, goTo, recordStatusBadge, takeFlash } from './ui';

/** Estados: idle · noresults · deactivate (confirmação de inativação) */
const STATES = ['idle', 'noresults', 'deactivate', 'columns'] as const;
type Mode = (typeof STATES)[number];
const PAGE_SIZE = 10;

type Row = Record<string, unknown> & AdminUser & { profile: string };

function UsuariosScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const { db, user: me, can } = useSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('todos');
  const [profile, setProfile] = useState('todos');
  const [page, setPage] = useState(1);
  const [toggling, setToggling] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (mode === 'noresults') setQuery('joao.silva');
    if (mode === 'columns') openColumns();
    if (mode === 'deactivate') setToggling(db.adminUsers.find((u) => u.id !== me.id && u.status === 'ativo') ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), [query, status, profile]);

  const profileName = (id: string) => db.profiles.find((p) => p.id === id)?.name ?? '-';
  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    return db.adminUsers
      .filter((u) => (status === 'todos' || u.status === status) && (profile === 'todos' || u.profileId === profile) && (!t || u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [db, query, status, profile]);
  const rows: Row[] = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((u) => ({ ...u, profile: profileName(u.profileId) }));

  const actions = (u: AdminUser) => {
    const self = u.id === me.id;
    const activate = u.status === 'inativo';
    return (
      <RowActions>
        <RowAction icon={<IconEye size={16} />} label="Visualizar usuário" target={u.name} onClick={() => goTo(`usuario.html?id=${u.id}`)} />
        {can('usuarios', 'editar') && <RowAction icon={<IconPencil size={16} />} label="Editar usuário" target={u.name} onClick={() => goTo(`usuario-form.html?id=${u.id}`)} />}
        {can('usuarios', 'ativar') && (
          <RowAction
            icon={activate ? <IconCircleCheck size={16} /> : <IconCircleOff size={16} />}
            label={self ? 'Você não pode inativar o seu próprio usuário' : activate ? 'Ativar usuário' : 'Inativar usuário'}
            target={u.name}
            disabled={self}
            onClick={() => setToggling(u)}
          />
        )}
      </RowActions>
    );
  };

  const columns: TableColumn<Row>[] = [
    { key: 'name', label: 'Nome', render: (v, r) => (r.id === me.id ? <Stack direction="horizontal" gap="xs" align="center"><span>{String(v)}</span><Badge status="neutral">Você</Badge></Stack> : String(v)) },
    { key: 'email', label: 'E-mail', render: (v) => <span className="masked">{maskEmail(String(v))}</span> },
    { key: 'phone', label: 'Telefone', render: (v) => <span className="masked">{noBreak(maskPhone(String(v)))}</span> },
    { key: 'profile', label: 'Perfil de acesso' },
    { key: 'status', label: 'Status', render: (v) => recordStatusBadge(v as AdminUser['status']) },
    { key: 'id', label: 'Ações', sticky: 'right', render: (_, r) => actions(r) },
  ];

  const { columns: shownColumns, control, openColumns, fieldsFor } = useColumnPrefs('usuarios', columns, { mobileFixed: ['email', 'status'] });
  const toolbarFor = (withColumns: boolean) => (
    <TableToolbar
      search={<Input type="search" aria-label="Buscar usuário por nome ou e-mail" placeholder="Buscar por nome ou e-mail" iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)} />}
      filters={(
        <FilterControl filters={[
          { id: 'status', label: 'Status', options: [{ value: 'todos', label: 'Todos os status' }, { value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }], value: status, onChange: setStatus },
          { id: 'profile', label: 'Perfil de acesso', options: [{ value: 'todos', label: 'Todos os perfis' }, ...db.profiles.map((p) => ({ value: p.id, label: p.name }))], value: profile, onChange: setProfile },
        ]} />
      )}
      columns={withColumns ? control : undefined}
    />
  );
  const empty = { title: 'Nenhum usuário encontrado', description: 'Revise a busca ou os filtros aplicados.' };

  return (
    <AppLayout active="usuarios" screen="usuarios">
      <Stack gap="xl">
        <PageHeader
          title="Usuários"
          subtitle="Gerencie quem pode acessar o painel administrativo"
          actions={can('usuarios', 'cadastrar') && (
            <Button iconLeft={<IconPlus size={20} />} onClick={() => goTo('usuario-form.html')}>Novo usuário</Button>
          )}
        />

        <DevNote note="RF301: listagem paginada com busca por nome ou e-mail (CTA002). Ações: visualizar, editar (RF302), ativar/inativar com confirmação (RGN001). Ninguém inativa a si próprio (RGN002) - a ação aparece desabilitada na própria linha. Toda ação no Admin grava o usuário responsável (RGN004 / RNF011); a tela de histórico/feed por usuário é ZC004 (não prevista no contrato) e não entra.">
          {isMobile ? (
            <MobileCardList
              headingId="users-title" title="Lista de usuários" titleHidden toolbar={toolbarFor(true)} emptyTitle={empty.title}
              page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage}
              items={rows.map((u) => ({
                id: u.id, title: u.id === me.id ? <Stack direction="horizontal" gap="xs" align="center"><span>{u.name}</span><Badge status="neutral">Você</Badge></Stack> : u.name, subtitle: maskEmail(u.email), badge: recordStatusBadge(u.status),
                fields: fieldsFor([{ label: 'Telefone', value: <span className="masked">{maskPhone(u.phone)}</span> }, { label: 'Perfil de acesso', value: u.profile }]),
                actions: actions(u),
              }))}
            />
          ) : (
            <Table<Row>
              caption="Lista de usuários"
              toolbar={toolbarFor(true)}
              columns={shownColumns}
              rows={rows}
              empty={empty}
              pagination={{ page, pageSize: PAGE_SIZE, total: filtered.length, onPageChange: setPage }}
            />
          )}
        </DevNote>
      </Stack>
      <UserStatusDialog user={toggling} onClose={() => setToggling(null)} />
    </AppLayout>
  );
}

mountApp(<UsuariosScreen />);
