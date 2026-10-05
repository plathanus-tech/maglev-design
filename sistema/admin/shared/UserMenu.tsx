import { useEffect, useId, useRef, useState } from 'react';
import { IconChevronDown, IconLogout, IconMoon, IconSun } from '@tabler/icons-react';
import { Avatar, Button, Tooltip } from '@maglev/ds';
import { useTheme } from './theme';

/** Alternância direta claro/escuro: só o ícone, com nome acessível e dica indicando a ação. */
export function ThemeButton() {
  const [theme, setTheme] = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Ativar modo claro' : 'Ativar modo escuro';
  return (
    <Tooltip content={label} placement="bottom">
      <Button
        variant="ghost"
        iconOnly
        className="theme-btn"
        iconLeft={dark ? <IconSun size={16} /> : <IconMoon size={16} />}
        aria-label={label}
        onClick={() => setTheme(dark ? 'light' : 'dark')}
      />
    </Tooltip>
  );
}

/**
 * Conta da pessoa logada. Desktop: avatar + nome + seta; mobile (`compact`): só o avatar.
 * Ao abrir: nome, e-mail e “Sair”. Fecha com Esc, clique fora ou ao escolher uma ação.
 */
export function UserMenu({ name, email, compact, onLogout }: { name: string; email: string; compact?: boolean; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="user-menu-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="user-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={compact ? `Conta de ${name}` : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar name={name} size="sm" />
        {!compact && (
          <>
            <span className="user-trigger-name">{name}</span>
            <IconChevronDown size={16} aria-hidden="true" />
          </>
        )}
      </button>
      {open && (
        <div id={menuId} className="user-menu" role="menu" aria-label="Conta">
          <div className="user-menu-info">
            <span className="user-menu-name">{name}</span>
            <span className="user-menu-email">{email}</span>
          </div>
          <div className="user-menu-sep" role="separator" />
          <button type="button" role="menuitem" className="user-menu-item" onClick={() => { setOpen(false); onLogout(); }}>
            <IconLogout size={16} aria-hidden="true" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
