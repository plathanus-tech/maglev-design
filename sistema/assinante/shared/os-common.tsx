import { ReactNode, useEffect, useRef, useState } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Badge, Button, Dialog, Dropdown, Feedback, ImageUpload, RadioButton, Stack, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { Executor, SubDb, WorkOrder, SubUser, dayOnly, nowLocal } from './data';
import { techSpecialtiesText } from './prestadores';
import { logEntry, notify, updateSubDb, useSubSession } from './store';
import { CellPair, Col, Grid, useRefs } from './ui';
import { formatDate, requiredMessage } from '../../admin/shared/format';

/** Ids de status de OS (Admin RF407 - carga inicial). Situação (aberto, concluído…) sempre pela base do status. */
export const STO = {
  ABERTA: 'STO-01', ANDAMENTO: 'STO-02', ORCAMENTO: 'STO-03', APROVACAO: 'STO-04', PECA: 'STO-05',
  PRESTADOR: 'STO-06', VALIDACAO: 'STO-07', CONCLUIDA: 'STO-08', CANCELADA: 'STO-09',
} as const;

/** "Hoje" do protótipo (mesma referência da carga inicial). */
export const TODAY = dayOnly(0);

/** Dias de atraso do prazo (0 = no prazo). OS concluída ou cancelada nunca está vencida (RF501-RGN003). */
export function overdueDays(o: WorkOrder, base: string | undefined): number {
  if (base === 'concluido' || base === 'cancelado') return 0;
  const diff = Math.round((new Date(`${TODAY}T00:00:00`).getTime() - new Date(`${o.dueAt}T00:00:00`).getTime()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

/** Coluna Prazo (lista geral de OS e detalhe do prestador): vencida = badge de alerta + "Vencida há N dias" (late = overdueDays); sem prazo = traço */
export const dueCell = (dueAt: string, late: number): ReactNode => (!dueAt ? '—' : late > 0
  ? <CellPair primary={<Badge status="error" solid icon={<IconAlertTriangle size={14} />}>{formatDate(dueAt)}</Badge>} secondary={`Vencida há ${late} ${late === 1 ? 'dia' : 'dias'}`} />
  : formatDate(dueAt));

/** OS que ainda pode ser alterada (RF502-FLU006: enquanto não concluída). */
export const isEditable = (base: string | undefined) => base !== 'concluido' && base !== 'cancelado';

export const providerLabel = (db: SubDb, id: string) => {
  const p = db.providers.find((x) => x.id === id);
  return p ? (p.tradeName ?? p.name) : '-';
};

/** Executor/prestador de uma OS: nome principal + tipo (Interno / Prestador) + técnico, se houver. */
export function executorInfo(db: SubDb, e: Executor): { name: string; kind: string; technician?: string } {
  if (e.kind === 'interno') return { name: db.users.find((u) => u.id === e.userId)?.name ?? '-', kind: 'Interno' };
  return { name: providerLabel(db, e.providerId), kind: 'Prestador', technician: e.technician };
}
/** Registro de notificação ao atribuir a OS a um prestador. Autônomo: o link de acesso vai para o e-mail do próprio profissional (contato principal) */
export const notifyProviderLog = (db: SubDb, providerId: string) => {
  const p = db.providers.find((x) => x.id === providerId);
  const to = p?.kind === 'autonomo' ? p.contacts.find((c) => c.main)?.email : undefined;
  return `Notificou o prestador ${providerLabel(db, providerId)}${to ? ` - link de acesso enviado para ${to}` : ' (sem login na plataforma)'}`;
};
export const executorText = (db: SubDb, e: Executor) => {
  const i = executorInfo(db, e);
  return i.technician ? `${i.name} (${i.technician})` : i.name;
};

/** Atualiza uma OS e grava cada alteração no log de atividades (RF502-RGN003 / RF503-CTA004). */
export function patchOrder(id: string, by: string, patch: (o: WorkOrder) => WorkOrder, logs: string[] = []) {
  updateSubDb((db) => ({
    ...db,
    orders: db.orders.map((o) => {
      if (o.id !== id) return o;
      const next = patch(o);
      return { ...next, activities: [...next.activities, ...logs.map((t) => logEntry(by, t))] };
    }),
  }));
}

/** Notifica quem foi atribuído (RF502-RGN007 / RF801). Prestador não tem login: só aparece no log da OS. */
export function notifyAssignees(db: SubDb, order: Pick<WorkOrder, 'id' | 'subject' | 'responsibleId' | 'executor'>, what: { responsible?: boolean; executor?: boolean }) {
  const ids: string[] = [];
  if (what.responsible) ids.push(order.responsibleId);
  if (what.executor && order.executor.kind === 'interno') ids.push(order.executor.userId);
  notify(ids, { kind: 'os', title: 'Nova OS atribuída a você', text: `${order.id}: ${order.subject}`, href: `os.html?id=${order.id}` });
  return db;
}

/** Anexo (ImageUpload do DS, o mesmo de Nova solicitação) com envio simulado: guarda só o nome do arquivo; imagens ganham miniatura. */
export function AttachmentField({ label, value, onChange, required, error }: { label: string; value: string; onChange: (name: string) => void; required?: boolean; error?: string }) {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const timer = useRef<number>();
  useEffect(() => () => { window.clearTimeout(timer.current); }, []);
  useEffect(() => { if (!value) setPreviewUrl(undefined); }, [value]);
  const onFile = (file: File | null) => {
    if (!file) { setPreviewUrl(undefined); onChange(''); return; }
    setLoading(true);
    timer.current = window.setTimeout(() => { setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined); onChange(file.name); setLoading(false); }, 600);
  };
  return (
    <ImageUpload
      label={label} optional={!required} error={error} fileName={value} previewUrl={previewUrl} loading={loading} onChange={onFile}
      accept="image/png,image/jpeg,application/pdf" helperText="JPG, PNG ou PDF"
      labels={{ add: 'Adicionar anexo', replace: 'Trocar anexo', remove: 'Remover anexo', loading: 'Enviando anexo...', invalidType: 'Envie um arquivo JPG, PNG ou PDF' }}
    />
  );
}

/**
 * Indicar a conclusão (RF503-FLU007/FLU008 / Prestador RF102-FLU007): a OS vai para "Aguardando validação" e o solicitante é notificado.
 * A solução aplicada é obrigatória; quem valida é o solicitante da solicitação de origem (ou o contato da OS).
 */
export function applyOrderConclusion(db: SubDb, order: WorkOrder, solution: string, by: string) {
  const req = db.requests.find((r) => r.id === order.requestId);
  const who = req?.requesterName ?? order.contactName;
  patchOrder(order.id, by, (o) => ({ ...o, statusId: STO.VALIDACAO, solution: solution.trim(), validation: { requestedAt: nowLocal(), assignedTo: who } }),
    [`Indicou a conclusão - status: Aguardando validação (validação de ${who})`]);
  notify(req?.requesterUserId ? [req.requesterUserId] : db.users.filter((u) => u.status === 'ativo' && u.name === who).map((u) => u.id), { kind: 'os', title: 'Validação pendente', text: `${order.id}: o problema foi resolvido?`, href: `os.html?id=${order.id}` });
}

/**
 * Validação da conclusão pelo solicitante (RF503-FLU008-FLU010 / Colaborador RF004-FLU004): Sim encerra a OS e a solicitação de
 * origem; Não devolve a OS ao responsável (Em andamento) com o comentário. Usada pela Área do assinante e pelo link do colaborador.
 * `onBehalfOf`: nome do solicitante original quando outra pessoa registra a validação.
 */
export function applyOrderValidation(order: WorkOrder, result: 'sim' | 'nao', comment: string, by: string, onBehalfOf?: string, href = `os.html?id=${order.id}`) {
  const v = order.validation!;
  const text = comment.trim();
  const note = text ? `: ${text}` : '';
  const now = nowLocal();
  const prefix = onBehalfOf ? `Registrou a validação em nome de ${onBehalfOf}` : 'Validou a conclusão';
  if (result === 'sim') {
    patchOrder(order.id, by, (o) => ({ ...o, statusId: STO.CONCLUIDA, validation: { ...v, result: 'sim', comment: text || undefined, at: now } }),
      [`${prefix}: o problema foi resolvido${note}`, 'OS concluída - a solicitação de origem foi encerrada com ela']);
    updateSubDb((d) => ({
      ...d,
      requests: d.requests.map((r) => (r.id === order.requestId ? { ...r, log: [...r.log, logEntry(by, `Encerrada com a conclusão da ${order.id} após a validação`)] } : r)),
      equipments: d.equipments.map((e) => (e.id === order.equipmentId && e.statusId === 'STE-04' && !d.orders.some((x) => x.id !== order.id && x.equipmentId === e.id && x.statusId !== STO.CONCLUIDA && x.statusId !== STO.CANCELADA) ? { ...e, statusId: 'STE-01' } : e)),
    }));
  } else {
    patchOrder(order.id, by, (o) => ({ ...o, statusId: STO.ANDAMENTO, validation: { ...v, result: 'nao', comment: text, at: now } }),
      [`${prefix}: o problema NÃO foi resolvido${note} - status: Em andamento`]);
    notify([order.responsibleId, ...(order.executor.kind === 'interno' ? [order.executor.userId] : [])], { kind: 'os', title: 'Validação recusada', text: `${order.id}: o solicitante informou que o problema persiste`, href });
  }
}

/** "1.380,00" / "1380,5" / "1380.50" → centavos; vazio ou inválido → null. */
export function parseCents(text: string): number | null {
  const t = text.trim().replace(/[^\d.,]/g, '');
  if (!t) return null;
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

// ─── Responsável e executor (RF502) ─────────────────────────────────────────────────────

export interface PlanValue { responsibleId: string; kind: 'interno' | 'prestador'; userId: string; providerId: string; technician: string }
export const planOf = (o: Pick<WorkOrder, 'responsibleId' | 'executor'>): PlanValue => ({
  responsibleId: o.responsibleId,
  kind: o.executor.kind,
  userId: o.executor.kind === 'interno' ? o.executor.userId : '',
  providerId: o.executor.kind === 'prestador' ? o.executor.providerId : '',
  technician: o.executor.kind === 'prestador' ? o.executor.technician ?? '' : '',
});
export const executorOf = (v: PlanValue): Executor => (v.kind === 'interno' ? { kind: 'interno', userId: v.userId } : { kind: 'prestador', providerId: v.providerId, ...(v.technician ? { technician: v.technician } : {}) });

export interface PlanErrors { responsibleId?: string; userId?: string; providerId?: string }
export const planProblems = (v: PlanValue): PlanErrors => ({
  responsibleId: !v.responsibleId ? requiredMessage('Responsável pela OS') : undefined,
  userId: v.kind === 'interno' && !v.userId ? requiredMessage('Executor interno') : undefined,
  providerId: v.kind === 'prestador' && !v.providerId ? requiredMessage('Prestador') : undefined,
});

/** Usuários do assinante que podem responder por uma OS (Administrador e Gestor de manutenção). */
export const responsibleUsers = (db: SubDb): SubUser[] => db.users.filter((u) => u.status === 'ativo' && (u.profile === 'administrador' || u.profile === 'gestor'));

/**
 * Campos de responsável + executor (RF502-FLU002/FLU003), compartilhados pelo formulário e pelo diálogo de reatribuição.
 * Uma única pessoa/prestador por vez (RGN005); prestadores ativos filtrados pela categoria do equipamento (RGN002 / RF702-RGN004).
 */
export function PlanFields({ db, value, onChange, categoryId, unitId, errors, currentProviderId }: {
  db: SubDb; value: PlanValue; onChange: (v: PlanValue) => void; categoryId: string; unitId: string; errors: PlanErrors; currentProviderId?: string;
}) {
  const refs = useRefs();
  const set = (patch: Partial<PlanValue>) => onChange({ ...value, ...patch });
  const executors = db.users.filter((u) => u.status === 'ativo' && u.profile === 'executor' && u.unitIds.includes(unitId));
  const providers = db.providers.filter((p) => (p.status === 'ativo' && p.categoryIds.includes(categoryId)) || p.id === currentProviderId);
  const provider = db.providers.find((p) => p.id === value.providerId);
  const categoryName = refs.category(categoryId)?.name ?? 'do equipamento';

  return (
    <Grid>
      <Col span={12}>
        <DevNote note="RF502 (campo novo): responsável pela OS é um usuário do assinante - quem responde pela OS e pode reatribuí-la (RGN006: reatribuição manual; escalonamento automático por inatividade é FE003, fora do escopo). Quem for atribuído é sempre notificado (RGN007).">
          <Dropdown
            label="Responsável pela OS" required placeholder="Selecione o responsável"
            options={responsibleUsers(db).map((u) => ({ value: u.id, label: u.name }))}
            value={value.responsibleId} onChange={(v) => set({ responsibleId: v })} error={errors.responsibleId}
          />
        </DevNote>
      </Col>
      <Col span={12}>
        <DevNote note="RGN005: a OS é atribuída a um único executor/prestador por vez - não há cotação com vários prestadores (decisão 29/09). Trocar o tipo limpa a seleção anterior.">
          <RadioButton
            name="executor-kind" label="Tipo de executor" orientation="horizontal"
            options={[{ value: 'interno', label: 'Equipe interna' }, { value: 'prestador', label: 'Prestador externo' }]}
            value={value.kind} onChange={(v) => set({ kind: v as PlanValue['kind'], userId: '', providerId: '', technician: '' })}
          />
        </DevNote>
      </Col>
      {value.kind === 'interno' ? (
        <Col span={12}>
          <Dropdown
            label="Executor interno" required placeholder="Selecione o executor"
            options={executors.map((u) => ({ value: u.id, label: u.name }))}
            value={value.userId} onChange={(v) => set({ userId: v })} error={errors.userId}
            helperText={executors.length ? undefined : 'Nenhum executor ativo vinculado a esta unidade'}
          />
        </Col>
      ) : (
        <>
          <Col span={6}>
            <DevNote note="RGN002 / RF702-RGN004: só prestadores ativos que atendem a categoria do equipamento (e, se aprovado ZC002, o tipo). Prestador não tem login na plataforma - a atribuição vai para o log da OS.">
              <Dropdown
                label="Prestador" required placeholder="Selecione o prestador"
                options={providers.map((p) => ({ value: p.id, label: `${p.tradeName ?? p.name}${p.status === 'inativo' || !p.categoryIds.includes(categoryId) ? ' (indisponível)' : ''}`, description: p.regions.length ? `Atende: ${p.regions.join(', ')}` : undefined }))}
                value={value.providerId} onChange={(v) => set({ providerId: v, technician: '' })} error={errors.providerId}
                helperText={`Ativos que atendem a categoria ${categoryName}`}
              />
            </DevNote>
          </Col>
          {provider?.kind !== 'autonomo' && <Col span={6}>
            <Dropdown
              label="Técnico do prestador" optional placeholder={provider ? 'Selecione o técnico' : 'Escolha o prestador primeiro'}
              options={(provider?.technicians ?? []).map((t) => ({ value: t.name, label: t.name, description: t.specialties.length ? techSpecialtiesText(t) : undefined }))}
              value={value.technician} onChange={(v) => set({ technician: v })} disabled={!provider}
            />
          </Col>}
          {providers.length === 0 && (
            <Col span={12}><Feedback type="warning" title="Nenhum prestador disponível" message={`Não há prestador ativo que atenda a categoria ${categoryName}. Cadastre ou ative um prestador, ou use a equipe interna.`} /></Col>
          )}
        </>
      )}
    </Grid>
  );
}

/** Texto de cada alteração de planejamento (uma linha de log por campo - RF502-RGN003). */
export function planChangeLogs(db: SubDb, before: Pick<WorkOrder, 'responsibleId' | 'executor'>, after: Pick<WorkOrder, 'responsibleId' | 'executor'>): string[] {
  const out: string[] = [];
  const name = (id: string) => db.users.find((u) => u.id === id)?.name ?? '-';
  if (before.responsibleId !== after.responsibleId) out.push(`Reatribuiu a responsabilidade pela OS de ${name(before.responsibleId)} para ${name(after.responsibleId)}`);
  const a = executorText(db, before.executor), b = executorText(db, after.executor);
  if (a !== b) out.push(`Reatribuiu o executor de ${a} para ${b}`);
  return out;
}

/** Diálogo rápido de reatribuição de responsável/executor (RF501 - ação por linha; RF503). */
export function ReassignDialog({ order, onClose }: { order: WorkOrder | null; onClose: () => void }) {
  const toast = useToast();
  const { db, user } = useSubSession();
  const [value, setValue] = useState<PlanValue | null>(null);
  const [tried, setTried] = useState(false);
  useEffect(() => { setValue(order ? planOf(order) : null); setTried(false); }, [order?.id]);  // eslint-disable-line react-hooks/exhaustive-deps
  if (!order || !value) return null;
  const eq = db.equipments.find((e) => e.id === order.equipmentId);
  const errors = tried ? planProblems(value) : {};

  const confirm = () => {
    setTried(true);
    if (Object.values(planProblems(value)).some(Boolean)) return;
    const after = { responsibleId: value.responsibleId, executor: executorOf(value) };
    const logs = planChangeLogs(db, order, after);
    if (!logs.length) { toast.show({ type: 'info', title: 'Nada foi alterado', message: 'O responsável e o executor continuam os mesmos.' }); onClose(); return; }
    const respChanged = order.responsibleId !== after.responsibleId;
    const execChanged = executorText(db, order.executor) !== executorText(db, after.executor);
    const next = { ...order, ...after };
    if (execChanged && after.executor.kind === 'prestador') logs.push(notifyProviderLog(db, after.executor.providerId));
    patchOrder(order.id, user.name, (o) => ({ ...o, ...after }), logs);
    notifyAssignees(db, next, { responsible: respChanged, executor: execChanged });
    toast.show({ type: 'success', title: 'OS reatribuída', message: 'Quem foi atribuído foi notificado e a alteração ficou registrada nas atividades.' });
    onClose();
  };

  return (
    <Dialog
      open onClose={onClose} title={`Reatribuir ${order.id}`} subtitle="Altere quem responde pela OS e quem executa o atendimento"
      actions={<><Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button><Button size="sm" onClick={confirm}>Reatribuir</Button></>}
    >
      <Stack gap="md">
        <PlanFields db={db} value={value} onChange={setValue} categoryId={eq?.categoryId ?? ''} unitId={eq?.unitId ?? ''} errors={errors} currentProviderId={order.executor.kind === 'prestador' ? order.executor.providerId : undefined} />
      </Stack>
    </Dialog>
  );
}

/** Diálogo rápido de classificação (RF501 - ação por linha; RF502-FLU006): só tipo de manutenção e prioridade. O restante da OS fica no Editar. */
export function ClassifyDialog({ order, onClose }: { order: WorkOrder | null; onClose: () => void }) {
  const toast = useToast();
  const refs = useRefs();
  const { user } = useSubSession();
  const [typeId, setTypeId] = useState('');
  const [priorityId, setPriorityId] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => { setTypeId(order?.maintTypeId ?? ''); setPriorityId(order?.priorityId ?? ''); setTried(false); }, [order?.id]);  // eslint-disable-line react-hooks/exhaustive-deps
  if (!order) return null;

  const confirm = () => {
    setTried(true);
    if (!typeId || !priorityId) return;
    const logs: string[] = [];
    if (typeId !== order.maintTypeId) logs.push(`Reclassificou o tipo de manutenção de ${refs.maintType(order.maintTypeId)?.name} para ${refs.maintType(typeId)?.name}`);
    if (priorityId !== order.priorityId) logs.push(`Alterou a prioridade de ${refs.priority(order.priorityId)?.name} para ${refs.priority(priorityId)?.name}`);
    if (!logs.length) { toast.show({ type: 'info', title: 'Nada foi alterado', message: 'O tipo de manutenção e a prioridade continuam os mesmos.' }); onClose(); return; }
    patchOrder(order.id, user.name, (o) => ({ ...o, maintTypeId: typeId, priorityId }), logs);
    toast.show({ type: 'success', title: 'OS classificada', message: 'A alteração ficou registrada nas atividades da OS.' });
    onClose();
  };

  return (
    <Dialog
      open onClose={onClose} title={`Classificar ${order.id}`} subtitle="Defina o serviço e sua prioridade"
      actions={<><Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button><Button size="sm" onClick={confirm}>Salvar</Button></>}
    >
      <Stack gap="md">
        <Dropdown label="Tipo de manutenção" required placeholder="Selecione o tipo" options={refs.admin.maintenanceTypes.filter((t) => t.status === 'ativo' || t.id === order.maintTypeId).map((t) => ({ value: t.id, label: t.name }))} value={typeId} onChange={setTypeId} error={tried && !typeId ? requiredMessage('Tipo de manutenção') : undefined} />
        <Dropdown label="Prioridade" required placeholder="Selecione a prioridade" options={refs.admin.priorities.map((p) => ({ value: p.id, label: p.name }))} value={priorityId} onChange={setPriorityId} error={tried && !priorityId ? requiredMessage('Prioridade') : undefined} />
      </Stack>
    </Dialog>
  );
}

/** Rótulo curto com o ícone ao lado: ver `Stack` horizontal (atalho para chips de texto). */
export const Inline = ({ children }: { children: ReactNode }) => <Stack direction="horizontal" align="center" gap="xs" wrap>{children}</Stack>;

/** Horas trabalhadas da OS: soma das horas lançadas em cada visita (OS antigas, com um valor único em `workedHours`, usam esse valor). */
export const totalHours = (o: Pick<WorkOrder, 'visits' | 'workedHours'>) => {
  const sum = o.visits.reduce((n, v) => n + (v.hours ?? 0), 0);
  return sum > 0 ? sum : o.workedHours ?? 0;
};
export const hoursText = (h: number) => `${String(Math.round(h * 100) / 100).replace('.', ',')} h`;
