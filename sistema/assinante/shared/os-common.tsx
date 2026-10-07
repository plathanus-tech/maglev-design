import { ReactNode, useEffect, useState } from 'react';
import { Button, Dialog, Dropdown, Feedback, RadioButton, Stack, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { Executor, SubDb, WorkOrder, SubUser, dayOnly } from './data';
import { logEntry, notify, updateSubDb, useSubSession } from './store';
import { Col, Grid, useRefs } from './ui';
import { requiredMessage } from '../../admin/shared/format';

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
            helperText={executors.length ? 'Usuários com perfil Executor, ativos e vinculados à unidade do equipamento' : 'Nenhum executor ativo vinculado a esta unidade'}
          />
        </Col>
      ) : (
        <>
          <Col span={6}>
            <DevNote note="RGN002 / RF702-RGN004: só prestadores ativos que atendem a categoria do equipamento (e, se aprovado ZC002, o tipo). Prestador não tem login na plataforma - a atribuição vai para o log da OS.">
              <Dropdown
                label="Prestador" required placeholder="Selecione o prestador"
                options={providers.map((p) => ({ value: p.id, label: `${p.tradeName ?? p.name}${p.status === 'inativo' || !p.categoryIds.includes(categoryId) ? ' (indisponível)' : ''}` }))}
                value={value.providerId} onChange={(v) => set({ providerId: v, technician: '' })} error={errors.providerId}
                helperText={`Ativos que atendem a categoria ${categoryName}`}
              />
            </DevNote>
          </Col>
          <Col span={6}>
            <Dropdown
              label="Técnico do prestador" optional placeholder={provider ? 'Selecione o técnico' : 'Escolha o prestador primeiro'}
              options={(provider?.technicians ?? []).map((t) => ({ value: t.name, label: `${t.name} · ${t.specialty}` }))}
              value={value.technician} onChange={(v) => set({ technician: v })} disabled={!provider}
            />
          </Col>
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
    if (execChanged && after.executor.kind === 'prestador') logs.push(`Notificou o prestador ${providerLabel(db, after.executor.providerId)} (sem login na plataforma)`);
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

/** Rótulo curto com o ícone ao lado: ver `Stack` horizontal (atalho para chips de texto). */
export const Inline = ({ children }: { children: ReactNode }) => <Stack direction="horizontal" align="center" gap="xs" wrap>{children}</Stack>;
