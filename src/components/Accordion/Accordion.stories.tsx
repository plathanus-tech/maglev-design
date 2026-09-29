import type { Meta, StoryObj } from '@storybook/react';
import { Accordion } from './Accordion';

const items = [
  { title: 'Como funciona o período de teste?', content: 'Você pode usar todos os recursos gratuitamente por 14 dias, sem precisar informar cartão de crédito.' },
  { title: 'Posso cancelar a qualquer momento?', content: 'Sim. O cancelamento é feito nas configurações da conta e vale a partir do fim do ciclo atual.' },
  { title: 'Como falo com o suporte?', content: 'Envie uma mensagem pelo canal de suporte. O prazo de resposta é de até um dia útil.' },
];

const meta: Meta<typeof Accordion> = {
  title: 'Components/Accordion',
  component: Accordion,
  tags: ['autodocs'],
  decorators: [(Story) => <div style={{ width: 480 }}><Story /></div>],
  parameters: {
    docs: { description: { component: 'Lista de perguntas/seções que expandem e recolhem. Use para FAQ e conteúdo secundário; não para navegação principal.' } },
  },
};
export default meta;
type Story = StoryObj<typeof Accordion>;

export const Default: Story = { args: { items } };
export const DefaultOpen: Story = { args: { items, defaultOpenIndex: [0] } };
export const AllowMultiple: Story = { args: { items, allowMultiple: true, defaultOpenIndex: [0, 1] } };
