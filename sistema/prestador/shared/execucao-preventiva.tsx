import { ReactNode } from 'react';
import { Button } from '@maglev/ds';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { ExternalLayout, PageHeader, mountApp } from '../../externo/shared/ExternalLayout';
import { ExecucaoCore } from '../../assinante/shared/execucao-preventiva-core';
import { goTo } from '../../assinante/shared/ui';
import { BlockedAccess, linkTo, useProviderLink } from './lib';

/**
 * Execução da preventiva pelo prestador (Prestador RF102 + Assinante RF603), pelo link e no celular. É a mesma tela de
 * execução da Área do assinante (`execucao-preventiva-core.tsx`: checklist, leituras, fotos antes/depois, relatório, anomalia
 * e confirmação), só que na casca externa: sem sidebar, quem assina é o técnico/prestador do link e a anomalia abre a
 * solicitação corretiva em nome dele. Estados: idle · incomplete · anomaly · done (ver a tela de execução do assinante).
 */
function ExecucaoPrestadorScreen() {
  const isMobile = useIsMobile();
  const { provider, technician, state, actorName } = useProviderLink();
  const shell = (content: ReactNode) => <ExternalLayout area="Área do prestador">{content}</ExternalLayout>;
  if (!provider || state === 'invalid') return <>{shell(<BlockedAccess state="invalid" />)}</>;
  if (state === 'inactive') return <>{shell(<BlockedAccess state="inactive" />)}</>;

  const phone = technician?.phone ?? provider.contacts.find((c) => c.main)?.phone ?? '';
  const osLink = (id: string) => linkTo('os.html', provider, technician, { os: id });
  const btn = { className: isMobile ? 'btn-block' : undefined };
  return (
    <ExecucaoCore
      shell={shell}
      actor={{ name: actorName, phone, canEdit: true }}
      deny={(order) => (order.executor.kind === 'prestador' && order.executor.providerId === provider.id && (!technician || order.executor.technician === technician.name)
        ? null : { title: 'Sem acesso a esta OS', message: 'Esta OS não está atribuída a você' })}
      header={({ order, plan, badge }) => <PageHeader title="Executar preventiva" subtitle={`${order.id} · ${plan.name}`} badge={badge} />}
      equipmentLabel={(_, name) => name}
      onCancel={({ order }) => goTo(osLink(order.id))}
      viewOnlyText="Esta execução está somente para leitura"
      readOnlyActions={({ order }) => (
        <>
          <Button variant="secondary" {...btn} onClick={() => goTo(osLink(order.id))}>Ver OS</Button>
          <Button variant="ghost" {...btn} onClick={() => goTo(linkTo('minhas-os.html', provider, technician))}>Voltar às minhas OS</Button>
        </>
      )}
    />
  );
}

mountApp(<ExecucaoPrestadorScreen />);
