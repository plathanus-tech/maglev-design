import { InputHTMLAttributes, useEffect, useId, useRef } from 'react';
import { IconCheck, IconMinus, IconCircleX } from '@tabler/icons-react';
import { cx } from '../../utils/cx';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Rótulo visível. Sem `label`, passe `aria-label`. */
  label?: string;
  checked?: boolean;
  /** Estado misto (ex.: "selecionar todos" com seleção parcial). */
  indeterminate?: boolean;
  /** Mensagem de erro. Marca o campo como inválido (`aria-invalid`), no mesmo padrão visual do Input. */
  error?: string;
}

export function Checkbox({ label, checked = false, indeterminate = false, disabled = false, error, id, ...props }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  const autoId = useId();
  const errorId = `${id ?? autoId}-error`;
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);

  return (
    <div className={styles.field}>
      <label className={cx(styles.wrapper, checked && styles.checked, indeterminate && styles.indeterminate, disabled && styles.disabled)}>
        <input
          ref={ref} id={id} type="checkbox" className={styles.input} checked={checked} disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        <span className={styles.box} aria-hidden="true">
          {indeterminate
            ? <span className={styles.mark}><IconMinus size={12} stroke={3} /></span>
            : checked ? <span className={styles.mark}><IconCheck size={12} stroke={3} /></span> : null}
        </span>
        {label && <span className={styles.label}>{label}</span>}
      </label>
      {error && (
        <span id={errorId} className={styles.error} aria-live="polite">
          <IconCircleX size={14} className={styles.msgIcon} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}
