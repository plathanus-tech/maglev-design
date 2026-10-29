import { useEffect, useState } from 'react';
import { Button, Dialog, Dropdown, Feedback, Stack, Textarea, useToast } from '@maglev/ds';
import { DevNote } from './dev-notes/DevNote';
import { INACTIVATION_REASONS, InactivationReason, Subscriber, subscriberName } from './data';
import { getSessionUser, logActivity, nowIso, updateDb, useSession } from './store';
import { IconClipboardList, IconQrcode, IconUsers } from '@tabler/icons-react';
import { ImpactSection, countOf, impactOf, overdueNoticeItem } from './OverdueDialog';
import { Text } from './ui';
import { requiredMessage } from './format';

/**
 * RF204 - Ativar/inativar ambiente (manual), a partir da listagem (RF201) ou do detalhe (RF203).
 * Inativar: confirmação + motivo; bloqueia usuários e QR Codes; notifica os Administradores do Admin.
 * Ativar: confirmação; o ambiente volta com todos os dados.
 */
export function EnvironmentDialog({ subscriber, onClose, onConfirmed, presetReason }: {
  subscriber: Subscriber | null; onClose: () => void;
  /** Chamado depois de aplicar a mudança (ex.: o formulário de edição salva os dados). */ onConfirmed?: () => void;
  /** Motivo já escolhido no formulário de edição: o modal só mostra o impacto e não pergunta de novo. */ presetReason?: { reason: InactivationReason; other: string };
}) {
  const toast = useToast();
  const { db } = useSession();
  const [typedReason, setReason] = useState<InactivationReason | ''>('');
  const [typedOther, setOther] = useState('');
  const reason = presetReason?.reason ?? typedReason;
  const other = presetReason?.other ?? typedOther;
  const [tried, setTried] = useState(false);
  useEffect(() => { setReason(''); setOther(''); setTried(false); }, [subscriber?.id]);
  if (!subscriber) return null;

  const deactivate = subscriber.status !== 'inativo';
  const name = subscriberName(subscriber);
  const reasonError = tried && !reason ? requiredMessage('Motivo') : undefined;
  const otherError = tried && reason === 'outro' && !other.trim() ? requiredMessage('Descreva o motivo') : undefined;

  const confirm = () => {
    if (deactivate) {
      setTried(true);
      if (!reason || (reason === 'outro' && !other.trim())) return;
    }
    const label = INACTIVATION_REASONS.find((r) => r.value === reason)?.label;
    const by = getSessionUser().name;
    updateDb((db) => ({
      ...db,
      subscribers: db.subscribers.map((s) => (s.id !== subscriber.id ? s : {
        ...s,
        status: deactivate ? 'inativo' : 'ativo',
        envHistory: [{ at: nowIso(), by, action: deactivate ? 'inativou' : 'ativou', reason: deactivate ? (reason === 'outro' ? other.trim() : label) : undefined }, ...s.envHistory],
      })),
    }));
    logActivity(getSessionUser().id, 'Assinantes', deactivate ? 'inativacao' : 'ativacao', `${deactivate ? 'Inativou' : 'Ativou'} o ambiente do assinante ${name}`);
    toast.show(deactivate
      ? { type: 'success', title: 'Ambiente inativado', message: 'Usuários e QR Codes do assinante foram bloqueados. Os administradores da plataforma foram notificados.' }
      : { type: 'success', title: 'Ambiente ativado', message: 'O acesso do assinante voltou a funcionar com todos os dados preservados.' });
    onConfirmed?.();
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm" className="dialog-confirm"
      title={deactivate ? `Inativar o ambiente de ${name}?` : `Ativar o ambiente de ${name}?`}
      subtitle={deactivate ? 'Os administradores da plataforma serão notificados sobre a inativação' : undefined}
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          {deactivate
            ? <Button size="sm" variant="destructive" onClick={confirm}>Inativar ambiente</Button>
            : <Button size="sm" onClick={confirm}>Ativar ambiente</Button>}
        </>
      )}
    >
      {deactivate ? (
        <Stack gap="md">
          <DevNote note="RF204-RGN002/RGN003 e FLU004/FLU005. Confirmação obrigatória para evitar inativação por engano (risco apontado pela cliente - RGN005). Motivo: 💡 sugestão da spec (Inadimplência, Contrato encerrado, Outro); aqui obrigatório para o registro (data, usuário e motivo - CTA003). Só perfis com permissão “Ativar/Inativar” em Assinantes veem a ação (RF303). Os administradores da plataforma são notificados pela plataforma e por e-mail (aviso no subtítulo do modal). Texto da mensagem exibida ao assinante: a definir.">
            <Feedback
              type="warning"
              title="O assinante perde o acesso imediatamente"
              message="Os usuários e os QR Codes vinculados serão bloqueados"
            />
          </DevNote>
          {(() => {
            const i = impactOf(db, subscriber);
            const deadline = overdueNoticeItem(subscriber);
            return (
              <ImpactSection
                title="O que será afetado"
                items={[
                  ...(deadline ? [deadline] : []),
                  { icon: <IconUsers size={16} />, text: <><strong>{countOf(i.users, 'usuário ativo', 'usuários ativos')}</strong> terão o acesso bloqueado</> },
                  { icon: <IconQrcode size={16} />, text: <><strong>{countOf(i.qr, 'QR Code', 'QR Codes')}</strong> deixarão de abrir solicitações</> },
                  { icon: <IconClipboardList size={16} />, text: <><strong>{countOf(i.tickets, 'chamado em aberto', 'chamados em aberto')}</strong> ficam congelados até a reativação</> },
                ]}
                preserved={{ title: 'Nada é excluído', text: 'Dados e histórico ficam preservados. Ao reativar, o acesso, os QR Codes, os chamados e o histórico voltam a funcionar.' }}
              />
            );
          })()}
          {!presetReason && (
            <>
              <Dropdown
                label="Motivo"
                required
                options={INACTIVATION_REASONS}
                value={reason}
                onChange={(v) => setReason(v as InactivationReason)}
                error={reasonError}
              />
              {reason === 'outro' && (
                <Textarea label="Descreva o motivo" required rows={3} value={other} onChange={(e) => setOther(e.target.value)} error={otherError} />
              )}
            </>
          )}
        </Stack>
      ) : (
        <Text>Os usuários voltarão a acessar o portal e poderão abrir solicitações via QR Code.</Text>
      )}
    </Dialog>
  );
}
