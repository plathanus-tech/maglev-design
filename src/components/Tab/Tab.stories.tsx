import type { Meta, StoryObj } from '@storybook/react';
import { Tab } from './Tab';

const tabs = [
  { label: 'Visão geral', content: <p>Dados gerais do equipamento: modelo, unidade do restaurante e data de instalação.</p> },
  { label: 'Manutenções', content: <p>Histórico de ordens de serviço e manutenções preventivas do equipamento.</p> },
  { label: 'Chamados', content: <p>Solicitações abertas para este equipamento.</p> },
];

const meta: Meta<typeof Tab> = { title: 'Components/Tab', component: Tab, tags: ['autodocs'],
  decorators: [(S) => <div style={{ width: 480 }}><S /></div>] };
export default meta;
type Story = StoryObj<typeof Tab>;

export const Default: Story = { args: { tabs } };
export const SecondTabActive: Story = { args: { tabs, defaultIndex: 1 } };
export const ManyTabs: Story = {
  args: {
    tabs: [
      { label: 'Visão geral', content: <p>Visão geral</p> },
      { label: 'Unidades', content: <p>Unidades do restaurante</p> },
      { label: 'Equipamentos', content: <p>Equipamentos da cozinha</p> },
      { label: 'Chamados', content: <p>Chamados</p> },
      { label: 'Preventivas', content: <p>Planos preventivos</p> },
    ],
  },
};
