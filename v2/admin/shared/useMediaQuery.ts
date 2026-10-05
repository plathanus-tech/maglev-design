import { useEffect, useState } from 'react';
import { breakpoints } from '@maglev/ds';

/** Abaixo de `--breakpoint-md` (768px): header com menu hambúrguer e tabelas viram cards (padrão Nivelo). */
export const MOBILE_QUERY = `(max-width: ${breakpoints.md - 1}px)`;

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);
