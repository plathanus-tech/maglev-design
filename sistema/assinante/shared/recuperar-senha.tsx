import { FormEvent, useEffect, useState } from 'react';
import { Button, Feedback, Input, Stack } from '@maglev/ds';
import { AuthLayout, mountScreen } from '../../admin/shared/AuthLayout';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useHashState } from '../../admin/shared/useHashState';
import { setRecoveryEmail } from '../../admin/shared/recovery';
import { isValidEmail, requiredMessage } from '../../admin/shared/format';
import { getDb as getAdminDb } from '../../admin/shared/store';
import { getSubDb } from './store';

/** Estados: idle · required · invalid (e-mail inválido) · senderror (falha ao enviar) · envinactive (ambiente desativado, RF001-RGN002) */
const STATES = ['idle', 'required', 'invalid', 'senderror', 'envinactive'] as const;
type Mode = (typeof STATES)[number];

function RecuperarSenhaScreen() {
  const [mode, go, setMode] = useHashState<Mode>(STATES, 'idle');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === 'required') setEmail((v) => (v.trim() ? '' : v));
    if (mode === 'invalid') setEmail((v) => (isValidEmail(v) || !v ? 'admin@invalido' : v));
    if (mode === 'senderror' || mode === 'envinactive') setEmail((v) => v || getSubDb().users[0].email);
  }, [mode]);

  const error =
    mode === 'required' && !email.trim() ? requiredMessage('E-mail')
    : mode === 'invalid' && !isValidEmail(email) ? 'Informe um e-mail válido'
    : undefined;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return go('required');
    if (!isValidEmail(email)) return go('invalid');
    // Ambiente desativado: o e-mail com o código não é enviado a nenhum usuário do assinante.
    const subscriber = getAdminDb().subscribers.find((s) => s.id === getSubDb().subscriberId);
    if (subscriber?.status === 'inativo') return go('envinactive');
    setMode('idle');
    setLoading(true);
    window.setTimeout(() => {
      setRecoveryEmail(email.trim());
      window.location.href = 'codigo-verificacao.html';
    }, 700);
  };

  const onChange = (value: string) => {
    setEmail(value);
    if (mode !== 'idle') setMode('idle');
  };

  return (
    <AuthLayout title="Recuperar senha" subtitle="Informe seu e-mail para receber um código de verificação">
      {mode === 'senderror' && (
        <Feedback type="error" title="Não foi possível enviar o código de verificação" message="Tente novamente." />
      )}
      {mode === 'envinactive' && (
        <DevNote note="RF001-RGN002 aplicado à recuperação: usuário de ambiente desativado não recebe o e-mail com o código. 💡 Definir se a tela revela o motivo (como aqui) ou mantém a mensagem genérica da etapa seguinte, para não expor quais ambientes existem.">
          <Feedback type="error" title="Acesso indisponível" message="Não foi possível acessar a plataforma no momento. Entre em contato com o suporte Maglev para obter ajuda" link={{ label: 'Falar com o suporte', href: 'mailto:suporte@maglev.com.br' }} />
        </DevNote>
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
            placeholder="nome@suaempresa.com.br"
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
