import { IconCircleCheck, IconCircleX, IconAlertTriangle, IconInfoCircle, IconX } from '@tabler/icons-react';
import { cx } from '../../utils/cx';
import styles from './Feedback.module.css';

const ICONS = {
  success: <IconCircleCheck size={18} />,
  error:   <IconCircleX size={18} />,
  warning: <IconAlertTriangle size={18} />,
  info:    <IconInfoCircle size={18} />,
};

export interface FeedbackProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  /** Rótulo do botão de fechar (i18n). */
  dismissLabel?: string;
  /** Por padrão: `alert` para error/warning (interrompe) e `status` para success/info (educado). */
  role?: 'alert' | 'status';
}

/** Mensagem de status inline (banner). Para confirmações efêmeras use `Toast`. */
export function Feedback({ type, message, title, dismissible, onDismiss, dismissLabel = 'Fechar', role }: FeedbackProps) {
  const liveRole = role ?? (type === 'error' || type === 'warning' ? 'alert' : 'status');
  return (
    <div className={cx(styles.alert, styles[type])} role={liveRole}>
      <span className={styles.icon} aria-hidden="true">{ICONS[type]}</span>
      <div className={styles.body}>
        {title && <div className={styles.title}>{title}</div>}
        <div className={styles.message}>{message}</div>
      </div>
      {dismissible && (
        <button className={styles.dismiss} onClick={onDismiss} aria-label={dismissLabel} type="button">
          <IconX size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
