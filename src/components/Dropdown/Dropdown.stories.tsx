import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Dropdown } from './Dropdown';

const options = [
  { label: 'React', value: 'react' },
  { label: 'Vue', value: 'vue' },
  { label: 'Angular', value: 'angular' },
  { label: 'Svelte', value: 'svelte' },
];

const meta: Meta<typeof Dropdown> = {
  title: 'Components/Dropdown',
  component: Dropdown,
  tags: ['autodocs'],
  decorators: [(S) => <div style={{ width: 280, paddingBottom: 200 }}><S /></div>],
};
export default meta;
type Story = StoryObj<typeof Dropdown>;

export const Default: Story = {
  render: () => {
    const [val, setVal] = useState('');
    return <Dropdown options={options} value={val} onChange={setVal} label="Framework" placeholder="Escolha um framework" />;
  },
};

export const WithValue: Story = {
  render: () => {
    const [val, setVal] = useState('react');
    return <Dropdown options={options} value={val} onChange={setVal} aria-label="Framework" placeholder="Escolha um framework" />;
  },
};

export const Disabled: Story = {
  render: () => (
    <Dropdown options={options} disabled placeholder="Indisponível" label="Framework" />
  ),
};

export const WithError: Story = {
  render: () => {
    const [val, setVal] = useState('');
    return (
      <Dropdown
        options={options}
        value={val}
        onChange={setVal}
        label="Framework"
        placeholder="Escolha um framework"
        error="Selecione uma opção para continuar"
      />
    );
  },
};

/** `size="sm"`: campo de 36px com texto de 14px, para filtros de tabela (popover Filtros). Formulários usam o padrão. */
export const CompactFilter: Story = {
  render: () => {
    const [val, setVal] = useState('react');
    return <Dropdown size="sm" options={options} value={val} onChange={setVal} label="Framework" />;
  },
};
