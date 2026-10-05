import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, Checkbox, Feedback, Input, RadioButton, Stack, Table, TableColumn, Textarea, useToast } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { useHashState } from './useHashState';
import { logActivity, nextId, updateDb, useSession } from './store';
import { ACTIONS, ActionKey, Permissions, Profile, RecordStatus, SCREENS, ScreenKey } from './data';
import { normalize, requiredMessage } from './format';
import { Col, Grid, goTo, param, setFlash } from './ui';
import { MobileCardList } from './MobileCardList';
import { useIsMobile } from './useMediaQuery';

/** Estados: idle · required · duplicate (nome já usado por outro perfil) · nopermission (nenhuma permissão marcada) */
const STATES = ['idle', 'required', 'duplicate', 'nopermission'] as const;
type Mode = (typeof STATES)[number];

const EMPTY: Permissions = { dashboard: [], assinantes: [], usuarios: [], perfis: [], configuracoes: [] };
type Row = Record<string, unknown> & { id: ScreenKey; label: string; actions: ActionKey[] };

function PerfilFormScreen() {
  const { db, user } = useSession();
  const isMobile = useIsMobile();
  const toast = useToast();
  const [submitTick, setSubmitTick] = useState(0);
  const editing = db.profiles.find((p) => p.id === param('id'));
  const fixed = !!editing?.fixed;
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [status, setStatus] = useState<RecordStatus>(editing?.status ?? 'ativo');
  const [perms, setPerms] = useState<Permissions>(() => structuredClone(editing?.permissions ?? EMPTY));
  const [tried, setTried] = useState(false);
  const linkedUsers = editing ? db.adminUsers.filter((u) => u.profileId === editing.id).length : 0;

  useEffect(() => {
    if (editing || mode === 'idle') return;
    if (mode === 'duplicate') { setName('Suporte'); setPerms((p) => ({ ...p, dashboard: ['visualizar'] })); }
    if (mode === 'nopermission') setName('Atendimento');
    setTried(true);
    setSubmitTick((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const duplicate = db.profiles.some((p) => p.id !== editing?.id && normalize(p.name) === normalize(name));
  const nameError = !tried ? undefined : !name.trim() ? requiredMessage('Nome do perfil') : duplicate ? 'Já existe um perfil com este nome' : undefined;
  const none = Object.values(perms).every((a) => a.length === 0);

  /** Marcar qualquer ação marca “Visualizar”; desmarcar “Visualizar” remove as demais ações da tela. */
  const toggle = (screen: ScreenKey, action: ActionKey, on: boolean) => setPerms((p) => {
    const cur = new Set(p[screen]);
    if (on) { cur.add(action); cur.add('visualizar'); } else if (action === 'visualizar') cur.clear(); else cur.delete(action);
    return { ...p, [screen]: SCREENS.find((s) => s.key === screen)!.actions.filter((a) => cur.has(a)) };
  });

  // Depois de tentar salvar (erros já renderizados): nome vazio ou repetido só foca o campo (sem aviso);
  // nenhuma permissão marcada (com o nome ok) mostra o toast de erro no topo
  useEffect(() => {
    if (!submitTick) return;
    if (none && !nameError) toast.show({ type: 'error', title: 'Selecione ao menos uma permissão', message: `É necessário selecionar ao menos uma permissão para ${editing ? 'salvar' : 'criar'} o perfil` });
    const first = document.querySelector<HTMLElement>('form [aria-invalid="true"]');
    first?.scrollIntoView({ block: 'center' });
    first?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitTick]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setSubmitTick((n) => n + 1);
    if (!name.trim() || duplicate || none) return;
    let id = editing?.id;
    updateDb((d) => {
      const data = { name: name.trim(), description: description.trim(), status, permissions: perms };
      if (editing) return { ...d, profiles: d.profiles.map((p) => (p.id === editing.id ? { ...p, ...data } : p)) };
      id = nextId('PER', d.profiles.map((p) => p.id));
      return { ...d, profiles: [...d.profiles, { id, ...data } as Profile] };
    });
    logActivity(user.id, 'Perfis de acesso', editing ? 'edicao' : 'cadastro', `${editing ? 'Editou' : 'Cadastrou'} o perfil ${name.trim()}`);
    setFlash(editing
      ? { type: 'success', title: 'Perfil atualizado', message: `As permissões passam a valer para ${linkedUsers} ${linkedUsers === 1 ? 'usuário vinculado' : 'usuários vinculados'}.` }
      : { type: 'success', title: 'Perfil cadastrado', message: 'O perfil já pode ser atribuído aos usuários.' });
    window.setTimeout(() => goTo('perfis.html'), 400);
  };

  const columns: TableColumn<Row>[] = [
    { key: 'label', label: 'Tela' },
    ...ACTIONS.map((a): TableColumn<Row> => ({
      key: a.key as keyof Row,
      label: a.label,
      align: 'center',
      render: (_, r) => (r.actions.includes(a.key)
        ? <div className="perm-check"><Checkbox aria-label={`${a.label} em ${r.label}`} checked={perms[r.id].includes(a.key)} disabled={fixed} onChange={(e) => toggle(r.id, a.key, e.target.checked)} /></div>
        : <span className="page-text" aria-label="Não se aplica">-</span>),
    })),
  ];
  const rows: Row[] = SCREENS.map((s) => ({ id: s.key, label: s.label, actions: s.actions }));

  return (
    <AppLayout active="perfis" screen="perfis">
      <form className="form-page" onSubmit={onSubmit} noValidate>
        <Stack gap="xl">
          <PageHeader
            title={editing ? (fixed ? editing.name : `Editar ${editing.name}`) : 'Novo perfil de acesso'}
            breadcrumb={[{ label: 'Perfis de acesso', href: 'perfis.html' }, { label: editing ? 'Editar' : 'Novo perfil' }]}
            subtitle={editing ? `${linkedUsers} ${linkedUsers === 1 ? 'usuário vinculado' : 'usuários vinculados'}` : undefined}
          />

          {fixed && (
            <DevNote note="RF303-RGN001 / CTA003: o perfil Administrador (acesso total) é fixo - não pode ser excluído nem ter permissões removidas. É o perfil que recebe as notificações críticas (inativação de assinante e de usuário).">
              <div className="info-tight">
                <Feedback type="info" title="Perfil fixo do sistema" message="Este perfil possui acesso total e não pode ser alterado" />
              </div>
            </DevNote>
          )}

          <Card className="card-open" title="Dados do perfil">
            <div className="card-body-tight">
            <Grid>
              <Col span={6}><Input label="Nome do perfil" required readOnly={fixed} placeholder="Ex.: Suporte, Financeiro" value={name} onChange={(e) => setName(e.target.value)} error={nameError} /></Col>
              {editing && (
                <Col span={6}>
                  {fixed ? <Input label="Status" value="Ativo" readOnly /> : (
                    <RadioButton name="status" label="Status" orientation="horizontal" options={[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]} value={status} onChange={(v) => setStatus(v as RecordStatus)} />
                  )}
                </Col>
              )}
              <Col span={12}><Textarea optional label="Descrição" rows={2} readOnly={fixed} value={description} onChange={(e) => setDescription(e.target.value)} /></Col>
            </Grid>
            </div>
          </Card>

          <DevNote note="Matriz de permissões tela × ação (modelo “como o Google Drive”). “-” = ação que não existe na tela (ex.: assinante não é excluído, só inativado). Marcar qualquer ação marca Visualizar; desmarcar Visualizar limpa a linha. Ao salvar, todos os usuários do perfil passam a ter as novas permissões (FLU004 / CTA002); telas e ações sem permissão ficam ocultas (FLU005 / CTA001).">
            {isMobile ? (
              <MobileCardList
                headingId="perms-title" title="Permissões" subtitle="Marque o que este perfil pode fazer em cada tela"
                emptyTitle="Sem telas" page={1} pageSize={rows.length || 1} total={rows.length} onPageChange={() => undefined}
                items={rows.map((r) => ({
                  id: r.id, title: r.label,
                  fields: ACTIONS.map((a) => ({
                    label: a.label,
                    value: r.actions.includes(a.key)
                      ? <Checkbox aria-label={`${a.label} em ${r.label}`} checked={perms[r.id].includes(a.key)} disabled={fixed} onChange={(e) => toggle(r.id, a.key, e.target.checked)} />
                      : <span aria-label="Não se aplica">-</span>,
                  })),
                }))}
              />
            ) : (
              <Table<Row>
                title="Permissões"
                subtitle="Marque o que este perfil pode fazer em cada tela"
                columns={columns}
                rows={rows}
              />
            )}
          </DevNote>

          {!fixed && (
            <Stack direction="horizontal" justify="start" gap="sm" wrap>
              <Button type="submit">{editing ? 'Salvar alterações' : 'Cadastrar perfil'}</Button>
              <Button variant="secondary" onClick={() => goTo('perfis.html')}>Cancelar</Button>
            </Stack>
          )}
          {fixed && <Stack direction="horizontal" justify="start"><Button variant="secondary" onClick={() => goTo('perfis.html')}>Voltar</Button></Stack>}
        </Stack>
      </form>
    </AppLayout>
  );
}

mountApp(<PerfilFormScreen />);
