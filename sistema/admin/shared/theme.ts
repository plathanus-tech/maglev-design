import { useEffect, useState } from 'react';

/**
 * Tema claro/escuro (tokens do Storybook MAGLEV: `[data-theme="dark"]`).
 * Sem escolha salva, segue o sistema operacional (prefers-color-scheme).
 * A escolha fica em localStorage: telas (iframes) e Navegador de Protótipo compartilham a origem,
 * então o evento `storage` troca o tema de todas as telas abertas ao mesmo tempo.
 */
export type Theme = 'light' | 'dark';
export const THEME_KEY = 'maglev.v2.theme';
const SYSTEM_DARK = '(prefers-color-scheme: dark)';

const stored = (): Theme | null => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch { return null; }
};

export const getTheme = (): Theme => stored() ?? (window.matchMedia(SYSTEM_DARK).matches ? 'dark' : 'light');

export function applyTheme(theme = getTheme()) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function setTheme(theme: Theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* sem storage */ }
  applyTheme(theme);
  window.dispatchEvent(new Event('maglev-theme'));
}

// Aplica antes do primeiro render (evita piscar no tema errado) e acompanha mudanças.
applyTheme();
window.addEventListener('storage', (e) => { if (e.key === THEME_KEY) { applyTheme(); window.dispatchEvent(new Event('maglev-theme')); } });
window.matchMedia(SYSTEM_DARK).addEventListener('change', () => { if (!stored()) { applyTheme(); window.dispatchEvent(new Event('maglev-theme')); } });

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, set] = useState<Theme>(getTheme);
  useEffect(() => {
    const on = () => set(getTheme());
    window.addEventListener('maglev-theme', on);
    return () => window.removeEventListener('maglev-theme', on);
  }, []);
  return [theme, setTheme];
}
