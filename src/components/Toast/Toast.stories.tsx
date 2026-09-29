import type { Meta, StoryObj } from '@storybook/react';
import { ToastProvider, useToast } from './Toast';
import { Button } from '../Button/Button';
import { Stack } from '../Stack/Stack';

function Demo() {
  const { show } = useToast();
  return (
    <Stack direction="horizontal" gap="sm" wrap>
      <Button onClick={() => show({ type: 'success', title: 'Salvo', message: 'Alterações salvas com sucesso.' })}>Sucesso</Button>
      <Button variant="destructive" onClick={() => show({ type: 'error', message: 'Não foi possível salvar.' })}>Erro</Button>
      <Button variant="secondary" onClick={() => show({ type: 'info', message: 'Sincronizando…', duration: 0 })}>Fixo (manual)</Button>
    </Stack>
  );
}

const meta: Meta = {
  title: 'Components/Toast',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `Notificação efêmera no canto da tela. Envolva o app com \`<ToastProvider>\` e chame \`useToast().show(...)\`. Para mensagens permanentes na página, use \`Feedback\`.

O tempo de exibição é calculado a partir do texto (\`5000ms + 300ms por palavra\` de \`title\` + \`message\`), para dar tempo de leitura proporcional ao conteúdo. A contagem pausa enquanto o mouse está sobre o toast ou o foco do teclado está em qualquer elemento dentro dele (inclusive um botão de ação como "Desfazer"), e só retoma quando o ponteiro/foco sai. Toasts \`type="error"\` nunca somem sozinhos — precisam do botão de fechar.

⚠️ **Regras de acessibilidade (Toast)**
- Nunca desative \`pauseOnHover\` ou \`pauseOnFocus\` (o comportamento de pausa é interno ao componente e não deve ser contornado por quem consome o Toast).
- Notificações informativas usam \`role="status"\` (herdado do \`Feedback\`). Não mova o foco do teclado forçadamente para o Toast, a menos que seja um aviso crítico de erro.
- Se a mensagem contiver mais de 20 palavras, considere usar um banner estático na página (\`Feedback\`) em vez de um Toast flutuante temporário.`,
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <ToastProvider>
      <Demo />
    </ToastProvider>
  ),
};
