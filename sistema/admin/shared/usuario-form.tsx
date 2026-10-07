import { FormEvent, useEffect, useState } from 'react';
import { IconLock } from '@tabler/icons-react';
import { Badge, Button, Card, Checkbox, Dropdown, Feedback, Input, RadioButton, Stack } from '@maglev/ds';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { useHashState } from './useHashState';
import { logActivity, nextId, updateDb, useSession } from './store';
import { AdminUser, RecordStatus } from './data';
import { CORPORATE_DOMAIN, formatPhone, isCorporateEmail, isValidEmail, isValidPhone, onlyDigits, requiredMessage } from './format';
import { Col, Grid, ReadField, goTo, param, recordStatusBadge, setFlash } from './ui';

/** Estados: idle · required · domain (e-mail fora de @maglev.com.br - CTA003) · duplicate (e-mail já cadastrado - CTA002) */
const STATES = ['idle', 'required', 'domain', 'duplicate'] as const;
type Mode = (typeof STATES)[number];

function UsuarioFormScreen() {
  const { db, user: me } = useSession();
  const editing = db.adminUsers.find((u) => u.id === param('id'));
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [name, setName] = useState(editing?.name ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [phone, setPhone] = useState(editing ? formatPhone(editing.phone) : '');
  const [profileId, setProfileId] = useState(editing?.profileId ?? '');
  const [status, setStatus] = useState<RecordStatus>(editing?.status ?? 'ativo');
  const [notifyEmail, setNotifyEmail] = useState(editing?.notifyEmail ?? true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(editing?.notifyWhatsapp ?? false);
  const [changingPassword, setChangingPassword] = useState(false);
  const hasPhone = !!onlyDigits(phone);
  // Sem telefone cadastrado, o WhatsApp fica indisponível (e desmarcado)
  useEffect(() => { if (!hasPhone && notifyWhatsapp) setNotifyWhatsapp(false); }, [hasPhone, notifyWhatsapp]);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  // Aviso no topo (mesmo padrão do Novo assinante): só com campos obrigatórios vazios ou mais de um erro; some ao editar
  const [banner, setBanner] = useState<'required' | 'multiple' | null>(null);
  const [submitTick, setSubmitTick] = useState(0);

  useEffect(() => {
    if (editing || mode === 'idle') return;
    // Variantes de e-mail: demais campos preenchidos, para o e-mail ser o único erro (só foco, sem aviso no topo)
    const rest = () => { setPhone(formatPhone('11987654321')); setProfileId(db.profiles.find((p) => p.status === 'ativo')?.id ?? ''); };
    if (mode === 'domain') { setName('Paula Andrade'); setEmail('paula.andrade@gmail.com'); rest(); }
    if (mode === 'duplicate') { setName('Débora Lins'); setEmail('debora.lins@maglev.com.br'); rest(); }
    setTried(true);
    setSubmitTick((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const duplicate = !editing && db.adminUsers.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  const emailProblem = !email.trim() ? requiredMessage('E-mail')
    : !isValidEmail(email) ? 'Informe um e-mail válido'
    : !isCorporateEmail(email) ? `Use um e-mail corporativo ${CORPORATE_DOMAIN}`
    : duplicate ? 'Já existe um usuário com este e-mail' : undefined;
  const problems = {
    name: !name.trim() ? requiredMessage('Nome completo') : undefined,
    email: editing ? undefined : emailProblem,
    phone: !onlyDigits(phone) ? requiredMessage('Celular') : !isValidPhone(phone) ? 'Informe um telefone válido' : undefined,
    profile: !profileId ? requiredMessage('Perfil de acesso') : undefined,
  };
  const show = (k: keyof typeof problems) => (tried ? problems[k] : undefined);
  const invalid = Object.values(problems).some(Boolean);
  const self = editing?.id === me.id;
  const profiles = db.profiles.filter((p) => p.status === 'ativo' || p.id === editing?.profileId).map((p) => ({ value: p.id, label: p.name }));

  // Depois de tentar salvar (erros já renderizados): decide o aviso e leva o foco ao primeiro campo com erro
  useEffect(() => {
    if (!submitTick) return;
    const messages = Object.values(problems).filter(Boolean) as string[];
    if (!messages.length) return;
    const empty = messages.filter((m) => /é obrigatório$/.test(m)).length;
    // só vazios: aviso de obrigatórios · um único erro de outro tipo: só foco no campo · tipos misturados ou vários erros: aviso genérico
    setBanner(messages.length === 1 ? null : empty === messages.length ? 'required' : 'multiple');
    const first = document.querySelector<HTMLElement>('form [aria-invalid="true"]');
    first?.scrollIntoView({ block: 'center' });
    first?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitTick]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setBanner(null);
    setSubmitTick((n) => n + 1);
    if (invalid) return;
    setSaving(true);
    let id = editing?.id;
    const data = { name: name.trim(), phone: onlyDigits(phone), profileId, status, ...(self ? { notifyEmail, notifyWhatsapp } : {}) };
    updateDb((d) => {
      if (editing) return { ...d, adminUsers: d.adminUsers.map((u) => (u.id === editing.id ? { ...u, ...data } : u)) };
      id = nextId('USR', d.adminUsers.map((u) => u.id));
      const created: AdminUser = { id, email: email.trim().toLowerCase(), createdAt: new Date().toISOString().slice(0, 10), ...data };
      return { ...d, adminUsers: [...d.adminUsers, created] };
    });
    if (!editing) logActivity(me.id, 'Usuários', 'cadastro', `Cadastrou o usuário ${data.name}`);
    else {
      if (data.status !== editing.status) logActivity(me.id, 'Usuários', data.status === 'ativo' ? 'ativacao' : 'inativacao', `${data.status === 'ativo' ? 'Ativou' : 'Inativou'} o usuário ${editing.name}`);
      if (data.name !== editing.name || data.profileId !== editing.profileId || data.phone !== editing.phone
        || (self && (notifyEmail !== (editing.notifyEmail ?? true) || notifyWhatsapp !== (editing.notifyWhatsapp ?? false)))) logActivity(me.id, 'Usuários', 'edicao', `Editou o usuário ${editing.name}`);
    }
    setFlash(editing
      ? { type: 'success', title: 'Usuário atualizado', message: 'As alterações foram salvas.' }
      : { type: 'success', title: 'Usuário cadastrado', message: 'Enviamos o e-mail de primeiro acesso para a definição da senha.' });
    window.setTimeout(() => goTo(`usuario.html?id=${id}`), 400);
  };

  const title = editing ? `Editar ${editing.name}` : 'Novo usuário';

  return (
    <AppLayout active="usuarios" screen="usuarios">
      <form className="form-page" onSubmit={onSubmit} onChangeCapture={() => setBanner(null)} noValidate>
        <Stack gap="xl">
          <PageHeader
            title={title}
            badge={editing && self ? <Badge status="neutral">Você</Badge> : undefined}
            subtitle={editing ? undefined : 'O usuário receberá um e-mail para definir a senha e acessar o painel'}
            breadcrumb={[
              { label: 'Usuários', href: 'usuarios.html' },
              { label: editing ? 'Editar' : 'Novo usuário' },
            ]}
          />
          {banner && (
            <div className="floating-feedback">
              {banner === 'required'
                ? <Feedback type="error" title="Preencha os campos obrigatórios" message="Revise os campos destacados para continuar" dismissible onDismiss={() => setBanner(null)} />
                : <Feedback type="error" title="Não foi possível salvar" message="Corrija os campos destacados e tente novamente" dismissible onDismiss={() => setBanner(null)} />}
            </div>
          )}

          <DevNote note="CPF não é solicitado: a unicidade do usuário é garantida pelo e-mail corporativo.">
            <Card className="card-open" title="Dados do usuário">
              <div className="card-body-tight">
                <Grid>
                  <Col span={12}><Input label="Nome completo" required autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} error={show('name')} /></Col>
                  <Col span={12}>
                    <DevNote note="Perfis ativos de RF303. As permissões do perfil passam a valer para o usuário ao salvar.">
                      <Dropdown label="Perfil de acesso" required options={profiles} value={profileId} onChange={setProfileId} error={show('profile')} />
                    </DevNote>
                  </Col>
                  <Col span={6}>
                    {editing ? (
                      <DevNote note="RF302: o e-mail é usado no login e não pode ser alterado após o cadastro.">
                        <Input label="E-mail" value={email} readOnly helperText="Usado para acessar o sistema. Não poderá ser alterado." />
                      </DevNote>
                    ) : (
                      <DevNote note={`Somente e-mail corporativo ${CORPORATE_DOMAIN} (RGN003 / CTA003) e único entre os usuários do Admin (RGN001 / CTA002).`}>
                        <Input label="E-mail" required type="email" autoComplete="off" placeholder={`nome${CORPORATE_DOMAIN}`} value={email} onChange={(e) => setEmail(e.target.value)} error={show('email')} helperText={`Somente e-mails com domínio ${CORPORATE_DOMAIN} são permitidos`} />
                      </DevNote>
                    )}
                  </Col>
                  <Col span={6}><Input label="Celular" required type="tel" autoComplete="off" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} error={show('phone')} /></Col>
                  {editing && (
                    <Col span={6}>
                      {self ? (
                        <Stack gap="xs">
                          <ReadField label="Status" value={recordStatusBadge('ativo')} />
                          <p className="field-note">Você não pode inativar a própria conta</p>
                        </Stack>
                      ) : (
                        <RadioButton name="status" label="Status" orientation="horizontal" options={[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]} value={status} onChange={(v) => setStatus(v as RecordStatus)} />
                      )}
                    </Col>
                  )}
                </Grid>
              </div>
            </Card>
          </DevNote>

          {editing && self && (
            <>
              <DevNote note="Preferências pessoais, só na edição da própria conta (não há página Meu perfil neste momento): canais de notificação por e-mail e WhatsApp, aplicados com Salvar alterações. O e-mail e o celular usados são os do cadastro acima. Padrão: e-mail ligado e WhatsApp desligado.">
                <Card className="card-open" title="Preferências de comunicação" subtitle="Escolha por quais canais você deseja receber notificações">
                  <div className="card-body-tight">
                    <Stack gap="sm">
                      <Checkbox label="E-mail" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
                      <Checkbox label="WhatsApp" checked={notifyWhatsapp} disabled={!hasPhone} onChange={(e) => setNotifyWhatsapp(e.target.checked)} />
                      {!hasPhone && <p className="field-note">Informe um celular para receber notificações por WhatsApp</p>}
                    </Stack>
                  </div>
                </Card>
              </DevNote>

              <DevNote note="Alterar a própria senha: abre um modal com senha atual, nova senha (política RF002-RGN003) e confirmação. Nenhuma senha, nem mascarada, é exibida na tela.">
                <Card className="card-open" title="Segurança">
                  <div className="card-body-tight">
                    <Stack direction="horizontal">
                      <Button variant="secondary" size="sm" iconLeft={<IconLock size={16} />} onClick={() => setChangingPassword(true)}>Alterar senha</Button>
                    </Stack>
                  </div>
                </Card>
              </DevNote>
            </>
          )}

          <Stack direction="horizontal" justify="start" gap="sm" wrap>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar usuário'}</Button>
            <Button variant="secondary" disabled={saving} onClick={() => goTo(editing ? `usuario.html?id=${editing.id}` : 'usuarios.html')}>Cancelar</Button>
          </Stack>
        </Stack>
      </form>
      {changingPassword && <ChangePasswordDialog onClose={() => setChangingPassword(false)} />}
    </AppLayout>
  );
}

mountApp(<UsuarioFormScreen />);
