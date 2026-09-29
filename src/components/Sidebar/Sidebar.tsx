import { ComponentType, ReactNode } from 'react';
import { IconLogout, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Avatar } from '../Avatar/Avatar';
import { cx } from '../../utils/cx';
import styles from './Sidebar.module.css';

export type NavItemDef = {
  id: string;
  label: string;
  icon: ReactNode;
  /**
   * URL de destino. Quando presente, o item é renderizado como link real (`<a>`, ou
   * `linkComponent` quando informado) — preserva Ctrl/Cmd+clique, abrir em nova aba, etc.
   * Sem `href`, o item é um `<button>` (ação local, sem navegação real).
   */
  href?: string;
  /** Mostra ponto de notificação */
  dot?: boolean;
  /** Texto para leitores de tela quando há `dot` (ex.: "Novas notificações"). */
  dotLabel?: string;
};

export type SidebarUser = {
  name: string;
  email?: string;
};

/** Props recebidas pelo componente de link para itens com `href` (compatível com `<a>` nativo). */
export type SidebarLinkProps = {
  href: string;
  className?: string;
  title?: string;
  'aria-label'?: string;
  'aria-current'?: 'page';
  onClick?: () => void;
  children?: ReactNode;
};

export type SidebarProps = {
  /** Itens de navegação. A filtragem por papel/permissão é responsabilidade do produto. */
  items: NavItemDef[];
  /** Logo do produto: `full` (menu aberto) e `icon` (menu recolhido; se omitido, usa `full`). */
  logo: { full: ReactNode; icon?: ReactNode };
  open?: boolean;
  onToggle?: () => void;
  /** `id` do item ativo. */
  activeItem?: string;
  /** Chamado ao clicar em qualquer item (com ou sem `href`) — ex.: fechar o menu no mobile. */
  onNavClick?: (id: string) => void;
  user?: SidebarUser;
  /** Se omitido, o item de saída não é exibido. */
  onLogout?: () => void;
  /** Textos para i18n. */
  labels?: { nav: string; open: string; close: string; logout: string };
  /**
   * Componente de link do roteador da aplicação (ex.: adaptador para o `Link` do React Router
   * ou do Next.js), usado no lugar de `<a>` para itens com `href`. Padrão: `<a>` nativo.
   */
  linkComponent?: ComponentType<SidebarLinkProps>;
};

const DEFAULT_LABELS = {
  nav: 'Navegação principal',
  open: 'Abrir menu',
  close: 'Fechar menu',
  logout: 'Sair',
};

/** Navegação lateral recolhível para áreas logadas (dashboards, painéis administrativos). */
export function Sidebar({
  items,
  logo,
  open = true,
  onToggle,
  activeItem,
  onNavClick,
  user,
  onLogout,
  labels = DEFAULT_LABELS,
  linkComponent,
}: SidebarProps) {
  const LinkTag = linkComponent ?? 'a';
  return (
    <aside className={cx(styles.sidebar, open ? styles.open : styles.closed)}>
      <div className={styles.logoRow}>
        <div className={styles.logoWrap}>{open ? logo.full : (logo.icon ?? logo.full)}</div>
        <button
          className={styles.toggleBtn}
          onClick={onToggle}
          aria-label={open ? labels.close : labels.open}
          aria-expanded={open}
          type="button"
        >
          {open ? <IconChevronLeft size={14} aria-hidden="true" /> : <IconChevronRight size={14} aria-hidden="true" />}
        </button>
      </div>

      <div className={styles.body}>
        <nav className={styles.navList} aria-label={labels.nav}>
          {items.map(item => {
            const isActive = item.id === activeItem;
            const content = (
              <>
                <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
                {open && (
                  <>
                    <span className={styles.navLabel}>{item.label}</span>
                    {item.dot && (
                      <span className={styles.dot} aria-hidden={item.dotLabel ? undefined : true}>
                        {item.dotLabel && <span className={styles.srOnly}>{item.dotLabel}</span>}
                      </span>
                    )}
                  </>
                )}
              </>
            );

            if (item.href) {
              return (
                <LinkTag
                  key={item.id}
                  href={item.href}
                  className={cx(styles.navItem, isActive && styles.navItemActive)}
                  onClick={() => onNavClick?.(item.id)}
                  title={!open ? item.label : undefined}
                  aria-label={!open ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {content}
                </LinkTag>
              );
            }

            return (
              <button
                key={item.id}
                className={cx(styles.navItem, isActive && styles.navItemActive)}
                onClick={() => onNavClick?.(item.id)}
                title={!open ? item.label : undefined}
                aria-label={!open ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                type="button"
              >
                {content}
              </button>
            );
          })}
        </nav>

        <div className={styles.spacer} />

        {(user || onLogout) && (
          <div className={styles.bottomList}>
            <div className={styles.separator} />
            {user && (
              <div className={styles.userRow}>
                <Avatar name={user.name} />
                {open && (
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{user.name}</span>
                    {user.email && <span className={styles.userEmail}>{user.email}</span>}
                  </div>
                )}
              </div>
            )}
            {onLogout && (
              <button
                className={styles.navItem}
                onClick={onLogout}
                title={!open ? labels.logout : undefined}
                aria-label={!open ? labels.logout : undefined}
                type="button"
              >
                <span className={styles.navIcon} aria-hidden="true"><IconLogout size={20} /></span>
                {open && <span className={styles.navLabel}>{labels.logout}</span>}
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
