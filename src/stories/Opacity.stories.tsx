import type { Meta, StoryObj } from '@storybook/react';

const opacityTokens = [
  { name: '0',   token: '--opacity-0',   value: '0' },
  { name: '5',   token: '--opacity-5',   value: '0.05' },
  { name: '10',  token: '--opacity-10',  value: '0.10' },
  { name: '20',  token: '--opacity-20',  value: '0.20' },
  { name: '25',  token: '--opacity-25',  value: '0.25' },
  { name: '50',  token: '--opacity-50',  value: '0.50' },
  { name: '75',  token: '--opacity-75',  value: '0.75' },
  { name: '90',  token: '--opacity-90',  value: '0.90' },
  { name: '100', token: '--opacity-100', value: '1' },
];

const OpacityStory = () => (
  <div style={{ padding: 32, maxWidth: 720, fontFamily: 'var(--font-body)' }}>
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>Opacity</h2>
    <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 40 }}>
      Escala de opacidade para sobreposições, estados desativados e efeitos visuais.
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {opacityTokens.map(({ name, token, value }) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ width: 40, fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{name}%</span>
          <div style={{ position: 'relative', width: 200, height: 32, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
              backgroundSize: '12px 12px',
              backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
            }} />
            <div style={{ position: 'absolute', inset: 0, background: 'var(--color-brand-500)', opacity: `var(${token})` }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{value}</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-disabled)', fontFamily: 'monospace' }}>{token}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const meta: Meta = { title: 'Foundations/Opacity', component: OpacityStory, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;
export const AllOpacity: Story = { render: () => <OpacityStory /> };
