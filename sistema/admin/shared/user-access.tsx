import { ReactNode, useState } from 'react';
import { IconCheck, IconLogout } from '@tabler/icons-react';
import { Badge, Button, Checkbox, Dialog, Feedback, Stack, useToast } from '@maglev/ds';
import { DevNote } from './dev-notes/DevNote';
import { AccessSession, AdminUser } from './data';
import { ACCESS_ALERTS, POLICY_TEXT } from './access-security';
import { endSession, markAccessReviewed, useSession } from './store';
import { formatDate, formatDateTime } from './format';
import { ReadField, RowAction, RowActions } from './ui';

const STATUS = { ativa: 'Sessão ativa', encerrada: 'Sessão encerrada', expirada: 'Sessão expirada' } as const;

/**
 * Acessos e sessões de um usuário do Admin, dentro do Histórico de ações do detalhe do usuário: cada login entra na mesma tabela das ações, como
 * uma linha do tipo “Acesso”, com dispositivo, região (no máximo aproximada), situação da sessão e alertas da política de segurança, e com as
 * respostas do administrador (reconhecer o acesso e encerrar a sessão). Devolve as peças que a tabela do histórico usa.
 */
export function useAccessResponse(user: AdminUser | undefined) {
  const toast = useToast();
  const { db, user: me, can } = useSession();
  const [ending, setEnding] = useState<AccessSession | null>(null);
  const [resetPwd, setResetPwd] = useState(true);

  const sessions = user ? db.accessSessions.filter((s) => s.userId === user.id) : [];
  const pending = sessions.filter((s) => s.alerts.length && !s.reviewed && s.status === 'ativa');
  const canRespond = !!user && can('usuarios', 'ativar') && user.id !== me.id;

  /** Selos dos alertas da sessão (vazio quando não há). */
  const alertBadges = (s: AccessSession): ReactNode => s.alerts.map((a) => <Badge key={a} status="warning">{ACCESS_ALERTS[a].label}</Badge>);
  /** Título da linha no histórico: “Acesso ao painel” e, com alerta, o motivo por extenso (“com alerta: novo dispositivo e horário atípico”). */
  const title = (s: AccessSession) => {
    if (!s.alerts.length) return 'Acesso ao painel';
    const names = s.alerts.map((a) => ACCESS_ALERTS[a].label.toLowerCase());
    return `Acesso ao painel com alerta: ${names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : names[0]}`;
  };
  /** Descrição curta do acesso: dispositivo, região aproximada e situação da sessão. */
  const describe = (s: AccessSession) => {
    const who = s.endedBy ? db.adminUsers.find((u) => u.id === s.endedBy)?.name : undefined;
    const ended = s.status === 'encerrada' && s.endedAt ? ` (${who ? `por ${who} em ` : 'em '}${formatDate(s.endedAt)}${s.passwordReset ? ', nova senha pedida' : ''})` : '';
    return `${s.device}${s.region ? ` · ${s.region}` : ''} · ${STATUS[s.status]}${ended}`;
  };

  const actions = (s: AccessSession) => (
    <RowActions>
      {canRespond && s.alerts.length > 0 && !s.reviewed && s.status === 'ativa' && (
        <RowAction icon={<IconCheck size={16} />} label="Reconhecer acesso" target={formatDateTime(s.at)} onClick={() => { markAccessReviewed(s.id); toast.show({ type: 'success', title: 'Acesso reconhecido', message: 'O alerta deixou de aparecer nas notificações.' }); }} />
      )}
      {canRespond && s.status === 'ativa' && (
        <RowAction icon={<IconLogout size={16} />} label="Encerrar sessão" target={formatDateTime(s.at)} onClick={() => { setResetPwd(s.alerts.length > 0); setEnding(s); }} />
      )}
    </RowActions>
  );

  const confirm = () => {
    if (!ending || !user) return;
    endSession(me.id, ending, resetPwd);
    toast.show({ type: 'success', title: 'Sessão encerrada', message: resetPwd ? `A sessão de ${user.name} foi encerrada e será exigida nova senha no próximo acesso.` : `A sessão de ${user.name} foi encerrada.` });
    setEnding(null);
  };

  const banner = pending.length > 0 ? (
    <DevNote note="Alerta de acesso (política de segurança): aparece enquanto houver sessão ativa com alerta ainda não reconhecida; o administrador reconhece o acesso ou encerra a sessão. Os mesmos alertas chegam como notificação aos administradores.">
      <Feedback type="warning" title={pending.length === 1 ? '1 acesso ativo com alerta' : `${pending.length} acessos ativos com alerta`} message="Confira o dispositivo e o horário na lista abaixo. Se não reconhecer o acesso, encerre a sessão" />
    </DevNote>
  ) : null;

  const dialog = ending && user ? (
    <Dialog
      open onClose={() => setEnding(null)} size="sm" className="dialog-confirm"
      title={`Encerrar a sessão de ${user.name}?`}
      subtitle="O usuário será desconectado do painel e precisará entrar novamente"
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={() => setEnding(null)}>Cancelar</Button>
          <Button size="sm" variant="destructive" onClick={confirm}>Encerrar sessão</Button>
        </>
      )}
    >
      <Stack gap="md">
        <ReadField label="Acesso" value={`${formatDateTime(ending.at)} · ${ending.device}`} />
        {ending.alerts.length > 0 && <ReadField label="Alertas" value={<Stack direction="horizontal" gap="xs" wrap>{alertBadges(ending)}</Stack>} />}
        <Checkbox label="Exigir nova senha no próximo acesso" checked={resetPwd} onChange={(e) => setResetPwd(e.target.checked)} />
      </Stack>
    </Dialog>
  ) : null;

  return {
    sessions, banner, dialog, actions, alertBadges, describe, title,
    /** Nota para desenvolvimento da tabela do histórico (acessos e alertas). */
    note: `Histórico de ações + acessos (complemento aos controles de sessão da auditoria): cada login é uma linha do tipo “Acesso”, com dispositivo (lido do navegador) e, se houver, uma região aproximada; não há geolocalização precisa nem monitoramento contínuo. Alertas: novo dispositivo, horário atípico (💡 fora de ${POLICY_TEXT}, a confirmar com o cliente), contexto inesperado (região ou rede diferente do habitual; depende de dados do servidor) e tentativas de senha falhas antes do acesso. Respostas na coluna Ações: Reconhecer acesso e Encerrar sessão (com opção de exigir nova senha), só para quem pode ativar/inativar usuários e nunca na própria conta; cada ação fica no histórico de ações de quem a fez.`,
  };
}
