import { Button, Dialog, Feedback, Stack, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { Provider } from './data';
import { providerName, providerOrders } from './prestadores';
import { updateSubDb, useSubSession } from './store';
import { Text, useRefs } from './ui';

/**
 * RF701 - Ativar/inativar prestador, com confirmação. Inativo não é ofertado em novas OS/planos (RGN001);
 * OS e planos já atribuídos continuam como estão.
 */
export function ProviderStatusDialog({ provider, onClose }: { provider: Provider | null; onClose: () => void }) {
  const toast = useToast();
  const { db } = useSubSession();
  const refs = useRefs();
  if (!provider) return null;
  const deactivate = provider.status === 'ativo';
  const name = providerName(provider);
  const open = providerOrders(db, provider.id).filter((o) => ['aberto', 'andamento', 'aguardando'].includes(refs.base(o.statusId) ?? '')).length;
  const plans = db.plans.filter((p) => p.status === 'ativo' && p.executor.kind === 'prestador' && p.executor.providerId === provider.id).length;

  const confirm = () => {
    updateSubDb((d) => ({ ...d, providers: d.providers.map((p) => (p.id === provider.id ? { ...p, status: deactivate ? 'inativo' : 'ativo' } : p)) }));
    toast.show(deactivate
      ? { type: 'success', title: 'Prestador inativado', message: 'Ele não será mais ofertado em novas OS e planos.' }
      : { type: 'success', title: 'Prestador ativado', message: 'Ele volta a ser ofertado em novas OS e planos das categorias que atende.' });
    onClose();
  };

  return (
    <Dialog
      open onClose={onClose} size="sm" className="dialog-confirm" title={deactivate ? `Inativar ${name}?` : `Ativar ${name}?`}
      subtitle={deactivate
        ? 'O prestador deixa de aparecer na escolha de executor em novas OS e planos. O histórico de serviços é mantido'
        : 'O prestador volta a aparecer na escolha de executor das categorias que atende'}
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button size="sm" variant={deactivate ? 'destructive' : 'primary'} onClick={confirm}>{deactivate ? 'Inativar prestador' : 'Ativar prestador'}</Button>
        </>
      )}
    >
      {deactivate && (open > 0 || plans > 0) ? (
        <DevNote note="RF701-RGN001: prestador inativo não é ofertado em novas OS nem em planos (RF702-CTA001). OS e planos já atribuídos a ele não são alterados e o histórico é preservado.">
          <Feedback
            type="warning" title="Há trabalho em aberto com este prestador"
            message={`${open} OS em andamento e ${plans} plano${plans === 1 ? '' : 's'} ativo${plans === 1 ? '' : 's'} continuam atribuídos a ele. Reatribua se necessário`}
          />
        </DevNote>
      ) : null}
    </Dialog>
  );
}
