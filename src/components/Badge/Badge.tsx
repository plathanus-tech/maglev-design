import { ReactNode } from 'react';
import { cx } from '../../utils/cx';
import styles from './Badge.module.css';

export type BadgeStatus = 'neutral' | 'brand' | 'success' | 'error' | 'warning' | 'info';

export interface BadgeProps {
  /** Significado semântico. success/error/warning/info seguem as cores de status. */
  status?: BadgeStatus;
  /** Mostra um ponto antes do texto (reforça o estado sem depender só da cor). */
  dot?: boolean;
  /** Ícone (Tabler, ~14px) no lugar do ponto: reforça o significado sem depender só da cor. Tem prioridade sobre `dot`. */
  icon?: ReactNode;
  /** Destaque sólido (só `error`): fundo e texto de ação de erro. Reserve para um estado urgente pontual (ex.: prazo vencido). */
  solid?: boolean;
  children: ReactNode;
}

/** Rótulo pequeno de estado ou categoria (ex.: "Ativo", "Pendente"). Não é clicável. */
export function Badge({ status = 'neutral', dot = false, icon, solid = false, children }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[status], solid && status === 'error' && styles.solidError)}>
      {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
