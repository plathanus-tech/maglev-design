import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';
import { Stack } from '../Stack/Stack';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: { status: { control: 'select', options: ['neutral', 'brand', 'success', 'error', 'warning', 'info'] }, dot: { control: 'boolean' } },
  parameters: { docs: { description: { component: 'Rótulo de estado ou categoria. Não é clicável. Em tabelas, use `type: "badge"` na coluna.' } } },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = { args: { children: 'Rascunho' } };

export const AllStatuses: Story = {
  render: () => (
    <Stack direction="horizontal" gap="sm" wrap>
      <Badge>Neutro</Badge>
      <Badge status="brand">Destaque</Badge>
      <Badge status="success" dot>Ativo</Badge>
      <Badge status="error" dot>Inativo</Badge>
      <Badge status="warning" dot>Pendente</Badge>
      <Badge status="info" dot>Novo</Badge>
    </Stack>
  ),
};
