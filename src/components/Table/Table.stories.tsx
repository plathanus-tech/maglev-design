import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { IconPencil, IconTrash, IconEye, IconDots } from '@tabler/icons-react';
import { Table } from './Table';
import { Button } from '../Button/Button';

type Product = {
  avatar:   string;
  name:     string;
  category: string;
  price:    string;
  stock:    string;
  status:   string;
  active:   boolean;
  link:     string;
};

const rows: Product[] = [
  { avatar: '', name: 'Produto Alpha',   category: 'Eletrônicos', price: 'R$ 299,00',   stock: '42',  status: 'active',   active: true,  link: 'Ver detalhes' },
  { avatar: '', name: 'Produto Beta',    category: 'Vestuário',   price: 'R$ 89,90',    stock: '7',   status: 'warning',  active: false, link: 'Ver detalhes' },
  { avatar: '', name: 'Produto Gamma',   category: 'Alimentos',   price: 'R$ 12,50',    stock: '150', status: 'active',   active: true,  link: 'Ver detalhes' },
  { avatar: '', name: 'Produto Delta',   category: 'Livros',      price: 'R$ 49,00',    stock: '0',   status: 'inactive', active: false, link: 'Ver detalhes' },
  { avatar: '', name: 'Produto Epsilon', category: 'Eletrônicos', price: 'R$ 1.299,00', stock: '5',   status: 'active',   active: true,  link: 'Ver detalhes' },
];

const statusMap = {
  active:   { label: 'Ativo',    status: 'success' as const },
  inactive: { label: 'Inativo',  status: 'error'   as const },
  warning:  { label: 'Pendente', status: 'warning' as const },
};

const meta: Meta<typeof Table<Product>> = {
  title: 'Components/Table',
  component: Table,
  tags: ['autodocs'],
  decorators: [(S) => <div style={{ padding: 32 }}><S /></div>],
  parameters: {
    docs: {
      description: {
        component:
          'Tabela de dados configurada por colunas (`type`: text, link, badge, avatar, toggle, actions). Renderiza dentro de um `Card`. Linhas alternam em escala de cinza: a primeira fica cinza (separando-se do cabeçalho) e a seguinte usa a cor da tabela. Para paginar, combine com `Pagination`; sem linhas, exibe um `EmptyState` (personalize com `empty`).',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof Table<Product>>;

export const Default: Story = {
  render: () => {
    const [data, setData] = useState(rows);

    const columns = [
      { key: 'avatar' as const, label: 'Foto', type: 'avatar' as const, nameKey: 'name' as const, width: 60 },
      { key: 'name' as const, label: 'Produto' },
      { key: 'category' as const, label: 'Categoria' },
      { key: 'price' as const, label: 'Preço' },
      { key: 'status' as const, label: 'Status', type: 'badge' as const, statusMap },
      {
        key: 'active' as const,
        label: 'Ativo',
        type: 'toggle' as const,
        width: 80,
        onToggle: (row: Product, value: boolean) =>
          setData(d => d.map(r => r.name === row.name ? { ...r, active: value } : r)),
      },
      {
        key: 'name' as const,
        label: 'Ações',
        type: 'actions' as const,
        width: 120,
        actionItems: [
          { icon: <IconEye size={16} />,    label: 'Visualizar', onClick: (r: Product) => alert(`Ver: ${r.name}`) },
          { icon: <IconPencil size={16} />, label: 'Editar',     onClick: (r: Product) => alert(`Editar: ${r.name}`) },
          { icon: <IconTrash size={16} />, label: 'Excluir',    onClick: (r: Product) => alert(`Excluir: ${r.name}`), danger: true },
        ],
      },
    ];

    return <Table title="Produtos" subtitle={`Mostrando ${data.length} produtos`} columns={columns} rows={data} />;
  },
};

export const Sortable: Story = {
  render: () => {
    const [data, setData] = useState(rows);
    const [sortKey, setSortKey] = useState<keyof Product | undefined>();
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const handleSort = (key: keyof Product) => {
      const dir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
      setSortKey(key); setSortDir(dir);
      setData(d => [...d].sort((a, b) =>
        dir === 'asc'
          ? String(a[key]).localeCompare(String(b[key]))
          : String(b[key]).localeCompare(String(a[key]))
      ));
    };

    const columns = [
      { key: 'name' as const, label: 'Produto', sortable: true },
      { key: 'category' as const, label: 'Categoria', sortable: true },
      { key: 'price' as const, label: 'Preço', sortable: true },
      { key: 'stock' as const, label: 'Estoque', sortable: true, align: 'right' as const },
      { key: 'status' as const, label: 'Status', type: 'badge' as const, statusMap },
    ];

    return (
      <Table
        title="Produtos" subtitle="Clique no cabeçalho para ordenar"
        columns={columns} rows={data} onSort={handleSort} sortKey={sortKey} sortDir={sortDir}
      />
    );
  },
};

export const WithLinks: Story = {
  render: () => {
    const columns = [
      { key: 'name' as const, label: 'Produto' },
      { key: 'category' as const, label: 'Categoria' },
      { key: 'link' as const, label: 'Link', type: 'link' as const, onLinkClick: (r: Product) => alert(`Abrir: ${r.name}`) },
      { key: 'status' as const, label: 'Status', type: 'badge' as const, statusMap },
      {
        key: 'name' as const, label: 'Ações', type: 'actions' as const, width: 80,
        actionItems: [{ icon: <IconDots size={16} />, label: 'Mais opções', onClick: (r: Product) => alert(r.name) }],
      },
    ];
    return <Table title="Produtos" columns={columns} rows={rows} />;
  },
};

const simpleColumns = [
  { key: 'name' as const, label: 'Produto' },
  { key: 'category' as const, label: 'Categoria' },
  { key: 'price' as const, label: 'Preço' },
];

export const Loading: Story = {
  render: () => <Table title="Produtos" columns={simpleColumns} rows={[]} loading />,
};

export const Empty: Story = {
  render: () => (
    <Table
      title="Produtos" subtitle="Nenhum produto cadastrado ainda"
      columns={simpleColumns} rows={[]}
    />
  ),
};

export const EmptyCustom: Story = {
  name: 'Empty personalizado',
  render: () => (
    <Table
      title="Produtos" columns={simpleColumns} rows={[]}
      empty={{
        title: 'Nenhum produto cadastrado',
        description: 'Cadastre o primeiro produto para vê-lo aqui.',
        action: <Button>Novo produto</Button>,
      }}
    />
  ),
};
