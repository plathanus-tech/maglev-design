import { ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Card, Stack } from '@maglev/ds';
import logoLight from '../../../public/maglev-logo.svg';
import logoDark from '../../../public/maglev-logo-dark.svg';
import { DevNote } from './dev-notes/DevNote';

import '../../../src/tokens/tokens.css';
import './theme';
import './fonts.css';
import './nav-sync';
import './page.css';

/**
 * Estrutura comum das telas de autenticação do Admin: logo fora do card (16px de distância),
 * card centralizado com título e subtítulo. Logo troca de versão conforme o tema (claro/escuro).
 */
export function AuthLayout({ title, subtitle, subtitleNote, children }: {
  title: string;
  subtitle: ReactNode;
  subtitleNote?: ReactNode;
  children: ReactNode;
}) {
  const header = (
    <Stack gap="xs" as="header">
      <h1 className="page-title page-text--center">{title}</h1>
      <p className="page-text page-text--center">{subtitle}</p>
    </Stack>
  );

  return (
    <main className="auth-column">
      <Stack gap="md" align="center">
        <img className="auth-logo logo-light" src={logoLight} alt="MAGLEV" />
        <img className="auth-logo logo-dark" src={logoDark} alt="" aria-hidden="true" />
        <Card padding="lg">
          <Stack gap="lg">
            {subtitleNote ? <DevNote note={subtitleNote}>{header}</DevNote> : header}
            {children}
          </Stack>
        </Card>
      </Stack>
    </main>
  );
}

export function mountScreen(screen: ReactNode) {
  createRoot(document.getElementById('root')!).render(<StrictMode>{screen}</StrictMode>);
}
