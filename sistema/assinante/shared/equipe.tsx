import { useEffect, useMemo, useState } from 'react';
import { IconCircleCheck, IconCircleOff, IconMailForward, IconPencil, IconPlus, IconSearch } from '@tabler/icons-react';
import { Badge, Button, Dialog, Feedback, Input, Stack, Table, TableColumn, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { FilterControl } from '../../admin/shared/FilterControl';
import { useColumnPrefs } from '../../admin/shared/ColumnsControl';
import { MobileCardList } from '../../admin/shared/MobileCardList';
import { useHashState } from '../../admin/shared/useHashState';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { formatDate, formatDateTime, normalize } from '../../admin/shared/format';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { PROFILE_LABEL, PROFILE_OPTIONS, SubUser, USER_STATUS, UserStatus, nowLocal } from './data';
import { unitName, updateSubDb, useSubSession } from './store';
import { CellPair, RowAction, RowActions, TableToolbar, Text, goTo, takeFlash } from './ui';

/** Estados: idle · noresults · deactivate (confirmar inativação) · activate · selfdeactivate (tentar inativar a si mesmo) */
const STATES = ['idle', 'noresults', 'deactivate', 'activate', 'selfdeactivate'] as const;
type Mode = (typeof STATES)[number];
const PAGE_SIZE = 10;

type Row = Record<string, unknown> & { id: string; name: string; email: string; profile: string; units: string; status: UserStatus; lastActivity: string; member: SubUser };

/** Unidades do membro: Administrador e Gestor veem todas (RF204-CTA002). */
const unitsText = (db: Parameters<typeof unitName>[0], u: SubUser) => {
  if (u.profile === 'administrador' || u.profile === 'gestor') return 'Todas as unidades';
  if (!u.unitIds.length) return '-';
  return u.unitIds.length <= 2 ? u.unitIds.map((id) => unitName(db, id)).join(', ') : `${u.unitIds.length} unidades`;
};
const activityText = (u: SubUser) => (u.status === 'convite' ? (u.invitedAt ? `Convite enviado em ${formatDate(u.invitedAt)}` : '-') : u.lastActivity ? formatDateTime(u.lastActivity) : '-');

function EquipeScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const { db, user: me, can } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState('todos');
  const [status, setStatus] = useState('todos');
  const [page, setPage] = useState(1);
  const [toggling, setToggling] = useState<SubUser | null>(null);
  const [selfBlock, setSelfBlock] = useState(false);

  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), [query, profile, status]);
  useEffect(() => {
    if (mode === 'noresults') setQuery('joao.silva');
    if (mode === 'deactivate') setToggling(db.users.find((u) => u.id !== me.id && u.status === 'ativo') ?? null);
    if (mode === 'activate') {
      // Variante: precisa de um membro inativo; se não houver, inativa um de demonstração antes
      let t = db.users.find((u) => u.id !== me.id && u.status === 'inativo');
      if (!t) {
        const base = db.users.find((u) => u.id !== me.id && u.status === 'ativo');
        if (base) { t = { ...base, status: 'inativo' }; const id = base.id; updateSubDb((d) => ({ ...d, users: d.users.map((u) => (u.id === id ? { ...u, status: 'inativo' } : u)) })); }
      }
      setToggling(t ?? null);
    }
    if (mode === 'selfdeactivate') setSelfBlock(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const filtered = useMemo(() => {
    const t = normalize(query);
    return db.users
      .filter((u) => (profile === 'todos' || u.profile === profile) && (status === 'todos' || u.status === status) && (!t || normalize(`${u.name} ${u.email}`).includes(t)))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [db.users, query, profile, status]);
  const rows: Row[] = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((u) => ({
    id: u.id, name: u.name, email: u.email, profile: PROFILE_LABEL[u.profile], units: unitsText(db, u), status: u.status, lastActivity: activityText(u), member: u,
  }));

  const resend = (u: SubUser) => {
    updateSubDb((d) => ({ ...d, users: d.users.map((x) => (x.id === u.id ? { ...x, invitedAt: nowLocal() } : x)) }));
    toast.show({ type: 'success', title: 'Convite reenviado', message: `Enviamos um novo convite para ${u.email}` });
  };
  const confirmToggle = () => {
    if (!toggling) return;
    const deactivate = toggling.status !== 'inativo';
    const id = toggling.id;
    updateSubDb((d) => ({ ...d, users: d.users.map((u) => (u.id === id ? { ...u, status: deactivate ? 'inativo' : 'ativo', invitedAt: deactivate ? u.invitedAt : undefined } : u)) }));
    toast.show(deactivate
      ? { type: 'success', title: 'Membro inativado', message: `${toggling.name} perdeu o acesso ao sistema` }
      : { type: 'success', title: 'Membro ativado', message: `${toggling.name} voltou a acessar com o perfil e as unidades atuais` });
    setToggling(null);
  };

  const actions = (r: Row) => {
    const u = r.member;
    const activate = u.status === 'inativo';
    return (
      <RowActions>
        {can('equipe', 'editar') && <RowAction icon={<IconPencil size={16} />} label="Editar membro" target={u.name} onClick={() => goTo(`membro-form.html?id=${u.id}`)} />}
        {can('equipe', 'editar') && u.status === 'convite' && <RowAction icon={<IconMailForward size={16} />} label="Reenviar convite" target={u.name} onClick={() => resend(u)} />}
        {can('equipe', 'ativar') && (
          <RowAction
            icon={activate ? <IconCircleCheck size={16} /> : <IconCircleOff size={16} />}
            label={activate ? 'Ativar membro' : 'Inativar membro'} target={u.name}
            onClick={() => (u.id === me.id ? setSelfBlock(true) : setToggling(u))}
          />
        )}
      </RowActions>
    );
  };
  const nameCell = (u: SubUser) => (u.id === me.id ? <Stack direction="horizontal" gap="xs" align="center"><span>{u.name}</span><Badge status="neutral">Você</Badge></Stack> : u.name);

  const columns: TableColumn<Row>[] = [
    { key: 'name', label: 'Nome', render: (_, r) => <CellPair primary={nameCell(r.member)} secondary={r.email} /> },
    { key: 'profile', label: 'Perfil' },
    { key: 'units', label: 'Unidades' },
    { key: 'status', label: 'Status', render: (v) => <Badge status={USER_STATUS[v as UserStatus].badge} dot>{USER_STATUS[v as UserStatus].label}</Badge> },
    { key: 'lastActivity', label: 'Última atividade' },
    { key: 'id', label: 'Ações', sticky: 'right', render: (_, r) => actions(r) },
  ];

  const { columns: shownColumns, control, fieldsFor } = useColumnPrefs('sub-equipe', columns, { mobileFixed: ['name', 'status'] });
  const toolbar = (
    <TableToolbar
      search={<Input type="search" aria-label="Buscar membro por nome ou e-mail" placeholder="Buscar por nome ou e-mail" iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)} />}
      filters={(
        <FilterControl filters={[
          { id: 'profile', label: 'Perfil', options: [{ value: 'todos', label: 'Todos os perfis' }, ...PROFILE_OPTIONS], value: profile, onChange: setProfile },
          { id: 'status', label: 'Status', options: [{ value: 'todos', label: 'Todos os status' }, ...(Object.keys(USER_STATUS) as UserStatus[]).map((k) => ({ value: k, label: USER_STATUS[k].label }))], value: status, onChange: setStatus },
        ]} />
      )}
      columns={control}
    />
  );
  const empty = { title: 'Nenhum membro encontrado', description: 'Revise a busca ou os filtros' };

  const deactivating = toggling ? toggling.status !== 'inativo' : false;

  return (
    <AppLayout active="equipe" screen="equipe">
      <Stack gap="xl">
        <PageHeader
          title="Usuários"
          subtitle="Usuários com acesso à plataforma e seus respectivos perfis"
          actions={can('equipe', 'cadastrar') && (
            <DevNote note="RF204-FLU003/FLU004: o convite é enviado por e-mail (Assinante RF003) e o membro fica com status Convite pendente até ativar a conta. O botão não deve ser exibido para usuários sem a permissão “Cadastrar” em Usuários.">
              <Button iconLeft={<IconPlus size={20} />} onClick={() => goTo('membro-form.html')}>Convidar novo membro</Button>
            </DevNote>
          )}
        />

        <DevNote note="RF204-RGN002: apenas o perfil Administrador gerencia a equipe (o item some do menu para os demais). RGN001: perfis fixos no MVP. Colunas da spec: nome, perfil, unidade(s), status e última atividade. CTA003: usuário inativado perde o acesso imediatamente. Ninguém inativa a si próprio (decisão do protótipo, igual ao Admin).">
          {isMobile ? (
            <MobileCardList
              headingId="team-title" title="Lista de membros" titleHidden toolbar={toolbar} emptyTitle={empty.title}
              page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage}
              items={rows.map((r) => ({
                id: r.id, title: nameCell(r.member), subtitle: r.email, badge: <Badge status={USER_STATUS[r.status].badge} dot>{USER_STATUS[r.status].label}</Badge>,
                fields: fieldsFor([{ label: 'Perfil', value: r.profile }, { label: 'Unidades', value: r.units }, { label: 'Última atividade', value: r.lastActivity }]),
                actions: actions(r),
              }))}
            />
          ) : (
            <Table<Row>
              caption="Lista de membros da equipe" toolbar={toolbar} columns={shownColumns} rows={rows} empty={empty}
              pagination={{ page, pageSize: PAGE_SIZE, total: filtered.length, onPageChange: setPage }}
            />
          )}
        </DevNote>
      </Stack>

      {toggling && (
        <Dialog
          open onClose={() => setToggling(null)} size="sm" className="dialog-confirm"
          title={deactivating ? `Inativar ${toggling.name}?` : `Ativar ${toggling.name}?`}
          subtitle={deactivating
            ? (toggling.status === 'convite'
              ? 'O convite será cancelado e a pessoa não conseguirá ativar a conta'
              : 'O membro perderá o acesso ao sistema imediatamente. O histórico de ações dele será mantido')
            : 'O membro poderá entrar novamente no sistema com o perfil e as unidades atuais'}
          actions={(
            <>
              <Button size="sm" variant="secondary" onClick={() => setToggling(null)}>Cancelar</Button>
              {deactivating
                ? <DevNote note="RF204-CTA003: o usuário inativado perde o acesso imediatamente (sessões encerradas). O histórico de solicitações, OS e execuções dele é mantido. Convite pendente inativado é cancelado."><Button size="sm" variant="destructive" onClick={confirmToggle}>Inativar membro</Button></DevNote>
                : <Button size="sm" onClick={confirmToggle}>Ativar membro</Button>}
            </>
          )}
        />
      )}

      {selfBlock && (
        <Dialog
          open onClose={() => setSelfBlock(false)} size="sm" title="Você não pode inativar o seu próprio usuário"
          actions={<Button size="sm" onClick={() => setSelfBlock(false)}>Entendi</Button>}
        >
          <DevNote note="Decisão do protótipo (igual ao Admin RF301-RGN002): ninguém inativa a si próprio, para a empresa nunca ficar sem administrador. Para sair, outro administrador precisa inativar a conta.">
            <Feedback type="warning" title="Ação bloqueada" message="Peça a outro administrador da empresa para inativar a sua conta, se for necessário" />
          </DevNote>
        </Dialog>
      )}
    </AppLayout>
  );
}

mountApp(<EquipeScreen />);
