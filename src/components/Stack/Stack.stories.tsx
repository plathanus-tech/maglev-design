import type { Meta, StoryObj } from '@storybook/react';
import { Stack } from './Stack';
import { Button } from '../Button/Button';

const meta: Meta<typeof Stack> = {
  title: 'Components/Stack',
  component: Stack,
  tags: ['autodocs'],
  argTypes: {
    direction: { control: 'select', options: ['vertical', 'horizontal'] },
    gap: { control: 'select', options: ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'] },
    align: { control: 'select', options: ['start', 'center', 'end', 'stretch'] },
    justify: { control: 'select', options: ['start', 'center', 'end', 'between'] },
  },
  parameters: { docs: { description: { component: 'Primitivo de layout com espaçamento por token. Use no lugar de CSS de página com `display:flex; gap`.' } } },
};
export default meta;
type Story = StoryObj<typeof Stack>;

export const Vertical: Story = {
  args: {
    gap: 'md',
    children: <><Button>Primeiro</Button><Button variant="secondary">Segundo</Button><Button variant="ghost">Terceiro</Button></>,
  },
};

export const Horizontal: Story = {
  args: {
    direction: 'horizontal', gap: 'sm', align: 'center',
    children: <><Button variant="ghost">Cancelar</Button><Button>Salvar</Button></>,
  },
};
