import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { IconCircle, IconCircleCheck, IconEye, IconEyeOff } from '@tabler/icons-react';
import { Button, Checkbox, Dialog, Feedback, Input, Stack } from '@maglev/ds';
import { AuthLayout } from './AuthLayout';
import { DevNote } from './dev-notes/DevNote';
import { useHashState } from './useHashState';
import { PASSWORD_CRITERIA as CRITERIA } from './recovery';
import { requiredMessage } from './format';
import { LegalText } from '../../assinante/shared/legal-placeholder';

import './primeiro-acesso.css';

/**
 * Primeiro acesso via convite - tela única do Admin e da Área do assinante (RF003 do assinante); cada frente passa por props
 * o texto, os dados do convidado e o que acontece ao ativar a conta. Não duplicar: ajuste de comportamento comum é aqui.
 *
 * Estados (o navegador de protótipo abre cada um via #state=):
 *  idle · required · criteriaunmet · mismatch · termsrequired · expired (link expirado) · used (link já utilizado)
 */
const STATES = ['idle', 'required', 'criteriaunmet', 'mismatch', 'termsrequired', 'expired', 'used'] as const;
type Mode = (typeof STATES)[number];

export interface PrimeiroAcessoCoreProps {
  /** Subtítulo da tela (quem convidou). */
  intro: ReactNode;
  /** Nome informado no convite (editável) e e-mail do convite (somente leitura). */
  initialName: string;
  email: string;
  /** O convite já não está pendente (a conta foi ativada): abre a tela de link já utilizado. */
  used: boolean;
  /** Orientação de quem pedir novo convite / quem contatar, por frente. */
  expired: { title: string; message: string };
  usedInfo: { title: string; message: string };
  /** Notas para desenvolvimento da frente. */
  notes: { link: string; data: string };
  /** Ativa a conta (e redireciona). Chamada ~0,7 s depois do envio válido. */
  onActivate: (name: string, password: string) => void;
  /** Destino de “Ir para o login”. */
  loginHref: string;
}

export function PrimeiroAcessoCore({ intro, initialName, email, used, expired, usedInfo, notes, onActivate, loginHref }: PrimeiroAcessoCoreProps) {
  const [mode, go, setMode] = useHashState<Mode>(STATES, 'idle');
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);

  const isExpired = mode === 'expired'; // link vence em 7 dias (💡) - no protótipo só pela variante
  const isUsed = mode === 'used' || (mode !== 'expired' && !loading && used);

  const met = CRITERIA.map((c) => c.test(password));
  const allMet = met.every(Boolean);

  // Variantes abertas pelo navegador de protótipo (idempotente para estados vindos de uso real).
  useEffect(() => {
    if (mode === 'required' && (name || password || confirm)) { setName(''); setPassword(''); setConfirm(''); }
    if (mode === 'criteriaunmet' && (allMet || !password)) { setPassword('abc'); setConfirm(''); }
    if (mode === 'mismatch' && password === confirm) { setPassword('Segura@123'); setConfirm('Diferente@456'); }
    if (mode === 'termsrequired' && !(password && confirm)) { setPassword('Segura@123'); setConfirm('Segura@123'); setTerms(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const nameError = mode === 'required' && !name.trim() ? requiredMessage('Nome completo') : undefined;
  const passwordError =
    mode === 'required' && !password ? requiredMessage('Senha')
    : mode === 'criteriaunmet' && !allMet ? 'A senha não atende a todos os critérios'
    : undefined;
  const confirmError =
    mode === 'required' && !confirm ? requiredMessage('Confirmar senha')
    : mode === 'mismatch' && password !== confirm ? 'As senhas informadas não coincidem'
    : undefined;
  const termsError = mode === 'termsrequired' && !terms ? 'Aceite os Termos de Uso para continuar' : undefined;

  const clearErrors = () => { if (mode === 'required' || mode === 'criteriaunmet' || mode === 'mismatch' || mode === 'termsrequired') setMode('idle'); };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password || !confirm) return go('required');
    if (!allMet) return go('criteriaunmet');
    if (password !== confirm) return go('mismatch');
    if (!terms) return go('termsrequired');
    setMode('idle');
    setLoading(true);
    window.setTimeout(() => onActivate(name.trim(), password), 700);
  };

  const eye = (visible: boolean, toggle: () => void, label: string) => ({
    icon: visible ? <IconEyeOff size={20} /> : <IconEye size={20} />,
    label: visible ? `Ocultar ${label}` : `Mostrar ${label}`,
    pressed: visible,
    onClick: toggle,
  });

  if (isExpired || isUsed) {
    return (
      <AuthLayout title="Primeiro acesso">
        <DevNote note={notes.link}>
          {isExpired
            ? <Feedback type="warning" title={expired.title} message={expired.message} />
            : <Feedback type="info" title={usedInfo.title} message={usedInfo.message} />}
        </DevNote>
        <Button onClick={() => { window.location.href = loginHref; }}>Ir para o login</Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Primeiro acesso" subtitle={intro}>
      <form onSubmit={onSubmit} noValidate>
        <Stack gap="xl">
          <DevNote note={notes.data}>
            <section className="flow-section" aria-labelledby="sec-data">
              <header className="flow-head">
                <h2 id="sec-data" className="flow-title">Seus dados</h2>
                <p className="flow-subtitle">Confira seus dados antes de ativar a conta</p>
              </header>
              <div>
                <Stack gap="md">
                  <Input
                    id="invite-name" label="Nome completo" name="name" required autoComplete="name"
                    value={name} disabled={loading}
                    onChange={(e) => { setName(e.target.value); clearErrors(); }}
                    error={nameError}
                  />
                  <Input label="E-mail" name="email" value={email} readOnly />
                </Stack>
              </div>
            </section>
          </DevNote>

          <section className="flow-section" aria-labelledby="sec-password">
            <header className="flow-head">
              <h2 id="sec-password" className="flow-title">Crie sua senha</h2>
              <p className="flow-subtitle">Defina uma senha para acessar a plataforma</p>
            </header>
            <div>
              <Stack gap="lg">
                <Stack gap="md">
                  <Stack gap="sm">
                    <Input
                      id="new-password"
                      label="Senha"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      required
                      autoComplete="new-password"
                      placeholder="Crie sua senha"
                      value={password}
                      disabled={loading}
                      onChange={(e) => { setPassword(e.target.value); clearErrors(); }}
                      error={passwordError}
                      iconRightAction={eye(showPassword, () => setShowPassword((v) => !v), 'senha')}
                    />
                    <DevNote note="Política de senha igual à do Admin (RF002-RGN003 / RNF019): mínimo de 8 caracteres, com maiúscula, minúscula e caractere especial.">
                      <ul className="pwd-criteria" aria-label="Critérios da senha">
                        {CRITERIA.map((c, i) => (
                          <li key={c.id} className={`pwd-criteria-item${met[i] ? ' is-met' : mode === 'criteriaunmet' ? ' is-unmet-error' : ''}`}>
                            {met[i] ? <IconCircleCheck size={16} aria-hidden="true" /> : <IconCircle size={16} aria-hidden="true" />}
                            <span>{c.label}</span>
                            <span className="sr-only">{met[i] ? ' (atendido)' : ' (não atendido)'}</span>
                          </li>
                        ))}
                      </ul>
                    </DevNote>
                  </Stack>

                  <Input
                    id="confirm-password"
                    label="Confirmar senha"
                    type={showConfirm ? 'text' : 'password'}
                    name="confirmPassword"
                    required
                    autoComplete="new-password"
                    placeholder="Digite a senha novamente"
                    value={confirm}
                    disabled={loading}
                    onChange={(e) => { setConfirm(e.target.value); clearErrors(); }}
                    error={confirmError}
                    iconRightAction={eye(showConfirm, () => setShowConfirm((v) => !v), 'confirmação de senha')}
                  />

                  <DevNote note="Aceite obrigatório dos Termos de Uso; a Política de Privacidade é de ciência, não de consentimento: o checkbox não infere base legal. Cada documento é um link que abre o seu modal (sem botão Aceitar: o aceite é o checkbox). 💡 Redação provisória, a validar com cliente/jurídico/DPO; textos dos documentos são placeholder.">
                    <Checkbox
                      label={(
                        <span className="consent-text">
                          Li e aceito os{' '}
                          <button type="button" className="legal-link" onClick={() => setLegal('terms')}>Termos de Uso</button>
                          {' '}e declaro estar ciente da{' '}
                          <button type="button" className="legal-link" onClick={() => setLegal('privacy')}>Política de Privacidade</button>.
                        </span>
                      )}
                      checked={terms}
                      disabled={loading}
                      onChange={(e) => { setTerms(e.target.checked); clearErrors(); }}
                      error={termsError}
                    />
                  </DevNote>
                </Stack>

                <Button type="submit" disabled={loading}>{loading ? 'Ativando conta...' : 'Ativar conta'}</Button>
              </Stack>
            </div>
          </section>
        </Stack>
      </form>

      <Dialog
        open={legal === 'terms'} onClose={() => setLegal(null)} size="lg" className="dialog-legal"
        title="Termos de Uso" subtitle="Leia os termos aplicáveis ao uso da plataforma Maglev"
      >
        <LegalText kind="terms" label="Texto dos Termos de Uso" />
      </Dialog>
      <Dialog
        open={legal === 'privacy'} onClose={() => setLegal(null)} size="lg" className="dialog-legal"
        title="Política de Privacidade" subtitle="Entenda como seus dados pessoais são tratados na plataforma Maglev"
      >
        <LegalText kind="privacy" label="Texto da Política de Privacidade" />
      </Dialog>
    </AuthLayout>
  );
}
