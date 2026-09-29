import type { Meta, StoryObj } from '@storybook/react';

const breakpoints = [
  { name: 'Mobile',  size: '< 480px',  cols: 4,  gutter: '16px', margin: '16px' },
  { name: 'Tablet',  size: '480–768px', cols: 8,  gutter: '16px', margin: '24px' },
  { name: 'Desktop', size: '768–1280px',cols: 12, gutter: '24px', margin: '32px' },
  { name: 'Wide',    size: '> 1280px',  cols: 12, gutter: '24px', margin: '48px' },
];

function GridPreview({ cols, gutter }: { cols: number; gutter: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: gutter, width: '100%' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} style={{
          height: 40,
          background: 'var(--color-brand-100)',
          border: '1px solid var(--color-brand-300)',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontFamily: 'monospace',
          color: 'var(--color-brand-700)',
        }}>
          {i + 1}
        </div>
      ))}
    </div>
  );
}

const GridStory = () => (
  <div style={{ padding: 32, maxWidth: 960, fontFamily: 'var(--font-body)' }}>
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>Grid</h2>
    <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 40 }}>
      Sistema de grid responsivo com colunas, gutter e margens por breakpoint.
    </p>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
      {breakpoints.map(({ name, size, cols, gutter, margin }) => (
        <div key={name}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{name}</h3>
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{size}</span>
          </div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
            {[
              { label: 'Colunas', value: String(cols) },
              { label: 'Gutter',  value: gutter },
              { label: 'Margem',  value: margin },
            ].map(({ label, value }) => (
              <div key={label} style={{
                padding: '8px 16px',
                background: 'var(--color-bg-subtle)',
                borderRadius: 8,
                border: '1px solid var(--color-border-subtle)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: `16px ${margin}`, background: 'var(--color-bg-surface)', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
            <GridPreview cols={cols} gutter={gutter} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const meta: Meta = { title: 'Foundations/Grid', component: GridStory, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;
export const AllBreakpoints: Story = { render: () => <GridStory /> };
