import { useEffect, useState } from 'react';

/**
 * Flag "Notas para desenvolvimento" (liga/desliga).
 * O controle vive só no Navegador de Protótipo; as telas apenas leem a flag.
 * Começa desligada: o protótipo fica limpo para demonstração ao cliente.
 * Telas (iframes) e navegador compartilham a origem, então o evento `storage`
 * sincroniza em tempo real.
 */
export const DEV_NOTES_KEY = 'maglev.devNotes.enabled';

export function getDevNotesEnabled(): boolean {
  try { return localStorage.getItem(DEV_NOTES_KEY) === '1'; } catch { return false; }
}

export function setDevNotesEnabled(enabled: boolean) {
  try { localStorage.setItem(DEV_NOTES_KEY, enabled ? '1' : '0'); } catch { /* sem storage */ }
}

export function useDevNotesEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(getDevNotesEnabled);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEV_NOTES_KEY) setEnabled(getDevNotesEnabled());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const set = (v: boolean) => { setDevNotesEnabled(v); setEnabled(v); };
  return [enabled, set];
}
