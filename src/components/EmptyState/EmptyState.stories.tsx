import type { Meta, StoryObj } from '@storybook/react';
import { IconInbox } from '@tabler/icons-react';
import { EmptyState } from './EmptyState';
import { Button } from '../Button/Button';

const meta: Meta<typeof EmptyState> = {
  title: 'Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Estado vazio de lista ou seção: explica por que não há dados e oferece o próximo passo.' } } },
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    icon: <IconInbox size={40} />,
    title: 'Nenhum item ainda',
    description: 'Quando você criar o primeiro item, ele aparecerá aqui.',
    action: <Button>Criar item</Button>,
  },
};
