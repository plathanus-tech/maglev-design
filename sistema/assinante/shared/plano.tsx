import { useEffect, useMemo, useState } from 'react';
import { IconAlertTriangle, IconCalendarEvent, IconChecks, IconPencil, IconPlayerPause, IconPlayerPlay, IconPlayerPlayFilled } from '@tabler/icons-react';
import { Badge, Button, Card, Feedback, KpiCard, Stack, Tab, TableColumn, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { formatDate, formatNumber } from '../../admin/shared/format';
import { useHashState } from '../../admin/shared/useHashState';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { CHECKLIST_KIND_LABEL, PlanExecution } from './data';
import { ResponsiveTable } from './ListKit';
import { PlanEquipmentsDialog } from './PlanEquipmentPicker';
import { PlanStatusDialog } from './PlanStatusDialog';
import { compliance, describeFrequency, executorOf, isLate, isSoon, planUnitIds, statsOf } from './preventivas';
import { unitName, useSubSession } from './store';
import { CellPair, Col, Grid, ReadField, RowAction, RowActions, goTo, param, takeFlash } from './ui';

/** Estados: idle · pause / activate (RF602 - confirmação) · equipments (RF601-FLU008 - associar equipamentos) */
const STATES = ['idle', 'pause', 'activate', 'equipments'] as const;
type Mode = (typeof STATES)[number];

type Row = Record<string, unknown> & { id: string; ex: PlanExecution; equipment: string; unit: string };

function PlanoScreen() {
  const toast = useToast();
  const { db, user, can, unitIds } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [toggling, setToggling] = useState(false);
  const [editingEquipments, setEditingEquipments] = useState(false);
  const plan = db.plans.find((p) => p.id === param('id'));
  const mine = !!plan && (user.profile !== 'executor' || (plan.executor.kind === 'interno' && plan.executor.userId === user.id));
  const visible = !!plan && mine && planUnitIds(db, plan).some((u) => unitIds.includes(u));

  useEffect(() => {
    if (mode === 'pause' || mode === 'activate') setToggling(true);
    if (mode === 'equipments') setEditingEquipments(true);
  }, [mode]);
  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => (plan ? statsOf(db, plan) : null), [db, plan]);

  if (!plan || !stats || !visible) {
    return (
      <AppLayout active="planos" screen="planos">
        <Feedback type="error" title="Plano não encontrado" message="Volte para a lista de planos e tente novamente" />
      </AppLayout>
    );
  }

  const paused = plan.status === 'pausado';
  const executor = executorOf(db, plan.executor);
  const comp = compliance(stats.executions);
  const eqOf = (id: string) => db.equipments.find((e) => e.id === id);
  const equipmentCell = (id: string) => <a className="text-link" href={`equipamento.html?id=${id}`}>{eqOf(id)?.name ?? id}</a>;
  const osLink = (id?: string) => (id ? <a className="text-link" href={`os.html?id=${id}`}>{id}</a> : '-');
  const toRow = (ex: PlanExecution): Row => ({ id: ex.id, ex, equipment: eqOf(ex.equipmentId)?.name ?? ex.equipmentId, unit: unitName(db, eqOf(ex.equipmentId)?.unitId ?? '') });

  const pendingRows = stats.pending.map(toRow);
  const historyRows = stats.history.map(toRow);

  const pendingBadge = (ex: PlanExecution) => (isLate(ex) ? <Badge status="error" dot>Atrasada</Badge> : isSoon(ex) ? <Badge status="warning" dot>Em breve</Badge> : <Badge status="neutral" dot>Prevista</Badge>);
  const resultBadge = (ex: PlanExecution) => (ex.status === 'concluida' ? <Badge status="success" dot>Concluída</Badge> : <Badge status="error" dot>Não realizada</Badge>);
  const canRun = (ex: PlanExecution) => {
    const os = ex.osId ? db.orders.find((o) => o.id === ex.osId) : undefined;
    return !!os && can('os', 'editar') && os.statusId !== 'STO-08' && os.statusId !== 'STO-09';
  };
  const runAction = (ex: PlanExecution) => (canRun(ex)
    ? <RowActions><RowAction icon={<IconPlayerPlayFilled size={16} />} label="Executar preventiva" target={`${eqOf(ex.equipmentId)?.name ?? ''} em ${formatDate(ex.dueDate)}`} onClick={() => goTo(`execucao-preventiva.html?os=${ex.osId}`)} /></RowActions>
    : undefined);

  const pendingCols: TableColumn<Row>[] = [
    { key: 'due', label: 'Data prevista', render: (_, r) => formatDate(r.ex.dueDate) },
    { key: 'equipment', label: 'Equipamento', render: (_, r) => equipmentCell(r.ex.equipmentId) },
    { key: 'unit', label: 'Unidade' },
    { key: 'situation', label: 'Situação', render: (_, r) => pendingBadge(r.ex) },
    { key: 'os', label: 'OS', render: (_, r) => osLink(r.ex.osId) },
    { key: 'actions', label: 'Ações', sticky: 'right', render: (_, r) => runAction(r.ex) ?? '' },
  ];
  const historyCols: TableColumn<Row>[] = [
    { key: 'due', label: 'Data prevista', render: (_, r) => formatDate(r.ex.dueDate) },
    { key: 'done', label: 'Data realizada', render: (_, r) => (r.ex.doneAt ? formatDate(r.ex.doneAt) : '-') },
    { key: 'equipment', label: 'Equipamento', render: (_, r) => equipmentCell(r.ex.equipmentId) },
    { key: 'unit', label: 'Unidade' },
    { key: 'executor', label: 'Executor', render: (_, r) => r.ex.doneBy ?? executor.primary },
    { key: 'result', label: 'Resultado', render: (_, r) => resultBadge(r.ex) },
    { key: 'anomalies', label: 'Anomalias', render: (_, r) => r.ex.anomalies ?? '-' },
    { key: 'os', label: 'OS', render: (_, r) => osLink(r.ex.osId) },
  ];

  const stateAction = can('planos', 'ativar') && (
    <DevNote note="RF602-CTA001: pausar interrompe a geração de novas execuções; reativar recalcula a partir de hoje (RGN003). Pede confirmação.">
      {paused
        ? <Button variant="secondary" iconLeft={<IconPlayerPlay size={20} />} onClick={() => setToggling(true)}>Ativar plano</Button>
        : <Button variant="secondary" iconLeft={<IconPlayerPause size={20} />} onClick={() => setToggling(true)}>Pausar plano</Button>}
    </DevNote>
  );

  const executionsTab = (
    <Stack gap="xl">
      <DevNote note="Execuções ainda não concluídas: atrasada = data prevista ultrapassada (RF602-RGN001); em breve = até 7 dias. Cada equipamento tem a sua execução e a sua OS (💡 RF601-RGN003); a OS da execução seguinte é gerada com a antecedência a confirmar (RGN002). “Executar” abre a RF603.">
        <ResponsiveTable<Row>
          id="plan-pending" title="Próximas execuções" subtitle="Execuções previstas e ainda não concluídas" columns={pendingCols} rows={pendingRows}
          emptyTitle={paused ? 'Plano pausado, sem execuções previstas' : 'Nenhuma execução prevista'}
          emptyDescription={paused ? 'Ative o plano para recalcular as próximas execuções' : undefined}
          card={(r) => ({ id: r.id, title: r.equipment, subtitle: `${formatDate(r.ex.dueDate)} · ${r.unit}`, badge: pendingBadge(r.ex), fields: [{ label: 'OS', value: osLink(r.ex.osId) }], actions: runAction(r.ex) })}
        />
      </DevNote>
      <DevNote note="RF602 / RF601-RGN005 (recorrência fixa): a execução anterior não concluída até a geração da seguinte fica “Não realizada” e continua contando como não cumprida no cumprimento. Resultado = Concluída / Não realizada. Execuções concluídas na RF603 aparecem aqui e no histórico do equipamento (RF603-RGN003).">
        <ResponsiveTable<Row>
          id="plan-history" title="Histórico de execuções" subtitle="Data prevista, data realizada, executor, resultado e anomalias" columns={historyCols} rows={historyRows}
          emptyTitle="Nenhuma execução registrada" emptyDescription="O histórico aparece depois da primeira execução prevista"
          card={(r) => ({
            id: r.id, title: r.equipment, subtitle: `Prevista para ${formatDate(r.ex.dueDate)} · ${r.unit}`, badge: resultBadge(r.ex),
            fields: [
              { label: 'Data realizada', value: r.ex.doneAt ? formatDate(r.ex.doneAt) : '-' }, { label: 'Executor', value: r.ex.doneBy ?? executor.primary },
              { label: 'Anomalias', value: r.ex.anomalies ?? '-' }, { label: 'OS', value: osLink(r.ex.osId) },
            ],
          })}
        />
      </DevNote>
    </Stack>
  );

  const configTab = (
    <Stack gap="xl">
      <Grid>
        <Col span={6} fill>
          <Card className="card-open" title="Programação" subtitle="Calendário fixo de execução">
            <div className="card-body-tight">
              <Grid>
                <Col span={6}><ReadField label="Início" value={formatDate(plan.startDate)} /></Col>
                <Col span={6}><ReadField label="Término" value={plan.endDate ? formatDate(plan.endDate) : 'Sem data de término'} /></Col>
                <Col span={12}><ReadField label="Periodicidade" value={describeFrequency(plan)} /></Col>
                <Col span={6}><ReadField label="Janela de execução" value={plan.window ? `${plan.window.from} às ${plan.window.to}` : undefined} /></Col>
                <Col span={6}><ReadField label="Duração estimada" value={plan.durationH ? `${String(plan.durationH).replace('.', ',')} h` : undefined} /></Col>
              </Grid>
            </div>
          </Card>
        </Col>
        <Col span={6} fill>
          <Card className="card-open" title="Executor" subtitle="Responsável pelas OS geradas pelo plano">
            <div className="card-body-tight">
              <Grid>
                <Col span={6}><ReadField label="Tipo de executor" value={plan.executor.kind === 'interno' ? 'Equipe interna' : 'Prestador externo'} /></Col>
                <Col span={6}><ReadField label={plan.executor.kind === 'interno' ? 'Executor padrão' : 'Prestador padrão'} value={executor.primary} /></Col>
                {plan.executor.kind === 'prestador' && <Col span={12}><ReadField label="Técnico" value={plan.executor.technician ?? 'Qualquer técnico do prestador'} /></Col>}
                {!executor.active && <Col span={12}><Feedback type="warning" message="O executor padrão está inativo. Edite o plano e escolha outro" /></Col>}
              </Grid>
            </div>
          </Card>
        </Col>
      </Grid>

      <DevNote note="RF601-FLU008: associar/desassociar equipamentos depois de criado o plano (Dialog com checkboxes agrupados por unidade). Vale só para execuções futuras (RGN004).">
        <Card
          className="card-open" title="Equipamentos associados" subtitle={`${plan.equipmentIds.length} ${plan.equipmentIds.length === 1 ? 'equipamento' : 'equipamentos'} seguem este plano`}
          actions={can('planos', 'editar') && <Button size="sm" variant="secondary" iconLeft={<IconPencil size={16} />} onClick={() => setEditingEquipments(true)}>Gerenciar equipamentos</Button>}
        >
          <div className="card-body-tight">
            <Grid>
              {plan.equipmentIds.map((id) => (
                <Col key={id} span={6}><CellPair primary={equipmentCell(id)} secondary={unitName(db, eqOf(id)?.unitId ?? '')} /></Col>
              ))}
            </Grid>
          </div>
        </Card>
      </DevNote>

      <Grid>
        <Col span={6} fill>
          <Card className="card-open" title="Checklist" subtitle="Procedimentos executados em cada preventiva">
            <div className="card-body-tight">
              <Stack gap="md">
                {plan.checklist.map((c) => (
                  <Stack key={c.id} direction="horizontal" justify="between" align="start" gap="md">
                    <span className="page-text"><strong>{c.text}</strong>{c.kind === 'leitura' && c.unit ? ` (${c.unit})` : ''}</span>
                    <Badge status={c.kind === 'opcional' ? 'neutral' : c.kind === 'leitura' ? 'info' : 'brand'}>{CHECKLIST_KIND_LABEL[c.kind]}</Badge>
                  </Stack>
                ))}
              </Stack>
            </div>
          </Card>
        </Col>
        <Col span={6} fill>
          <Card className="card-open" title="Evidências e anomalias" subtitle="Exigências para concluir a execução">
            <div className="card-body-tight">
              <Grid>
                <Col span={12}><ReadField label="Evidências obrigatórias" value={plan.evidences.length ? plan.evidences.join(', ') : 'Nenhuma'} /></Col>
                <Col span={12}>
                  <DevNote note="RF601 / RF603-RGN002: com “abrir solicitação corretiva”, a anomalia registrada na execução gera uma solicitação vinculada ao equipamento, que segue o fluxo normal de triagem (RF603-RGN004 / P15).">
                    <ReadField label="Em caso de anomalia" value={plan.onAnomaly === 'abrir-solicitacao' ? 'Abrir solicitação corretiva automaticamente' : 'Apenas registrar a anomalia'} />
                  </DevNote>
                </Col>
              </Grid>
            </div>
          </Card>
        </Col>
      </Grid>
    </Stack>
  );

  return (
    <AppLayout active="planos" screen="planos">
      <Stack gap="xl">
        <PageHeader
          title={plan.name}
          badge={<Badge status={paused ? 'neutral' : 'success'} dot>{paused ? 'Pausado' : 'Ativo'}</Badge>}
          subtitle={plan.description}
          breadcrumb={[{ label: 'Planos de manutenção', href: 'planos.html' }, { label: plan.name }]}
          actions={(
            <>
              {stateAction}
              {can('planos', 'editar') && (
                <DevNote note="Alterar o plano afeta só as execuções futuras (RF601-RGN004); o histórico é preservado.">
                  <Button iconLeft={<IconPencil size={20} />} onClick={() => goTo(`plano-form.html?id=${plan.id}`)}>Editar</Button>
                </DevNote>
              )}
            </>
          )}
        />

        {paused && <Feedback type="info" title="Plano pausado" message="Não gera novas execuções. Ao ativar, as próximas datas são recalculadas a partir de hoje" />}

        <Grid>
          <Col span={4} fill>
            <KpiCard
              label="Próxima execução" value={stats.next ? formatDate(stats.next.dueDate) : '-'}
              description={stats.next ? (eqOf(stats.next.equipmentId)?.name ?? '') : paused ? 'Plano pausado' : 'Nenhuma prevista'} icon={<IconCalendarEvent size={20} />}
            />
          </Col>
          <Col span={4} fill>
            <KpiCard label="Execuções atrasadas" value={formatNumber(stats.late.length)} description="Previstas e ainda não concluídas" icon={<IconAlertTriangle size={20} />} />
          </Col>
          <Col span={4} mobileFull fill>
            <DevNote note="RF602-RGN002: concluídas ÷ previstas nos últimos 30 dias, só deste plano.">
              <KpiCard
                label="Cumprimento · 30 dias" value={comp.pct === null ? '-' : `${comp.pct}%`}
                description={comp.planned ? `${comp.done} de ${comp.planned} execuções concluídas` : 'Sem execuções previstas no período'} icon={<IconChecks size={20} />}
              />
            </DevNote>
          </Col>
        </Grid>

        <DevNote note="Duas abas: Execuções (próximas + histórico, RF602) e Configuração do plano (resumo de RF601: programação, executor, equipamentos, checklist, evidências e comportamento em anomalia).">
          <Tab aria-label="Informações do plano" tabs={[{ label: 'Execuções', content: executionsTab }, { label: 'Configuração do plano', content: configTab }]} />
        </DevNote>
      </Stack>
      <PlanStatusDialog plan={toggling ? plan : null} onClose={() => setToggling(false)} />
      {editingEquipments && <PlanEquipmentsDialog plan={plan} onClose={() => setEditingEquipments(false)} />}
    </AppLayout>
  );
}

mountApp(<PlanoScreen />);
