import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Feedback, FeedbackProps } from '../Feedback/Feedback';
import styles from './Toast.module.css';

export interface ToastOptions {
  type?: FeedbackProps['type'];
  message: string;
  title?: string;
  /**
   * Tempo até sumir, em ms. Padrão: tempo de leitura calculado a partir do texto
   * (`5000ms + 300ms por palavra` de `title` + `message`). `0` = fechamento manual.
   * Ignorado para `type="error"`: nunca some sozinho, independente do valor passado.
   * Não inclua dados pessoais na mensagem: ela pode ser vista por quem estiver perto da tela.
   */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  /** `null` = não some sozinho (fechamento manual obrigatório). */
  totalDuration: number | null;
}

interface ToastContextValue { show: (options: ToastOptions) => void; }

const ToastContext = createContext<ToastContextValue | null>(null);

const BASE_DURATION_MS = 5000;
const MS_PER_WORD = 300;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Calcula por quanto tempo o toast fica visível antes de somar sozinho (`null` = nunca). */
function computeDuration(options: ToastOptions): number | null {
  // Erro/crítico nunca some sozinho: precisa de fechamento explícito, mesmo se `duration` for passado.
  if (options.type === 'error') return null;
  if (options.duration != null) return options.duration > 0 ? options.duration : null;
  // Aviso mantém o padrão histórico de exigir fechamento manual, a menos que `duration` seja informado.
  if (options.type === 'warning') return null;
  const words = countWords(`${options.title ?? ''} ${options.message}`);
  return BASE_DURATION_MS + words * MS_PER_WORD;
}

/** Envolva o app (ou a área que dispara toasts) uma única vez. */
export function ToastProvider({ children, dismissLabel = 'Fechar notificação' }: { children: ReactNode; dismissLabel?: string }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  // Estado do temporizador de cada toast, para poder pausar/retomar sem perder o tempo já decorrido.
  const timers = useRef(new Map<number, { timeoutId: number; remaining: number; startedAt: number }>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) { window.clearTimeout(timer.timeoutId); timers.current.delete(id); }
    setToasts(list => list.filter(x => x.id !== id));
  }, []);

  const scheduleDismiss = useCallback((id: number, ms: number) => {
    const timeoutId = window.setTimeout(() => { timers.current.delete(id); dismiss(id); }, ms);
    timers.current.set(id, { timeoutId, remaining: ms, startedAt: Date.now() });
  }, [dismiss]);

  /** Mouse sobre o toast ou foco do teclado em qualquer elemento dentro dele: trava a contagem. */
  const pause = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (!timer) return;
    window.clearTimeout(timer.timeoutId);
    const remaining = Math.max(timer.remaining - (Date.now() - timer.startedAt), 0);
    timers.current.set(id, { ...timer, remaining });
  }, []);

  /** Mouse sai ou o foco sai do toast: retoma de onde parou. */
  const resume = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (!timer) return;
    if (timer.remaining <= 0) { dismiss(id); return; }
    scheduleDismiss(id, timer.remaining);
  }, [dismiss, scheduleDismiss]);

  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    const totalDuration = computeDuration(options);
    setToasts(list => [...list, { ...options, id, totalDuration }]);
    if (totalDuration != null) scheduleDismiss(id, totalDuration);
  }, [scheduleDismiss]);

  // Limpa temporizadores pendentes se o Provider for desmontado.
  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t.timeoutId)); }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region}>
        {toasts.map(t => (
          <div
            key={t.id}
            className={styles.toast}
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={() => resume(t.id)}
            onFocus={() => pause(t.id)}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) resume(t.id); }}
          >
            <Feedback
              type={t.type ?? 'info'} message={t.message} title={t.title}
              dismissible onDismiss={() => dismiss(t.id)} dismissLabel={dismissLabel}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** `const { show } = useToast(); show({ type: 'success', message: 'Salvo!' })` */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>.');
  return ctx;
}
