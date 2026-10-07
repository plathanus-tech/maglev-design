import { FormEvent, useEffect, useRef, useState } from 'react';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { Button, Feedback, Input, Stack, useToast } from '@maglev/ds';
import { AuthLayout, mountScreen } from '../../admin/shared/AuthLayout';
import { useHashState } from '../../admin/shared/useHashState';
import { getPrototypePassword } from '../../admin/shared/recovery';
import { isValidEmail, requiredMessage } from '../../admin/shared/format';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { getDb as getAdminDb } from '../../admin/shared/store';
import { getSubDb, setSubSessionUser } from './store';

/**
 * Estados (o navegador de protótipo abre cada um via #state=):
 *  idle · required · invalid (credenciais incorretas, mensagem genérica - RF001-FLU005) · inactive (usuário inativo - RGN001)
 *  · pending (convite ainda não aceito) · envinactive (ambiente desativado - RGN002) · passwordchanged (retorno da recuperação)
 */
const STATES = ['idle', 'required', 'invalid', 'inactive', 'pending', 'envinactive', 'passwordchanged'] as const;
type Mode = (typeof STATES)[number];

const INVALID_MESSAGE = 'E-mail ou senha incorretos. Esqueceu a sua senha? Clique em “Esqueci minha senha” para recuperá-la.';
const CLEARABLE: Mode[] = ['invalid', 'required', 'inactive', 'pending', 'envinactive'];

function LoginScreen() {
  const toast = useToast();
  const [mode, go, setMode] = useHashState<Mode>(STATES, 'idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const focusAfterSubmit = useRef(false);

  // Variantes abertas pelo navegador preenchem um exemplo coerente.
  useEffect(() => {
    const users = getSubDb().users;
    if (mode === 'inactive') setEmail((v) => v || users.find((u) => u.status === 'inativo')?.email || '');
    if (mode === 'pending') setEmail((v) => v || users.find((u) => u.status === 'convite')?.email || '');
    if (mode === 'envinactive') setEmail((v) => v || users.find((u) => u.profile === 'administrador')?.email || '');
  }, [mode]);

  // Retorno da recuperação de senha: aviso temporário (Toast), some sozinho
  useEffect(() => {
    if (mode === 'passwordchanged') toast.show({ type: 'success', title: 'Senha alterada com sucesso', message: 'Faça login com sua nova senha.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const invalid = mode === 'invalid';
  const emailError = mode === 'required' && !email.trim() ? requiredMessage('E-mail') : undefined;
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
    if (!isValidEmail(email) || password !== getPrototypePassword()) return go('invalid');
    // Ambiente do assinante desativado pela MAGLEV (Admin RF204): ninguém da empresa entra (RGN002).
    const db = getSubDb();
    const subscriber = getAdminDb().subscribers.find((s) => s.id === db.subscriberId);
    if (subscriber?.status === 'inativo') return go('envinactive');
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (user?.status === 'inativo') return go('inactive');
    if (user?.status === 'convite') return go('pending');
    focusAfterSubmit.current = false;
    setSubSessionUser((user ?? db.users.find((u) => u.profile === 'administrador' && u.status === 'ativo') ?? db.users[0]).id);
    setMode('idle');
    setLoading(true);
    window.setTimeout(() => { window.location.href = 'inicio.html'; }, 600);
  };

  const clearErrors = () => { if (CLEARABLE.includes(mode)) setMode('idle'); };

  return (
    <AuthLayout title="Acesse sua conta" subtitle="Entre com seu e-mail e senha para acessar a plataforma">
      {mode === 'inactive' && (
        <DevNote note="RF001-RGN001 / CTA003: só usuários Ativos acessam. O aviso aparece apenas depois de e-mail e senha corretos, para não revelar contas a quem não tem a senha.">
          <Feedback type="error" title="Seu acesso está inativo" message="Entre em contato com um administrador da sua empresa para solicitar a reativação" />
        </DevNote>
      )}
      {mode === 'pending' && (
        <Feedback type="info" title="Seu convite ainda não foi aceito" message="Use o link do convite enviado ao seu e-mail para criar sua senha e ativar o acesso." />
      )}
      {mode === 'envinactive' && (
        <DevNote note="RF001-RGN002: ambiente desativado pela MAGLEV (Admin RF204) bloqueia o login de todos os usuários do assinante, mesmo com credenciais corretas. O link “Falar com o suporte” abre o contato com o suporte MAGLEV (💡 canal a definir: e-mail, chat ou WhatsApp).">
          <Feedback type="error" title="Acesso indisponível" message="Não foi possível acessar a plataforma no momento. Entre em contato com o suporte Maglev para obter ajuda" link={{ label: 'Falar com o suporte', href: 'mailto:suporte@maglev.com.br' }} />
        </DevNote>
      )}

      <form onSubmit={onSubmit} noValidate>
        <Stack gap="lg">
          <Stack gap="md">
            <Input
              id="login-email"
              label="E-mail"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="username"
              placeholder="nome@suaempresa.com.br"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearErrors(); }}
              error={emailError}
              {...(invalid ? { 'aria-invalid': true, 'aria-describedby': 'login-password-message' } : {})}
            />
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
            <DevNote note={<>Protótipo: e-mail de um usuário da equipe + senha <strong>Maglev@123</strong> (ou a criada na recuperação) entra com o perfil dele; qualquer outro e-mail válido entra como Administrador. Usuário inativo, convite pendente e ambiente desativado (RGN002) têm estados próprios. Sem restrição de domínio. 💡 Bloqueio após N tentativas e expiração de sessão a confirmar (RGN003/RGN004).</>}>
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
