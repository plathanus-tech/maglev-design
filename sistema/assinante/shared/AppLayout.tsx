import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  IconBell, IconBuilding, IconBuildingStore, IconCalendarRepeat, IconClipboardList, IconHome2, IconLayoutGrid, IconLock, IconMenu2,
  IconMessageReport, IconMicrowave, IconSettings, IconTruck, IconUsers, IconX,
} from '@tabler/icons-react';
import { AppHeader, Button, Card, EmptyState, NavItemDef, Sidebar, Tooltip } from '@maglev/ds';
import logoFull from '../../../public/maglev-logo-dark.svg';
import logoIcon from '../../../public/maglev-symbol-dark.svg';
import logoLight from '../../../public/maglev-logo.svg';
import logoDark from '../../../public/maglev-logo-dark.svg';
import { PageHeader, mountApp } from '../../admin/shared/AppLayout';
import { ThemeButton, UserMenu } from '../../admin/shared/UserMenu';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { formatDateTime } from '../../admin/shared/format';
import { ScreenKey } from './data';
import { updateSubDb, useSubSession } from './store';
import { GlobalSearch, HelpButton } from './GlobalSearch';

import '../../admin/shared/nav-sync';
import './assinante.css';

/** O cabeçalho de página e a montagem do app são os mesmos do Admin (mesmas decisões de design). */
export { PageHeader, mountApp };

/**
 * Menu principal da Área do Assinante: Início → Equipamentos → Solicitações → OS → Planos → Prestadores → Configurações
 * (Empresa · Unidades · Ambientes · Usuários, RF201-RF204). Itens sem permissão de visualizar ficam ocultos (RF001-RGN004).
 */
type NavEntry = Omit<NavItemDef, 'children'> & { screen: ScreenKey; href?: string; children?: Array<{ id: string; screen: ScreenKey; label: string; href: string; icon: ReactNode }> };
const NAV: NavEntry[] = [
  { id: 'inicio', screen: 'inicio', label: 'Início', icon: <IconHome2 size={16} />, href: 'inicio.html' },
  { id: 'equipamentos', screen: 'equipamentos', label: 'Equipamentos', icon: <IconMicrowave size={16} />, href: 'equipamentos.html' },
  { id: 'solicitacoes', screen: 'solicitacoes', label: 'Solicitações', icon: <IconMessageReport size={16} />, href: 'solicitacoes.html' },
  { id: 'os', screen: 'os', label: 'Ordens de serviço', icon: <IconClipboardList size={16} />, href: 'ordens-servico.html' },
  { id: 'planos', screen: 'planos', label: 'Planos de manutenção', icon: <IconCalendarRepeat size={16} />, href: 'planos.html' },
  { id: 'prestadores', screen: 'prestadores', label: 'Prestadores', icon: <IconTruck size={16} />, href: 'prestadores.html' },
  {
    // Grupo recolhível (accordion): clicar só expande; a navegação é das páginas filhas.
    id: 'configuracoes', screen: 'empresa', label: 'Configurações', icon: <IconSettings size={16} />,
    children: [
      { id: 'empresa', screen: 'empresa', label: 'Empresa', icon: <IconBuilding size={16} />, href: 'empresa.html' },
      { id: 'unidades', screen: 'unidades', label: 'Unidades', icon: <IconBuildingStore size={16} />, href: 'unidades.html' },
      { id: 'ambientes', screen: 'ambientes', label: 'Ambientes', icon: <IconLayoutGrid size={16} />, href: 'ambientes.html' },
      { id: 'equipe', screen: 'equipe', label: 'Usuários', icon: <IconUsers size={16} />, href: 'equipe.html' },
    ],
  },
];

const APP_VERSION = '1.0.0';
const DRAWER_ID = 'app-drawer';
const MENU_BTN_ID = 'app-menu-button';
const SIDEBAR_KEY = 'maglev.v2.sidebar.open';

/** Sino com a quantidade de não lidas e a lista das mais recentes (RF801-FLU003/FLU004); "Ver todas" abre a central. */
function NotificationBell() {
  const { db, user } = useSubSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const mine = db.notifications.filter((n) => n.userId === user.id).sort((a, b) => b.at.localeCompare(a.at));
  const unread = mine.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const markRead = (id: string) => updateSubDb((d) => ({ ...d, notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
  const label = unread ? `Notificações, ${unread} não lida${unread > 1 ? 's' : ''}` : 'Notificações';
  return (
    <div className="bell-root" ref={rootRef}>
      <Tooltip content="Notificações" placement="bottom">
        <Button variant="ghost" iconOnly className="theme-btn" iconLeft={<IconBell size={16} />} aria-label={label} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)} />
      </Tooltip>
      {unread > 0 && <span className="bell-count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
      {open && (
        <div className="bell-panel" role="region" aria-label="Notificações recentes">
          <div className="bell-head"><span className="user-menu-name">Notificações</span></div>
          <div className="user-menu-sep" role="separator" />
          {mine.length === 0 && <p className="bell-empty">Você não tem notificações</p>}
          {mine.slice(0, 5).map((n) => (
            <a key={n.id} className={`bell-item${n.read ? '' : ' is-unread'}`} href={n.href} onClick={() => markRead(n.id)}>
              <span className="bell-item-title">{n.title}</span>
              <span className="bell-item-text">{n.text}</span>
              <span className="cell-secondary">{formatDateTime(n.at)}</span>
            </a>
          ))}
          <div className="user-menu-sep" role="separator" />
          <a className="bell-all text-link" href="notificacoes.html">Ver todas as notificações</a>
        </div>
      )}
    </div>
  );
}

/**
 * Estrutura da área logada do assinante - mesma casca do Admin: Sidebar do Storybook fixa à esquerda (recolhível) no
 * desktop; no mobile (< 768px), AppHeader com menu hambúrguer e a Sidebar como gaveta.
 * `active` = item do menu; `screen` = permissão da tela atual (sem permissão de visualizar: aviso de acesso negado).
 */
export function AppLayout({ active, screen, children, layout = 'default' }: { active: string; screen: ScreenKey; children: ReactNode; /** `focused` = Padrão B (wizard): sem sidebar, conteúdo centralizado em largura confortável. Os formulários convencionais (Padrão A) usam o `default`. */ layout?: 'default' | 'focused' }) {
  const isMobile = useIsMobile();
  const { user, can } = useSubSession();
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(SIDEBAR_KEY) !== '0'; } catch { return true; } });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const topbarRef = useRef<HTMLDivElement>(null);

  const items: NavItemDef[] = NAV
    .map((n) => (n.children ? { ...n, children: n.children.filter((c) => can(c.screen)) } : n))
    .filter((n) => (n.children ? n.children.length > 0 : can(n.screen)))
    .map(({ screen: _s, href: _h, children, ...item }) => ({ ...item, ...(children ? { children: children.map(({ screen: _cs, ...c }) => c) } : {}) }));
  const navigate = (id: string) => {
    setDrawerOpen(false);
    const target = NAV.flatMap((n) => [n, ...(n.children ?? [])]).find((n) => n.id === id);
    if (target?.href && (id !== active || location.pathname.split('/').pop() !== target.href)) window.location.href = target.href;
  };
  const closeDrawer = () => { setDrawerOpen(false); document.getElementById(MENU_BTN_ID)?.focus(); };
  const toggleSidebar = () => setOpen((v) => { try { localStorage.setItem(SIDEBAR_KEY, v ? '0' : '1'); } catch { /* */ } return !v; });

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLElement>('nav button, nav a')?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [drawerOpen]);
  useEffect(() => { if (!isMobile) setDrawerOpen(false); }, [isMobile]);

  const sidebar = (sidebarOpen: boolean, onToggle: () => void, variant: 'rail' | 'menu' = 'rail') => (
    <Sidebar
      variant={variant}
      items={items}
      activeItem={active}
      open={sidebarOpen}
      onToggle={onToggle}
      onNavClick={navigate}
      logo={{ full: <img src={logoFull} alt="MAGLEV" />, icon: <img src={logoIcon} alt="MAGLEV" /> }}
      version={`v${APP_VERSION}`}
    />
  );

  const logout = () => { window.location.href = 'login.html'; };
  const account = (compact: boolean) => (
    <>
      {!compact && <GlobalSearch />}
      <NotificationBell />
      <HelpButton />
      <ThemeButton />
      <UserMenu name={user.name} email={user.email} compact={compact} onLogout={logout} />
    </>
  );

  const content = can(screen) ? children : <NoAccess />;

  // Layout focado (Padrão B): cabeçalho global (logo + conta), sem sidebar nem menu em gaveta, conteúdo centralizado
  if (layout === 'focused') {
    const logo = (
      <a className="app-focused-logo" href="inicio.html" aria-label="MAGLEV, ir para o Início">
        <img className="logo-light" src={logoLight} alt="" />
        <img className="logo-dark" src={logoDark} alt="" />
      </a>
    );
    return (
      <div className="app-shell is-focused">
        <div className={isMobile ? 'app-topbar' : 'app-topbar-desktop'}>
          <AppHeader align="start" logo={logo} actions={account(isMobile)} />
        </div>
        <main className="app-main"><div className="app-focused">{content}</div></main>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="app-shell is-mobile">
        {drawerOpen && <div className="app-drawer-backdrop" onClick={closeDrawer} aria-hidden="true" />}
        <div className="app-topbar" ref={topbarRef}>
          <AppHeader
            align="start"
            logo={(
              <>
                <Button
                  id={MENU_BTN_ID} variant="ghost" iconOnly iconLeft={drawerOpen ? <IconX size={24} /> : <IconMenu2 size={24} />}
                  aria-label={drawerOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={drawerOpen} aria-controls={DRAWER_ID}
                  onClick={() => (drawerOpen ? closeDrawer() : setDrawerOpen(true))}
                />
                <img className="logo-light" src={logoLight} alt="MAGLEV" />
                <img className="logo-dark" src={logoDark} alt="" aria-hidden="true" />
              </>
            )}
            actions={account(true)}
          />
          {/* Mobile: a busca global não some atrás de uma lupa; ocupa uma segunda linha compacta */}
          <div className="app-topbar-search"><GlobalSearch /></div>
          {drawerOpen && (
            <div id={DRAWER_ID} ref={drawerRef} className="app-menu-panel" style={{ top: topbarRef.current?.offsetHeight }}>
              {sidebar(true, closeDrawer, 'menu')}
            </div>
          )}
        </div>
        <main className="app-main">{content}</main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-sidebar">{sidebar(open, toggleSidebar)}</div>
      <div className="app-column">
        <div className="app-topbar-desktop">
          <AppHeader align="start" logo={<span aria-hidden="true" />} actions={account(false)} />
        </div>
        <main className="app-main">{content}</main>
      </div>
    </div>
  );
}

function NoAccess() {
  return (
    <Card>
      <EmptyState
        icon={<IconLock size={32} />}
        title="Você não tem permissão para acessar esta tela"
        description="Fale com um administrador da sua empresa se precisar desse acesso."
        headingLevel={2}
      />
    </Card>
  );
}
