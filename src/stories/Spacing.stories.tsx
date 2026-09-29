import type { Meta, StoryObj } from '@storybook/react';

const spacingTokens = [
  { name: '2xs', token: '--spacing-2xs', value: '2px' },
  { name: 'xs',  token: '--spacing-xs',  value: '4px' },
  { name: 'sm',  token: '--spacing-sm',  value: '8px' },
  { name: 'md',  token: '--spacing-md',  value: '16px' },
  { name: 'lg',  token: '--spacing-lg',  value: '24px' },
  { name: 'xl',  token: '--spacing-xl',  value: '32px' },
  { name: '2xl', token: '--spacing-2xl', value: '48px' },
  { name: '3xl', token: '--spacing-3xl', value: '64px' },
  { name: '4xl', token: '--spacing-4xl', value: '96px' },
];

const SpacingStory = () => (
  <div style={{ padding: 32, maxWidth: 720, fontFamily: 'var(--font-body)' }}>
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>Spacing</h2>
    <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 40 }}>
      Escala de espaçamento usada em padding, margin, gap e tamanhos.
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {spacingTokens.map(({ name, token, value }) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 64, fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'monospace' }}>{name}</span>
          <div
            style={{
              height: 28,
              width: `var(${token})`,
              minWidth: 2,
              background: 'var(--color-brand-500)',
              borderRadius: 4,
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{value}</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-disabled)', fontFamily: 'monospace', marginLeft: 4 }}>{token}</span>
        </div>
      ))}
    </div>
  </div>
);

const meta: Meta = { title: 'Foundations/Spacing', component: SpacingStory, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;
export const AllSpacing: Story = { render: () => <SpacingStory /> };
