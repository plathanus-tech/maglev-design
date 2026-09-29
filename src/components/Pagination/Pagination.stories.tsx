import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Pagination } from './Pagination';

const meta: Meta<typeof Pagination> = {
  title: 'Components/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Navegação entre páginas de listas e tabelas. Compõe `Button`. Não renderiza nada se houver só uma página.' } } },
};
export default meta;
type Story = StoryObj<typeof Pagination>;

export const Default: Story = {
  render: () => {
    const [page, setPage] = useState(6);
    return <Pagination page={page} pageCount={20} onPageChange={setPage} />;
  },
};

export const FewPages: Story = {
  render: () => {
    const [page, setPage] = useState(1);
    return <Pagination page={page} pageCount={4} onPageChange={setPage} />;
  },
};
