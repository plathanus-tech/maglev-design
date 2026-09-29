import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from './Avatar';
import { Stack } from '../Stack/Stack';

const meta: Meta<typeof Avatar> = {
  title: 'Components/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  argTypes: { size: { control: 'select', options: ['sm', 'md', 'lg'] } },
  parameters: { docs: { description: { component: 'Foto de perfil circular; sem imagem (ou se ela falhar) mostra as iniciais do `name`.' } } },
};
export default meta;
type Story = StoryObj<typeof Avatar>;

export const Initials: Story = { args: { name: 'Maria Silva' } };

export const Sizes: Story = {
  render: () => (
    <Stack direction="horizontal" gap="md" align="center">
      <Avatar name="Maria Silva" size="sm" />
      <Avatar name="Maria Silva" size="md" />
      <Avatar name="Maria Silva" size="lg" />
    </Stack>
  ),
};
