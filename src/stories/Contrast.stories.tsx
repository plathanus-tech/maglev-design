import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { Badge } from '../components/Badge/Badge';
import { Feedback } from '../components/Feedback/Feedback';
import { checkBrandContrast, ContrastResult } from '../tokens/contrast';

/**
 * Recalcula sempre que a página monta e quando o tema (light/dark, barra de ferramentas do
 * Storybook) muda — assim reflete qualquer edição em `brand.css` sem precisar de passo manual.
 */
function useBrandContrast(): ContrastResult[] {
  const [results, setResults] = useState<ContrastResult[]>([]);

  useEffect(() => {
    const recompute = () => setResults(checkBrandContrast());
    recompute();

    const observer = new MutationObserver(recompute);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return results;
}

function ContrastRow({ result }: { result: ContrastResult }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 90px 90px 100px 90px',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderRadius: 8,
        border: `1px solid ${result.pass ? 'var(--color-border-subtle)' : 'var(--color-status-error-fg)'}`,
        background: 'var(--color-bg-surface)',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{result.label}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 18, height: 18, borderRadius: 4, background: result.fgColor, border: '1px solid rgba(0,0,0,.15)' }} />
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-tertiary)' }}>{result.fgVar.replace('--color-', '').replace('--', '')}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 18, height: 18, borderRadius: 4, background: result.bgColor, border: '1px solid rgba(0,0,0,.15)' }} />
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-tertiary)' }}>{result.bgVar.replace('--color-', '').replace('--', '')}</span>
      </div>

      <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
        {result.ratio.toFixed(2)}:1 <span style={{ color: 'var(--color-text-tertiary)' }}>(mín. {result.min}:1)</span>
      </span>

      <Badge status={result.pass ? 'success' : 'error'} dot>{result.pass ? 'OK' : 'Falha'}</Badge>
    </div>
  );
}

function BrandContrastStory() {
  const results = useBrandContrast();
  const failing = results.filter(r => !r.pass);

  return (
    <div style={{ padding: 32, maxWidth: 900, fontFamily: 'var(--font-body)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>
        Contraste da marca
      </h2>
      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
        Verificação automática das combinações de foreground/background realmente usadas pelos componentes,
        calculada a partir dos tokens computados no navegador — reflete qualquer <code>--brand-primary</code>/
        <code>--brand-secondary</code> configurado em <code>brand.css</code>. Troque o tema (Light/Dark) na
        barra de ferramentas para verificar os dois modos. Esta página é uma salvaguarda visual: não bloqueia
        a configuração da marca, apenas sinaliza o que precisa de ajuste.
      </p>

      {results.length === 0 ? null : failing.length > 0 ? (
        <div style={{ marginBottom: 20 }}>
          <Feedback
            type="error"
            title={`${failing.length} combinação(ões) abaixo do contraste mínimo da WCAG`}
            message={failing.map(f => `"${f.label}": ${f.ratio.toFixed(2)}:1 encontrado, mínimo ${f.min}:1.`).join(' ')}
          />
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <Feedback type="success" message="Todas as combinações verificadas atendem ao contraste mínimo da WCAG para o tema atual." />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 100px 90px', gap: 12, padding: '0 16px', marginBottom: 4 }}>
        {['Combinação', 'Texto/ícone', 'Fundo', 'Contraste', 'Status'].map(h => (
          <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {results.map(r => <ContrastRow key={r.label} result={r} />)}
      </div>
    </div>
  );
}

const meta: Meta = {
  title: 'Foundations/Contraste da marca',
  component: BrandContrastStory,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Salvaguarda de acessibilidade para novas marcas: ao trocar `--brand-primary`/`--brand-secondary` em `brand.css`, ' +
          'esta página recalcula o contraste real das combinações usadas pelos componentes (Button, Badge, Sidebar, bordas de ' +
          'controle, foco) e sinaliza visualmente qualquer uma abaixo do mínimo da WCAG (4.5:1 texto, 3:1 bordas/ícones/elementos ' +
          'gráficos), sem bloquear a configuração.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = { render: () => <BrandContrastStory /> };
