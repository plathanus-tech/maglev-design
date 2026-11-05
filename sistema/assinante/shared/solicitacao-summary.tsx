import { Badge, Button, Dialog, Feedback, Stack } from '@maglev/ds';
import './solicitacao.css';
import { IconExternalLink } from '@tabler/icons-react';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { PRIORITY_MATRIX } from '../../admin/shared/data';
import { formatDateTime, formatPhone, noBreak } from '../../admin/shared/format';
import { IMPACT_LABEL, Request } from './data';
import { environmentName, equipmentOf, unitIdOfEquipment, unitName, userName, useSubSession } from './store';
import { Col, Grid, ReadField, goTo, useRefs } from './ui';
import { hasSafetyRisk } from './solicitacao-details';
import { warrantyLine } from './warranty-ui';
import { warrantyOf } from './warranty';
import { STS, canConclude, changeRequest, suggestedPriority } from './solicitacoes-shared';

const IMPACT_BADGE = { baixo: 'neutral', medio: 'info', alto: 'warning' } as const;

export type SummaryDecision = 'complement' | 'close' | 'reject';

/**
 * Resumo da solicitação (RF401): abre ao clicar na linha da lista, com o que importa para decidir e as MESMAS decisões da triagem
 * (Aprovar e criar OS, Solicitar complementação, Concluir sem OS e Rejeitar). Quem precisa de fotos, troubleshooting, detalhes adicionais,
 * histórico e da classificação opcional segue pelo link "Ver solicitação completa". Abrir o resumo não altera nada (a triagem só "começa"
 * quando a decisão é tomada ou a solicitação completa é aberta).
 */
export function SolicitacaoSummary({ request, onClose, onDecide }: { request: Request; onClose: () => void; onDecide: (kind: SummaryDecision, request: Request) => void }) {
  const refs = useRefs();
  const { db, user, can } = useSubSession();
  const eq = equipmentOf(db, request.equipmentId);
  const base = refs.base(request.statusId);
  const problem = refs.requestType(request.problemId)?.name ?? '-';
  const canTriage = can('solicitacoes', 'triar');
  const editable = canTriage && [STS.NEW, STS.TRIAGE, STS.WAITING].includes(request.statusId as never);
  const approvedPending = request.statusId === STS.APPROVED && !request.osId;
  const suggestion = suggestedPriority(db, request, PRIORITY_MATRIX);
  const full = `solicitacao.html?id=${request.id}`;
  const warranty = eq ? warrantyOf(eq.warranty) : undefined;
  const risk = hasSafetyRisk(request.details);

  const approve = () => {
    // Aprovar pelo resumo não classifica: a prioridade segue a sugestão da matriz e o resto (tipo, responsável) é pedido na criação da OS
    changeRequest(request.id, user.name, { priorityId: request.priorityId ?? (suggestion || undefined), statusId: STS.APPROVED }, [
      ...(request.statusId === STS.NEW ? ['Iniciou a triagem'] : []),
      'Aprovou a solicitação para criar OS',
    ]);
    goTo(`os-form.html?request=${request.id}`);
  };

  const fullLink = (
    <a className="text-link sol-sum-link" href={full}>
      Ver solicitação completa <IconExternalLink size={16} aria-hidden="true" />
    </a>
  );

  const actions = editable ? (
    <>
      <Button variant="ghost" className="sol-reject" onClick={() => onDecide('reject', request)}>Rejeitar</Button>
      {canConclude(request, base) && <Button variant="secondary" onClick={() => onDecide('close', request)}>Concluir sem OS</Button>}
      <Button variant="secondary" onClick={() => onDecide('complement', request)}>Solicitar complementação</Button>
      <Button onClick={approve}>Aprovar e criar OS</Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose}>Fechar</Button>
      {request.osId
        ? <Button onClick={() => goTo(`os.html?id=${request.osId}`)}>Ver OS {request.osId}</Button>
        : approvedPending && canTriage
          ? <Button onClick={() => goTo(`os-form.html?request=${request.id}`)}>Criar OS</Button>
          : <Button onClick={() => goTo(full)}>Ver solicitação completa</Button>}
    </>
  );

  return (
    <Dialog open onClose={onClose} size="lg" sheet title={request.id} subtitle={`${problem} · ${eq?.name ?? '-'}`} actions={actions}>
      <DevNote note="Resumo da solicitação (RF401): abre ao clicar na linha (o olho da linha e o protocolo seguem para a tela completa). Traz o que é preciso para decidir e as quatro decisões da triagem (as mesmas do card “Classificação e encaminhamento”). Aprovar pelo resumo não classifica: a prioridade segue a sugestão da matriz criticidade × impacto e o que faltar (tipo de manutenção, responsável) é pedido na criação da OS. Abrir o resumo não inicia a triagem nem altera a solicitação. O link “Ver solicitação completa” leva a fotos, troubleshooting, detalhes adicionais, outras solicitações do equipamento, histórico e classificação opcional.">
        <Stack gap="md">
          <Stack direction="horizontal" gap="sm" wrap align="center">
            {refs.statusBadge(request.statusId)}
            {request.priorityId ? refs.priorityBadge(request.priorityId) : suggestion ? <Badge status="neutral">{`Prioridade sugerida: ${refs.priority(suggestion)?.name ?? '-'}`}</Badge> : null}
            <Badge status={IMPACT_BADGE[request.impact]} dot>{`Impacto ${IMPACT_LABEL[request.impact].toLowerCase()}`}</Badge>
          </Stack>

          {risk && <Feedback type="warning" title="Risco de segurança informado" message="O solicitante indicou risco de gás, fumaça ou elétrico. Considere priorizar" />}
          {request.statusId === STS.WAITING && <Feedback type="warning" title="Aguardando informação do solicitante" message={request.complement?.question ?? 'Um pedido de complementação foi enviado'} />}
          {approvedPending && canTriage && <Feedback type="info" title="Aprovada, falta criar a OS" message="A aprovação já está registrada. Crie a OS para continuar" />}
          {request.osId && <Feedback type="info" title={`Convertida em ${request.osId}`} message="O status da solicitação segue o da ordem de serviço" />}

          <ReadField label="Descrição" value={<span className="sol-sum-text">{request.description}</span>} />
          <Grid>
            <Col span={6}><ReadField label="Equipamento" value={eq ? `${eq.name} · ${eq.code}` : '-'} /></Col>
            <Col span={6}><ReadField label="Unidade e ambiente" value={eq ? `${unitName(db, unitIdOfEquipment(db, request.equipmentId))} · ${environmentName(db, eq.environmentId) ?? '-'}` : '-'} /></Col>
            <Col span={6}><ReadField label="Solicitante" value={`${request.requesterName} · ${noBreak(formatPhone(request.requesterPhone))}`} /></Col>
            <Col span={6}><ReadField label="Aberta em" value={noBreak(formatDateTime(request.openedAt))} /></Col>
            <Col span={6}><ReadField label="Responsável" value={request.responsibleId ? userName(db, request.responsibleId) : 'Ninguém assumiu ainda'} /></Col>
            {warranty && warranty.kind === 'expiring' && <Col span={6}><ReadField label="Garantia do equipamento" value={warrantyLine(eq!.warranty)} /></Col>}
          </Grid>
          {fullLink}
        </Stack>
      </DevNote>
    </Dialog>
  );
}
