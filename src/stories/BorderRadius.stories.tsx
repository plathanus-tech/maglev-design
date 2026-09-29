import type { Meta, StoryObj } from '@storybook/react';

const radiusTokens = [
  { name: 'none', token: '--radius-none', value: '0px' },
  { name: 'xs',   token: '--radius-xs',   value: '4px' },
  { name: 'sm',   token: '--radius-sm',   value: '8px' },
  { name: 'md',   token: '--radius-md',   value: '16px' },
  { name: 'lg',   token: '--radius-lg',   value: '24px' },
  { name: 'xl',   token: '--radius-xl',   value: '32px' },
  { name: '2xl',  token: '--radius-2xl',  value: '48px' },
  { name: 'full', token: '--radius-full', value: '9999px' },
];

const RadiusStory = () => (
  <div style={{ padding: 32, maxWidth: 800, fontFamily: 'var(--font-body)' }}>
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>Border Radius</h2>
    <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 40 }}>
      Escala de arredondamento de bordas.
    </p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
      {radiusTokens.map(({ name, token, value }) => (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 80,
              height: 80,
              background: 'var(--color-brand-100)',
              border: '2px solid var(--color-brand-300)',
              borderRadius: `var(${token})`,
            }}
          />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{name}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'monospace' }}>{value}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const meta: Meta = { title: 'Foundations/Border Radius', component: RadiusStory, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;
export const AllRadii: Story = { render: () => <RadiusStory /> };
