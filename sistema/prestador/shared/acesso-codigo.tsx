import { FormEvent, useEffect, useRef, useState } from 'react';
import { Badge, Button, Feedback, Stack } from '@maglev/ds';
import { AuthLayout, mountScreen } from '../../admin/shared/AuthLayout';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { OTP_LENGTH, OtpInput, OtpInputHandle } from '../../admin/shared/OtpInput';
import { useHashState } from '../../admin/shared/useHashState';
import { maskPhone } from '../../admin/shared/format';
import { getSubDb } from '../../assinante/shared/store';
import { OTP_CODE, OTP_EXPIRY_SECONDS, OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS, clearPending, getPending, identifyByPhone, safeNext, startSession } from './otp-session';

/** Estados: idle · incorrect (código incorreto) · expired (código expirou) · toomany (excedeu tentativas) · commerror (falha ao validar) */
const STATES = ['idle', 'incorrect', 'expired', 'toomany', 'commerror'] as const;
type Mode = (typeof STATES)[number];

const mmss = (total: number) => {
  const s = Math.max(total, 0);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Acesso do Prestador, passo 2: código de 6 dígitos (mesmo padrão da recuperação de senha). Sucesso → sessão e volta ao destino do link (ou Minhas OS). */
function AcessoCodigoScreen() {
  const [mode, go, setMode] = useHashState<Mode>(STATES, 'idle');
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [expiresIn, setExpiresIn] = useState(OTP_EXPIRY_SECONDS);
  const [cooldown, setCooldown] = useState(OTP_RESEND_SECONDS);
  const [justResent, setJustResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const attempts = useRef(0);
  const otp = useRef<OtpInputHandle>(null);
  const pending = getPending();
  const phone = maskPhone(pending?.phone || '48999990000');

  const locked = mode === 'expired' || mode === 'toomany';
  const code = digits.join('');
  const complete = code.length === OTP_LENGTH;

  useEffect(() => {
    if (mode === 'incorrect') setDigits((d) => (d.every(Boolean) ? d : Array(OTP_LENGTH).fill('9')));
    if (mode === 'commerror') setDigits((d) => (d.every(Boolean) ? d : ['1', '2', '3', '4', '5', '6']));
    if (mode === 'expired') setExpiresIn(0);
    if (mode === 'toomany') attempts.current = OTP_MAX_ATTEMPTS;
  }, [mode]);
  useEffect(() => { otp.current?.focus(0); }, []);
  useEffect(() => {
    const id = window.setInterval(() => {
      setExpiresIn((s) => Math.max(s - 1, 0));
      setCooldown((s) => Math.max(s - 1, 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => { if (expiresIn === 0 && mode !== 'expired' && mode !== 'toomany') go('expired'); }, [expiresIn, mode, go]);

  const error = mode === 'incorrect' ? 'Código incorreto. Verifique e tente novamente.' : undefined;
  const clearError = () => { if (mode === 'incorrect' || mode === 'commerror') setMode('idle'); };

  const resetFlow = () => {
    attempts.current = 0;
    setDigits(Array(OTP_LENGTH).fill(''));
    setExpiresIn(OTP_EXPIRY_SECONDS);
    setCooldown(OTP_RESEND_SECONDS);
    setMode('idle');
    if (location.hash) history.replaceState(null, '', location.pathname);
    window.setTimeout(() => otp.current?.focus(0), 0);
  };
  const onResend = () => {
    if (cooldown > 0) return;
    resetFlow();
    setJustResent(true);
    window.setTimeout(() => setJustResent(false), 2500);
  };

  /** Código certo, mas só entra quem é dono do celular (e, vindo de um link, do prestador do link): senão a resposta é a mesma de código incorreto */
  const validate = () => {
    const identity = pending ? identifyByPhone(getSubDb(), pending.phone, pending.p) : null;
    if (!identity) return false;
    setLoading(true);
    startSession({ providerId: identity.provider.id, technicianId: identity.technician?.id });
    clearPending();
    const dest = safeNext(pending?.next) ?? `minhas-os.html?p=${identity.provider.id}${identity.technician ? `&tec=${identity.technician.id}` : ''}`;
    window.setTimeout(() => { window.location.href = dest; }, 500);
    return true;
  };
  const fail = () => {
    attempts.current += 1;
    if (attempts.current >= OTP_MAX_ATTEMPTS) return go('toomany');
    go('incorrect');
    otp.current?.focus(0);
  };

  useEffect(() => {
    if (code === OTP_CODE && !locked && !loading && mode !== 'commerror' && !validate()) fail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (locked) return resetFlow();
    if (!complete) return;
    if (code === OTP_CODE && validate()) return;
    fail();
  };

  return (
    <AuthLayout
      title="Código de verificação"
      subtitle={<>Se o celular estiver cadastrado, o código será enviado por SMS para <strong>{phone}</strong></>}
      subtitleNote="Celular exibido anonimizado (DDD e 4 últimos dígitos). A mensagem é a mesma exista ou não o cadastro, e um código correto só vale para o dono do número (e, vindo de um link, para o prestador do link), para não revelar quais celulares estão cadastrados."
    >
      {mode === 'expired' && <Feedback type="warning" title="Seu código expirou" message="Solicite um novo código para continuar." />}
      {mode === 'toomany' && <Feedback type="error" title="Você excedeu o número de tentativas" message="Solicite um novo código." />}
      {mode === 'commerror' && <Feedback type="error" title="Não foi possível validar o código no momento" message="Tente novamente." />}

      <form onSubmit={onSubmit} noValidate>
        <Stack gap="lg">
          <Stack gap="md">
            <OtpInput ref={otp} digits={digits} onChange={setDigits} onEdit={clearError} disabled={locked || loading} error={error} />
            <Stack gap="xs" align="center">
              <p className="page-text page-text--center" role="timer">
                {expiresIn > 0 ? <>O código expira em {expiresIn <= 30 ? <Badge status="warning">{mmss(expiresIn)}</Badge> : <strong>{mmss(expiresIn)}</strong>}</> : 'O código expirou'}
              </p>
              {!justResent && cooldown > 0 && <p className="page-text page-text--center">Reenvio disponível após {OTP_RESEND_SECONDS} segundos</p>}
              <div aria-live="polite">
                {justResent ? <Badge status="success" dot>Código reenviado!</Badge> : cooldown === 0 && <Button variant="ghost" size="sm" onClick={onResend}>Não recebeu o código? Reenviar código</Button>}
              </div>
            </Stack>
          </Stack>
          <Stack gap="md">
            <DevNote note="Botão desabilitado até os 6 dígitos serem preenchidos; com o código correto a validação e o redirecionamento são automáticos. Validade do código 5 min, reenvio a cada 30 s e bloqueio após 5 tentativas (💡 limites a confirmar). Protótipo: o único código aceito é 111111.">
              <Stack><Button type="submit" disabled={loading || (!locked && !complete)}>{loading ? 'Validando...' : locked ? 'Enviar novo código' : 'Continuar'}</Button></Stack>
            </DevNote>
            <Button variant="secondary" disabled={loading} onClick={() => { window.location.href = 'acesso.html'; }}>Voltar e alterar o celular</Button>
          </Stack>
        </Stack>
      </form>
    </AuthLayout>
  );
}

mountScreen(<AcessoCodigoScreen />);
