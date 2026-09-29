import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';
import { Button } from '../Button/Button';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  decorators: [(Story) => <div style={{ width: 480 }}><Story /></div>],
  argTypes: { padding: { control: 'select', options: ['none', 'md', 'lg'] } },
  parameters: { docs: { description: { component: 'Superfície que agrupa conteúdo relacionado, com cabeçalho, ações e rodapé opcionais. Use `padding="none"` para tabelas e listas.' } } },
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: { title: 'Resumo da conta', subtitle: 'Dados atualizados hoje', children: 'Conteúdo do cartão.' },
};

export const WithActionsAndFooter: Story = {
  args: {
    title: 'Perfil',
    actions: <Button size="sm" variant="secondary">Editar</Button>,
    children: 'Informações do perfil do usuário.',
    footer: <><Button variant="ghost">Cancelar</Button><Button>Salvar</Button></>,
  },
};
