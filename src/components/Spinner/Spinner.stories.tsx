import type { Meta, StoryObj } from '@storybook/react';
import { Spinner } from './Spinner';
import { Stack } from '../Stack/Stack';

const meta: Meta<typeof Spinner> = {
  title: 'Components/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  argTypes: { size: { control: 'select', options: ['sm', 'md', 'lg'] } },
  parameters: { docs: { description: { component: 'Indicador de carregamento com texto para leitores de tela (`label`).' } } },
};
export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <Stack direction="horizontal" gap="lg" align="center">
      <Spinner size="sm" /><Spinner size="md" /><Spinner size="lg" />
    </Stack>
  ),
};
