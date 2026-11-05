import { Button, Dialog, Feedback, Stack } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { formatDate, formatDateTime } from '../../admin/shared/format';
import { WorkOrder } from './data';
import { environmentName, equipmentOf, unitIdOfEquipment, unitName, userName, useSubSession } from './store';
import { Col, Grid, ReadField, goTo, useRefs } from './ui';
import { STO, dueCell, executorText, overdueDays } from './os-common';
import { alertText, attendanceAlerts } from './os-alerts';

/** Próxima visita ainda sem chegada (ou o agendamento da OS); sem nenhum dos dois, não há agenda. */
const nextVisit = (o: WorkOrder) => {
  const v = o.visits.filter((x) => !x.arrivedAt).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (v) return `${formatDate(v.date)}${v.from && v.to ? ` · ${v.from} às ${v.to}` : ''}`;
  return o.schedule ? `${formatDate(o.schedule.date)} · ${o.schedule.from} às ${o.schedule.to}` : undefined;
};

/**
 * Resumo da OS (RF501): abre ao clicar na linha da lista, com status, prioridade, prazo e as principais informações, e o botão
 * "Ver detalhes" que leva à OS completa (histórico, custos, anexos, ações). Só consulta: as ações da OS ficam na tela completa.
 */
export function OsQuickView({ order, onClose }: { order: WorkOrder; onClose: () => void }) {
  const refs = useRefs();
  const { db } = useSubSession();
  const eq = equipmentOf(db, order.equipmentId);
  const base = refs.base(order.statusId);
  const late = overdueDays(order, base);
  const preventive = order.kind === 'preventiva';
  const attention = attendanceAlerts({ orders: [order] })[0];
  const next = nextVisit(order);
  const waitingAction = ([STO.APROVACAO, STO.PECA, STO.VALIDACAO] as string[]).includes(order.statusId);
  const full = `os.html?id=${order.id}`;

  return (
    <Dialog
      open onClose={onClose} size="lg" sheet title={order.id} subtitle={order.subject}
      actions={<Button className="btn-block" onClick={() => goTo(full)}>Ver detalhes</Button>}
    >
      <DevNote note="Resumo da OS (RF501): abre ao clicar na linha (o olho da linha e o número da OS seguem para a tela completa). Mostra status, prioridade, prazo (com atraso), executor, responsável, agenda e o problema relatado. Sem botão Fechar (o X e o Esc fecham): como o modal não tem outras ações, “Ver detalhes” é o único CTA, em largura total. Ele leva à OS completa (histórico, orçamento, custos, anexos e as ações). É só consulta: nenhuma ação da OS é feita por aqui. Os avisos de atendimento do prestador (não compareceu / sem agendamento) são os mesmos da central de notificações.">
        <Stack gap="md">
          <Grid>
            <Col span={4}><ReadField label="Status" value={refs.statusBadge(order.statusId)} /></Col>
            <Col span={4}><ReadField label="Prioridade" value={refs.priorityBadge(order.priorityId)} /></Col>
            <Col span={4}><ReadField label="Prazo" value={dueCell(order.dueAt, late)} /></Col>
          </Grid>

          {waitingAction && (
            <Feedback
              type="info" title="Requer ação"
              message={order.statusId === STO.APROVACAO ? 'Há um orçamento aguardando a aprovação' : order.statusId === STO.VALIDACAO ? 'A conclusão foi indicada e aguarda a validação' : 'A OS aguarda a chegada de peça'}
            />
          )}
          {attention && <Feedback type="warning" title={alertText(attention).title} message={alertText(attention).text} />}

          <ReadField label="Problema relatado" value={<span className="os-qv-text">{order.reported}</span>} />
          <Grid>
            <Col span={6}><ReadField label="Equipamento" value={eq ? `${eq.name} · ${eq.code}` : '-'} /></Col>
            <Col span={6}><ReadField label="Unidade e ambiente" value={eq ? `${unitName(db, unitIdOfEquipment(db, order.equipmentId))} · ${environmentName(db, eq.environmentId) ?? '-'}` : '-'} /></Col>
            <Col span={6}><ReadField label="Tipo" value={`${preventive ? 'Preventiva' : 'Corretiva'} · ${refs.maintType(order.maintTypeId)?.name ?? '-'}`} /></Col>
            <Col span={6}><ReadField label="Próxima visita" value={next ?? 'Sem agendamento'} /></Col>
            <Col span={6}><ReadField label="Executor / Prestador" value={executorText(db, order.executor)} /></Col>
            <Col span={6}><ReadField label="Responsável" value={userName(db, order.responsibleId)} /></Col>
            <Col span={6}><ReadField label="Criada em" value={formatDateTime(order.createdAt)} /></Col>
            {order.requestId && <Col span={6}><ReadField label="Solicitação de origem" value={<a className="text-link" href={`solicitacao.html?id=${order.requestId}`}>{order.requestId}</a>} /></Col>}
          </Grid>
        </Stack>
      </DevNote>
    </Dialog>
  );
}
