import { KeyboardEvent, ReactNode, useRef, useState } from 'react';
import { IconDotsVertical } from '@tabler/icons-react';
import { Button, Popover, Tooltip } from '@maglev/ds';
import './rowmenu.css';

export interface RowMenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** Ação destrutiva (ex.: Excluir): tom de erro. */
  danger?: boolean;
}

/**
 * Botão ⋮ de uma linha/card que abre um menu (Popover do DS) com as ações secundárias.
 * Sem itens, não renderiza. Fecha ao escolher, com Esc ou clique fora (o Popover devolve o foco ao botão);
 * setas, Home e End navegam entre os itens.
 */
export function RowMenu({ target, items, defaultOpen = false, label, variant = 'ghost', size = 'sm' }: {
  target: string; items: RowMenuItem[]; defaultOpen?: boolean;
  /** Botão de página (ex.: cabeçalho do detalhe): `secondary` + `md`, ao lado da ação principal. */
  variant?: 'ghost' | 'secondary'; size?: 'sm' | 'md';
  /** Nome acessível fixo do botão (ex.: "Ações do equipamento"); sem ele usa "Mais ações de {target}". */
  label?: string;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  if (items.length === 0) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const i = els.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? els.length - 1 : e.key === 'ArrowDown' ? (i + 1) % els.length : (i - 1 + els.length) % els.length;
    els[next]?.focus();
  };

  return (
    <>
      <div ref={anchor}>
        <Tooltip content="Mais ações" placement="left">
          <Button
            variant={variant} size={size} iconOnly iconLeft={<IconDotsVertical size={size === 'md' ? 20 : 16} />} className="row-menu-btn"
            aria-label={label ?? `Mais ações de ${target}`} aria-haspopup="menu" aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          />
        </Tooltip>
      </div>
      <Popover fit open={open} onClose={() => setOpen(false)} anchorRef={anchor} label={label ?? `Ações de ${target}`}>
        <div className="row-menu" role="menu" aria-label={label ?? `Ações de ${target}`} onKeyDown={onKeyDown}>
          {items.map((it) => (
            <Button
              key={it.label} role="menuitem" variant="ghost" size="sm" iconLeft={it.icon}
              className={`btn-menu${it.danger ? ' menu-danger' : ''}`}
              onClick={() => { setOpen(false); it.onClick(); }}
            >
              {it.label}
            </Button>
          ))}
        </div>
      </Popover>
    </>
  );
}
