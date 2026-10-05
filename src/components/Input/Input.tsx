import { InputHTMLAttributes, ReactNode } from 'react';
import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { cx } from '../../utils/cx';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Rótulo visível. Sem `label`, passe `aria-label` para manter o campo acessível. */
  label?: string;
  /** Campo opcional: mostra “(opcional)” ao lado do rótulo (os obrigatórios não levam marcação). */
  optional?: boolean;
  /** Texto de ajuda exibido abaixo do campo. */
  helperText?: string;
  /** Mensagem de erro. Marca o campo como inválido (`aria-invalid`). */
  error?: string;
  /** Mensagem de sucesso (ignorada se houver `error`). */
  success?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** Ícone à direita **clicável** (ex.: mostrar/ocultar senha, limpar busca). Renderiza um
   *  `Button` ghost só-ícone dentro do campo. Tem prioridade sobre `iconRight`.
   *  `label` é obrigatório: é o nome acessível do botão. `pressed` marca estados de alternância. */
  iconRightAction?: {
    icon: ReactNode;
    label: string;
    onClick: () => void;
    pressed?: boolean;
    disabled?: boolean;
  };
  /** Oculta o ícone da mensagem de erro. Útil quando o indicador
   *  visual de erro é fornecido por outro elemento (ex: Feedback block). */
  hideErrorIcon?: boolean;
}

export function Input({
  label, helperText, error, success, iconLeft, iconRight, iconRightAction, hideErrorIcon, className, id, required, optional, ...props
}: InputProps) {
  if (import.meta.env.DEV && !label && !props['aria-label'] && !props['aria-labelledby']) {
    console.warn('Input: forneça `label` ou `aria-label` para que o campo tenha um nome acessível.');
  }
  return (
    <FormField
      label={label} helperText={helperText} error={error} success={success}
      required={required} optional={optional} hideErrorIcon={hideErrorIcon} id={id} className={className}
    >
      {(control) => (
        <div className={cx(styles.inputWrap, Boolean(iconLeft) && styles.hasLeft, Boolean(iconRight || iconRightAction) && styles.hasRight)}>
          {iconLeft && <span className={styles.iconLeft} aria-hidden="true">{iconLeft}</span>}
          <input className={styles.input} {...control} {...props} />
          {iconRightAction ? (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              className={styles.actionRight}
              aria-label={iconRightAction.label}
              aria-pressed={iconRightAction.pressed}
              disabled={iconRightAction.disabled || props.disabled}
              onClick={iconRightAction.onClick}
              iconLeft={iconRightAction.icon}
            />
          ) : (
            iconRight && <span className={styles.iconRight} aria-hidden="true">{iconRight}</span>
          )}
        </div>
      )}
    </FormField>
  );
}
