import { TextareaHTMLAttributes } from 'react';
import { FormField } from '../FormField/FormField';
import styles from './Textarea.module.css';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Rótulo visível. Sem `label`, passe `aria-label`. */
  label?: string;
  helperText?: string;
  error?: string;
  success?: string;
}

/** Campo de texto multilinha (comentários, descrições, mensagens). */
export function Textarea({ label, helperText, error, success, className, id, required, rows = 4, ...props }: TextareaProps) {
  if (import.meta.env.DEV && !label && !props['aria-label'] && !props['aria-labelledby']) {
    console.warn('Textarea: forneça `label` ou `aria-label` para que o campo tenha um nome acessível.');
  }
  return (
    <FormField label={label} helperText={helperText} error={error} success={success} required={required} id={id} className={className}>
      {(control) => <textarea className={styles.textarea} rows={rows} {...control} {...props} />}
    </FormField>
  );
}
