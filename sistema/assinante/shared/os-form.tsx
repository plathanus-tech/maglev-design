import { FormEvent, useEffect, useState } from 'react';
import { IconClipboardOff } from '@tabler/icons-react';
import { Button, Card, DatePicker, Dropdown, EmptyState, Feedback, Input, Stack, Textarea } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useHashState } from '../../admin/shared/useHashState';
import { requiredMessage, formatDate, formatPhone, isValidPhone, onlyDigits } from '../../admin/shared/format';
import { nowLocal } from './data';
import type { WorkOrder } from './data';
import { logEntry, nextSeq, notify, unitName, environmentName, updateSubDb, useSubSession, userName } from './store';
import { Col, Grid, goTo, param, setFlash, useRefs } from './ui';
import {
  PlanFields, STO, TODAY, executorOf, executorText, isEditable, notifyAssignees, patchOrder, planChangeLogs, planOf, planProblems, providerLabel,
} from './os-common';
import type { PlanValue } from './os-common';

/** Estados: idle (criar/editar) · required (campos obrigatórios) · noorigin (sem solicitação nem OS) · providerfilter (prestador externo selecionado) */
const STATES = ['idle', 'create', 'edit', 'required', 'noorigin', 'providerfilter'] as const;
type Mode = (typeof STATES)[number];

function OsFormScreen() {
  const refs = useRefs();
  const { db, user, can } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const editing = db.orders.find((o) => o.id === param('id'));
  const request = db.requests.find((r) => r.id === param('request'));
  const origin = editing ? db.requests.find((r) => r.id === editing.requestId) : request;
  const eq = db.equipments.find((e) => e.id === (editing?.equipmentId ?? request?.equipmentId));

  const [subject, setSubject] = useState(editing?.subject ?? (request ? `${refs.requestType(request.problemId)?.name ?? 'Manutenção'} - ${eq?.name ?? ''}` : ''));
  const [reported, setReported] = useState(editing?.reported ?? request?.description ?? '');
  const [maintTypeId, setMaintTypeId] = useState(editing?.maintTypeId ?? request?.maintTypeId ?? '');
  const [priorityId, setPriorityId] = useState(editing?.priorityId ?? request?.priorityId ?? '');
  const [plan, setPlan] = useState<PlanValue>(() => (editing ? planOf(editing) : {
    responsibleId: request?.responsibleId ?? user.id, kind: 'interno', userId: '', providerId: '', technician: '',
  }));
  const [dueAt, setDueAt] = useState(editing?.dueAt ?? '');
  const [sDate, setSDate] = useState(editing?.schedule?.date ?? '');
  const [sFrom, setSFrom] = useState(editing?.schedule?.from ?? '');
  const [sTo, setSTo] = useState(editing?.schedule?.to ?? '');
  const [contactName, setContactName] = useState(editing?.contactName ?? request?.requesterName ?? '');
  const [contactPhone, setContactPhone] = useState(formatPhone(editing?.contactPhone ?? request?.requesterPhone ?? ''));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) return;
    if (mode === 'required') { setSubject(''); setReported(''); setPlan((p) => ({ ...p, responsibleId: '' })); setTried(true); }
    if (mode === 'providerfilter') setPlan((p) => ({ ...p, kind: 'prestador' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const title = editing ? `Editar ${editing.id}` : 'Nova OS';
  const crumbs = [{ label: 'Ordens de serviço', href: 'ordens-servico.html' }, { label: editing ? 'Editar' : 'Nova OS' }];
  const wrap = (body: React.ReactNode) => <AppLayout active="os" screen="os">{body}</AppLayout>;
  const blocked = (iconTitle: string, description: string, action?: React.ReactNode) => wrap(
    <Stack gap="xl">
      <PageHeader title={title} breadcrumb={crumbs} />
      <Card><EmptyState icon={<IconClipboardOff size={32} />} title={iconTitle} description={description} headingLevel={2} action={action} /></Card>
    </Stack>,
  );

  // Sem origem: RGN001 - toda OS nasce de uma solicitação aprovada ou de um plano
  if ((!editing && !request) || mode === 'noorigin') {
    return blocked('Toda OS nasce de uma solicitação ou de um plano de preventiva', 'Não é possível criar uma OS avulsa. Abra uma solicitação aprovada na triagem e use “Criar OS”.',
      <Button variant="secondary" onClick={() => goTo('solicitacoes.html')}>Ir para Solicitações</Button>);
  }
  if (!can('os', editing ? 'editar' : 'cadastrar') || user.profile === 'executor') {
    return blocked('Você não tem permissão para planejar OS', 'Criar e classificar OS é feito pelo Administrador ou pelo Gestor de manutenção.', <Button variant="secondary" onClick={() => goTo('ordens-servico.html')}>Voltar às OS</Button>);
  }
  if (editing && !isEditable(refs.base(editing.statusId))) {
    return blocked('Esta OS não pode mais ser editada', 'OS concluídas ou canceladas ficam somente para leitura.', <Button variant="secondary" onClick={() => goTo(`os.html?id=${editing.id}`)}>Ver a OS</Button>);
  }
  if (!editing && request) {
    if (request.osId) return blocked('Esta solicitação já virou OS', `A solicitação ${request.id} já está vinculada à ${request.osId}.`, <Button variant="secondary" onClick={() => goTo(`os.html?id=${request.osId}`)}>Ver a OS</Button>);
    if (request.statusId !== 'STS-04') return blocked('A solicitação ainda não foi aprovada', `A OS só pode ser criada a partir de uma solicitação aprovada na triagem (${request.id}).`, <Button variant="secondary" onClick={() => goTo(`solicitacao.html?id=${request.id}`)}>Abrir a triagem</Button>);
  }
  if (!eq) return blocked('Equipamento não encontrado', 'Volte e tente novamente.');

  const hasSchedule = !!sDate;
  const problems = {
    subject: !subject.trim() ? requiredMessage('Assunto') : undefined,
    reported: !reported.trim() ? requiredMessage('Problema relatado') : undefined,
    maintTypeId: !maintTypeId ? requiredMessage('Tipo de manutenção') : undefined,
    priorityId: !priorityId ? requiredMessage('Prioridade') : undefined,
    ...planProblems(plan),
    dueAt: !dueAt ? requiredMessage('Prazo') : undefined,
    sFrom: hasSchedule && !sFrom ? requiredMessage('Início da janela') : undefined,
    sTo: hasSchedule && !sTo ? requiredMessage('Fim da janela') : hasSchedule && sFrom && sTo <= sFrom ? 'O fim da janela deve ser depois do início' : undefined,
    contactName: !contactName.trim() ? requiredMessage('Contato responsável na unidade') : undefined,
    contactPhone: contactPhone && !isValidPhone(contactPhone) ? 'Informe um telefone válido' : undefined,
  };
  const show = (k: keyof typeof problems) => (tried ? problems[k] : undefined);
  const invalid = Object.values(problems).some(Boolean);
  const planErrors = { responsibleId: show('responsibleId'), userId: show('userId'), providerId: show('providerId') };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (invalid) {
      window.setTimeout(() => { const f = document.querySelector<HTMLElement>('form [aria-invalid="true"]'); f?.scrollIntoView({ block: 'center' }); f?.focus({ preventScroll: true }); }, 0);
      return;
    }
    setSaving(true);
    const executor = executorOf(plan);
    const schedule = sDate ? { date: sDate, from: sFrom, to: sTo } : undefined;
    const common = {
      subject: subject.trim(), reported: reported.trim(), maintTypeId, priorityId, responsibleId: plan.responsibleId, executor, dueAt, schedule,
      contactName: contactName.trim(), contactPhone: onlyDigits(contactPhone),
    };
    const prestadorLog = (ex: typeof executor) => (ex.kind === 'prestador' ? [`Notificou o prestador ${providerLabel(db, ex.providerId)} (sem login na plataforma)`] : []);

    if (editing) {
      const logs: string[] = [];
      if (common.subject !== editing.subject) logs.push(`Alterou o assunto para “${common.subject}”`);
      if (common.reported !== editing.reported) logs.push('Editou o problema relatado');
      if (maintTypeId !== editing.maintTypeId) logs.push(`Reclassificou o tipo de manutenção de ${refs.maintType(editing.maintTypeId)?.name} para ${refs.maintType(maintTypeId)?.name}`);
      if (priorityId !== editing.priorityId) logs.push(`Alterou a prioridade de ${refs.priority(editing.priorityId)?.name} para ${refs.priority(priorityId)?.name}`);
      if (dueAt !== editing.dueAt) logs.push(`Alterou o prazo de ${formatDate(editing.dueAt)} para ${formatDate(dueAt)}`);
      const oldS = editing.schedule ? `${formatDate(editing.schedule.date)} ${editing.schedule.from}-${editing.schedule.to}` : 'sem agendamento';
      const newS = schedule ? `${formatDate(schedule.date)} ${schedule.from}-${schedule.to}` : 'sem agendamento';
      if (oldS !== newS) logs.push(`Reagendou o atendimento de ${oldS} para ${newS}`);
      if (common.contactName !== editing.contactName || common.contactPhone !== editing.contactPhone) logs.push(`Alterou o contato na unidade para ${common.contactName}`);
      const planLogs = planChangeLogs(db, editing, common);
      const execChanged = executorText(db, editing.executor) !== executorText(db, executor);
      logs.push(...planLogs, ...(execChanged ? prestadorLog(executor) : []));
      if (!logs.length) { setSaving(false); setFlash({ type: 'info', title: 'Nada foi alterado', message: 'Nenhum dado da OS foi modificado.' }); goTo(`os.html?id=${editing.id}`); return; }
      patchOrder(editing.id, user.name, (o) => ({ ...o, ...common }), logs);
      notifyAssignees(db, { ...editing, ...common }, { responsible: editing.responsibleId !== plan.responsibleId, executor: execChanged });
      setFlash({ type: 'success', title: 'OS atualizada', message: 'As alterações foram salvas e registradas nas atividades.' });
      window.setTimeout(() => goTo(`os.html?id=${editing.id}`), 300);
      return;
    }

    const id = nextSeq('OS', db.orders.map((o) => o.id));
    const now = nowLocal();
    const order: WorkOrder = {
      id, kind: 'corretiva', requestId: request!.id, equipmentId: eq.id, statusId: STO.ABERTA, createdAt: now,
      visits: [], costs: [], files: [], troubleshooting: request!.troubleshooting, ...common,
      activities: [
        logEntry(user.name, `Criou a OS a partir da solicitação ${request!.id}`),
        logEntry(user.name, `Atribuiu a OS a ${userName(db, plan.responsibleId)} (responsável) e a ${executorText(db, executor)} (executor)`),
        ...prestadorLog(executor).map((t) => logEntry('Sistema', t)),
      ],
    };
    updateSubDb((d) => ({
      ...d,
      orders: [...d.orders, order],
      requests: d.requests.map((r) => (r.id !== request!.id ? r : {
        ...r, statusId: 'STS-05', statusChangedAt: now, osId: id, maintTypeId, priorityId, responsibleId: plan.responsibleId,
        log: [...r.log, logEntry(user.name, `Criou a ${id} - status: Convertida em OS`)],
      })),
      equipments: d.equipments.map((x) => (x.id === eq.id && x.statusId === 'STE-01' ? { ...x, statusId: 'STE-04' } : x)),
    }));
    notifyAssignees(db, order, { responsible: true, executor: true });
    if (request!.requesterUserId) notify([request!.requesterUserId], { kind: 'solicitacao', title: 'Sua solicitação virou uma OS', text: `${request!.id} → ${id}`, href: `os.html?id=${id}` });
    setFlash({ type: 'success', title: 'OS criada', message: `${id} criada e vinculada à solicitação ${request!.id}. Responsável e executor foram notificados.` });
    window.setTimeout(() => goTo(`os.html?id=${id}`), 300);
  };

  return wrap(
    <form className="form-page" onSubmit={onSubmit} noValidate>
      <Stack gap="xl">
        <PageHeader
          title={title} breadcrumb={crumbs}
          subtitle={editing ? 'Reclassifique, reatribua, reagende ou altere prioridade e prazo enquanto a OS não for concluída' : 'Os dados da solicitação já vêm preenchidos; defina quem atende e até quando'}
        />
        {tried && invalid && (
          <div className="floating-feedback"><Feedback type="error" title="Preencha os campos obrigatórios" message="Revise os campos destacados para continuar" /></div>
        )}

        <DevNote note="RF502-RGN001: toda OS corretiva nasce de uma solicitação aprovada na triagem; sem ?request= nem ?id= esta tela é bloqueada (variante “Sem origem”). Preventivas são geradas pelo plano (RF601).">
          <Card className="card-open" title="Origem" subtitle="Dados herdados da solicitação e do equipamento">
            <div className="card-body-tight">
              <Grid>
                <Col span={6}><DevNote note="Número automático e sequencial por assinante (ex.: OS-000012)."><Input label="Nº da OS" readOnly value={editing?.id ?? 'Gerado ao salvar'} /></DevNote></Col>
                <Col span={6}><Input label={origin ? 'Solicitação de origem' : 'Plano de preventiva'} readOnly value={origin?.id ?? editing?.planId ?? '-'} /></Col>
                <Col span={12}><Input label="Equipamento" readOnly value={eq.name} /></Col>
                <Col span={6}><Input label="Unidade" readOnly value={unitName(db, eq.unitId)} /></Col>
                <Col span={6}><Input label="Ambiente" readOnly value={environmentName(db, eq.environmentId)} /></Col>
              </Grid>
            </div>
          </Card>
        </DevNote>

        <Card className="card-open" title="Classificação" subtitle="O que será feito e com qual urgência">
          <div className="card-body-tight">
            <Grid>
              <Col span={12}><Input label="Assunto" required autoComplete="off" value={subject} onChange={(e) => setSubject(e.target.value)} error={show('subject')} /></Col>
              <Col span={12}>
                <DevNote note="Herdado da solicitação e editável (RF502).">
                  <Textarea label="Problema relatado" required rows={3} value={reported} onChange={(e) => setReported(e.target.value)} error={show('reported')} />
                </DevNote>
              </Col>
              <Col span={6}>
                <DevNote note="Tipo de manutenção (Admin RF404) e prioridade (RF405) já vêm da triagem; podem ser reclassificados enquanto a OS não for concluída. Cada alteração vai para as atividades (RGN003).">
                  <Dropdown label="Tipo de manutenção" required placeholder="Selecione o tipo" options={refs.admin.maintenanceTypes.filter((t) => t.status === 'ativo' || t.id === maintTypeId).map((t) => ({ value: t.id, label: t.name }))} value={maintTypeId} onChange={setMaintTypeId} error={show('maintTypeId')} />
                </DevNote>
              </Col>
              <Col span={6}><Dropdown label="Prioridade" required placeholder="Selecione a prioridade" options={refs.admin.priorities.map((p) => ({ value: p.id, label: p.name }))} value={priorityId} onChange={setPriorityId} error={show('priorityId')} /></Col>
            </Grid>
          </div>
        </Card>

        <Card className="card-open" title="Responsável e executor" subtitle="Quem responde pela OS e quem executa o atendimento">
          <div className="card-body-tight">
            <PlanFields db={db} value={plan} onChange={setPlan} categoryId={eq.categoryId} unitId={eq.unitId} errors={planErrors} currentProviderId={editing?.executor.kind === 'prestador' ? editing.executor.providerId : undefined} />
          </div>
        </Card>

        <Card className="card-open" title="Prazo, agendamento e contato" subtitle="Data limite, janela de atendimento e quem recebe o técnico na unidade">
          <div className="card-body-tight">
            <Grid>
              <Col span={6}><DatePicker label="Prazo" required value={dueAt} onChange={setDueAt} min={editing ? undefined : TODAY} error={show('dueAt')} helperText="Data limite para conclusão" /></Col>
              <Col span={12}>
                <DevNote note="💡 P09 (RF502-RGN004) a confirmar: quem define o agendamento - o gestor, o prestador ou ambos. Aqui o gestor pode agendar e o executor/prestador também registra visitas na OS (RF503).">
                  <DatePicker label="Data do agendamento" optional value={sDate} onChange={setSDate} min={editing ? undefined : TODAY} />
                </DevNote>
              </Col>
              <Col span={6}><Input label="Início da janela" type="time" optional={!hasSchedule} required={hasSchedule} value={sFrom} onChange={(e) => setSFrom(e.target.value)} error={show('sFrom')} /></Col>
              <Col span={6}><Input label="Fim da janela" type="time" optional={!hasSchedule} required={hasSchedule} value={sTo} onChange={(e) => setSTo(e.target.value)} error={show('sTo')} /></Col>
              <Col span={6}>
                <DevNote note="Contato responsável na unidade: pré-preenchido com o solicitante (RF502).">
                  <Input label="Contato responsável na unidade" required autoComplete="off" value={contactName} onChange={(e) => setContactName(e.target.value)} error={show('contactName')} />
                </DevNote>
              </Col>
              <Col span={6}><Input label="Telefone do contato" optional type="tel" placeholder="(00) 00000-0000" value={contactPhone} onChange={(e) => setContactPhone(formatPhone(e.target.value))} error={show('contactPhone')} /></Col>
            </Grid>
          </div>
        </Card>

        <Stack direction="horizontal" justify="start" gap="sm" wrap>
          <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar OS'}</Button>
          <Button variant="secondary" disabled={saving} onClick={() => goTo(editing ? `os.html?id=${editing.id}` : request ? `solicitacao.html?id=${request.id}` : 'ordens-servico.html')}>Cancelar</Button>
        </Stack>
      </Stack>
    </form>,
  );
}

mountApp(<OsFormScreen />);
