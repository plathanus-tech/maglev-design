import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { cssVarToHex } from '../tokens/contrast';

/** Hex do token no tema atual; recalcula quando o tema (data-theme) muda. */
function useHex(varName: string): string {
  const [hex, setHex] = useState('');
  useEffect(() => {
    const update = () => setHex(cssVarToHex(varName));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [varName]);
  return hex;
}

// ─── Global Palettes ─────────────────────────────────────────────────────────

const palettes = [
  { name: 'Brand (primária — de --brand-primary)',  prefix: '--color-brand',  steps: ['50','100','200','300','400','500','600','700','800','900','950'] },
  { name: 'Secondary (secundária — de --brand-secondary)', prefix: '--color-secondary', steps: ['50','100','200','300','400','500','600','700','800','900','950'] },
  { name: 'Navy (azul da marca — #051730 = 900, ajustada à mão)', prefix: '--color-navy', steps: ['50','100','200','300','400','500','600','700','800','900','950'] },
  { name: 'Ink (neutros frios do dark mode)', prefix: '--color-ink', steps: ['50','100','200','300','400','500','600','700','800','900','950'] },
  { name: 'Gray',   prefix: '--color-gray',   steps: ['white','50','100','200','300','400','500','600','700','800','900','950'] },
  { name: 'Red',    prefix: '--color-red',    steps: ['50','100','200','300','400','500','600','700','800','900','950'] },
  { name: 'Green',  prefix: '--color-green',  steps: ['50','100','200','300','400','500','600','700','800','900','950'] },
  { name: 'Blue',   prefix: '--color-blue',   steps: ['50','100','200','300','400','500','600','700','800','900','950'] },
  { name: 'Yellow', prefix: '--color-yellow', steps: ['50','100','200','300','400','500','600','700','800','900','950'] },
  { name: 'Orange', prefix: '--color-orange', steps: ['50','100','200','300','400','500','600','700','800','900','950'] },
  { name: 'Indigo', prefix: '--color-indigo', steps: ['50','100','200','300','400','500','600','700','800','900','950'] },
  { name: 'Violet', prefix: '--color-violet', steps: ['50','100','200','300','400','500','600','700','800','900','950'] },
  { name: 'Pink',   prefix: '--color-pink',   steps: ['50','100','200','300','400','500','600','700','800','900','950'] },
];

function Swatch({ varName }: { varName: string }) {
  const hex = useHex(varName);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 64 }}>
      <div style={{ width: 48, height: 48, borderRadius: 8, background: `var(${varName})`, border: '1px solid rgba(0,0,0,.08)', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }} />
      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{varName.replace('--color-', '')}</span>
      <span style={{ fontSize: 10, color: 'var(--color-text-primary)', fontFamily: 'monospace', fontWeight: 500 }}>{hex}</span>
    </div>
  );
}

function PaletteRow({ name, prefix, steps }: { name: string; prefix: string; steps: string[] }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--color-text-primary)' }}>{name}</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {steps.map(step => <Swatch key={step} varName={`${prefix}-${step}`} />)}
      </div>
    </div>
  );
}

// ─── Alias Token Groups ───────────────────────────────────────────────────────

type AliasToken = { name: string; token: string; light: string; dark: string; description: string };
type TokenGroup = { label: string; tokens: AliasToken[] };

const aliasGroups: TokenGroup[] = [
  {
    label: 'Semânticos Maglev (fonte única — os --color-* abaixo apontam para estes)',
    tokens: [
      { name: 'background/page',           token: '--background-page',           light: 'Gray/50',    dark: 'Ink/950',  description: 'Fundo da página' },
      { name: 'background/sidebar',        token: '--background-sidebar',        light: 'Navy/900',   dark: 'Navy/900', description: 'Fundo do Sidebar' },
      { name: 'background/surface',        token: '--background-surface',        light: 'Gray/White', dark: 'Ink/900',  description: 'Cards, tabelas, campos' },
      { name: 'background/surface-raised', token: '--background-surface-raised', light: 'Gray/White', dark: 'Ink/900 + Ink/100 4,5%', description: 'Dialog, menus, calendário, toast' },
      { name: 'background/surface-hover',  token: '--background-surface-hover',  light: 'Gray/100',   dark: 'Ink/900 + Ink/100 10%',  description: 'Hover em itens neutros' },
      { name: 'background/selected',       token: '--background-selected',       light: 'Brand/50',   dark: 'Navy/700 60% + Ink/900', description: 'Selecionado / hover de linha / chip de ícone' },
      { name: 'background/stripe',         token: '--background-stripe',         light: 'Gray/50',    dark: 'Ink/900 + Ink/100 3%',   description: 'Linhas alternadas de tabela' },
      { name: 'border/subtle',             token: '--border-subtle',             light: 'Gray/100',   dark: 'Ink/800', description: 'Divisores e contornos de card' },
      { name: 'border/card',               token: '--border-card',               light: 'Gray/200 a 64%',  dark: 'Ink/800', description: 'Contorno de Card, KPI e tabela (separa o branco do fundo)' },
      { name: 'border/control',            token: '--border-control',            light: 'Gray/500',   dark: 'Ink/500', description: 'Borda de campos (≥ 3:1)' },
      { name: 'border/strong',             token: '--border-strong',             light: 'Gray/600',   dark: 'Ink/400', description: 'Campo em hover' },
      { name: 'text/primary',              token: '--text-primary',              light: 'Gray/900',   dark: 'Ink/50',  description: 'Texto principal' },
      { name: 'text/secondary',            token: '--text-secondary',            light: 'Gray/700',   dark: 'Ink/300', description: 'Texto secundário' },
      { name: 'text/tertiary',             token: '--text-tertiary',             light: 'Gray/600',   dark: 'Ink/400', description: 'Texto auxiliar' },
      { name: 'action/primary',            token: '--action-primary',            light: 'Brand/400',  dark: 'Brand/500', description: 'CTA (o laranja é o accent)' },
      { name: 'action/primary-hover',      token: '--action-primary-hover',      light: 'Brand/400 + Brand/500 (50%)', dark: 'Brand/400', description: 'Hover do CTA' },
    ],
  },
  {
    label: 'Text',
    tokens: [
      { name: 'text-primary',    token: '--color-text-primary',    light: 'Gray/900',   dark: 'Ink/50',    description: 'Texto principal' },
      { name: 'text-secondary',  token: '--color-text-secondary',  light: 'Gray/700',   dark: 'Ink/300',   description: 'Texto secundário' },
      { name: 'text-tertiary',   token: '--color-text-tertiary',   light: 'Gray/600',   dark: 'Ink/400',   description: 'Label auxiliar' },
      { name: 'text-placeholder', token: '--color-text-placeholder', light: 'Gray/500+600', dark: 'Ink/400', description: 'Placeholder de campos (≥ 4,5:1)' },
      { name: 'text-disabled',   token: '--color-text-disabled',   light: 'Gray/400',   dark: 'Ink/600',   description: 'Texto desativado' },
      { name: 'text-inverse',    token: '--color-text-inverse',    light: 'Gray/50',    dark: 'Ink/900',   description: 'Texto sobre fundo escuro' },
      { name: 'text-brand',      token: '--color-text-brand',      light: 'Brand/500 + 26% preto', dark: 'Brand/400', description: 'Texto da marca (mais escuro no claro, para contraste ≥4,5:1)' },
      { name: 'text-link',       token: '--color-text-link',       light: 'Secondary/400', dark: 'Navy/300', description: 'Links' },
      { name: 'text-link-hover', token: '--color-text-link-hover', light: 'Secondary/500', dark: 'Navy/200',  description: 'Links — hover' },
      { name: 'text-error',      token: '--color-text-error',      light: 'Red/600',    dark: 'Red/400',    description: 'Erros' },
      { name: 'text-success',    token: '--color-text-success',    light: 'Green/700',  dark: 'Green/400',  description: 'Sucesso' },
      { name: 'text-warning',    token: '--color-text-warning',    light: 'Yellow/700', dark: 'Yellow/400', description: 'Aviso' },
    ],
  },
  {
    label: 'Background',
    tokens: [
      { name: 'bg-default',      token: '--color-bg-default',      light: 'Gray/50',    dark: 'Ink/950 (page)',   description: 'Fundo padrão da página' },
      { name: 'bg-subtle',       token: '--color-bg-subtle',       light: 'Gray/100',   dark: 'Ink/900 + Ink/100 10% (surface-hover)',   description: 'Fundo levemente diferenciado' },
      { name: 'bg-surface',      token: '--color-bg-surface',      light: 'Gray/White', dark: 'Ink/900',   description: 'Cards e superfícies' },
      { name: 'bg-disabled',     token: '--color-bg-disabled',     light: 'Gray/200',   dark: 'Ink/800',   description: 'Elementos desativados' },
      { name: 'bg-brand',        token: '--color-bg-brand',        light: 'Brand/50',   dark: 'Navy/700 60% + Ink/900 (selected)',  description: 'Fundo brand suave' },
      { name: 'bg-brand-strong', token: '--color-bg-brand-strong', light: 'Brand/500',  dark: 'Brand/600',  description: 'Fundo brand forte (Checkbox/Toggle marcados)' },
    ],
  },
  {
    label: 'Border',
    tokens: [
      { name: 'border-default',  token: '--color-border-default',  light: 'Gray/600',  dark: 'Ink/400',  description: 'Borda padrão' },
      { name: 'border-subtle',   token: '--color-border-subtle',   light: 'Gray/100',  dark: 'Ink/800',  description: 'Borda discreta' },
      { name: 'border-card',     token: '--color-border-card',     light: 'Gray/200 a 64%', dark: 'Ink/800',  description: 'Contorno de Card/KPI/tabela' },
      { name: 'border-muted',    token: '--color-border-muted',    light: 'Gray/500',  dark: 'Ink/500',  description: 'Borda intermediária (controles)' },
      { name: 'border-disabled', token: '--color-border-disabled', light: 'Gray/300',  dark: 'Ink/700',  description: 'Borda desativada' },
      { name: 'border-focus',    token: '--color-border-focus',    light: 'Brand/600', dark: 'Brand/400', description: 'Foco / outline' },
    ],
  },
  {
    label: 'Action — Primary',
    tokens: [
      { name: 'action-primary',         token: '--color-action-primary',         light: 'Brand/400', dark: 'Brand/500', description: 'Padrão (fundo do Button primary)' },
      { name: 'action-primary-hover',   token: '--color-action-primary-hover',   light: 'Brand/400 + Brand/500 (50%)', dark: 'Brand/400', description: 'Hover' },
      { name: 'action-primary-pressed', token: '--color-action-primary-pressed', light: 'Brand/500', dark: 'Brand/600', description: 'Pressed' },
    ],
  },
  {
    label: 'On action — texto sobre ações primárias',
    tokens: [
      { name: 'on-action-primary',         token: '--color-on-action-primary',         light: 'Secondary/500', dark: 'Navy/950', description: 'Texto do Button primary' },
      { name: 'on-action-primary-hover',   token: '--color-on-action-primary-hover',   light: 'Secondary/500', dark: 'Navy/950', description: 'Hover' },
      { name: 'on-action-primary-pressed', token: '--color-on-action-primary-pressed', light: 'Secondary/500', dark: 'Navy/950', description: 'Pressed' },
    ],
  },
  {
    label: 'Action — Secondary (outline)',
    tokens: [
      { name: 'action-secondary',            token: '--color-action-secondary',            light: 'Secondary/500', dark: 'Secondary/50', description: 'Texto do Button secondary (tonal)' },
      { name: 'action-secondary-bg',         token: '--color-action-secondary-bg',         light: 'Secondary/50',  dark: 'Branco 8% + surface',  description: 'Fundo do Button secondary' },
      { name: 'action-secondary-hover-bg',   token: '--color-action-secondary-hover-bg',   light: 'Secondary/100', dark: 'Branco 14% + surface', description: 'Fundo no hover' },
      { name: 'action-secondary-pressed-bg', token: '--color-action-secondary-pressed-bg', light: 'Secondary/200', dark: 'Branco 20% + surface', description: 'Fundo no pressed' },
    ],
  },
  {
    label: 'Navigation — Sidebar (igual em claro e escuro)',
    tokens: [
      { name: 'nav-bg',            token: '--color-nav-bg',            light: 'Navy/900 (#051730)', dark: 'Navy/900 (#051730)', description: 'Fundo da Sidebar' },
      { name: 'nav-border',        token: '--color-nav-border',        light: 'Navy/800',    dark: 'Navy/800',    description: 'Bordas e separador' },
      { name: 'nav-text',          token: '--color-nav-text',          light: 'Navy/200',    dark: 'Navy/200',    description: 'Texto e ícones' },
      { name: 'nav-text-muted',    token: '--color-nav-text-muted',    light: 'Navy/300',    dark: 'Navy/300',    description: 'E-mail do usuário' },
      { name: 'nav-hover-bg',      token: '--color-nav-hover-bg',      light: 'Navy/800 55% + Navy/900',     dark: 'Navy/800 55% + Navy/900',     description: 'Item em hover' },
      { name: 'nav-active-bg',     token: '--color-nav-active-bg',     light: 'Navy/800', dark: 'Navy/800', description: 'Item ativo' },
      { name: 'nav-active-text',   token: '--color-nav-active-text',   light: 'Gray/White',    dark: 'Gray/White',    description: 'Texto do item ativo' },
      { name: 'nav-active-accent', token: '--color-nav-active-accent', light: 'Brand/500 (único cromático)',     dark: 'Brand/500 (único cromático)',     description: 'Barra do item ativo' },
    ],
  },
  {
    label: 'Action — Destructive',
    tokens: [
      { name: 'action-error',         token: '--color-action-error',         light: 'Red/700', dark: 'Red/300', description: 'Padrão' },
      { name: 'action-error-hover',   token: '--color-action-error-hover',   light: 'Red/800', dark: 'Red/200', description: 'Hover' },
      { name: 'action-error-pressed', token: '--color-action-error-pressed', light: 'Red/900', dark: 'Red/100', description: 'Pressed' },
    ],
  },
  {
    label: 'Action — Warning',
    tokens: [
      { name: 'action-warning',         token: '--color-action-warning',         light: 'Yellow/600', dark: 'Yellow/500', description: 'Padrão' },
      { name: 'action-warning-hover',   token: '--color-action-warning-hover',   light: 'Yellow/700', dark: 'Yellow/400', description: 'Hover' },
      { name: 'action-warning-pressed', token: '--color-action-warning-pressed', light: 'Yellow/800', dark: 'Yellow/300', description: 'Pressed' },
    ],
  },
  {
    label: 'Action — Success',
    tokens: [
      { name: 'action-success',         token: '--color-action-success',         light: 'Green/600', dark: 'Green/500', description: 'Padrão' },
      { name: 'action-success-hover',   token: '--color-action-success-hover',   light: 'Green/700', dark: 'Green/400', description: 'Hover' },
      { name: 'action-success-pressed', token: '--color-action-success-pressed', light: 'Green/800', dark: 'Green/300', description: 'Pressed' },
    ],
  },
  {
    label: 'Status',
    tokens: [
      { name: 'status-success-bg',  token: '--color-status-success-bg',  light: 'Green/50',   dark: 'Green/950',   description: 'Fundo sucesso' },
      { name: 'status-success-fg',  token: '--color-status-success-fg',  light: 'Green/700',  dark: 'Green/400',   description: 'Texto/ícone sucesso' },
      { name: 'status-error-bg',    token: '--color-status-error-bg',    light: 'Red/50',     dark: 'Red/950',     description: 'Fundo erro' },
      { name: 'status-error-fg',    token: '--color-status-error-fg',    light: 'Red/700',    dark: 'Red/400',     description: 'Texto/ícone erro' },
      { name: 'status-warning-bg',  token: '--color-status-warning-bg',  light: 'Yellow/50',  dark: 'Yellow/950',  description: 'Fundo aviso' },
      { name: 'status-warning-fg',  token: '--color-status-warning-fg',  light: 'Yellow/700', dark: 'Yellow/400',  description: 'Texto/ícone aviso' },
      { name: 'status-info-bg',     token: '--color-status-info-bg',     light: 'Blue/50',    dark: 'Blue/950',    description: 'Fundo informação' },
      { name: 'status-info-fg',     token: '--color-status-info-fg',     light: 'Blue/700',   dark: 'Blue/400',    description: 'Texto/ícone informação' },
      { name: 'status-disabled-bg', token: '--color-status-disabled-bg', light: 'Gray/300',   dark: 'Gray/300',    description: 'Fundo desativado' },
      { name: 'status-disabled-fg', token: '--color-status-disabled-fg', light: 'Gray/400',   dark: 'Gray/400',    description: 'Texto/ícone desativado' },
      { name: 'status-orange-bg',   token: '--color-status-orange-bg',   light: 'Orange/50',  dark: 'Orange/950',  description: 'Fundo laranja' },
      { name: 'status-orange-fg',   token: '--color-status-orange-fg',   light: 'Orange/700', dark: 'Orange/400',  description: 'Texto/ícone laranja' },
      { name: 'status-indigo-bg',   token: '--color-status-indigo-bg',   light: 'Indigo/50',  dark: 'Indigo/950',  description: 'Fundo índigo' },
      { name: 'status-indigo-fg',   token: '--color-status-indigo-fg',   light: 'Indigo/700', dark: 'Indigo/400',  description: 'Texto/ícone índigo' },
      { name: 'status-violet-bg',   token: '--color-status-violet-bg',   light: 'Violet/50',  dark: 'Violet/950',  description: 'Fundo violeta' },
      { name: 'status-violet-fg',   token: '--color-status-violet-fg',   light: 'Violet/700', dark: 'Violet/400',  description: 'Texto/ícone violeta' },
      { name: 'status-pink-bg',     token: '--color-status-pink-bg',     light: 'Pink/50',    dark: 'Pink/950',    description: 'Fundo rosa' },
      { name: 'status-pink-fg',     token: '--color-status-pink-fg',     light: 'Pink/700',   dark: 'Pink/400',    description: 'Texto/ícone rosa' },
    ],
  },
];

/** `Brand/500` → `--color-brand-500`. Rótulos livres (ex.: "Branco 14% + nav-bg") não têm amostra de passo. */
function stepVar(label: string): string | null {
  return /^[A-Za-z]+\/(white|\d+)$/i.test(label) ? `--color-${label.toLowerCase().replace('/', '-')}` : null;
}

function AliasRow({ name, token, light, dark, description }: AliasToken) {
  const hex = useHex(token);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '36px 1fr 1.2fr 170px 170px 1fr',
      alignItems: 'center',
      gap: 12,
      padding: '8px 16px',
      borderRadius: 8,
      border: '1px solid var(--color-border-subtle)',
      background: 'var(--color-bg-surface)',
    }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: `var(${token})`, border: '1px solid rgba(0,0,0,.1)', flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text-primary)', fontWeight: 500 }}>{name}</span>
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-tertiary)' }}>
        {token} <strong style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{hex}</strong>
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {stepVar(light) && <div style={{ width: 14, height: 14, borderRadius: 3, background: `var(${stepVar(light)})`, border: '1px solid rgba(0,0,0,.1)', flexShrink: 0 }} />}
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-brand)' }}>{light}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {stepVar(dark) && <div style={{ width: 14, height: 14, borderRadius: 3, background: `var(${stepVar(dark)})`, border: '1px solid rgba(0,0,0,.1)', flexShrink: 0 }} />}
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-tertiary)' }}>{dark}</span>
      </div>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{description}</span>
    </div>
  );
}

// ─── Stories ──────────────────────────────────────────────────────────────────

const GlobalColorsStory = () => (
  <div style={{ padding: 32, maxWidth: 900 }}>
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>Global Tokens — Paletas</h2>
    <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 40 }}>
      Valores brutos de cor. Use sempre os alias tokens nos componentes; reserve estes apenas para criar novos alias tokens.
    </p>
    {palettes.map(p => <PaletteRow key={p.name} {...p} />)}
  </div>
);

const AliasTokensStory = () => (
  <div style={{ padding: 32, maxWidth: 1100, fontFamily: 'var(--font-body)' }}>
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>Alias Tokens — Cores</h2>
    <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
      Tokens semânticos que referenciam os global tokens. As colunas <strong>Light</strong> e <strong>Dark</strong> mostram qual global token é usado em cada modo.
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1.2fr 170px 170px 1fr', gap: 12, padding: '8px 16px', marginBottom: 8 }}>
      <div />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Token</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>CSS Var</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-brand)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>☀ Light</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>☾ Dark</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Descrição</span>
    </div>
    {aliasGroups.map(({ label, tokens }) => (
      <div key={label} style={{ marginBottom: 36 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 10, marginTop: 0 }}>{label}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tokens.map(t => <AliasRow key={t.token} {...t} />)}
        </div>
      </div>
    ))}
  </div>
);

const meta: Meta = { title: 'Foundations/Colors', component: GlobalColorsStory, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

export const GlobalTokens: Story = { render: () => <GlobalColorsStory /> };
export const AliasTokens: Story = { render: () => <AliasTokensStory /> };
