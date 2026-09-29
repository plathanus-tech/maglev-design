import { ReactNode } from 'react';
import { cx } from '../../utils/cx';
import styles from './Card.module.css';

export interface CardProps {
  /** Título do cartão (renderizado como heading). */
  title?: string;
  subtitle?: string;
  /** Ações no canto do cabeçalho (ex.: `<Button size="sm">`). */
  actions?: ReactNode;
  /** Rodapé (ex.: botões de salvar). */
  footer?: ReactNode;
  /** Espaçamento interno do corpo. Use `none` para tabelas/listas que ocupam toda a largura. */
  padding?: 'none' | 'md' | 'lg';
  /** Nível do heading do título (2–6). */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  children?: ReactNode;
  className?: string;
}

/** Superfície que agrupa conteúdo relacionado (formulário, resumo, tabela). */
export function Card({ title, subtitle, actions, footer, padding = 'md', headingLevel = 2, children, className }: CardProps) {
  const Heading = `h${headingLevel}` as const;
  const hasHeader = title || subtitle || actions;

  return (
    <section className={cx(styles.card, className)}>
      {hasHeader && (
        <header className={styles.header}>
          <div className={styles.headings}>
            {title && <Heading className={styles.title}>{title}</Heading>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={cx(styles.body, styles[`pad-${padding}`])}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </section>
  );
}
