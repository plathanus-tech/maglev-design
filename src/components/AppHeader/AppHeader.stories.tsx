import type { Meta, StoryObj } from '@storybook/react';
import { AppHeader } from './AppHeader';
import { Button } from '../Button/Button';

const logo = (
  <>
    <img className="logo-light" src="maglev-logo.svg" alt="Maglev" />
    <img className="logo-dark" src="maglev-logo-dark.svg" alt="" aria-hidden="true" />
  </>
);

const meta: Meta<typeof AppHeader> = {
  title: 'Components/AppHeader',
  component: AppHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Barra superior sticky de 60px. Use em telas públicas ou de conteúdo sem Sidebar. A logo é passada por prop (`logo`).',
      },
    },
  },
  argTypes: { align: { control: 'select', options: ['center', 'start'] } },
};
export default meta;
type Story = StoryObj<typeof AppHeader>;

export const Centered: Story = { args: { logo } };

export const WithActions: Story = {
  args: {
    logo,
    align: 'start',
    actions: <Button size="sm" variant="secondary">Entrar</Button>,
  },
};
