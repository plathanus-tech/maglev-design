import { ClipboardEvent, KeyboardEvent, forwardRef, useImperativeHandle, useRef } from 'react';
import { FormField, fieldControlClass } from '@maglev/ds';

export const OTP_LENGTH = 6;

export interface OtpInputHandle { focus: (index?: number) => void }

/**
 * Campo de código de verificação (OTP) de 6 dígitos, um quadro por dígito: avanço automático, Backspace volta, setas e colar o código
 * inteiro. Compartilhado pela recuperação de senha (Admin e Assinante) e pelo acesso do Prestador de serviço.
 */
export const OtpInput = forwardRef<OtpInputHandle, {
  digits: string[];
  onChange: (digits: string[]) => void;
  /** Chamado quando a pessoa edita (para limpar o erro da tentativa anterior). */
  onEdit?: () => void;
  disabled?: boolean;
  error?: string;
  autoFocus?: boolean;
}>(function OtpInput({ digits, onChange, onEdit, disabled, error, autoFocus }, ref) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const focusDigit = (i: number) => inputs.current[Math.min(Math.max(i, 0), OTP_LENGTH - 1)]?.focus();
  useImperativeHandle(ref, () => ({ focus: (i = 0) => focusDigit(i) }));

  const onDigitChange = (i: number, raw: string) => {
    const v = raw.replace(/\D/g, '').slice(-1);
    onChange(digits.map((x, idx) => (idx === i ? v : x)));
    onEdit?.();
    if (v) focusDigit(i + 1);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    // Redigitar o mesmo número não dispara onChange: avança o foco mesmo assim.
    if (/^\d$/.test(e.key) && digits[i] === e.key) { e.preventDefault(); focusDigit(i + 1); return; }
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      onChange(digits.map((x, idx) => (idx === i - 1 ? '' : x)));
      focusDigit(i - 1);
    }
    if (e.key === 'ArrowLeft') focusDigit(i - 1);
    if (e.key === 'ArrowRight') focusDigit(i + 1);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    onChange(Array.from({ length: OTP_LENGTH }, (_, i) => pasted[i] ?? ''));
    onEdit?.();
    focusDigit(pasted.length);
  };

  return (
    <FormField id="otp" error={error}>
      {({ id, ...aria }) => (
        <div className="grid grid-otp" role="group" aria-label="Código de verificação de 6 dígitos">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; if (i === 0 && el && autoFocus && !el.dataset.focused) { el.dataset.focused = '1'; el.focus(); } }}
              id={i === 0 ? id : undefined}
              className={`${fieldControlClass} otp-digit`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={`Dígito ${i + 1} de ${OTP_LENGTH}`}
              value={d}
              disabled={disabled}
              onChange={(e) => onDigitChange(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onPaste={onPaste}
              onFocus={(e) => e.target.select()}
              {...aria}
            />
          ))}
        </div>
      )}
    </FormField>
  );
});
