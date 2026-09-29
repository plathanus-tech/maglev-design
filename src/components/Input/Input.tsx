import { InputHTMLAttributes, ReactNode } from 'react';
import { FormField } from '../FormField/FormField';
import { cx } from '../../utils/cx';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Rótulo visível. Sem `label`, passe `aria-label` para manter o campo acessível. */
  label?: string;
  /** Texto de ajuda exibido abaixo do campo. */
  helperText?: string;
  /** Mensagem de erro. Marca o campo como inválido (`aria-invalid`). */
  error?: string;
  /** Mensagem de sucesso (ignorada se houver `error`). */
  success?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** Oculta o ícone da mensagem de erro. Útil quando o indicador
   *  visual de erro é fornecido por outro elemento (ex: Feedback block). */
  hideErrorIcon?: boolean;
}

export function Input({
  label, helperText, error, success, iconLeft, iconRight, hideErrorIcon, className, id, required, ...props
}: InputProps) {
  if (import.meta.env.DEV && !label && !props['aria-label'] && !props['aria-labelledby']) {
    console.warn('Input: forneça `label` ou `aria-label` para que o campo tenha um nome acessível.');
  }
  return (
    <FormField
      label={label} helperText={helperText} error={error} success={success}
      required={required} hideErrorIcon={hideErrorIcon} id={id} className={className}
    >
      {(control) => (
        <div className={cx(styles.inputWrap, Boolean(iconLeft) && styles.hasLeft, Boolean(iconRight) && styles.hasRight)}>
          {iconLeft && <span className={styles.iconLeft} aria-hidden="true">{iconLeft}</span>}
          <input className={styles.input} {...control} {...props} />
          {iconRight && <span className={styles.iconRight} aria-hidden="true">{iconRight}</span>}
        </div>
      )}
    </FormField>
  );
}
