import { IconAlertCircle } from '@tabler/icons-react';
import { Button, Card, EmptyState } from '@maglev/ds';
import { ExternalLayout, PageHeader, mountApp } from '../../externo/shared/ExternalLayout';
import { SolicitacaoFormCore } from '../../assinante/shared/solicitacao-form-core';
import { useSubDb } from '../../assinante/shared/store';
import { goTo } from '../../assinante/shared/ui';
import { equipmentFromLink, linkToEquipment, linkToRequest, linkToRequestByToken, recall, remember, useBlockedReason } from './lib';

/**
 * Abrir solicitação rápida (Colaborador RF002). É o mesmo formulário da Área do assinante (RF404), adaptado ao colaborador sem
 * login: equipamento/unidade/ambiente vêm do QR Code, nome e telefone são obrigatórios (RGN009) e lembrados no dispositivo
 * (RGN011), há aceite de Termos e Política de Privacidade e a solicitação nasce "Nova" com canal "QR Code" (RGN003).
 */
function SolicitarScreen() {
  const db = useSubDb();
  const eq = equipmentFromLink(db);
  const blocked = useBlockedReason(db, eq);
  const remembered = recall();
  const shell = (content: React.ReactNode) => <ExternalLayout area="Solicitação de manutenção">{content}</ExternalLayout>;

  if (!eq || blocked) {
    return shell(
      <div className="ext-empty is-page">
        <EmptyState
          compact icon={<IconAlertCircle size={32} />} headingLevel={1}
          title={!eq ? 'Equipamento não encontrado' : blocked === 'inactive' ? 'Este equipamento está inativo' : 'Solicitações indisponíveis no momento'}
          description="Não é possível abrir uma solicitação agora. Fale com o responsável pela manutenção"
          action={eq ? <Button variant="secondary" onClick={() => goTo(linkToEquipment(eq))}>Voltar ao equipamento</Button> : undefined}
        />
      </div>,
    );
  }

  return (
    <SolicitacaoFormCore
      external
      shell={shell}
      header={<PageHeader title="Abrir solicitação" subtitle={eq.name} />}
      troubleshootingHeader={<PageHeader title="Solução de problemas" subtitle={eq.name} />}
      actor={{ name: remembered.name, phone: remembered.phone }}
      unitIds={db.units.map((u) => u.id)}
      fixedEquipmentId={eq.id}
      channel="QR"
      onRemember={remember}
      onSent={(id) => goTo(`${linkToRequestByToken(id)}&novo=1`)}
      onCancel={() => goTo(linkToEquipment(eq))}
      resolvedActions={() => <Button onClick={() => goTo(linkToEquipment(eq))}>Voltar ao equipamento</Button>}
      trackHref={linkToRequest}
    />
  );
}

mountApp(<SolicitarScreen />);
