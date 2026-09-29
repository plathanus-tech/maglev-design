import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Toggle } from './Toggle';

const meta: Meta<typeof Toggle> = {
  title: 'Components/Toggle',
  component: Toggle,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Toggle>;

export const Default: Story = {
  render: () => {
    const [on, setOn] = useState(false);
    return <Toggle label={on ? 'Ligado' : 'Desligado'} checked={on} onChange={() => setOn(v => !v)} />;
  },
};

export const Checked: Story = {
  render: () => {
    const [on, setOn] = useState(true);
    return <Toggle label={on ? 'Modo escuro ativo' : 'Modo escuro inativo'} checked={on} onChange={() => setOn(v => !v)} />;
  },
};

export const Disabled: Story = {
  args: { label: 'Recurso indisponível', disabled: true, checked: false },
};

export const DisabledChecked: Story = {
  args: { label: 'Sempre ativo', checked: true, disabled: true },
};

export const AllStates: Story = {
  render: () => {
    const [states, setStates] = useState({ notif: false, dark: true });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Toggle label={states.notif ? 'Notificações ativas' : 'Notificações inativas'} checked={states.notif} onChange={() => setStates(s => ({ ...s, notif: !s.notif }))} />
        <Toggle label={states.dark ? 'Modo escuro' : 'Modo claro'} checked={states.dark} onChange={() => setStates(s => ({ ...s, dark: !s.dark }))} />
        <Toggle label="Desabilitado" disabled checked={false} />
        <Toggle label="Desabilitado ativo" disabled checked />
      </div>
    );
  },
};
