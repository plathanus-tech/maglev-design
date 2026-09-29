import { ReactNode } from 'react';
import { cx } from '../../utils/cx';
import styles from './Badge.module.css';

export type BadgeStatus = 'neutral' | 'brand' | 'success' | 'error' | 'warning' | 'info';

export interface BadgeProps {
  /** Significado semântico. success/error/warning/info seguem as cores de status. */
  status?: BadgeStatus;
  /** Mostra um ponto antes do texto (reforça o estado sem depender só da cor). */
  dot?: boolean;
  children: ReactNode;
}

/** Rótulo pequeno de estado ou categoria (ex.: "Ativo", "Pendente"). Não é clicável. */
export function Badge({ status = 'neutral', dot = false, children }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[status])}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
