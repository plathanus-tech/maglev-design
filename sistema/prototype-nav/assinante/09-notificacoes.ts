/** Jornada "Notificações" da Área do assinante: central de notificações e preferências (RF801). */
import type { Journey } from '../config';
import { userIdOf } from '../../assinante/shared/store';

const s = 'assinante/screens';
const v = (id: string, label: string, path: string) => ({ id, label, path: `${s}/${path}` });

export const journeys: Journey[] = [
  {
    id: 'notificacoes',
    label: 'Notificações',
    items: [
      {
        id: 'notificacoes', label: 'RF801 - Central de notificações', path: `${s}/notificacoes.html`,
        variants: [
          v('notificacoes-unread', 'Só não lidas', 'notificacoes.html#state=unread'),
          v('notificacoes-empty', 'Sem notificações', 'notificacoes.html#state=empty'),
        ],
      },
    ],
  },
];
