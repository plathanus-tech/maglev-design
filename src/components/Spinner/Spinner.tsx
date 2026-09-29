import { cx } from '../../utils/cx';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  /** Texto lido por leitores de tela (i18n). */
  label?: string;
}

/** Indicador de carregamento. Use dentro de botões, cartões ou seções que aguardam dados. */
export function Spinner({ size = 'md', label = 'Carregando' }: SpinnerProps) {
  return (
    <span role="status" className={cx(styles.spinner, styles[size])}>
      <span className={styles.ring} aria-hidden="true" />
      <span className={styles.srOnly}>{label}</span>
    </span>
  );
}
