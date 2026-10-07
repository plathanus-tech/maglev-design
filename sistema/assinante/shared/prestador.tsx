import { useEffect, useMemo, useState } from 'react';
import { IconCircleCheck, IconCircleOff, IconClipboardList, IconClock, IconPencil, IconReportMoney } from '@tabler/icons-react';
import { Badge, Button, Card, Feedback, KpiCard, Stack, Tab, TableColumn, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { formatCnpj, formatDate, formatMoney, formatNumber, formatPhone, noBreak } from '../../admin/shared/format';
import { useHashState } from '../../admin/shared/useHashState';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { ProviderContact, Technician, WorkOrder } from './data';
import { ResponsiveTable } from './ListKit';
import { PROVIDER_KIND_LABEL, formatCpf, mainContact, orderCompletedAt, orderCostCents, providerName, providerOrders, withinDays } from './prestadores';
import { ProviderStatusDialog } from './ProviderStatusDialog';
import { unitName, useSubSession } from './store';
import { Col, Grid, ReadField, goTo, param, recordStatusBadge, takeFlash, useRefs } from './ui';

/** Estados: idle · inactivate / activate (RF701 - confirmação a partir do perfil) */
const STATES = ['idle', 'inactivate', 'activate'] as const;
type Mode = (typeof STATES)[number];
const PERIOD_DAYS = 90;

type OrderRow = Record<string, unknown> & { id: string; order: WorkOrder; equipment: string; at: string; cost: number };
type ContactRow = Record<string, unknown> & ProviderContact;
type TechRow = Record<string, unknown> & Technician;

function PrestadorScreen() {
  const toast = useToast();
  const refs = useRefs();
  const { db, can, canSeeCosts, unitIds } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [toggling, setToggling] = useState(false);
  const p = db.providers.find((x) => x.id === param('id'));

  useEffect(() => { if (mode === 'inactivate' || mode === 'activate') setToggling(true); }, [mode]);
  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const orders = useMemo(() => (p ? providerOrders(db, p.id, unitIds) : []), [db, p, unitIds]);

  if (!p) {
    return (
      <AppLayout active="prestadores" screen="prestadores">
        <Feedback type="error" title="Prestador não encontrado" message="Volte para a lista de prestadores e tente novamente" />
      </AppLayout>
    );
  }

  const name = providerName(p);
  const company = p.kind === 'empresa';
  const inactive = p.status === 'inativo';
  const main = mainContact(p);
  const base = (o: WorkOrder) => refs.base(o.statusId);
  const eqName = (o: WorkOrder) => db.equipments.find((e) => e.id === o.equipmentId)?.name ?? '-';
  const toRow = (o: WorkOrder, at: string): OrderRow => ({ id: o.id, order: o, equipment: eqName(o), at, cost: orderCostCents(o) });
  const open = orders.filter((o) => ['aberto', 'andamento', 'aguardando'].includes(base(o) ?? '')).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((o) => toRow(o, o.createdAt));
  const history = orders.filter((o) => ['concluido', 'cancelado'].includes(base(o) ?? '')).map((o) => toRow(o, orderCompletedAt(db, o))).sort((a, b) => b.at.localeCompare(a.at));
  const units = [...new Set(orders.map((o) => db.equipments.find((e) => e.id === o.equipmentId)?.unitId).filter(Boolean))].map((u) => unitName(db, u as string));

  // Indicadores (💡 sugestão do RF703): só OS deste assinante (RGN001)
  const inPeriod = orders.filter((o) => withinDays(o.createdAt, PERIOD_DAYS));
  const doneInPeriod = history.filter((r) => base(r.order) === 'concluido' && withinDays(r.at, PERIOD_DAYS));
  const avgDays = doneInPeriod.length ? doneInPeriod.reduce((n, r) => n + (new Date(r.at).getTime() - new Date(r.order.createdAt).getTime()) / 86_400_000, 0) / doneInPeriod.length : null;
  const totalCost = doneInPeriod.reduce((n, r) => n + r.cost, 0);

  const orderLink = (o: WorkOrder) => <a className="text-link" href={`os.html?id=${o.id}`}>{o.id}</a>;
  const subjectCell = (o: WorkOrder) => (o.kind === 'preventiva' ? <Stack gap="2xs"><span>{o.subject}</span><Badge status="info">Preventiva</Badge></Stack> : o.subject);
  const statusCell = (o: WorkOrder) => refs.statusBadge(o.statusId);

  const openCols: TableColumn<OrderRow>[] = [
    { key: 'id', label: 'Nº', render: (_, r) => orderLink(r.order) },
    { key: 'subject', label: 'Assunto', render: (_, r) => subjectCell(r.order) },
    { key: 'status', label: 'Status', render: (_, r) => statusCell(r.order) },
    { key: 'at', label: 'Aberta em', render: (_, r) => formatDate(r.at) },
  ];
  const historyCols: TableColumn<OrderRow>[] = [
    { key: 'id', label: 'Nº', render: (_, r) => orderLink(r.order) },
    { key: 'subject', label: 'Assunto', render: (_, r) => subjectCell(r.order) },
    { key: 'equipment', label: 'Equipamento' },
    { key: 'status', label: 'Status', render: (_, r) => statusCell(r.order) },
    { key: 'at', label: 'Data', render: (_, r) => formatDate(r.at) },
    ...(canSeeCosts ? [{ key: 'cost', label: 'Custo', align: 'right' as const, render: (_: unknown, r: OrderRow) => (r.cost ? formatMoney(r.cost) : '-') }] : []),
  ];
  const contactCols: TableColumn<ContactRow>[] = [
    { key: 'name', label: 'Nome', render: (_, r) => <CellName c={r} /> },
    { key: 'role', label: 'Função' },
    { key: 'phone', label: 'Telefone/WhatsApp', render: (v) => noBreak(formatPhone(String(v))) },
    { key: 'email', label: 'E-mail' },
  ];
  const techCols: TableColumn<TechRow>[] = [
    { key: 'name', label: 'Nome' },
    { key: 'specialty', label: 'Especialidade', render: (v) => (v ? String(v) : '-') },
    { key: 'phone', label: 'Telefone', render: (v) => (v ? noBreak(formatPhone(String(v))) : '-') },
    { key: 'email', label: 'E-mail', render: (v) => (v ? String(v) : '-') },
  ];

  const kpiCols = canSeeCosts ? 4 : 6;
  const dataTab = (
    <Stack gap="xl">
      <Card className="card-open" title="Dados principais" subtitle="Identificação e contato do prestador">
        <div className="card-body-tight">
          <Grid>
            <Col span={6}><ReadField label={company ? 'Razão social' : 'Nome do prestador'} value={p.name} /></Col>
            <Col span={6}><ReadField label="Nome fantasia" value={p.tradeName} /></Col>
            <Col span={6}><ReadField label={company ? 'CNPJ' : 'CPF'} value={company ? formatCnpj(p.doc) : formatCpf(p.doc)} /></Col>
            <Col span={6}><ReadField label="Tipo" value={PROVIDER_KIND_LABEL[p.kind]} /></Col>
            <Col span={6}><ReadField label="Responsável" value={main ? `${main.name} · ${main.role}` : undefined} /></Col>
            <Col span={6}><ReadField label="Contato" value={main ? `${formatPhone(main.phone)} · ${main.email}` : undefined} /></Col>
            <Col span={12}><ReadField label="Observações" value={p.notes} /></Col>
          </Grid>
        </div>
      </Card>

      <Card className="card-open" title="Atuação" subtitle="O que o prestador atende e onde">
        <div className="card-body-tight">
          <Grid>
            <Col span={6}><ReadField label="Especialidades" value={p.specialties.join(', ')} /></Col>
            <Col span={6}><ReadField label="Categorias atendidas" value={p.categoryIds.map((c) => refs.category(c)?.name ?? c).join(', ')} /></Col>
            <Col span={6}>
              <DevNote note="💡 ZC002 (a confirmar): tipos de equipamento atendidos, ex.: técnico de refrigeração que só atende freezer.">
                <ReadField label="Tipos de equipamento atendidos" value={p.equipmentTypes.join(', ')} />
              </DevNote>
            </Col>
            <Col span={6}><ReadField label="Regiões atendidas" value={p.regions.join(', ')} /></Col>
            <Col span={12}>
              <DevNote note="RF703: unidades atendidas = unidades dos equipamentos das OS atribuídas a este prestador.">
                <ReadField label="Unidades atendidas" value={units.length ? units.join(', ') : 'Nenhuma OS atribuída ainda'} />
              </DevNote>
            </Col>
          </Grid>
        </div>
      </Card>

      <DevNote note="RF702-CTA003: o prestador aceita mais de um contato; o e-mail do principal recebe o link de acesso às OS (RF102).">
        <ResponsiveTable<ContactRow>
          id="provider-contacts" title="Contatos" subtitle="Pessoas de referência do prestador" columns={contactCols} rows={p.contacts as ContactRow[]} emptyTitle="Nenhum contato cadastrado"
          card={(c) => ({ id: c.id, title: c.name, subtitle: c.role, badge: c.main ? <Badge status="brand">Principal</Badge> : undefined, fields: [{ label: 'Telefone/WhatsApp', value: noBreak(formatPhone(c.phone)) }, { label: 'E-mail', value: c.email }] })}
        />
      </DevNote>

      <DevNote note="RF702-RGN002: um prestador pode ter vários técnicos, de especialidades diferentes.">
        <ResponsiveTable<TechRow>
          id="provider-techs" title="Técnicos vinculados" subtitle={`${p.technicians.length} ${p.technicians.length === 1 ? 'técnico' : 'técnicos'}`} columns={techCols} rows={p.technicians as TechRow[]} emptyTitle="Nenhum técnico vinculado"
          card={(t) => ({ id: t.id, title: t.name, subtitle: t.specialty || undefined, fields: [{ label: 'Telefone', value: t.phone ? noBreak(formatPhone(t.phone)) : '-' }, { label: 'E-mail', value: t.email || '-' }] })}
        />
      </DevNote>
    </Stack>
  );

  const servicesTab = (
    <Stack gap="xl">
      <DevNote note="RF703-CTA001: todas as OS atribuídas ao prestador (executor do tipo prestador) aparecem aqui, em andamento ou no histórico. Clique no número abre a OS (RF503).">
        <ResponsiveTable<OrderRow>
          id="provider-open" title="OS em andamento" subtitle="Ordens de serviço abertas, em andamento ou aguardando" columns={openCols} rows={open} emptyTitle="Nenhuma OS em andamento"
          card={(r) => ({ id: r.id, title: r.order.subject, subtitle: r.order.id, badge: statusCell(r.order), fields: [{ label: 'OS', value: orderLink(r.order) }, { label: 'Aberta em', value: formatDate(r.at) }] })}
        />
      </DevNote>
      <DevNote note={`Histórico de serviços: OS concluídas (e canceladas) com a data de conclusão. Custo só para quem pode ver custos (Administrador e Gestor - RF304-RGN003).`}>
        <ResponsiveTable<OrderRow>
          id="provider-history" title="OS concluídas e histórico de serviços" subtitle="Serviços já encerrados por este prestador" columns={historyCols} rows={history} emptyTitle="Nenhum serviço concluído"
          card={(r) => ({
            id: r.id, title: r.order.subject, subtitle: r.equipment, badge: statusCell(r.order),
            fields: [{ label: 'OS', value: orderLink(r.order) }, { label: 'Data', value: formatDate(r.at) }, ...(canSeeCosts ? [{ label: 'Custo', value: r.cost ? formatMoney(r.cost) : '-' }] : [])],
          })}
        />
      </DevNote>
    </Stack>
  );

  return (
    <AppLayout active="prestadores" screen="prestadores">
      <Stack gap="xl">
        <PageHeader
          title={name} badge={recordStatusBadge(p.status)}
          subtitle={company && p.tradeName ? `${PROVIDER_KIND_LABEL[p.kind]} · ${p.name}` : PROVIDER_KIND_LABEL[p.kind]}
          breadcrumb={[{ label: 'Prestadores', href: 'prestadores.html' }, { label: name }]}
          actions={(
            <>
              {can('prestadores', 'ativar') && (inactive
                ? <Button variant="secondary" iconLeft={<IconCircleCheck size={20} />} onClick={() => setToggling(true)}>Ativar prestador</Button>
                : <Button variant="secondary" iconLeft={<IconCircleOff size={20} />} onClick={() => setToggling(true)}>Inativar prestador</Button>)}
              {can('prestadores', 'editar') && (
                <DevNote note="RF703-FLU003: editar cadastro leva ao RF702.">
                  <Button iconLeft={<IconPencil size={20} />} onClick={() => goTo(`prestador-form.html?id=${p.id}`)}>Editar</Button>
                </DevNote>
              )}
            </>
          )}
        />

        {inactive && <Feedback type="warning" title="Prestador inativo" message="Não é ofertado em novas OS e planos. O histórico de serviços e as OS já atribuídas são mantidos" />}

        <DevNote note={`RF703 💡 indicadores sugeridos (a confirmar): quantidade de OS no período, tempo médio de atendimento e custo total no período. Período fixo de ${PERIOD_DAYS} dias no protótipo; só OS deste assinante (RGN001). Tempo médio = da abertura à conclusão, das OS concluídas no período. Sem nota/avaliação do prestador no MVP (RGN002).`}>
          <Grid>
            <Col span={kpiCols as 4 | 6} fill><KpiCard label={`OS · ${PERIOD_DAYS} dias`} value={formatNumber(inPeriod.length)} description="Abertas no período" icon={<IconClipboardList size={20} />} /></Col>
            <Col span={kpiCols as 4 | 6} fill>
              <KpiCard label="Tempo médio de atendimento" value={avgDays === null ? '-' : `${avgDays.toFixed(1).replace('.', ',')} dias`} description="Da abertura à conclusão" icon={<IconClock size={20} />} />
            </Col>
            {canSeeCosts && (
              <Col span={4} mobileFull fill><KpiCard label={`Custo total · ${PERIOD_DAYS} dias`} value={formatMoney(totalCost)} description="Das OS concluídas no período" icon={<IconReportMoney size={20} />} /></Col>
            )}
          </Grid>
        </DevNote>

        <Tab aria-label="Informações do prestador" tabs={[{ label: 'Dados', content: dataTab }, { label: 'Serviços', content: servicesTab }]} />
      </Stack>
      <ProviderStatusDialog provider={toggling ? p : null} onClose={() => setToggling(false)} />
    </AppLayout>
  );
}

function CellName({ c }: { c: ProviderContact }) {
  return <Stack direction="horizontal" gap="xs" align="center" wrap><span>{c.name}</span>{c.main && <Badge status="brand">Principal</Badge>}</Stack>;
}

mountApp(<PrestadorScreen />);
