import { ReactNode } from 'react';
import { cx } from '../../utils/cx';
import styles from './AppHeader.module.css';

export interface AppHeaderProps {
  /** Logo ou nome do produto (ex.: `<img src="…" alt="Nome do produto" />`). */
  logo?: ReactNode;
  /** Conteúdo do lado direito (ex.: menu do usuário, botão de entrar). */
  actions?: ReactNode;
  /** `center` centraliza a logo (telas públicas simples); `start` alinha à esquerda ao lado das ações. */
  align?: 'center' | 'start';
}

/** Barra superior fixa (sticky) de 60px para telas públicas ou de conteúdo sem Sidebar. */
export function AppHeader({ logo, actions, align = 'center' }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={cx(styles.inner, align === 'start' && styles.start)}>
        {logo && <div className={styles.logo}>{logo}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  );
}
