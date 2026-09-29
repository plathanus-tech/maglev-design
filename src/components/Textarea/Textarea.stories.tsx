import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from './Textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Components/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  decorators: [(Story) => <div style={{ width: 360 }}><Story /></div>],
  parameters: { docs: { description: { component: 'Campo multilinha. Compõe `FormField` (label, ajuda e erro acessíveis).' } } },
};
export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = { args: { label: 'Mensagem', placeholder: 'Escreva aqui…' } };
export const WithHelper: Story = { args: { label: 'Descrição', helperText: 'Máximo de 500 caracteres.' } };
export const WithError: Story = { args: { label: 'Comentário', error: 'Este campo é obrigatório.', required: true } };
export const Disabled: Story = { args: { label: 'Notas', value: 'Somente leitura', disabled: true, readOnly: true } };
