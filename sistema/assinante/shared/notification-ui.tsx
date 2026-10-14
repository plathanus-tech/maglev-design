import { ReactElement } from 'react';
import {
  IconAlertTriangle, IconBell, IconCalendarClock, IconClipboardCheck, IconClipboardList, IconClipboardPlus, IconFileInvoice, IconMessageCircle,
} from '@tabler/icons-react';
import { Notification } from './data';

/**
 * Ícone do tipo de evento (RF801), compartilhado pelo sino e pela página Notificações. O evento vem do título
 * (a notificação só guarda o `kind`), com o `kind` como alternativa. Sempre neutro: a cor não codifica categoria.
 */
export function eventIcon(n: Pick<Notification, 'title' | 'kind'>): ReactElement {
  const t = n.title.toLowerCase();
  const size = 18;
  if (/or[çc]amento/.test(t)) return <IconFileInvoice size={size} />;
  if (/valida[çc][ãa]o/.test(t)) return <IconClipboardCheck size={size} />;
  if (/complementa|resposta/.test(t)) return <IconMessageCircle size={size} />;
  if (/recorrente|falha|anomalia/.test(t)) return <IconAlertTriangle size={size} />;
  if (n.kind === 'preventiva') return <IconCalendarClock size={size} />;
  if (n.kind === 'solicitacao') return <IconClipboardPlus size={size} />;
  if (n.kind === 'os') return <IconClipboardList size={size} />;
  return <IconBell size={size} />;
}

/** Ícone do evento em caixa neutra (decorativo: o título já diz o evento) */
export const NotificationIcon = ({ n }: { n: Pick<Notification, 'title' | 'kind'> }) => (
  <span className="notif-icon" aria-hidden="true">{eventIcon(n)}</span>
);
