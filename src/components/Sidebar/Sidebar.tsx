import { ComponentType, ReactNode, useEffect, useId, useState } from 'react';
import { IconLogout, IconChevronDown, IconChevronLeft, IconChevronRight, IconMoon, IconSun } from '@tabler/icons-react';
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
  /**
   * Subitens. O item vira um grupo recolhível (accordion): clicar nele só expande/recolhe e a
   * navegação acontece nos subitens (indentados, em fonte menor, ícone opcional). Com o menu recolhido,
   * clicar no grupo abre o menu e expande o grupo. Um nível apenas.
   */
  children?: NavSubItemDef[];
};

/** Subitem de um grupo: mesma identificação e navegação do item; o ícone é opcional. */
export type NavSubItemDef = Pick<NavItemDef, 'id' | 'label' | 'href'> & {
  /** Ícone opcional (use o mesmo tamanho dos itens). Sem ícone, o subitem fica recuado só pelo texto. */
  icon?: ReactNode;
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
  /**
   * Seletor de tema claro/escuro (controle segmentado) no pé do menu. `dark` = tema atual; `onChange` recebe o
   * tema escolhido. Com o menu recolhido, mostra só os ícones. Sem `themeToggle`, o controle não é exibido.
   */
  themeToggle?: { dark: boolean; onChange: (dark: boolean) => void; labels?: { group: string; light: string; dark: string } };
  /** Versão do produto, em texto pequeno no fim do menu (ex.: `v1.0.0`). */
  version?: string;
  /** Textos para i18n. */
  labels?: { nav: string; open: string; close: string; logout: string };
  /**
   * Componente de link do roteador da aplicação (ex.: adaptador para o `Link` do React Router
   * ou do Next.js), usado no lugar de `<a>` para itens com `href`. Padrão: `<a>` nativo.
   */
  linkComponent?: ComponentType<SidebarLinkProps>;
  /**
   * `rail` (padrão): barra lateral recolhível com logo, usuário e saída.
   * `menu`: só a lista de links, em largura total, para o painel de menu mobile aberto abaixo do header
   * (sem logo e sem botão de recolher, que ficam no AppHeader; usuário e saída ficam no pé).
   */
  variant?: 'rail' | 'menu';
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
  themeToggle,
  version,
  labels = DEFAULT_LABELS,
  linkComponent,
  variant = 'rail',
}: SidebarProps) {
  const isMenu = variant === 'menu';
  if (isMenu) open = true;
  const LinkTag = linkComponent ?? 'a';
  const baseId = useId();

  // Grupos abertos. Começa aberto o grupo que contém o item ativo e, ao navegar para um subitem,
  // o grupo dele é aberto (o usuário pode recolher manualmente depois).
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => Object.fromEntries(
    items.filter(i => i.children?.some(c => c.id === activeItem)).map(i => [i.id, true]),
  ));
  useEffect(() => {
    const parent = items.find(i => i.children?.some(c => c.id === activeItem));
    if (parent) setExpanded(e => (e[parent.id] ? e : { ...e, [parent.id]: true }));
  }, [activeItem, items]);

  return (
    <aside className={cx(styles.sidebar, isMenu ? styles.menu : open ? styles.open : styles.closed)}>
      {!isMenu && <div className={styles.logoRow}>
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
      </div>}

      <div className={styles.body}>
        <nav className={styles.navList} aria-label={labels.nav}>
          {items.map(item => {
            const isActive = item.id === activeItem;

            // Grupo recolhível (accordion): só expande/recolhe; a navegação é dos subitens.
            if (item.children?.length) {
              const hasActiveChild = item.children.some(c => c.id === activeItem);
              const isOpen = open && !!expanded[item.id];
              const groupId = `${baseId}-${item.id}`;
              const toggleGroup = () => {
                if (!open) onToggle?.();          // recolhido: abre o menu e expande o grupo
                setExpanded(e => ({ ...e, [item.id]: open ? !e[item.id] : true }));
              };
              return (
                <div key={item.id} className={styles.group}>
                  <button
                    className={cx(styles.navItem, hasActiveChild && styles.navItemParentActive)}
                    onClick={toggleGroup}
                    title={!open ? item.label : undefined}
                    aria-label={!open ? item.label : undefined}
                    aria-expanded={isOpen}
                    aria-controls={isOpen ? groupId : undefined}
                    type="button"
                  >
                    <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
                    {open && (
                      <>
                        <span className={styles.navLabel}>{item.label}</span>
                        <span className={cx(styles.chevron, isOpen && styles.chevronOpen)} aria-hidden="true">
                          <IconChevronDown size={16} />
                        </span>
                      </>
                    )}
                  </button>
                  {isOpen && (
                    <div id={groupId} role="group" aria-label={item.label} className={styles.subList}>
                      {item.children.map(child => {
                        const childActive = child.id === activeItem;
                        const cls = cx(styles.navItem, styles.subItem, !child.icon && styles.subItemPlain, childActive && styles.navItemActive);
                        const label = (
                          <>
                            {child.icon && <span className={styles.navIcon} aria-hidden="true">{child.icon}</span>}
                            <span className={styles.navLabel}>{child.label}</span>
                          </>
                        );
                        return child.href ? (
                          <LinkTag
                            key={child.id}
                            href={child.href}
                            className={cls}
                            onClick={() => onNavClick?.(child.id)}
                            aria-current={childActive ? 'page' : undefined}
                          >
                            {label}
                          </LinkTag>
                        ) : (
                          <button
                            key={child.id}
                            className={cls}
                            onClick={() => onNavClick?.(child.id)}
                            aria-current={childActive ? 'page' : undefined}
                            type="button"
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

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

        {(user || onLogout || themeToggle) && (
          <div className={styles.bottomList}>
            <div className={styles.separator} />
            {(user || themeToggle) && (
              <div className={styles.userGroup}>
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
                {themeToggle && (() => {
                  const t = themeToggle.labels ?? { group: 'Tema', light: 'Claro', dark: 'Escuro' };
                  const seg = (isDark: boolean, label: string, icon: ReactNode) => (
                    <button
                      key={label}
                      className={cx(styles.themeSeg, themeToggle.dark === isDark && styles.themeSegActive)}
                      onClick={() => themeToggle.onChange(isDark)}
                      title={!open ? label : undefined}
                      aria-label={!open ? label : undefined}
                      aria-pressed={themeToggle.dark === isDark}
                      type="button"
                    >
                      <span className={styles.navIcon} aria-hidden="true">{icon}</span>
                      {open && <span>{label}</span>}
                    </button>
                  );
                  return (
                    <div className={styles.themeSwitch} role="group" aria-label={t.group}>
                      {seg(false, t.light, <IconSun size={12} />)}
                      {seg(true, t.dark, <IconMoon size={12} />)}
                    </div>
                  );
                })()}
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
                <span className={styles.navIcon} aria-hidden="true"><IconLogout size={16} /></span>
                {open && <span className={styles.navLabel}>{labels.logout}</span>}
              </button>
            )}
          </div>
        )}

        {version && <span className={styles.version}>{version}</span>}
      </div>
    </aside>
  );
}
