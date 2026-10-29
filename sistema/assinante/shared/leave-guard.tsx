import { ReactNode, useEffect, useRef, useState } from 'react';
import { Button, Dialog } from '@maglev/ds';

/**
 * Proteção contra perda de dados em formulários (ex.: wizard focado, sem "Cancelar"): com `dirty`, links internos
 * (breadcrumb, logo, notificações…) abrem uma confirmação antes de sair; o fechamento da aba/atualização usa o aviso do
 * navegador. Sem alterações a perder, não pergunta nada. `allow()` libera a saída (ex.: depois de salvar).
 * Não há rascunho: os dados não salvos são descartados.
 */
export interface LeaveGuardOptions {
  /** Textos do modal (padrão: "Sair sem salvar?"). */
  title?: string; subtitle?: string; stayLabel?: string; leaveLabel?: string;
  /** Saída que não perde nada (ex.: criar a OS depois): botão de saída em primário e os dois botões dividem a largura. */
  safeExit?: boolean;
  /** Sem aviso do navegador ao fechar a aba (útil quando nada se perde). */
  noUnloadWarning?: boolean;
}
export function useLeaveGuard(dirty: boolean, opts: LeaveGuardOptions = {}): { allow: () => void; ask: (href: string) => void; dialog: ReactNode } {
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
    if (!opts.noUnloadWarning) window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => { window.removeEventListener('beforeunload', onBeforeUnload); document.removeEventListener('click', onClick, true); };
  }, [dirty]);

  const sz = opts.safeExit ? undefined : 'sm';
  const dialog = target ? (
    <Dialog
      open onClose={() => setTarget(null)} size="sm" className={opts.safeExit ? 'dialog-confirm dialog-actions-fill' : undefined}
      title={opts.title ?? 'Sair sem salvar?'} subtitle={opts.subtitle ?? 'Os dados preenchidos que não foram salvos serão descartados'}
      actions={(
        <>
          <Button size={sz} variant="secondary" onClick={() => setTarget(null)}>{opts.stayLabel ?? 'Continuar preenchendo'}</Button>
          <Button size={sz} variant={opts.safeExit ? 'primary' : 'destructive'} onClick={() => { allowed.current = true; window.location.href = target; }}>{opts.leaveLabel ?? 'Sair sem salvar'}</Button>
        </>
      )}
    />
  ) : null;

  return { allow: () => { allowed.current = true; }, ask: (href: string) => setTarget(new URL(href, location.href).href), dialog };
}
