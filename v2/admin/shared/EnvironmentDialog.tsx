import { useEffect, useState } from 'react';
import { Button, Dialog, Dropdown, Feedback, Stack, Textarea, useToast } from '@maglev/ds';
import { DevNote } from './dev-notes/DevNote';
import { INACTIVATION_REASONS, InactivationReason, Subscriber, subscriberName } from './data';
import { getSessionUser, logActivity, nowIso, updateDb } from './store';
import { Text } from './ui';
import { requiredMessage } from './format';

/**
 * RF204 - Ativar/inativar ambiente (manual), a partir da listagem (RF201) ou do detalhe (RF203).
 * Inativar: confirmação + motivo; bloqueia usuários e QR Codes; notifica os Administradores do Admin.
 * Ativar: confirmação; o ambiente volta com todos os dados.
 */
export function EnvironmentDialog({ subscriber, onClose }: { subscriber: Subscriber | null; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState<InactivationReason | ''>('');
  const [other, setOther] = useState('');
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
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
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
              message="Usuários e solicitações via QR Code serão bloqueados. Os dados serão mantidos."
            />
          </DevNote>
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
        </Stack>
      ) : (
        <Text>Os usuários voltarão a acessar o portal e poderão abrir solicitações via QR Code.</Text>
      )}
    </Dialog>
  );
}
