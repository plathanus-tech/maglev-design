import { ReactNode, useEffect, useRef, useState } from 'react';
import { todayIso } from '../../admin/shared/clock';
import { DateField, INVALID_DATE_MESSAGE } from './date-field';
import {
  IconAlertTriangle, IconCheck, IconCircleDot, IconCopy, IconFilePlus, IconMinus, IconPencil, IconPlayerPlay, IconPlus, IconTrash,
  IconUserEdit, IconCircleCheck, IconMapPin, IconArrowsExchange, IconDownload, IconEye, IconFileInvoice, IconFileText, IconPhoto,
} from '@tabler/icons-react';
import {
  Badge, Button, Card, DatePicker, Dialog, Dropdown, Feedback, ImageUpload, Input, KpiCard, RadioButton, Stack, Tab, Table, TableColumn, Textarea, useToast,
} from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { ShareButton } from './share-button';
import { MobileCardList, MobileCardItem } from '../../admin/shared/MobileCardList';
import { useHashState } from '../../admin/shared/useHashState';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { formatDate, formatDateTime, formatMoney, formatPhone, isValidPhone, maskMoney, onlyDigits, requiredMessage } from '../../admin/shared/format';
import { RowMenu, RowMenuItem } from './RowMenu';
import { describeFrequency } from './preventivas';
import { photoSrc } from './photos';
import { IMPACT_LABEL, COST_KIND_LABEL, CostKind, NO_UNIT, WorkOrder, nowLocal, orderRealizedCents, unconfirmedBudgetCents } from './data';
import { equipmentOf, environmentName, logEntry, notify, ordersVisible, unitName, updateSubDb, useSubSession, userName } from './store';
import { CellPair, Col, Grid, ReadField, RowAction, RowActions, Text, TroubleshootingNotes, goTo, param, takeFlash, useRefs } from './ui';
import { KpiMoney } from '../../admin/shared/kpi-value';
import { AttachmentsField, AttachmentsStack, AttachmentsView, namesOf, Picked } from './attachments';
import {
  AttachmentField, ReassignDialog, STO, applyOrderValidation, applyOrderConclusion, executorInfo, executorText, isEditable, notifyProviderLog, overdueDays, parseCents, patchOrder, providerLabel,
} from './os-common';
import './os.css';
import './solicitacao.css';
import './preventivas.css';

type Dlg = 'approve' | 'reject' | 'status' | 'addvisit' | 'addcost' | 'reassign' | 'conclude' | 'addbudget' | 'diagnosis' | 'file' | 'reassignval' | 'confirmcost' | { rm: string } | null;

/** Estados: idle · approve · reject · cancel · addvisit · addcost · validate · validateno · reassign (diálogos/ações abertos) */
const STATES = ['idle', 'approve', 'reject', 'cancel', 'addvisit', 'addcost', 'validate', 'validateno', 'reassign', 'conclude', 'addbudget'] as const;
type Mode = (typeof STATES)[number];

const PAGE_SIZE = 10;
const IMPACT_BADGE = { baixo: 'neutral', medio: 'info', alto: 'warning' } as const;
const FILE_KIND = { foto: 'Foto', orcamento: 'Orçamento', outro: 'Outro anexo' } as const;

/** Tabela no desktop, lista de cards no mobile (mesmas linhas). */
function DataTable<T extends Record<string, unknown> & { id: string }>({ title, subtitle, actions, columns, rows, emptyTitle, emptyDescription, toCard }: {
  title: string; subtitle?: string; actions?: ReactNode; columns: TableColumn<T>[]; rows: T[]; emptyTitle: string; emptyDescription?: string; toCard: (r: T) => Omit<MobileCardItem, 'id'>;
}) {
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);
  const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return isMobile ? (
    <MobileCardList
      headingId={`list-${title}`} title={title} subtitle={subtitle} emptyTitle={emptyTitle} emptyDescription={emptyDescription}
      toolbar={actions ? <Stack direction="horizontal" justify="end">{actions}</Stack> : undefined}
      page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage}
      items={slice.map((r) => ({ id: r.id, ...toCard(r) }))}
    />
  ) : (
    <Table<T>
      title={title} subtitle={subtitle} actions={actions} columns={columns} rows={slice} empty={{ title: emptyTitle, description: emptyDescription }}
      pagination={rows.length > PAGE_SIZE ? { page, pageSize: PAGE_SIZE, total: rows.length, onPageChange: setPage } : undefined}
    />
  );
}

const Actions = ({ onClose, onConfirm, label, destructive, disabled }: { onClose: () => void; onConfirm: () => void; label: string; destructive?: boolean; disabled?: boolean }) => (
  <>
    <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
    <Button size="sm" variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm} disabled={disabled}>{label}</Button>
  </>
);

/** Valor de uma OS que precisa de aprovação do orçamento antes da execução (RF503-RGN002 / CTA001). */
const needsApproval = (o: WorkOrder) => !!o.budget && o.budget.decision !== 'aprovado';

/** Separa o evento do detalhe registrado: título objetivo em uma linha; o que vem depois de “ - ” ou “: ” vira a segunda linha. */
function splitActivity(text: string): { title: string; detail?: string } {
  const i = text.indexOf(' - ');
  if (i > 0) return { title: text.slice(0, i), detail: text.slice(i + 3) };
  const j = text.indexOf(': ');
  if (j > 0 && j < 70) return { title: text.slice(0, j), detail: text.slice(j + 2) };
  return { title: text };
}
/** Códigos de solicitação (SOL-000123) no texto do histórico viram link para a solicitação vinculada */
const linkRefs = (text: string): ReactNode => text.split(/(SOL-\d{6})/).map((part, i) => (/^SOL-\d{6}$/.test(part) ? <a key={i} className="text-link" href={`solicitacao.html?id=${part}`}>{part}</a> : part));
function ActivityTimeline({ items }: { items: WorkOrder['activities'] }) {
  return (
    <ol className="os-timeline">
      {items.map((a) => {
        const ev = splitActivity(a.text);
        return (
          <li key={a.id} className="os-timeline-item">
            <span className="os-timeline-title">{ev.title}</span>
            {ev.detail && <span className="os-timeline-detail">{linkRefs(ev.detail)}</span>}
            <span className="os-timeline-meta">{a.by} · {formatDateTime(a.at)}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ───────────────────────── Linha de progresso e próxima ação ─────────────────────────
type StepState = 'done' | 'current' | 'pending' | 'skipped' | 'blocked';
function buildSteps(o: WorkOrder, base: string | undefined): Array<{ label: string; state: StepState; hint?: string }> {
  const closed = base === 'concluido';
  const canceled = base === 'cancelado';
  // Preventiva: gerada pelo plano, executada e concluída pelo executor (RF603), sem triagem, diagnóstico, aprovação ou validação
  if (o.kind === 'preventiva') {
    const st: StepState[] = closed ? ['done', 'done', 'done'] : o.statusId !== STO.ABERTA ? ['done', 'current', 'pending'] : ['current', 'pending', 'pending'];
    const hint: Array<string | undefined> = [];
    if (canceled) { const k = st.findIndex((x) => x === 'current'); if (k >= 0) { st[k] = 'blocked'; hint[k] = 'Cancelada'; } }
    else if (!closed) hint[st.findIndex((x) => x === 'current')] = 'Etapa atual';
    return ['Programada', 'Em execução', 'Concluída'].map((label, i) => ({ label, state: st[i], hint: hint[i] }));
  }
  const inValidation = o.statusId === STO.VALIDACAO;
  const b = o.budget;
  const reachedExecution = !!o.diagnosis || inValidation || closed;
  // Cada etapa vem do que de fato aconteceu na OS, não da posição na sequência; a aprovação é condicional (só com orçamento)
  const st: StepState[] = [
    'done', 'done', 'done',
    reachedExecution ? 'done' : 'pending',
    b ? (b.decision === 'aprovado' ? 'done' : b.decision === 'reprovado' ? 'blocked' : 'pending') : (inValidation || closed ? 'skipped' : 'pending'),
    inValidation || closed ? 'done' : 'pending',
    closed ? 'done' : 'pending',
    closed ? 'done' : 'pending',
  ];
  const hint: Array<string | undefined> = [];
  if (st[4] === 'skipped') hint[4] = 'Sem orçamento';
  if (st[4] === 'pending' && !b) hint[4] = 'Se houver custo';
  if (st[4] === 'blocked') hint[4] = 'Orçamento reprovado';
  if (canceled) {
    const k = st.findIndex((x) => x === 'pending');
    if (k >= 0) { st[k] = 'blocked'; hint[k] = 'Cancelada'; }
  } else if (!closed && !st.includes('blocked')) {
    const k = b && !b.decision ? 4 : st.findIndex((x, i) => x === 'pending' && !(i === 4 && !b));
    if (k >= 0) { st[k] = 'current'; hint[k] = 'Etapa atual'; }
  }
  const labels = ['Solicitação', 'Triagem', 'OS criada', 'Diagnóstico', 'Aprovação', 'Execução', 'Validação', 'Conclusão'];
  return labels.map((label, i) => ({ label, state: st[i], hint: hint[i] }));
}
const STEP_ICON: Record<StepState, ReactNode> = {
  done: <IconCheck size={14} />, current: <IconCircleDot size={14} />, pending: null, skipped: <IconMinus size={14} />, blocked: <IconAlertTriangle size={14} />,
};
const STEP_SR: Record<StepState, string> = { done: 'concluída', current: 'etapa atual', pending: 'pendente', skipped: 'não se aplica', blocked: 'bloqueada' };

function Progress({ order, base, children }: { order: WorkOrder; base: string | undefined; children?: ReactNode }) {
  const steps = buildSteps(order, base);
  return (
    <Card
      title="Andamento da OS" padding="none"
    >
      <div className="os-steps-wrap">
        <ol className={`os-steps${order.kind === 'preventiva' ? ' os-steps-3' : ''}`} aria-label={order.kind === 'preventiva' ? 'Linha de progresso da OS: da programação à conclusão' : 'Linha de progresso da OS: da solicitação à conclusão'}>
          {steps.map((x) => (
            <li key={x.label} className={`os-step is-${x.state}`} aria-current={x.state === 'current' ? 'step' : undefined} title={x.hint}>
              <span className="os-step-mark" aria-hidden="true">{STEP_ICON[x.state]}</span>
              <span className="os-step-label">{x.label}<span className="sr-only"> ({STEP_SR[x.state]}{x.hint ? `, ${x.hint.toLowerCase()}` : ''})</span></span>
            </li>
          ))}
        </ol>
        {children && <div className="os-next-sep">{children}</div>}
      </div>
    </Card>
  );
}

// ───────────────────────── Diálogos ─────────────────────────
function Dlgs({ order, dlg, setDlg, preset }: { order: WorkOrder; dlg: Dlg; setDlg: (d: Dlg) => void; preset?: string }) {
  const toast = useToast();
  const refs = useRefs();
  const { db, user, canSeeCosts } = useSubSession();
  const eq = equipmentOf(db, order.equipmentId);
  const close = () => setDlg(null);
  const [text, setText] = useState('');
  const [text2, setText2] = useState('');
  const [val, setVal] = useState('');
  const [sel, setSel] = useState('');
  const [date, setDate] = useState('');
  const [badDate, setBadDate] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [file, setFile] = useState('');
  const [costFiles, setCostFiles] = useState<Picked[]>([]);
  const [tried, setTried] = useState(false);
  const key = typeof dlg === 'object' && dlg ? 'rm' : dlg;
  useEffect(() => {
    setTried(false); setVal(''); setFile(''); setCostFiles([]); setDate(''); setBadDate(false); setFrom(''); setTo('');
    if (dlg === 'status') { setSel(preset ?? ''); setText(''); }
    else if (dlg === 'diagnosis') { setText(order.diagnosis ?? ''); setText2(order.solution ?? ''); }
    else if (dlg === 'conclude') { setText(order.solution ?? ''); }
    else if (dlg === 'addvisit') { setText(''); setText2(order.executor.kind === 'prestador' ? order.executor.technician ?? '' : userName(db, order.executor.kind === 'interno' ? order.executor.userId : '')); }
    else if (dlg === 'addcost') { setSel('peca'); setText(''); }
    else if (dlg === 'confirmcost') { setText(''); setVal(maskMoney(String(order.budget?.cents ?? 0))); }
    else if (dlg === 'addbudget') { setText(''); }
    else if (dlg === 'file') { setSel('foto'); }
    else if (dlg === 'reassignval') { setSel(''); setText(''); setText2(''); }
    else { setText(''); setText2(''); setSel(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const approvers = db.users.filter((u) => u.status === 'ativo' && (u.profile === 'administrador' || u.profile === 'gestor')).map((u) => u.id);
  const execUserIds = order.executor.kind === 'interno' ? [order.executor.userId] : [];
  const prestadorLog = order.executor.kind === 'prestador' ? [notifyProviderLog(db, order.executor.providerId)] : [];
  const href = `os.html?id=${order.id}`;
  const req = db.requests.find((r) => r.id === order.requestId);
  const stName = (id: string) => refs.status(id)?.name ?? id;

  if (!dlg) return null;

  // ── Aprovar / reprovar orçamento (RF503-RGN008) ──
  if (dlg === 'approve' || dlg === 'reject') {
    const reject = dlg === 'reject';
    const err = tried && reject && !text.trim() ? requiredMessage('Justificativa') : undefined;
    const go = () => {
      setTried(true);
      if (reject && !text.trim()) return;
      const b = order.budget!;
      const nextStatus = reject ? STO.ORCAMENTO : STO.ANDAMENTO;
      patchOrder(order.id, user.name, (o) => ({ ...o, statusId: nextStatus, budget: { ...b, decision: reject ? 'reprovado' : 'aprovado', decidedAt: nowLocal(), decidedBy: user.name, justification: text.trim() || undefined } }),
        [`${reject ? 'Reprovou' : 'Aprovou'} o orçamento${canSeeCosts ? ` de ${formatMoney(b.cents)}` : ''}${text.trim() ? `: ${text.trim()}` : ''} - status: ${stName(nextStatus)}`, ...prestadorLog]);
      notify(execUserIds, { kind: 'os', title: reject ? 'Orçamento reprovado' : 'Orçamento aprovado', text: `${order.id}: ${reject ? 'envie um novo orçamento' : 'pode seguir com a execução'}`, href });
      toast.show({ type: 'success', title: reject ? 'Orçamento reprovado' : 'Orçamento aprovado', message: reject ? 'O executor/prestador foi avisado para enviar um novo orçamento.' : 'A execução pode prosseguir.' });
      close();
    };
    return (
      <Dialog open onClose={close} title={reject ? 'Reprovar o orçamento?' : 'Aprovar o orçamento?'} subtitle={canSeeCosts && order.budget ? `${formatMoney(order.budget.cents)} · ${order.budget.description}` : order.budget?.description}
        actions={<Actions onClose={close} onConfirm={go} label={reject ? 'Reprovar orçamento' : 'Aprovar orçamento'} destructive={reject} />}>
        <DevNote note="RGN008: só usuário do assinante com permissão aprova/reprova - nunca o prestador. 💡 Perfis habilitados a confirmar (sugestão: Administrador e Gestor). Justificativa obrigatória ao reprovar. Aprovação externa (ex.: CFO): manter o status “Aguardando aprovação” até o retorno e decidir aqui depois (FLU005).">
          <Textarea label="Justificativa" required={reject} optional={!reject} rows={3} value={text} onChange={(e) => setText(e.target.value)} error={err} />
        </DevNote>
      </Dialog>
    );
  }

  // ── Alterar status (RGN007: sem restrição por perfil) / cancelar (RGN004: exige motivo) ──
  if (dlg === 'status') {
    const cancel = sel === STO.CANCELADA;
    // “Aguardando validação” não é escolhida à mão: só se chega nela indicando a conclusão da execução (assim a OS não vai para validação sem ter sido executada)
    const options = refs.activeStatuses('os').filter((s) => s.id !== order.statusId && s.id !== STO.CONCLUIDA && s.id !== STO.VALIDACAO).map((s) => ({ value: s.id, label: s.name }));
    const blocked = needsApproval(order) && sel === STO.ANDAMENTO;
    const errSel = tried && !sel ? requiredMessage('Novo status') : blocked ? 'Aprove o orçamento antes de avançar para a execução' : undefined;
    const errText = tried && cancel && !text.trim() ? requiredMessage('Motivo do cancelamento') : undefined;
    const go = () => {
      setTried(true);
      if (!sel || blocked || (cancel && !text.trim())) return;
      patchOrder(order.id, user.name, (o) => ({ ...o, statusId: sel, ...(cancel ? { cancelReason: text.trim() } : {}) }),
        [`Alterou o status de ${stName(order.statusId)} para ${stName(sel)}${cancel ? ` - motivo: ${text.trim()}` : text.trim() ? ` - ${text.trim()}` : ''}`]);
      toast.show({ type: 'success', title: cancel ? 'OS cancelada' : 'Status alterado', message: `A OS agora está em ${stName(sel)}.` });
      close();
    };
    return (
      <Dialog open onClose={close} title={cancel ? `Cancelar ${order.id}?` : 'Alterar status'} subtitle={`Status atual: ${stName(order.statusId)}`}
        actions={<Actions onClose={close} onConfirm={go} label={cancel ? 'Cancelar OS' : 'Salvar status'} destructive={cancel} />}>
        <Stack gap="md">
          <DevNote note="RGN007: mudança de status sem restrição por perfil (responsável, executor ou prestador podem mover) - toda mudança fica no log com o autor. Exceção: aprovar orçamento (RGN008). Concluída só pela validação do solicitante (RGN005); “Aguardando validação” não aparece aqui: só se chega nela ao indicar a conclusão da execução, para a OS não ir à validação sem execução; OS com orçamento não aprovado não vai para execução (RGN002 / CTA001). Marcar “Aguardando aprovação” sem orçamento representa aprovação externa (ex.: CFO).">
            <Dropdown label="Novo status" required placeholder="Selecione o status" options={options} value={sel} onChange={setSel} error={errSel} />
          </DevNote>
          {cancel
            ? <DevNote note="RGN004: cancelar OS exige motivo."><Textarea label="Motivo do cancelamento" required rows={3} value={text} onChange={(e) => setText(e.target.value)} error={errText} /></DevNote>
            : <Textarea label="Comentário" optional rows={2} value={text} onChange={(e) => setText(e.target.value)} />}
        </Stack>
      </Dialog>
    );
  }

  // ── Visita / revisita (CTA005) ──
  if (dlg === 'addvisit') {
    const e = { date: badDate ? INVALID_DATE_MESSAGE : tried && !date ? requiredMessage('Data') : undefined, from: tried && !from ? requiredMessage('Início') : undefined,
      to: tried && !to ? requiredMessage('Fim') : tried && from && to <= from ? 'O fim deve ser depois do início' : undefined, tech: tried && !text2.trim() ? requiredMessage('Técnico') : undefined };
    const go = () => {
      setTried(true);
      if (!date || badDate || !from || !to || to <= from || !text2.trim()) return;
      const n = order.visits.length + 1;
      patchOrder(order.id, user.name, (o) => ({ ...o, visits: [...o.visits, { id: `V${n}`, date, from, to, technician: text2.trim(), note: text.trim() || undefined }], schedule: { date, from, to } }),
        [`Agendou a ${n === 1 ? 'visita' : `revisita nº ${n}`} para ${formatDate(date)} (${from} às ${to}) com ${text2.trim()}`]);
      toast.show({ type: 'success', title: 'Visita adicionada', message: 'A visita foi agendada e registrada nas atividades.' });
      close();
    };
    return (
      <Dialog open onClose={close} title={order.visits.length ? 'Adicionar revisita' : 'Adicionar visita'} subtitle="Uma OS aceita várias visitas"
        actions={<Actions onClose={close} onConfirm={go} label="Adicionar visita" />}>
        <DevNote note="RF503-CTA005: uma OS aceita mais de uma visita/revisita. 💡 P09 (RF502-RGN004): a confirmar se o agendamento é do gestor, do prestador ou de ambos.">
          <Grid>
            <Col span={12}><DateField label="Data agendada" required min={todayIso()} minMessage="A data não pode ser anterior a hoje" value={date} onChange={setDate} invalid={badDate} onInvalid={setBadDate} error={e.date} /></Col>
            <Col span={6}><Input label="Início da janela" type="time" required value={from} onChange={(ev) => setFrom(ev.target.value)} error={e.from} /></Col>
            <Col span={6}><Input label="Fim da janela" type="time" required value={to} onChange={(ev) => setTo(ev.target.value)} error={e.to} /></Col>
            <Col span={12}><Input label="Técnico" required autoComplete="off" value={text2} onChange={(ev) => setText2(ev.target.value)} error={e.tech} /></Col>
            <Col span={12}><Textarea label="Observação" optional rows={2} value={text} onChange={(ev) => setText(ev.target.value)} /></Col>
          </Grid>
        </DevNote>
      </Dialog>
    );
  }

  // ── Confirmar custo realizado (orçamento aprovado → realizado) ──
  if (dlg === 'confirmcost' && order.budget) {
    const b = order.budget;
    const typed = onlyDigits(val);
    const cents = typed === '' ? null : Number(typed);
    const differs = cents !== null && cents !== b.cents;
    const e = {
      val: tried && cents === null ? requiredMessage('Valor realizado') : undefined,
      reason: tried && differs && !text.trim() ? requiredMessage('Motivo da diferença') : undefined,
    };
    const go = () => {
      setTried(true);
      if (cents === null || (differs && !text.trim())) return;
      patchOrder(order.id, user.name, (o) => ({ ...o, budget: o.budget ? { ...o.budget, realized: { cents, confirmedAt: nowLocal(), by: user.name, reason: differs ? text.trim() : undefined } } : o.budget }),
        [`Confirmou o custo realizado do orçamento aprovado${differs ? `, diferente do aprovado. Motivo: ${text.trim()}` : ''}`]);
      toast.show({ type: 'success', title: 'Custo realizado confirmado', message: 'O valor passa a contar no gasto do equipamento e no Início.' });
      close();
    };
    return (
      <Dialog open onClose={close} title="Confirmar custo realizado" subtitle="O orçamento aprovado só vira custo realizado depois de confirmado" actions={<Actions onClose={close} onConfirm={go} label="Confirmar custo realizado" />}>
        <DevNote note="Conciliação do orçamento aprovado (aprovar não é gastar): o valor vem preenchido com o aprovado; se for mantido, basta confirmar; se mudar (inclusive zero), o motivo é obrigatório. Grava Budget.realized (valor, quem e quando, motivo) e uma linha no histórico da OS (sem repetir o valor, para quem não vê custos). Só quem pode aprovar orçamento. Custos extras continuam sendo lançados como itens, com descrição, e somam ao realizado.">
          <Stack gap="md">
            <Grid>
              <Col span={6}><ReadField label="Orçamento aprovado" value={formatMoney(b.cents)} /></Col>
              <Col span={6}><ReadField label="Aprovado por" value={b.decidedBy ?? '-'} /></Col>
              <Col span={12}><ReadField label="Descrição do orçamento" value={b.description} /></Col>
              <Col span={12}><Input label="Valor realizado (R$)" required inputMode="numeric" autoComplete="off" placeholder="0,00" value={val} onChange={(ev) => setVal(maskMoney(ev.target.value))} error={e.val} /></Col>
              {differs && <Col span={12}><Textarea label="Motivo da diferença" required rows={3} value={text} onChange={(ev) => setText(ev.target.value)} error={e.reason} /></Col>}
            </Grid>
          </Stack>
        </DevNote>
      </Dialog>
    );
  }

  // ── Item de custo (valor obrigatório - RGN003) ──
  if (dlg === 'addcost') {
    const cents = parseCents(val);
    const e = { desc: tried && !text.trim() ? requiredMessage('Descrição') : undefined, val: tried && cents === null ? (val.trim() ? 'Informe um valor maior que zero' : requiredMessage('Valor')) : undefined };
    const go = () => {
      setTried(true);
      if (!text.trim() || cents === null) return;
      const id = `C${Date.now().toString(36)}`;
      patchOrder(order.id, user.name, (o) => ({
        ...o, costs: [...o.costs, { id, kind: sel as CostKind, description: text.trim(), cents, attachment: costFiles[0]?.name, attachments: costFiles.length ? costFiles.map((f) => f.name) : undefined }],
        files: [...o.files, ...costFiles.map((f, i) => ({ id: `F${id}${i}`, name: f.name, kind: 'outro' as const, at: nowLocal(), by: user.name }))],
      }), [`Adicionou item de custo (${COST_KIND_LABEL[sel as CostKind]}): ${text.trim()}`]);
      toast.show({ type: 'success', title: 'Item de custo adicionado', message: 'O custo realizado alimenta o gasto do equipamento.' });
      close();
    };
    return (
      <Dialog open onClose={close} title="Adicionar item de custo" subtitle="Lance só os custos extras, além do orçamento aprovado" actions={<Actions onClose={close} onConfirm={go} label="Adicionar item" />}>
        <DevNote note="RF503-RGN003: o valor é obrigatório em cada item (os custos realizados alimentam o gasto acumulado do equipamento, RF304, e o Dashboard). O log da OS não repete o valor, para quem não vê custos.">
          <Grid>
            <Col span={12}><Dropdown label="Tipo" required options={Object.entries(COST_KIND_LABEL).map(([value, label]) => ({ value, label }))} value={sel} onChange={setSel} /></Col>
            <Col span={12}><Input label="Descrição" required autoComplete="off" value={text} onChange={(ev) => setText(ev.target.value)} error={e.desc} /></Col>
            <Col span={12}><Input label="Valor (R$)" required inputMode="numeric" autoComplete="off" placeholder="0,00" value={val} onChange={(ev) => setVal(maskMoney(ev.target.value))} error={e.val} /></Col>
            <Col span={12}><AttachmentsField label="Anexos" items={costFiles} onChange={setCostFiles} /></Col>
          </Grid>
        </DevNote>
      </Dialog>
    );
  }
  if (typeof dlg === 'object') {
    const item = order.costs.find((c) => c.id === dlg.rm);
    const go = () => {
      patchOrder(order.id, user.name, (o) => ({ ...o, costs: o.costs.filter((c) => c.id !== dlg.rm) }), [`Removeu o item de custo: ${item?.description ?? ''}`]);
      toast.show({ type: 'success', title: 'Item removido', message: 'O gasto do equipamento foi recalculado.' });
      close();
    };
    return (
      <Dialog open onClose={close} size="sm" title="Remover item de custo?" subtitle={item?.description} actions={<Actions onClose={close} onConfirm={go} label="Remover item" destructive />}>
        <Text>O custo deixa de entrar no gasto do equipamento. A remoção fica registrada nas atividades.</Text>
      </Dialog>
    );
  }

  // ── Registrar orçamento (RGN006) ──
  if (dlg === 'addbudget') {
    const cents = parseCents(val);
    const e = { val: tried && cents === null ? (val.trim() ? 'Informe um valor maior que zero' : requiredMessage('Valor do orçamento')) : undefined, desc: tried && !text.trim() ? requiredMessage('Descrição') : undefined, file: tried && !file ? requiredMessage('Anexo') : undefined };
    const go = () => {
      setTried(true);
      if (cents === null || !text.trim() || !file) return;
      const now = nowLocal();
      patchOrder(order.id, user.name, (o) => ({
        ...o, statusId: STO.APROVACAO, budget: { cents, description: text.trim(), attachment: file, registeredAt: now, by: user.name },
        costs: [...o.costs.filter((c) => c.kind !== 'orcamento'), { id: `C${Date.now().toString(36)}`, kind: 'orcamento', description: text.trim(), cents, attachment: file }],
        files: [...o.files, { id: `F${Date.now().toString(36)}`, name: file, kind: 'orcamento', at: now, by: user.name }],
      }), [`Anexou o orçamento de ${formatMoney(cents)} - status: Aguardando aprovação`]);
      notify(approvers, { kind: 'os', title: 'Orçamento aguardando aprovação', text: `${order.id}: orçamento de ${formatMoney(cents)}`, href });
      toast.show({ type: 'success', title: 'Orçamento registrado', message: 'A OS está aguardando a aprovação de um usuário do assinante.' });
      close();
    };
    return (
      <Dialog open onClose={close} title="Registrar orçamento" subtitle="Valor, descrição e anexo; a OS fica aguardando aprovação" actions={<Actions onClose={close} onConfirm={go} label="Registrar orçamento" />}>
        <DevNote note="RF503-FLU004 / RGN006: orçamento se aplica a prestador externo ou compra de peça; técnico interno normalmente não gera orçamento (Cristiane, 29/09). Ao registrar, a OS vai para “Aguardando aprovação” e os aprovadores são notificados.">
          <Grid>
            <Col span={12}><Input label="Valor do orçamento (R$)" required inputMode="numeric" autoComplete="off" placeholder="0,00" value={val} onChange={(ev) => setVal(maskMoney(ev.target.value))} error={e.val} /></Col>
            <Col span={12}><Textarea label="Descrição" required rows={3} value={text} onChange={(ev) => setText(ev.target.value)} error={e.desc} /></Col>
            <Col span={12}><AttachmentField label="Anexo do orçamento" required value={file} onChange={setFile} error={e.file} /></Col>
          </Grid>
        </DevNote>
      </Dialog>
    );
  }

  // ── Diagnóstico / solução ──
  if (dlg === 'diagnosis') {
    const err = tried && !text.trim() ? requiredMessage('Diagnóstico') : undefined;
    const go = () => {
      setTried(true);
      if (!text.trim()) return;
      patchOrder(order.id, user.name, (o) => ({ ...o, diagnosis: text.trim(), solution: text2.trim() || undefined }), [order.diagnosis ? 'Atualizou o diagnóstico' : 'Registrou o diagnóstico', ...(text2.trim() && text2.trim() !== order.solution ? ['Registrou a solução aplicada'] : [])]);
      toast.show({ type: 'success', title: 'Diagnóstico salvo', message: 'Registrado nas atividades da OS.' });
      close();
    };
    return (
      <Dialog open onClose={close} title="Diagnóstico e solução" actions={<Actions onClose={close} onConfirm={go} label="Salvar" />}>
        <Stack gap="md">
          <Textarea label="Diagnóstico" required rows={4} value={text} onChange={(e) => setText(e.target.value)} error={err} />
          <Textarea label="Solução aplicada" optional rows={3} value={text2} onChange={(e) => setText2(e.target.value)} />
        </Stack>
      </Dialog>
    );
  }

  // ── Indicar a conclusão → Aguardando validação (FLU007/FLU008) ──
  if (dlg === 'conclude') {
    const err = tried && !text.trim() ? requiredMessage('Solução aplicada') : undefined;
    const go = () => {
      setTried(true);
      if (!text.trim()) return;
      applyOrderConclusion(db, order, text, user.name);
      toast.show({ type: 'success', title: 'Conclusão indicada', message: 'O solicitante foi notificado para validar.' });
      close();
    };
    return (
      <Dialog open onClose={close} title="Indicar a conclusão" subtitle="O solicitante vai confirmar se o problema foi resolvido" actions={<Actions onClose={close} onConfirm={go} label="Indicar conclusão" />}>
        <DevNote note="FLU007/FLU008 / RGN005: indicar a conclusão leva a OS para “Aguardando validação” e notifica o solicitante (plataforma/e-mail para quem tem cadastro; solicitante sem login acompanha por protocolo - RGN011). O envio por WhatsApp é FE002, fora do escopo. A etapa “Verificar garantia” é FE007, fora do escopo.">
          <Textarea label="Solução aplicada" required rows={4} value={text} onChange={(e) => setText(e.target.value)} error={err} />
        </DevNote>
      </Dialog>
    );
  }

  // ── Arquivo ──
  if (dlg === 'file') {
    const err = tried && !file ? requiredMessage('Arquivo') : undefined;
    const go = () => {
      setTried(true);
      if (!file) return;
      patchOrder(order.id, user.name, (o) => ({ ...o, files: [...o.files, { id: `F${Date.now().toString(36)}`, name: file, kind: sel as 'foto' | 'orcamento' | 'outro', at: nowLocal(), by: user.name }] }), [`Anexou o arquivo ${file}`]);
      toast.show({ type: 'success', title: 'Arquivo anexado', message: 'Upload simulado no protótipo.' });
      close();
    };
    return (
      <Dialog open onClose={close} title="Anexar arquivo" subtitle="Fotos antes/depois, orçamentos e outros anexos" actions={<Actions onClose={close} onConfirm={go} label="Anexar" />}>
        <Stack gap="md">
          <Dropdown label="Tipo" required options={Object.entries(FILE_KIND).map(([value, label]) => ({ value, label }))} value={sel} onChange={setSel} />
          <AttachmentField label="Arquivo" required value={file} onChange={setFile} error={err} />
        </Stack>
      </Dialog>
    );
  }

  // ── Reatribuir a validação (FLU010): a pessoa é informada por nome e contato (não há cadastro de quem trabalha na unidade) ──
  if (dlg === 'reassignval') {
    const phone = onlyDigits(text2);
    const e = {
      name: tried && !text.trim() ? requiredMessage('Nome') : undefined,
      contact: tried && !phone ? requiredMessage('Telefone de contato') : tried && !isValidPhone(text2) ? 'Informe um telefone válido' : undefined,
    };
    const go = () => {
      setTried(true);
      if (!text.trim() || !isValidPhone(text2)) return;
      const name = text.trim();
      patchOrder(order.id, user.name, (o) => ({ ...o, validation: o.validation ? { ...o.validation, assignedTo: name, assignedContact: phone } : o.validation }),
        [`Reatribuiu a validação da conclusão de ${order.validation?.assignedTo} para ${name} (${formatPhone(phone)})`]);
      toast.show({ type: 'success', title: 'Validação reatribuída', message: `Copie o link de validação e envie para ${name}.` });
      close();
    };
    return (
      <Dialog open onClose={close} size="sm" title="Reatribuir a validação" subtitle="Informe quem vai confirmar a conclusão na unidade" actions={<Actions onClose={close} onConfirm={go} label="Reatribuir" />}>
        <DevNote note="FLU010: se o solicitante não estiver disponível, o responsável reatribui a validação a outra pessoa da unidade. Não existe cadastro das pessoas que trabalham na unidade, então a pessoa é informada por nome e contato (telefone) e o link de validação é enviado a ela (o envio ativo por WhatsApp é FE002, fora do escopo). A validação fica registrada em nome do solicitante original (RGN010).">
          <Stack gap="md">
            <Input label="Nome" required autoComplete="off" value={text} onChange={(ev) => setText(ev.target.value)} error={e.name} />
            <Input label="Telefone de contato" required inputMode="tel" autoComplete="off" placeholder="(00) 00000-0000" value={text2} onChange={(ev) => setText2(formatPhone(ev.target.value))} error={e.contact} />
          </Stack>
        </DevNote>
      </Dialog>
    );
  }

  if (dlg === 'reassign') return <ReassignDialog order={order} onClose={close} />;
  return null;
}

// ───────────────────────── Validação da conclusão ─────────────────────────
function ValidationCard({ order, defaultOpen, defaultResult }: { order: WorkOrder; defaultOpen?: boolean; defaultResult?: 'sim' | 'nao' }) {
  const toast = useToast();
  const { db, user, can } = useSubSession();
  const [open, setOpen] = useState(!!defaultOpen || user.profile === 'solicitante');
  const [result, setResult] = useState<'sim' | 'nao' | ''>(defaultResult ?? '');
  const [comment, setComment] = useState('');
  const [tried, setTried] = useState(false);
  const [reassign, setReassign] = useState(false);
  const v = order.validation!;
  const isRequester = user.profile === 'solicitante';
  const canManage = can('os', 'editar') && user.profile !== 'executor';
  const onBehalf = !isRequester;
  const eq = equipmentOf(db, order.equipmentId);
  const href = `os.html?id=${order.id}`;

  const submit = () => {
    setTried(true);
    if (!result || (result === 'nao' && !comment.trim())) return;
    applyOrderValidation(order, result, comment, user.name, onBehalf ? v.assignedTo : undefined, href);
    if (result === 'sim') toast.show({ type: 'success', title: 'OS concluída', message: 'A solicitação de origem foi encerrada junto com a OS.' });
    else toast.show({ type: 'warning', title: 'OS reaberta para ação', message: 'O comentário foi enviado ao responsável e ao executor.' });
  };
  const copy = async () => {
    const link = `${location.origin}/assinante/screens/${href}`;
    try { await navigator.clipboard.writeText(link); } catch { /* sem permissão de área de transferência */ }
    toast.show({ type: 'info', title: 'Link copiado', message: 'Encaminhe a um colega da unidade; a validação fica em nome do solicitante original.' });
  };

  return (
    <DevNote note="FLU008-FLU010 / RGN005 / RGN010 / CTA002 / CTA006: a OS só é encerrada após a validação. Sim → OS Concluída e solicitação de origem encerrada (segue Convertida em OS). Não → volta a Em andamento para o responsável, com o comentário. 💡 Aqui “Não” devolve a OS para ação (spec admite também ficar em Aguardando validação) - confirmar. O solicitante responde pelo portal (PWA RF004); para o gestor, “Registrar validação em nome do solicitante” é demonstração.">
      <Card title="Validação da conclusão" subtitle={`Aguardando ${v.assignedTo} desde ${formatDateTime(v.requestedAt)}`}>
        <Stack gap="md">
          {open ? (
            <>
              <RadioButton name="valid" label="O problema foi resolvido?" orientation="horizontal" options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]} value={result} onChange={(r) => setResult(r as 'sim' | 'nao')} error={tried && !result ? requiredMessage('O problema foi resolvido?') : undefined} />
              <Textarea label="Comentário" required={result === 'nao'} optional={result !== 'nao'} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} error={tried && result === 'nao' && !comment.trim() ? requiredMessage('Comentário') : undefined} />
              <Stack direction="horizontal" gap="sm" wrap>
                <Button size="sm" onClick={submit}>{onBehalf ? 'Registrar validação' : 'Confirmar'}</Button>
                {onBehalf && <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Fechar</Button>}
              </Stack>
            </>
          ) : (
            can('os', 'editar') && !canManage ? <Text>Aguardando a validação do solicitante</Text> : null
          )}
          {(canManage || isRequester) && (
            <Stack direction="horizontal" gap="sm" wrap>
              <Button size="sm" variant="secondary" iconLeft={<IconUserEdit size={16} />} onClick={() => setReassign(true)}>Reatribuir a validação</Button>
              <Button size="sm" variant="secondary" iconLeft={<IconCopy size={16} />} onClick={copy}>Copiar link de validação</Button>
            </Stack>
          )}
        </Stack>
        {reassign && <Dlgs order={order} dlg="reassignval" setDlg={() => setReassign(false)} />}
      </Card>
    </DevNote>
  );
}

// ───────────────────────── Tela ─────────────────────────
function OsScreen() {
  const toast = useToast();
  const refs = useRefs();
  const isMobile = useIsMobile();
  const { db, user, can, canSeeCosts, unitIds } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [dlg, setDlg] = useState<Dlg>(null);
  const isExecutor = user.profile === 'executor';
  const showCostsTab = canSeeCosts || isExecutor;
  const [tab, setTab] = useState(() => (mode === 'addvisit' ? 1 : mode === 'addcost' && showCostsTab ? 2 : 0));
  const [histShown, setHistShown] = useState(10);
  const [preview, setPreview] = useState<{ name: string; kind: string } | null>(null);
  const visible = ordersVisible(db, unitIds, user.id, isExecutor);
  const order = visible.find((o) => o.id === param('id'));

  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const map: Partial<Record<Mode, Dlg>> = { approve: 'approve', reject: 'reject', cancel: 'status', addvisit: 'addvisit', addcost: 'addcost', reassign: 'reassign', conclude: 'conclude', addbudget: 'addbudget' };
    setDlg(map[mode] ?? null);
  }, [mode]);

  if (!order) {
    return (
      <AppLayout active="os" screen="os">
        <Stack gap="xl">
          <PageHeader title="OS não encontrada" breadcrumb={[{ label: 'Ordens de serviço', href: 'ordens-servico.html' }, { label: param('id') ?? 'OS' }]} />
          <Feedback type="error" title="OS não encontrada" message="Ela não existe ou você não tem acesso. Volte para a listagem e tente novamente." />
        </Stack>
      </AppLayout>
    );
  }

  const eq = equipmentOf(db, order.equipmentId);
  const req = db.requests.find((r) => r.id === order.requestId);
  const plan = db.plans.find((p) => p.id === order.planId);
  const base = refs.base(order.statusId);
  const late = overdueDays(order, base);
  const editable = isEditable(base);
  const canEdit = can('os', 'editar') && editable;
  const canPlan = canEdit && !isExecutor;
  const canApprove = can('os', 'aprovar');
  const showCosts = canSeeCosts || isExecutor;
  const blocked = needsApproval(order);
  const exec = executorInfo(db, order.executor);
  const stName = refs.status(order.statusId)?.name ?? '';
  // Anexo do orçamento como link (a abertura do documento é simulada no protótipo)
  const attachmentLink = (name?: string) => (name
    ? <a className="text-link" href="#" onClick={(e) => { e.preventDefault(); toast.show({ type: 'info', title: 'Visualização simulada', message: `${name}: a prévia de documentos é simulada no protótipo.` }); }}>{name}</a>
    : '-');
  const eqLink = eq ? <a className="text-link" href={`equipamento.html?id=${eq.id}`}>{eq.name}</a> : '-';


  // ── Resumo ──
  const history = [...order.activities].reverse();
  // Fotos da solicitação de origem (o cadastro guarda só a quantidade; no protótipo, imagens de demonstração; nada é copiado)
  const DEMO_PHOTOS = ['forno2.webp', 'chapa.jpg', 'images.jpg', 'placa.webp'];
  const requestPhotos = req ? Array.from({ length: req.photos }, (_, k) => DEMO_PHOTOS[k % DEMO_PHOTOS.length]) : [];
  const pendingBudget = !!order.budget && !order.budget.decision && editable;
  const respName = userName(db, order.responsibleId);
  const lastVisit = order.visits[order.visits.length - 1];
  const currentVisit = lastVisit ?? (order.schedule ? { date: order.schedule.date, from: order.schedule.from, to: order.schedule.to, arrivedAt: undefined } : undefined);
  const visitStatus = currentVisit ? <Badge status={currentVisit.arrivedAt ? 'success' : 'info'}>{currentVisit.arrivedAt ? 'Realizada' : 'Agendada'}</Badge> : null;
  const executorValue = order.executor.kind === 'prestador'
    ? <a className="text-link" href={`prestador.html?id=${order.executor.providerId}`}>{executorText(db, order.executor)}</a>
    : `${exec.name} (interno)`;

  // Valores financeiros (RF503): três etapas distintas, e um valor pode aparecer em mais de uma.
  // Orçado = orçamento do prestador (pendente ou aprovado; o reprovado não conta), sem duplicar o item espelho na lista de custos.
  // Aprovado = orçamento aprovado + itens lançados direto no sistema do assinante (não passam pela aprovação do prestador).
  // Realizado = itens lançados direto (extras) + o orçamento aprovado depois de CONFIRMADO como realizado (aprovar não é gastar; ver Budget.realized).
  // 💡 Limitação: o modelo não distingue custo previsto de realizado nos itens lançados no sistema, então todo item lançado conta como realizado (a validar).
  const directCosts = order.costs.filter((c) => !(c.kind === 'orcamento' && order.budget));
  const directTotal = directCosts.reduce((n, c) => n + c.cents, 0);
  const pendingConfirm = unconfirmedBudgetCents(order);
  const budgeted = order.budget ? (order.budget.decision === 'reprovado' ? 0 : order.budget.cents) : 0;
  const approved = (order.budget?.decision === 'aprovado' ? order.budget.cents : 0) + directTotal;
  const realized = orderRealizedCents(order);

  const eqCard = (
          <Card title="Equipamento">
            <div className="card-body-tight">
              <Stack gap="md">
                <div className="os-eq-id">
                  {eq?.photoName ? (
                    <button type="button" className="sol-photo os-eq-photo" onClick={() => setPreview({ name: eq.photoName!, kind: 'equipamento' })} aria-label={`Ampliar a foto do equipamento ${eq.name}`}>
                      {photoSrc(eq.photoName) ? <img src={photoSrc(eq.photoName)} alt="" /> : <IconPhoto size={20} aria-hidden="true" />}
                    </button>
                  ) : (
                    <span className="sol-photo os-eq-photo is-empty" role="img" aria-label="Equipamento sem foto cadastrada"><IconPhoto size={20} aria-hidden="true" /></span>
                  )}
                  <div className="os-eq-text">
                    <span className="os-eq-name">{eqLink}</span>
                    <dl className="os-eq-spec">
                      <div><dt>Fabricante</dt><dd>{eq?.maker || '-'}</dd></div>
                      <div><dt>Modelo</dt><dd>{eq?.model || '-'}</dd></div>
                    </dl>
                  </div>
                </div>
                <div className="os-eq-loc">
                  <ReadField label="Unidade" value={eq ? unitName(db, eq.unitId) : undefined} />
                  <ReadField label="Ambiente" value={eq ? environmentName(db, eq.environmentId) : undefined} />
                </div>
              </Stack>
            </div>
          </Card>
  );
  const historyCard = (
    <DevNote note="RF503-CTA004: log automático de toda interação (status, atribuição, anexos, visitas, custos, aprovação, validação) com autor, data e hora - mais recente primeiro. O histórico completo fica na aba Resumo (não há aba Atividades); carregamento progressivo com “Carregar mais”.">
      <Card title="Histórico de atividades" subtitle="Registro das ações e alterações realizadas nesta OS">
        <div className="card-body-tight">
          <Stack gap="md">
            {history.length ? <ActivityTimeline items={history.slice(0, histShown)} /> : <Text>Nenhuma atividade registrada</Text>}
            {history.length > histShown && <Stack direction="horizontal"><Button size="sm" variant="secondary" onClick={() => setHistShown((n) => n + 10)}>Carregar mais</Button></Stack>}
          </Stack>
        </div>
      </Card>
    </DevNote>
  );

  // ── OS preventiva: plano, execução (RF603) e histórico ──
  const planExec = db.executions.find((x) => x.id === order.executionId);
  const ex = order.execution;
  const checklistPlain = plan?.checklist.filter((c) => c.kind !== 'leitura') ?? [];
  const readingDefs = plan?.checklist.filter((c) => c.kind === 'leitura') ?? [];
  const readingsList = ex ? (ex.readingsLog ?? readingDefs.map((c) => ({ id: c.id, name: c.text, unit: c.unit && c.unit !== NO_UNIT ? c.unit : '', value: (ex.readings[c.id] ?? '').trim() }))) : [];
  const doneChecks = ex ? checklistPlain.filter((c) => ex.checks[c.id]).length : 0;
  const evMet = (e: string) => (!ex ? false : e === 'Assinatura/aceite' ? !!ex.signedBy : e === 'Relatório técnico' ? !!ex.report?.trim() : e === 'Leitura/medição' ? readingsList.length > 0 && readingsList.every((x) => x.value) : ex.evidences.includes(e));
  const evTotal = plan?.evidences.length ?? 0;
  const evDone = plan ? plan.evidences.filter(evMet).length : 0;
  const anomalyText = ex?.anomaly ?? planExec?.anomalies;
  const anomalyReq = anomalyText ? db.requests.find((q) => q.description.includes(`preventiva ${order.id}`)) : undefined;
  const lateExec = planExec?.doneAt && order.dueAt ? planExec.doneAt.slice(0, 10) > order.dueAt : false;
  const execBadge = base === 'cancelado' ? <Badge status="neutral">Cancelada</Badge> : base === 'concluido' ? <Badge status={lateExec ? 'warning' : 'success'}>{lateExec ? 'Concluída com atraso' : 'Concluída no prazo'}</Badge>
    : late > 0 ? <Badge status="error" solid icon={<IconAlertTriangle size={14} />}>{`Atrasada há ${late} ${late === 1 ? 'dia' : 'dias'}`}</Badge> : <Badge status="info">No prazo</Badge>;
  const emptyExecText = base === 'cancelado' ? 'A OS foi cancelada e a execução não foi registrada' : order.statusId === STO.ABERTA ? 'A execução ainda não foi registrada' : base === 'concluido' ? 'Os registros desta execução não estão disponíveis (dados anteriores ao registro detalhado)' : 'Em execução. Os registros aparecem aqui quando a execução for concluída';
  const anomalyCard = anomalyText ? (
    <Card title="Anomalias" subtitle="Registradas durante a preventiva">
      <div className="card-body-tight">
        <Stack gap="xs">
          <Text>{anomalyText}</Text>
          {anomalyReq && <Stack direction="horizontal"><a className="text-link" href={`solicitacao.html?id=${anomalyReq.id}`}>{`Solicitação corretiva ${anomalyReq.id}`}</a></Stack>}
        </Stack>
      </div>
    </Card>
  ) : null;
  const canExecute = can('os', 'editar') && (order.statusId === STO.ABERTA || order.statusId === STO.ANDAMENTO) && base !== 'cancelado';
  const goExecution = () => goTo(`execucao-preventiva.html?os=${order.id}&from=os`);

  const prevSummary = (
    <Stack gap="lg">
      <div className="os-pair">
        <Grid>
          <Col span={8} fill>
            <DevNote note="OS preventiva: o destaque é o plano que originou a OS (não há solicitação nem problema relatado). Dados reais do plano associado.">
              <Card title="Informações do plano">
                <div className="card-body-tight">
                  <div className="os-fields"><Grid>
                    <Col span={6}><ReadField label="Plano de manutenção" value={plan ? <a className="text-link" href={`plano.html?id=${plan.id}`}>{plan.name}</a> : '-'} /></Col>
                    <Col span={6}><ReadField label="Frequência" value={plan ? describeFrequency(plan) : undefined} /></Col>
                    <Col span={12}><ReadField label="Descrição" value={plan?.description ?? order.reported} /></Col>
                  </Grid></div>
                </div>
              </Card>
            </DevNote>
          </Col>
          <Col span={4} fill>{eqCard}</Col>
        </Grid>
      </div>
      <DevNote note="Resumo da execução: só o que a RF603 efetivamente registrou (checklist, leituras, evidências); antes da conclusão não há progresso persistido. O detalhe fica na aba Execução.">
        <Card title="Resumo da execução"{...(!ex ? { subtitle: emptyExecText } : {})}>
          {ex && (
          <div className="card-body-tight">
            {(
              <div className="os-fields"><Grid>
                <Col span={6}><ReadField label="Data de realização" value={planExec?.doneAt ? formatDateTime(planExec.doneAt) : undefined} /></Col>
                <Col span={6}><ReadField label="Executor" value={planExec?.doneBy ?? exec.name} /></Col>
                <Col span={6}><ReadField label="Procedimentos realizados" value={`${doneChecks} de ${checklistPlain.length}`} /></Col>
                {readingDefs.length > 0 && <Col span={6}><ReadField label="Leituras e medições" value={`${readingsList.filter((x) => x.value).length} de ${readingsList.length} registradas`} /></Col>}
                {evTotal > 0 && <Col span={6}><ReadField label="Evidências exigidas" value={`${evDone} de ${evTotal} atendidas`} /></Col>}
              </Grid></div>
            )}
          </div>
          )}
        </Card>
      </DevNote>
      {anomalyCard}
      {historyCard}
    </Stack>
  );

  const FOTO_GROUPS: Array<{ ev: string; moment?: 'antes' | 'depois'; label: string }> = [
    { ev: 'Foto antes/depois', moment: 'antes', label: 'Antes da manutenção' }, { ev: 'Foto antes/depois', moment: 'depois', label: 'Depois da manutenção' }, { ev: 'Foto da placa', label: 'Foto da placa' },
  ];
  const photoGroups = FOTO_GROUPS.filter((g) => plan?.evidences.includes(g.ev)).map((g) => ({ ...g, items: (ex?.evidenceFiles ?? []).filter((x) => x.evidence === g.ev && x.moment === g.moment) }));
  const execSection = (title: string, subtitle: string | undefined, body: ReactNode) => (
    <Card title={title} subtitle={subtitle}><div className="card-body-tight">{body}</div></Card>
  );
  const prevExecution = !ex ? (
    <Card title="Execução" subtitle={base === 'cancelado' ? 'OS cancelada' : 'Registros da manutenção preventiva'}>
      <div className="card-body-tight">
        <Stack gap="md">
          <Text>{base === 'cancelado' ? 'A OS foi cancelada e a manutenção não foi executada' : base === 'concluido' ? 'Os registros desta execução não estão disponíveis (dados anteriores ao registro detalhado)' : order.statusId === STO.ABERTA ? 'A manutenção ainda não foi executada' : 'A manutenção está em execução. Os registros aparecem aqui quando a execução for concluída'}</Text>
          {canExecute && <Stack direction="horizontal"><Button size="sm" iconLeft={<IconPlayerPlay size={16} />} onClick={goExecution}>Abrir execução</Button></Stack>}
        </Stack>
      </div>
    </Card>
  ) : (
    <DevNote note="Visualização dos registros da RF603 (somente leitura, sem formulário): checklist, leituras (nome, valor e unidade como estavam no plano na execução), fotos identificadas por momento/placa, relatório, anomalias, observações e a confirmação do executor. Só aparecem os tipos de evidência configurados no plano.">
      <Stack gap="lg">
        {checklistPlain.length > 0 && execSection('Checklist', `${doneChecks} de ${checklistPlain.length} procedimentos realizados`, (
          <ul className="ex-list">
            {checklistPlain.map((c) => (
              <li key={c.id} className="ex-row">
                <span className="page-text">{c.text}</span>
                <Stack direction="horizontal" gap="sm" align="center">
                  <span className="ex-tag">{c.kind === 'opcional' ? 'Opcional' : 'Obrigatório'}</span>
                  {ex.checks[c.id] ? <Badge status="success" dot>Realizado</Badge> : <Badge status="neutral" dot>Não realizado</Badge>}
                </Stack>
              </li>
            ))}
          </ul>
        ))}
        {readingsList.length > 0 && execSection('Leituras e medições', undefined, (
          <ul className="ex-list">
            {readingsList.map((x) => (
              <li key={x.id} className="ex-row"><span className="page-text">{x.name}</span><span className="page-text"><strong>{x.value ? `${x.value}${x.unit ? ` ${x.unit}` : ''}` : 'Não registrada'}</strong></span></li>
            ))}
          </ul>
        ))}
        {photoGroups.length > 0 && execSection('Fotos da execução', undefined, (
          <Stack gap="md">
            {photoGroups.map((g) => (
              <Stack key={g.label} gap="xs">
                <span className="page-label">{g.label}</span>
                {g.items.length ? (
                  <ul className="ev-grid" aria-label={g.label}>
                    {g.items.map((it, k) => (
                      <li key={`${it.name}-${k}`} className="ev-item">
                        <button type="button" className="ev-thumb" title={it.name} onClick={() => setPreview({ name: it.name, kind: 'foto' })} aria-label={`Ampliar foto: ${it.name}`}>
                          {photoSrc(it.name) ? <img src={photoSrc(it.name)} alt="" /> : <span className="ev-ph"><IconPhoto size={24} aria-hidden="true" /><span className="ev-ph-name">{it.name}</span></span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <span className="cell-secondary">Nenhuma foto registrada</span>}
              </Stack>
            ))}
          </Stack>
        ))}
        {plan?.evidences.includes('Relatório técnico') && execSection('Relatório técnico', undefined, <Text>{ex.report || 'Não preenchido'}</Text>)}
        {anomalyText && execSection('Anomalias', 'Registradas durante a preventiva', (
          <Stack gap="xs"><Text>{anomalyText}</Text>{anomalyReq && <Stack direction="horizontal"><a className="text-link" href={`solicitacao.html?id=${anomalyReq.id}`}>{`Solicitação corretiva ${anomalyReq.id}`}</a></Stack>}</Stack>
        ))}
        {ex.notes && execSection('Observações', undefined, <Text>{ex.notes}</Text>)}
        {ex.signedBy && execSection('Confirmação da execução', undefined, (
          <div className="os-fields"><Grid>
            <Col span={6}><ReadField label="Nome do executor" value={ex.signedBy} /></Col>
            <Col span={6}><ReadField label="Data e hora" value={planExec?.doneAt ? formatDateTime(planExec.doneAt) : undefined} /></Col>
            <Col span={12}><ReadField label="Confirmação" value="Confirmou que realizou os procedimentos registrados nesta execução" /></Col>
          </Grid></div>
        ))}
      </Stack>
    </DevNote>
  );

  const summary = (
    <Stack gap="lg">
      <div className="os-pair">
      <Grid>
        <Col span={8} fill>
          <DevNote note="Problema relatado: reúne o que o solicitante informou na origem (tipo de solicitação, descrição, impacto, reparo anterior e fotos), somente leitura. O impacto informado não é a prioridade da OS, e o tipo de solicitação não é o tipo de manutenção. Sem solicitação de origem (preventiva) o destaque é o nome do plano, com a frequência, e o texto da OS; impacto, reparo anterior e fotos não se aplicam. As fotos são as da solicitação, sem copiar arquivos.">
            <Card title="Problema relatado">
              <div className="card-body-tight">
                <Stack gap="md">
                  <Stack gap="xs">
                    {(req || plan) && <span className="os-problem-type">{req ? (refs.requestType(req.problemId)?.name ?? '-') : plan?.name}</span>}
                    <p className="sol-summary-text">{req?.description ?? order.reported}</p>
                  </Stack>
                  {!req && plan && (
                    <dl className="sol-meta">
                      <div><dt>Frequência</dt><dd>{describeFrequency(plan)}</dd></div>
                    </dl>
                  )}
                  {req && (
                    <dl className="sol-meta">
                      <div><dt>Impacto informado</dt><dd><Badge status={IMPACT_BADGE[req.impact]} dot>{IMPACT_LABEL[req.impact]}</Badge></dd></div>
                      <div><dt>Relacionado a reparo anterior</dt><dd>{req.previousRepair.related ? 'Sim' : 'Não'}</dd></div>
                    </dl>
                  )}
                  {requestPhotos.length > 0 && (
                    <Stack gap="xs">
                      <span className="read-label">Fotos do problema</span>
                      <ul className="sol-photos" aria-label="Fotos enviadas pelo solicitante">
                        {requestPhotos.map((n, k) => (
                          <li key={`${n}-${k}`}>
                            <button type="button" className="sol-photo" onClick={() => setPreview({ name: n, kind: 'foto' })} aria-label={`Ampliar foto ${k + 1} de ${requestPhotos.length}`}>
                              {photoSrc(n) ? <img src={photoSrc(n)} alt="" /> : <IconPhoto size={20} aria-hidden="true" />}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </Stack>
                  )}
                </Stack>
              </div>
            </Card>
          </DevNote>
        </Col>
        <Col span={4} fill>
          {eqCard}
        </Col>
      </Grid>
      </div>

      <Grid>
        <Col span={12}>
          <Stack gap="lg">
          {req?.internalNotes && !isExecutor && (
            <DevNote note="Observações internas registradas na triagem (RF402): somente leitura, separadas do diagnóstico e das observações posteriores. Não aparecem para quem abriu a solicitação nem para o perfil Executor (prestador).">
              <Card title="Observações da triagem" subtitle="Registradas na triagem da solicitação"><Text>{req.internalNotes}</Text></Card>
            </DevNote>
          )}
          {order.troubleshooting && <TroubleshootingNotes run={order.troubleshooting} />}

          <DevNote note="Atendimento vigente: a visita agendada; se já foi realizada (chegada registrada) e não há nova, a última, identificada como realizada; uma revisita agendada passa a ser a vigente. O histórico completo fica na aba Visitas. Executor/prestador e contato na unidade ficam só aqui.">
            <Card title="Atendimento" subtitle={visitStatus ? undefined : 'Nenhuma visita registrada'} actions={visitStatus ?? undefined}>
              <div className="card-body-tight">
                <div className="os-fields"><Grid>
                  {currentVisit && <Col span={6}><ReadField label="Data agendada" value={formatDate(currentVisit.date)} /></Col>}
                  {currentVisit && <Col span={6}><ReadField label="Período de atendimento" value={currentVisit.from && currentVisit.to ? `${currentVisit.from} às ${currentVisit.to}` : undefined} /></Col>}
                  <Col span={6}><ReadField label="Executor / Prestador" value={executorValue} /></Col>
                  <Col span={6}><ReadField label="Contato na unidade" value={`${order.contactName}${order.contactPhone ? ` · ${order.contactPhone}` : ''}`} /></Col>
                </Grid></div>
              </div>
            </Card>
          </DevNote>

          <Card title="Diagnóstico e solução" actions={canEdit ? <Button size="sm" variant="secondary" iconLeft={<IconPencil size={16} />} onClick={() => setDlg('diagnosis')}>{order.diagnosis ? 'Editar' : 'Registrar'}</Button> : undefined}>
            <div className="card-body-tight">
              <div className="os-fields"><Grid>
                <Col span={6}><ReadField label="Diagnóstico" value={order.diagnosis} /></Col>
                <Col span={6}><ReadField label="Solução" value={order.solution} /></Col>
              </Grid></div>
            </div>
          </Card>

          {order.budget?.decision && (
            <Card title="Orçamento" subtitle={`${order.budget.decision === 'aprovado' ? 'Aprovado' : 'Reprovado'} por ${order.budget.decidedBy}`}>
              <div className="card-body-tight">
                <Grid>
                  <Col span={6}><ReadField label="Valor" value={canSeeCosts ? formatMoney(order.budget.cents) : 'Restrito ao Administrador e ao Gestor'} /></Col>
                  <Col span={6}><ReadField label="Registrado por" value={`${order.budget.by} em ${formatDate(order.budget.registeredAt)}`} /></Col>
                  <Col span={12}><ReadField label="Descrição" value={order.budget.description} /></Col>
                  <Col span={6}><ReadField label="Anexos" value={<AttachmentsStack names={namesOf(order.budget)} label="orçamento" />} /></Col>
                  {order.budget.justification && <Col span={6}><ReadField label="Justificativa" value={order.budget.justification} /></Col>}
                </Grid>
              </div>
            </Card>
          )}

          {order.kind === 'preventiva' && plan && (
            <DevNote note="OS preventiva (RF601/RF603): o checklist vem do plano; a execução (checklist, leituras, evidências) é feita na tela de execução da preventiva.">
              <Card title="Checklist do plano" subtitle={plan.name} actions={can('os', 'editar') ? <Button size="sm" iconLeft={<IconPlayerPlay size={16} />} onClick={() => goTo(`execucao-preventiva.html?os=${order.id}&from=os`)}>Abrir execução</Button> : undefined}>
                <Stack as="ul" gap="xs" className="ts-list">
                  {plan.checklist.map((c) => <li key={c.id} className="page-text">{c.text} · {c.kind === 'opcional' ? 'opcional' : 'obrigatório'}</li>)}
                </Stack>
              </Card>
            </DevNote>
          )}

          </Stack>
        </Col>
      </Grid>

    {historyCard}
    </Stack>
  );

  // ── Visitas ──
  type VisitRow = Record<string, unknown> & { id: string; date: string; window: string; tech: string; arrived?: string; note?: string };
  const visitRows: VisitRow[] = order.visits.map((v) => ({ id: v.id, date: v.date, window: `${v.from} às ${v.to}`, tech: v.technician, arrived: v.arrivedAt, note: v.note }));
  const arrive = (id: string) => {
    patchOrder(order.id, user.name, (o) => ({ ...o, visits: o.visits.map((v) => (v.id === id ? { ...v, arrivedAt: nowLocal() } : v)) }), ['Registrou a chegada na visita']);
    toast.show({ type: 'success', title: 'Chegada registrada', message: 'Registrada nas atividades da OS.' });
  };
  const arriveBtn = (r: VisitRow) => (canEdit && !r.arrived ? <Button size="sm" variant="secondary" iconLeft={<IconMapPin size={16} />} onClick={() => arrive(r.id)}>Registrar chegada</Button> : undefined);
  const visits = (
    <DevNote note="RF503-FLU002 / CTA005: lista de visitas (data agendada, janela, técnico, chegada registrada, observação). Uma OS aceita várias visitas e revisitas.">
      <DataTable<VisitRow>
        title="Visitas" subtitle={`${order.visits.length} ${order.visits.length === 1 ? 'visita registrada' : 'visitas registradas'}`} rows={visitRows}
        emptyTitle="Nenhuma visita agendada" emptyDescription="Adicione a primeira visita para registrar o atendimento"
        actions={canEdit ? <Button size="sm" iconLeft={<IconPlus size={16} />} onClick={() => setDlg('addvisit')}>{order.visits.length ? 'Adicionar revisita' : 'Adicionar visita'}</Button> : undefined}
        columns={[
          { key: 'date', label: 'Data agendada', render: (v) => formatDate(String(v)) },
          { key: 'window', label: 'Período de atendimento' },
          { key: 'tech', label: 'Técnico' },
          { key: 'arrived', label: 'Chegada', render: (v, r) => (v ? formatDateTime(String(v)) : arriveBtn(r) ?? 'Não registrada') },
          { key: 'note', label: 'Observação', render: (v) => (v ? String(v) : '-') },
        ]}
        toCard={(r) => ({ title: formatDate(r.date), subtitle: r.window, fields: [{ label: 'Técnico', value: r.tech }, { label: 'Chegada', value: r.arrived ? formatDateTime(r.arrived) : 'Não registrada' }, { label: 'Observação', value: r.note ?? '-' }], actions: arriveBtn(r) })}
      />
    </DevNote>
  );

  // ── Custos ──
  type CostRow = Record<string, unknown> & { id: string; kind: string; isBudget: boolean; description: string; cents: number; attachments: string[] };
  const costRows: CostRow[] = order.costs.map((c) => ({ id: c.id, kind: COST_KIND_LABEL[c.kind], isBudget: c.kind === 'orcamento', description: c.description, cents: c.cents, attachments: namesOf(c) }));
  const money = (c: number) => (canSeeCosts ? formatMoney(c) : 'Restrito');
  const rmBtn = (r: CostRow) => (canEdit ? <RowActions><RowAction icon={<IconTrash size={16} />} label="Remover item de custo" target={r.description} onClick={() => setDlg({ rm: r.id })} /></RowActions> : undefined);
  // Item "Orçamento de prestador" ainda não aprovado não é custo realizado: aparece com a situação da decisão
  const budgetBadge = order.budget && order.budget.decision !== 'aprovado' ? <Badge status={order.budget.decision === 'reprovado' ? 'error' : 'warning'}>{order.budget.decision === 'reprovado' ? 'Reprovado' : 'Aguardando aprovação'}</Badge> : null;
  const kindCell = (r: CostRow) => (r.isBudget && budgetBadge ? <Stack direction="horizontal" align="center" gap="xs" wrap><span>{r.kind}</span>{budgetBadge}</Stack> : r.kind);
  const costs = (
    <Stack gap="md">
      {canSeeCosts ? (
        <DevNote note="Totais: orçado = orçamento enviado pelo prestador (pendente ou aprovado); aprovado = orçamento aprovado por um usuário do assinante + itens lançados direto no sistema; realizado = itens lançados direto (o orçamento aprovado não vira custo realizado sozinho). 💡 O modelo não distingue previsto de realizado nos itens lançados: pendente de validação. Um orçamento não é custo realizado enquanto não for aprovado. RGN003: os realizados alimentam o gasto do equipamento (RF304) e o Dashboard. Só Administrador e Gestor veem valores (RF304-RGN003).">
          <Grid>
            <Col span={4} fill><KpiCard label="Orçado" value={<KpiMoney cents={budgeted} />} description="Total de orçamentos recebidos" /></Col>
            <Col span={4} fill><KpiCard label="Aprovado" value={<KpiMoney cents={approved} />} description="Orçamento aprovado e custos extras" /></Col>
            <Col span={4} mobileFull fill><KpiCard label="Realizado" value={<KpiMoney cents={realized} />} description="Custo confirmado e custos extras" /></Col>
          </Grid>
        </DevNote>
      ) : <Feedback type="info" message="Os valores de custo são visíveis apenas para o Administrador e o Gestor de manutenção" />}
      {canSeeCosts && pendingConfirm > 0 && (
        <DevNote note="Há orçamento aprovado ainda não confirmado como custo realizado: o aprovado é só a autorização de gasto. O link abre a confirmação (valor realizado, com motivo se for diferente) e só aparece para quem pode aprovar orçamento. Some depois de confirmar.">
          <Stack direction="horizontal" align="center" gap="sm" wrap>
            <Text>{`${formatMoney(pendingConfirm)} do orçamento aprovado ainda não foram confirmados como custo realizado`}</Text>
            {canApprove && <Button variant="ghost" size="sm" onClick={() => setDlg('confirmcost')}>Confirmar custo realizado</Button>}
          </Stack>
        </DevNote>
      )}
      {canSeeCosts && order.budget?.realized && (
        <Text>{`Custo realizado confirmado por ${order.budget.realized.by} em ${formatDate(order.budget.realized.confirmedAt.slice(0, 10))}${order.budget.realized.reason ? `. Motivo da diferença: ${order.budget.realized.reason}` : ''}`}</Text>
      )}
      <DataTable<CostRow>
        title="Itens de custo" subtitle="Peça, mão de obra, orçamento de prestador e outros" rows={costRows} emptyTitle="Nenhum item de custo" emptyDescription="Adicione os itens à medida que forem realizados"
        actions={canEdit ? <Button size="sm" iconLeft={<IconPlus size={16} />} onClick={() => setDlg('addcost')}>Adicionar item de custo</Button> : undefined}
        columns={[
          { key: 'kind', label: 'Tipo', render: (_, r) => kindCell(r) }, { key: 'description', label: 'Descrição' },
          { key: 'cents', label: 'Valor', align: 'right', render: (v) => money(Number(v)) },
          { key: 'attachments', label: 'Anexos', render: (_, r) => <AttachmentsStack names={r.attachments} label={`item de custo ${r.description}`} /> },
          { key: 'id', label: 'Ações', sticky: 'right', render: (_, r) => rmBtn(r) ?? null },
        ]}
        toCard={(r) => ({ title: r.description, subtitle: r.kind, badge: r.isBudget ? budgetBadge ?? undefined : undefined, fields: [{ label: 'Valor', value: money(r.cents) }, { label: 'Anexos', value: <AttachmentsStack names={r.attachments} label={`item de custo ${r.description}`} /> }], actions: rmBtn(r) })}
      />
    </Stack>
  );

  // ── Arquivos ──
  type FileRow = Record<string, unknown> & { id: string; name: string; kind: keyof typeof FILE_KIND; at: string; by: string; ev?: string };
  const fileRows: FileRow[] = order.files.map((f) => ({ id: f.id, name: f.name, kind: f.kind, at: f.at, by: f.by, ev: f.evidence ? `${f.evidence}${f.moment ? ` (${f.moment})` : ''}` : undefined }));
  const fileIcon = (k: keyof typeof FILE_KIND) => (k === 'orcamento' ? <IconFileInvoice size={20} aria-hidden="true" /> : k === 'foto' ? <IconPhoto size={20} aria-hidden="true" /> : <IconFileText size={20} aria-hidden="true" />);
  const openFile = (r: FileRow) => (r.kind === 'foto' || photoSrc(r.name) ? setPreview({ name: r.name, kind: r.kind }) : toast.show({ type: 'info', title: 'Visualização simulada', message: `${r.name}: a prévia de documentos é simulada no protótipo.` }));
  const fileCell = (r: FileRow) => (
    <button type="button" className="os-file" onClick={() => openFile(r)} aria-label={`Visualizar ${r.name}`}>
      <span className="os-file-thumb">{photoSrc(r.name) ? <img src={photoSrc(r.name)} alt="" /> : fileIcon(r.kind)}</span>
      <span className="os-file-name">{r.name}</span>
    </button>
  );
  const fileActions = (r: FileRow) => (
    <RowActions>
      <RowAction icon={<IconEye size={16} />} label="Visualizar arquivo" target={r.name} onClick={() => openFile(r)} />
      <RowAction icon={<IconDownload size={16} />} label="Baixar arquivo" target={r.name} onClick={() => toast.show({ type: 'info', title: 'Download simulado', message: `${r.name}: o download é simulado no protótipo.` })} />
    </RowActions>
  );
  const files = (
    <DataTable<FileRow>
      title="Arquivos" subtitle="Fotos, orçamentos e demais anexos" rows={fileRows} emptyTitle="Nenhum arquivo anexado"
      actions={canEdit ? <Button size="sm" iconLeft={<IconFilePlus size={16} />} onClick={() => setDlg('file')}>Anexar arquivo</Button> : undefined}
      columns={[
        { key: 'name', label: 'Arquivo', render: (_, r) => fileCell(r) },
        { key: 'kind', label: 'Tipo', render: (v, r) => <Badge status="neutral">{r.ev ?? FILE_KIND[v as keyof typeof FILE_KIND]}</Badge> },
        { key: 'by', label: 'Enviado por' }, { key: 'at', label: 'Em', render: (v) => formatDateTime(String(v)) },
        { key: 'id', label: 'Ações', sticky: 'right', render: (_, r) => fileActions(r) },
      ]}
      toCard={(r) => ({ title: fileCell(r), subtitle: r.ev ?? FILE_KIND[r.kind], fields: [{ label: 'Enviado por', value: r.by }, { label: 'Em', value: formatDateTime(r.at) }], actions: fileActions(r) })}
    />
  );

  const tabs = order.kind === 'preventiva' ? [
    { label: 'Resumo', content: prevSummary },
    { label: 'Execução', content: prevExecution },
    ...(showCosts ? [{ label: 'Custos', content: costs }] : []),
    { label: 'Arquivos', content: files },
  ] : [
    { label: 'Resumo', content: summary },
    { label: `Visitas (${order.visits.length})`, content: visits },
    ...(showCosts ? [{ label: 'Custos', content: costs }] : []),
    { label: 'Arquivos', content: files },
  ];

  const canBudget = canEdit && order.statusId !== STO.VALIDACAO && (!order.budget || order.budget.decision === 'reprovado') && order.kind === 'corretiva';
  const canConclude = canEdit && order.kind === 'corretiva' && order.statusId !== STO.VALIDACAO;
  const awaitingValidation = order.statusId === STO.VALIDACAO && !!order.validation && !order.validation.result;

  // Ação principal do cabeçalho: depende do status e da permissão (decidir o orçamento ou indicar a conclusão)
  const decideNow = pendingBudget && order.statusId === STO.APROVACAO && canApprove;
  const concludeNow = canConclude && !blocked && order.statusId === STO.ANDAMENTO;
  const menuItems: RowMenuItem[] = [
    ...(canEdit ? [{ label: 'Alterar status', icon: <IconArrowsExchange size={16} />, onClick: () => setDlg('status') }] : []),
    ...(canPlan ? [{ label: 'Reatribuir', icon: <IconUserEdit size={16} />, onClick: () => setDlg('reassign') }] : []),
  ];
  // Próxima ação e responsável atual (RF503 - sempre visíveis em OS não concluída); o botão reaproveita os diálogos existentes
  const execName = `${exec.name}${exec.technician ? ` (${exec.technician})` : ''}`;
  type NextAct = { title: string; who: string; note?: string; primary?: { label: string; onClick: () => void }; secondary?: { label: string; onClick: () => void } };
  const nextAction = ((): NextAct | null => {
    if (!editable) return null;
    if (order.kind === 'preventiva') {
      return { title: 'Executar manutenção preventiva', who: execName, note: order.statusId === STO.ANDAMENTO ? 'A execução está em andamento' : undefined, primary: canExecute ? { label: 'Abrir execução', onClick: goExecution } : undefined };
    }
    const v = order.validation;
    let act: NextAct;
    if (order.statusId === STO.VALIDACAO) act = { title: 'Validar a conclusão', who: v?.assignedTo ?? respName, note: 'O solicitante confirma se o problema foi resolvido' };
    else if (v?.result === 'nao') act = { title: 'Retomar o atendimento', who: execName, note: `O solicitante informou que o problema persiste${v.comment ? `: “${v.comment}”` : ''}` };
    else switch (order.statusId) {
      case STO.ABERTA: act = { title: 'Agendar a visita e iniciar o atendimento', who: execName }; break;
      case STO.ORCAMENTO: act = { title: 'Registrar o orçamento', who: execName }; break;
      case STO.PECA: act = { title: 'Providenciar a peça ou o recurso', who: respName, note: 'Quando chegar, retome a execução', primary: canEdit ? { label: 'Alterar status', onClick: () => setDlg('status') } : undefined }; break;
      case STO.PRESTADOR: act = { title: 'Confirmar o prestador e o agendamento', who: respName, primary: canPlan ? { label: 'Reatribuir', onClick: () => setDlg('reassign') } : undefined }; break;
      default: act = !order.diagnosis
        ? { title: 'Registrar o diagnóstico', who: execName }
        : { title: 'Executar o atendimento e indicar a conclusão', who: execName };
    }
    return act;
  })();
  const goDecision = () => { const el = document.getElementById('os-next'); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); el?.focus({ preventScroll: true }); };

  return (
    <AppLayout active="os" screen="os">
      <Stack gap="xl">
        <Stack gap="xl">
          <PageHeader
            title={order.id}
            subtitle={[req ? refs.requestType(req.problemId)?.name : plan?.name, eq?.name].filter(Boolean).join(' · ') || order.subject}
            badge={refs.statusBadge(order.statusId)}
            breadcrumb={[{ label: 'Ordens de serviço', href: 'ordens-servico.html' }, { label: order.id }]}
            iconActions={<ShareButton kind="os" id={order.id} requiresLogin />}
            actions={(
              <>
                {canPlan && <Button iconLeft={<IconPencil size={20} />} onClick={() => goTo(`os-form.html?id=${order.id}`)}>Editar OS</Button>}
                {menuItems.length > 0 && (
                  <DevNote note="RGN007: mudança de status sem restrição por perfil - responsável, executor ou prestador podem mover; toda mudança vai para o log com o autor. Cancelar exige motivo (RGN004). Alterar status e Reatribuir ficam no menu de ações adicionais. O registro de diagnóstico, orçamento e conclusão é do executor/prestador e depende do fluxo de execução da OS, ainda não construído nesta tela.">
                    <RowMenu variant="secondary" size="md" target={order.id} label="Mais ações da OS" items={menuItems} />
                  </DevNote>
                )}
              </>
            )}
          />
          <DevNote note="RF503 - informações gerais: tipo, prioridade, prazo e responsável pela OS, integradas ao cabeçalho (o status fica só no título). Prazo ultrapassado e não concluída é destacado (RF501-RGN003; SLA é FE001, fora do escopo).">
            <Card className="os-meta" padding="none">
              {order.kind === 'preventiva' ? (
                <dl className="os-meta-5" aria-label="Informações gerais da OS">
                  <div><dt>Tipo de manutenção</dt><dd>{refs.maintType(order.maintTypeId)?.name ?? 'Preventiva'}</dd></div>
                  <div><dt>Plano de manutenção</dt><dd>{plan ? <a className="text-link" href={`plano.html?id=${plan.id}`}>{plan.name}</a> : '-'}</dd></div>
                  <div><dt>Data prevista</dt><dd>{formatDate(order.dueAt)}</dd></div>
                  <div><dt>Executor responsável</dt><dd>{executorValue}</dd></div>
                  <div><dt>Situação do prazo</dt><dd>{execBadge}</dd></div>
                </dl>
              ) : (
              <dl aria-label="Informações gerais da OS">
                <div><dt>Tipo de manutenção</dt><dd>{refs.maintType(order.maintTypeId)?.name ?? '-'}</dd></div>
                <div><dt>Prioridade</dt><dd>{refs.priorityBadge(order.priorityId)}</dd></div>
                <div>
                  <dt>Prazo</dt>
                  <dd>{late > 0
                    ? <span className="os-due"><Badge status="error" solid icon={<IconAlertTriangle size={14} />}>{formatDate(order.dueAt)}</Badge><span className="cell-secondary">{`Vencida há ${late} ${late === 1 ? 'dia' : 'dias'}`}</span></span>
                    : formatDate(order.dueAt)}</dd>
                </div>
                <div><dt>Responsável pela OS</dt><dd>{respName}</dd></div>
              </dl>
              )}
            </Card>
          </DevNote>
        </Stack>

        <DevNote note="Andamento da OS: linha de progresso + próxima ação e responsável atual (RF503 - sempre visíveis em OS não concluída) no mesmo bloco, sem cards internos. A etapa vem do que aconteceu na OS (não do status): Aprovação só vale com orçamento. Só as ações do gestor/assinante têm botão aqui (decidir o orçamento, reatribuir, alterar status); as tarefas do executor/prestador aparecem apenas como próxima ação e responsável atual. Com orçamento pendente, a decisão (RGN008) fica aqui: só usuário do assinante aprova ou reprova - nunca o prestador; reprovar exige justificativa; a execução não avança antes da aprovação (RGN002).">
          <div id="os-next" tabIndex={-1} className="os-next-anchor">
            <Progress order={order} base={base}>
              {pendingBudget && order.budget ? (
                <Stack gap="md">
                  <div className="os-nextrow">
                    <div className="os-nextcol os-nextmain">
                      <span className="os-nextlabel">Próxima ação</span>
                      <span className="os-nexttitle">Decidir sobre o orçamento</span>
                      <span className="cell-secondary">A execução só continua depois da aprovação</span>
                    </div>
                    <div className="os-nextcol">
                      <span className="os-nextlabel">Responsável atual</span>
                      <span className="os-nextvalue">{respName}</span>
                    </div>
                    <div className="os-nextactions">
                      {canApprove
                        ? <><Button size="sm" iconLeft={<IconCheck size={16} />} onClick={() => setDlg('approve')}>Aprovar orçamento</Button><Button size="sm" variant="destructive" onClick={() => setDlg('reject')}>Reprovar orçamento</Button></>
                        : <span className="cell-secondary">Aguardando aprovação de um usuário do assinante</span>}
                    </div>
                  </div>
                  <dl className="os-budgetline">
                    <div><dt>Valor</dt><dd>{canSeeCosts ? formatMoney(order.budget.cents) : 'Restrito'}</dd></div>
                    <div><dt>Registrado por</dt><dd>{`${order.budget.by} em ${formatDate(order.budget.registeredAt)}`}</dd></div>
                    <div><dt>Descrição</dt><dd>{order.budget.description}</dd></div>
                    <div><dt>Anexos</dt><dd><AttachmentsStack names={namesOf(order.budget)} label="orçamento" /></dd></div>
                  </dl>
                </Stack>
              ) : nextAction ? (
                <div className="os-nextrow">
                  <div className="os-nextcol os-nextmain">
                    <span className="os-nextlabel">Próxima ação</span>
                    <span className="os-nexttitle">{nextAction.title}</span>
                    {nextAction.note && <span className="cell-secondary">{nextAction.note}</span>}
                  </div>
                  <div className="os-nextcol">
                    <span className="os-nextlabel">Responsável atual</span>
                    <span className="os-nextvalue">{nextAction.who}</span>
                  </div>
                  {(nextAction.primary || nextAction.secondary) && (
                    <div className="os-nextactions">
                      {nextAction.primary && <Button size="sm" onClick={nextAction.primary.onClick}>{nextAction.primary.label}</Button>}
                      {nextAction.secondary && <Button size="sm" variant="secondary" onClick={nextAction.secondary.onClick}>{nextAction.secondary.label}</Button>}
                    </div>
                  )}
                </div>
              ) : null}
            </Progress>
          </div>
        </DevNote>

        {order.statusId === STO.CANCELADA && <Feedback type="warning" title="OS cancelada" message={order.cancelReason ? `Motivo: ${order.cancelReason}` : 'Esta OS foi cancelada.'} />}
        {base === 'concluido' && order.kind !== 'preventiva' && <Feedback type="success" title="OS concluída" message="A OS foi validada e está somente para leitura. A solicitação de origem foi encerrada." />}
        {blocked && editable && order.statusId !== STO.APROVACAO && <Feedback type="warning" title="Execução bloqueada" message="Esta OS tem orçamento sem aprovação. Ela só avança para a execução depois que um usuário do assinante aprovar (RGN002)." />}

        {awaitingValidation && <ValidationCard order={order} defaultOpen={mode === 'validate' || mode === 'validateno'} defaultResult={mode === 'validate' ? 'sim' : mode === 'validateno' ? 'nao' : undefined} />}

        <Tab key={tab} aria-label="Detalhes da OS" defaultIndex={tab} tabs={tabs} />
      </Stack>
      <Dlgs order={order} dlg={dlg} setDlg={setDlg} preset={mode === 'cancel' ? STO.CANCELADA : undefined} />
      {preview && (
        <Dialog open onClose={() => setPreview(null)} size="md" title={preview.name} subtitle={preview.kind === 'equipamento' ? 'Foto do equipamento' : FILE_KIND[preview.kind as keyof typeof FILE_KIND]}>
          <div className="os-file-zoom">{photoSrc(preview.name) ? <img src={photoSrc(preview.name)} alt={preview.name} /> : <IconPhoto size={64} aria-hidden="true" />}</div>
        </Dialog>
      )}
    </AppLayout>
  );
}

mountApp(<OsScreen />);
