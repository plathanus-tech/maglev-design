import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { RadioButton } from './RadioButton';

const options = [
  { label: 'Opção A', value: 'a' },
  { label: 'Opção B', value: 'b' },
  { label: 'Opção C', value: 'c' },
];

const meta: Meta<typeof RadioButton> = {
  title: 'Components/Radio Button',
  component: RadioButton,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof RadioButton>;

export const Default: Story = {
  render: () => {
    const [val, setVal] = useState('a');
    return <RadioButton options={options} name="default" value={val} onChange={setVal} label="Escolha uma opção" />;
  },
};

export const Horizontal: Story = {
  render: () => {
    const [val, setVal] = useState('a');
    return <RadioButton options={options} name="horizontal" value={val} onChange={setVal} orientation="horizontal" label="Orientação horizontal" />;
  },
};

export const Disabled: Story = {
  args: { options, name: 'disabled', value: 'a', disabled: true, label: 'Desabilitado' },
};

export const WithError: Story = {
  name: 'Com erro',
  render: () => {
    const [val, setVal] = useState('a');
    return (
      <RadioButton
        options={options} name="with-error" value={val} onChange={setVal}
        label="Escolha uma opção" error="Selecione uma das opções para continuar."
      />
    );
  },
};
