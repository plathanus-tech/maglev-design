import { useEffect, useState } from 'react';
import { IconBuilding, IconCalendarEvent, IconCircleCheck, IconCircleOff, IconFridge, IconPencil, IconReportMoney } from '@tabler/icons-react';
import { Badge, Button, Card, Feedback, KpiCard, Stack, Tab, Table, TableColumn, useToast } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { EnvironmentDialog } from './EnvironmentDialog';
import { useHashState } from './useHashState';
import { useSession } from './store';
import { MobileCardList } from './MobileCardList';
import { useIsMobile } from './useMediaQuery';
import {
  Contact, SUBSCRIBER_USER_STATUS, SubscriberUser, contactAreaLabel, subscriberName, subscriberUsers,
} from './data';
import { formatCep, formatCnpj, formatDateTime, formatMoney, formatNumber, formatPhone, noBreak, sinceParts } from './format';
import { Col, Grid, ReadField, goTo, param, subscriberStatusBadge, takeFlash } from './ui';

/** Estados: idle · deactivate / activate (RF204 aberto a partir do detalhe) */
const STATES = ['idle', 'deactivate', 'activate'] as const;
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
  const [usersPage, setUsersPage] = useState(1);

  useEffect(() => { if (mode === 'deactivate' || mode === 'activate') setToggling(true); }, [mode]);
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
              {can('assinantes', 'ativar') && (
                <DevNote note="RF203-FLU003 → RF204: a partir do detalhe, ativar/inativar o ambiente (com confirmação). Visível só com a permissão “Ativar/Inativar” em Assinantes.">
                  {inactive
                    ? <Button variant="secondary" iconLeft={<IconCircleCheck size={20} />} onClick={() => setToggling(true)}>Ativar ambiente</Button>
                    : <Button variant="secondary" iconLeft={<IconCircleOff size={20} />} onClick={() => setToggling(true)}>Inativar ambiente</Button>}
                </DevNote>
              )}
              {can('assinantes', 'editar') && (
                <DevNote note="RF203-RGN002: padrão de tela - visualização com campos em leitura + “Editar”, que leva ao RF202.">
                  <Button iconLeft={<IconPencil size={20} />} onClick={() => goTo(`assinante-form.html?id=${s.id}`)}>Editar</Button>
                </DevNote>
              )}
            </>
          )}
        />

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
              <KpiCard label="Valor gasto em manutenção" value={formatMoney(s.maintenanceCents)} icon={<IconReportMoney size={20} />} />
            </DevNote>
          </Col>
        </Grid>

        <DevNote note="Visualização em duas abas: Dados (empresa, endereço, contratação e contatos) e Usuários vinculados. Os indicadores acima valem para todas as abas.">
          <Tab
            aria-label="Informações do assinante"
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
            ]}
          />
        </DevNote>
      </Stack>
      <EnvironmentDialog subscriber={toggling ? s : null} onClose={() => setToggling(false)} />
    </AppLayout>
  );
}

mountApp(<AssinanteScreen />);
