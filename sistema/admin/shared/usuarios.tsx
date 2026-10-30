import { RowMenu, RowMenuItem } from './RowMenu';
import { useEffect, useMemo, useState } from 'react';
import { IconCircleCheck, IconCircleOff, IconEye, IconMail, IconMailForward, IconPencil, IconPlus, IconSearch, IconUserCheck, IconUserOff, IconUsers } from '@tabler/icons-react';
import { Badge, Button, Input, KpiCard, Stack, Table, TableColumn, useToast } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { MobileCardList } from './MobileCardList';
import { UserStatusDialog } from './UserStatusDialog';
import { useColumnPrefs } from './ColumnsControl';
import { useHashState } from './useHashState';
import { useIsMobile } from './useMediaQuery';
import { resendAdminInvite, useSession } from './store';
import { ADMIN_USER_STATUS, AdminUser, AdminUserStatus } from './data';
import { formatDate, maskPhone, noBreak } from './format';
import { maskEmail } from './recovery';
import { FilterControl } from './FilterControl';
import { CellPair, Col, Grid, RowAction, RowActions, TableToolbar, adminUserStatusBadge, goTo, takeFlash } from './ui';

/** Estados: idle · noresults · deactivate (confirmação de inativação) · pending (filtro Convite pendente) */
const STATES = ['idle', 'noresults', 'deactivate', 'columns', 'pending'] as const;
type Mode = (typeof STATES)[number];
const PAGE_SIZE = 10;

type Row = Record<string, unknown> & AdminUser & { profile: string };

/** Entrada (quem já acessou) ou convite (quem ainda não): data + o que ela representa. */
const entryOf = (u: AdminUser) => (u.status === 'convite'
  ? { date: u.invitedAt ? formatDate(u.invitedAt) : '-', label: 'Convite enviado' }
  : { date: u.joinedAt ? formatDate(u.joinedAt) : '-', label: 'Data de entrada' });
const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os status' },
  ...(Object.keys(ADMIN_USER_STATUS) as AdminUserStatus[]).map((k) => ({ value: k, label: ADMIN_USER_STATUS[k].label })),
];

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
    if (mode === 'pending') setStatus('convite');
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

  // Totais do painel: "cadastrado" = todos os registros (inclui convites pendentes e inativos); "ativo" = quem tem acesso hoje
  const kpis = useMemo(() => ({
    registered: db.adminUsers.length,
    active: db.adminUsers.filter((u) => u.status === 'ativo').length,
    pending: db.adminUsers.filter((u) => u.status === 'convite').length,
    inactive: db.adminUsers.filter((u) => u.status === 'inativo').length,
  }), [db]);

  const resend = (u: AdminUser) => {
    resendAdminInvite(me.id, u);
    toast.show({ type: 'success', title: 'Convite reenviado', message: `Enviamos um novo convite para ${u.email}` });
  };

  const actions = (u: AdminUser) => {
    const self = u.id === me.id;
    const activate = u.status === 'inativo';
    const items: RowMenuItem[] = [];
    if (can('usuarios', 'editar')) items.push({ label: 'Editar', icon: <IconPencil size={16} />, onClick: () => goTo(`usuario-form.html?id=${u.id}`) });
    if (can('usuarios', 'cadastrar') && u.status === 'convite') items.push({ label: 'Reenviar convite', icon: <IconMailForward size={16} />, onClick: () => resend(u) });
    if (can('usuarios', 'ativar') && u.status !== 'convite') items.push({ label: activate ? 'Ativar usuário' : 'Inativar usuário', icon: activate ? <IconCircleCheck size={16} /> : <IconCircleOff size={16} />, disabledReason: self ? 'Você não pode inativar o seu próprio usuário' : undefined, onClick: () => setToggling(u) });
    return (
      <RowActions>
        <RowAction icon={<IconEye size={16} />} label="Visualizar usuário" target={u.name} onClick={() => goTo(`usuario.html?id=${u.id}`)} />
        <RowMenu target={u.name} label="Mais ações do usuário" items={items} />
      </RowActions>
    );
  };

  const columns: TableColumn<Row>[] = [
    { key: 'name', label: 'Nome', render: (v, r) => (r.id === me.id ? <Stack direction="horizontal" gap="xs" align="center"><span>{String(v)}</span><Badge status="neutral">Você</Badge></Stack> : String(v)) },
    { key: 'email', label: 'E-mail', render: (v) => <span className="masked">{maskEmail(String(v))}</span> },
    { key: 'phone', label: 'Telefone', render: (v) => <span className="masked">{noBreak(maskPhone(String(v)))}</span> },
    { key: 'profile', label: 'Perfil de acesso' },
    { key: 'status', label: 'Estado de acesso', render: (v) => adminUserStatusBadge(v as AdminUserStatus) },
    { key: 'joinedAt', label: 'Entrada / convite', render: (_, r) => { const e = entryOf(r); return <CellPair primary={noBreak(e.date)} secondary={e.label} />; } },
    { key: 'id', label: 'Ações', sticky: 'right', render: (_, r) => actions(r) },
  ];

  const { columns: shownColumns, control, openColumns, fieldsFor } = useColumnPrefs('usuarios', columns, { mobileFixed: ['email', 'status'] });
  const toolbarFor = (withColumns: boolean) => (
    <TableToolbar
      search={<Input type="search" aria-label="Buscar usuário por nome ou e-mail" placeholder="Buscar por nome ou e-mail" iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)} />}
      filters={(
        <FilterControl filters={[
          { id: 'status', label: 'Estado de acesso', options: STATUS_OPTIONS, value: status, onChange: setStatus },
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

        <Grid>
          <Col span={3} fill>
            <DevNote note="Total cadastrado: todos os usuários do Admin, de qualquer estado de acesso (convite pendente, ativo ou inativo). Não é o mesmo que Total ativo.">
              <KpiCard label="Total cadastrado" value={kpis.registered} description="Todos os estados de acesso" icon={<IconUsers size={20} />} />
            </DevNote>
          </Col>
          <Col span={3} fill>
            <DevNote note="Total ativo: só quem já concluiu o primeiro acesso e não foi inativado, ou seja, quem consegue entrar hoje. Convites pendentes e inativos ficam de fora.">
              <KpiCard label="Total ativo" value={kpis.active} description="Com acesso ao painel" icon={<IconUserCheck size={20} />} />
            </DevNote>
          </Col>
          <Col span={3} mobileFull fill>
            <DevNote note="Convites enviados e ainda não aceitos (primeiro acesso não concluído). Quem inativa um convite pendente o cancela.">
              <KpiCard label="Convites pendentes" value={kpis.pending} description="Aguardando primeiro acesso" icon={<IconMail size={20} />} />
            </DevNote>
          </Col>
          <Col span={3} mobileFull fill>
            <DevNote note="Usuários inativados: perderam o acesso, mas o histórico de ações é mantido.">
              <KpiCard label="Inativos" value={kpis.inactive} description="Sem acesso ao painel" icon={<IconUserOff size={20} />} />
            </DevNote>
          </Col>
        </Grid>

        <DevNote note="RF301: listagem paginada com busca por nome ou e-mail (CTA002). Estado de acesso: Convite pendente · Ativo · Inativo; a coluna Entrada / convite mostra a data de entrada (primeiro acesso concluído) ou a data do último envio do convite. Com convite pendente, Reenviar convite substitui Ativar/Inativar (não se inativa quem acabou de ser convidado); depois do primeiro acesso, Ativar/Inativar passa a valer. Reenviar convite é para quem pode cadastrar usuários. Ações: visualizar, editar (RF302), ativar/inativar com confirmação (RGN001). Ninguém inativa a si próprio (RGN002) - a ação aparece desabilitada na própria linha. Toda ação no Admin grava o usuário responsável (RGN004 / RNF011); a tela de histórico/feed por usuário é ZC004 (não prevista no contrato) e não entra.">
          {isMobile ? (
            <MobileCardList
              onItemClick={(i) => goTo(`usuario.html?id=${rows[i].id}`)}
              headingId="users-title" title="Lista de usuários" titleHidden toolbar={toolbarFor(true)} emptyTitle={empty.title}
              page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage}
              items={rows.map((u) => ({
                id: u.id, title: u.id === me.id ? <Stack direction="horizontal" gap="xs" align="center"><span>{u.name}</span><Badge status="neutral">Você</Badge></Stack> : u.name, subtitle: maskEmail(u.email), badge: adminUserStatusBadge(u.status),
                fields: fieldsFor([
                  { label: 'Telefone', value: <span className="masked">{maskPhone(u.phone)}</span> },
                  { label: 'Perfil de acesso', value: u.profile },
                  { label: 'Entrada / convite', value: `${entryOf(u).date} (${entryOf(u).label.toLowerCase()})` },
                ]),
                actions: actions(u),
              }))}
            />
          ) : (
            <Table<Row> onRowClick={(r) => goTo(`usuario.html?id=${r.id}`)}
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
