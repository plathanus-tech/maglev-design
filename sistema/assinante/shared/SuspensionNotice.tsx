import { useEffect, useState } from 'react';
import { Button, Dialog, Stack } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { ReadField } from '../../admin/shared/ui';
import { useDb as useAdminDb } from '../../admin/shared/store';
import { SUSPENSION_GRACE_DAYS } from '../../admin/shared/data';
import { addDaysIso, daysText, daysUntil, formatDate } from '../../admin/shared/format';
import { useSubSession } from './store';

const SEEN_KEY = 'maglev.v2.suspension.seen';
const read = () => { try { return sessionStorage.getItem(SEEN_KEY); } catch { return null; } };

/**
 * Aviso de inativação prevista, para administradores e gestores do assinante (perfis que decidem pela empresa). Aparece ao entrar
 * enquanto o assinante está Inadimplente dentro do prazo, uma vez por sessão (some ao clicar em Entendi). O que o Admin marca em
 * “Marcar como inadimplente” (7 dias, 💡) é o que alimenta esta janela e o e-mail “Inativação prevista”.
 * Variante do navegador de protótipo: `#state=suspension` abre o aviso com um prazo de demonstração.
 */
export function SuspensionNotice() {
  const { db, user } = useSubSession();
  const admin = useAdminDb();
  const demo = typeof location !== 'undefined' && location.hash.includes('state=suspension');
  const s = admin.subscribers.find((x) => x.id === db.subscriberId);
  const suspendAt = demo ? addDaysIso(SUSPENSION_GRACE_DAYS - 2) : s?.status === 'inadimplente' ? s.suspendAt : undefined;
  const [open, setOpen] = useState(false);
  const eligible = user.profile === 'administrador' || user.profile === 'gestor';

  useEffect(() => { if (suspendAt && eligible && (demo || read() !== suspendAt)) setOpen(true); }, [suspendAt, eligible, demo]);
  if (!open || !suspendAt) return null;

  const left = daysUntil(suspendAt);
  const close = () => { try { sessionStorage.setItem(SEEN_KEY, suspendAt); } catch { /* sem storage */ } setOpen(false); };

  return (
    <Dialog
      open onClose={close} size="md"
      title={left > 0 ? `Regularize seu acesso em até ${daysText(left)}` : left === 0 ? 'Regularize seu acesso hoje' : 'O prazo para regularizar terminou'}
      subtitle={left >= 0 ? `A inativação do ambiente está prevista para ${formatDate(suspendAt)}` : `O ambiente pode ser inativado a qualquer momento, por falta de regularização`}
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={() => { window.location.href = 'mailto:suporte@maglev.com.br'; }}>Falar com o suporte</Button>
          <Button size="sm" onClick={close}>Entendi</Button>
        </>
      )}
    >
      <DevNote note="Aviso ao gestor antes da inativação (pedido do cliente): só administradores e gestores do assinante veem; aparece ao entrar, uma vez por sessão, enquanto houver prazo em curso, e o mesmo conteúdo vai por e-mail (modelo “Inativação prevista”). Os textos descrevem o que acontece ao inativar: acesso bloqueado até a reativação, QR Codes já colados sem abrir solicitações, chamados em andamento congelados, histórico indisponível e nada excluído. O prazo vem do Admin (7 dias, 💡). Sem pagamento na plataforma: a regularização é tratada com o suporte Maglev.">
        <Stack gap="md">
          <ReadField label="O que acontece se não regularizar" value="O acesso de todos os usuários da empresa é bloqueado até o ambiente ser reativado" />
          <ReadField label="QR Codes já colados" value="Deixam de abrir solicitações. Ao ler, a pessoa vê que o serviço está indisponível" />
          <ReadField label="Solicitações e ordens de serviço em andamento" value="Ficam congeladas e o histórico não pode ser consultado enquanto o ambiente estiver inativo" />
          <ReadField label="Seus dados" value="Nada é excluído. Depois da regularização e da reativação, tudo volta como estava, inclusive os mesmos QR Codes" />
        </Stack>
      </DevNote>
    </Dialog>
  );
}
