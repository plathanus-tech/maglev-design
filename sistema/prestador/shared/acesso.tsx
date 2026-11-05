import { FormEvent, useEffect, useState } from 'react';
import { Button, Feedback, Input, Stack } from '@maglev/ds';
import { AuthLayout, mountScreen } from '../../admin/shared/AuthLayout';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useHashState } from '../../admin/shared/useHashState';
import { PHONE_INVALID_MESSAGE, formatPhone, isValidPhone, requiredMessage } from '../../admin/shared/format';
import { param } from '../../assinante/shared/ui';
import { getSubDb } from '../../assinante/shared/store';
import { OTP_CODE, SESSION_HOURS, safeNext, setPending } from './otp-session';

/** Estados: idle · expired (sessão venceu: confirmar de novo) · required · invalid (celular inválido) · senderror (falha ao enviar o código) */
const STATES = ['idle', 'expired', 'required', 'invalid', 'senderror'] as const;
type Mode = (typeof STATES)[number];

/**
 * Acesso do Prestador de serviço, passo 1 (Prestador RF001): sem senha e sem cadastro; a pessoa informa o celular cadastrado e recebe um código
 * por SMS (passo 2: acesso-codigo). Mesmo padrão visual da recuperação de senha, mas pensado para o celular e para quem chegou por um link.
 */
function AcessoScreen() {
  const [mode, go, setMode] = useHashState<Mode>(STATES, 'idle');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const next = safeNext(param('next'));

  useEffect(() => {
    if (mode === 'required') setPhone((v) => (v.trim() ? '' : v));
    if (mode === 'invalid') setPhone((v) => (v && !isValidPhone(v) ? v : '(48) 9999'));
  }, [mode]);

  const error = mode === 'required' && !phone.trim() ? requiredMessage('Celular') : mode === 'invalid' && !isValidPhone(phone) ? PHONE_INVALID_MESSAGE : undefined;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return go('required');
    if (!isValidPhone(phone)) return go('invalid');
    setMode('idle');
    setLoading(true);
    window.setTimeout(() => {
      setPending({ phone, next, p: param('p') || undefined });
      window.location.href = 'acesso-codigo.html';
    }, 700);
  };

  // Protótipo: números de exemplo (contato principal e um técnico do primeiro prestador ativo com técnicos)
  const sample = getSubDb().providers.find((p) => p.status === 'ativo' && p.technicians.length > 0);
  const samplePhones = sample
    ? [sample.contacts.find((c) => c.main)?.phone ?? sample.contacts[0]?.phone, sample.technicians[0]?.phone].filter(Boolean).map((p) => formatPhone(String(p)))
    : [];

  return (
    <AuthLayout title="Acesso do prestador" subtitle="Informe seu celular para receber um código de verificação e acessar suas OS com segurança">
      {mode === 'expired' && (
        <DevNote note={`Por segurança, o acesso vale por ${SESSION_HOURS} horas (💡 a confirmar com o cliente) e depois o código é pedido de novo: confirma que quem está usando é a pessoa certa, mesmo que o link tenha sido encaminhado.`}>
          <Feedback type="info" title="Confirme seu acesso" message="Por segurança, o código é pedido de tempos em tempos. Informe seu celular para receber um novo código" />
        </DevNote>
      )}
      {mode === 'senderror' && <Feedback type="error" title="Não foi possível enviar o código de verificação" message="Tente novamente." />}

      <form onSubmit={onSubmit} noValidate>
        <Stack gap="lg">
          <DevNote note={`Prestador RF001 (acesso): o link continua identificando o prestador, mas só abre depois do código por SMS enviado ao celular cadastrado (contato do prestador ou do técnico). Celular de técnico enxerga só as OS dele. A mesma tela serve para quem abre sem link. Protótipo: use ${samplePhones.length ? samplePhones.join(' ou ') : 'o celular de um contato ou técnico cadastrado'} e o código ${OTP_CODE}. A resposta não revela se o número está cadastrado (a próxima tela é igual nos dois casos).`}>
            <Input
              id="provider-phone"
              label="Celular"
              type="tel"
              name="phone"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(00) 00000-0000"
              helperText="Use o número cadastrado pela empresa. Enviaremos um código por SMS"
              value={phone}
              disabled={loading}
              onChange={(e) => { setPhone(formatPhone(e.target.value)); if (mode !== 'idle' && mode !== 'expired') setMode('idle'); }}
              error={error}
            />
          </DevNote>
          <Button type="submit" disabled={loading}>{loading ? 'Enviando código...' : mode === 'senderror' ? 'Tentar novamente' : 'Enviar código'}</Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}

mountScreen(<AcessoScreen />);
