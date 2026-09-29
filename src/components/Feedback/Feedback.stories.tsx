import type { Meta, StoryObj } from '@storybook/react';
import { Feedback } from './Feedback';

const meta: Meta<typeof Feedback> = { title: 'Components/Feedback', component: Feedback, tags: ['autodocs'],
  decorators: [(S) => <div style={{ width: 480 }}><S /></div>] };
export default meta;
type Story = StoryObj<typeof Feedback>;

export const Success: Story = { args: { type: 'success', message: 'Operação realizada com sucesso!' } };
export const Error: Story = { args: { type: 'error', message: 'Algo deu errado. Tente novamente.' } };
export const Warning: Story = { args: { type: 'warning', message: 'Atenção: esta ação não pode ser desfeita.' } };
export const Info: Story = { args: { type: 'info', message: 'Uma atualização está disponível.' } };
export const WithTitle: Story = { args: { type: 'error', title: 'Erro de autenticação', message: 'Suas credenciais são inválidas. Por favor, verifique e tente novamente.' } };
export const Dismissible: Story = { args: { type: 'info', message: 'Clique no X para fechar este aviso.', dismissible: true } };
export const AllTypes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Feedback type="success" title="Sucesso" message="Dados salvos com sucesso." />
      <Feedback type="error" title="Erro" message="Não foi possível processar sua solicitação." />
      <Feedback type="warning" title="Atenção" message="O limite de armazenamento está próximo." />
      <Feedback type="info" title="Informação" message="Sistema em manutenção das 02h às 04h." />
    </div>
  ),
};
