import { FormEvent, useEffect, useState } from 'react';
import { IconCircle, IconCircleCheck, IconEye, IconEyeOff } from '@tabler/icons-react';
import { Button, Feedback, Input, Stack } from '@maglev/ds';
import { AuthLayout, mountScreen } from './AuthLayout';
import { useHashState } from './useHashState';
import { PASSWORD_CRITERIA as CRITERIA, clearRecoveryEmail, setPrototypePassword } from './recovery';
import { requiredMessage } from './format';
import { DevNote } from './dev-notes/DevNote';

/**
 * Estados (o navegador de protótipo abre cada um via #state=):
 *  idle · required (campos vazios) · criteriaunmet (critérios não atendidos)
 *  · mismatch (senhas diferentes) · saveerror (falha ao salvar)
 */
const STATES = ['idle', 'required', 'criteriaunmet', 'mismatch', 'saveerror'] as const;
type Mode = (typeof STATES)[number];


function CriarNovaSenhaScreen() {
  const [mode, go, setMode] = useHashState<Mode>(STATES, 'idle');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const met = CRITERIA.map((c) => c.test(password));
  const allMet = met.every(Boolean);

  // Variantes abertas pelo navegador de protótipo (idempotente para estados vindos de uso real).
  useEffect(() => {
    if (mode === 'required' && password && confirm) { setPassword(''); setConfirm(''); }
    if (mode === 'criteriaunmet' && (allMet || !password)) { setPassword('abc'); setConfirm(''); }
    if (mode === 'mismatch' && password === confirm) { setPassword('Segura@123'); setConfirm('Diferente@456'); }
    if (mode === 'saveerror' && !(password && confirm)) { setPassword('Segura@123'); setConfirm('Segura@123'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const showCriteriaErrors = mode === 'criteriaunmet';
  const passwordError =
    mode === 'required' && !password ? requiredMessage('Nova senha')
    : showCriteriaErrors && !allMet ? 'A senha não atende a todos os critérios'
    : undefined;
  const confirmError =
    mode === 'required' && !confirm ? requiredMessage('Confirmar nova senha')
    : mode === 'mismatch' && password !== confirm ? 'As senhas informadas não coincidem'
    : undefined;

  const clearErrors = () => {
    if (mode === 'required' || mode === 'criteriaunmet' || mode === 'mismatch') setMode('idle');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!password || !confirm) return go('required');
    if (!allMet) return go('criteriaunmet');
    if (password !== confirm) return go('mismatch');
    setMode('idle');
    setLoading(true);
    // O sucesso é resolvido no login (aviso "Senha alterada com sucesso"), sem etapa extra.
    window.setTimeout(() => {
      clearRecoveryEmail();
      setPrototypePassword(password);
      window.location.href = 'login.html#state=passwordchanged';
    }, 700);
  };

  const eye = (visible: boolean, toggle: () => void, name: string) => ({
    icon: visible ? <IconEyeOff size={20} /> : <IconEye size={20} />,
    label: visible ? `Ocultar ${name}` : `Mostrar ${name}`,
    pressed: visible,
    onClick: toggle,
  });

  return (
    <AuthLayout title="Criar nova senha" subtitle="Escolha uma senha segura para proteger sua conta">
      {mode === 'saveerror' && (
        <Feedback type="error" title="Não foi possível atualizar sua senha" message="Tente novamente." />
      )}

      <form onSubmit={onSubmit} noValidate>
        <Stack gap="lg">
          <Stack gap="md">
            <Stack gap="sm">
              <Input
                id="new-password"
                label="Nova senha"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                placeholder="Digite sua nova senha"
                value={password}
                disabled={loading}
                onChange={(e) => { setPassword(e.target.value); clearErrors(); }}
                error={passwordError}
                iconRightAction={eye(showPassword, () => setShowPassword((v) => !v), 'senha')}
                {...(mode === 'mismatch' ? { 'aria-invalid': true, 'aria-describedby': 'confirm-password-message' } : {})}
              />

              <DevNote note="Política de senha (RF002-RGN003 / RNF019): mínimo de 8 caracteres, com maiúsculas, minúsculas e caracteres especiais. Cada critério é um Badge: neutro com círculo vazio (pendente), sucesso com círculo com check (atendido) e erro (não atendido ao tentar salvar - CTA004). 💡 A confirmar com a cliente se número também é obrigatório - por isso não está na lista.">
                <ul className="pwd-criteria" aria-label="Critérios da senha">
                  {CRITERIA.map((c, i) => (
                    <li key={c.id} className={`pwd-criteria-item${met[i] ? " is-met" : showCriteriaErrors ? " is-unmet-error" : ""}`}>
                      {met[i] ? <IconCircleCheck size={16} aria-hidden="true" /> : <IconCircle size={16} aria-hidden="true" />}
                      <span>{c.label}</span>
                      <span className="sr-only">{met[i] ? " (atendido)" : " (não atendido)"}</span>
                    </li>
                  ))}
                </ul>
              </DevNote>
            </Stack>

            <Input
              id="confirm-password"
              label="Confirmar nova senha"
              type={showConfirm ? 'text' : 'password'}
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Digite a senha novamente"
              value={confirm}
              disabled={loading}
              onChange={(e) => { setConfirm(e.target.value); clearErrors(); }}
              error={confirmError}
              iconRightAction={eye(showConfirm, () => setShowConfirm((v) => !v), 'confirmação de senha')}
            />
          </Stack>

          <Button type="submit" disabled={loading}>
            {loading ? 'Salvando...' : mode === 'saveerror' ? 'Tentar novamente' : 'Criar nova senha'}
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}

mountScreen(<CriarNovaSenhaScreen />);
