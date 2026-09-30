/**
 * Verificação de contraste (WCAG 1.4.3 / 1.4.11) das combinações de foreground/background
 * de tokens de marca realmente usadas pelos componentes. Lê os valores computados no navegador
 * (resolve `var()`/`color-mix()` como o CSS realmente vai renderizar), então reflete qualquer
 * `--brand-primary`/`--brand-secondary` configurado em `brand.css`, em light e dark.
 *
 * Serve como salvaguarda visual no Storybook (ver Foundations/Contraste da marca) — não bloqueia
 * a configuração da marca, apenas sinaliza combinações abaixo do mínimo da WCAG.
 */

export interface ContrastPair {
  /** Onde essa combinação aparece nos componentes. */
  label: string;
  fgVar: string;
  bgVar: string;
  /** Mínimo exigido pela WCAG para este uso (4.5 = texto normal, 3 = texto grande/bordas/ícones). */
  min: number;
}

export interface ContrastResult extends ContrastPair {
  fgColor: string;
  bgColor: string;
  ratio: number;
  pass: boolean;
}

/** Combinações de fg/bg que dependem de tokens de marca e são usadas pelos componentes da Base. */
export const BRAND_CONTRAST_PAIRS: ContrastPair[] = [
  { label: 'Button primary — texto sobre fundo', fgVar: '--color-on-action-primary', bgVar: '--color-action-primary', min: 4.5 },
  { label: 'Button primary — hover', fgVar: '--color-on-action-primary-hover', bgVar: '--color-action-primary-hover', min: 4.5 },
  { label: 'Button primary — pressed', fgVar: '--color-on-action-primary-pressed', bgVar: '--color-action-primary-pressed', min: 4.5 },
  { label: 'Button secondary — texto sobre fundo tonal', fgVar: '--color-action-secondary', bgVar: '--color-action-secondary-bg', min: 4.5 },
  { label: 'Button secondary — hover', fgVar: '--color-action-secondary-hover', bgVar: '--color-action-secondary-hover-bg', min: 4.5 },
  { label: 'Button secondary — pressed', fgVar: '--color-action-secondary-pressed', bgVar: '--color-action-secondary-pressed-bg', min: 4.5 },
  { label: 'Button destructive — texto sobre fundo', fgVar: '--color-on-action-error', bgVar: '--color-action-error', min: 4.5 },
  { label: 'Badge/Avatar brand — texto sobre fundo', fgVar: '--color-text-brand', bgVar: '--color-bg-brand', min: 4.5 },
  { label: 'Sidebar — texto sobre fundo', fgVar: '--color-nav-text', bgVar: '--color-nav-bg', min: 4.5 },
  { label: 'Sidebar — texto do item ativo sobre fundo ativo', fgVar: '--color-nav-active-text', bgVar: '--color-nav-active-bg', min: 4.5 },
  { label: 'Sidebar — borda de destaque do item ativo sobre fundo ativo', fgVar: '--color-nav-active-accent', bgVar: '--color-nav-active-bg', min: 3 },
  { label: 'Sidebar — borda de destaque do item ativo sobre fundo da Sidebar', fgVar: '--color-nav-active-accent', bgVar: '--color-nav-bg', min: 3 },
  { label: 'Placeholder — texto sobre superfície de campo', fgVar: '--color-text-placeholder', bgVar: '--color-bg-surface', min: 4.5 },
  { label: 'Link — texto sobre fundo padrão', fgVar: '--color-text-link', bgVar: '--color-bg-default', min: 4.5 },
  { label: 'Borda de controles sobre superfície (Input, Checkbox…)', fgVar: '--color-border-muted', bgVar: '--color-bg-surface', min: 3 },
  { label: 'Borda de foco sobre superfície', fgVar: '--color-border-focus', bgVar: '--color-bg-surface', min: 3 },
  { label: 'Checkbox/Toggle marcados — ícone/thumb sobre fundo', fgVar: '--color-on-action-primary', bgVar: '--color-bg-brand-strong', min: 3 },
];

/** Resolve uma custom property de cor (var()/color-mix()) para a string computada pelo navegador.
 *  Pode vir como `rgb(...)`, mas tokens gerados via `color-mix(in oklab, ...)` (tokens.css) são
 *  serializados como `oklab(...)` — por isso não damos parse manual aqui, ver `toRgb8`. */
function resolveVarColor(varName: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${varName})`;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return color;
}

/** Normaliza qualquer sintaxe de cor CSS (rgb, oklab, color-mix já resolvido…) para RGB 8-bit,
 *  rasterizando num canvas 1x1 — mais confiável que fazer parse manual da string computada. */
function toRgb8(color: string): [number, number, number] {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [0, 0, 0];
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const [rl, gl, bl] = [toLinear(r), toLinear(g), toLinear(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** Valor hex (#RRGGBB) de um token de cor, já resolvido no tema atual (útil para documentação). */
export function cssVarToHex(varName: string): string {
  const [r, g, b] = toRgb8(resolveVarColor(varName));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Razão de contraste WCAG entre duas cores CSS resolvidas (qualquer sintaxe válida). */
export function contrastRatio(fgColor: string, bgColor: string): number {
  const l1 = relativeLuminance(toRgb8(fgColor));
  const l2 = relativeLuminance(toRgb8(bgColor));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Roda a checagem de contraste no DOM atual (respeita `data-theme` já aplicado). */
export function checkBrandContrast(pairs: ContrastPair[] = BRAND_CONTRAST_PAIRS): ContrastResult[] {
  return pairs.map(pair => {
    const fgColor = resolveVarColor(pair.fgVar);
    const bgColor = resolveVarColor(pair.bgVar);
    const ratio = contrastRatio(fgColor, bgColor);
    return { ...pair, fgColor, bgColor, ratio, pass: ratio >= pair.min };
  });
}
