import { useEffect, useState } from 'react';
import { IconAlertTriangle, IconBuilding, IconCalendarEvent, IconCircleCheck, IconCircleOff, IconFridge, IconPencil, IconReportMoney } from '@tabler/icons-react';
import { Badge, Button, Card, Feedback, KpiCard, Stack, Tab, Table, TableColumn, useToast } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { EnvironmentDialog } from './EnvironmentDialog';
import { OverdueDialog } from './OverdueDialog';
import { RowMenu, RowMenuItem } from '../../assinante/shared/RowMenu';
import { SubscriberEquipmentsTab } from './assinante-equipamentos';
import { useHashState } from './useHashState';
import { useSession } from './store';
import { MobileCardList } from './MobileCardList';
import { useIsMobile } from './useMediaQuery';
import {
  Contact, SUBSCRIBER_USER_STATUS, SubscriberUser, contactAreaLabel, subscriberName, subscriberUsers,
} from './data';
import { daysText, daysUntil, formatCep, formatCnpj, formatDate, formatDateTime, formatNumber, formatPhone, noBreak, sinceParts } from './format';
import { KpiMoney } from './kpi-value';
import { Col, Grid, ReadField, goTo, param, onboardingBadge, subscriberStatusBadge, takeFlash } from './ui';

/** Estados: idle · deactivate / activate (RF204 aberto a partir do detalhe) · equipamentos (abre a aba Equipamentos) */
const STATES = ['idle', 'deactivate', 'activate', 'equipamentos', 'overdue'] as const;
type Mode = (typeof STATES)[number];
const USERS_PAGE = 10;

type ContactRow = Record<string, unknown> & Contact;
type UserRow = Record<string, unknown> & SubscriberUser;

function AssinanteScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const { db, can } = useSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const s = db.subscribers.find((x) => x.id === param('id')) ?? null;
  const [toggling, setToggling] = useState(false);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [usersPage, setUsersPage] = useState(1);

  useEffect(() => { if (mode === 'deactivate' || mode === 'activate') setToggling(true); if (mode === 'overdue') setOverdueOpen(true); }, [mode]);
  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) {
    return (
      <AppLayout active="assinantes" screen="assinantes">
        <Feedback type="error" title="Assinante não encontrado" message="Volte para a listagem e tente novamente." />
      </AppLayout>
    );
  }

  const name = subscriberName(s);
  const users = subscriberUsers(s);
  const since = sinceParts(s.since);
  const inactive = s.status === 'inativo';
  const lastOff = s.envHistory.find((h) => h.action === 'inativou');
  const a = s.address;
  const moreActions: RowMenuItem[] = [];
  if (can('assinantes', 'editar') && !inactive) {
    moreActions.push(s.status === 'inadimplente'
      ? { label: 'Marcar como ativo', icon: <IconCircleCheck size={16} />, onClick: () => setOverdueOpen(true) }
      : { label: 'Marcar como inadimplente', icon: <IconAlertTriangle size={16} />, onClick: () => setOverdueOpen(true) });
  }
  if (can('assinantes', 'ativar')) {
    moreActions.push(inactive
      ? { label: 'Ativar ambiente', icon: <IconCircleCheck size={16} />, onClick: () => setToggling(true) }
      : { label: 'Inativar ambiente', icon: <IconCircleOff size={16} />, onClick: () => setToggling(true), danger: true });
  }
  const left = s.status === 'inadimplente' && s.suspendAt ? daysUntil(s.suspendAt) : null;

  const contactCols: TableColumn<ContactRow>[] = [
    { key: 'area', label: 'Área', render: (v) => contactAreaLabel(v as Contact['area']) },
    { key: 'name', label: 'Nome' },
    { key: 'email', label: 'E-mail' },
    { key: 'phone', label: 'Telefone', render: (v) => (v ? noBreak(formatPhone(String(v))) : '-') },
  ];
  const userCols: TableColumn<UserRow>[] = [
    { key: 'name', label: 'Nome' },
    { key: 'email', label: 'E-mail' },
    { key: 'profile', label: 'Perfil' },
    { key: 'status', label: 'Status', render: (v) => { const st = SUBSCRIBER_USER_STATUS[v as SubscriberUser['status']]; return <Badge status={st.badge} dot>{st.label}</Badge>; } },
  ];

  return (
    <AppLayout active="assinantes" screen="assinantes">
      <Stack gap="xl">
        <PageHeader
          title={name}
          badge={subscriberStatusBadge(s.status)}
          subtitle={s.legalName}
          breadcrumb={[{ label: 'Assinantes', href: 'assinantes.html' }, { label: name }]}
          actions={(
            <>
              {can('assinantes', 'editar') && (
                <DevNote note="RF203-RGN002: padrão de tela - visualização com campos em leitura + “Editar”, que leva ao RF202.">
                  <Button iconLeft={<IconPencil size={20} />} onClick={() => goTo(`assinante-form.html?id=${s.id}`)}>Editar</Button>
                </DevNote>
              )}
              {moreActions.length > 0 && (
                <DevNote note="Menu ⋮ do cabeçalho (padrão do sistema, como no equipamento do assinante): reúne as ações de situação do assinante. Marcar como inadimplente / ativo é o status manual (RF201-RGN002) e abre o prazo de regularização (7 dias, 💡) avisando os gestores; Inativar / Ativar ambiente é o RF204 (com confirmação e motivo). Cada item só aparece com a permissão do perfil (Editar ou Ativar/Inativar em Assinantes); sem nenhum item, o menu não aparece.">
                  <RowMenu variant="secondary" size="md" target={name} label="Mais ações do assinante" items={moreActions} />
                </DevNote>
              )}
            </>
          )}
        />

        {left !== null && s.suspendAt && (
          <Feedback
            type="warning"
            title="Assinante inadimplente"
            message={left >= 0
              ? `Os gestores foram avisados em ${formatDate(s.overdueSince ?? s.suspendAt)}. Se não regularizarem até ${formatDate(s.suspendAt)} (${left === 0 ? 'termina hoje' : `faltam ${daysText(left)}`}), o ambiente poderá ser inativado`
              : `O prazo de regularização terminou em ${formatDate(s.suspendAt)}. O ambiente já pode ser inativado`}
          />
        )}

        {inactive && (
          <Feedback
            type="warning"
            title="Ambiente inativo"
            message={lastOff
              ? `Inativado em ${formatDateTime(lastOff.at)} por ${lastOff.by}${lastOff.reason ? ` - ${lastOff.reason}` : ''}. Usuários e QR Codes estão bloqueados; os dados foram preservados.`
              : 'Usuários e QR Codes estão bloqueados; os dados foram preservados.'}
          />
        )}

        <Grid>
          <Col span={3} fill><KpiCard label="Cliente desde" value={since.date} description={since.tenure} icon={<IconCalendarEvent size={20} />} /></Col>
          <Col span={3} fill><KpiCard label="Unidades" value={formatNumber(s.units)} icon={<IconBuilding size={20} />} /></Col>
          <Col span={3} fill><KpiCard label="Equipamentos" value={formatNumber(s.equipments)} icon={<IconFridge size={20} />} /></Col>
          <Col span={3} mobileFull fill>
            <DevNote note="Soma dos custos realizados das ordens de serviço do assinante (RF203).">
              <KpiCard label="Valor gasto em manutenção" value={<KpiMoney cents={s.maintenanceCents} />} icon={<IconReportMoney size={20} />} />
            </DevNote>
          </Col>
        </Grid>

        <DevNote note="Visualização em três abas: Dados (empresa, endereço, contratação e contatos), Usuários vinculados e Equipamentos (QR Codes). Os indicadores acima valem para todas as abas.">
          <Tab
            aria-label="Informações do assinante"
            defaultIndex={mode === 'equipamentos' ? 2 : 0}
            tabs={[
              {
                label: 'Dados',
                content: (
                  <Stack gap="xl">
                <Card title="Dados da empresa" subtitle="Informações cadastrais e fiscais do assinante">
                  <div className="card-body-tight">
                    <Grid>
                      <Col span={12}><ReadField label="Nome fantasia" value={s.tradeName} /></Col>
                      <Col span={6}><ReadField label="Razão social" value={s.legalName} /></Col>
                      <Col span={6}><ReadField label="CNPJ" value={formatCnpj(s.cnpj)} /></Col>
                      <Col span={6}><ReadField label="Inscrição estadual" value={s.stateReg} /></Col>
                      <Col span={6}><ReadField label="Inscrição municipal" value={s.cityReg} /></Col>
                    </Grid>
                  </div>
                </Card>

                <Card title="Endereço da matriz" subtitle="Endereço principal da empresa">
                  <div className="card-body-tight">
                    <Grid>
                      <Col span={4}><ReadField label="CEP" value={formatCep(a.cep)} /></Col>
                      <Col span={12}><ReadField label="Logradouro" value={a.street} /></Col>
                      <Col span={6}><ReadField label="Número" value={a.number} /></Col>
                      <Col span={6}><ReadField label="Complemento" value={a.complement} /></Col>
                      <Col span={12}><ReadField label="Bairro" value={a.district} /></Col>
                      <Col span={6}><ReadField label="Cidade" value={a.city} /></Col>
                      <Col span={6}><ReadField label="Estado" value={a.uf} /></Col>
                    </Grid>
                  </div>
                </Card>

                <Card title="Contratação">
                  <div className="card-body-tight">
                    <Grid>
                      <Col span={6}><ReadField label="Plano / contratação" value={s.plan} /></Col>
                      <Col span={6}><ReadField label="Unidades contratadas" value={s.contractedUnits} /></Col>
                      <Col span={6}><ReadField label="Cliente desde" value={`${since.date} · ${since.tenure}`} /></Col>
                      <Col span={6}><ReadField label="Status" value={subscriberStatusBadge(s.status)} /></Col>
                      <Col span={6}><ReadField label="Implantação" value={onboardingBadge(s.onboarding)} /></Col>
                      {inactive && (
                        <Col span={12}>
                          <DevNote note="RF204-FLU003 / CTA003: toda ativação/inativação fica registrada com data, usuário e motivo; aqui aparece o motivo da última inativação. O histórico completo não é exibido nesta tela.">
                            <ReadField label="Motivo da inativação" value={lastOff?.reason} />
                          </DevNote>
                        </Col>
                      )}
                    </Grid>
                  </div>
                </Card>

                <DevNote note="Contatos por área - Responsável, Comercial, Financeiro, Técnico - “para saber com quem falar” (RF203). Podem ser pessoas sem acesso ao sistema.">
                  {isMobile ? (
                    <MobileCardList
                      headingId="contacts-title" title="Contatos" subtitle="Pessoas de referência para contato em diferentes áreas do assinante" emptyTitle="Nenhum contato cadastrado"
                      page={1} pageSize={s.contacts.length || 1} total={s.contacts.length} onPageChange={() => undefined}
                      items={s.contacts.map((c) => ({
                        id: c.id, title: c.name, subtitle: contactAreaLabel(c.area),
                        fields: [{ label: 'E-mail', value: c.email }, { label: 'Telefone', value: c.phone ? noBreak(formatPhone(c.phone)) : '-' }],
                      }))}
                    />
                  ) : (
                    <Table<ContactRow> title="Contatos" subtitle="Pessoas de referência para contato em diferentes áreas do assinante" columns={contactCols} rows={s.contacts as ContactRow[]} empty={{ title: 'Nenhum contato cadastrado' }} />
                  )}
                </DevNote>
                  </Stack>
                ),
              },
              {
                label: 'Usuários vinculados',
                content: (
                <DevNote note="RF203-RGN001: o Admin visualiza os usuários do assinante, mas a gestão é do próprio assinante (Assinante RF204). 💡 A confirmar se o Admin também pode reenviar convite/redefinir acesso - por isso não há ações aqui. Lista completa (CTA002), 10 por página.">
                  {isMobile ? (
                    <MobileCardList
                      headingId="linked-users-title" title="Usuários vinculados"
                      subtitle={`${users.filter((u) => u.status === 'ativo').length} ativos de ${users.length}`}
                      emptyTitle="Nenhum usuário vinculado"
                      page={usersPage} pageSize={USERS_PAGE} total={users.length} onPageChange={setUsersPage}
                      items={users.slice((usersPage - 1) * USERS_PAGE, usersPage * USERS_PAGE).map((u) => {
                        const st = SUBSCRIBER_USER_STATUS[u.status];
                        return {
                          id: u.id, title: u.name, subtitle: u.email,
                          badge: <Badge status={st.badge} dot>{st.label}</Badge>,
                          fields: [{ label: 'Perfil', value: u.profile }],
                        };
                      })}
                    />
                  ) : (
                  <Table<UserRow>
                      title="Usuários vinculados"
                      subtitle={`${users.filter((u) => u.status === 'ativo').length} ativos de ${users.length}`}
                      columns={userCols}
                      rows={users.slice((usersPage - 1) * USERS_PAGE, usersPage * USERS_PAGE) as UserRow[]}
                      empty={{ title: 'Nenhum usuário vinculado' }}
                      pagination={{ page: usersPage, pageSize: USERS_PAGE, total: users.length, onPageChange: setUsersPage }}
                    />
                  )}                </DevNote>
                ),
              },
              { label: 'Equipamentos', content: <SubscriberEquipmentsTab subscriber={s} /> },
            ]}
          />
        </DevNote>
      </Stack>
      <EnvironmentDialog subscriber={toggling ? s : null} onClose={() => setToggling(false)} />
      <OverdueDialog subscriber={overdueOpen ? s : null} onClose={() => setOverdueOpen(false)} />
    </AppLayout>
  );
}

mountApp(<AssinanteScreen />);
