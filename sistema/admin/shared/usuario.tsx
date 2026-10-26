import { ReactNode, useEffect, useState } from 'react';
import { IconCircleCheck, IconCircleOff, IconMailForward, IconPencil } from '@tabler/icons-react';
import { Button, Card, Feedback, Stack, Tab, Table, TableColumn, Tooltip, useToast } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { UserStatusDialog } from './UserStatusDialog';
import { resendAdminInvite, useSession } from './store';
import { ACTIONS, Activity, ActivityKind, ActivityModule, SCREENS, Visual } from './data';
import { formatDate, formatDateTime, formatPhone } from './format';
import { MobileCardList } from './MobileCardList';
import { useAccessResponse } from './user-access';
import { useIsMobile } from './useMediaQuery';
import { CellPair, Col, Grid, ReadField, RowActions, adminUserStatusBadge, goTo, param, takeFlash, visualBadgeOf } from './ui';

const PAGE_SIZE = 10;
const KIND: Record<ActivityKind, { label: string; visual: Visual }> = {
  cadastro: { label: 'Cadastro', visual: 'informativo' },
  edicao: { label: 'Edição', visual: 'neutro' },
  ativacao: { label: 'Ativação', visual: 'sucesso' },
  inativacao: { label: 'Inativação', visual: 'critico' },
  exclusao: { label: 'Exclusão', visual: 'critico' },
};
type EventRow = Record<string, unknown> & Pick<Activity, 'id'> & { module: ActivityModule | 'Segurança'; kind: ActivityKind | 'acesso'; when: string; description: string; detail?: ReactNode; alerts?: boolean; actions?: ReactNode };

/** RF301 - Visualizar usuário do Admin (campos em leitura + Editar). */
function UsuarioScreen() {
  const toast = useToast();
  const { db, user: me, can } = useSession();
  const u = db.adminUsers.find((x) => x.id === param('id'));
  const [toggling, setToggling] = useState(false);
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);
  const access = useAccessResponse(db.adminUsers.find((x) => x.id === param('id')));
  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!u) {
    return (
      <AppLayout active="usuarios" screen="usuarios">
        <Feedback type="error" title="Usuário não encontrado" message="Volte para a listagem e tente novamente." />
      </AppLayout>
    );
  }
  const profile = db.profiles.find((p) => p.id === u.profileId);
  const self = u.id === me.id;
  const allowed = profile ? SCREENS.map((sc) => {
    const acts = profile.permissions[sc.key] ?? [];
    return acts.length ? `${sc.label}: ${ACTIONS.filter((a) => acts.includes(a.key)).map((a) => a.label).join(', ')}` : null;
  }).filter(Boolean) as string[] : [];

  // Histórico de ações: o que ESTE usuário fez no sistema e os acessos dele ao painel (logins, com alertas), mais recente primeiro
  const history = [
    ...(db.activity ?? []).filter((e) => e.userId === u.id).map((e) => ({ at: e.at, row: { id: e.id, when: formatDateTime(e.at), kind: e.kind, module: e.module, description: e.action } as EventRow })),
    ...access.sessions.map((x) => ({
      at: x.at,
      row: { id: x.id, when: formatDateTime(x.at), kind: 'acesso', module: 'Segurança', description: access.title(x), detail: access.describe(x), alerts: x.alerts.length > 0, actions: access.actions(x) } as EventRow,
    })),
  ].sort((p, q) => q.at.localeCompare(p.at));
  const total = history.length;
  const rows: EventRow[] = history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((h) => h.row);
  const kindBadge = (r: EventRow) => (r.kind === 'acesso'
    ? visualBadgeOf(r.alerts ? 'atencao' : 'neutro', r.alerts ? 'Acesso com alerta' : 'Acesso')
    : visualBadgeOf(KIND[r.kind].visual, KIND[r.kind].label));
  const historyCols: TableColumn<EventRow>[] = [
    { key: 'when', label: 'Data e hora' },
    { key: 'kind', label: 'Tipo', render: (_, r) => kindBadge(r) },
    { key: 'description', label: 'Ação', render: (_, r) => (r.detail ? <CellPair primary={r.description} secondary={r.detail} /> : r.description) },
    { key: 'module', label: 'Módulo' },
    { key: 'actions', label: 'Ações', sticky: 'right', render: (_, r) => r.actions ?? null },
  ];

  const toggleButton = u.status !== 'inativo'
    ? <Button variant="secondary" iconLeft={<IconCircleOff size={20} />} disabled={self} onClick={() => setToggling(true)}>Inativar usuário</Button>
    : <Button variant="secondary" iconLeft={<IconCircleCheck size={20} />} onClick={() => setToggling(true)}>Ativar usuário</Button>;
  const resend = () => {
    resendAdminInvite(me.id, u);
    toast.show({ type: 'success', title: 'Convite reenviado', message: `Enviamos um novo convite para ${u.email}` });
  };

  return (
    <AppLayout active="usuarios" screen="usuarios">
      <Stack gap="xl">
        <PageHeader
          title={u.name}
          badge={adminUserStatusBadge(u.status)}
          subtitle={u.email}
          breadcrumb={[{ label: 'Usuários', href: 'usuarios.html' }, { label: u.name }]}
          actions={(
            <>
              {can('usuarios', 'cadastrar') && u.status === 'convite' && (
                <DevNote note="Reenvia o e-mail de primeiro acesso e atualiza a data do convite; o link anterior deixa de valer. Só aparece com convite pendente e para quem pode cadastrar usuários.">
                  <Button variant="secondary" iconLeft={<IconMailForward size={20} />} onClick={resend}>Reenviar convite</Button>
                </DevNote>
              )}
              {can('usuarios', 'ativar') && u.status !== 'convite' && (
                self
                  ? <DevNote note="RF301-RGN002: o usuário não pode inativar a si próprio."><Tooltip content="Você não pode inativar o seu próprio usuário">{toggleButton}</Tooltip></DevNote>
                  : toggleButton
              )}
              {can('usuarios', 'editar') && <Button iconLeft={<IconPencil size={20} />} onClick={() => goTo(`usuario-form.html?id=${u.id}`)}>Editar</Button>}
            </>
          )}
        />

        <DevNote note="Visualização em duas abas: Dados do usuário (com o resumo das permissões do perfil - RF303) e Histórico de ações. O histórico é o log do que este usuário fez no sistema (cadastrou assinante, alterou status, inativou ambiente, editou perfil…), do mais recente para o mais antigo, 10 por página; cada ação do Admin é registrada ao ser concluída. Pedido durante a prototipação: o histórico por usuário (ZC004) não está no contrato e precisa ser validado com o comercial.">
          <Tab
            aria-label="Informações do usuário"
            defaultIndex={location.hash === '#historico' ? 1 : 0}
            tabs={[
              {
                label: 'Dados do usuário',
                content: (
                  <Stack gap="xl">
                    <Card title="Dados do usuário">
                      <div className="card-body-tight">
                        <Grid>
                          <Col span={6}><ReadField label="Nome completo" value={u.name} /></Col>
                          <Col span={6}><ReadField label="Perfil de acesso" value={profile?.name} /></Col>
                          <Col span={6}><ReadField label="E-mail" value={u.email} /></Col>
                          <Col span={6}><ReadField label="Celular" value={formatPhone(u.phone)} /></Col>
                          <Col span={6}><ReadField label="Cadastrado em" value={formatDate(u.createdAt)} /></Col>
                          <Col span={6}><ReadField label="Estado de acesso" value={adminUserStatusBadge(u.status)} /></Col>
                          <Col span={6}>
                            <DevNote note="Data de entrada = dia em que a pessoa concluiu o primeiro acesso (definiu a senha e aceitou os termos). Enquanto o convite está pendente, mostra a data do último envio do convite.">
                              {u.status === 'convite'
                                ? <ReadField label="Convite enviado em" value={u.invitedAt ? formatDate(u.invitedAt) : '-'} />
                                : <ReadField label="Data de entrada" value={u.joinedAt ? formatDate(u.joinedAt) : '-'} />}
                            </DevNote>
                          </Col>
                        </Grid>
                      </div>
                    </Card>

                    <DevNote note="Resumo das permissões do perfil (RF303).">
                      <Card title="Permissões do perfil" subtitle={profile ? `Herdadas do perfil ${profile.name}` : undefined}>
                        <div className="card-body-tight">
                          <Stack gap="sm">
                            {allowed.length ? allowed.map((line) => <ReadField key={line} label={line.split(':')[0]} value={line.split(': ')[1]} />)
                              : <Feedback type="info" message="Este perfil não tem permissões." />}
                          </Stack>
                        </div>
                      </Card>
                    </DevNote>
                  </Stack>
                ),
              },
              {
                label: 'Histórico de ações',
                content: (
                  <Stack gap="xl">
                    {access.banner}
                    <DevNote note={access.note}>
                    {isMobile ? (
                  <MobileCardList
                    headingId="user-history-title" title="Histórico de ações" titleHidden
                    emptyTitle="Nenhuma ação registrada"
                    page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage}
                    items={rows.map((e) => ({
                      id: e.id, title: e.description, subtitle: e.when, badge: kindBadge(e),
                      fields: [...(e.detail ? [{ label: 'Detalhe', value: e.detail }] : []), { label: 'Módulo', value: e.module }],
                      actions: e.actions as ReactNode,
                    }))}
                  />
                ) : (
                  <Table<EventRow>
                    title="Histórico de ações"
                    subtitle="Ações realizadas pelo usuário no sistema e acessos dele ao painel"
                    columns={historyCols}
                    rows={rows}
                    empty={{ title: 'Nenhuma ação registrada' }}
                    pagination={{ page, pageSize: PAGE_SIZE, total, onPageChange: setPage }}
                  />
                    )}
                    </DevNote>
                  </Stack>
                ),
              },
            ]}
          />
        </DevNote>
      </Stack>
      <UserStatusDialog user={toggling ? u : null} onClose={() => setToggling(false)} />
      {access.dialog}
    </AppLayout>
  );
}

mountApp(<UsuarioScreen />);
