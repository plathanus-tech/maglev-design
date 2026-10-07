import { useState } from 'react';
import { Button, Checkbox, Dialog, Dropdown, Stack, Textarea, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { requiredMessage } from '../../admin/shared/format';
import { DEMO_NOW, Request, SubDb, nowLocal } from './data';
import { getSubDb, logEntry, notify, unitIdOfEquipment, updateSubDb, useSubSession } from './store';
import { useRefs } from './ui';

/**
 * Peças compartilhadas do módulo Solicitações (lista RF401, triagem RF402, abertura RF404):
 * ids de status, regras de situação, gravação de mudança de status com histórico/notificação e os
 * diálogos de decisão (concluir sem OS, rejeitar, solicitar complementação).
 */

export const STS = { NEW: 'STS-01', TRIAGE: 'STS-02', WAITING: 'STS-03', APPROVED: 'STS-04', CONVERTED: 'STS-05', REJECTED: 'STS-06', DONE: 'STS-07' } as const;
/** 💡 P05 a confirmar: não há cadastro de grupos previstos no contrato; lista de demonstração. */
export const GROUPS = ['Manutenção geral', 'Refrigeração', 'Cocção', 'Elétrica'];
/** As miniaturas do Navegador de Protótipo abrem as telas com `thumb=1`: não alteram dados. */
export const IS_THUMB = new URLSearchParams(location.search).has('thumb');

/** Situação-base "em aberto" (RF407-RGN004): aberto, em andamento ou aguardando. */
export const isOpenBase = (base?: string) => base === 'aberto' || base === 'andamento' || base === 'aguardando';
/** RGN006/RGN007: só conclui manualmente quem ainda não virou OS; convertida segue o status da OS. */
export const canConclude = (r: Request, base?: string) => !r.osId && r.statusId !== STS.CONVERTED && isOpenBase(base);
/** Horas desde a data/hora, relativas ao "agora" do protótipo. */
export const hoursSince = (iso: string) => Math.max(0, Math.floor((DEMO_NOW.getTime() - new Date(iso).getTime()) / 3_600_000));

/**
 * Prioridade sugerida pela matriz criticidade × impacto (Admin RF405). Impacto Alto = Parada total, Médio = Degradação,
 * Baixo = Alerta. Retorna '' se não houver cruzamento.
 */
export function suggestedPriority(db: SubDb, r: Pick<Request, 'equipmentId' | 'impact'>, matrix: Array<{ criticality: string; cells: [string, string, string] }>) {
  const criticality = db.equipments.find((e) => e.id === r.equipmentId)?.criticalityId;
  const col = r.impact === 'alto' ? 0 : r.impact === 'medio' ? 1 : 2;
  return matrix.find((m) => m.criticality === criticality)?.cells[col] ?? '';
}

/** Grava uma mudança na solicitação e registra no histórico (autor + texto). `statusChangedAt` só muda se o status mudar. */
export function changeRequest(id: string, by: string, patch: Partial<Request>, text: string) {
  updateSubDb((db) => ({
    ...db,
    requests: db.requests.map((r) => (r.id !== id ? r : {
      ...r, ...patch,
      statusChangedAt: patch.statusId && patch.statusId !== r.statusId ? nowLocal() : r.statusChangedAt,
      log: [...r.log, logEntry(by, text)],
    })),
  }));
}

/** Solicitante, responsável e gestor da unidade, sem quem fez a ação (RF801). */
export function followersOf(db: SubDb, r: Request, exceptId?: string): string[] {
  const unit = db.units.find((u) => u.id === unitIdOfEquipment(db, r.equipmentId));
  return [r.requesterUserId, r.responsibleId, unit?.managerId].filter((x): x is string => !!x && x !== exceptId);
}
export function notifyFollowers(requestId: string, exceptId: string, title: string, text: string) {
  const db = getSubDb();
  const r = db.requests.find((x) => x.id === requestId);
  if (r) notify(followersOf(db, r, exceptId), { title, text, href: `solicitacao.html?id=${r.id}`, kind: 'solicitacao' });
}

interface DecisionProps {
  request: Request;
  onClose: () => void;
  /** Classificação digitada na triagem, gravada junto com a decisão. */
  extra?: Partial<Request>;
}

/** Concluir sem OS (RF401-FLU006/CTA003, RF402-FLU005.3): observação obrigatória, histórico com autor e notificação. */
export function ConcludeDialog({ request, onClose, extra, label = 'Motivo da conclusão' }: DecisionProps & { label?: string }) {
  const toast = useToast();
  const refs = useRefs();
  const { user } = useSubSession();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const error = tried && !text.trim() ? requiredMessage(label) : undefined;

  const confirm = () => {
    setTried(true);
    if (!text.trim()) return;
    changeRequest(request.id, user.name, { ...extra, statusId: STS.DONE, closeReason: text.trim() }, `Concluiu sem OS: ${text.trim()}`);
    notifyFollowers(request.id, user.id, 'Solicitação concluída sem OS', `${request.id}: ${text.trim()}`);
    toast.show({ type: 'success', title: 'Solicitação concluída', message: `${request.id} foi concluída sem OS. O solicitante e os responsáveis foram notificados.` });
    onClose();
  };

  return (
    <Dialog
      open onClose={onClose} size="sm"
      title="Concluir solicitação sem gerar OS?"
      subtitle={`${request.id} · ${refs.requestType(request.problemId)?.name ?? 'Solicitação'}`}
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={confirm}>Concluir sem OS</Button>
        </>
      )}
    >
      <DevNote note="RF401-FLU006/RGN006 e CTA003: o assinante conclui uma solicitação que ainda não virou OS; a observação é obrigatória e, com o autor, fica no histórico. O solicitante e os responsáveis são notificados (FLU007 / RF801). Solicitação convertida em OS segue o status da OS (RGN007).">
        <Stack gap="md">
          <p className="page-text">Use quando o problema já foi resolvido e não é necessário gerar uma ordem de serviço.</p>
          <Textarea
            label={label} required rows={4} value={text} onChange={(e) => setText(e.target.value)} error={error}
            placeholder="Descreva como a solicitação foi resolvida"
            helperText="O motivo ficará registrado no histórico e será enviado ao solicitante."
          />
        </Stack>
      </DevNote>
    </Dialog>
  );
}

/** Rejeitar (RF402-FLU005.1) com a opção "Duplicada" (RGN006): informa o protocolo original. */
export function RejectDialog({ request, onClose, extra }: DecisionProps) {
  const toast = useToast();
  const refs = useRefs();
  const { db, user } = useSubSession();
  const others = db.requests.filter((r) => r.equipmentId === request.equipmentId && r.id !== request.id);
  const [duplicate, setDuplicate] = useState(false);
  const [original, setOriginal] = useState('');
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const originalError = tried && duplicate && !original ? requiredMessage('Protocolo original') : undefined;
  const textError = tried && !duplicate && !text.trim() ? requiredMessage('Motivo') : undefined;

  const confirm = () => {
    setTried(true);
    if ((duplicate && !original) || (!duplicate && !text.trim())) return;
    const reason = duplicate ? `Duplicada de ${original}${text.trim() ? ` - ${text.trim()}` : ''}` : text.trim();
    changeRequest(request.id, user.name, { ...extra, statusId: STS.REJECTED, closeReason: reason, duplicateOf: duplicate ? original : undefined }, duplicate ? `Recusou como duplicada de ${original}${text.trim() ? `: ${text.trim()}` : ''}` : `Recusou a solicitação: ${text.trim()}`);
    notifyFollowers(request.id, user.id, 'Solicitação recusada', `${request.id}: ${reason}`);
    toast.show({ type: 'success', title: 'Solicitação recusada', message: `${request.id} foi encerrada como Recusada. O solicitante foi notificado.` });
    onClose();
  };

  return (
    <Dialog
      open onClose={onClose} size="sm"
      title={`Rejeitar ${request.id}?`}
      subtitle="A solicitação será encerrada como Recusada e o solicitante será notificado"
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button size="sm" variant="destructive" onClick={confirm}>Rejeitar solicitação</Button>
        </>
      )}
    >
      <Stack gap="md">
        <DevNote note="RF402-RGN006: duplicadas são permitidas na abertura (aviso); o gestor pode rejeitá-las como “Duplicada” indicando o protocolo original (grava duplicateOf). RGN003: motivos comuns de rejeição: equipamento fora da garantia com decisão de troca, solicitação inválida. CTA002: o motivo é obrigatório e fica no histórico.">
          <Checkbox
            label="Esta solicitação é duplicada" checked={duplicate} disabled={others.length === 0}
            onChange={(e) => setDuplicate(e.target.checked)}
          />
        </DevNote>
        {duplicate && (
          <Dropdown
            label="Protocolo original" required placeholder="Selecione o protocolo" value={original} onChange={setOriginal} error={originalError}
            options={others.map((r) => ({ value: r.id, label: `${r.id} · ${refs.status(r.statusId)?.name ?? ''}` }))}
          />
        )}
        <Textarea
          label="Motivo" required={!duplicate} optional={duplicate} rows={4} value={text} onChange={(e) => setText(e.target.value)} error={textError}
          helperText="Fica registrado no histórico e é enviado ao solicitante"
        />
      </Stack>
    </Dialog>
  );
}

/** Solicitar complementação (RF402-FLU005.2): pergunta obrigatória, status Aguardando informação, notifica o solicitante. */
export function ComplementDialog({ request, onClose, extra }: DecisionProps) {
  const toast = useToast();
  const { user } = useSubSession();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const error = tried && !text.trim() ? requiredMessage('Pedido de complementação') : undefined;

  const confirm = () => {
    setTried(true);
    if (!text.trim()) return;
    changeRequest(request.id, user.name, { ...extra, statusId: STS.WAITING, complement: { question: text.trim(), askedAt: nowLocal() } }, `Solicitou complementação: ${text.trim()}`);
    notifyFollowers(request.id, user.id, 'Complementação solicitada', `${request.id}: ${text.trim()}`);
    toast.show({ type: 'success', title: 'Complementação solicitada', message: 'A solicitação ficou Aguardando informação e o solicitante foi notificado.' });
    onClose();
  };

  return (
    <Dialog
      open onClose={onClose} size="sm"
      title="Solicitar complementação"
      subtitle={`${request.id} ficará Aguardando informação até o solicitante responder`}
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={confirm}>Enviar pedido</Button>
        </>
      )}
    >
      <DevNote note="RF402-FLU005.2 e CTA002: o texto é obrigatório, enviado ao solicitante (RF801) e registrado no histórico. O solicitante responde pela página de acompanhamento (PWA RF004) e a solicitação volta para Em triagem; a resposta aparece na triagem (CTA004).">
        <Textarea
          label="Pedido de complementação" required rows={4} value={text} onChange={(e) => setText(e.target.value)} error={error}
          placeholder="Ex.: envie uma foto do painel do equipamento" helperText="Texto enviado ao solicitante"
        />
      </DevNote>
    </Dialog>
  );
}
