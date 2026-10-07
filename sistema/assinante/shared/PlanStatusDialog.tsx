import { Button, Dialog, Feedback, Stack, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { Plan } from './data';
import { executorOf, setPlanStatus } from './preventivas';
import { useSubSession } from './store';
import { Text } from './ui';

/**
 * RF602 - Pausar/ativar plano, com confirmação. Pausar interrompe a geração de novas execuções (CTA001);
 * reativar recalcula as próximas a partir de hoje (RGN003). As OS já geradas continuam como estão.
 */
export function PlanStatusDialog({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const toast = useToast();
  const { db, user } = useSubSession();
  if (!plan) return null;
  const pause = plan.status === 'ativo';
  const executor = executorOf(db, plan.executor);
  const blocked = !pause && !executor.active;

  const confirm = () => {
    const r = setPlanStatus(plan, pause ? 'pausado' : 'ativo', user);
    toast.show(pause
      ? { type: 'success', title: 'Plano pausado', message: 'Novas execuções não serão geradas enquanto o plano estiver pausado.' }
      : { type: 'success', title: 'Plano ativado', message: `As próximas execuções foram recalculadas a partir de hoje${r.newOrders ? ` e ${r.newOrders} OS preventiva${r.newOrders === 1 ? '' : 's'} foi gerada` : ''}.` });
    onClose();
  };

  return (
    <Dialog
      open onClose={onClose} size="sm" title={pause ? `Pausar ${plan.name}?` : `Ativar ${plan.name}?`}
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button size="sm" variant={pause ? 'destructive' : 'primary'} onClick={confirm} disabled={blocked}>{pause ? 'Pausar plano' : 'Ativar plano'}</Button>
        </>
      )}
    >
      <Stack gap="md">
        <DevNote note={pause
          ? 'RF602-CTA001: pausar interrompe a geração de novas execuções. Execuções e OS já geradas continuam abertas (não são canceladas) - 💡 confirmar se devem ser canceladas.'
          : 'RF602-RGN003: ao reativar, o sistema recalcula as próximas execuções a partir da data atual, mantendo o calendário fixo do plano (RF601-RGN005). Prestador inativo não é ofertado em planos (RF701-RGN001).'}
        >
          <Text>{pause
            ? 'O plano deixa de gerar novas execuções e OS preventivas. O histórico e as OS já abertas são mantidos.'
            : 'O plano volta a gerar execuções e OS preventivas, com as próximas datas recalculadas a partir de hoje.'}
          </Text>
        </DevNote>
        {blocked && <Feedback type="warning" title="Executor indisponível" message="O executor padrão deste plano está inativo. Edite o plano e escolha outro executor antes de ativá-lo." />}
      </Stack>
    </Dialog>
  );
}
