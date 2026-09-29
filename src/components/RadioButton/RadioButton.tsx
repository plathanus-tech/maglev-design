import { useId } from 'react';
import { IconCircleX } from '@tabler/icons-react';
import { cx } from '../../utils/cx';
import styles from './RadioButton.module.css';

export interface RadioOption { label: string; value: string; }

export interface RadioButtonProps {
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  /** Nome do grupo (obrigatório para agrupar os rádios). */
  name: string;
  /** Legenda do grupo (`<legend>`). */
  label?: string;
  disabled?: boolean;
  orientation?: 'vertical' | 'horizontal';
  /** Mensagem de erro do grupo. Marca as opções como inválidas (`aria-invalid`), no mesmo padrão visual do Input. */
  error?: string;
}

/** Grupo de rádios: escolha única entre poucas opções visíveis (até ~5). */
export function RadioButton({ options, value, onChange, name, label, disabled = false, orientation = 'vertical', error }: RadioButtonProps) {
  const errorId = `${useId()}-error`;
  return (
    <fieldset className={styles.fieldset} disabled={disabled} aria-describedby={error ? errorId : undefined}>
      {label && <legend className={styles.label}>{label}</legend>}
      <div className={cx(styles.group, orientation === 'horizontal' && styles.horizontal)}>
        {options.map(opt => (
          <label key={opt.value} className={cx(styles.option, value === opt.value && styles.checked, disabled && styles.disabled)}>
            <input
              type="radio" className={styles.input} name={name} value={opt.value} checked={value === opt.value} disabled={disabled}
              aria-invalid={error ? true : undefined}
              onChange={() => onChange?.(opt.value)}
            />
            <span className={styles.circle} aria-hidden="true"><span className={styles.dot} /></span>
            <span className={styles.optionLabel}>{opt.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <span id={errorId} className={styles.error} aria-live="polite">
          <IconCircleX size={14} className={styles.msgIcon} aria-hidden="true" />
          {error}
        </span>
      )}
    </fieldset>
  );
}
