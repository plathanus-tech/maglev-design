import { useCallback, useEffect, useState } from 'react';

/**
 * Estado de demonstração da tela, lido do hash (`#state=...`).
 * É como o Navegador de Protótipo abre cada variante (erro, obrigatório, etc.).
 * `go` muda o estado E o hash, para o navegador acompanhar a variante ativa;
 * `setState` muda só o estado local (ex.: erro some ao digitar).
 */
export function useHashState<T extends string>(allowed: readonly T[], fallback: T) {
  const read = useCallback((): T => {
    const m = /state=([a-z]+)/.exec(location.hash);
    return m && (allowed as readonly string[]).includes(m[1]) ? (m[1] as T) : fallback;
  }, [allowed, fallback]);

  const [state, setState] = useState<T>(read);

  useEffect(() => {
    const onHash = () => setState(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [read]);

  const go = useCallback((next: T) => {
    if (location.hash === `#state=${next}`) setState(next);
    else location.hash = `state=${next}`;
  }, []);

  return [state, go, setState] as const;
}
