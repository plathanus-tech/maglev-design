import { useRef, useState } from 'react';
import { IconBell } from '@tabler/icons-react';
import { Badge, Button, Popover, Stack, Tooltip } from '@maglev/ds';
import { DevNote } from './dev-notes/DevNote';
import { ACCESS_ALERTS } from './access-security';
import { useSession } from './store';
import { formatDateTime } from './format';
import { Text } from './ui';

/**
 * Notificação de acessos incomuns (política de segurança): só administradores recebem, e só de acessos de outros usuários do Admin
 * (não dos usuários dos assinantes). Cada aviso leva ao Histórico de ações do usuário, onde se reconhece o acesso ou se encerra a sessão.
 * Sai da lista quando o acesso é reconhecido ou a sessão é encerrada.
 */
export function AlertBell() {
  const { db, user: me, profile } = useSession();
  const anchor = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  if (profile?.id !== 'PER-ADM') return null;

  const items = db.accessSessions
    .filter((s) => s.alerts.length > 0 && !s.reviewed && s.status === 'ativa' && s.userId !== me.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const label = items.length ? `Notificações, ${items.length} ${items.length === 1 ? 'acesso com alerta' : 'acessos com alerta'}` : 'Notificações';

  return (
    <DevNote note="Notificação ao administrador quando ocorre um acesso incomum (novo dispositivo, horário atípico, contexto inesperado ou tentativas de senha falhas). Só perfil Administrador recebe, e só de usuários do Admin. O aviso leva ao Histórico de ações do usuário, onde estão as respostas (reconhecer e encerrar a sessão). Horário atípico também gera notificação.">
      <div ref={anchor} className="bell-anchor">
        <Tooltip content="Notificações" placement="bottom">
          <Button variant="ghost" iconOnly className="theme-btn" iconLeft={<IconBell size={16} />} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} />
        </Tooltip>
        {items.length > 0 && <span className="bell-count" aria-hidden="true"><Badge status="error">{items.length}</Badge></span>}
      </div>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} label="Notificações">
        <Stack gap="md">
          <Text>{items.length ? 'Acessos com alerta de segurança' : 'Você não tem notificações'}</Text>
          {items.map((s) => {
            const who = db.adminUsers.find((u) => u.id === s.userId)?.name ?? 'Usuário';
            return (
              <Stack key={s.id} gap="2xs">
                <a className="text-link" href={`usuario.html?id=${s.userId}#historico`}>{s.alerts.map((a) => ACCESS_ALERTS[a].label).join(' · ')}</a>
                <span className="cell-secondary">{`${who} · ${s.device}`}</span>
                <span className="cell-secondary">{formatDateTime(s.at)}</span>
              </Stack>
            );
          })}
        </Stack>
      </Popover>
    </DevNote>
  );
}
