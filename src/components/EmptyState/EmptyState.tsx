import { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** Ícone decorativo (ex.: `<Inbox size={32} />`). */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Ação principal (ex.: `<Button>Criar item</Button>`). */
  action?: ReactNode;
  /** Nível do heading do título (2–6). Ajuste conforme a hierarquia da tela onde o EmptyState é usado. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
}

/** Estado vazio de lista/seção: explica por que não há dados e oferece o próximo passo. */
export function EmptyState({ icon, title, description, action, headingLevel = 3 }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={styles.empty}>
      {icon && <div className={styles.icon} aria-hidden="true">{icon}</div>}
      <Heading className={styles.title}>{title}</Heading>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
