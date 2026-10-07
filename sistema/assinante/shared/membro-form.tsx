import { FormEvent, useEffect, useState } from 'react';
import { IconHelpCircle, IconLock } from '@tabler/icons-react';
import { Badge, Button, Card, Checkbox, Dialog, Dropdown, Feedback, Input, RadioButton, Stack } from '@maglev/ds';
import { ChangePasswordDialog } from '../../admin/shared/ChangePasswordDialog';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useHashState } from '../../admin/shared/useHashState';
import { formatPhone, isValidEmail, isValidPhone, onlyDigits, requiredMessage } from '../../admin/shared/format';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { PROFILE_LABEL, PROFILE_OPTIONS, ProfileKey, SUBSCRIBER_ID, SubUser, USER_STATUS, UserStatus, nowLocal } from './data';
import { updateSubDb, useSubSession } from './store';
import { activeUnits, useFormFeedback } from './estrutura-utils';
import { Col, Grid, ReadField, Text, goTo, param, setFlash } from './ui';

/** Estados: idle · required · duplicate (e-mail já cadastrado) · profiles (modal "Perfis de acesso") */
const STATES = ['idle', 'required', 'duplicate', 'profiles'] as const;
type Mode = (typeof STATES)[number];

/** Perfis que dependem das unidades vinculadas (RF204): Solicitante/Gestor da unidade e Executor. Os demais veem todas. */
const needsUnits = (p: ProfileKey | '') => p === 'solicitante' || p === 'executor';

/** Resumo em linguagem simples do que cada perfil faz (lido das permissões de `PERMISSIONS` em data.ts, RF204-RGN004). */
const PROFILE_SUMMARY: Record<ProfileKey, { scope: string; text: string }> = {
  administrador: { scope: 'Vê todas as unidades', text: 'Tem acesso total: gerencia equipamentos, solicitações, ordens de serviço, planos, prestadores e a estrutura da empresa (dados, unidades, ambientes e usuários)' },
  gestor: { scope: 'Vê todas as unidades', text: 'Acompanha e gerencia equipamentos, solicitações, ordens de serviço, planos e prestadores, além de aprovar orçamentos. Consulta empresa, unidades e ambientes sem editar' },
  solicitante: { scope: 'Vê só as unidades vinculadas', text: 'Consulta equipamentos e ordens de serviço e abre solicitações para as unidades em que atua' },
  executor: { scope: 'Vê só as unidades vinculadas', text: 'Consulta equipamentos, solicitações e planos e atualiza as ordens de serviço que executa' },
};

function ProfilesDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      open onClose={onClose} size="md" title="Perfis de acesso" subtitle="Veja o que cada perfil permite fazer na plataforma"
    >
      <DevNote note="RGN004 💡 a confirmar: resumo do que cada perfil vê e faz, escrito a partir de PERMISSIONS (data.ts). RGN007 / P18 💡 conflito a resolver: em 28/09 a cliente disse que o controle de acesso por cargo é essencial, mas a lista dela deixa cargos personalizados fora do MVP; a spec mantém os 4 perfis fixos (RGN001) e perfis configuráveis ficam em ZC005.">
        <Stack gap="md">
          {(Object.keys(PROFILE_LABEL) as ProfileKey[]).map((p) => (
            <Stack key={p} gap="xs">
              <Text><strong>{PROFILE_LABEL[p]}</strong></Text>
              <Text>{PROFILE_SUMMARY[p].text}</Text>
              <p className="field-note">{PROFILE_SUMMARY[p].scope}</p>
            </Stack>
          ))}
        </Stack>
      </DevNote>
    </Dialog>
  );
}

function MembroFormScreen() {
  const { db, user: me } = useSubSession();
  const editingId = param('id');
  const editing = db.users.find((u) => u.id === editingId);
  const self = editing?.id === me.id;
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [name, setName] = useState(editing?.name ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [phone, setPhone] = useState(editing ? formatPhone(editing.phone) : '');
  const [profile, setProfile] = useState<ProfileKey | ''>(editing?.profile ?? '');
  const [unitIds, setUnitIds] = useState<string[]>(editing?.unitIds ?? []);
  const [status, setStatus] = useState<UserStatus>(editing?.status ?? 'ativo');
  const [notifyEmail, setNotifyEmail] = useState(editing?.notifyEmail ?? true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(editing?.notifyWhatsapp ?? false);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(mode === 'profiles');
  const [changingPassword, setChangingPassword] = useState(false);
  const hasPhone = !!onlyDigits(phone);

  const duplicate = !editing && db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  const emailProblem = !email.trim() ? requiredMessage('E-mail') : !isValidEmail(email) ? 'Informe um e-mail válido' : duplicate ? 'Já existe um membro com este e-mail' : undefined;
  const phoneProblem = phone && !isValidPhone(phone) ? 'Informe um telefone válido' : undefined;
  const problems = {
    name: !name.trim() ? requiredMessage('Nome completo') : undefined,
    email: editing ? undefined : emailProblem,
    phone: phoneProblem,
    profile: !profile ? requiredMessage('Perfil de acesso') : undefined,
    units: needsUnits(profile) && unitIds.length === 0 ? requiredMessage('Unidade(s)') : undefined,
  };
  const show = (k: keyof typeof problems) => (tried ? problems[k] : undefined);
  const invalid = Object.values(problems).some(Boolean);
  const feedback = useFormFeedback(Object.keys(problems).map((k) => show(k as keyof typeof problems)));

  // Variantes do navegador: preenchem um exemplo para o erro pretendido ser o único (ou todos, em "required")
  useEffect(() => {
    if (editing || mode === 'idle') return;
    if (mode === 'profiles') { setProfilesOpen(true); return; }
    if (mode !== 'required') {
      setName('Rafael Moreira'); setProfile('gestor');
      if (mode === 'duplicate') { setEmail(db.users[1]?.email ?? db.users[0].email); setPhone(formatPhone('48991234567')); }
    }
    setTried(true);
    feedback.submitted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Sem telefone cadastrado, o WhatsApp fica indisponível (e desmarcado)
  useEffect(() => { if (!hasPhone && notifyWhatsapp) setNotifyWhatsapp(false); }, [hasPhone, notifyWhatsapp]);

  const toggleUnit = (id: string, on: boolean) => setUnitIds((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    feedback.submitted();
    if (invalid || !profile) return;
    setSaving(true);
    const units = needsUnits(profile) ? unitIds : db.units.map((u) => u.id);
    const data = { name: name.trim(), phone: onlyDigits(phone), profile, unitIds: units, notifyEmail, notifyWhatsapp };
    if (editing) {
      updateSubDb((d) => ({ ...d, users: d.users.map((u) => (u.id === editing.id ? { ...u, ...data, status: self ? 'ativo' : status } : u)) }));
      setFlash({ type: 'success', title: 'Membro atualizado', message: 'As alterações foram salvas e valem a partir do próximo acesso' });
    } else {
      updateSubDb((d) => {
        const max = d.users.reduce((m, u) => Math.max(m, Number(u.id.split('-U')[1]) || 0), 0);
        const created: SubUser = { ...data, id: `${SUBSCRIBER_ID}-U${max + 1}`, email: email.trim().toLowerCase(), status: 'convite', invitedAt: nowLocal() };
        return { ...d, users: [...d.users, created] };
      });
      setFlash({ type: 'success', title: 'Convite enviado', message: `Enviamos um e-mail para ${email.trim().toLowerCase()} com o link para ativar a conta` });
    }
    window.setTimeout(() => goTo('equipe.html'), 400);
  };

  if (editingId && !editing) {
    return (
      <AppLayout active="equipe" screen="equipe">
        <Feedback type="error" title="Membro não encontrado" message="Volte para a listagem de usuários e tente novamente" />
      </AppLayout>
    );
  }

  const unitChoices = activeUnits(db).concat(db.units.filter((u) => u.status === 'inativo' && unitIds.includes(u.id)));

  return (
    <AppLayout active="equipe" screen="equipe">
      <form className="form-page" onSubmit={onSubmit} onChangeCapture={feedback.clear} noValidate>
        <Stack gap="xl">
          <PageHeader
            title={editing ? `Editar ${editing.name}` : 'Convidar membro'}
            badge={editing && self ? <Badge status="neutral">Você</Badge> : undefined}
            subtitle={editing ? undefined : 'A pessoa receberá um e-mail para ativar a conta e acessar o sistema'}
            breadcrumb={[{ label: 'Usuários', href: 'equipe.html' }, { label: editing ? 'Editar' : 'Convidar membro' }]}
          />
          {feedback.node}

          <DevNote note="RF204: nome completo, e-mail (único) e perfil obrigatórios. Telefone opcional; sem telefone, a opção de WhatsApp fica desabilitada (v0.3 / FE002). O e-mail não muda depois do cadastro (é o login).">
            <Card className="card-open" title="Dados do membro">
              <div className="card-body-tight">
                <Grid>
                  <Col span={12}><Input label="Nome completo" required autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} error={show('name')} /></Col>
                  <Col span={6}>
                    {editing
                      ? <Input label="E-mail" value={email} readOnly helperText="Usado para acessar o sistema. Não poderá ser alterado" />
                      : <Input label="E-mail" required type="email" autoComplete="off" placeholder="nome@suaempresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} error={show('email')} />}
                  </Col>
                  <Col span={6}>
                    <Input
                      optional label="Telefone" type="tel" autoComplete="off" placeholder="(00) 00000-0000"
                      value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} error={show('phone')}
                    />
                  </Col>
                  <Col span={12}>
                    <DevNote note="RGN001: 4 perfis fixos no MVP, cargos e permissões personalizados estão fora do escopo (ZC005). RGN003: Executor = equipe técnica interna do assinante; técnicos de prestadores externos ficam na frente Prestador.">
                      <Dropdown
                        label="Perfil de acesso" required
                        labelAction={<Button variant="ghost" size="sm" iconOnly className="info-btn" iconLeft={<IconHelpCircle size={16} />} aria-label="Entender os perfis de acesso" aria-haspopup="dialog" onClick={() => setProfilesOpen(true)} />}
                        options={PROFILE_OPTIONS} value={profile} onChange={(v) => setProfile(v as ProfileKey)} error={show('profile')}
                        disabled={self} helperText={self ? 'Você não pode alterar o seu próprio perfil' : undefined}
                      />
                    </DevNote>
                  </Col>
                  {editing && (
                    <Col span={12}>
                      {self ? (
                        <Stack gap="xs">
                          <ReadField label="Status" value={<Badge status="success" dot>Ativo</Badge>} />
                          <p className="field-note">Você não pode inativar o seu próprio usuário</p>
                        </Stack>
                      ) : editing.status === 'convite' ? (
                        <ReadField label="Status" value={<Badge status={USER_STATUS.convite.badge} dot>{USER_STATUS.convite.label}</Badge>} />
                      ) : (
                        <DevNote note="RF204-CTA003: ao salvar como Inativo, o membro perde o acesso imediatamente.">
                          <RadioButton name="status" label="Status" orientation="horizontal" options={[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]} value={status} onChange={(v) => setStatus(v as UserStatus)} />
                        </DevNote>
                      )}
                    </Col>
                  )}
                </Grid>
              </div>
            </Card>
          </DevNote>

          {needsUnits(profile) ? (
            <DevNote note="RF204-CTA002: o usuário vinculado a unidades só enxerga dados delas. Obrigatório para Solicitante/Gestor da unidade e Executor; Administrador e Gestor de manutenção veem todas as unidades e o campo não aparece. Unidade inativa não é ofertada em novos vínculos (RF202-CTA002).">
              <Card className="card-open" title="Unidades de acesso" subtitle="O membro só enxerga os dados das unidades selecionadas">
                <div className="card-body-tight">
                  <div role="group" aria-label="Unidades de acesso"><Stack gap="sm">
                    {unitChoices.map((u, i) => (
                      <Checkbox
                        key={u.id} label={u.status === 'inativo' ? `${u.name} (inativa)` : u.name} checked={unitIds.includes(u.id)} onChange={(e) => toggleUnit(u.id, e.target.checked)}
                        error={i === unitChoices.length - 1 ? show('units') : undefined}
                      />
                    ))}
                  </Stack></div>
                </div>
              </Card>
            </DevNote>
          ) : profile ? (
            <p className="field-note">{`${PROFILE_LABEL[profile]} vê os dados de todas as unidades, por isso não é preciso escolher unidades`}</p>
          ) : null}

          <DevNote note="RF204 v0.3 / RGN006: notificações na plataforma são sempre enviadas; e-mail (padrão ligado) e WhatsApp são opcionais, definidos no convite e editáveis pelo próprio usuário (ZC003). CTA004: quem desativa o e-mail não recebe notificações por e-mail. 💡 WhatsApp depende de FE002 (fora do escopo): aqui só a preferência.">
            <Card className="card-open" title="Preferências de notificação" subtitle="Por quais canais o membro recebe avisos">
              <div className="card-body-tight">
                <Stack gap="sm">
                  <Checkbox label="Na plataforma (sempre ativa)" checked disabled />
                  <Checkbox label="E-mail" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
                  <Checkbox label="WhatsApp" checked={notifyWhatsapp} disabled={!hasPhone} onChange={(e) => setNotifyWhatsapp(e.target.checked)} />
                  {!hasPhone && <p className="field-note">Informe um telefone para receber notificações por WhatsApp</p>}
                </Stack>
              </div>
            </Card>
          </DevNote>

          {editing && self && (
            <DevNote note="Alterar a própria senha: abre um modal com senha atual, nova senha (política RF002-RGN003) e confirmação, igual ao Admin. Nenhuma senha, nem mascarada, é exibida na tela.">
              <Card className="card-open" title="Segurança">
                <div className="card-body-tight">
                  <Stack direction="horizontal">
                    <Button variant="secondary" size="sm" iconLeft={<IconLock size={16} />} onClick={() => setChangingPassword(true)}>Alterar senha</Button>
                  </Stack>
                </div>
              </Card>
            </DevNote>
          )}

          <Stack direction="horizontal" justify="start" gap="sm" wrap>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Enviar convite'}</Button>
            <Button variant="secondary" disabled={saving} onClick={() => goTo('equipe.html')}>Cancelar</Button>
          </Stack>
        </Stack>
      </form>
      {profilesOpen && <ProfilesDialog onClose={() => setProfilesOpen(false)} />}
      {changingPassword && <ChangePasswordDialog onClose={() => setChangingPassword(false)} successMessage="Use a nova senha no próximo acesso" onSaved={() => undefined} />}
    </AppLayout>
  );
}

mountApp(<MembroFormScreen />);
