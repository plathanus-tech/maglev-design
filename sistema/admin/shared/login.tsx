import { FormEvent, useEffect, useRef, useState } from 'react';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { Button, Feedback, Input, Stack } from '@maglev/ds';
import { AuthLayout, mountScreen } from './AuthLayout';
import { useHashState } from './useHashState';
import { getPrototypePassword } from './recovery';
import { CORPORATE_DOMAIN, isCorporateEmail, isValidEmail, requiredMessage } from './format';
import { getDb, setSessionUser } from './store';
import { DevNote } from './dev-notes/DevNote';

/**
 * Estados (o navegador de protótipo abre cada um via #state=):
 *  idle · required · invalid (credenciais incorretas - mensagem genérica, RF001-FLU005)
 *  · domain (e-mail fora de @maglev.com.br - RGN005) · inactive (usuário inativo - RGN001)
 *  · passwordchanged (retorno da recuperação de senha)
 */
const STATES = ['idle', 'required', 'invalid', 'domain', 'inactive', 'passwordchanged'] as const;
type Mode = (typeof STATES)[number];

const INVALID_MESSAGE = 'E-mail ou senha incorretos. Esqueceu a sua senha? Clique em “Esqueci minha senha” para recuperá-la.';
const DOMAIN_MESSAGE = `Use seu e-mail corporativo ${CORPORATE_DOMAIN}`;

function LoginScreen() {
  const [mode, go, setMode] = useHashState<Mode>(STATES, 'idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const focusAfterSubmit = useRef(false);

  // Variantes abertas pelo navegador preenchem um exemplo coerente.
  useEffect(() => {
    if (mode === 'domain') setEmail((v) => (v && !isCorporateEmail(v) ? v : 'ana.ribeiro@gmail.com'));
    if (mode === 'inactive') setEmail((v) => v || 'kleber.antunes@maglev.com.br');
  }, [mode]);

  const invalid = mode === 'invalid';
  const emailError =
    mode === 'required' && !email.trim() ? requiredMessage('E-mail')
    : mode === 'domain' ? DOMAIN_MESSAGE
    : undefined;
  const passwordError = mode === 'required' && !password ? requiredMessage('Senha') : invalid ? INVALID_MESSAGE : undefined;

  useEffect(() => {
    if (!focusAfterSubmit.current || mode === 'idle') return;
    focusAfterSubmit.current = false;
    document.getElementById(mode === 'required' && email.trim() ? 'login-password' : 'login-email')?.focus();
  }, [mode, email]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    focusAfterSubmit.current = true;
    if (!email.trim() || !password) return go('required');
    if (isValidEmail(email) && !isCorporateEmail(email)) return go('domain');
    if (!isValidEmail(email) || password !== getPrototypePassword()) return go('invalid');
    const db = getDb();
    const user = db.adminUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (user?.status === 'inativo') return go('inactive');
    focusAfterSubmit.current = false;
    setSessionUser(user?.id ?? 'USR-0001');
    setMode('idle');
    setLoading(true);
    window.setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
  };

  const clearErrors = () => { if (['invalid', 'required', 'domain', 'inactive'].includes(mode)) setMode('idle'); };

  return (
    <AuthLayout title="Acesse o painel administrativo" subtitle="Entre com seu e-mail corporativo para acessar o painel da Maglev">
      {mode === 'passwordchanged' && (
        <Feedback type="success" title="Senha alterada com sucesso" message="Faça login com sua nova senha." />
      )}
      {mode === 'inactive' && (
        <DevNote note="RF001-RGN001 / CTA003: só usuários Ativos acessam. O aviso aparece apenas depois de e-mail e senha corretos, para não revelar contas a quem não tem a senha.">
          <Feedback type="error" title="Seu acesso está inativo" message="Fale com um administrador da plataforma para reativar o seu usuário." />
        </DevNote>
      )}

      <form onSubmit={onSubmit} noValidate>
        <Stack gap="lg">
          <Stack gap="md">
            <DevNote note={`Somente e-mails do domínio ${CORPORATE_DOMAIN} acessam o Admin (RF001-RGN005, RNF021). E-mails pessoais (Gmail, Outlook etc.) são recusados com a orientação abaixo do campo. O e-mail é o identificador único e não pode ser alterado pelo usuário.`}>
              <Input
                id="login-email"
                label="E-mail"
                type="email"
                name="email"
                inputMode="email"
                autoComplete="username"
                placeholder={`nome${CORPORATE_DOMAIN}`}
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearErrors(); }}
                error={emailError}
                {...(invalid ? { 'aria-invalid': true, 'aria-describedby': 'login-password-message' } : {})}
              />
            </DevNote>

            <Input
              id="login-password"
              label="Senha"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearErrors(); }}
              error={passwordError}
              iconRightAction={{
                icon: showPassword ? <IconEyeOff size={20} /> : <IconEye size={20} />,
                label: showPassword ? 'Ocultar senha' : 'Mostrar senha',
                pressed: showPassword,
                onClick: () => setShowPassword((v) => !v),
              }}
            />
          </Stack>

          <Stack gap="md">
            <DevNote note={<>Protótipo: qualquer e-mail {CORPORATE_DOMAIN} com a senha <strong>Maglev@123</strong> (ou a criada na recuperação). E-mails de usuários cadastrados entram com o perfil deles - ex.: <strong>debora.lins@maglev.com.br</strong> (Suporte, sem permissão de inativar). <strong>kleber.antunes@maglev.com.br</strong> está inativo. 💡 Bloqueio após N tentativas e expiração de sessão seguem a confirmar (RGN003/RGN004).</>}>
              <Stack><Button type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button></Stack>
            </DevNote>
            <Button variant="ghost" onClick={() => { window.location.href = 'recuperar-senha.html'; }}>Esqueci minha senha</Button>
          </Stack>
        </Stack>
      </form>
    </AuthLayout>
  );
}

mountScreen(<LoginScreen />);
