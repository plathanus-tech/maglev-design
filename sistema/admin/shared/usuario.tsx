import { useEffect, useState } from 'react';
import { IconCircleCheck, IconCircleOff, IconPencil } from '@tabler/icons-react';
import { Button, Card, Feedback, Stack, Tab, Table, TableColumn, Tooltip, useToast } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { UserStatusDialog } from './UserStatusDialog';
import { useSession } from './store';
import { ACTIONS, Activity, ActivityKind, SCREENS, Visual } from './data';
import { formatDate, formatDateTime, formatPhone } from './format';
import { MobileCardList } from './MobileCardList';
import { useIsMobile } from './useMediaQuery';
import { Col, Grid, ReadField, goTo, param, recordStatusBadge, takeFlash, visualBadgeOf } from './ui';

const PAGE_SIZE = 10;
const KIND: Record<ActivityKind, { label: string; visual: Visual }> = {
  cadastro: { label: 'Cadastro', visual: 'informativo' },
  edicao: { label: 'Edição', visual: 'neutro' },
  ativacao: { label: 'Ativação', visual: 'sucesso' },
  inativacao: { label: 'Inativação', visual: 'critico' },
  exclusao: { label: 'Exclusão', visual: 'critico' },
};
type EventRow = Record<string, unknown> & Pick<Activity, 'id' | 'module' | 'kind'> & { when: string; description: string };

/** RF301 - Visualizar usuário do Admin (campos em leitura + Editar). */
function UsuarioScreen() {
  const toast = useToast();
  const { db, user: me, can } = useSession();
  const u = db.adminUsers.find((x) => x.id === param('id'));
  const [toggling, setToggling] = useState(false);
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);
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

  // Histórico de ações: o que ESTE usuário fez no sistema, mais recente primeiro
  const events = (db.activity ?? []).filter((e) => e.userId === u.id).sort((a, b) => b.at.localeCompare(a.at));
  const rows: EventRow[] = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((e) => ({
    id: e.id, when: formatDateTime(e.at), kind: e.kind, module: e.module, description: e.action,
  }));
  const historyCols: TableColumn<EventRow>[] = [
    { key: 'when', label: 'Data e hora' },
    { key: 'kind', label: 'Tipo', render: (v) => visualBadgeOf(KIND[v as ActivityKind].visual, KIND[v as ActivityKind].label) },
    { key: 'description', label: 'Ação' },
    { key: 'module', label: 'Módulo' },
  ];

  const toggleButton = u.status === 'ativo'
    ? <Button variant="secondary" iconLeft={<IconCircleOff size={20} />} disabled={self} onClick={() => setToggling(true)}>Inativar usuário</Button>
    : <Button variant="secondary" iconLeft={<IconCircleCheck size={20} />} onClick={() => setToggling(true)}>Ativar usuário</Button>;

  return (
    <AppLayout active="usuarios" screen="usuarios">
      <Stack gap="xl">
        <PageHeader
          title={u.name}
          badge={recordStatusBadge(u.status)}
          subtitle={u.email}
          breadcrumb={[{ label: 'Usuários', href: 'usuarios.html' }, { label: u.name }]}
          actions={(
            <>
              {can('usuarios', 'ativar') && (
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
                          <Col span={6}><ReadField label="Cadastrado em" value={formatDate(u.createdAt)} /></Col>
                          <Col span={6}><ReadField label="Celular" value={formatPhone(u.phone)} /></Col>
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
                content: isMobile ? (
                  <MobileCardList
                    headingId="user-history-title" title="Histórico de ações" titleHidden
                    emptyTitle="Nenhuma ação registrada"
                    page={page} pageSize={PAGE_SIZE} total={events.length} onPageChange={setPage}
                    items={rows.map((e) => ({
                      id: e.id, title: e.description, subtitle: e.when, badge: visualBadgeOf(KIND[e.kind].visual, KIND[e.kind].label),
                      fields: [{ label: 'Módulo', value: e.module }],
                    }))}
                  />
                ) : (
                  <Table<EventRow>
                    title="Histórico de ações"
                    subtitle="Registro das ações realizadas pelo usuário no sistema"
                    columns={historyCols}
                    rows={rows}
                    empty={{ title: 'Nenhuma ação registrada' }}
                    pagination={{ page, pageSize: PAGE_SIZE, total: events.length, onPageChange: setPage }}
                  />
                ),
              },
            ]}
          />
        </DevNote>
      </Stack>
      <UserStatusDialog user={toggling ? u : null} onClose={() => setToggling(false)} />
    </AppLayout>
  );
}

mountApp(<UsuarioScreen />);
