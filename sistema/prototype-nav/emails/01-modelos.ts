/**
 * Navegador de Protótipo - E-mails transacionais (pré-visualização, fora das jornadas operacionais): emails/screens/emails.html.
 * Cada categoria abre o mesmo modelo, com alternância Desktop/Celular e Exemplo/Variáveis. Nada é enviado no protótipo.
 */
import type { Journey } from '../config';

const p = (t: string) => `emails/screens/emails.html?t=${t}`;

export const journeys: Journey[] = [
  {
    id: 'emails-modelos',
    label: 'Modelos de e-mail',
    items: [
      { id: 'email-nova-os', label: 'Nova OS atribuída', path: p('nova-os') },
      { id: 'email-convite', label: 'Convite de acesso', path: p('convite') },
      { id: 'email-recuperacao', label: 'Recuperação de senha', path: p('recuperacao-senha') },
      { id: 'email-acao-pendente', label: 'Notificação de ação pendente', path: p('acao-pendente') },
      { id: 'email-preventiva-vencida', label: 'Notificação de preventiva vencida', path: p('preventiva-vencida') },
      { id: 'email-atualizacao', label: 'Notificação de atualização', path: p('atualizacao') },
    ],
  },
];
