import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from '../Button/Button';

const meta: Meta<typeof Dialog> = { title: 'Components/Dialog', component: Dialog, tags: ['autodocs'],
  parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj<typeof Dialog>;

type TemplateProps = { title?: string; size?: 'sm' | 'md' | 'lg'; withActions?: boolean };
const Template = ({ title = 'Confirmação', size = 'md', withActions = true }: TemplateProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: 24 }}>
      <Button onClick={() => setOpen(true)}>Abrir Dialog</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} size={size}
        actions={withActions ? <>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="primary" onClick={() => setOpen(false)}>Confirmar</Button>
        </> : undefined}>
        <p>Este é o conteúdo do dialog. Você pode colocar qualquer coisa aqui — formulários, informações ou confirmações.</p>
      </Dialog>
    </div>
  );
};

export const Default: Story = { render: () => <Template /> };
export const Small: Story = { render: () => <Template title="Aviso" size="sm" /> };
export const Large: Story = { render: () => <Template title="Detalhes completos" size="lg" /> };
export const NoActions: Story = { render: () => <Template withActions={false} title="Informação" /> };
export const Destructive: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ padding: 24 }}>
        <Button variant="destructive" onClick={() => setOpen(true)}>Excluir conta</Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Excluir conta" size="sm"
          actions={<>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => setOpen(false)}>Excluir permanentemente</Button>
          </>}>
          <p>Esta ação é irreversível. Todos os seus dados serão excluídos permanentemente.</p>
        </Dialog>
      </div>
    );
  },
};
