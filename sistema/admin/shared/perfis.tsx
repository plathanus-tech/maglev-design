import { useEffect, useState } from 'react';
import { IconCircleCheck, IconCircleOff, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { Badge, Button, Dialog, Stack, Table, TableColumn, useToast } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { MobileCardList } from './MobileCardList';
import { useHashState } from './useHashState';
import { useIsMobile } from './useMediaQuery';
import { logActivity, updateDb, useSession } from './store';
import { Profile } from './data';
import { RowAction, RowActions, Text, goTo, recordStatusBadge, takeFlash } from './ui';

/** Estados: idle · deleteblocked (excluir perfil com usuários vinculados) */
const STATES = ['idle', 'deleteblocked'] as const;
type Mode = (typeof STATES)[number];

type Row = Record<string, unknown> & Profile & { users: number };
type Pending = { kind: 'delete' | 'blocked' | 'toggle'; profile: Row } | null;

const PAGE_SIZE = 10;

function PerfisScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const { db, can, user } = useSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [pending, setPending] = useState<Pending>(null);

  const [page, setPage] = useState(1);
  const allRows: Row[] = db.profiles.map((p) => ({ ...p, users: db.adminUsers.filter((u) => u.profileId === p.id).length }));
  const rows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (mode === 'deleteblocked') setPending({ kind: 'blocked', profile: allRows.find((r) => r.id === 'PER-SUP')! }); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const askDelete = (p: Row) => setPending({ kind: p.users > 0 ? 'blocked' : 'delete', profile: p });
  const doDelete = (p: Row) => {
    updateDb((d) => ({ ...d, profiles: d.profiles.filter((x) => x.id !== p.id) }));
    logActivity(user.id, 'Perfis de acesso', 'exclusao', `Excluiu o perfil ${p.name}`);
    toast.show({ type: 'success', title: 'Perfil excluído', message: `O perfil ${p.name} foi excluído.` });
    setPending(null);
  };
  const doToggle = (p: Row) => {
    const next = p.status === 'ativo' ? 'inativo' : 'ativo';
    updateDb((d) => ({ ...d, profiles: d.profiles.map((x) => (x.id === p.id ? { ...x, status: next } : x)) }));
    logActivity(user.id, 'Perfis de acesso', next === 'ativo' ? 'ativacao' : 'inativacao', `${next === 'ativo' ? 'Ativou' : 'Inativou'} o perfil ${p.name}`);
    toast.show({ type: 'success', title: next === 'ativo' ? 'Perfil ativado' : 'Perfil inativado', message: next === 'ativo' ? 'O perfil volta a aparecer no cadastro de usuários.' : 'O perfil deixa de ser oferecido no cadastro de usuários.' });
    setPending(null);
  };

  const actions = (p: Row) => (
    <RowActions>
      {can('perfis', 'editar') && <RowAction icon={<IconPencil size={16} />} label={p.fixed ? 'Visualizar perfil' : 'Editar perfil'} target={p.name} onClick={() => goTo(`perfil-form.html?id=${p.id}`)} />}
      {can('perfis', 'ativar') && !p.fixed && (
        <RowAction icon={p.status === 'ativo' ? <IconCircleOff size={16} /> : <IconCircleCheck size={16} />} label={p.status === 'ativo' ? 'Inativar perfil' : 'Ativar perfil'} target={p.name} onClick={() => setPending({ kind: 'toggle', profile: p })} />
      )}
      {can('perfis', 'excluir') && !p.fixed && <RowAction icon={<IconTrash size={16} />} label="Excluir perfil" target={p.name} onClick={() => askDelete(p)} />}
    </RowActions>
  );

  const columns: TableColumn<Row>[] = [
    {
      key: 'name', label: 'Perfil',
      render: (_, r) => <Stack direction="horizontal" gap="xs" align="center"><span>{r.name}</span>{r.fixed && <Badge status="brand">Fixo</Badge>}</Stack>,
    },
    { key: 'description', label: 'Descrição', render: (v) => (v ? String(v) : '-') },
    { key: 'users', label: 'Usuários vinculados', align: 'right' },
    { key: 'status', label: 'Status', render: (v) => recordStatusBadge(v as Profile['status']) },
    { key: 'id', label: 'Ações', sticky: 'right', render: (_, r) => actions(r) },
  ];
  const shownColumns = columns;
  const fieldsFor = <T,>(fields: T[]) => fields;   // sem “Exibição” em Perfis de acesso: todas as colunas e campos sempre visíveis

  const p = pending?.profile;
  return (
    <AppLayout active="perfis" screen="perfis">
      <Stack gap="xl">
        <PageHeader
          title="Perfis de acesso"
          subtitle="Defina o que cada perfil pode ver e fazer no painel"
          actions={can('perfis', 'cadastrar') && <Button iconLeft={<IconPlus size={20} />} onClick={() => goTo('perfil-form.html')}>Novo perfil</Button>}
        />

        <DevNote note="RF303: perfis com matriz de permissões tela × ação. O perfil Administrador é fixo (acesso total) - não pode ser excluído, inativado nem ter permissões removidas (RGN001 / CTA003). Perfil com usuários vinculados não pode ser excluído, apenas inativado (RGN002). ⚠️ ZC005: perfis configuráveis estão na zona cinzenta - validar com o comercial; alternativa de menor esforço é perfis fixos (P18).">
          {isMobile ? (
            <MobileCardList
              headingId="profiles-title" title="Lista de perfis" titleHidden emptyTitle="Nenhum perfil cadastrado"
              page={page} pageSize={PAGE_SIZE} total={allRows.length} onPageChange={setPage}
              items={rows.map((r) => ({
                id: r.id, title: r.name, subtitle: r.description, badge: recordStatusBadge(r.status),
                fields: fieldsFor([{ label: 'Usuários vinculados', value: r.users }, { label: 'Tipo', value: r.fixed ? 'Fixo' : 'Configurável' }]),
                actions: actions(r),
              }))}
            />
          ) : (
            <Table<Row> caption="Lista de perfis de acesso" columns={shownColumns} rows={rows} empty={{ title: 'Nenhum perfil cadastrado' }} pagination={{ page, pageSize: PAGE_SIZE, total: allRows.length, onPageChange: setPage }} />
          )}
        </DevNote>
      </Stack>

      {pending?.kind === 'blocked' && p && (
        <Dialog
          open size="sm" className="dialog-confirm" onClose={() => setPending(null)}
          title="Não é possível excluir este perfil"
          subtitle={`O perfil ${p.name} está vinculado a ${p.users} ${p.users === 1 ? 'usuário' : 'usuários'}. Para deixar de usá-lo, você pode inativá-lo ou alterar o perfil ${p.users === 1 ? 'desse usuário' : 'desses usuários'}`}
          actions={(
            <>
              <Button size="sm" variant="secondary" onClick={() => setPending(null)}>Fechar</Button>
              {p.status === 'ativo' && can('perfis', 'ativar') && <Button size="sm" onClick={() => doToggle(p)}>Inativar perfil</Button>}
            </>
          )}
        />
      )}
      {pending?.kind === 'delete' && p && (
        <Dialog
          open size="sm" className="dialog-confirm" onClose={() => setPending(null)} title={`Excluir o perfil ${p.name}?`}
          actions={<><Button size="sm" variant="secondary" onClick={() => setPending(null)}>Cancelar</Button><Button size="sm" variant="destructive" onClick={() => doDelete(p)}>Excluir perfil</Button></>}
        >
          <Text>O perfil não tem usuários vinculados. A exclusão não pode ser desfeita.</Text>
        </Dialog>
      )}
      {pending?.kind === 'toggle' && p && (
        <Dialog
          open size="sm" className="dialog-confirm" onClose={() => setPending(null)}
          title={p.status === 'ativo' ? `Inativar o perfil ${p.name}?` : `Ativar o perfil ${p.name}?`}
          subtitle={p.status === 'ativo'
            ? `O perfil deixa de ser oferecido no cadastro de usuários.${p.users ? ` Os ${p.users} usuários vinculados mantêm as permissões atuais até receberem outro perfil` : ''}`
            : 'O perfil volta a ser oferecido no cadastro de usuários'}
          actions={<><Button size="sm" variant="secondary" onClick={() => setPending(null)}>Cancelar</Button><Button size="sm" variant={p.status === 'ativo' ? 'destructive' : 'primary'} onClick={() => doToggle(p)}>{p.status === 'ativo' ? 'Inativar perfil' : 'Ativar perfil'}</Button></>}
        />
      )}
    </AppLayout>
  );
}

mountApp(<PerfisScreen />);
