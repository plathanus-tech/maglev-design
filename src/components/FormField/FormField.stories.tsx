import type { Meta, StoryObj } from '@storybook/react';
import { FormField, fieldControlClass } from './FormField';

const meta: Meta<typeof FormField> = {
  title: 'Components/FormField',
  component: FormField,
  tags: ['autodocs'],
  decorators: [(Story) => <div style={{ width: 320 }}><Story /></div>],
  parameters: {
    docs: {
      description: {
        component:
          'Estrutura base de campo: label + controle + mensagem (ajuda/erro/sucesso), com `id`, `aria-describedby` e `aria-invalid` já ligados. `Input`, `Textarea`, `DatePicker` e `Dropdown` já usam FormField. Use-o diretamente só para controles próprios, aplicando `fieldControlClass` no controle para manter o mesmo visual. Atenção: pickers nativos (ex.: o calendário de `type="date"`) são do navegador e não seguem os tokens.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof FormField>;

export const CustomControl: Story = {
  render: () => (
    <FormField label="Horário" helperText="Formato 24h" required>
      {(control) => <input type="time" className={fieldControlClass} {...control} />}
    </FormField>
  ),
};

export const WithError: Story = {
  render: () => (
    <FormField label="Horário" error="Informe um horário válido.">
      {(control) => <input type="time" className={fieldControlClass} {...control} />}
    </FormField>
  ),
};
