import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { IconPencil, IconTrash, IconEye, IconDots, IconSearch } from '@tabler/icons-react';
import { Table } from './Table';
import { Button } from '../Button/Button';
import { Input } from '../Input/Input';
import { Dropdown } from '../Dropdown/Dropdown';

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
  { avatar: '', name: 'Forno combinado 01',   category: 'Cocção', price: 'R$ 18.900,00',   stock: '42',  status: 'active',   active: true,  link: 'Ver detalhes' },
  { avatar: '', name: 'Câmara fria 02',    category: 'Refrigeração',   price: 'R$ 24.500,00',    stock: '7',   status: 'warning',  active: false, link: 'Ver detalhes' },
  { avatar: '', name: 'Fritadeira 01',   category: 'Cocção',   price: 'R$ 6.300,00',    stock: '150', status: 'active',   active: true,  link: 'Ver detalhes' },
  { avatar: '', name: 'Máquina de gelo 01',   category: 'Gelo e bebidas',      price: 'R$ 9.800,00',    stock: '0',   status: 'inactive', active: false, link: 'Ver detalhes' },
  { avatar: '', name: 'Coifa 02', category: 'Cocção', price: 'R$ 7.450,00', stock: '5',   status: 'active',   active: true,  link: 'Ver detalhes' },
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
          'Tabela de dados configurada por colunas (`type`: text, link, badge, avatar, toggle, actions). Renderiza dentro de um `Card`. Linhas alternam em escala de cinza: a primeira fica cinza (separando-se do cabeçalho) e a seguinte usa a cor da tabela. Para paginar, use a prop `pagination` (rodapé dentro da tabela, com "Mostrando X–Y de Z" e `Pagination`); sem linhas, exibe um `EmptyState` (personalize com `empty`).',
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
      { key: 'name' as const, label: 'Equipamento' },
      { key: 'category' as const, label: 'Categoria' },
      { key: 'price' as const, label: 'Valor' },
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

    return <Table title="Equipamentos" subtitle={`${data.length} equipamentos da cozinha`} columns={columns} rows={data} />;
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
      { key: 'name' as const, label: 'Equipamento', sortable: true },
      { key: 'category' as const, label: 'Categoria', sortable: true },
      { key: 'price' as const, label: 'Valor', sortable: true },
      { key: 'stock' as const, label: 'Unidades', sortable: true, align: 'right' as const },
      { key: 'status' as const, label: 'Status', type: 'badge' as const, statusMap },
    ];

    return (
      <Table
        title="Equipamentos" subtitle="Clique no cabeçalho para ordenar"
        columns={columns} rows={data} onSort={handleSort} sortKey={sortKey} sortDir={sortDir}
      />
    );
  },
};

export const WithLinks: Story = {
  render: () => {
    const columns = [
      { key: 'name' as const, label: 'Equipamento' },
      { key: 'category' as const, label: 'Categoria' },
      { key: 'link' as const, label: 'Link', type: 'link' as const, onLinkClick: (r: Product) => alert(`Abrir: ${r.name}`) },
      { key: 'status' as const, label: 'Status', type: 'badge' as const, statusMap },
      {
        key: 'name' as const, label: 'Ações', type: 'actions' as const, width: 80,
        actionItems: [{ icon: <IconDots size={16} />, label: 'Mais opções', onClick: (r: Product) => alert(r.name) }],
      },
    ];
    return <Table title="Equipamentos" columns={columns} rows={rows} />;
  },
};

const simpleColumns = [
  { key: 'name' as const, label: 'Equipamento' },
  { key: 'category' as const, label: 'Categoria' },
  { key: 'price' as const, label: 'Valor' },
];

export const Loading: Story = {
  render: () => <Table title="Equipamentos" columns={simpleColumns} rows={[]} loading />,
};

export const Empty: Story = {
  render: () => (
    <Table
      title="Equipamentos" subtitle="Nenhum equipamento cadastrado ainda"
      columns={simpleColumns} rows={[]}
    />
  ),
};

export const EmptyCustom: Story = {
  name: 'Empty personalizado',
  render: () => (
    <Table
      title="Equipamentos" columns={simpleColumns} rows={[]}
      empty={{
        title: 'Nenhum equipamento cadastrado',
        description: 'Cadastre o primeiro equipamento da cozinha para vê-lo aqui.',
        action: <Button>Novo equipamento</Button>,
      }}
    />
  ),
};

/** Paginação no rodapé da tabela: `rows` recebe só a página atual. */
export const WithPagination: Story = {
  render: () => {
    const all = Array.from({ length: 23 }, (_, i) => ({ ...rows[i % rows.length], name: `Equipamento ${i + 1}` }));
    const [page, setPage] = useState(1);
    const pageSize = 5;
    const columns = [
      { key: 'name' as const, label: 'Equipamento' },
      { key: 'category' as const, label: 'Categoria' },
      { key: 'price' as const, label: 'Valor' },
      { key: 'status' as const, label: 'Status', type: 'badge' as const, statusMap },
    ];
    return (
      <Table
        title="Equipamentos"
        columns={columns}
        rows={all.slice((page - 1) * pageSize, page * pageSize)}
        pagination={{ page, pageSize, total: all.length, onPageChange: setPage }}
      />
    );
  },
};

/** Busca e filtro dentro da tabela (`toolbar`), com paginação no rodapé. */
export const WithToolbar: Story = {
  render: () => {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('todos');
    const filtered = rows.filter((r) =>
      r.name.toLowerCase().includes(query.toLowerCase()) && (status === 'todos' || r.status === status));
    const columns = [
      { key: 'name' as const, label: 'Equipamento' },
      { key: 'category' as const, label: 'Categoria' },
      { key: 'status' as const, label: 'Status', type: 'badge' as const, statusMap },
    ];
    return (
      <Table
        title="Equipamentos"
        columns={columns}
        rows={filtered}
        empty={{ title: 'Nenhum equipamento encontrado' }}
        toolbar={(
          <>
            <div style={{ flex: '1 1 calc(var(--spacing-3xl) * 4)' }}>
              <Input type="search" aria-label="Buscar equipamento" placeholder="Buscar equipamento" iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div style={{ flex: '0 0 calc(var(--spacing-3xl) * 3)' }}>
              <Dropdown aria-label="Status" value={status} onChange={setStatus}
                options={[{ label: 'Todos os status', value: 'todos' }, { label: 'Ativo', value: 'active' }, { label: 'Pendente', value: 'warning' }, { label: 'Inativo', value: 'inactive' }]} />
            </div>
          </>
        )}
      />
    );
  },
};
