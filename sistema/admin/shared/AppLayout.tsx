import { ReactNode, StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  IconAdjustmentsHorizontal, IconAlertTriangle, IconFlag, IconLayoutDashboard, IconListDetails, IconLock, IconMenu2, IconMicrowave, IconX,
  IconProgressCheck, IconShieldLock, IconTool, IconToolsKitchen2, IconUsers,
} from '@tabler/icons-react';
import { AppHeader, Breadcrumb, BreadcrumbItem, Button, Card, EmptyState, NavItemDef, Sidebar, Stack, ToastProvider } from '@maglev/ds';
import logoFull from '../../../public/maglev-logo-dark.svg';
import logoIcon from '../../../public/maglev-symbol-dark.svg';
import logoLight from '../../../public/maglev-logo.svg';
import logoDark from '../../../public/maglev-logo-dark.svg';
import { ScreenKey } from './data';
import { useSession } from './store';
import { useIsMobile } from './useMediaQuery';
import { ThemeButton, UserMenu } from './UserMenu';

import '../../../src/tokens/tokens.css';
import './theme';
import './fonts.css';
import './nav-sync';
import './page.css';

/** Menu principal do Admin (RF101 → RF407). Itens sem permissão de visualizar ficam ocultos (RF303-FLU005). */
type NavEntry = Omit<NavItemDef, 'children'> & { screen: ScreenKey; href?: string; children?: Array<{ id: string; label: string; href: string; icon: ReactNode }> };
const NAV: NavEntry[] = [
  { id: 'dashboard', screen: 'dashboard', label: 'Dashboard', icon: <IconLayoutDashboard size={16} />, href: 'dashboard.html' },
  { id: 'assinantes', screen: 'assinantes', label: 'Assinantes', icon: <IconToolsKitchen2 size={16} />, href: 'assinantes.html' },
  { id: 'usuarios', screen: 'usuarios', label: 'Usuários', icon: <IconUsers size={16} />, href: 'usuarios.html' },
  { id: 'perfis', screen: 'perfis', label: 'Perfis de acesso', icon: <IconShieldLock size={16} />, href: 'perfis.html' },
  {
    // Grupo recolhível (accordion): clicar só expande; a navegação é das páginas filhas (RF402-RF407).
    id: 'configuracoes', screen: 'configuracoes', label: 'Configurações', icon: <IconAdjustmentsHorizontal size={16} />,
    children: [
      { id: 'configuracoes-categorias', label: 'Categorias', icon: <IconMicrowave size={16} />, href: 'configuracoes-categorias.html' },
      { id: 'configuracoes-tipos-solicitacao', label: 'Tipos de solicitação', icon: <IconListDetails size={16} />, href: 'configuracoes-tipos-solicitacao.html' },
      { id: 'configuracoes-tipos-manutencao', label: 'Tipos de manutenção', icon: <IconTool size={16} />, href: 'configuracoes-tipos-manutencao.html' },
      { id: 'configuracoes-prioridades', label: 'Prioridades', icon: <IconFlag size={16} />, href: 'configuracoes-prioridades.html' },
      { id: 'configuracoes-criticidades', label: 'Criticidades', icon: <IconAlertTriangle size={16} />, href: 'configuracoes-criticidades.html' },
      { id: 'configuracoes-status', label: 'Status', icon: <IconProgressCheck size={16} />, href: 'configuracoes-status.html' },
    ],
  },
];

/** Versão do sistema, exibida no fim do menu. */
const APP_VERSION = '1.0.0';
const DRAWER_ID = 'app-drawer';
const MENU_BTN_ID = 'app-menu-button';
const SIDEBAR_KEY = 'maglev.v2.sidebar.open';

/**
 * Estrutura da área logada.
 * Desktop: Sidebar do Storybook fixa à esquerda (recolhível).
 * Mobile (< 768px): AppHeader com menu hambúrguer; a Sidebar abre como gaveta sobre o conteúdo.
 * `screen` = tela atual: sem permissão de visualizar, mostra o aviso de acesso negado.
 */
export function AppLayout({ active, screen, children }: { active: string; screen: ScreenKey; children: ReactNode }) {
  const isMobile = useIsMobile();
  const { user, can } = useSession();
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(SIDEBAR_KEY) !== '0'; } catch { return true; } });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const topbarRef = useRef<HTMLDivElement>(null);

  const items: NavItemDef[] = NAV.filter((n) => can(n.screen)).map(({ screen: _s, href: _h, ...item }) => item);
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
      <ThemeButton />
      <UserMenu name={user.name} email={user.email} compact={compact} onLogout={logout} />
    </>
  );

  const content = can(screen) ? children : <NoAccess />;

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
        description="Fale com um administrador da plataforma se precisar desse acesso."
        headingLevel={2}
      />
    </Card>
  );
}

/** Cabeçalho de página: trilha (opcional), título, subtítulo e ações à direita. */
export function PageHeader({ title, subtitle, breadcrumb, actions, badge }: {
  title: string;
  subtitle?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
  /** Ex.: status do registro ao lado do título (detalhe). */
  badge?: ReactNode;
}) {
  const isMobile = useIsMobile();
  return (
    <Stack gap="sm" as="header" className="page-header">
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <Stack direction={isMobile ? 'vertical' : 'horizontal'} justify="between" align={isMobile ? 'stretch' : 'end'} gap="md" wrap>
        <Stack gap="2xs">
          <Stack direction="horizontal" align="center" gap="sm" wrap>
            <h1 className="page-title">{title}</h1>
            {badge}
          </Stack>
          {subtitle && <p className="page-text">{subtitle}</p>}
        </Stack>
        {actions && <Stack direction={isMobile ? 'vertical' : 'horizontal'} align={isMobile ? 'stretch' : 'center'} gap="sm" wrap className={isMobile ? 'page-actions-full' : undefined}>{actions}</Stack>}
      </Stack>
    </Stack>
  );
}

export function mountApp(screen: ReactNode) {
  createRoot(document.getElementById('root')!).render(<StrictMode><ToastProvider>{screen}</ToastProvider></StrictMode>);
}
