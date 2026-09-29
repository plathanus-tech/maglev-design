import { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: ação principal da tela (use 1 por área) · secondary: ação alternativa ·
   *  destructive: ações irreversíveis · ghost: ações de baixa ênfase. */
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** Só ícone, sem texto. Exige `aria-label` para ter nome acessível. */
  iconOnly?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  iconOnly = false,
  children,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [
    styles.btn,
    styles[variant],
    styles[size],
    iconOnly   ? styles.iconOnly  : '',
    iconLeft   ? styles.hasLeft   : '',
    iconRight  ? styles.hasRight  : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <button type={type} className={classes} {...props}>
      {iconLeft && <span className={styles.icon} aria-hidden="true">{iconLeft}</span>}
      {!iconOnly && children}
      {iconRight && <span className={styles.icon} aria-hidden="true">{iconRight}</span>}
    </button>
  );
}
