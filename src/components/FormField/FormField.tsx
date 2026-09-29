import { ReactNode, useId } from 'react';
import { IconCircleX, IconCircleCheck } from '@tabler/icons-react';
import { cx } from '../../utils/cx';
import styles from './FormField.module.css';

/** Classe visual dos campos (borda, radius, foco, erro). Aplique em controles avulsos: `className={fieldControlClass}`. */
export const fieldControlClass = styles.control;

/** Props que o controle (input, textarea, select…) deve receber para ficar acessível. */
export interface FieldControlProps {
  id: string;
  required?: true;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

export interface FormFieldProps {
  /** Rótulo visível, associado ao controle via `htmlFor`. */
  label?: string;
  helperText?: string;
  /**
   * Mensagem de erro de validação inline — tem prioridade sobre `success` e `helperText`.
   * Anunciada via `aria-live="polite"` e associada ao controle por `aria-describedby`, que
   * também recebe `aria-invalid`. Erros de envio (submit) — incluindo gerenciamento de foco
   * e resumo de múltiplos erros — são responsabilidade do formulário que usa este componente,
   * não do `FormField`.
   */
  error?: string;
  success?: string;
  /** Mostra o asterisco e repassa `required` ao controle. */
  required?: boolean;
  /** Oculta o ícone da mensagem de erro (quando outro elemento já sinaliza o erro). */
  hideErrorIcon?: boolean;
  /** Use quando precisar de um id previsível; caso contrário é gerado. */
  id?: string;
  className?: string;
  /** Render prop: espalhe o argumento no controle → `<input {...control} />`. */
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Estrutura padrão de campo de formulário: label + controle + mensagem (ajuda/erro/sucesso).
 * Todo campo novo deve ser composto com FormField em vez de reimplementar label/erro.
 */
export function FormField({
  label, helperText, error, success, required, hideErrorIcon = false, id, className, children,
}: FormFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const messageId = `${fieldId}-message`;
  const hasMessage = Boolean(error || success || helperText);

  const control: FieldControlProps = {
    id: fieldId,
    ...(required ? { required: true as const } : {}),
    ...(error ? { 'aria-invalid': true as const } : {}),
    ...(hasMessage ? { 'aria-describedby': messageId } : {}),
  };

  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label className={styles.label} htmlFor={fieldId}>
          {label}
          {required && <span className={styles.required} aria-hidden="true">*</span>}
        </label>
      )}
      {children(control)}
      {error && (
        <span id={messageId} className={styles.error} aria-live="polite">
          {!hideErrorIcon && <IconCircleX size={14} className={styles.msgIcon} aria-hidden="true" />}
          {error}
        </span>
      )}
      {!error && success && (
        <span id={messageId} className={styles.success}>
          <IconCircleCheck size={14} className={styles.msgIcon} aria-hidden="true" />
          {success}
        </span>
      )}
      {!error && !success && helperText && <span id={messageId} className={styles.helper}>{helperText}</span>}
    </div>
  );
}
