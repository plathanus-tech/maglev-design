import type { Meta, StoryObj } from '@storybook/react';
import { IconCooker, IconHome } from '@tabler/icons-react';
import { Breadcrumb } from './Breadcrumb';

const meta: Meta<typeof Breadcrumb> = {
  title: 'Components/Breadcrumb',
  component: Breadcrumb,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Breadcrumb>;

export const Default: Story = {
  args: {
    items: [
      { label: 'Home', href: '#' },
      { label: 'Equipamentos', href: '#' },
      { label: 'Forno combinado 01' },
    ],
  },
};

export const WithIcon: Story = {
  args: {
    items: [
      { label: 'Home', href: '#' },
      { label: 'Restaurantes', href: '#' },
      { label: 'Forno combinado 01', icon: <IconCooker size={16} /> },
    ],
  },
};

export const LongPath: Story = {
  args: {
    items: [
      { label: 'Home', href: '#' },
      { label: 'Restaurantes', href: '#' },
      { label: 'Cantina Dona Rosa', href: '#' },
      { label: 'Unidade Centro', href: '#' },
      { label: 'Forno combinado 01', icon: <IconCooker size={16} /> },
    ],
  },
};

export const TwoItems: Story = {
  args: {
    items: [
      { label: 'Home', href: '#' },
      { label: 'Chamados' },
    ],
  },
};

export const OneItem: Story = {
  args: {
    items: [
      { label: 'Home', icon: <IconHome size={16} /> },
    ],
  },
};
