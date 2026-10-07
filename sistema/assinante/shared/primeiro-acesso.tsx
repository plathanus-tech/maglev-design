import { FormEvent, useEffect, useState } from 'react';
import { IconCircle, IconCircleCheck, IconEye, IconEyeOff } from '@tabler/icons-react';
import { Button, Checkbox, Dialog, Feedback, Input, Stack } from '@maglev/ds';
import { AuthLayout, mountScreen } from '../../admin/shared/AuthLayout';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useHashState } from '../../admin/shared/useHashState';
import { PASSWORD_CRITERIA as CRITERIA, setPrototypePassword } from '../../admin/shared/recovery';
import { requiredMessage } from '../../admin/shared/format';
import { SubUser } from './data';
import { useDb as useAdminDb } from '../../admin/shared/store';
import { setSubSessionUser, updateSubDb, useSubDb } from './store';
import { param } from './ui';
import { LegalText } from './legal-placeholder';

import './primeiro-acesso.css';

/**
 * Estados (o navegador de protótipo abre cada um via #state=):
 *  idle · required · criteriaunmet · mismatch · termsrequired · expired (link expirado, CTA002) · used (link já utilizado, RGN003)
 */
const STATES = ['idle', 'required', 'criteriaunmet', 'mismatch', 'termsrequired', 'expired', 'used'] as const;
type Mode = (typeof STATES)[number];

function PrimeiroAcessoScreen() {
  const db = useSubDb();
  const admin = useAdminDb();
  const [mode, go, setMode] = useHashState<Mode>(STATES, 'idle');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);

  // Convite: ?id= (padrão: o primeiro usuário com convite pendente).
  const id = param('id');
  const invited: SubUser | undefined = id ? db.users.find((u) => u.id === id) : db.users.find((u) => u.status === 'convite');
  const reference = invited ?? db.users.find((u) => u.status === 'convite') ?? db.users[0];
  const [name, setName] = useState(reference.name);
  const company = admin.subscribers.find((s) => s.id === db.subscriberId)?.tradeName ?? '';
  const isExpired = mode === 'expired'; // RGN002: link vence em 7 dias (💡) - no protótipo só pela variante
  const isUsed = mode === 'used' || (mode !== 'expired' && !loading && (!invited || invited.status !== 'convite'));

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
    window.setTimeout(() => {
      // Ativa o usuário (RF003-FLU004), guarda a senha do protótipo e entra com o perfil dele.
      updateSubDb((d) => ({ ...d, users: d.users.map((u) => (u.id === reference.id ? { ...u, name: name.trim(), status: 'ativo', invitedAt: undefined } : u)) }));
      setPrototypePassword(password);
      setSubSessionUser(reference.id);
      window.location.href = 'inicio.html';
    }, 700);
  };

  const eye = (visible: boolean, toggle: () => void, name: string) => ({
    icon: visible ? <IconEyeOff size={20} /> : <IconEye size={20} />,
    label: visible ? `Ocultar ${name}` : `Mostrar ${name}`,
    pressed: visible,
    onClick: toggle,
  });

  if (isExpired || isUsed) {
    return (
      <AuthLayout title="Primeiro acesso">
        <DevNote note="RF003-CTA002 / RGN002 / RGN003: link expirado (💡 7 dias) ou já utilizado (uso único); não há formulário nesses casos, então o subtítulo de ativação não aparece. Expirado = atenção (warning); já utilizado = informativo. O sistema só sabe que o link foi usado, não por quem, então a mensagem não afirma que a pessoa ativou a conta. Nos dois casos “Ir para o login” é a ação primária (a única disponível na interface; quem chega pelo link do convite não necessariamente veio do login), e a orientação de pedir novo convite fica no alert.">
          {isExpired
            ? <Feedback type="warning" title="O link do convite expirou" message="Entre em contato com o administrador da sua empresa para solicitar um novo convite." />
            : <Feedback type="info" title="Este link de convite já foi utilizado" message="Se você já ativou sua conta, acesse a plataforma pelo login. Caso não reconheça essa ativação ou precise de ajuda, entre em contato com o administrador da sua empresa." />}
        </DevNote>
        <Button onClick={() => { window.location.href = 'login.html'; }}>Ir para o login</Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Primeiro acesso" subtitle={<>Você recebeu um convite da <strong>{company}</strong>. Crie sua senha para concluir seu acesso</>}>
      <form onSubmit={onSubmit} noValidate>
        <Stack gap="xl">
          <DevNote note="RF003-RGN004: no primeiro acesso o convidado confirma o nome e define a senha. Nome completo vem preenchido com o informado pelo administrador no convite e é o único dado editável; o e-mail (endereço do convite, usado para acessar) é um input somente leitura (readOnly), sem edição. Celular, perfil de acesso, unidades e empresa não fazem parte desta etapa; a empresa aparece no texto introdutório.">
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
                  <Input label="E-mail" name="email" value={reference.email} readOnly />
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
              <DevNote note="Política de senha igual à do Admin (RF003-RGN006 → RF002-RGN003 / RNF019): mínimo de 8 caracteres, com maiúscula, minúscula e caractere especial.">
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

            <DevNote note="Aceite obrigatório dos Termos de Uso (RF003-FLU003); a Política de Privacidade é de ciência, não de consentimento: o checkbox não infere base legal. Cada documento é um link que abre o seu modal (sem botão Aceitar: o aceite é o checkbox). 💡 Redação provisória, a validar com cliente/jurídico/DPO; textos dos documentos são placeholder.">
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

mountScreen(<PrimeiroAcessoScreen />);
