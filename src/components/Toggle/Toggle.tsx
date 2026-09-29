import { InputHTMLAttributes } from 'react';
import { cx } from '../../utils/cx';
import styles from './Toggle.module.css';

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Rótulo visível. Sem `label`, passe `aria-label`. */
  label?: string;
  checked?: boolean;
  /** `sm` para uso denso (ex.: células de tabela). */
  size?: 'sm' | 'md';
}

/** Interruptor liga/desliga com efeito imediato (diferente do Checkbox, que espera um "Salvar"). */
export function Toggle({ label, checked = false, disabled = false, size = 'md', ...props }: ToggleProps) {
  return (
    <label className={cx(styles.wrapper, styles[size], checked && styles.checked, disabled && styles.disabled)}>
      <input type="checkbox" role="switch" className={styles.input} checked={checked} disabled={disabled} {...props} />
      <span className={styles.track} aria-hidden="true"><span className={styles.thumb} /></span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}
