import { ReactNode, useEffect, useRef, useState } from 'react';
import { IconArrowLeft, IconCalendar, IconCheck, IconCircleCheck, IconCircleX, IconClipboardList, IconPhone, IconPhoto, IconPlus, IconTool } from '@tabler/icons-react';
import { Badge, Button, Card, DatePicker, Dialog, Dropdown, EmptyState, Feedback, Input, Stack, Textarea, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { formatDate, formatDateTime, formatMoney, formatPhone, maskMoney, requiredMessage } from '../../admin/shared/format';
import { useHashState } from '../../admin/shared/useHashState';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import '../../assinante/shared/preventivas.css';
import { ReadField } from '../../admin/shared/ui';
import { ExternalLayout, PageHeader, mountApp } from '../../externo/shared/ExternalLayout';
import { COST_KIND_LABEL, CostKind, WorkOrder, nowLocal } from '../../assinante/shared/data';
import { CopyCode } from '../../assinante/shared/copy-code';
import { ShareButton } from '../../assinante/shared/share-button';
import { AttachmentsField, AttachmentsStack, AttachmentsView, namesOf, Picked } from '../../assinante/shared/attachments';
import { AttachmentField, STO, applyOrderConclusion, dueCell, overdueDays, parseCents, patchOrder } from '../../assinante/shared/os-common';
import { getSubDb, notify } from '../../assinante/shared/store';
import { goTo, param, useRefs } from '../../assinante/shared/ui';
import { AddressLink, BlockedAccess, dueInfo, linkTo, unitAddress, useProviderLink } from './lib';
import { photoSrc } from '../../assinante/shared/photos';
import '../../assinante/shared/equipamento.css';
import '../../assinante/shared/os.css';
import '../../assinante/shared/solicitacao.css';

/** Estados: idle · expired (OS encerrada: link expirado) · budget (aguardando aprovação do orçamento) · budgetform (diagnóstico com o formulário de orçamento aberto) · validation (aguardando validação) */
const STATES = ['idle', 'expired', 'budget', 'budgetform', 'validation'] as const;
type Mode = (typeof STATES)[number];

const FOTO_LABEL: Record<string, string> = { antes: 'Foto antes', depois: 'Foto depois', anexo: 'Anexo' };

/**
 * Atendimento da OS (Prestador RF102), pelo link e no celular: aceite → agendamento da visita → chegada → diagnóstico (e orçamento,
 * que bloqueia a execução até a aprovação do assinante) → execução (solução, atividades, fotos, anexos, materiais, horas, custos,
 * observações) → indicar a conclusão (a OS vai para "Aguardando validação"). O prestador nunca encerra a OS (RGN003) nem aprova
 * orçamento ou valida a conclusão (RGN006); toda ação entra no histórico da OS e do equipamento (RGN004). OS preventiva usa a
 * mesma execução da Área do assinante (RF603).
 */
function AtendimentoScreen() {
  const refs = useRefs();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const { db, provider, technician, state, actorName } = useProviderLink();
  const shell = (content: ReactNode) => <ExternalLayout area="Área do prestador">{content}</ExternalLayout>;

  if (!provider || state === 'invalid') return shell(<BlockedAccess state="invalid" />);
  if (state === 'inactive') return shell(<BlockedAccess state="inactive" />);

  // RGN002: só OS atribuídas a ele (e, no link individual, ao técnico)
  const order = db.orders.find((o) => o.id === param('os')
    && o.executor.kind === 'prestador' && o.executor.providerId === provider.id
    && (!technician || o.executor.technician === technician.name));
  const back = (
    <div>
      <Button variant="ghost" size="sm" iconLeft={<IconArrowLeft size={16} />} onClick={() => goTo(linkTo('minhas-os.html', provider, technician))}>Minhas OS</Button>
    </div>
  );
  if (!order) {
    return shell(
      <Stack gap="lg">
        <div className="ext-empty is-page"><EmptyState compact icon={<IconClipboardList size={32} />} headingLevel={1} title="OS não encontrada" description="Esta OS não está atribuída a você ou o link não vale mais" /></div>
        {back}
      </Stack>,
    );
  }
  const base = refs.base(order.statusId);
  const closed = base === 'concluido' || base === 'cancelado' || mode === 'expired';
  if (closed && !(order.kind === 'preventiva' && base === 'concluido')) {
    return shell(
      <Stack gap="lg">
        <DevNote note="Prestador RF001-RGN004 (💡 sugestão): o link expira quando a OS é encerrada ou cancelada, ou quando o prestador é inativado.">
          <div className="ext-empty is-page">
            <EmptyState
              compact icon={base === 'cancelado' ? <IconCircleX size={32} /> : <IconCircleCheck size={32} />} headingLevel={1} title={base === 'cancelado' ? 'OS cancelada' : 'Atendimento encerrado'}
              description={base === 'cancelado' ? 'Esta OS foi cancelada e não precisa mais de atendimento' : 'Esta OS já foi concluída e validada pelo cliente. O acesso a ela foi encerrado'}
            />
          </div>
        </DevNote>
        {back}
      </Stack>,
    );
  }
  return shell(<Atendimento order={order} mode={mode} back={back} actorName={actorName} technicianId={technician?.id} providerId={provider.id} />);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

function Atendimento({ order, mode, back, actorName, technicianId, providerId }: { order: WorkOrder; mode: Mode; back: ReactNode; actorName: string; technicianId?: string; providerId: string }) {
  const toast = useToast();
  const refs = useRefs();
  const btnSize = useIsMobile() ? 'sm' as const : 'md' as const;   // mobile: botões de apoio em tamanho small
  const { db, provider } = useProviderLink();
  const eq = db.equipments.find((e) => e.id === order.equipmentId);
  const unit = db.units.find((u) => u.id === eq?.unitId);
  const env = db.environments.find((x) => x.id === eq?.environmentId);
  const base = refs.base(order.statusId);
  const late = overdueDays(order, base);
  const preventive = order.kind === 'preventiva';
  const accepted = !!order.accepted || (order.statusId !== STO.ABERTA && order.statusId !== STO.PRESTADOR);
  const budgetPending = !!order.budget && order.budget.decision !== 'aprovado';
  const waitingApproval = order.statusId === STO.APROVACAO || (mode === 'budget' && !!order.budget);
  const waitingValidation = order.statusId === STO.VALIDACAO || mode === 'validation';
  const rejected = order.budget?.decision === 'reprovado';
  const canExecute = accepted && !budgetPending && !waitingValidation;
  const [dlg, setDlg] = useState<null | 'visit' | 'cost' | 'file' | 'conclude'>(null);
  const close = () => setDlg(null);
  const link = (page: string) => linkTo(page, { id: providerId }, technicianId ? { id: technicianId } : undefined, { os: order.id });

  const due = dueInfo(order, base);
  const [photoOpen, setPhotoOpen] = useState(false);
  const visitsClosed = waitingValidation || base === 'concluido' || base === 'cancelado';
  const hasPendingVisit = order.visits.some((v) => !v.arrivedAt);
  const photo = photoSrc(eq?.photoName);

  // Histórico autorizado do equipamento (RF102-FLU001; 💡 definir o que é "autorizado"): intervenções concluídas, sem custos
  const history = db.orders.filter((o) => o.equipmentId === order.equipmentId && o.id !== order.id && refs.base(o.statusId) === 'concluido')
    .sort((a, b) => (b.validation?.at ?? b.createdAt).localeCompare(a.validation?.at ?? a.createdAt));
  const [eqHistAll, setEqHistAll] = useState(false);
  const [osHistAll, setOsHistAll] = useState(false);
  const osHistory = [...order.activities].sort((a, b) => b.at.localeCompare(a.at));
  const COMPACT = 3;

  const act = (patch: (o: WorkOrder) => WorkOrder, logs: string[]) => patchOrder(order.id, actorName, patch, logs);

  // ── Ações ──
  const accept = () => {
    act((o) => ({ ...o, accepted: { at: nowLocal(), by: actorName }, statusId: o.statusId === STO.ABERTA || o.statusId === STO.PRESTADOR ? STO.ANDAMENTO : o.statusId }), ['Aceitou o atendimento - status: Em andamento']);
    toast.show({ type: 'success', title: 'Atendimento aceito', message: 'Agora agende a visita com o contato da unidade.' });
  };
  const checkedIn = useRef(new Set<string>());
  const checkIn = (visitId: string) => {
    if (checkedIn.current.has(visitId) || order.visits.find((v) => v.id === visitId)?.arrivedAt) return;
    checkedIn.current.add(visitId);
    act((o) => ({ ...o, visits: o.visits.map((v) => (v.id === visitId && !v.arrivedAt ? { ...v, arrivedAt: nowLocal() } : v)) }), ['Registrou a chegada ao local (check-in)']);
    toast.show({ type: 'success', title: 'Chegada registrada', message: 'A data e a hora ficaram no histórico da OS.' });
  };

  return (
    <Stack gap="lg">
      <Stack gap="md">
        {back}
        <header className="ext-at-head">
          <div className="ext-at-title">
            <h1 className="page-title">{preventive ? 'Atendimento da preventiva' : 'Atendimento da OS'}</h1>
            <span className="ext-at-share"><ShareButton kind={preventive ? 'preventiva' : 'os'} id={order.id} /></span>
          </div>
          <p className="ext-at-id"><CopyCode code={order.id} /> · {order.subject}</p>
          {refs.statusBadge(order.statusId)}
        </header>
      </Stack>

      {rejected && !waitingApproval && <Feedback type="warning" title="Orçamento reprovado" message={`${order.budget?.justification ? `Motivo: ${order.budget.justification}. ` : ''}Envie um novo orçamento para continuar`} />}
      {waitingValidation && (
        <DevNote note="Prestador RF102-RGN003 / CTA003: o prestador só indica a conclusão. A OS fica em “Aguardando validação” e quem valida e encerra é o assinante (o solicitante responde “O problema foi resolvido?”).">
          <Feedback type="success" title="Conclusão indicada" message="Aguardando confirmação do cliente para encerrar a OS." />
        </DevNote>
      )}

      <Card className="card-open" title="Dados da OS" actions={<Badge status={preventive ? 'info' : 'neutral'}>{preventive ? 'Preventiva' : 'Corretiva'}</Badge>}>
        <div className="card-body-tight">
          <Stack gap="md">
            <div className="ext-field">
              <span className="ext-field-label">Problema relatado</span>
              <p className="ext-problem-text">{order.reported}</p>
            </div>
            <div className="ext-pair">
              <div className="ext-field">
                <span className="ext-field-label">Prioridade</span>
                <span>{refs.priorityBadge(order.priorityId)}</span>
              </div>
              <div className="ext-field">
                <span className="ext-field-label">Prazo de atendimento</span>
                <div className="ext-os-due">
                  <IconCalendar size={16} aria-hidden="true" />
                  <div>
                    <span className="ext-os-due-date">{due.date}</span>
                    {due.text && <span className={`ext-os-due-rel is-${due.tone}`}>{due.text}</span>}
                  </div>
                </div>
              </div>
            </div>
            <DevNote note="Prestador RF102-FLU003: contato responsável na unidade (nome e telefone) para agendar a visita.">
              <div className="ext-contact">
                <div>
                  <span className="ext-contact-label">Contato na unidade</span>
                  <span className="ext-contact-name">{order.contactName || '-'}</span>
                  {order.contactPhone && <span className="ext-contact-phone">{formatPhone(order.contactPhone)}</span>}
                </div>
                {order.contactPhone && (
                  <a className="ext-call" href={`tel:${order.contactPhone.replace(/\D/g, '')}`} aria-label={`Ligar para ${order.contactName || 'o contato'}, ${formatPhone(order.contactPhone)}`}><IconPhone size={16} aria-hidden="true" />Ligar</a>
                )}
              </div>
            </DevNote>
          </Stack>
        </div>
      </Card>

      <Card className="card-open" title="Equipamento">
        <div className="card-body-tight">
          <Stack gap="md">
            <div className="os-eq-id">
              {eq?.photoName ? (
                <button type="button" className="sol-photo os-eq-photo" onClick={() => setPhotoOpen(true)} aria-label={`Ampliar a foto do equipamento ${eq.name}`}>
                  {photo ? <img src={photo} alt="" /> : <IconPhoto size={20} aria-hidden="true" />}
                </button>
              ) : (
                <span className="sol-photo os-eq-photo is-empty" role="img" aria-label="Equipamento sem foto cadastrada"><IconPhoto size={20} aria-hidden="true" /></span>
              )}
              <div className="os-eq-text">
                <span className="os-eq-name">{eq?.name ?? '-'}</span>
                <span className="ext-eq-meta">{eq?.code ?? '-'} · {refs.category(eq?.categoryId)?.name ?? '-'}</span>
                <dl className="os-eq-spec">
                  <div><dt>Fabricante</dt><dd>{eq?.maker || '-'}</dd></div>
                  <div><dt>Modelo</dt><dd>{eq?.model || '-'}</dd></div>
                </dl>
              </div>
            </div>
            <div className="os-eq-loc">
              <ReadField label="Unidade" value={unit?.name ?? '-'} />
              <ReadField label="Ambiente" value={env?.name ?? '-'} />
              <ReadField label="Endereço" value={<AddressLink address={unitAddress(db, eq)} />} />
            </div>
          </Stack>
        </div>
      </Card>

      {!preventive && (
        <DevNote note="Prestador RF102-FLU001: informações do equipamento e histórico autorizado. 💡 Definir o que é “autorizado”: aqui, só as últimas intervenções concluídas, sem custos.">
          <Card className="card-open" title="Histórico do equipamento" subtitle={history.length ? 'Últimas intervenções concluídas' : undefined}>
<div className="card-body-tight">            {history.length === 0 ? <p className="ext-note">Nenhuma intervenção anterior registrada.</p> : (
              <ol className="ext-history">
                {(eqHistAll ? history : history.slice(0, COMPACT)).map((h) => (
                  <li key={h.id} className="ext-history-item">
                    <span className="ext-history-text">{h.subject}{h.solution ? ` - ${h.solution}` : ''}</span>
                    <span className="ext-history-date">{formatDate((h.validation?.at ?? h.createdAt).slice(0, 10))}</span>
                  </li>
                ))}
              </ol>
            )}
            {history.length > COMPACT && <div className="ext-history-more"><Button variant="ghost" size="sm" aria-expanded={eqHistAll} onClick={() => setEqHistAll((v) => !v)}>{eqHistAll ? 'Ver menos' : 'Ver histórico completo'}</Button></div>}</div>
          </Card>
        </DevNote>
      )}

      <Card className="card-open" title="Histórico da OS">
        <div className="card-body-tight ext-body-snug">
          <ol className="ext-history">
            {(osHistAll ? osHistory : osHistory.slice(0, COMPACT)).map((a) => (
              <li key={a.id} className="ext-history-item">
                <span className="ext-history-text"><strong>{a.by}</strong>: {a.text}</span>
                <span className="ext-history-date">{formatDateTime(a.at)}</span>
              </li>
            ))}
          </ol>
          {osHistory.length > COMPACT && <div className="ext-history-more"><Button variant="ghost" size="sm" aria-expanded={osHistAll} onClick={() => setOsHistAll((v) => !v)}>{osHistAll ? 'Ver menos' : 'Ver histórico completo'}</Button></div>}
        </div>
      </Card>

      {preventive ? (
        <DevNote note="Prestador RF102 + Assinante RF603: a OS preventiva é executada com a mesma tela de execução da Área do assinante (checklist, leituras, fotos antes/depois, relatório, anomalia e confirmação), adaptada ao prestador. Preventiva conclui direto, sem validação do solicitante.">
          <Card className="card-open" title="Execução da preventiva" subtitle={base === 'concluido' ? 'Execução concluída' : 'Checklist, leituras e evidências do plano'}>
<div className="card-body-tight">            <div className="ext-actions">
              <Button size="lg" iconLeft={<IconTool size={20} />} onClick={() => goTo(link('execucao-preventiva.html'))}>{base === 'concluido' ? 'Ver execução' : 'Executar preventiva'}</Button>
            </div></div>
          </Card>
        </DevNote>
      ) : (
        <>
          {!accepted && (
            <DevNote note="Prestador RF102-FLU002: aceitar o atendimento. 💡 P09: confirmar quem aceita (prestador ou contato da unidade). Aceitar muda a OS para Em andamento.">
              <Card className="card-open" title="Atendimento" subtitle="Confirme que vai atender esta OS">
<div className="card-body-tight">                <div className="ext-actions"><Button size="lg" iconLeft={<IconCheck size={20} />} onClick={accept}>Aceitar atendimento</Button></div></div>
              </Card>
            </DevNote>
          )}

          {accepted && (
            <DevNote note="Prestador RF102-FLU003/FLU004 / RGN007 (v0.3): agenda ou confirma a visita (data e janela) com o contato da unidade; uma OS tem várias visitas (revisitas), cada uma com agendamento e chegada próprios. Check-in com data/hora, sem geolocalização, quando fizer sentido operacional (RGN005).">
              <Card className="card-open" title="Visitas" subtitle="Agendamento e chegada ao local">
<div className="card-body-tight">                <Stack gap="md">
                  {order.visits.length === 0 && <p className="ext-item-meta">Nenhuma visita agendada.</p>}
                  {order.visits.length > 0 && (
                    <ul className="ext-visits">
                      {order.visits.map((v, i) => (
                        <li key={v.id} className="ext-visit">
                          <div className="ext-item-head">
                            <span className="ext-item-title">{i === 0 ? 'Visita' : 'Revisita'} · {formatDate(v.date)}</span>
                            {v.arrivedAt ? <Badge status="success" dot>Chegada registrada · {formatDateTime(v.arrivedAt).slice(-5)}</Badge> : <Badge status="neutral" dot>Agendada</Badge>}
                          </div>
                          <p className="ext-item-meta">{v.from} às {v.to} · {v.technician}{v.note ? ` · ${v.note}` : ''}</p>
                          {!v.arrivedAt && !visitsClosed && <div className="ext-visit-action"><Button size="sm" onClick={() => checkIn(v.id)}>Registrar chegada</Button></div>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* Sem visita pendente (nenhuma agendada ou todas com chegada) e atendimento em andamento: agenda a próxima; com uma visita já agendada, a ação principal é a chegada dela */}
                  {!visitsClosed && !hasPendingVisit && (
                    <div className="ext-actions"><Button size={btnSize} variant={order.visits.length ? 'secondary' : 'primary'} iconLeft={<IconPlus size={btnSize === 'sm' ? 16 : 20} />} onClick={() => setDlg('visit')}>{order.visits.length ? 'Agendar revisita' : 'Agendar visita'}</Button></div>
                  )}
                </Stack></div>
              </Card>
            </DevNote>
          )}

          {accepted && (
            <DiagnosisCard order={order} actorName={actorName} disabled={waitingValidation} defaultBudgetOpen={mode === 'budgetform'} />
          )}

          {accepted && (
            <DevNote note="Prestador RF102-FLU006 / RGN005 (29/09): solução, atividades, fotos antes/depois (só quando o checklist/regra exigir - RGN005 de 30/09), anexos, materiais, horas trabalhadas, custos e observações. Check-in e fotos não bloqueiam a conclusão (CTA004). O valor dos custos alimenta o gasto do equipamento.">
              <ExecutionCard order={order} actorName={actorName} enabled={canExecute} awaitingApproval={waitingApproval} validation={waitingValidation} onCost={() => setDlg('cost')} onFile={() => setDlg('file')} />
            </DevNote>
          )}

          {accepted && !waitingValidation && !waitingApproval && (
            <Card className="card-open" title="Concluir atendimento" subtitle="Ao finalizar o serviço, envie para validação do solicitante">
<div className="card-body-tight">              <Stack gap="md">
                {!canExecute && <Feedback type="info" message="Conclua a etapa de orçamento antes de indicar a conclusão" />}
                <div className="ext-actions"><Button disabled={!canExecute} iconLeft={<IconCheck size={20} />} onClick={() => setDlg('conclude')}>Indicar conclusão</Button></div>
              </Stack></div>
            </Card>
          )}
        </>
      )}

      {photoOpen && photo && (
        <Dialog open onClose={() => setPhotoOpen(false)} size="md" title={eq?.name ?? 'Equipamento'} subtitle="Foto do equipamento">
          <div className="eq-photo-zoom"><img src={photo} alt={`Foto de ${eq?.name ?? 'equipamento'}`} /></div>
        </Dialog>
      )}
      {dlg === 'visit' && <VisitDialog order={order} actorName={actorName} defaultTech={provider?.technicians.find((t) => t.id === technicianId)?.name ?? (order.executor.kind === 'prestador' ? order.executor.technician : '') ?? ''} techs={provider?.technicians.map((t) => t.name) ?? []} onClose={close} />}
      {dlg === 'cost' && <CostDialog order={order} actorName={actorName} onClose={close} />}
      {dlg === 'file' && <FileDialog order={order} actorName={actorName} onClose={close} />}
      {dlg === 'conclude' && <ConcludeDialog order={order} actorName={actorName} onClose={close} />}
    </Stack>
  );
}

// ─── Diagnóstico e orçamento ───
/**
 * Um card, dois caminhos: só o diagnóstico (Salvar diagnóstico, sem aprovação financeira) ou diagnóstico + orçamento (Registrar
 * orçamento abre o formulário no próprio card e a ação principal vira Enviar para aprovação, que grava os dois e leva a OS à aprovação).
 * 💡 Pendente de validação com o negócio: se todo custo exige aprovação ou só acima de um limite (não há regra definida; hoje o orçamento
 * é sempre opcional e, uma vez enviado, bloqueia a execução até a decisão).
 */
function DiagnosisCard({ order, actorName, disabled, defaultBudgetOpen }: { order: WorkOrder; actorName: string; disabled: boolean; defaultBudgetOpen: boolean }) {
  const toast = useToast();
  const btnSize = useIsMobile() ? 'sm' as const : 'md' as const;
  const [text, setText] = useState(order.diagnosis ?? '');
  const [tried, setTried] = useState(false);
  const b = order.budget;
  const awaiting = !!b && !b.decision;   // enviado e sem decisão: diagnóstico e orçamento seguem para análise, só leitura
  // Leitura: aguardando aprovação, orçamento aprovado ou OS aguardando validação (nada de campos desabilitados para informação só de consulta)
  const readOnly = awaiting || b?.decision === 'aprovado' || disabled;
  const canNewBudget = !disabled && (!b || b.decision === 'reprovado');
  const [open, setOpen] = useState(defaultBudgetOpen && canNewBudget);
  const [val, setVal] = useState('');
  const [desc, setDesc] = useState('');
  const [files, setFiles] = useState<Picked[]>([]);
  const sent = useRef(false);
  const cents = parseCents(val);
  const err = {
    diag: tried && !text.trim() ? requiredMessage('Diagnóstico') : undefined,
    val: tried && open && cents === null ? (val.trim() ? 'Informe um valor maior que zero' : requiredMessage('Valor do orçamento')) : undefined,
    desc: tried && open && !desc.trim() ? requiredMessage('Descrição') : undefined,
  };
  const diagLog = order.diagnosis ? 'Atualizou o diagnóstico' : 'Registrou o diagnóstico';
  const saveDiagnosis = () => {
    setTried(true);
    if (!text.trim()) return;
    patchOrder(order.id, actorName, (o) => ({ ...o, diagnosis: text.trim() }), [diagLog]);
    toast.show({ type: 'success', title: 'Diagnóstico salvo', message: 'Registrado no histórico da OS.' });
  };
  const sendForApproval = () => {
    setTried(true);
    if (sent.current || !text.trim() || cents === null || !desc.trim()) return;
    sent.current = true;   // evita novo envio acidental do mesmo orçamento
    const now = nowLocal();
    const names = files.map((f) => f.name);
    const logs = [] as string[];
    if (text.trim() !== (order.diagnosis ?? '').trim()) logs.push(diagLog);
    logs.push(`Anexou o orçamento de ${formatMoney(cents)} - status: Aguardando aprovação`);
    patchOrder(order.id, actorName, (o) => ({
      ...o, diagnosis: text.trim(), statusId: STO.APROVACAO, budget: { cents, description: desc.trim(), attachment: names[0] ?? '', attachments: names, registeredAt: now, by: actorName },
      costs: [...o.costs.filter((c) => c.kind !== 'orcamento'), { id: `C${Date.now().toString(36)}`, kind: 'orcamento', description: desc.trim(), cents, attachment: names[0], attachments: names }],
      files: [...o.files, ...names.map((name, i) => ({ id: `F${Date.now().toString(36)}${i}`, name, kind: 'orcamento' as const, at: now, by: actorName }))],
    }), logs);
    const approvers = db0().users.filter((u) => u.status === 'ativo' && (u.profile === 'administrador' || u.profile === 'gestor')).map((u) => u.id);
    notify(approvers, { kind: 'os', title: 'Orçamento aguardando aprovação', text: `${order.id}: orçamento de ${formatMoney(cents)}`, href: `os.html?id=${order.id}` });
    toast.show({ type: 'success', title: 'Enviado para aprovação', message: 'Diagnóstico e orçamento seguem para o responsável do cliente.' });
  };
  const cancelBudget = () => { setOpen(false); setVal(''); setDesc(''); setFiles([]); setTried(false); };
  return (
    <DevNote note="Prestador RF102-FLU005 / RGN005 (29/09): o diagnóstico é obrigatório e pode ser salvo sozinho; o orçamento (valor + descrição + documento) é condicional. Com orçamento, diagnóstico e orçamento são enviados juntos para aprovação do assinante, que vê o diagnóstico junto do orçamento. Orçamento pendente bloqueia a execução (CTA002); reprovado permite enviar um novo, sem sobrescrever o anterior no histórico. 💡 A regra de quais custos exigem aprovação (todos ou acima de um limite) está pendente de validação.">
      <Card className="card-open" title="Diagnóstico e orçamento" subtitle={awaiting ? "Orçamento enviado para aprovação" : "Registre o diagnóstico e, se necessário, envie um orçamento para aprovação"}>
        <Stack gap="md">
          {readOnly ? (
            <>
              <ReadField label="Diagnóstico" value={order.diagnosis ? <span className="ext-pre">{order.diagnosis}</span> : undefined} />
              {b && (
                <>
                  <ReadField label="Orçamento" value={<><strong className="ext-money">{formatMoney(b.cents)}</strong><span className="ext-pre ext-money-desc">{b.description}</span></>} />
                  {namesOf(b).length > 0 && <ReadField label="Anexos" value={<AttachmentsStack names={namesOf(b)} label="orçamento" />} />}
                  <ReadField label="Situação" value={b.decision === 'aprovado' ? <Badge status="success" dot>Aprovado</Badge> : b.decision === 'reprovado' ? <Badge status="error" dot>Reprovado</Badge> : <Badge status="warning" dot>Aguardando aprovação</Badge>} />
                </>
              )}
            </>
          ) : (
            <Textarea label="Diagnóstico" rows={4} value={text} onChange={(e) => setText(e.target.value)} error={err.diag} />
          )}
          {b && !readOnly ? (
            <dl className="ext-kv ext-kv-one">
              <Row label="Orçamento">{formatMoney(b.cents)} · {b.description}</Row>
              <Row label="Situação">{b.decision === 'aprovado' ? <Badge status="success" dot>Aprovado</Badge> : b.decision === 'reprovado' ? <Badge status="error" dot>Reprovado</Badge> : <Badge status="warning" dot>Aguardando aprovação</Badge>}</Row>
            </dl>
          ) : null}
          {open && (
            <>
              <hr className="ext-divider" />
              <Input label="Valor do orçamento (R$)" required inputMode="numeric" autoComplete="off" placeholder="0,00" value={val} onChange={(ev) => setVal(maskMoney(ev.target.value))} error={err.val} />
              <Textarea label="Descrição do orçamento" required rows={3} value={desc} onChange={(ev) => setDesc(ev.target.value)} error={err.desc} />
              <AttachmentsField label="Anexos" items={files} onChange={setFiles} />
            </>
          )}
          {open && <p className="ext-hint">Após enviar o orçamento, a execução ficará indisponível até a aprovação.</p>}
          {!readOnly && (
            <div className="ext-actions">
              {open ? (
                <>
                  <Button variant="secondary" size={btnSize} onClick={cancelBudget}>Cancelar orçamento</Button>
                  <Button size={btnSize} onClick={sendForApproval}>Enviar para aprovação</Button>
                </>
              ) : (
                <>
                  {canNewBudget && <Button variant="secondary" size={btnSize} iconLeft={<IconPlus size={btnSize === 'sm' ? 16 : 20} />} onClick={() => setOpen(true)}>{b ? 'Enviar novo orçamento' : 'Registrar orçamento'}</Button>}
                  <Button size={btnSize} disabled={text.trim() === (order.diagnosis ?? '').trim()} onClick={saveDiagnosis}>Salvar diagnóstico</Button>
                </>
              )}
            </div>
          )}
        </Stack>
      </Card>
    </DevNote>
  );
}

// ─── Execução ───
function ExecutionCard({ order, actorName, enabled, awaitingApproval, validation, onCost, onFile }: { order: WorkOrder; actorName: string; enabled: boolean; awaitingApproval: boolean; validation: boolean; onCost: () => void; onFile: () => void }) {
  const toast = useToast();
  // Atividades: lista opcional (uma por linha). Registros antigos ("Atividade: …" no histórico) entram como ponto de partida e não são descartados.
  const legacy = order.activities.filter((a) => a.text.startsWith('Atividade: ')).map((a) => a.text.replace('Atividade: ', ''));
  const savedActivities = order.activityList ?? legacy;
  const toLines = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean);
  const [solution, setSolution] = useState(order.solution ?? '');
  const [activities, setActivities] = useState(savedActivities.join('\n'));
  const [hours, setHours] = useState(order.workedHours ? String(order.workedHours).replace('.', ',') : '');
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => { setSolution(order.solution ?? ''); }, [order.solution]);
  const hoursNum = hours.trim() ? Number(hours.replace(',', '.')) : undefined;
  const hoursError = tried && hours.trim() && (!Number.isFinite(hoursNum) || (hoursNum ?? 0) <= 0) ? 'Informe as horas com um número maior que zero' : undefined;
  const files = order.files.filter((f) => f.by === actorName || f.kind !== 'orcamento');
  // Registros de execução anteriores ao envio do orçamento (o próprio orçamento aparece no card de diagnóstico)
  const previousFiles = order.files.filter((f) => f.kind !== 'orcamento');
  const previousCosts = order.costs.filter((c) => c.kind !== 'orcamento');
  const save = () => {
    setTried(true);
    if (hoursError || (hours.trim() && (!Number.isFinite(hoursNum) || (hoursNum ?? 0) <= 0))) return;
    const lines = toLines(activities);
    const activitiesChanged = lines.join('\n') !== savedActivities.join('\n');
    patchOrder(order.id, actorName, (o) => ({ ...o, solution: solution.trim() || o.solution, workedHours: hoursNum ?? o.workedHours, ...(activitiesChanged ? { activityList: lines } : {}) }),
      ['Registrou a execução', ...(activitiesChanged ? [lines.length ? `Atividades realizadas: ${lines.join('; ')}` : 'Removeu as atividades realizadas'] : []), ...(hoursNum ? [`Horas trabalhadas: ${String(hoursNum).replace('.', ',')} h`] : []), ...(notes.trim() ? [`Observação: ${notes.trim()}`] : [])]);
    setNotes('');
    toast.show({ type: 'success', title: 'Execução salva', message: 'Os registros ficaram no histórico da OS e do equipamento.' });
  };
  return (
    <Card className="card-open" title="Execução" subtitle={enabled ? 'Registre o que foi feito' : awaitingApproval ? undefined : validation ? 'Serviço realizado' : 'Disponível depois da aprovação do orçamento'}>
<div className="card-body-tight">      <Stack gap="lg">
        {awaitingApproval && (
          <DevNote note="Prestador RF102-RGN002 / CTA002: o bloqueio só começa quando o orçamento é enviado (a OS vai para Aguardando aprovação); preencher ou abrir o formulário não bloqueia. A execução volta quando o assinante aprova (RGN006); os registros já salvos continuam à vista.">
            <Feedback type="info" title="Aguardando aprovação do orçamento" message="A execução e o registro de materiais e custos serão liberados após a aprovação." />
          </DevNote>
        )}
        {awaitingApproval ? null : validation ? (
          <>
            {order.solution && <ReadField label="Solução aplicada" value={<span className="ext-pre">{order.solution}</span>} />}
            {savedActivities.length > 0 && <ReadField label="Atividades realizadas" value={<span className="ext-pre">{savedActivities.join('\n')}</span>} />}
            {previousFiles.length > 0 && <ReadField label="Fotos e anexos" value={<AttachmentsStack names={previousFiles.map((f) => f.name)} label="execução" />} />}
            {validation && order.workedHours ? <ReadField label="Horas trabalhadas" value={String(order.workedHours).replace('.', ',')} /> : null}
            {previousCosts.length > 0 && <ReadField label="Materiais e custos" value={<span className="ext-pre">{previousCosts.map((c) => `${c.description} · ${formatMoney(c.cents)}`).join('\n')}</span>} />}
          </>
        ) : (<>
        <Textarea label="Solução aplicada" rows={4} disabled={!enabled} value={solution} onChange={(e) => setSolution(e.target.value)} />
        <Textarea label="Atividades realizadas" optional rows={4} placeholder="Descreva as atividades realizadas, uma por linha" disabled={!enabled} value={activities} onChange={(e) => setActivities(e.target.value)} />

        <Stack gap="sm">
          <span className="read-label">Fotos e anexos</span>
          {files.length === 0 ? <p className="ext-item-meta">Nenhum arquivo anexado</p> : (
            <ul className="ex-list">{files.map((f) => <li key={f.id} className="ex-row"><span>{f.name}</span><span className="ex-tag">{f.moment ? FOTO_LABEL[f.moment] : f.kind === 'orcamento' ? 'Orçamento' : 'Anexo'}</span></li>)}</ul>
          )}
          <div className="ext-actions"><Button variant="secondary" size="sm" disabled={!enabled} iconLeft={<IconPlus size={16} />} onClick={onFile}>Adicionar foto ou anexo</Button></div>
        </Stack>

        <Stack gap="sm">
          <span className="read-label">Materiais e custos</span>
          {order.costs.length === 0 ? <p className="ext-item-meta">Nenhum item registrado</p> : (
            <ul className="ex-list">{order.costs.map((c) => <li key={c.id} className="ex-row"><span>{c.description}</span><span className="ex-tag">{COST_KIND_LABEL[c.kind]} · {formatMoney(c.cents)}</span></li>)}</ul>
          )}
          <div className="ext-actions"><Button variant="secondary" size="sm" disabled={!enabled} iconLeft={<IconPlus size={16} />} onClick={onCost}>Adicionar material ou custo</Button></div>
        </Stack>

        <Textarea label="Observações" optional rows={3} disabled={!enabled} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Input label="Horas trabalhadas" optional inputMode="decimal" placeholder="Ex.: 2,5" disabled={!enabled} value={hours} onChange={(e) => setHours(e.target.value)} error={hoursError} />
        <div className="ext-actions"><Button disabled={!enabled} onClick={save}>Salvar execução</Button></div>
        </>)}
      </Stack></div>
    </Card>
  );
}

// ─── Diálogos ───
type DlgProps = { order: WorkOrder; actorName: string; onClose: () => void };
const Footer = ({ onClose, onConfirm, label }: { onClose: () => void; onConfirm: () => void; label: string }) => (
  <>
    <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
    <Button size="sm" onClick={onConfirm}>{label}</Button>
  </>
);

function VisitDialog({ order, actorName, defaultTech, techs, onClose }: DlgProps & { defaultTech: string; techs: string[] }) {
  const toast = useToast();
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tech, setTech] = useState(defaultTech);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const e = {
    date: tried && !date ? requiredMessage('Data') : undefined, from: tried && !from ? requiredMessage('Início') : undefined,
    to: tried && !to ? requiredMessage('Fim') : tried && from && to <= from ? 'O fim deve ser depois do início' : undefined,
    tech: tried && !tech.trim() ? requiredMessage('Técnico') : undefined,
  };
  const sent = useRef(false);
  const go = () => {
    setTried(true);
    if (sent.current || !date || !from || !to || to <= from || !tech.trim()) return;
    sent.current = true;
    const n = order.visits.length + 1;
    patchOrder(order.id, actorName, (o) => ({ ...o, visits: [...o.visits, { id: `V${n}`, date, from, to, technician: tech.trim(), note: note.trim() || undefined }], schedule: { date, from, to } }),
      [`Agendou a ${n === 1 ? 'visita' : `revisita nº ${n}`} para ${formatDate(date)} (${from} às ${to}) com ${tech.trim()}`]);
    toast.show({ type: 'success', title: 'Visita agendada', message: 'Combine o horário com o contato da unidade.' });
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title={order.visits.length ? 'Agendar revisita' : 'Agendar visita'} subtitle="Data e janela de horário combinadas com a unidade" actions={<Footer onClose={onClose} onConfirm={go} label="Agendar" />}>
      <Stack gap="md">
        <DatePicker label="Data" required value={date} onChange={setDate} error={e.date} />
        <Stack direction="horizontal" gap="md">
          <Input label="Início" type="time" required value={from} onChange={(ev) => setFrom(ev.target.value)} error={e.from} />
          <Input label="Fim" type="time" required value={to} onChange={(ev) => setTo(ev.target.value)} error={e.to} />
        </Stack>
        {techs.length > 0
          ? <Dropdown label="Técnico" required placeholder="Selecione o técnico" options={techs.map((t) => ({ value: t, label: t }))} value={tech} onChange={setTech} error={e.tech} />
          : <Input label="Técnico" required autoComplete="off" value={tech} onChange={(ev) => setTech(ev.target.value)} error={e.tech} />}
        <Textarea label="Observação" optional rows={2} value={note} onChange={(ev) => setNote(ev.target.value)} />
      </Stack>
    </Dialog>
  );
}

function CostDialog({ order, actorName, onClose }: DlgProps) {
  const toast = useToast();
  const [kind, setKind] = useState<CostKind>('peca');
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('1');
  const [val, setVal] = useState('');
  const [tried, setTried] = useState(false);
  const unit = parseCents(val);
  const n = Number(qty.replace(',', '.'));
  const e = {
    desc: tried && !desc.trim() ? requiredMessage('Descrição') : undefined,
    qty: tried && (!Number.isFinite(n) || n <= 0) ? 'Informe uma quantidade maior que zero' : undefined,
    val: tried && unit === null ? (val.trim() ? 'Informe um valor maior que zero' : requiredMessage('Valor')) : undefined,
  };
  const go = () => {
    setTried(true);
    if (!desc.trim() || unit === null || !Number.isFinite(n) || n <= 0) return;
    const id = `C${Date.now().toString(36)}`;
    const text = n === 1 ? desc.trim() : `${desc.trim()} (${String(n).replace('.', ',')} un.)`;
    patchOrder(order.id, actorName, (o) => ({ ...o, costs: [...o.costs, { id, kind, description: text, cents: Math.round(unit * n) }] }), [`Adicionou item de custo (${COST_KIND_LABEL[kind]}): ${text}`]);
    toast.show({ type: 'success', title: 'Item adicionado', message: 'O custo foi registrado na OS.' });
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title="Adicionar material ou custo" subtitle="Peças, materiais, mão de obra ou outros custos" actions={<Footer onClose={onClose} onConfirm={go} label="Adicionar" />}>
      <Stack gap="md">
        <Dropdown label="Tipo" required options={(['peca', 'mao-de-obra', 'outro'] as CostKind[]).map((k) => ({ value: k, label: COST_KIND_LABEL[k] }))} value={kind} onChange={(v) => setKind(v as CostKind)} />
        <Input label="Descrição" required autoComplete="off" value={desc} onChange={(ev) => setDesc(ev.target.value)} error={e.desc} />
        <Stack direction="horizontal" gap="md">
          <Input label="Quantidade" required inputMode="decimal" value={qty} onChange={(ev) => setQty(ev.target.value)} error={e.qty} />
          <Input label="Valor unitário (R$)" required inputMode="numeric" placeholder="0,00" value={val} onChange={(ev) => setVal(maskMoney(ev.target.value))} error={e.val} />
        </Stack>
      </Stack>
    </Dialog>
  );
}

function FileDialog({ order, actorName, onClose }: DlgProps) {
  const toast = useToast();
  const [kind, setKind] = useState('antes');
  const [file, setFile] = useState('');
  const [tried, setTried] = useState(false);
  const go = () => {
    setTried(true);
    if (!file) return;
    const now = nowLocal();
    patchOrder(order.id, actorName, (o) => ({ ...o, files: [...o.files, { id: `F${Date.now().toString(36)}`, name: file, kind: kind === 'anexo' ? 'outro' : 'foto', at: now, by: actorName, ...(kind === 'anexo' ? {} : { evidence: 'Foto antes/depois', moment: kind as 'antes' | 'depois' }) }] }),
      [`Anexou ${FOTO_LABEL[kind].toLowerCase()}: ${file}`]);
    toast.show({ type: 'success', title: 'Arquivo anexado', message: 'Ele aparece nos arquivos da OS.' });
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title="Adicionar foto ou anexo" actions={<Footer onClose={onClose} onConfirm={go} label="Adicionar" />}>
      <Stack gap="md">
        <Dropdown label="Tipo" required options={Object.entries(FOTO_LABEL).map(([value, label]) => ({ value, label }))} value={kind} onChange={setKind} />
        <AttachmentField label="Arquivo" required value={file} onChange={setFile} error={tried && !file ? requiredMessage('Arquivo') : undefined} />
      </Stack>
    </Dialog>
  );
}

function ConcludeDialog({ order, actorName, onClose }: DlgProps) {
  const toast = useToast();
  const [text, setText] = useState(order.solution ?? '');
  const [tried, setTried] = useState(false);
  const go = () => {
    setTried(true);
    if (!text.trim()) return;
    applyOrderConclusion(db0(), order, text, actorName);
    toast.show({ type: 'success', title: 'Conclusão indicada', message: 'O cliente foi avisado para validar o atendimento.' });
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title="Indicar a conclusão" subtitle="O cliente vai confirmar se o problema foi resolvido" actions={<Footer onClose={onClose} onConfirm={go} label="Indicar conclusão" />}>
      <Textarea label="Solução aplicada" required rows={4} value={text} onChange={(e) => setText(e.target.value)} error={tried && !text.trim() ? requiredMessage('Solução aplicada') : undefined} />
    </Dialog>
  );
}

const db0 = () => getSubDb();

mountApp(<AtendimentoScreen />);
