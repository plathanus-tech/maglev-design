import { Button, Dialog, useToast } from '@maglev/ds';
import { DevNote } from './dev-notes/DevNote';
import { AdminUser } from './data';
import { logActivity, updateDb, useSession } from './store';
import { Text } from './ui';

/**
 * RF301 - Ativar/inativar usuário do Admin, com confirmação (RGN001).
 * Inativo perde o acesso imediatamente (RGN003); a inativação notifica só os Administradores (RGN006).
 */
export function UserStatusDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const toast = useToast();
  const { user: me } = useSession();
  if (!user) return null;
  const deactivate = user.status !== 'inativo';
  const pending = user.status === 'convite';
  // Quem nunca concluiu o primeiro acesso volta a ter o convite pendente (novo envio) em vez de ficar ativo
  const neverJoined = !user.joinedAt;

  const confirm = () => {
    const today = new Date().toISOString().slice(0, 10);
    updateDb((db) => ({
      ...db,
      adminUsers: db.adminUsers.map((u) => (u.id !== user.id ? u : deactivate ? { ...u, status: 'inativo' } : neverJoined ? { ...u, status: 'convite', invitedAt: today } : { ...u, status: 'ativo' })),
    }));
    logActivity(me.id, 'Usuários', deactivate ? 'inativacao' : 'ativacao', `${deactivate ? 'Inativou' : 'Ativou'} o usuário ${user.name}`);
    toast.show(deactivate
      ? { type: 'success', title: pending ? 'Convite cancelado' : 'Usuário inativado', message: pending ? 'O usuário foi inativado e não poderá ativar a conta com o convite enviado.' : 'O acesso ao painel foi bloqueado. Os administradores foram notificados.' }
      : neverJoined
        ? { type: 'success', title: 'Convite reenviado', message: `Enviamos um novo convite para ${user.email}.` }
        : { type: 'success', title: 'Usuário ativado', message: 'O usuário voltou a ter acesso ao painel com o perfil atual.' });
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm" className="dialog-confirm"
      title={deactivate ? `Inativar ${user.name}?` : `Ativar ${user.name}?`}
      subtitle={deactivate
        ? (pending
          ? 'O convite será cancelado e a pessoa não conseguirá ativar a conta'
          : 'O usuário perderá o acesso ao painel administrativo imediatamente. Seu histórico de ações será mantido')
        : (neverJoined
          ? 'Um novo convite de primeiro acesso será enviado para o e-mail cadastrado'
          : 'O usuário poderá entrar novamente no painel com o e-mail cadastrado')}
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          {deactivate
            ? <DevNote note="RF301-RGN003: o usuário inativo perde o acesso imediatamente (sessões encerradas). RGN006 / CTA003: notificação (plataforma e e-mail) apenas aos usuários com perfil Administrador; a notificação não aparece no modal."><Button size="sm" variant="destructive" onClick={confirm}>Inativar usuário</Button></DevNote>
            : <Button size="sm" onClick={confirm}>{neverJoined ? 'Reenviar convite' : 'Ativar usuário'}</Button>}
        </>
      )}
    />
  );
}
