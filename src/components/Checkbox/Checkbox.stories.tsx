import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Checkbox } from './Checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: () => {
    const [checked, setChecked] = useState(false);
    return (
      <Checkbox
        label="Aceitar termos de uso"
        checked={checked}
        onChange={() => setChecked(v => !v)}
      />
    );
  },
};

export const Checked: Story = {
  render: () => {
    const [checked, setChecked] = useState(true);
    return (
      <Checkbox
        label="Selecionado"
        checked={checked}
        onChange={() => setChecked(v => !v)}
      />
    );
  },
};

export const Indeterminate: Story = {
  render: () => {
    const [checked, setChecked] = useState(false);
    return (
      <Checkbox
        label="Parcialmente selecionado"
        checked={checked}
        indeterminate={!checked}
        onChange={() => setChecked(v => !v)}
      />
    );
  },
};

export const Disabled: Story = {
  args: { label: 'Desabilitado', disabled: true, checked: false },
};

export const DisabledChecked: Story = {
  args: { label: 'Desabilitado selecionado', disabled: true, checked: true },
};

export const WithError: Story = {
  name: 'Com erro',
  render: () => {
    const [checked, setChecked] = useState(false);
    return (
      <Checkbox
        label="Aceitar termos de uso"
        checked={checked}
        onChange={() => setChecked(v => !v)}
        error="Você precisa aceitar os termos para continuar."
      />
    );
  },
};

export const AllStates: Story = {
  render: () => {
    const [states, setStates] = useState({ a: false, b: true, c: false });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Checkbox label="Desmarcado" checked={states.a} onChange={() => setStates(s => ({ ...s, a: !s.a }))} />
        <Checkbox label="Marcado" checked={states.b} onChange={() => setStates(s => ({ ...s, b: !s.b }))} />
        <Checkbox label="Indeterminado" checked={states.c} indeterminate={!states.c} onChange={() => setStates(s => ({ ...s, c: !s.c }))} />
        <Checkbox label="Desabilitado" disabled />
      </div>
    );
  },
};
