import { ReactNode, useEffect, useRef, useState } from 'react';
import { Button, Dialog } from '@maglev/ds';

/**
 * Proteção contra perda de dados em formulários (ex.: wizard focado, sem "Cancelar"): com `dirty`, links internos
 * (breadcrumb, logo, notificações…) abrem uma confirmação antes de sair; o fechamento da aba/atualização usa o aviso do
 * navegador. Sem alterações a perder, não pergunta nada. `allow()` libera a saída (ex.: depois de salvar).
 * Não há rascunho: os dados não salvos são descartados.
 */
export function useLeaveGuard(dirty: boolean): { allow: () => void; dialog: ReactNode } {
  const [target, setTarget] = useState<string | null>(null);
  const allowed = useRef(false);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (allowed.current) return; e.preventDefault(); e.returnValue = ''; };
    const onClick = (e: MouseEvent) => {
      if (allowed.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      e.preventDefault();
      setTarget(a.href);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => { window.removeEventListener('beforeunload', onBeforeUnload); document.removeEventListener('click', onClick, true); };
  }, [dirty]);

  const dialog = target ? (
    <Dialog
      open onClose={() => setTarget(null)} size="sm" title="Sair sem salvar?" subtitle="Os dados preenchidos que não foram salvos serão descartados"
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={() => setTarget(null)}>Continuar preenchendo</Button>
          <Button size="sm" variant="destructive" onClick={() => { allowed.current = true; window.location.href = target; }}>Sair sem salvar</Button>
        </>
      )}
    />
  ) : null;

  return { allow: () => { allowed.current = true; }, dialog };
}
