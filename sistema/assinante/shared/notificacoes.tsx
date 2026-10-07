import { useEffect, useMemo, useState } from 'react';
import { IconChecks, IconExternalLink } from '@tabler/icons-react';
import { Badge, Button, Card, Checkbox, Dropdown, Feedback, Stack, Table, TableColumn, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useColumnPrefs } from '../../admin/shared/ColumnsControl';
import { MobileCardList } from '../../admin/shared/MobileCardList';
import { useHashState } from '../../admin/shared/useHashState';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { formatDateTime } from '../../admin/shared/format';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { Notification } from './data';
import { updateSubDb, useSubSession } from './store';
import { CellPair, RowAction, RowActions, TableToolbar, goTo } from './ui';

/** Estados (variantes do navegador): idle · empty (sem notificações) · unread (só não lidas) */
const STATES = ['idle', 'empty', 'unread'] as const;
type Mode = (typeof STATES)[number];
const PAGE_SIZE = 10;

const KIND_LABEL: Record<Notification['kind'], string> = {
  solicitacao: 'Solicitação', os: 'Ordem de serviço', preventiva: 'Preventiva', equipamento: 'Equipamento',
};
const readBadge = (read: boolean) => (read ? <Badge status="neutral" dot>Lida</Badge> : <Badge status="info" dot>Nova</Badge>);

type Row = Record<string, unknown> & Notification;

function NotificacoesScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const { db, user } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [filter, setFilter] = useState(mode === 'unread' ? 'unread' : 'all');
  const [page, setPage] = useState(1);

  useEffect(() => { setFilter(mode === 'unread' ? 'unread' : 'all'); }, [mode]);
  useEffect(() => setPage(1), [filter]);

  const mine = useMemo(
    () => (mode === 'empty' ? [] : db.notifications.filter((n) => n.userId === user.id).sort((a, b) => b.at.localeCompare(a.at))),
    [db.notifications, user.id, mode],
  );
  const unreadCount = mine.filter((n) => !n.read).length;
  const filtered = filter === 'unread' ? mine.filter((n) => !n.read) : mine;
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) as Row[];

  const markRead = (id: string) => updateSubDb((d) => ({ ...d, notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
  const open = (n: Notification) => { markRead(n.id); goTo(n.href); };
  const markAll = () => {
    updateSubDb((d) => ({ ...d, notifications: d.notifications.map((n) => (n.userId === user.id ? { ...n, read: true } : n)) }));
    toast.show({ type: 'success', title: 'Notificações atualizadas', message: 'Todas as notificações foram marcadas como lidas' });
  };

  const titleLink = (n: Notification) => (
    <a className="text-link" href={n.href} onClick={() => markRead(n.id)}>{n.title}</a>
  );
  const actions = (n: Notification) => (
    <RowActions><RowAction icon={<IconExternalLink size={16} />} label="Abrir item relacionado" target={n.title} onClick={() => open(n)} /></RowActions>
  );

  const columns: TableColumn<Row>[] = [
    { key: 'title', label: 'Notificação', render: (_, r) => <CellPair primary={titleLink(r)} secondary={r.text} /> },
    { key: 'kind', label: 'Tipo', render: (v) => KIND_LABEL[v as Notification['kind']] },
    { key: 'at', label: 'Data e hora', render: (v) => formatDateTime(String(v)) },
    { key: 'read', label: 'Situação', render: (v) => readBadge(Boolean(v)) },
    { key: 'id', label: 'Ações', sticky: 'right', render: (_, r) => actions(r) },
  ];

  const { columns: shownColumns, control, fieldsFor } = useColumnPrefs('sub-notificacoes', columns, { mobileFixed: ['title', 'read'] });
  const toolbar = (
    <TableToolbar
      status={<Dropdown aria-label="Filtrar notificações" options={[{ value: 'all', label: 'Todas' }, { value: 'unread', label: 'Não lidas' }]} value={filter} onChange={setFilter} />}
      columns={control}
    />
  );
  const empty = filter === 'unread' && mine.length > 0
    ? { title: 'Nenhuma notificação não lida', description: 'Você está em dia com as suas notificações.' }
    : { title: 'Você não tem notificações', description: 'Quando algo acontecer nos itens em que você está envolvido, o aviso aparece aqui.' };

  return (
    <AppLayout active="inicio" screen="inicio">
      <Stack gap="xl">
        <PageHeader
          title="Notificações"
          subtitle={unreadCount ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Acompanhe o que acontece nos itens em que você está envolvido'}
          actions={<Button variant="secondary" iconLeft={<IconChecks size={20} />} disabled={unreadCount === 0} onClick={markAll}>Marcar todas como lidas</Button>}
        />

        <DevNote note="RF801: notificações do usuário logado, mais recentes primeiro, paginadas (10). Clicar abre a tela relacionada e marca como lida (FLU005); o contador do sino atualiza (CTA002). Eventos e destinatários (RGN001: notifica só quem está ligado ao item): nova solicitação → responsáveis pela triagem da unidade · mudança de status de solicitação/OS → solicitante, responsável e executor/prestador · atribuição/reatribuição → a pessoa atribuída (CTA004) · pedido de complementação → solicitante · orçamento anexado → responsável e aprovadores · orçamento aprovado/reprovado → executor/prestador e responsável · OS aguardando validação → solicitante (ou quem recebeu a validação) · conclusão manual da solicitação → solicitante e responsáveis · preventiva gerada/próxima/vencida → executor e responsável do plano · 💡 garantia expirando e equipamento crítico parado → Administrador/Gestor, a confirmar. SMS fora do escopo (RGN004).">
          {isMobile ? (
            <MobileCardList
              headingId="notifications-title" title="Lista de notificações" titleHidden toolbar={toolbar} emptyTitle={empty.title}
              page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage}
              items={rows.map((n) => ({
                id: n.id, title: titleLink(n), subtitle: n.text, badge: readBadge(n.read),
                fields: fieldsFor([{ label: 'Tipo', value: KIND_LABEL[n.kind] }, { label: 'Data e hora', value: formatDateTime(n.at) }]),
                actions: actions(n),
              }))}
            />
          ) : (
            <Table<Row>
              caption="Lista de notificações"
              toolbar={toolbar}
              columns={shownColumns}
              rows={rows}
              empty={empty}
              pagination={{ page, pageSize: PAGE_SIZE, total: filtered.length, onPageChange: setPage }}
            />
          )}
        </DevNote>

        <PreferencesCard />
      </Stack>
    </AppLayout>
  );
}

/** Preferências de notificação do próprio usuário (RF801-RGN002 / RF204-FLU006 / RGN006 / CTA003). */
function PreferencesCard() {
  const toast = useToast();
  const { user } = useSubSession();
  const [email, setEmail] = useState(user.notifyEmail);
  const [whatsapp, setWhatsapp] = useState(user.notifyWhatsapp && !!user.phone);
  const dirty = email !== user.notifyEmail || whatsapp !== user.notifyWhatsapp;

  const save = () => {
    updateSubDb((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, notifyEmail: email, notifyWhatsapp: whatsapp } : u)) }));
    toast.show({ type: 'success', title: 'Preferências salvas', message: 'Suas preferências de notificação foram atualizadas' });
  };

  return (
    <DevNote note="RF801-RGN002: canais por usuário, editáveis por ele mesmo (ZC003) e no cadastro/convite (RF204). Plataforma é sempre ativa (RF204-RGN006); e-mail vem ligado por padrão e pode ser desativado, e nesse caso o usuário recebe apenas na plataforma (CTA003). 💡 WhatsApp depende da FE002 (a negociar) e, quando existir, exige telefone celular cadastrado.">
      <Card title="Preferências de notificação" subtitle="Escolha por onde você quer ser avisado" footer={<Button disabled={!dirty} onClick={save}>Salvar preferências</Button>}>
        <Stack gap="md">
          <Checkbox label="Plataforma" checked disabled />
          <Checkbox label="E-mail" checked={email} onChange={(e) => setEmail(e.target.checked)} />
          <DevNote note="WhatsApp fica desabilitado enquanto o usuário não tiver telefone cadastrado. 💡 Canal depende de FE002 (WhatsApp), ainda não aprovada: aqui só a preferência.">
            <Checkbox label="WhatsApp" checked={whatsapp} disabled={!user.phone} onChange={(e) => setWhatsapp(e.target.checked)} />
          </DevNote>
          {!email && <Feedback type="info" title="Com o e-mail desativado, você recebe avisos apenas na plataforma" message="Os avisos continuam aparecendo no sino e nesta tela." />}
          {!user.phone && <Feedback type="warning" title="Telefone não cadastrado" message="O WhatsApp só poderá ser ativado depois que um telefone for informado no seu cadastro." />}
        </Stack>
      </Card>
    </DevNote>
  );
}

mountApp(<NotificacoesScreen />);
