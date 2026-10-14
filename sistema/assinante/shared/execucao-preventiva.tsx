import { Button } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { ExecucaoCore } from './execucao-preventiva-core';
import { useSubSession } from './store';
import { param } from './ui';
import { useIsMobile } from '../../admin/shared/useMediaQuery';

/**
 * RF603 - Execução da preventiva pelo executor interno (Área do assinante), pensada para o celular. A tela em si
 * (`execucao-preventiva-core.tsx`) é a mesma usada pelo prestador que acessa pelo link: aqui só entra na casca com sidebar.
 * Estados: idle · incomplete (tentativa de concluir com pendências) · anomaly (com anomalia) · done (concluída, leitura).
 */
function ExecucaoScreen() {
  const { user, can } = useSubSession();
  const isMobile = useIsMobile();
  const btn = { className: isMobile ? 'btn-block' : undefined };
  const from = param('from');
  const active = from === 'plano' ? 'planos' : 'os';
  return (
    <ExecucaoCore
      shell={(content) => <AppLayout active={active} screen="os">{content}</AppLayout>}
      actor={{ id: user.id, name: user.name, phone: user.phone, canEdit: can('os', 'editar') }}
      deny={(order) => (user.profile === 'executor' && !(order.executor.kind === 'interno' && order.executor.userId === user.id)
        ? { title: 'Sem acesso a esta OS', message: 'Você só acessa as ordens de serviço atribuídas a você' } : null)}
      header={({ order, plan, badge }) => (
        <PageHeader
          title="Executar preventiva" subtitle={`${order.id} · ${plan.name}`} badge={badge}
          breadcrumb={from === 'plano'
            ? [{ label: 'Planos de manutenção', href: 'planos.html' }, { label: plan.name, href: `plano.html?id=${plan.id}` }, { label: 'Executar preventiva' }]
            : [{ label: 'Ordens de serviço', href: 'ordens-servico.html' }, { label: order.id, href: `os.html?id=${order.id}` }, { label: 'Executar preventiva' }]}
        />
      )}
      equipmentLabel={(id, name) => <a className="text-link" href={`equipamento.html?id=${id}`}>{name}</a>}
      // Cancelar volta para a tela de onde a pessoa abriu a execução (plano, OS ou a página anterior); sem origem conhecida, a lista de OS
      onCancel={({ order, plan }) => {
        if (from === 'plano') { window.location.href = `plano.html?id=${plan.id}`; return; }
        if (from === 'os') { window.location.href = `os.html?id=${order.id}`; return; }
        const ref = document.referrer;
        window.location.href = ref && new URL(ref).origin === window.location.origin && new URL(ref).pathname !== window.location.pathname ? ref : 'ordens-servico.html';
      }}
      readOnlyActions={({ order }) => (
        <>
          <Button variant="secondary" {...btn} onClick={() => { window.location.href = `os.html?id=${order.id}`; }}>Ver OS</Button>
          <Button variant="ghost" {...btn} onClick={() => { window.location.href = 'ordens-servico.html'; }}>Voltar às ordens de serviço</Button>
        </>
      )}
    />
  );
}

mountApp(<ExecucaoScreen />);
