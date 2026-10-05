import { FormEvent, useEffect, useState } from 'react';
import { Button, Feedback, Input, Stack } from '@maglev/ds';
import { AuthLayout, mountScreen } from './AuthLayout';
import { useHashState } from './useHashState';
import { setRecoveryEmail } from './recovery';
import { CORPORATE_DOMAIN, isValidEmail, requiredMessage } from './format';

/** Estados: idle · required · invalid (e-mail inválido) · senderror (falha ao enviar o código) */
const STATES = ['idle', 'required', 'invalid', 'senderror'] as const;
type Mode = (typeof STATES)[number];

function RecuperarSenhaScreen() {
  const [mode, go, setMode] = useHashState<Mode>(STATES, 'idle');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Variantes abertas pelo navegador de protótipo preenchem o campo de exemplo.
  // (Idempotente: quando o estado veio de um envio real, o campo já é coerente e nada muda.)
  useEffect(() => {
    if (mode === 'required') setEmail((v) => (v.trim() ? '' : v));
    if (mode === 'invalid') setEmail((v) => (isValidEmail(v) || !v ? 'admin@invalido' : v));
    if (mode === 'senderror') setEmail((v) => v || 'ana.ribeiro@maglev.com.br');
  }, [mode]);

  const error =
    mode === 'required' && !email.trim() ? requiredMessage('E-mail')
    : mode === 'invalid' && !isValidEmail(email) ? 'Informe um e-mail válido'
    : undefined;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return go('required');
    if (!isValidEmail(email)) return go('invalid');
    setMode('idle');
    setLoading(true);
    window.setTimeout(() => {
      setRecoveryEmail(email.trim());
      window.location.href = 'codigo-verificacao.html';
    }, 700);
  };

  const onChange = (value: string) => {
    setEmail(value);
    if (mode === 'required' || mode === 'invalid') setMode('idle');
  };

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Informe seu e-mail para receber um código de verificação"
    >
      {mode === 'senderror' && (
        <Feedback type="error" title="Não foi possível enviar o código de verificação" message="Tente novamente." />
      )}

      <form onSubmit={onSubmit} noValidate>
        <Stack gap="lg">
          <Input
            id="recover-email"
            label="E-mail"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="username"
            placeholder={`nome${CORPORATE_DOMAIN}`}
            value={email}
            disabled={loading}
            onChange={(e) => onChange(e.target.value)}
            error={error}
          />

          <Stack gap="md">
            <Button type="submit" disabled={loading}>
              {loading ? 'Enviando código...' : mode === 'senderror' ? 'Tentar novamente' : 'Enviar código'}
            </Button>
            <Button variant="secondary" disabled={loading} onClick={() => { window.location.href = 'login.html'; }}>
              Voltar para o login
            </Button>
          </Stack>
        </Stack>
      </form>
    </AuthLayout>
  );
}

mountScreen(<RecuperarSenhaScreen />);
