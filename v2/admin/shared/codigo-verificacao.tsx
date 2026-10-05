import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Badge, Button, Feedback, FormField, Stack, fieldControlClass } from '@maglev/ds';
import { AuthLayout, mountScreen } from './AuthLayout';
import { DevNote } from './dev-notes/DevNote';
import { useHashState } from './useHashState';
import { getRecoveryEmail, maskEmail } from './recovery';

/**
 * Estados (o navegador de protótipo abre cada um via #state=):
 *  idle · incorrect (código incorreto) · expired (código expirou)
 *  · toomany (excedeu tentativas) · commerror (falha ao validar)
 */
const STATES = ['idle', 'incorrect', 'expired', 'toomany', 'commerror'] as const;
type Mode = (typeof STATES)[number];

const LENGTH = 6;
const VALID_CODE = '111111';            // protótipo: único código aceito
const MAX_ATTEMPTS = 5;
const EXPIRY_SECONDS = 300;             // validade do código: 5 min
const RESEND_COOLDOWN_SECONDS = 30;     // intervalo mínimo entre reenvios

const mmss = (total: number) => {
  const s = Math.max(total, 0);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function CodigoVerificacaoScreen() {
  const [mode, go, setMode] = useHashState<Mode>(STATES, 'idle');
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [expiresIn, setExpiresIn] = useState(EXPIRY_SECONDS);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [justResent, setJustResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const attempts = useRef(0);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const email = maskEmail(getRecoveryEmail() || 'ana.ribeiro@maglev.com.br');

  const locked = mode === 'expired' || mode === 'toomany';
  const code = digits.join('');
  const complete = code.length === LENGTH;

  // Variantes abertas pelo navegador de protótipo (idempotente para estados vindos de uso real).
  useEffect(() => {
    if (mode === 'incorrect') setDigits((d) => (d.every(Boolean) ? d : Array(LENGTH).fill('9')));
    if (mode === 'commerror') setDigits((d) => (d.every(Boolean) ? d : ['1', '2', '3', '4', '5', '6']));
    if (mode === 'expired') setExpiresIn(0);
    if (mode === 'toomany') attempts.current = MAX_ATTEMPTS;
  }, [mode]);

  // Foco no primeiro dígito ao abrir a tela.
  useEffect(() => { refs.current[0]?.focus(); }, []);

  // Contagens regressivas (validade do código e intervalo de reenvio).
  useEffect(() => {
    const id = window.setInterval(() => {
      setExpiresIn((s) => Math.max(s - 1, 0));
      setCooldown((s) => Math.max(s - 1, 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (expiresIn === 0 && mode !== 'expired' && mode !== 'toomany') go('expired');
  }, [expiresIn, mode, go]);

  const error =
    mode === 'incorrect' ? 'Código incorreto. Verifique e tente novamente.'
    : undefined;

  const focusDigit = (i: number) => refs.current[Math.min(Math.max(i, 0), LENGTH - 1)]?.focus();
  const clearError = () => { if (mode === 'incorrect' || mode === 'commerror') setMode('idle'); };

  const onDigitChange = (i: number, raw: string) => {
    const v = raw.replace(/\D/g, '').slice(-1);
    setDigits((d) => d.map((x, idx) => (idx === i ? v : x)));
    clearError();
    if (v) focusDigit(i + 1);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    // Redigitar o mesmo número não dispara onChange: avança o foco mesmo assim.
    if (/^d$/.test(e.key) && digits[i] === e.key) { e.preventDefault(); focusDigit(i + 1); return; }
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      setDigits((d) => d.map((x, idx) => (idx === i - 1 ? '' : x)));
      focusDigit(i - 1);
    }
    if (e.key === 'ArrowLeft') focusDigit(i - 1);
    if (e.key === 'ArrowRight') focusDigit(i + 1);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!pasted) return;
    e.preventDefault();
    setDigits(Array.from({ length: LENGTH }, (_, i) => pasted[i] ?? ''));
    clearError();
    focusDigit(pasted.length);
  };

  const resetFlow = () => {
    attempts.current = 0;
    setDigits(Array(LENGTH).fill(''));
    setExpiresIn(EXPIRY_SECONDS);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setMode('idle');
    if (location.hash) history.replaceState(null, '', location.pathname);
    window.setTimeout(() => focusDigit(0), 0);
  };

  const onResend = () => {
    if (cooldown > 0) return;
    resetFlow();
    setJustResent(true);
    window.setTimeout(() => setJustResent(false), 2500);
  };

  const proceed = () => {
    setLoading(true);
    window.setTimeout(() => { window.location.href = 'criar-nova-senha.html'; }, 500);
  };

  // Código correto preenchido por completo (digitado ou colado): valida e avança sem clicar.
  useEffect(() => {
    if (code === VALID_CODE && !locked && !loading && mode !== 'commerror') proceed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (locked) return resetFlow();
    if (!complete) return;
    if (code === VALID_CODE) return proceed();
    attempts.current += 1;
    if (attempts.current >= MAX_ATTEMPTS) return go('toomany');
    // Mantém o que foi digitado (marcado como erro); o foco volta ao primeiro dígito para corrigir.
    go('incorrect');
    focusDigit(0);
  };

  const submitLabel = loading ? 'Validando...' : locked ? 'Enviar novo código' : 'Continuar';

  return (
    <AuthLayout
      title="Código de verificação"
      subtitle={<>Se o e-mail estiver cadastrado, o código será enviado para <strong>{email}</strong></>}
      subtitleNote={<>E-mail exibido anonimizado, mas reconhecível: 3 primeiros e último caractere do usuário e 2 primeiros do domínio, com quantidade fixa de asteriscos (ex.: ana****o@ma****.com.br). A mensagem é a mesma exista ou não a conta, para não revelar quais e-mails estão cadastrados.</>}
    >
      {mode === 'expired' && (
        <Feedback type="warning" title="Seu código expirou" message="Solicite um novo código para continuar." />
      )}
      {mode === 'toomany' && (
        <Feedback type="error" title="Você excedeu o número de tentativas" message="Solicite um novo código." />
      )}
      {mode === 'commerror' && (
        <Feedback type="error" title="Não foi possível validar o código no momento" message="Tente novamente." />
      )}

      <form onSubmit={onSubmit} noValidate>
        <Stack gap="lg">
          <Stack gap="md">
            <FormField id="otp" error={error}>
              {({ id, ...aria }) => (
                <div className="grid grid-otp" role="group" aria-label="Código de verificação de 6 dígitos">
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { refs.current[i] = el; }}
                      id={i === 0 ? id : undefined}
                      className={`${fieldControlClass} otp-digit`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      aria-label={`Dígito ${i + 1} de ${LENGTH}`}
                      value={d}
                      disabled={locked || loading}
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

            <Stack gap="xs" align="center">
              <p className="page-text page-text--center" role="timer">
                {expiresIn > 0
                  ? <>O código expira em {expiresIn <= 30 ? <Badge status="warning">{mmss(expiresIn)}</Badge> : <strong>{mmss(expiresIn)}</strong>}</>
                  : 'O código expirou'}
              </p>
              {/* Texto fixo (sem contagem visível): o intervalo segue controlado por `cooldown`. */}
              {!justResent && cooldown > 0 && (
                <p className="page-text page-text--center">Reenvio disponível após {RESEND_COOLDOWN_SECONDS} segundos</p>
              )}
              <div aria-live="polite">
                {justResent ? <Badge status="success" dot>Código reenviado!</Badge> : cooldown === 0 && (
                  <Button variant="ghost" size="sm" onClick={onResend}>Não recebeu o código? Reenviar código</Button>
                )}
              </div>
            </Stack>
          </Stack>

          <Stack gap="md">
            <DevNote note="Botão desabilitado até os 6 dígitos serem preenchidos. Com o código correto, a validação e o redirecionamento acontecem automaticamente, sem clicar em Continuar.">
              <Stack><Button type="submit" disabled={loading || (!locked && !complete)}>{submitLabel}</Button></Stack>
            </DevNote>

            <Button variant="secondary" disabled={loading} onClick={() => { window.location.href = 'recuperar-senha.html'; }}>
              Voltar e alterar o e-mail
            </Button>
          </Stack>
        </Stack>
      </form>
    </AuthLayout>
  );
}

mountScreen(<CodigoVerificacaoScreen />);
