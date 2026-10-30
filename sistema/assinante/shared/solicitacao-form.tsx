import { Button } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { SolicitacaoFormCore } from './solicitacao-form-core';
import { useSubSession } from './store';
import { goTo, setFlash } from './ui';

/**
 * Nova solicitação (RF404), pelo portal, com usuário logado. O formulário é o mesmo da abertura pelo QR Code do
 * colaborador (`solicitacao-form-core.tsx`): aqui ele só entra na casca com sidebar e leva à triagem/lista ao enviar.
 * Com `advanced`: obrigatórios no topo e, no fim, o bloco opcional "Detalhes adicionais" (o QR Code do colaborador segue sem ele até ser aprovado).
 */
function SolicitacaoFormScreen() {
  const { user, can, unitIds } = useSubSession();
  return (
    <SolicitacaoFormCore
      advanced
      shell={(content) => <AppLayout active="solicitacoes" screen="solicitacoes">{content}</AppLayout>}
      header={(
        <PageHeader
          title="Nova solicitação"
          subtitle="Preencha o essencial para enviar. No fim do formulário há detalhes opcionais para casos mais complexos"
          breadcrumb={[{ label: 'Solicitações', href: 'solicitacoes.html' }, { label: 'Nova solicitação' }]}
        />
      )}
      actor={{ id: user.id, name: user.name, phone: user.phone }}
      unitIds={unitIds}
      channel="Portal"
      onSent={(id) => {
        setFlash({ type: 'success', title: 'Solicitação enviada com sucesso!', message: `Protocolo ${id}. Sua solicitação foi encaminhada para análise.` });
        window.setTimeout(() => goTo(can('solicitacoes', 'triar') ? `solicitacao.html?id=${id}` : 'solicitacoes.html'), 400);
      }}
      onCancel={() => goTo('solicitacoes.html')}
      resolvedActions={(equipmentId) => (
        <>
          <Button onClick={() => goTo('solicitacoes.html')}>Voltar às solicitações</Button>
          {equipmentId && <Button variant="secondary" onClick={() => goTo(`equipamento.html?id=${equipmentId}`)}>Ver equipamento</Button>}
        </>
      )}
      trackHref={(id) => `solicitacao.html?id=${id}`}
    />
  );
}

mountApp(<SolicitacaoFormScreen />);
