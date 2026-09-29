import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { IconLayoutDashboard, IconUsers, IconFileText, IconSettings } from '@tabler/icons-react';
import { Sidebar, NavItemDef } from './Sidebar';
import { Card } from '../Card/Card';
import { Stack } from '../Stack/Stack';

const items: NavItemDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconLayoutDashboard size={20} /> },
  { id: 'users',     label: 'Usuários',  icon: <IconUsers size={20} />, dot: true, dotLabel: 'Novos usuários' },
  { id: 'reports',   label: 'Relatórios', icon: <IconFileText size={20} /> },
  { id: 'settings',  label: 'Configurações', icon: <IconSettings size={20} /> },
];

/** A Sidebar é sempre navy (secundária): usa as versões claras da logo em ambos os temas.
 *  Menu aberto = wordmark; recolhido = símbolo. */
const logo = {
  full: <img src="maglev-logo-dark.svg" alt="Maglev" />,
  icon: <img src="maglev-symbol-dark.svg" alt="Maglev" />,
};

const user = { name: 'Maria Silva', email: 'maria@exemplo.com' };

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: 'var(--color-bg-default)', overflow: 'hidden' }}>
      {children}
    </div>
  );
}

function Content({ title }: { title: string }) {
  return (
    <main style={{ flex: 1, padding: 'var(--spacing-xl)' }}>
      <Stack gap="lg">
        <h1 style={{ margin: 0, fontSize: 'var(--font-size-2xl)', color: 'var(--color-text-secondary)' }}>{title}</h1>
        <Card title="Conteúdo" subtitle="Área principal da página">Conteúdo de exemplo.</Card>
      </Stack>
    </main>
  );
}

const meta: Meta<typeof Sidebar> = {
  title: 'Components/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Navegação lateral recolhível para áreas logadas. Recebe `items`, `logo` e `user` por props; permissões por papel são aplicadas pelo produto antes de passar `items`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof Sidebar>;

export const Open: Story = {
  render: () => (
    <AppLayout>
      <Sidebar items={items} logo={logo} user={user} onLogout={() => undefined} open activeItem="dashboard" />
      <Content title="Dashboard" />
    </AppLayout>
  ),
};

export const Closed: Story = {
  render: () => (
    <AppLayout>
      <Sidebar items={items} logo={logo} user={user} onLogout={() => undefined} open={false} activeItem="dashboard" />
      <Content title="Dashboard" />
    </AppLayout>
  ),
};

export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    const [active, setActive] = useState('dashboard');
    const current = items.find(i => i.id === active)?.label ?? '';
    return (
      <AppLayout>
        <Sidebar
          items={items} logo={logo} user={user} onLogout={() => undefined}
          open={open} onToggle={() => setOpen(o => !o)} activeItem={active} onNavClick={setActive}
        />
        <Content title={current} />
      </AppLayout>
    );
  },
};

const itemsWithHref: NavItemDef[] = items.map(i => ({ ...i, href: `/${i.id}` }));

export const WithRealLinks: Story = {
  name: 'Navegação com links reais',
  parameters: {
    docs: {
      description: {
        story:
          'Itens com `href` são renderizados como `<a>` de verdade (Ctrl/Cmd+clique abre em nova aba, "copiar link" funciona etc.). ' +
          'Para usar o componente de rota da sua aplicação (React Router, Next.js…), passe um adaptador em `linkComponent` que receba `href` e o repasse à prop de destino do seu roteador (`to`, `href`…).',
      },
    },
  },
  render: () => (
    <AppLayout>
      <Sidebar items={itemsWithHref} logo={logo} user={user} onLogout={() => undefined} open activeItem="dashboard" />
      <Content title="Dashboard" />
    </AppLayout>
  ),
};
