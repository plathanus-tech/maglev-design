import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { Button } from '../components/Button/Button';
import { Card } from '../components/Card/Card';
import { Checkbox } from '../components/Checkbox/Checkbox';
import { DatePicker } from '../components/DatePicker/DatePicker';
import { Dropdown } from '../components/Dropdown/Dropdown';
import { EmptyState } from '../components/EmptyState/EmptyState';
import { Feedback } from '../components/Feedback/Feedback';
import { Input } from '../components/Input/Input';
import { Pagination } from '../components/Pagination/Pagination';
import { Stack } from '../components/Stack/Stack';
import { Table } from '../components/Table/Table';
import { Textarea } from '../components/Textarea/Textarea';

const meta: Meta = {
  title: 'Patterns/Composições',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Exemplos de como COMPOR os componentes existentes para telas comuns. Antes de criar um componente novo, verifique se uma composição destas resolve.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Formulario: Story = {
  name: 'Formulário',
  render: () => {
    const [role, setRole] = useState('');
    const [birth, setBirth] = useState('');
    const [sent, setSent] = useState(false);
    return (
      <div style={{ maxWidth: 480 }}>
        <Card
          title="Novo contato"
          subtitle="Preencha os dados abaixo"
          footer={<><Button variant="ghost">Cancelar</Button><Button onClick={() => setSent(true)}>Salvar</Button></>}
        >
          <Stack gap="md">
            {sent && <Feedback type="success" message="Contato salvo com sucesso." />}
            <Input label="Nome" placeholder="Nome completo" autoComplete="name" required />
            <Input label="E-mail" type="email" autoComplete="email" helperText="Usado para comunicações." />
            <DatePicker label="Data de nascimento" value={birth} onChange={setBirth} autoComplete="bday" showShortcuts={false} />
            <Dropdown
              label="Cargo" value={role} onChange={setRole}
              options={[{ label: 'Analista', value: 'a' }, { label: 'Gerente', value: 'g' }]}
            />
            <Textarea label="Observações" />
            <Checkbox label="Receber novidades por e-mail" />
          </Stack>
        </Card>
      </div>
    );
  },
};

export const Consentimento: Story = {
  name: 'Consentimento e privacidade',
  parameters: {
    docs: {
      description: {
        story:
          'Estrutura recomendada quando o produto pede consentimento: uma escolha por finalidade, itens opcionais desmarcados, explicação junto ao dado pedido e aceitar/recusar com o MESMO peso visual (mesma variante e tamanho). Quais consentimentos são necessários depende do produto: valide com o responsável pelo projeto e o jurídico/DPO.',
      },
    },
  },
  render: () => {
    const [marketing, setMarketing] = useState(false);
    const [analytics, setAnalytics] = useState(false);
    return (
      <div style={{ maxWidth: 480 }}>
        <Card
          title="Suas preferências"
          subtitle="Você pode mudar estas escolhas a qualquer momento em Configurações › Privacidade."
          footer={<><Button variant="secondary">Recusar opcionais</Button><Button variant="secondary">Salvar escolhas</Button></>}
        >
          <Stack gap="md">
            <Input
              label="Telefone (opcional)" type="tel" autoComplete="tel"
              helperText="Usado apenas para avisar sobre mudanças no seu agendamento."
            />
            <Checkbox label="Receber novidades e ofertas por e-mail" checked={marketing} onChange={e => setMarketing(e.target.checked)} />
            <Checkbox label="Permitir medir o uso do produto para melhorias" checked={analytics} onChange={e => setAnalytics(e.target.checked)} />
          </Stack>
        </Card>
      </div>
    );
  },
};

type Row = { name: string; email: string; status: string };
const allRows: Row[] = Array.from({ length: 27 }, (_, i) => ({
  name: `Contato ${i + 1}`, email: `contato${i + 1}@exemplo.com`, status: i % 3 === 0 ? 'off' : 'on',
}));

export const ListaComPaginacao: Story = {
  name: 'Lista com paginação',
  render: () => {
    const [page, setPage] = useState(1);
    const size = 5;
    const pageCount = Math.ceil(allRows.length / size);
    const rows = allRows.slice((page - 1) * size, page * size);
    return (
      <Stack gap="md">
        <Stack direction="horizontal" justify="between" align="center">
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-2xl)' }}>Contatos</h2>
          <Button iconLeft={<IconPlus size={16} />}>Novo contato</Button>
        </Stack>
        <Table
          columns={[
            { key: 'name', label: 'Nome' },
            { key: 'email', label: 'E-mail' },
            { key: 'status', label: 'Status', type: 'badge', statusMap: { on: { label: 'Ativo', status: 'success' }, off: { label: 'Inativo', status: 'neutral' } } },
          ]}
          rows={rows}
          caption="Lista de contatos"
        />
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
      </Stack>
    );
  },
};

export const ListaVazia: Story = {
  name: 'Lista vazia',
  render: () => (
    <Card title="Contatos" padding="none">
      <EmptyState title="Nenhum contato ainda" description="Adicione o primeiro contato para começar." action={<Button iconLeft={<IconPlus size={16} />}>Novo contato</Button>} />
    </Card>
  ),
};
