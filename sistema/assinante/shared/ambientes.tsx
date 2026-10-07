import { FormEvent, ReactElement, useEffect, useMemo, useState } from 'react';
import { IconCircleCheck, IconCircleOff, IconEye, IconPencil, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { Button, Dialog, Dropdown, Feedback, Input, RadioButton, Stack, Table, TableColumn, Textarea, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { FilterControl } from '../../admin/shared/FilterControl';
import { useColumnPrefs } from '../../admin/shared/ColumnsControl';
import { MobileCardList } from '../../admin/shared/MobileCardList';
import { useHashState } from '../../admin/shared/useHashState';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { RecordStatus } from '../../admin/shared/data';
import { normalize, requiredMessage } from '../../admin/shared/format';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { Environment } from './data';
import { unitName, updateSubDb, useSubSession } from './store';
import { activeUnits, envEquipmentCount, nextEnvId } from './estrutura-utils';
import { CellPair, ReadField, RowAction, RowActions, TableToolbar, Text, param, recordStatusBadge } from './ui';
import { RowMenu, RowMenuItem } from './RowMenu';

/** Estados: idle · noresults · new (cadastro aberto) · view (visualizar) · menu (⋮ aberto) · required · duplicate (CTA002) · deactivate · deleteblocked (CTA003) · delete */
const STATES = ['idle', 'noresults', 'new', 'view', 'menu', 'required', 'duplicate', 'deactivate', 'deleteblocked', 'delete'] as const;
type Mode = (typeof STATES)[number];
const PAGE_SIZE = 10;

type Row = Record<string, unknown> & { id: string; name: string; description: string; unit: string; equipments: number; status: RecordStatus; env: Environment };
type Form = { id?: string; unitId: string; name: string; description: string; status: RecordStatus };

/** Cadastro/edição de ambiente (RF203-FLU002): unidade, nome único dentro da unidade, descrição opcional e status. */
function EnvironmentForm({ initial, prefill, defaultUnitId, forceErrors, onClose, onSaved }: {
  initial?: Environment; prefill?: Partial<Form>; defaultUnitId: string; forceErrors?: boolean; onClose: () => void; onSaved: (editing: boolean) => void;
}) {
  const { db, unitIds } = useSubSession();
  const [f, setF] = useState<Form>(() => initial ?? { unitId: defaultUnitId, name: '', description: '', status: 'ativo', ...prefill });
  const [tried, setTried] = useState(!!forceErrors);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const duplicate = !!f.name.trim() && f.unitId && db.environments.some((e) => e.id !== initial?.id && e.unitId === f.unitId && normalize(e.name) === normalize(f.name));
  const errors = {
    unit: tried && !f.unitId ? requiredMessage('Unidade') : undefined,
    name: tried ? (!f.name.trim() ? requiredMessage('Nome do ambiente') : duplicate ? 'Já existe um ambiente com este nome nesta unidade' : undefined) : undefined,
  };
  const invalid = !f.unitId || !f.name.trim() || duplicate;

  // Foco no primeiro campo com erro (também ao abrir a variante com erros)
  const [tick, setTick] = useState(forceErrors ? 1 : 0);
  useEffect(() => {
    if (!tick) return;
    window.setTimeout(() => document.querySelector<HTMLElement>('#env-form [aria-invalid="true"]')?.focus(), 50);
  }, [tick]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setTick((n) => n + 1);
    if (invalid) return;
    const data = { unitId: f.unitId, name: f.name.trim(), description: f.description.trim(), status: f.status };
    updateSubDb((d) => (initial
      ? { ...d, environments: d.environments.map((x) => (x.id === initial.id ? { ...x, ...data } : x)) }
      : { ...d, environments: [...d.environments, { ...data, id: nextEnvId(d.environments) }] }));
    onSaved(!!initial);
  };

  const units = activeUnits(db, initial?.unitId).filter((u) => unitIds.includes(u.id)).map((u) => ({ value: u.id, label: u.name }));
  return (
    <Dialog
      open onClose={onClose} size="md"
      title={initial ? `Editar ${initial.name}` : 'Novo ambiente'}
      subtitle="Áreas da unidade onde ficam os equipamentos, como cozinha quente ou câmara fria"
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button size="sm" type="submit" form="env-form">{initial ? 'Salvar alterações' : 'Cadastrar ambiente'}</Button>
        </>
      )}
    >
      <form id="env-form" onSubmit={submit} noValidate>
        <Stack gap="md">
          <DevNote note="RF203: unidade obrigatória (só unidades ativas são ofertadas - RF202-CTA002). Nome obrigatório e único dentro da unidade (CTA002); descrição opcional.">
            <Dropdown label="Unidade" required options={units} value={f.unitId} onChange={(v) => set('unitId', v)} error={errors.unit} />
          </DevNote>
          <Input label="Nome do ambiente" required autoComplete="off" placeholder="Ex.: Cozinha quente" value={f.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
          <Textarea optional label="Descrição" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} />
          <RadioButton name="env-status" label="Status" orientation="horizontal" options={[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]} value={f.status} onChange={(v) => set('status', v as RecordStatus)} />
        </Stack>
      </form>
    </Dialog>
  );
}

function AmbientesScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const { db, can, unitIds } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [query, setQuery] = useState('');
  // Acesso a partir da unidade: ?unit=UNI-001 abre já filtrada (RF203-FLU001)
  const [unit, setUnit] = useState(() => { const u = param('unit'); return u && db.units.some((x) => x.id === u) ? u : 'todos'; });
  const [status, setStatus] = useState('todos');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ kind: 'form'; env?: Environment; prefill?: Partial<Form>; errors?: boolean } | { kind: 'toggle' | 'delete' | 'view'; env: Environment } | null>(null);

  useEffect(() => setPage(1), [query, unit, status]);
  useEffect(() => {
    const visibleEnvs = db.environments.filter((e) => unitIds.includes(e.unitId));
    if (mode === 'noresults') setQuery('Padaria');
    if (mode === 'new') setDialog({ kind: 'form' });
    if (mode === 'view' && visibleEnvs[0]) setDialog({ kind: 'view', env: visibleEnvs[0] });
    if (mode === 'required') setDialog({ kind: 'form', errors: true });
    if (mode === 'duplicate') {
      const e = visibleEnvs[0];
      if (e) setDialog({ kind: 'form', prefill: { unitId: e.unitId, name: e.name }, errors: true });
    }
    if (mode === 'deactivate') { const e = visibleEnvs.find((x) => x.status === 'ativo'); if (e) setDialog({ kind: 'toggle', env: e }); }
    if (mode === 'deleteblocked') { const e = visibleEnvs.find((x) => envEquipmentCount(db, x.id) > 0); if (e) setDialog({ kind: 'delete', env: e }); }
    if (mode === 'delete') {
      let e = visibleEnvs.find((x) => envEquipmentCount(db, x.id) === 0);
      if (!e) {
        // Variante: cria um ambiente de demonstração sem equipamentos
        const created: Environment = { id: nextEnvId(db.environments), unitId: visibleEnvs[0].unitId, name: 'Despensa', description: 'Ambiente sem equipamentos', status: 'ativo' };
        updateSubDb((d) => ({ ...d, environments: [...d.environments, created] }));
        e = created;
      }
      setDialog({ kind: 'delete', env: e });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const visible = db.environments.filter((e) => unitIds.includes(e.unitId));
  const filtered = useMemo(() => {
    const t = normalize(query);
    return visible
      .filter((e) => (unit === 'todos' || e.unitId === unit) && (status === 'todos' || e.status === status) && (!t || normalize(`${e.name} ${e.description}`).includes(t)))
      .sort((a, b) => unitName(db, a.unitId).localeCompare(unitName(db, b.unitId), 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR'));
  }, [visible, query, unit, status, db]);
  const rows: Row[] = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((e) => ({
    id: e.id, name: e.name, description: e.description, unit: unitName(db, e.unitId), equipments: envEquipmentCount(db, e.id), status: e.status, env: e,
  }));

  /** Visualizar + menu ⋮ (Editar, Ativar/Inativar, Excluir - só as permitidas); no mobile todas aparecem como ícones. */
  const actions = (r: Row) => {
    const items: RowMenuItem[] = [];
    if (can('ambientes', 'editar')) items.push({ label: 'Editar', icon: <IconPencil size={16} />, onClick: () => setDialog({ kind: 'form', env: r.env }) });
    if (can('ambientes', 'ativar')) {
      items.push(r.status === 'ativo'
        ? { label: 'Inativar', icon: <IconCircleOff size={16} />, onClick: () => setDialog({ kind: 'toggle', env: r.env }) }
        : { label: 'Ativar', icon: <IconCircleCheck size={16} />, onClick: () => setDialog({ kind: 'toggle', env: r.env }) });
    }
    if (can('ambientes', 'excluir')) items.push({ label: 'Excluir', icon: <IconTrash size={16} />, danger: true, onClick: () => setDialog({ kind: 'delete', env: r.env }) });
    return (
      <RowActions>
        <RowAction icon={<IconEye size={16} />} label="Visualizar ambiente" target={r.name} onClick={() => setDialog({ kind: 'view', env: r.env })} />
        {isMobile && items.map((it) => <RowAction key={it.label} icon={it.icon as ReactElement} label={`${it.label} ambiente`} target={r.name} onClick={it.onClick} />)}
        {!isMobile && <RowMenu target={r.name} items={items} defaultOpen={mode === 'menu' && r.id === rows[0]?.id} />}
      </RowActions>
    );
  };

  const columns: TableColumn<Row>[] = [
    { key: 'name', label: 'Ambiente', render: (v, r) => (r.description ? <CellPair primary={String(v)} secondary={r.description} /> : String(v)) },
    { key: 'unit', label: 'Unidade' },
    { key: 'equipments', label: 'Equipamentos', align: 'right' },
    { key: 'status', label: 'Status', render: (v) => recordStatusBadge(v as RecordStatus) },
    { key: 'id', label: 'Ações', sticky: 'right', render: (_, r) => actions(r) },
  ];

  const unitOptions = [{ value: 'todos', label: 'Todas as unidades' }, ...db.units.filter((u) => unitIds.includes(u.id)).map((u) => ({ value: u.id, label: u.name }))];
  const { columns: shownColumns, control, fieldsFor } = useColumnPrefs('sub-ambientes', columns, { mobileFixed: ['name', 'status'] });
  const toolbar = (
    <TableToolbar
      search={<Input type="search" aria-label="Buscar ambiente por nome" placeholder="Buscar por nome do ambiente" iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)} />}
      filters={(
        <FilterControl filters={[
          { id: 'unit', label: 'Unidade', options: unitOptions, value: unit, onChange: setUnit },
          { id: 'status', label: 'Status', options: [{ value: 'todos', label: 'Todos os status' }, { value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }], value: status, onChange: setStatus },
        ]} />
      )}
      columns={control}
    />
  );
  const empty = { title: 'Nenhum ambiente encontrado', description: 'Revise a busca ou os filtros' };

  const close = () => setDialog(null);
  const toggle = (env: Environment) => {
    const deactivate = env.status === 'ativo';
    updateSubDb((d) => ({ ...d, environments: d.environments.map((e) => (e.id === env.id ? { ...e, status: deactivate ? 'inativo' : 'ativo' } : e)) }));
    toast.show(deactivate
      ? { type: 'success', title: 'Ambiente inativado', message: 'Ele não aparece mais em novos cadastros de equipamento' }
      : { type: 'success', title: 'Ambiente ativado', message: 'Ele voltou a aparecer em novos cadastros de equipamento' });
    close();
  };
  const remove = (env: Environment) => {
    updateSubDb((d) => ({ ...d, environments: d.environments.filter((e) => e.id !== env.id) }));
    toast.show({ type: 'success', title: 'Ambiente excluído', message: `${env.name} foi removido de ${unitName(db, env.unitId)}` });
    close();
  };

  return (
    <AppLayout active="ambientes" screen="ambientes">
      <Stack gap="xl">
        <PageHeader
          title="Ambientes"
          subtitle="Gerencie os ambientes cadastrados em cada unidade"
          actions={can('ambientes', 'cadastrar') && (
            <DevNote note="Abre o cadastro de ambiente em modal (RF203-FLU002). O botão não deve ser exibido para usuários sem a permissão “Cadastrar” em Ambientes.">
              <Button iconLeft={<IconPlus size={20} />} onClick={() => setDialog({ kind: 'form' })}>Novo ambiente</Button>
            </DevNote>
          )}
        />

        <DevNote note="RF203-FLU001: acessível pelo menu Ambientes com filtro de unidade e, a partir da unidade, com `?unit=` já aplicado. Cadastro e edição em modal. 💡 RGN003: ambientes-modelo reaproveitáveis entre unidades, a confirmar.">
          {isMobile ? (
            <MobileCardList
              headingId="envs-title" title="Lista de ambientes" titleHidden toolbar={toolbar} emptyTitle={empty.title}
              page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage}
              items={rows.map((r) => ({
                id: r.id, title: r.name, subtitle: r.description || undefined, badge: recordStatusBadge(r.status),
                fields: fieldsFor([{ label: 'Unidade', value: r.unit }, { label: 'Equipamentos', value: r.equipments }]),
                actions: actions(r),
              }))}
            />
          ) : (
            <Table<Row>
              caption="Lista de ambientes" toolbar={toolbar} columns={shownColumns} rows={rows} empty={empty}
              pagination={{ page, pageSize: PAGE_SIZE, total: filtered.length, onPageChange: setPage }}
            />
          )}
        </DevNote>
      </Stack>

      {dialog?.kind === 'form' && (
        <EnvironmentForm
          initial={dialog.env}
          prefill={dialog.prefill}
          defaultUnitId={unit !== 'todos' ? unit : ''}
          forceErrors={dialog.errors}
          onClose={close}
          onSaved={(editing) => {
            toast.show(editing
              ? { type: 'success', title: 'Ambiente atualizado', message: 'As alterações foram salvas' }
              : { type: 'success', title: 'Ambiente cadastrado', message: 'Ele já pode ser escolhido no cadastro de equipamentos' });
            close();
          }}
        />
      )}

      {dialog?.kind === 'view' && (
        <Dialog
          open onClose={close} size="md" title={dialog.env.name} subtitle="Dados do ambiente"
          actions={can('ambientes', 'editar') ? <Button size="sm" onClick={() => setDialog({ kind: 'form', env: dialog.env })}>Editar</Button> : undefined}
        >
          <DevNote note="RF203-FLU002: visualização em modal, somente leitura, com os mesmos campos do cadastro e a quantidade de equipamentos vinculados.">
            <Stack gap="md">
              <ReadField label="Unidade" value={unitName(db, dialog.env.unitId)} />
              <ReadField label="Nome do ambiente" value={dialog.env.name} />
              <ReadField label="Descrição" value={dialog.env.description} />
              <ReadField label="Equipamentos" value={envEquipmentCount(db, dialog.env.id)} />
              <ReadField label="Status" value={recordStatusBadge(dialog.env.status)} />
            </Stack>
          </DevNote>
        </Dialog>
      )}

      {dialog?.kind === 'toggle' && (
        <Dialog
          open onClose={close} size="sm" className="dialog-confirm"
          title={dialog.env.status === 'ativo' ? `Inativar ${dialog.env.name}?` : `Ativar ${dialog.env.name}?`}
          subtitle={dialog.env.status === 'ativo'
            ? 'O ambiente deixará de aparecer em novos cadastros de equipamento. Os equipamentos e o histórico serão mantidos'
            : 'O ambiente voltará a aparecer em novos cadastros de equipamento'}
          actions={(
            <>
              <Button size="sm" variant="secondary" onClick={close}>Cancelar</Button>
              {dialog.env.status === 'ativo'
                ? <Button size="sm" variant="destructive" onClick={() => toggle(dialog.env)}>Inativar ambiente</Button>
                : <Button size="sm" onClick={() => toggle(dialog.env)}>Ativar ambiente</Button>}
            </>
          )}
        />
      )}

      {dialog?.kind === 'delete' && (envEquipmentCount(db, dialog.env.id) > 0 ? (
        <Dialog
          open onClose={close} size="sm" className="dialog-confirm" title={`Não é possível excluir ${dialog.env.name}`}
          subtitle="Para preservar o histórico, inative o ambiente. Ele deixa de aparecer em novos cadastros de equipamento"
          actions={(
            <>
              <Button size="sm" variant="secondary" onClick={close}>Cancelar</Button>
              {dialog.env.status === 'ativo' && can('ambientes', 'ativar') && <Button size="sm" onClick={() => setDialog({ kind: 'toggle', env: dialog.env })}>Inativar ambiente</Button>}
            </>
          )}
        >
          <DevNote note="RF203-RGN002 / CTA003 / FLU003: ambiente com equipamentos ou histórico vinculado não pode ser excluído, só inativado; a exclusão é bloqueada com orientação.">
            <Feedback type="warning" title="Este ambiente tem equipamentos vinculados" message={`${envEquipmentCount(db, dialog.env.id)} equipamento${envEquipmentCount(db, dialog.env.id) > 1 ? 's' : ''} em ${unitName(db, dialog.env.unitId)}`} />
          </DevNote>
        </Dialog>
      ) : (
        <Dialog
          open onClose={close} size="sm" className="dialog-confirm" title={`Excluir ${dialog.env.name}?`}
          actions={(
            <>
              <Button size="sm" variant="secondary" onClick={close}>Cancelar</Button>
              <Button size="sm" variant="destructive" onClick={() => remove(dialog.env)}>Excluir ambiente</Button>
            </>
          )}
        >
          <DevNote note="RF203-RGN002: ambiente sem equipamentos nem histórico pode ser excluído, com confirmação. A exclusão não pode ser desfeita.">
            <Text>Este ambiente não tem equipamentos vinculados. A exclusão não pode ser desfeita</Text>
          </DevNote>
        </Dialog>
      ))}
    </AppLayout>
  );
}

mountApp(<AmbientesScreen />);
