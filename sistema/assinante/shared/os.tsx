import { ReactNode, useEffect, useState } from 'react';
import {
  IconAlertTriangle, IconCheck, IconCircleDot, IconCopy, IconFilePlus, IconMinus, IconPencil, IconPlayerPlay, IconPlus, IconTrash,
  IconUserEdit, IconCircleCheck, IconMapPin,
} from '@tabler/icons-react';
import {
  Badge, Button, Card, DatePicker, Dialog, Dropdown, Feedback, Input, KpiCard, RadioButton, Stack, Tab, Table, TableColumn, Textarea, useToast,
} from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { MobileCardList, MobileCardItem } from '../../admin/shared/MobileCardList';
import { useHashState } from '../../admin/shared/useHashState';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { formatDate, formatDateTime, formatMoney, requiredMessage } from '../../admin/shared/format';
import { COST_KIND_LABEL, CostKind, WorkOrder, nowLocal } from './data';
import { equipmentOf, environmentName, logEntry, notify, ordersVisible, unitName, updateSubDb, useSubSession, userName } from './store';
import { Col, Grid, ReadField, RowAction, RowActions, Text, TroubleshootingNotes, goTo, param, takeFlash, useRefs } from './ui';
import {
  ReassignDialog, STO, executorInfo, executorText, isEditable, overdueDays, parseCents, patchOrder, providerLabel,
} from './os-common';
import './os.css';

type Dlg = 'approve' | 'reject' | 'status' | 'addvisit' | 'addcost' | 'reassign' | 'conclude' | 'addbudget' | 'diagnosis' | 'file' | 'reassignval' | { rm: string } | null;

/** Estados: idle · approve · reject · cancel · addvisit · addcost · validate · validateno · reassign (diálogos/ações abertos) */
const STATES = ['idle', 'approve', 'reject', 'cancel', 'addvisit', 'addcost', 'validate', 'validateno', 'reassign', 'conclude', 'addbudget'] as const;
type Mode = (typeof STATES)[number];

const PAGE_SIZE = 10;
const FILE_KIND = { foto: 'Foto', orcamento: 'Orçamento', outro: 'Outro anexo' } as const;

/** Tabela no desktop, lista de cards no mobile (mesmas linhas). */
function DataTable<T extends Record<string, unknown> & { id: string }>({ title, subtitle, columns, rows, emptyTitle, emptyDescription, toCard }: {
  title: string; subtitle?: string; columns: TableColumn<T>[]; rows: T[]; emptyTitle: string; emptyDescription?: string; toCard: (r: T) => Omit<MobileCardItem, 'id'>;
}) {
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);
  const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return isMobile ? (
    <MobileCardList
      headingId={`list-${title}`} title={title} subtitle={subtitle} emptyTitle={emptyTitle}
      page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage}
      items={slice.map((r) => ({ id: r.id, ...toCard(r) }))}
    />
  ) : (
    <Table<T>
      title={title} subtitle={subtitle} columns={columns} rows={slice} empty={{ title: emptyTitle, description: emptyDescription }}
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

// ───────────────────────── Linha de progresso e próxima ação ─────────────────────────
type StepState = 'done' | 'current' | 'pending' | 'skipped' | 'blocked';
function buildSteps(o: WorkOrder, base: string | undefined): Array<{ label: string; state: StepState; hint?: string }> {
  const closed = base === 'concluido';
  const canceled = base === 'cancelado';
  let current: number;
  if (closed) current = 8;
  else if (o.statusId === STO.VALIDACAO) current = 6;
  else if (o.statusId === STO.APROVACAO || needsApproval(o)) current = 4;
  else if (!o.diagnosis) current = 3;
  else current = 5;
  const labels = ['Solicitação', 'Triagem', 'OS criada', 'Diagnóstico', 'Aprovação', 'Execução', 'Validação', 'Conclusão'];
  return labels.map((label, i) => {
    let state: StepState = i < current ? 'done' : i === current ? 'current' : 'pending';
    let hint: string | undefined;
    if (canceled && i >= current) { state = i === current ? 'blocked' : 'pending'; if (i === current) hint = 'Cancelada'; }
    if (i === 4 && !o.budget && i < current) { state = 'skipped'; hint = 'Sem orçamento'; }
    if (i === 4 && o.budget?.decision === 'reprovado') { state = 'blocked'; hint = 'Orçamento reprovado'; }
    if (o.kind === 'preventiva' && i < 2) hint = 'Gerada pelo plano';
    if (state === 'current' && !hint) hint = 'Etapa atual';
    return { label, state, hint };
  });
}
const STEP_ICON: Record<StepState, ReactNode> = {
  done: <IconCheck size={14} />, current: <IconCircleDot size={14} />, pending: null, skipped: <IconMinus size={14} />, blocked: <IconAlertTriangle size={14} />,
};
const STEP_SR: Record<StepState, string> = { done: 'concluída', current: 'etapa atual', pending: 'pendente', skipped: 'não se aplica', blocked: 'bloqueada' };

function Progress({ order, base }: { order: WorkOrder; base: string | undefined }) {
  const steps = buildSteps(order, base);
  return (
    <Card title="Linha de progresso" subtitle="Da solicitação à conclusão da OS">
      <div className="card-body-tight">
        <ol className="os-steps" aria-label="Etapas da OS">
          {steps.map((s) => (
            <li key={s.label} className={`os-step is-${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
              <span className="os-step-mark" aria-hidden="true">{STEP_ICON[s.state]}</span>
              <span className="os-step-text">
                <span className="os-step-label">{s.label}<span className="sr-only"> ({STEP_SR[s.state]})</span></span>
                {s.hint && <span className="os-step-hint">{s.hint}</span>}
              </span>
            </li>
          ))}
        </ol>
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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [file, setFile] = useState('');
  const [tried, setTried] = useState(false);
  const key = typeof dlg === 'object' && dlg ? 'rm' : dlg;
  useEffect(() => {
    setTried(false); setVal(''); setFile(''); setDate(''); setFrom(''); setTo('');
    if (dlg === 'status') { setSel(preset ?? ''); setText(''); }
    else if (dlg === 'diagnosis') { setText(order.diagnosis ?? ''); setText2(order.solution ?? ''); }
    else if (dlg === 'conclude') { setText(order.solution ?? ''); }
    else if (dlg === 'addvisit') { setText(''); setText2(order.executor.kind === 'prestador' ? order.executor.technician ?? '' : userName(db, order.executor.kind === 'interno' ? order.executor.userId : '')); }
    else if (dlg === 'addcost') { setSel('peca'); setText(''); }
    else if (dlg === 'addbudget') { setText(''); }
    else if (dlg === 'file') { setSel('foto'); }
    else if (dlg === 'reassignval') { setSel(''); }
    else { setText(''); setText2(''); setSel(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const approvers = db.users.filter((u) => u.status === 'ativo' && (u.profile === 'administrador' || u.profile === 'gestor')).map((u) => u.id);
  const execUserIds = order.executor.kind === 'interno' ? [order.executor.userId] : [];
  const prestadorLog = order.executor.kind === 'prestador' ? [`Notificou o prestador ${providerLabel(db, order.executor.providerId)} (sem login na plataforma)`] : [];
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
    const options = refs.activeStatuses('os').filter((s) => s.id !== order.statusId && s.id !== STO.CONCLUIDA).map((s) => ({ value: s.id, label: s.name }));
    const blocked = needsApproval(order) && [STO.ANDAMENTO, STO.VALIDACAO].includes(sel as never);
    const errSel = tried && !sel ? requiredMessage('Novo status') : blocked ? 'Aprove o orçamento antes de avançar para a execução' : undefined;
    const errText = tried && cancel && !text.trim() ? requiredMessage('Motivo do cancelamento') : undefined;
    const go = () => {
      setTried(true);
      if (!sel || blocked || (cancel && !text.trim())) return;
      if (sel === STO.VALIDACAO) { setDlg('conclude'); return; }
      patchOrder(order.id, user.name, (o) => ({ ...o, statusId: sel, ...(cancel ? { cancelReason: text.trim() } : {}) }),
        [`Alterou o status de ${stName(order.statusId)} para ${stName(sel)}${cancel ? ` - motivo: ${text.trim()}` : text.trim() ? ` - ${text.trim()}` : ''}`]);
      toast.show({ type: 'success', title: cancel ? 'OS cancelada' : 'Status alterado', message: `A OS agora está em ${stName(sel)}.` });
      close();
    };
    return (
      <Dialog open onClose={close} title={cancel ? `Cancelar ${order.id}?` : 'Alterar status'} subtitle={`Status atual: ${stName(order.statusId)}`}
        actions={<Actions onClose={close} onConfirm={go} label={cancel ? 'Cancelar OS' : 'Salvar status'} destructive={cancel} />}>
        <Stack gap="md">
          <DevNote note="RGN007: mudança de status sem restrição por perfil (responsável, executor ou prestador podem mover) - toda mudança fica no log com o autor. Exceção: aprovar orçamento (RGN008). Concluída só pela validação do solicitante (RGN005); OS com orçamento não aprovado não vai para execução (RGN002 / CTA001). Marcar “Aguardando aprovação” sem orçamento representa aprovação externa (ex.: CFO).">
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
    const e = { date: tried && !date ? requiredMessage('Data') : undefined, from: tried && !from ? requiredMessage('Início') : undefined,
      to: tried && !to ? requiredMessage('Fim') : tried && from && to <= from ? 'O fim deve ser depois do início' : undefined, tech: tried && !text2.trim() ? requiredMessage('Técnico') : undefined };
    const go = () => {
      setTried(true);
      if (!date || !from || !to || to <= from || !text2.trim()) return;
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
            <Col span={12}><DatePicker label="Data agendada" required value={date} onChange={setDate} error={e.date} /></Col>
            <Col span={6}><Input label="Início da janela" type="time" required value={from} onChange={(ev) => setFrom(ev.target.value)} error={e.from} /></Col>
            <Col span={6}><Input label="Fim da janela" type="time" required value={to} onChange={(ev) => setTo(ev.target.value)} error={e.to} /></Col>
            <Col span={12}><Input label="Técnico" required autoComplete="off" value={text2} onChange={(ev) => setText2(ev.target.value)} error={e.tech} /></Col>
            <Col span={12}><Textarea label="Observação" optional rows={2} value={text} onChange={(ev) => setText(ev.target.value)} /></Col>
          </Grid>
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
        ...o, costs: [...o.costs, { id, kind: sel as CostKind, description: text.trim(), cents, attachment: file || undefined }],
        files: file ? [...o.files, { id: `F${id}`, name: file, kind: 'outro', at: nowLocal(), by: user.name }] : o.files,
      }), [`Adicionou item de custo (${COST_KIND_LABEL[sel as CostKind]}): ${text.trim()}`]);
      toast.show({ type: 'success', title: 'Item de custo adicionado', message: 'O custo realizado alimenta o gasto do equipamento.' });
      close();
    };
    return (
      <Dialog open onClose={close} title="Adicionar item de custo" subtitle="Peça, mão de obra, orçamento de prestador ou outro" actions={<Actions onClose={close} onConfirm={go} label="Adicionar item" />}>
        <DevNote note="RF503-RGN003: o valor é obrigatório em cada item (os custos realizados alimentam o gasto acumulado do equipamento, RF304, e o Dashboard). O log da OS não repete o valor, para quem não vê custos.">
          <Grid>
            <Col span={12}><Dropdown label="Tipo" required options={Object.entries(COST_KIND_LABEL).map(([value, label]) => ({ value, label }))} value={sel} onChange={setSel} /></Col>
            <Col span={12}><Input label="Descrição" required autoComplete="off" value={text} onChange={(ev) => setText(ev.target.value)} error={e.desc} /></Col>
            <Col span={12}><Input label="Valor (R$)" required inputMode="decimal" placeholder="0,00" value={val} onChange={(ev) => setVal(ev.target.value)} error={e.val} /></Col>
            <Col span={12}><Input label="Anexo" optional type="file" onChange={(ev) => setFile(ev.target.files?.[0]?.name ?? '')} helperText="Upload simulado no protótipo" /></Col>
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
            <Col span={12}><Input label="Valor do orçamento (R$)" required inputMode="decimal" placeholder="0,00" value={val} onChange={(ev) => setVal(ev.target.value)} error={e.val} /></Col>
            <Col span={12}><Textarea label="Descrição" required rows={3} value={text} onChange={(ev) => setText(ev.target.value)} error={e.desc} /></Col>
            <Col span={12}><Input label="Anexo do orçamento" required type="file" onChange={(ev) => setFile(ev.target.files?.[0]?.name ?? '')} error={e.file} helperText="Upload simulado no protótipo" /></Col>
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
      const who = req?.requesterName ?? order.contactName;
      patchOrder(order.id, user.name, (o) => ({ ...o, statusId: STO.VALIDACAO, solution: text.trim(), validation: { requestedAt: nowLocal(), assignedTo: who } }),
        [`Indicou a conclusão - status: Aguardando validação (validação de ${who})`]);
      notify(req?.requesterUserId ? [req.requesterUserId] : db.users.filter((u) => u.status === 'ativo' && u.name === who).map((u) => u.id), { kind: 'os', title: 'Validação pendente', text: `${order.id}: o problema foi resolvido?`, href });
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
          <Input label="Arquivo" required type="file" onChange={(e) => setFile(e.target.files?.[0]?.name ?? '')} error={err} helperText="Upload simulado no protótipo" />
        </Stack>
      </Dialog>
    );
  }

  // ── Reatribuir a validação (FLU010) ──
  if (dlg === 'reassignval') {
    const people = db.users.filter((u) => u.status === 'ativo' && eq && u.unitIds.includes(eq.unitId) && u.name !== order.validation?.assignedTo);
    const err = tried && !sel ? requiredMessage('Pessoa da unidade') : undefined;
    const go = () => {
      setTried(true);
      if (!sel) return;
      const p = db.users.find((u) => u.id === sel)!;
      patchOrder(order.id, user.name, (o) => ({ ...o, validation: o.validation ? { ...o.validation, assignedTo: p.name } : o.validation }), [`Reatribuiu a validação da conclusão de ${order.validation?.assignedTo} para ${p.name}`]);
      notify([p.id], { kind: 'os', title: 'Validação pendente', text: `${order.id}: o problema foi resolvido?`, href });
      toast.show({ type: 'success', title: 'Validação reatribuída', message: `${p.name} foi notificado(a).` });
      close();
    };
    return (
      <Dialog open onClose={close} size="sm" title="Reatribuir a validação" subtitle="Escolha outra pessoa da unidade para confirmar a conclusão" actions={<Actions onClose={close} onConfirm={go} label="Reatribuir" />}>
        <DevNote note="FLU010: se o solicitante não estiver disponível, o responsável reatribui a validação a outra pessoa da unidade; o solicitante também pode encaminhar o link de validação a um colega (RGN010: fica registrada em nome do solicitante original).">
          <Dropdown label="Pessoa da unidade" required placeholder="Selecione a pessoa" options={people.map((u) => ({ value: u.id, label: u.name }))} value={sel} onChange={setSel} error={err} />
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
    const by = onBehalf ? `em nome de ${v.assignedTo}` : '';
    const note = comment.trim() ? `: ${comment.trim()}` : '';
    const now = nowLocal();
    if (result === 'sim') {
      patchOrder(order.id, user.name, (o) => ({ ...o, statusId: STO.CONCLUIDA, validation: { ...v, result: 'sim', comment: comment.trim() || undefined, at: now } }),
        [`${onBehalf ? `Registrou a validação ${by}` : 'Validou a conclusão'}: o problema foi resolvido${note}`, 'OS concluída - a solicitação de origem foi encerrada com ela']);
      updateSubDb((d) => ({
        ...d,
        requests: d.requests.map((r) => (r.id === order.requestId ? { ...r, log: [...r.log, logEntry(user.name, `Encerrada com a conclusão da ${order.id} após a validação`)] } : r)),
        equipments: d.equipments.map((e) => (e.id === order.equipmentId && e.statusId === 'STE-04' && !d.orders.some((x) => x.id !== order.id && x.equipmentId === e.id && x.statusId !== STO.CONCLUIDA && x.statusId !== STO.CANCELADA) ? { ...e, statusId: 'STE-01' } : e)),
      }));
      toast.show({ type: 'success', title: 'OS concluída', message: 'A solicitação de origem foi encerrada junto com a OS.' });
    } else {
      patchOrder(order.id, user.name, (o) => ({ ...o, statusId: STO.ANDAMENTO, validation: { ...v, result: 'nao', comment: comment.trim(), at: now } }),
        [`${onBehalf ? `Registrou a validação ${by}` : 'Validou a conclusão'}: o problema NÃO foi resolvido${note} - status: Em andamento`]);
      notify([order.responsibleId, ...(order.executor.kind === 'interno' ? [order.executor.userId] : [])], { kind: 'os', title: 'Validação recusada', text: `${order.id}: o solicitante informou que o problema persiste`, href });
      toast.show({ type: 'warning', title: 'OS reaberta para ação', message: 'O comentário foi enviado ao responsável e ao executor.' });
    }
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
            can('os', 'editar') && !canManage
              ? <Text>Aguardando a validação do solicitante</Text>
              : <Button size="sm" iconLeft={<IconCircleCheck size={16} />} onClick={() => setOpen(true)}>Registrar validação em nome do solicitante</Button>
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
  const eqLink = eq ? <a className="text-link" href={`equipamento.html?id=${eq.id}`}>{eq.name}</a> : '-';

  // Próxima ação / responsável atual (RF503 - sempre visível em OS não concluída)
  const next = ((): { title: string; message: string } | null => {
    if (!editable) return null;
    const respName = userName(db, order.responsibleId);
    const execName = `${exec.name}${exec.technician ? ` (${exec.technician})` : ''}`;
    const v = order.validation;
    if (order.statusId === STO.VALIDACAO) return { title: 'Próxima ação: validar a conclusão', message: `${v?.assignedTo ?? 'O solicitante'} confirma se o problema foi resolvido. Responsável atual: ${v?.assignedTo ?? respName}.` };
    if (v?.result === 'nao') return { title: 'Próxima ação: retomar o atendimento', message: `O solicitante informou que o problema persiste${v.comment ? ` ("${v.comment}")` : ''}. Responsável atual: ${execName}.` };
    switch (order.statusId) {
      case STO.ABERTA: return { title: 'Próxima ação: iniciar o atendimento', message: `${execName} agenda a visita e inicia o atendimento. Responsável atual: ${execName}.` };
      case STO.ORCAMENTO: return { title: 'Próxima ação: registrar o orçamento', message: `${execName} envia valor, descrição e anexo do orçamento. Responsável atual: ${execName}.` };
      case STO.APROVACAO: return { title: 'Próxima ação: aprovar ou reprovar o orçamento', message: `Um usuário do assinante com permissão decide. Responsável atual: ${respName}.` };
      case STO.PECA: return { title: 'Próxima ação: providenciar a peça ou o recurso', message: `Quando chegar, retome a execução. Responsável atual: ${respName}.` };
      case STO.PRESTADOR: return { title: 'Próxima ação: confirmar o prestador e o agendamento', message: `Responsável atual: ${respName}.` };
      default: return { title: !order.diagnosis ? 'Próxima ação: registrar o diagnóstico' : 'Próxima ação: executar o atendimento e indicar a conclusão', message: `Responsável atual: ${execName}.` };
    }
  })();

  // ── Resumo ──
  const recent = [...order.activities].reverse().slice(0, 5);
  const summary = (
    <Stack gap="xl">
      <Card title="Dados da OS">
        <div className="card-body-tight">
          <Grid>
            <Col span={6}><ReadField label="Equipamento" value={eqLink} /></Col>
            <Col span={6}><ReadField label="Unidade · Ambiente" value={eq ? `${unitName(db, eq.unitId)} · ${environmentName(db, eq.environmentId)}` : '-'} /></Col>
            <Col span={6}><ReadField label="Tipo de manutenção" value={refs.maintType(order.maintTypeId)?.name} /></Col>
            <Col span={6}><ReadField label="Prioridade" value={refs.priorityBadge(order.priorityId)} /></Col>
            <Col span={6}><ReadField label="Responsável" value={userName(db, order.responsibleId)} /></Col>
            <Col span={6}><ReadField label="Executor / prestador" value={order.executor.kind === 'prestador' ? <a className="text-link" href={`prestador.html?id=${order.executor.providerId}`}>{executorText(db, order.executor)}</a> : `${exec.name} (interno)`} /></Col>
            <Col span={6}><ReadField label="Contato na unidade" value={`${order.contactName}${order.contactPhone ? ` · ${order.contactPhone}` : ''}`} /></Col>
            <Col span={6}><ReadField label="Origem" value={req ? <a className="text-link" href={`solicitacao.html?id=${req.id}`}>{req.id}</a> : plan ? <a className="text-link" href={`plano.html?id=${plan.id}`}>{plan.name}</a> : '-'} /></Col>
          </Grid>
        </div>
      </Card>

      <Card title="Problema relatado"><Text>{order.reported}</Text></Card>
      {order.troubleshooting && <TroubleshootingNotes run={order.troubleshooting} />}

      <Card title="Diagnóstico e solução" actions={canEdit ? <Button size="sm" variant="secondary" iconLeft={<IconPencil size={16} />} onClick={() => setDlg('diagnosis')}>{order.diagnosis ? 'Editar' : 'Registrar'}</Button> : undefined}>
        <div className="card-body-tight">
          <Grid>
            <Col span={6}><ReadField label="Diagnóstico" value={order.diagnosis} /></Col>
            <Col span={6}><ReadField label="Solução" value={order.solution} /></Col>
          </Grid>
        </div>
      </Card>

      <Card title="Visita agendada">
        <div className="card-body-tight">
          {order.schedule
            ? <Grid><Col span={6}><ReadField label="Data" value={formatDate(order.schedule.date)} /></Col><Col span={6}><ReadField label="Janela de horário" value={`${order.schedule.from} às ${order.schedule.to}`} /></Col></Grid>
            : <Text>Nenhuma visita agendada</Text>}
        </div>
      </Card>

      {order.budget && (
        <Card title="Orçamento" subtitle={order.budget.decision ? `${order.budget.decision === 'aprovado' ? 'Aprovado' : 'Reprovado'} por ${order.budget.decidedBy}` : 'Aguardando decisão'}>
          <div className="card-body-tight">
            <Grid>
              <Col span={6}><ReadField label="Valor" value={canSeeCosts ? formatMoney(order.budget.cents) : 'Restrito ao Administrador e ao Gestor'} /></Col>
              <Col span={6}><ReadField label="Registrado por" value={`${order.budget.by} em ${formatDate(order.budget.registeredAt)}`} /></Col>
              <Col span={12}><ReadField label="Descrição" value={order.budget.description} /></Col>
              <Col span={6}><ReadField label="Anexo" value={order.budget.attachment} /></Col>
              {order.budget.justification && <Col span={6}><ReadField label="Justificativa" value={order.budget.justification} /></Col>}
            </Grid>
          </div>
        </Card>
      )}

      {order.kind === 'preventiva' && plan && (
        <DevNote note="OS preventiva (RF601/RF603): o checklist vem do plano; a execução (checklist, leituras, evidências) é feita na tela de execução da preventiva.">
          <Card title="Checklist do plano" subtitle={plan.name} actions={can('os', 'editar') ? <Button size="sm" iconLeft={<IconPlayerPlay size={16} />} onClick={() => goTo(`execucao-preventiva.html?os=${order.id}`)}>Abrir execução</Button> : undefined}>
            <Stack as="ul" gap="xs" className="ts-list">
              {plan.checklist.map((c) => <li key={c.id} className="page-text">{c.text}{c.unit ? ` (${c.unit})` : ''} · {c.kind === 'opcional' ? 'opcional' : 'obrigatório'}</li>)}
            </Stack>
          </Card>
        </DevNote>
      )}

      <Card title="Atividades recentes" actions={<Badge status="neutral">{order.activities.length}</Badge>}>
        <Stack as="ul" gap="sm" className="ts-list">
          {recent.map((a) => <li key={a.id} className="page-text"><strong>{a.by}</strong> · {a.text} <span className="cell-secondary">({formatDateTime(a.at)})</span></li>)}
        </Stack>
      </Card>
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
    <Stack gap="md">
      <DevNote note="RF503-FLU002 / CTA005: lista de visitas (data agendada, janela, técnico, chegada registrada, observação). Uma OS aceita várias visitas e revisitas.">
        <DataTable<VisitRow>
          title="Visitas" subtitle={`${order.visits.length} ${order.visits.length === 1 ? 'visita registrada' : 'visitas registradas'}`} rows={visitRows}
          emptyTitle="Nenhuma visita agendada" emptyDescription="Adicione a primeira visita para registrar o atendimento"
          columns={[
            { key: 'date', label: 'Data agendada', render: (v) => formatDate(String(v)) },
            { key: 'window', label: 'Janela' },
            { key: 'tech', label: 'Técnico' },
            { key: 'arrived', label: 'Chegada', render: (v, r) => (v ? formatDateTime(String(v)) : arriveBtn(r) ?? 'Não registrada') },
            { key: 'note', label: 'Observação', render: (v) => (v ? String(v) : '-') },
          ]}
          toCard={(r) => ({ title: formatDate(r.date), subtitle: r.window, fields: [{ label: 'Técnico', value: r.tech }, { label: 'Chegada', value: r.arrived ? formatDateTime(r.arrived) : 'Não registrada' }, { label: 'Observação', value: r.note ?? '-' }], actions: arriveBtn(r) })}
        />
      </DevNote>
      {canEdit && <Stack direction="horizontal"><Button size="sm" iconLeft={<IconPlus size={16} />} onClick={() => setDlg('addvisit')}>{order.visits.length ? 'Adicionar revisita' : 'Adicionar visita'}</Button></Stack>}
    </Stack>
  );

  // ── Custos ──
  type CostRow = Record<string, unknown> & { id: string; kind: string; description: string; cents: number; attachment?: string };
  const budgeted = order.budget?.cents ?? order.costs.filter((c) => c.kind === 'orcamento').reduce((n, c) => n + c.cents, 0);
  const approved = order.budget?.decision === 'aprovado' ? order.budget.cents : 0;
  const realized = order.costs.filter((c) => !(c.kind === 'orcamento' && order.budget && order.budget.decision !== 'aprovado')).reduce((n, c) => n + c.cents, 0);
  const costRows: CostRow[] = order.costs.map((c) => ({ id: c.id, kind: COST_KIND_LABEL[c.kind], description: c.description, cents: c.cents, attachment: c.attachment }));
  const money = (c: number) => (canSeeCosts ? formatMoney(c) : 'Restrito');
  const rmBtn = (r: CostRow) => (canEdit ? <RowActions><RowAction icon={<IconTrash size={16} />} label="Remover item de custo" target={r.description} onClick={() => setDlg({ rm: r.id })} /></RowActions> : undefined);
  const costs = (
    <Stack gap="md">
      {canSeeCosts ? (
        <DevNote note="Totais: orçado = valor do orçamento registrado; aprovado = orçamento aprovado; realizado = soma dos itens de custo (orçamento de prestador só entra após aprovação). RGN003: os realizados alimentam o gasto do equipamento (RF304) e o Dashboard. Só Administrador e Gestor veem valores (RF304-RGN003).">
          <Grid>
            <Col span={4} fill><KpiCard label="Orçado" value={formatMoney(budgeted)} /></Col>
            <Col span={4} fill><KpiCard label="Aprovado" value={formatMoney(approved)} /></Col>
            <Col span={4} mobileFull fill><KpiCard label="Realizado" value={formatMoney(realized)} /></Col>
          </Grid>
        </DevNote>
      ) : <Feedback type="info" message="Os valores de custo são visíveis apenas para o Administrador e o Gestor de manutenção" />}
      <DataTable<CostRow>
        title="Itens de custo" subtitle="Peça, mão de obra, orçamento de prestador e outros" rows={costRows} emptyTitle="Nenhum item de custo" emptyDescription="Adicione os itens à medida que forem realizados"
        columns={[
          { key: 'kind', label: 'Tipo' }, { key: 'description', label: 'Descrição' },
          { key: 'cents', label: 'Valor', align: 'right', render: (v) => money(Number(v)) },
          { key: 'attachment', label: 'Anexo', render: (v) => (v ? String(v) : '-') },
          { key: 'id', label: 'Ações', sticky: 'right', render: (_, r) => rmBtn(r) ?? null },
        ]}
        toCard={(r) => ({ title: r.description, subtitle: r.kind, fields: [{ label: 'Valor', value: money(r.cents) }, { label: 'Anexo', value: r.attachment ?? '-' }], actions: rmBtn(r) })}
      />
      {canEdit && <Stack direction="horizontal"><Button size="sm" iconLeft={<IconPlus size={16} />} onClick={() => setDlg('addcost')}>Adicionar item de custo</Button></Stack>}
    </Stack>
  );

  // ── Arquivos ──
  type FileRow = Record<string, unknown> & { id: string; name: string; kind: string; at: string; by: string };
  const fileRows: FileRow[] = order.files.map((f) => ({ id: f.id, name: f.name, kind: FILE_KIND[f.kind], at: f.at, by: f.by }));
  const files = (
    <Stack gap="md">
      <DataTable<FileRow>
        title="Arquivos" subtitle="Fotos, orçamentos e demais anexos" rows={fileRows} emptyTitle="Nenhum arquivo anexado"
        columns={[{ key: 'name', label: 'Arquivo' }, { key: 'kind', label: 'Tipo', render: (v) => <Badge status="neutral">{String(v)}</Badge> }, { key: 'by', label: 'Enviado por' }, { key: 'at', label: 'Em', render: (v) => formatDateTime(String(v)) }]}
        toCard={(r) => ({ title: r.name, subtitle: r.kind, fields: [{ label: 'Enviado por', value: r.by }, { label: 'Em', value: formatDateTime(r.at) }] })}
      />
      {canEdit && <Stack direction="horizontal"><Button size="sm" iconLeft={<IconFilePlus size={16} />} onClick={() => setDlg('file')}>Anexar arquivo</Button></Stack>}
    </Stack>
  );

  // ── Atividades ──
  type ActRow = Record<string, unknown> & { id: string; at: string; by: string; text: string };
  const actRows: ActRow[] = [...order.activities].reverse().map((a) => ({ id: a.id, at: a.at, by: a.by, text: a.text }));
  const activities = (
    <DevNote note="RF503-CTA004: log automático de toda interação (status, atribuição, anexos, visitas, custos, aprovação, validação) com autor, data e hora - mais recente primeiro.">
      <DataTable<ActRow>
        title="Atividades" subtitle="Registro automático de tudo o que aconteceu na OS" rows={actRows} emptyTitle="Nenhuma atividade"
        columns={[{ key: 'at', label: 'Data e hora', render: (v) => formatDateTime(String(v)) }, { key: 'by', label: 'Autor' }, { key: 'text', label: 'Atividade' }]}
        toCard={(r) => ({ title: r.text, subtitle: r.by, fields: [{ label: 'Data e hora', value: formatDateTime(r.at) }] })}
      />
    </DevNote>
  );

  const tabs = [
    { label: 'Resumo', content: summary },
    { label: `Visitas (${order.visits.length})`, content: visits },
    ...(showCosts ? [{ label: 'Custos', content: costs }] : []),
    { label: 'Arquivos', content: files },
    { label: 'Atividades', content: activities },
  ];
  const tabIndex = mode === 'addvisit' ? 1 : mode === 'addcost' && showCosts ? 2 : 0;

  const canBudget = canEdit && order.statusId !== STO.VALIDACAO && (!order.budget || order.budget.decision === 'reprovado') && order.kind === 'corretiva';
  const canConclude = canEdit && order.kind === 'corretiva' && order.statusId !== STO.VALIDACAO;
  const awaitingValidation = order.statusId === STO.VALIDACAO && !!order.validation && !order.validation.result;

  return (
    <AppLayout active="os" screen="os">
      <Stack gap="xl">
        <PageHeader
          title={order.id}
          subtitle={`${order.subject} · ${eq?.name ?? ''}`}
          badge={refs.statusBadge(order.statusId)}
          breadcrumb={[{ label: 'Ordens de serviço', href: 'ordens-servico.html' }, { label: order.id }]}
          actions={(
            <>
              {canEdit && <DevNote note="RGN007: mudança de status sem restrição por perfil - responsável, executor ou prestador podem mover; toda mudança vai para o log com o autor. Cancelar exige motivo (RGN004)."><Button variant="secondary" onClick={() => setDlg('status')}>Alterar status</Button></DevNote>}
              {canConclude && <Button variant="secondary" disabled={blocked} onClick={() => setDlg('conclude')}>Indicar conclusão</Button>}
              {canPlan && <Button variant="secondary" iconLeft={<IconUserEdit size={20} />} onClick={() => setDlg('reassign')}>Reatribuir</Button>}
              {canPlan && <Button iconLeft={<IconPencil size={20} />} onClick={() => goTo(`os-form.html?id=${order.id}`)}>Editar OS</Button>}
            </>
          )}
        />

        <DevNote note="RF503 - cabeçalho: nº, assunto, status, tipo, prioridade e prazo. Prazo ultrapassado e não concluída é destacado (RF501-RGN003; SLA é FE001, fora do escopo).">
          <Card>
            <Grid>
              <Col span={3}><ReadField label="Status" value={refs.statusBadge(order.statusId)} /></Col>
              <Col span={3}><ReadField label="Tipo de manutenção" value={refs.maintType(order.maintTypeId)?.name} /></Col>
              <Col span={3}><ReadField label="Prioridade" value={refs.priorityBadge(order.priorityId)} /></Col>
              <Col span={3}><ReadField label="Prazo" value={late > 0 ? <Badge status="error" icon={<IconAlertTriangle size={14} />}>{`${formatDate(order.dueAt)} · vencida há ${late} ${late === 1 ? 'dia' : 'dias'}`}</Badge> : formatDate(order.dueAt)} /></Col>
            </Grid>
          </Card>
        </DevNote>

        {order.statusId === STO.CANCELADA && <Feedback type="warning" title="OS cancelada" message={order.cancelReason ? `Motivo: ${order.cancelReason}` : 'Esta OS foi cancelada.'} />}
        {base === 'concluido' && <Feedback type="success" title="OS concluída" message="A OS foi validada e está somente para leitura. A solicitação de origem foi encerrada." />}
        {next && (
          <DevNote note="Próxima ação e responsável atual: derivados do status (RF503 - sempre visíveis em OS não concluída).">
            <Feedback type="info" title={next.title} message={next.message} />
          </DevNote>
        )}
        {blocked && editable && order.statusId !== STO.APROVACAO && <Feedback type="warning" title="Execução bloqueada" message="Esta OS tem orçamento sem aprovação. Ela só avança para a execução depois que um usuário do assinante aprovar (RGN002)." />}

        {order.budget && !order.budget.decision && editable && (
          <DevNote note="Decisão do orçamento (RGN008): somente usuário do assinante com permissão de aprovar - nunca o prestador. Para Executor/Solicitante o botão fica oculto. Aprovação externa (ex.: CFO) = manter “Aguardando aprovação” até o retorno (FLU005).">
            <Card title="Decisão do orçamento" subtitle={`Registrado por ${order.budget.by} em ${formatDateTime(order.budget.registeredAt)}`}>
              <Stack gap="md">
                <Grid>
                  <Col span={4}><ReadField label="Valor" value={canSeeCosts ? formatMoney(order.budget.cents) : 'Restrito'} /></Col>
                  <Col span={8}><ReadField label="Descrição" value={order.budget.description} /></Col>
                  <Col span={12}><ReadField label="Anexo" value={order.budget.attachment} /></Col>
                </Grid>
                {canApprove
                  ? <Stack direction="horizontal" gap="sm" wrap><Button size="sm" iconLeft={<IconCheck size={16} />} onClick={() => setDlg('approve')}>Aprovar orçamento</Button><Button size="sm" variant="destructive" onClick={() => setDlg('reject')}>Reprovar orçamento</Button></Stack>
                  : <Text>Aguardando aprovação do assinante</Text>}
              </Stack>
            </Card>
          </DevNote>
        )}

        {canBudget && order.statusId !== STO.APROVACAO && (
          <Stack direction="horizontal"><Button size="sm" variant="secondary" iconLeft={<IconFilePlus size={16} />} onClick={() => setDlg('addbudget')}>{order.budget ? 'Registrar novo orçamento' : 'Registrar orçamento'}</Button></Stack>
        )}

        {awaitingValidation && <ValidationCard order={order} defaultOpen={mode === 'validate' || mode === 'validateno'} defaultResult={mode === 'validate' ? 'sim' : mode === 'validateno' ? 'nao' : undefined} />}

        <Progress order={order} base={base} />

        <Tab key={tabIndex} aria-label="Detalhes da OS" defaultIndex={tabIndex} tabs={tabs} />
      </Stack>
      <Dlgs order={order} dlg={dlg} setDlg={setDlg} preset={mode === 'cancel' ? STO.CANCELADA : undefined} />
    </AppLayout>
  );
}

mountApp(<OsScreen />);
