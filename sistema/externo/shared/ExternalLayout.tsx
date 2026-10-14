import { ReactNode } from 'react';
import { AppHeader } from '@maglev/ds';
import logoLight from '../../../public/maglev-logo.svg';
import logoDark from '../../../public/maglev-logo-dark.svg';
import { PageHeader, mountApp } from '../../admin/shared/AppLayout';
import { ThemeButton } from '../../admin/shared/UserMenu';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { useDb as useAdminDb } from '../../admin/shared/store';
import { useSubDb } from '../../assinante/shared/store';

import '../../admin/shared/nav-sync';
import '../../assinante/shared/assinante.css';
import './externo.css';

export { PageHeader, mountApp };

/**
 * Casca das telas externas (Prestador de serviço e Colaborador/Solicitante): sem sidebar, sem busca, sem notificações e
 * sem conta - ninguém aqui tem login; o acesso é por link (prestador) ou QR Code (colaborador). Só o logo, o nome do
 * assinante (contexto) e o tema. Mobile-first (RF101-RGN003 do prestador; RF001-RGN004 do colaborador): coluna única,
 * e no desktop a mesma coluna centralizada, mais larga quando `wide`.
 */
export function ExternalLayout({ children, area, wide }: { children: ReactNode; /** Nome da área ("Área do prestador"), ao lado do assinante */ area: string; wide?: boolean }) {
  const isMobile = useIsMobile();
  const db = useSubDb();
  const admin = useAdminDb();
  const company = admin.subscribers.find((s) => s.id === db.subscriberId);
  const logo = (
    <span className="ext-logo">
      <img className="logo-light" src={logoLight} alt="MAGLEV" />
      <img className="logo-dark" src={logoDark} alt="MAGLEV" />
    </span>
  );
  const actions = (
    <>
      <span className="ext-context">
        <span className="ext-context-company">{company?.tradeName ?? company?.legalName}</span>
        <span className="ext-context-area">{area}</span>
      </span>
      <ThemeButton placement="left" />
    </>
  );
  return (
    <div className="app-shell is-focused ext-shell">
      <div className={isMobile ? 'app-topbar' : 'app-topbar-desktop'}>
        <AppHeader align="start" logo={logo} actions={actions} />
      </div>
      <main className="app-main"><div className={`ext-page${wide ? ' is-wide' : ''}`}>{children}</div></main>
    </div>
  );
}
