import type { Meta, StoryObj } from '@storybook/react';
import { IconDeviceFloppy, IconArrowRight, IconArrowLeft, IconTrash, IconPlus, IconX, IconDownload, IconSearch } from '@tabler/icons-react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'destructive', 'ghost'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    children: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: 'Botão', variant: 'primary', size: 'md' },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const WithIconLeft: Story = {
  args: { children: 'Salvar', variant: 'primary', iconLeft: <IconDeviceFloppy size={16} /> },
};

export const WithIconRight: Story = {
  args: { children: 'Próximo', variant: 'primary', iconRight: <IconArrowRight size={16} /> },
};

export const IconsShowcase: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button variant="primary" iconLeft={<IconDeviceFloppy size={16} />}>Salvar</Button>
      <Button variant="primary" iconRight={<IconArrowRight size={16} />}>Próximo</Button>
      <Button variant="secondary" iconLeft={<IconArrowLeft size={16} />}>Voltar</Button>
      <Button variant="secondary" iconLeft={<IconDownload size={16} />}>Exportar</Button>
      <Button variant="ghost" iconLeft={<IconSearch size={16} />}>Buscar</Button>
      <Button variant="destructive" iconLeft={<IconTrash size={16} />}>Excluir</Button>
    </div>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button iconOnly iconLeft={<IconPlus size={16} />} aria-label="Adicionar" variant="primary" size="sm" />
      <Button iconOnly iconLeft={<IconPlus size={18} />} aria-label="Adicionar" variant="primary" size="md" />
      <Button iconOnly iconLeft={<IconPlus size={20} />} aria-label="Adicionar" variant="primary" size="lg" />
      <Button iconOnly iconLeft={<IconX size={16} />} aria-label="Fechar" variant="ghost" size="sm" />
      <Button iconOnly iconLeft={<IconTrash size={16} />} aria-label="Excluir" variant="destructive" size="sm" />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button variant="primary" disabled>Primary</Button>
        <Button variant="secondary" disabled>Secondary</Button>
        <Button variant="destructive" disabled>Destructive</Button>
        <Button variant="ghost" disabled>Ghost</Button>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button variant="primary">Primary (ativo)</Button>
        <Button variant="secondary">Secondary (ativo)</Button>
        <Button variant="destructive">Destructive (ativo)</Button>
        <Button variant="ghost">Ghost (ativo)</Button>
      </div>
    </div>
  ),
};
