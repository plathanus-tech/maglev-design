import type { Meta, StoryObj } from '@storybook/react';

// Derived directly from Figma text styles
// letterSpacing: PERCENT values converted to em (value / 100)
// lineHeight: PERCENT values converted to unitless ratio (value / 100)

type TextStyle = {
  name: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: string;
  lineHeight: number;       // ratio, e.g. 1.1
  letterSpacing: string;    // CSS value, e.g. '-0.02em' or '3px'
};

const textStyles: { category: string; styles: TextStyle[] }[] = [
  {
    category: 'Heading',
    styles: [
      { name: 'Heading/1-XL', fontSize: 128, fontFamily: 'var(--font-display)', fontWeight: 600, fontStyle: 'SemiBold', lineHeight: 1.1,  letterSpacing: '-0.02em' },
      { name: 'Heading/1-L',  fontSize: 96,  fontFamily: 'var(--font-display)', fontWeight: 600, fontStyle: 'SemiBold', lineHeight: 1.1,  letterSpacing: '-0.02em' },
      { name: 'Heading/1-M',  fontSize: 72,  fontFamily: 'var(--font-display)', fontWeight: 600, fontStyle: 'SemiBold', lineHeight: 1.1,  letterSpacing: '-0.02em' },
      { name: 'Heading/2',    fontSize: 56,  fontFamily: 'var(--font-display)', fontWeight: 600, fontStyle: 'SemiBold', lineHeight: 1.1,  letterSpacing: '-0.02em' },
      { name: 'Heading/3',    fontSize: 48,  fontFamily: 'var(--font-display)', fontWeight: 600, fontStyle: 'SemiBold', lineHeight: 1.1,  letterSpacing: '-0.01em' },
      { name: 'Heading/4',    fontSize: 40,  fontFamily: 'var(--font-display)', fontWeight: 600, fontStyle: 'SemiBold', lineHeight: 1.1,  letterSpacing: '-0.01em' },
      { name: 'Heading/5',    fontSize: 32,  fontFamily: 'var(--font-display)', fontWeight: 600, fontStyle: 'SemiBold', lineHeight: 1.1,  letterSpacing: '-0.01em' },
      { name: 'Heading/6',    fontSize: 24,  fontFamily: 'var(--font-display)', fontWeight: 600, fontStyle: 'SemiBold', lineHeight: 1.1,  letterSpacing: '-0.01em' },
    ],
  },
  {
    category: 'Subtitle',
    styles: [
      { name: 'Subtitle/XL', fontSize: 20, fontFamily: 'var(--font-body)', fontWeight: 500, fontStyle: 'Medium', lineHeight: 1.1,  letterSpacing: '0em'     },
      { name: 'Subtitle/L',  fontSize: 18, fontFamily: 'var(--font-body)', fontWeight: 500, fontStyle: 'Medium', lineHeight: 1.1,  letterSpacing: '0em'     },
      { name: 'Subtitle/M',  fontSize: 16, fontFamily: 'var(--font-body)', fontWeight: 500, fontStyle: 'Medium', lineHeight: 1.1,  letterSpacing: '0.01em'  },
      { name: 'Subtitle/S',  fontSize: 14, fontFamily: 'var(--font-body)', fontWeight: 500, fontStyle: 'Medium', lineHeight: 1.1,  letterSpacing: '0.01em'  },
    ],
  },
  {
    category: 'Body',
    styles: [
      { name: 'Body/XXXL', fontSize: 32, fontFamily: 'var(--font-body)', fontWeight: 400, fontStyle: 'Regular', lineHeight: 1.3,  letterSpacing: '0.01em'  },
      { name: 'Body/XXL',  fontSize: 24, fontFamily: 'var(--font-body)', fontWeight: 400, fontStyle: 'Regular', lineHeight: 1.3,  letterSpacing: '0.01em'  },
      { name: 'Body/XL',   fontSize: 20, fontFamily: 'var(--font-body)', fontWeight: 400, fontStyle: 'Regular', lineHeight: 1.5,  letterSpacing: '0.01em'  },
      { name: 'Body/L',    fontSize: 18, fontFamily: 'var(--font-body)', fontWeight: 400, fontStyle: 'Regular', lineHeight: 1.5,  letterSpacing: '0.01em'  },
      { name: 'Body/M',    fontSize: 16, fontFamily: 'var(--font-body)', fontWeight: 400, fontStyle: 'Regular', lineHeight: 1.4,  letterSpacing: '0.01em'  },
      { name: 'Body/S',    fontSize: 14, fontFamily: 'var(--font-body)', fontWeight: 400, fontStyle: 'Regular', lineHeight: 1.4,  letterSpacing: '0.01em'  },
      { name: 'Body/XS',   fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 400, fontStyle: 'Regular', lineHeight: 1.4,  letterSpacing: '0.02em'  },
      { name: 'Body/XXS',  fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 400, fontStyle: 'Regular', lineHeight: 1.4,  letterSpacing: '0.02em'  },
    ],
  },
  {
    category: 'Caption',
    styles: [
      { name: 'Caption/M', fontSize: 14, fontFamily: 'var(--font-body)', fontWeight: 400, fontStyle: 'Regular', lineHeight: 1.4, letterSpacing: '0.01em' },
      { name: 'Caption/S', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 400, fontStyle: 'Regular', lineHeight: 1.4, letterSpacing: '0.02em' },
    ],
  },
  {
    category: 'Button',
    styles: [
      { name: 'Button/XL', fontSize: 24, fontFamily: 'var(--font-display)', fontWeight: 600, fontStyle: 'SemiBold', lineHeight: 1.2, letterSpacing: '0.5px' },
      { name: 'Button/L',  fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 600, fontStyle: 'SemiBold', lineHeight: 1.2, letterSpacing: '0.5px' },
      { name: 'Button/M',  fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, fontStyle: 'SemiBold', lineHeight: 1.5, letterSpacing: '0.5px' },
      { name: 'Button/S',  fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 600, fontStyle: 'SemiBold', lineHeight: 1.7, letterSpacing: '0.5px' },
    ],
  },
];

function StyleRow({ style }: { style: TextStyle }) {
  const { name, fontSize, fontFamily, fontWeight, lineHeight, letterSpacing } = style;
  const previewSize = Math.min(fontSize, 48);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '160px 1fr 80px 80px 90px 80px',
      alignItems: 'center', gap: 16,
      padding: '12px 16px', borderRadius: 8,
      border: '1px solid var(--color-border-subtle)',
      background: 'var(--color-bg-surface)',
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>{name}</div>
        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontFamily: 'monospace', marginTop: 2 }}>{fontFamily} · {style.fontStyle}</div>
      </div>
      <div style={{
        fontFamily: `${fontFamily}, sans-serif`,
        fontSize: previewSize,
        fontWeight,
        lineHeight,
        letterSpacing,
        color: 'var(--color-text-primary)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      }}>
        Design System
      </div>
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{fontSize}px</span>
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{fontWeight}</span>
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>{lineHeight * 100}%</span>
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>{letterSpacing}</span>
    </div>
  );
}

const TypographyStory = () => (
  <div style={{ padding: 32, maxWidth: 1100, fontFamily: 'var(--font-body)' }}>
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>Typography</h2>
    <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 40 }}>
      Fontes controladas por <code>--font-display</code> (títulos, botões, destaques) e <code>--font-body</code> (textos e UI), definidas em <code>brand.css</code>. Cada estilo abaixo é um token em <code>tokens.css</code>: <code>font: var(--text-body-s); letter-spacing: var(--text-body-s-tracking);</code>.
    </p>

    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px 80px 90px 80px', gap: 16, padding: '0 16px', marginBottom: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estilo</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prévia</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Size</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Weight</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Line-h.</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Track.</span>
    </div>

    {textStyles.map(({ category, styles }) => (
      <div key={category} style={{ marginBottom: 40 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>{category}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {styles.map(s => <StyleRow key={s.name} style={s} />)}
        </div>
      </div>
    ))}
  </div>
);

const meta: Meta = { title: 'Foundations/Typography', component: TypographyStory, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;
export const TypeScale: Story = { render: () => <TypographyStory /> };
