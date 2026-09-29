import type { Meta, StoryObj } from '@storybook/react';
import * as Tabler from '@tabler/icons-react';
import type { Icon as TablerIcon } from '@tabler/icons-react';

const tablerNames = ["Home","Search","Bell","Settings","User","Mail","Phone","Camera","Heart","Star","Trash","Edit","Plus","Minus","X","Check","ChevronDown","ChevronUp","ChevronLeft","ChevronRight","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Upload","Download","Share","Copy","Eye","EyeOff","Lock","LockOpen","Key","Shield","AlertCircle","AlertTriangle","InfoCircle","CircleCheck","CircleX","HelpCircle","Loader","Refresh","RotateClockwise","FileText","Folder","FolderOpen","Photo","Music","Video","File","Calendar","Clock","MapPin","World","Wifi","Battery","Bluetooth","Sun","Moon","Cloud","Wind","Bolt","Flame","ShoppingCart","CreditCard","CurrencyDollar","Package","Tag","Bookmark","MessageCircle","Message","Send","Inbox","Archive","Menu2","LayoutGrid","List","Layout","LayoutSidebar","Stack2","Bold","Italic","Underline","AlignLeft","AlignCenter","AlignRight"];

const iconList: { name: string; Icon: TablerIcon }[] = tablerNames.map(n => ({
  name: n,
  Icon: (Tabler as unknown as Record<string, TablerIcon>)['Icon' + n],
}));
const Home = Tabler.IconHome;
const Bell = Tabler.IconBell;

const sizes = [16, 20, 24, 32];

const IconsStory = () => (
  <div style={{ padding: 32, fontFamily: 'var(--font-body)' }}>
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>Icons</h2>
    <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
      Biblioteca de ícones única do sistema: <strong>Tabler Icons</strong>. Todos os ícones do projeto devem ser importados de <code style={{ background: 'var(--color-bg-subtle)', padding: '2px 6px', borderRadius: 4 }}>@tabler/icons-react</code> (prefixo <code style={{ background: 'var(--color-bg-subtle)', padding: '2px 6px', borderRadius: 4 }}>Icon</code>).
    </p>
    <a href="https://tabler.io/icons" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--color-text-link)', display: 'inline-block', marginBottom: 40 }}>
      Ver todos os ícones em tabler.io/icons →
    </a>

    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--color-text-primary)' }}>Tamanhos</h3>
    <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginBottom: 48, padding: 24, background: 'var(--color-bg-subtle)', borderRadius: 12 }}>
      {sizes.map(size => (
        <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Home size={size} color="var(--color-text-primary)" />
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-tertiary)' }}>{size}px</span>
        </div>
      ))}
    </div>

    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--color-text-primary)' }}>Biblioteca ({iconList.length} ícones)</h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
      {iconList.map(({ name, Icon }) => (
        <div key={name} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          padding: '16px 8px', borderRadius: 8, border: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-surface)', cursor: 'default',
          transition: 'var(--transition-fast)',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-subtle)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg-surface)')}
        >
          <Icon size={24} color="var(--color-text-primary)" />
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-tertiary)', textAlign: 'center', wordBreak: 'break-word' }}>
            {name}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const meta: Meta = { title: 'Foundations/Icons', component: IconsStory, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;
export const AllIcons: Story = { render: () => <IconsStory /> };
export const Sizes: Story = {
  render: () => (
    <div style={{ padding: 32, fontFamily: 'var(--font-body)' }}>
      <h3 style={{ marginBottom: 24, color: 'var(--color-text-primary)' }}>Tamanhos de ícone</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 32 }}>
        {sizes.map(size => (
          <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Bell size={size} color="var(--color-brand-500)" />
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-tertiary)' }}>{size}px</span>
          </div>
        ))}
      </div>
    </div>
  ),
};
