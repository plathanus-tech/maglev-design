import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';

/**
 * Memória da lista (só para "voltar para a lista"): quem sai de uma lista para o detalhe de um registro e clica no BREADCRUMB para voltar
 * cai de novo na lista exatamente onde estava (página, busca, filtros, ordenação e posição de rolagem). Vale só nesse caso:
 * - o detalhe precisa ter sido aberto A PARTIR da lista (o `document.referrer` é a própria lista); chegando por link, notificação, Início ou
 *   depois de passar por um formulário, o breadcrumb abre a lista limpa, como sempre;
 * - abrir a lista pelo menu lateral ou por qualquer outro link também abre limpa (a memória da lista é apagada);
 * - não guarda o caminho percorrido: o destino do breadcrumb continua sendo sempre a lista (regra "breadcrumb estável").
 * Estado fica em sessionStorage (some ao fechar a aba). Em produção, o equivalente é manter o estado da lista na query string.
 */
const PAGE = (location.pathname.split('/').pop() || '').replace(/\?.*$/, '');
const STORE = `maglev.listmem.${PAGE}`;
const RESTORE = 'maglev.listmem.restore';
const MAX_AGE = 15_000;   // o sinal de "restaurar" vale por poucos segundos (o tempo de navegar)
const SCROLL = '__scroll';

const baseOf = (href: string) => href.split('#')[0].split('?')[0].split('/').pop() ?? '';
const referrerPage = (() => { try { return baseOf(new URL(document.referrer).pathname); } catch { return ''; } })();

let restoring = false;
let saved: Record<string, unknown> = {};
try {
  const flag = sessionStorage.getItem(RESTORE) ?? '';
  const [page, at] = flag.split('|');
  restoring = page === PAGE && Date.now() - Number(at) < MAX_AGE;
  if (restoring) saved = JSON.parse(sessionStorage.getItem(STORE) ?? '{}');
  else sessionStorage.removeItem(STORE);   // visita nova: lista limpa
  if (page === PAGE) sessionStorage.removeItem(RESTORE);
} catch { restoring = false; }

// Clique no breadcrumb de um detalhe aberto a partir da lista de destino: pede para restaurar a lista
document.addEventListener('click', (e) => {
  const a = (e.target as Element | null)?.closest?.('nav[aria-label="Breadcrumb"] a[href]');
  if (!a) return;
  const target = baseOf(a.getAttribute('href') ?? '');
  if (target && target === referrerPage) { try { sessionStorage.setItem(RESTORE, `${target}|${Date.now()}`); } catch { /* sem storage */ } }
}, true);

// Posição de rolagem da lista, gravada ao sair
window.addEventListener('pagehide', () => {
  if (!document.querySelector('[data-list-memory]')) return;   // só telas com lista (marcadas por useListState)
  try { const cur = JSON.parse(sessionStorage.getItem(STORE) ?? '{}'); cur[SCROLL] = window.scrollY; sessionStorage.setItem(STORE, JSON.stringify(cur)); } catch { /* sem storage */ }
});

let scrollDone = false;
function restoreScroll() {
  if (scrollDone || !restoring) return;
  const y = Number(saved[SCROLL] ?? 0);
  scrollDone = true;
  if (!y) return;
  let tries = 0;
  const id = window.setInterval(() => {
    tries += 1;
    window.scrollTo(0, y);
    if (Math.abs(window.scrollY - y) < 2 || tries > 30) window.clearInterval(id);   // a lista pode demorar a renderizar: tenta por ~1,5 s
  }, 50);
}

/** `useState` que lembra o valor da lista (ver acima). `field` identifica o campo dentro da tela. */
export function useListState<T>(field: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => (restoring && field in saved ? (saved[field] as T) : typeof initial === 'function' ? (initial as () => T)() : initial));
  useEffect(() => {
    document.body.setAttribute('data-list-memory', '');
    restoreScroll();
  }, []);
  useEffect(() => {
    try { const cur = JSON.parse(sessionStorage.getItem(STORE) ?? '{}'); cur[field] = value; sessionStorage.setItem(STORE, JSON.stringify(cur)); } catch { /* sem storage */ }
  }, [field, value]);
  return [value, setValue];
}

/** Volta para a página 1 quando busca/filtros mudam, mas NÃO na primeira montagem (senão apagaria a página restaurada). */
export function useResetPage(setPage: (n: number) => void, deps: unknown[]) {
  const prev = useRef<string | undefined>(undefined);
  useEffect(() => {
    const key = JSON.stringify(deps);
    if (prev.current === undefined) { prev.current = key; return; }
    if (prev.current !== key) { prev.current = key; setPage(1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
