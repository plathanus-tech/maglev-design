import { ReactNode, useEffect, useMemo, useState } from 'react';
import { IconCircleCheck, IconCircleOff, IconPencil, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import {
  Badge, Button, Dialog, Dropdown, Input, RadioButton, Stack, Table, TableColumn, Textarea, useToast,
} from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { MobileCardList } from './MobileCardList';
import { useIsMobile } from './useMediaQuery';
import { useHashState } from './useHashState';
import { getSessionUser, logActivity, updateDb, useSession } from './store';
import {
  BASE_SITUATIONS, BaseSituation, ConfigItem, Db, IMPACTS, LevelItem, PRIORITY_MATRIX, RecordStatus, STATUS_MODULES, StatusItem,
  StatusModule, VISUALS, Visual, baseLabel, moduleLabel, visualBadge, visualLabel,
} from './data';
import { normalize, requiredMessage } from './format';
import { CategoryIcon, IconPicker } from './IconPicker';
import { Col, Grid, RowAction, RowActions, TableToolbar, Text, recordStatusBadge, statusBadgeOf, visualBadgeOf } from './ui';

/**
 * RF401 - padrão único para todos os cadastros de Configurações (RF402–RF407):
 * listar, cadastrar, editar (lápis), ativar/inativar e excluir (só sem vínculos; com vínculos, inativar).
 * Estados (#state=): new · edit · duplicate · delete · deleteblocked · required - aplicados à aba aberta.
 */
const STATES = ['idle', 'new', 'edit', 'duplicate', 'delete', 'deleteblocked', 'required'] as const;
type Mode = (typeof STATES)[number];

const PAGE_SIZE = 10;
/** Registra no histórico de ações do usuário logado (Usuários > Histórico de ações). */
const logConfig = (kind: 'cadastro' | 'edicao' | 'ativacao' | 'inativacao' | 'exclusao', text: string) =>
  logActivity(getSessionUser().id, 'Configurações', kind, text);
type Header = (actions?: ReactNode) => ReactNode;
const matches = (q: string, ...fields: string[]) => !q.trim() || fields.some((f) => normalize(f).includes(normalize(q)));

type SimpleKey = 'categories' | 'requestTypes' | 'maintenanceTypes';
const PAGES = [
  { slug: 'categorias', label: 'Categorias de equipamentos', subtitle: 'Usadas no cadastro de equipamentos, de prestadores e nos filtros' },
  { slug: 'tipos-solicitacao', label: 'Tipos de solicitação', subtitle: 'Defina os tipos de problema disponíveis na abertura de solicitações' },
  { slug: 'tipos-manutencao', label: 'Tipos de manutenção', subtitle: 'Usados na triagem e nas ordens de serviço' },
  { slug: 'prioridades', label: 'Prioridades', subtitle: 'Níveis fixos de prioridade para solicitações e ordens de serviço, da maior para a menor' },
  { slug: 'criticidades', label: 'Criticidades', subtitle: 'Classificação dos equipamentos conforme o impacto de uma parada na operação' },
  { slug: 'status', label: 'Status', subtitle: 'Status configuráveis por módulo, cada um com seu tipo visual' },
] as const;

const SIMPLE: Record<SimpleKey, { singular: string; newLabel: string; hint: string; note: string; linkLabel: string }> = {
  categories: {
    singular: 'categoria', newLabel: 'Nova categoria', linkLabel: 'equipamentos',
    hint: 'Usadas no cadastro de equipamentos, de prestadores e nos filtros',
    note: 'RF402: categoria é obrigatória no equipamento (Assinante RF301) e vincula prestadores às categorias atendidas (RF702). Troubleshooting fica no equipamento, não na categoria (RGN004). 💡 Ícone da categoria e “tipo de equipamento” como subnível (ZC002) seguem a confirmar - não entram.',
  },
  requestTypes: {
    singular: 'tipo de solicitação', newLabel: 'Novo tipo de solicitação', linkLabel: 'solicitações',
    hint: 'Exibidos como “Tipo de problema/falha” na abertura de solicitação',
    note: 'RF403: aparece como “Tipo de problema/falha” no PWA (RF002) e no portal (RF404). É a chave do troubleshooting: as dicas são cadastradas por equipamento × problema (RGN003). 💡 Se variam por categoria: a confirmar.',
  },
  maintenanceTypes: {
    singular: 'tipo de manutenção', newLabel: 'Novo tipo de manutenção', linkLabel: 'OS',
    hint: 'Obrigatórios na triagem e na ordem de serviço',
    note: 'RF404: obrigatório na triagem (Assinante RF402) e na OS (RF502). OS geradas por plano de preventiva recebem automaticamente o tipo “Preventiva” (RGN002).',
  },
};

// ═══ Cadastro simples (RF402, RF403, RF404) ══════════════════════════
type SimpleRow = Record<string, unknown> & ConfigItem;
type Pending = { kind: 'form'; item: ConfigItem | null; tried?: boolean; draft?: Partial<ConfigItem> } | { kind: 'delete'; item: ConfigItem } | null;

function SimpleList({ dbKey, mode, active, header }: { dbKey: SimpleKey; mode: Mode; active: boolean; header: Header }) {
  const toast = useToast();
  const { db, can } = useSession();
  const meta = SIMPLE[dbKey];
  const items = db[dbKey];
  const [pending, setPending] = useState<Pending>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const filtered = items.filter((i) => matches(query, i.name, i.description ?? ''));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if ((page - 1) * PAGE_SIZE >= filtered.length && page > 1) setPage(1); }, [filtered.length, page]);

  useEffect(() => {
    if (!active) return;
    if (mode === 'new') setPending({ kind: 'form', item: null });
    if (mode === 'required') setPending({ kind: 'form', item: null, tried: true });
    if (mode === 'edit') setPending({ kind: 'form', item: items[0] });
    if (mode === 'duplicate') setPending({ kind: 'form', item: null, tried: true, draft: { name: items[0].name } });
    if (mode === 'delete') { const free = items.find((i) => i.links === 0); if (free) setPending({ kind: 'delete', item: free }); }
    if (mode === 'deleteblocked') setPending({ kind: 'delete', item: items[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, active]);

  const write = (fn: (list: ConfigItem[]) => ConfigItem[]) => updateDb((d) => ({ ...d, [dbKey]: fn(d[dbKey]) }));
  const art = meta.newLabel.startsWith('Nova') ? 'a' : 'o';
  const [toggling, setToggling] = useState<ConfigItem | null>(null);
  const setStatus = (item: ConfigItem, on: boolean) => {
    logConfig(on ? 'ativacao' : 'inativacao', `${on ? 'Ativou' : 'Inativou'} ${art} ${meta.singular} ${item.name}`);
    write((l) => l.map((x) => (x.id === item.id ? { ...x, status: on ? 'ativo' : 'inativo' } : x)));
    toast.show({ type: 'success', title: on ? 'Registro ativado' : 'Registro inativado', message: on ? `“${item.name}” volta a ser oferecido nas telas de cadastro.` : `“${item.name}” deixa de ser oferecido em novos cadastros, mas continua nos registros antigos.` });
  };

  const columns: TableColumn<SimpleRow>[] = [
    { key: 'name', label: 'Nome', render: (v, r) => (dbKey === 'categories' ? <Stack direction="horizontal" gap="xs" align="center"><CategoryIcon id={r.icon} /><span>{String(v)}</span></Stack> : String(v)) },
    { key: 'description', label: 'Descrição', render: (v) => (v ? String(v) : '-') },
    { key: 'links', label: `Vínculos (${meta.linkLabel})`, align: 'right' },
    { key: 'status', label: 'Status', render: (v) => recordStatusBadge(v as RecordStatus) },
    {
      key: 'id', label: 'Ações', sticky: 'right',
      render: (_, r) => (
        <RowActions>
          {can('configuracoes', 'editar') && <RowAction icon={<IconPencil size={16} />} label="Editar" target={r.name} onClick={() => setPending({ kind: 'form', item: r })} />}
          {can('configuracoes', 'ativar') && <RowAction icon={r.status === 'ativo' ? <IconCircleOff size={16} /> : <IconCircleCheck size={16} />} label={r.status === 'ativo' ? 'Inativar' : 'Ativar'} target={r.name} onClick={() => setToggling(r)} />}
          {can('configuracoes', 'excluir') && <RowAction icon={<IconTrash size={16} />} label="Excluir" target={r.name} onClick={() => setPending({ kind: 'delete', item: r })} />}
        </RowActions>
      ),
    },
  ];
  const isMobile = useIsMobile();
  const shownColumns = columns;
  const fieldsFor = <T,>(fields: T[]) => fields;   // sem “Exibição” em Configurações: todas as colunas e campos sempre visíveis

  const toolbar = (
          <TableToolbar
            search={<Input type="search" aria-label={`Buscar ${meta.singular} por nome ou descrição`} placeholder="Buscar por nome ou descrição" iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />}
          />
  );

  return (
    <Stack gap="xl">
      {header(can('configuracoes', 'cadastrar') && <Button iconLeft={<IconPlus size={20} />} onClick={() => setPending({ kind: 'form', item: null })}>{meta.newLabel}</Button>)}
      <DevNote note={`${meta.note} Padrão RF401: inativo deixa de ser oferecido nas listas de seleção, mas continua visível nos registros antigos (RGN002). 💡 Coluna de vínculos: sugestão da spec.`}>
        {isMobile ? (
          <MobileCardList
            headingId="config-list-title" title={meta.newLabel.replace(/^Nov[oa] /, '')} titleHidden toolbar={toolbar}
            emptyTitle={items.length ? 'Nenhum registro encontrado' : 'Nenhum registro cadastrado'}
            page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage}
            items={pageRows.map((r) => ({
              id: r.id, title: dbKey === 'categories' ? <Stack direction="horizontal" gap="xs" align="center"><CategoryIcon id={r.icon} /><span>{r.name}</span></Stack> : r.name, subtitle: r.description || undefined,
              badge: recordStatusBadge(r.status),
              fields: fieldsFor([{ label: `Vínculos (${meta.linkLabel})`, value: r.links }]),
              actions: (
                <RowActions>
                  {can('configuracoes', 'editar') && <RowAction icon={<IconPencil size={16} />} label="Editar" target={r.name} onClick={() => setPending({ kind: 'form', item: r })} />}
                  {can('configuracoes', 'ativar') && <RowAction icon={r.status === 'ativo' ? <IconCircleOff size={16} /> : <IconCircleCheck size={16} />} label={r.status === 'ativo' ? 'Inativar' : 'Ativar'} target={r.name} onClick={() => setToggling(r)} />}
                  {can('configuracoes', 'excluir') && <RowAction icon={<IconTrash size={16} />} label="Excluir" target={r.name} onClick={() => setPending({ kind: 'delete', item: r })} />}
                </RowActions>
              ),
            }))}
          />
        ) : (
          <Table<SimpleRow> caption={meta.newLabel.replace(/^Nov[oa] /, '')} columns={shownColumns}
            toolbar={toolbar}
            rows={pageRows as SimpleRow[]}
            empty={items.length ? { title: 'Nenhum registro encontrado', description: 'Revise a busca.' } : { title: 'Nenhum registro cadastrado' }}
            pagination={{ page, pageSize: PAGE_SIZE, total: filtered.length, onPageChange: setPage }}
          />
        )}
      </DevNote>

      {pending?.kind === 'form' && (
        <SimpleForm
          key={pending.item?.id ?? 'new'}
          singular={meta.singular}
          withIcon={dbKey === 'categories'}
          item={pending.item}
          initialTried={pending.tried}
          draft={pending.draft}
          others={items.filter((i) => i.id !== pending.item?.id)}
          onClose={() => setPending(null)}
          onSave={(data) => {
            logConfig(pending.item ? 'edicao' : 'cadastro', `${pending.item ? 'Editou' : 'Cadastrou'} ${art} ${meta.singular} ${data.name}`);
            if (pending.item) write((l) => l.map((x) => (x.id === pending.item!.id ? { ...x, ...data } : x)));
            else write((l) => [...l, { id: `${dbKey}-${Date.now()}`, links: 0, ...data }]);
            toast.show({ type: 'success', title: pending.item ? 'Registro atualizado' : 'Registro cadastrado', message: `“${data.name}” foi salvo.` });
            setPending(null);
          }}
        />
      )}
      {toggling && (
        <StatusConfirmDialog
          name={toggling.name}
          deactivate={toggling.status === 'ativo'}
          detail={toggling.status === 'ativo' ? `Deixa de ser oferecid${art} em novos cadastros, mas continua nos registros antigos.` : `Volta a ser oferecid${art} nas telas de cadastro.`}
          onClose={() => setToggling(null)}
          onConfirm={() => { setStatus(toggling, toggling.status !== 'ativo'); setToggling(null); }}
        />
      )}
      {pending?.kind === 'delete' && (
        <DeleteDialog
          name={pending.item.name}
          links={pending.item.links}
          linkLabel={meta.linkLabel}
          canInactivate={can('configuracoes', 'ativar') && pending.item.status === 'ativo'}
          onClose={() => setPending(null)}
          onInactivate={() => { setStatus(pending.item, false); setPending(null); }}
          onDelete={() => {
            logConfig('exclusao', `Excluiu ${art} ${meta.singular} ${pending.item.name}`);
            write((l) => l.filter((x) => x.id !== pending.item.id));
            toast.show({ type: 'success', title: 'Registro excluído', message: `“${pending.item.name}” foi excluído.` });
            setPending(null);
          }}
        />
      )}
    </Stack>
  );
}

function SimpleForm({ singular, withIcon, item, others, initialTried, draft, onClose, onSave }: {
  singular: string; withIcon?: boolean; item: ConfigItem | null; others: ConfigItem[]; initialTried?: boolean; draft?: Partial<ConfigItem>;
  onClose: () => void; onSave: (d: Pick<ConfigItem, 'name' | 'description' | 'status' | 'icon'>) => void;
}) {
  const [name, setName] = useState(draft?.name ?? item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [status, setStatus] = useState<RecordStatus>(item?.status ?? 'ativo');
  const [icon, setIcon] = useState<string | undefined>(item?.icon);
  const [tried, setTried] = useState(!!initialTried);
  const dup = others.some((o) => normalize(o.name) === normalize(name));
  const nameError = !tried ? undefined : !name.trim() ? requiredMessage('Nome') : dup ? `Já existe ${singular === 'categoria' ? 'uma categoria' : `um ${singular}`} com este nome` : undefined;
  // Mudou o Status de um registro existente: depois de Salvar, pede confirmação (o modal de edição dá lugar ao de confirmação)
  const [confirming, setConfirming] = useState(false);
  const commit = () => onSave({ name: name.trim(), description: description.trim(), status, icon: withIcon ? icon : undefined });
  const save = () => {
    setTried(true);
    if (!name.trim() || dup) return;
    if (item && status !== item.status) setConfirming(true); else commit();
  };
  if (confirming && item) {
    const fem = singular === 'categoria' ? 'a' : 'o';
    return (
      <StatusConfirmDialog
        name={item.name} deactivate={status === 'inativo'}
        detail={status === 'inativo' ? `Deixa de ser oferecid${fem} em novos cadastros, mas continua nos registros antigos.` : `Volta a ser oferecid${fem} nas telas de cadastro.`}
        onClose={() => setConfirming(false)}
        onConfirm={commit}
      />
    );
  }
  return (
    <Dialog
      open onClose={onClose}
      title={item ? `Editar ${singular}` : `Nov${singular === 'categoria' ? 'a' : 'o'} ${singular}`}
      actions={<><Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button><Button size="sm" onClick={save}>Salvar</Button></>}
    >
      <Stack gap="md">
        <DevNote note="Nome obrigatório e único dentro do cadastro (RF401-CTA003); comparação sem diferenciar maiúsculas e acentos.">
          <Input label="Nome" required value={name} onChange={(e) => setName(e.target.value)} error={nameError} />
        </DevNote>
        {withIcon && (
          <DevNote note="Ícone opcional da categoria (primeira versão): escolhido num catálogo curado de 67 ícones Tabler com nome e palavras-chave em português. Salva-se só o identificador estável do ícone, nunca o componente. Sem upload de imagens. Poderá ser usado depois em outros pontos da interface para facilitar o reconhecimento.">
            <IconPicker value={icon} onChange={setIcon} />
          </DevNote>
        )}
        <Textarea optional label="Descrição" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        {item && <RadioButton name="cfg-status" label="Status" orientation="horizontal" options={[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]} value={status} onChange={(v) => setStatus(v as RecordStatus)} />}
      </Stack>
    </Dialog>
  );
}

/** Confirmação de ativar/inativar (mesmo padrão de Usuários): título com o nome, texto do efeito e ação em largura total. */
function StatusConfirmDialog({ name, deactivate, detail, onClose, onConfirm }: {
  name: string; deactivate: boolean; detail: string; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <Dialog
      open size="sm" onClose={onClose}
      title={deactivate ? `Inativar ${name}?` : `Ativar ${name}?`}
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button size="sm" variant={deactivate ? 'destructive' : 'primary'} onClick={onConfirm}>{deactivate ? 'Inativar' : 'Ativar'}</Button>
        </>
      )}
    >
      <Text>{detail}</Text>
    </Dialog>
  );
}

/** Singular dos rótulos de vínculo (usado quando há exatamente 1 vínculo). */
const SINGULAR: Record<string, string> = { equipamentos: 'equipamento', 'solicitações': 'solicitação', registros: 'registro' };

function DeleteDialog({ name, links, linkLabel, canInactivate, onClose, onDelete, onInactivate }: {
  name: string; links: number; linkLabel: string; canInactivate: boolean; onClose: () => void; onDelete: () => void; onInactivate: () => void;
}) {
  if (links > 0) {
    return (
      <Dialog
        open size="sm" onClose={onClose} title={`Não é possível excluir “${name}”`}
        subtitle={`Está vinculado a ${links} ${links === 1 ? SINGULAR[linkLabel] ?? linkLabel : linkLabel}. Você pode inativá-lo para impedir novos usos sem afetar os registros existentes`}
        actions={<><Button size="sm" variant="secondary" onClick={onClose}>Fechar</Button>{canInactivate && <Button size="sm" onClick={onInactivate}>Inativar</Button>}</>}
      />
    );
  }
  return (
    <Dialog
      open size="sm" onClose={onClose} title={`Excluir “${name}”?`}
      actions={<><Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button><Button size="sm" variant="destructive" onClick={onDelete}>Excluir</Button></>}
    >
      <Text>O registro não tem vínculos. A exclusão não pode ser desfeita.</Text>
    </Dialog>
  );
}

// ═══ Níveis fixos (RF405 Prioridades, RF406 Criticidades) ═════════════
type LevelRow = Record<string, unknown> & LevelItem;

function LevelList({ dbKey, mode, active, header }: { dbKey: 'priorities' | 'criticalities'; mode: Mode; active: boolean; header: Header }) {
  const toast = useToast();
  const { db, can } = useSession();
  const items = db[dbKey];
  const [editing, setEditing] = useState<LevelItem | null>(null);
  const isPrio = dbKey === 'priorities';

  useEffect(() => { if (active && mode === 'edit') setEditing(items[0]); }, [mode, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: TableColumn<LevelRow>[] = [
    { key: 'level', label: isPrio ? 'Ordem' : 'Nível' },
    { key: 'name', label: 'Nome', render: (_, r) => visualBadgeOf(r.visual, r.name) },
    { key: 'description', label: 'Descrição' },
    { key: 'visual', label: 'Cor (tipo visual)', render: (v) => visualLabel(v as Visual) },
    { key: 'links', label: isPrio ? 'Chamados vinculados' : 'Equipamentos vinculados', align: 'right' },
    {
      key: 'id', label: 'Ações', sticky: 'right',
      render: (_, r) => can('configuracoes', 'editar')
        ? <RowActions><RowAction icon={<IconPencil size={16} />} label="Editar" target={r.name} onClick={() => setEditing(r)} /></RowActions>
        : null,
    },
  ];
  const isMobile = useIsMobile();
  const shownColumns = columns;
  const fieldsFor = <T,>(fields: T[]) => fields;   // sem “Exibição” em Configurações: todas as colunas e campos sempre visíveis

  const level = (id: string) => db.priorities.find((p) => p.id === id)!;
  type MatrixRow = Record<string, unknown> & { id: string; criticality: string; c0: string; c1: string; c2: string };
  const matrixRows: MatrixRow[] = PRIORITY_MATRIX.map((m) => ({ id: m.criticality, criticality: db.criticalities.find((c) => c.id === m.criticality)!.name, c0: m.cells[0], c1: m.cells[1], c2: m.cells[2] }));
  const matrixCols: TableColumn<MatrixRow>[] = [
    { key: 'criticality', label: 'Criticidade \\ Impacto' },
    ...IMPACTS.map((label, i): TableColumn<MatrixRow> => ({ key: `c${i}` as keyof MatrixRow, label, render: (v) => { const l = level(String(v)); return visualBadgeOf(l.visual, l.name); } })),
  ];

  return (
    <Stack gap="xl">
      {header()}
      <DevNote note={isPrio
        ? 'RF405: níveis fixos (sem incluir/excluir), ordem fixa; editáveis nome, descrição e cor. A cor usa a paleta fixa de tipos visuais (RF407-RGN005, sem cor livre) e alimenta listas e dashboards. Tempos de SLA por prioridade são FE001 (fora do escopo) - não há campos de SLA.'
        : 'RF406: níveis fixos A/B/C (CTA002 - não é possível incluir ou excluir); criticidade é obrigatória no equipamento e alimenta a matriz de prioridade e os indicadores dos dashboards (RGN006).'}>
        {isMobile ? (
          <MobileCardList
            headingId="levels-title" title={isPrio ? 'Prioridades' : 'Criticidades'} titleHidden
            emptyTitle="Nenhum registro" page={1} pageSize={items.length || 1} total={items.length} onPageChange={() => undefined}
            items={items.map((r) => ({
              id: r.id, title: r.name, subtitle: r.description,
              badge: visualBadgeOf(r.visual, isPrio ? `Ordem ${r.level}` : `Nível ${r.level}`),
              fields: fieldsFor([
                { label: 'Cor (tipo visual)', value: visualLabel(r.visual) },
                { label: isPrio ? 'Chamados vinculados' : 'Equipamentos vinculados', value: r.links },
              ]),
              actions: can('configuracoes', 'editar')
                ? <RowActions><RowAction icon={<IconPencil size={16} />} label="Editar" target={r.name} onClick={() => setEditing(r)} /></RowActions>
                : undefined,
            }))}
          />
        ) : (
          <Table<LevelRow> caption={isPrio ? 'Prioridades' : 'Criticidades'} columns={shownColumns} rows={items as LevelRow[]} />
        )}
      </DevNote>

      {isPrio && (
        <DevNote note="Matriz sugerida (💡 Plathanus, validar com a cliente): na abertura da solicitação, criticidade do equipamento × impacto informado sugerem a prioridade; o gestor pode ajustar com justificativa na triagem. Fixa no MVP (RGN003) - por isso somente leitura.">
          {isMobile ? (
            <MobileCardList
              headingId="matrix-title" title="Matriz de prioridade sugerida" subtitle="Define a prioridade sugerida com base na criticidade do equipamento e no impacto operacional"
              emptyTitle="Sem dados" page={1} pageSize={matrixRows.length || 1} total={matrixRows.length} onPageChange={() => undefined}
              items={matrixRows.map((m) => ({
                id: m.id, title: `Criticidade ${m.criticality}`,
                fields: IMPACTS.map((label, i) => { const l = level(String(m[`c${i}`])); return { label: `Impacto ${label.toLowerCase()}`, value: visualBadgeOf(l.visual, l.name) }; }),
              }))}
            />
          ) : (
            <Table<MatrixRow> title="Matriz de prioridade sugerida" subtitle="Define a prioridade sugerida com base na criticidade do equipamento e no impacto operacional" columns={matrixCols} rows={matrixRows} />
          )}
        </DevNote>
      )}

      {editing && (
        <LevelForm
          key={editing.id}
          item={editing}
          isPrio={isPrio}
          others={items.filter((i) => i.id !== editing.id)}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            logConfig('edicao', `Editou ${isPrio ? 'a prioridade' : 'a criticidade'} ${editing.name}`);
            updateDb((d: Db) => ({ ...d, [dbKey]: d[dbKey].map((x) => (x.id === editing.id ? { ...x, ...data } : x)) }));
            toast.show({ type: 'success', title: 'Nível atualizado', message: 'A alteração reflete em todas as telas que usam este nível.' });
            setEditing(null);
          }}
        />
      )}
    </Stack>
  );
}

function LevelForm({ item, isPrio, others, onClose, onSave }: {
  item: LevelItem; isPrio: boolean; others: LevelItem[]; onClose: () => void; onSave: (d: Pick<LevelItem, 'name' | 'description' | 'visual'>) => void;
}) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [visual, setVisual] = useState<Visual>(item.visual);
  const [tried, setTried] = useState(false);
  const dup = others.some((o) => normalize(o.name) === normalize(name));
  const nameError = !tried ? undefined : !name.trim() ? requiredMessage('Nome') : dup ? 'Já existe um nível com este nome' : undefined;
  const save = () => { setTried(true); if (name.trim() && !dup) onSave({ name: name.trim(), description: description.trim(), visual }); };
  return (
    <Dialog
      open onClose={onClose} title={isPrio ? 'Editar prioridade' : 'Editar criticidade'}
      actions={<><Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button><Button size="sm" onClick={save}>Salvar</Button></>}
    >
      <Stack gap="md">
        <Grid>
          <Col span={6}><Input label={isPrio ? 'Ordem' : 'Nível'} value={item.level} readOnly helperText="Fixo" /></Col>
          <Col span={6}>
            <Stack gap="xs">
              <Dropdown label="Cor (tipo visual)" options={VISUALS.map((v) => ({ value: v.value, label: v.label }))} value={visual} onChange={(v) => setVisual(v as Visual)} />
            </Stack>
          </Col>
        </Grid>
        <Input label="Nome" required value={name} onChange={(e) => setName(e.target.value)} error={nameError} />
        <Textarea optional label="Descrição" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        <Stack direction="horizontal" gap="sm" align="center"><Text>Pré-visualização:</Text><Badge status={visualBadge(visual)} dot>{name || 'Nome do nível'}</Badge></Stack>
      </Stack>
    </Dialog>
  );
}

// ═══ Status configuráveis (RF407) ═══════════════════════════════════
type StatusRow = Record<string, unknown> & StatusItem;
type StatusDraft = { module: StatusModule | ''; name: string; visual: Visual | ''; base: BaseSituation | ''; position: string; status: RecordStatus };

function StatusList({ mode, active, header }: { mode: Mode; active: boolean; header: Header }) {
  const toast = useToast();
  const { db, can } = useSession();
  const [module, setModule] = useState<StatusModule | 'todos'>('todos');
  const [form, setForm] = useState<{ item: StatusItem | null; tried?: boolean } | null>(null);
  const [removing, setRemoving] = useState<StatusItem | null>(null);
  const [toggling, setToggling] = useState<StatusItem | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!active) return;
    if (mode === 'new') setForm({ item: null });
    if (mode === 'required') setForm({ item: null, tried: true });
    if (mode === 'edit') setForm({ item: db.statuses[0] });
    if (mode === 'deleteblocked') setRemoving(db.statuses[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, active]);

  const rows = useMemo(() => db.statuses
    .filter((s) => module === 'todos' || s.module === module)
    .filter((s) => matches(query, s.name))
    .sort((a, b) => STATUS_MODULES.findIndex((m) => m.value === a.module) - STATUS_MODULES.findIndex((m) => m.value === b.module) || a.order - b.order), [db, module, query]);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if ((page - 1) * PAGE_SIZE >= rows.length && page > 1) setPage(1); }, [rows.length, page]);
  const write = (fn: (l: StatusItem[]) => StatusItem[]) => updateDb((d) => ({ ...d, statuses: fn(d.statuses) }));
  const setStatus = (s: StatusItem, on: boolean) => {
    logConfig(on ? 'ativacao' : 'inativacao', `${on ? 'Ativou' : 'Inativou'} o status ${s.name}`);
    write((l) => l.map((x) => (x.id === s.id ? { ...x, status: on ? 'ativo' : 'inativo' } : x)));
    toast.show({ type: 'success', title: on ? 'Status ativado' : 'Status inativado', message: `“${s.name}” ${on ? 'volta a ser oferecido' : 'deixa de ser oferecido'} em ${moduleLabel(s.module)}.` });
  };

  const columns: TableColumn<StatusRow>[] = [
    { key: 'module', label: 'Módulo / etapa', render: (v) => moduleLabel(v as StatusModule) },
    { key: 'order', label: 'Ordem', align: 'right' },
    { key: 'name', label: 'Status', render: (_, r) => statusBadgeOf(r.visual, r.name) },
    { key: 'visual', label: 'Tipo visual', render: (v) => visualLabel(v as Visual) },
    { key: 'base', label: 'Situação-base', render: (v) => baseLabel(v as BaseSituation) },
    { key: 'links', label: 'Vínculos', align: 'right' },
    { key: 'status', label: 'Situação', render: (v) => recordStatusBadge(v as RecordStatus) },
    {
      key: 'id', label: 'Ações', sticky: 'right',
      render: (_, r) => (
        <RowActions>
          {can('configuracoes', 'editar') && <RowAction icon={<IconPencil size={16} />} label="Editar status" target={r.name} onClick={() => setForm({ item: r })} />}
          {can('configuracoes', 'ativar') && <RowAction icon={r.status === 'ativo' ? <IconCircleOff size={16} /> : <IconCircleCheck size={16} />} label={r.status === 'ativo' ? 'Inativar status' : 'Ativar status'} target={r.name} onClick={() => setToggling(r)} />}
          {can('configuracoes', 'excluir') && <RowAction icon={<IconTrash size={16} />} label="Excluir status" target={r.name} onClick={() => setRemoving(r)} />}
        </RowActions>
      ),
    },
  ];
  const isMobile = useIsMobile();
  const shownColumns = columns;
  const fieldsFor = <T,>(fields: T[]) => fields;   // sem “Exibição” em Configurações: todas as colunas e campos sempre visíveis

  const toolbar = (
          <TableToolbar
            search={<Input type="search" aria-label="Buscar status por nome" placeholder="Buscar por nome" iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />}
            status={<Dropdown aria-label="Filtrar por módulo" options={[{ value: 'todos', label: 'Todos os módulos' }, ...STATUS_MODULES]} value={module} onChange={(v) => { setModule(v as StatusModule | 'todos'); setPage(1); }} />}
          />
  );

  return (
    <Stack gap="xl">
      {header(can('configuracoes', 'cadastrar') && <Button iconLeft={<IconPlus size={20} />} onClick={() => setForm({ item: null })}>Novo status</Button>)}
      <DevNote note="RF407: status configuráveis por módulo/etapa (criar, editar, excluir - RGN004), cada um com tipo visual da paleta fixa de 5 (RGN005, sem cor livre) e situação-base fixa do sistema (💡 proposta técnica): as regras automáticas usam a situação-base, não o nome - criar status não quebra o fluxo (CTA005). Status aparecem só no módulo a que pertencem (CTA004). Crítico e Atenção alimentam os alertas dos dashboards (RGN007). Carga inicial: RGN001–RGN003. 💡 Preventiva como módulo: a confirmar, não incluída. 💡 P13: a cliente enviará os tipos visuais de cada status.">
        {isMobile ? (
          <MobileCardList
            headingId="status-list-title" title="Status" titleHidden toolbar={toolbar}
            emptyTitle="Nenhum status encontrado"
            page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage}
            items={pageRows.map((r) => ({
              id: r.id, title: r.name, subtitle: moduleLabel(r.module),
              badge: recordStatusBadge(r.status),
              fields: fieldsFor([
                { label: 'Ordem', value: r.order },
                { label: 'Tipo visual', value: statusBadgeOf(r.visual, visualLabel(r.visual)) },
                { label: 'Situação-base', value: baseLabel(r.base) },
                { label: 'Vínculos', value: r.links },
              ]),
              actions: (
                <RowActions>
                  {can('configuracoes', 'editar') && <RowAction icon={<IconPencil size={16} />} label="Editar status" target={r.name} onClick={() => setForm({ item: r })} />}
                  {can('configuracoes', 'ativar') && <RowAction icon={r.status === 'ativo' ? <IconCircleOff size={16} /> : <IconCircleCheck size={16} />} label={r.status === 'ativo' ? 'Inativar status' : 'Ativar status'} target={r.name} onClick={() => setToggling(r)} />}
                  {can('configuracoes', 'excluir') && <RowAction icon={<IconTrash size={16} />} label="Excluir status" target={r.name} onClick={() => setRemoving(r)} />}
                </RowActions>
              ),
            }))}
          />
        ) : (
          <Table<StatusRow> caption="Status" columns={shownColumns}
            toolbar={toolbar}
            rows={pageRows as StatusRow[]}
            empty={{ title: 'Nenhum status encontrado', description: 'Revise a busca ou o filtro de módulo.' }}
            pagination={{ page, pageSize: PAGE_SIZE, total: rows.length, onPageChange: setPage }}
          />
        )}
      </DevNote>

      {form && (
        <StatusForm
          key={form.item?.id ?? 'new'}
          item={form.item}
          initialTried={form.tried}
          defaultModule={module === 'todos' ? '' : module}
          all={db.statuses}
          onClose={() => setForm(null)}
          onSave={(data) => {
            logConfig(form.item ? 'edicao' : 'cadastro', `${form.item ? 'Editou' : 'Cadastrou'} o status ${data.name}`);
            const { position, ...fields } = data;
            if (form.item) {
              const id = form.item.id;
              const from = form.item.module;
              write((l) => {
                const placed = placeStatus(l.map((x) => (x.id === id ? { ...x, ...fields } : x)), id, position);
                return from === fields.module ? placed : renumber(placed, from);
              });
            } else {
              const id = `ST-${Date.now()}`;
              write((l) => placeStatus([...l, { id, links: 0, order: 0, ...fields }], id, position));
            }
            toast.show({ type: 'success', title: form.item ? 'Status atualizado' : 'Status cadastrado', message: form.item ? 'Nome e tipo visual refletem em todas as telas (CTA002).' : `“${data.name}” já pode ser usado em ${moduleLabel(data.module)}.` });
            setForm(null);
          }}
        />
      )}
      {toggling && (
        <StatusConfirmDialog
          name={toggling.name}
          deactivate={toggling.status === 'ativo'}
          detail={toggling.status === 'ativo' ? `Deixa de ser oferecido em ${moduleLabel(toggling.module)}, mas continua nos registros antigos.` : `Volta a ser oferecido em ${moduleLabel(toggling.module)}.`}
          onClose={() => setToggling(null)}
          onConfirm={() => { setStatus(toggling, toggling.status !== 'ativo'); setToggling(null); }}
        />
      )}
      {removing && (
        <DeleteDialog
          name={removing.name}
          links={removing.links}
          linkLabel="registros"
          canInactivate={can('configuracoes', 'ativar') && removing.status === 'ativo'}
          onClose={() => setRemoving(null)}
          onInactivate={() => { setStatus(removing, false); setRemoving(null); }}
          onDelete={() => {
            logConfig('exclusao', `Excluiu o status ${removing.name}`);
            write((l) => l.filter((x) => x.id !== removing.id));
            toast.show({ type: 'success', title: 'Status excluído', message: `“${removing.name}” foi excluído.` });
            setRemoving(null);
          }}
        />
      )}
    </Stack>
  );
}

/**
 * Posição no fluxo: o usuário escolhe "No início", "Depois de <status>" ou "No final" entre os status do módulo; a ordem numérica
 * é só interna. `start` | `end` | `after:<id>`.
 */
const siblingsOf = (all: StatusItem[], module: StatusModule | '', selfId?: string) =>
  all.filter((s) => s.module === module && s.id !== selfId).sort((a, b) => a.order - b.order);
const positionKey = (siblings: StatusItem[], index: number) => (index <= 0 ? 'start' : index >= siblings.length ? 'end' : `after:${siblings[index - 1].id}`);
const positionOptions = (siblings: StatusItem[]) => [
  { value: 'start', label: 'No início' },
  // “Depois do último” equivale a “No final”: não é oferecido duas vezes
  ...siblings.slice(0, -1).map((s) => ({ value: `after:${s.id}`, label: `Depois de “${s.name}”` })),
  { value: 'end', label: 'No final' },
];
/** Insere `id` na posição escolhida entre os status do módulo e renumera a ordem (1..n) sem repetir nem pular posições. */
const placeStatus = (list: StatusItem[], id: string, position: string): StatusItem[] => {
  const target = list.find((s) => s.id === id)!;
  const siblings = siblingsOf(list, target.module, id);
  const index = position === 'start' ? 0 : position === 'end' ? siblings.length : siblings.findIndex((s) => s.id === position.slice(6)) + 1;
  const ordered = [...siblings.slice(0, index), target, ...siblings.slice(index)];
  const order = new Map(ordered.map((s, i) => [s.id, i + 1]));
  return list.map((s) => (order.has(s.id) ? { ...s, order: order.get(s.id)! } : s));
};
/** Renumera um módulo (1..n) mantendo a ordem atual: usado quando um status sai dele. */
const renumber = (list: StatusItem[], module: StatusModule): StatusItem[] => {
  const order = new Map(siblingsOf(list, module).map((s, i) => [s.id, i + 1]));
  return list.map((s) => (order.has(s.id) ? { ...s, order: order.get(s.id)! } : s));
};

function StatusForm({ item, all, defaultModule, initialTried, onClose, onSave }: {
  item: StatusItem | null; all: StatusItem[]; defaultModule: StatusModule | ''; initialTried?: boolean;
  onClose: () => void; onSave: (d: Omit<StatusItem, 'id' | 'links' | 'order'> & { position: string }) => void;
}) {
  const [d, setD] = useState<StatusDraft>(() => (item
    ? { module: item.module, name: item.name, visual: item.visual, base: item.base, position: positionKey(siblingsOf(all, item.module, item.id), siblingsOf(all, item.module).findIndex((s) => s.id === item.id)), status: item.status }
    : { module: defaultModule, name: '', visual: '', base: '', position: 'end', status: 'ativo' }));
  const [tried, setTried] = useState(!!initialTried);
  const set = <K extends keyof StatusDraft>(k: K, v: StatusDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const positions = positionOptions(siblingsOf(all, d.module, item?.id));
  const dup = all.some((s) => s.id !== item?.id && s.module === d.module && normalize(s.name) === normalize(d.name));
  const err = (ok: boolean, field: string) => (tried && !ok ? requiredMessage(field) : undefined);
  const errors = {
    module: err(!!d.module, 'Módulo / etapa'),
    name: err(!!d.name.trim(), 'Nome') ?? (tried && dup ? 'Já existe um status com este nome neste módulo' : undefined),
    visual: err(!!d.visual, 'Tipo visual'),
    base: err(!!d.base, 'Situação-base'),
  };
  const [confirming, setConfirming] = useState(false);
  const commit = () => onSave({ module: d.module as StatusModule, name: d.name.trim(), visual: d.visual as Visual, base: d.base as BaseSituation, position: d.position, status: d.status });
  const save = () => {
    setTried(true);
    if (!d.module || !d.name.trim() || dup || !d.visual || !d.base) return;
    if (item && d.status !== item.status) setConfirming(true); else commit();
  };
  if (confirming && item) {
    return (
      <StatusConfirmDialog
        name={item.name} deactivate={d.status === 'inativo'}
        detail={d.status === 'inativo' ? 'Deixa de ser oferecido em novos cadastros, mas continua nos registros antigos.' : 'Volta a ser oferecido nas telas de cadastro.'}
        onClose={() => setConfirming(false)}
        onConfirm={commit}
      />
    );
  }
  return (
    <Dialog
      open size="lg" onClose={onClose} title={item ? 'Editar status' : 'Novo status'}
      actions={<><Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button><Button size="sm" onClick={save}>Salvar</Button></>}
    >
      <Grid>
        <Col span={6}><Input label="Nome" required value={d.name} onChange={(e) => set('name', e.target.value)} error={errors.name} /></Col>
        <Col span={6}>
          <DevNote note="FLU003 / CTA003: escolha obrigatória entre os 5 tipos visuais fixos - não há cor livre.">
            <Dropdown label="Tipo visual" required options={VISUALS.map((v) => ({ value: v.value, label: v.label }))} value={d.visual} onChange={(v) => set('visual', v as Visual)} error={errors.visual} />
          </DevNote>
        </Col>
        <Col span={6}>
          <DevNote note="FLU002: o status pertence a um módulo/etapa e só aparece nele (CTA004).">
            <Dropdown label="Módulo / etapa" required options={STATUS_MODULES} value={d.module} onChange={(v) => setD((x) => ({ ...x, module: v as StatusModule, position: 'end' }))} error={errors.module} />
          </DevNote>
        </Col>
        <Col span={6}>
          <DevNote note="💡 Proposta técnica (RGN004): a situação-base é fixa do sistema e é o que as regras automáticas usam (encerrar solicitação, contar downtime, bloquear execução em “Aguardando aprovação”). Validar com a cliente e o desenvolvimento.">
            <Dropdown label="Situação-base" required options={BASE_SITUATIONS} value={d.base} onChange={(v) => set('base', v as BaseSituation)} error={errors.base} />
          </DevNote>
        </Col>
        <Col span={6}>
          <DevNote note="A posição é escolhida em relação aos status do mesmo módulo/etapa (No início, Depois de…, No final; padrão: No final). O sistema guarda a ordem numérica internamente e renumera os demais: não há campo de número nem posições repetidas.">
            <Dropdown label="Posição no fluxo" options={positions} value={d.position} onChange={(v) => set('position', v)} disabled={!d.module} helperText="Define onde o status aparece no fluxo." />
          </DevNote>
        </Col>
        {item && (
          <Col span={6}>
            <RadioButton name="st-status" label="Status" orientation="horizontal" options={[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]} value={d.status} onChange={(v) => set('status', v as RecordStatus)} />
          </Col>
        )}
        <Col span={12}>
          <Stack direction="horizontal" gap="sm" align="center"><Text>Pré-visualização:</Text>{d.visual ? statusBadgeOf(d.visual, d.name || 'Nome do status') : <Text>escolha o tipo visual</Text>}</Stack>
        </Col>
      </Grid>
    </Dialog>
  );
}

// ═══ Tela ═══════════════════════════════════════════════════════════
function ConfiguracoesScreen() {
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const page = PAGES.find((p) => p.slug === document.body.dataset.config) ?? PAGES[0];

  const header: Header = (actions) => (
    <PageHeader
      title={page.label}
      subtitle={page.subtitle}
      actions={actions || undefined}
    />
  );
  const pane = () => {
    switch (page.slug) {
      case 'categorias': return <SimpleList dbKey="categories" mode={mode} active header={header} />;
      case 'tipos-solicitacao': return <SimpleList dbKey="requestTypes" mode={mode} active header={header} />;
      case 'tipos-manutencao': return <SimpleList dbKey="maintenanceTypes" mode={mode} active header={header} />;
      case 'prioridades': return <LevelList dbKey="priorities" mode={mode} active header={header} />;
      case 'criticidades': return <LevelList dbKey="criticalities" mode={mode} active header={header} />;
      default: return <StatusList mode={mode} active header={header} />;
    }
  };

  return (
    <AppLayout active={`configuracoes-${page.slug}`} screen="configuracoes">
      <DevNote note="RF401-CTA001: todos os cadastros de Configurações seguem o mesmo layout e comportamento (uma página por cadastro, no submenu de Configurações do menu lateral). Valores iniciais vêm do documento do cliente na carga inicial (RGN004).">
        {pane()}
      </DevNote>
    </AppLayout>
  );
}

mountApp(<ConfiguracoesScreen />);
