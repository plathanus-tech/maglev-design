import { ReactElement, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  IconAlertTriangle, IconChevronDown, IconClipboardList, IconChecklist, IconChevronRight, IconCircleCheck, IconCircleOff, IconEye, IconMicrowave,
  IconPencil, IconPlayerStop, IconPlus, IconQrcode, IconReportMoney, IconSearch, IconTool, IconBuildingStore, IconLayoutGrid, IconPhoto, IconPrinter,
} from '@tabler/icons-react';
import { Button, Card, Checkbox, Dialog, EmptyState, Feedback, Input, KpiCard, Pagination, Stack, Tab, Table, TableColumn, useToast } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { FilterControl } from '../../admin/shared/FilterControl';
import { useColumnPrefs } from '../../admin/shared/ColumnsControl';
import { MobileCardItem, MobileCardList } from '../../admin/shared/MobileCardList';
import { useHashState } from '../../admin/shared/useHashState';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { formatDate, formatMoney, formatNumber, normalize } from '../../admin/shared/format';
import { Environment, Equipment, Unit } from './data';
import { RowMenu, RowMenuItem } from './RowMenu';
import { photoSrc } from './photos';
import { updateSubDb, useSubSession } from './store';
import { CellPair, Col, Grid, RowAction, RowActions, TableToolbar, goTo, param, recordStatusBadge, takeFlash, useRefs } from './ui';
import {
  EquipmentToggleDialog, BatchLabelDialog, QrDialogs, isAlert, isInactive, isOverdue, isStopped, nextPreventive, openOrdersOf, spent30d, spentOf,
} from './equipamento-lib';
import './equipamento.css';

/** Estados: idle · hierarchical (aba Hierárquica) · expanded (árvore toda aberta) · noresults · inactivate · qr */
const STATES = ['idle', 'hierarchical', 'expanded', 'list', 'noresults', 'inactivate', 'qr'] as const;
type Mode = (typeof STATES)[number];

const PAGE_SIZE = 10;
const TREE_PAGE_SIZE = 5;
const ALL = 'todos';

type Row = Record<string, unknown> & {
  id: string; name: string; code: string; categoryName: string; unitName: string; envName: string; statusId: string; criticalityId: string;
  open: number; next?: string; cost: number; equipment: Equipment;
};
type TreeRow = Record<string, unknown> & {
  rowId: string; kind: 'unit' | 'env' | 'eq'; level: 0 | 1 | 2; name: string; sub: string; unitId: string; envId?: string; equipment?: Equipment;
  total: number; stopped: number; alert: number; open: number; expandable: boolean; isOpen: boolean;
};

const KIND_LABEL = { unit: 'Unidade', env: 'Ambiente', eq: 'Equipamento' } as const;

function EquipamentosScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const { db, can, unitIds, canSeeCosts } = useSubSession();
  const refs = useRefs();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const eqStatuses = refs.activeStatuses('equipamento');
  const statusIdByVisual = (v: string) => eqStatuses.find((s) => s.visual === v)?.id ?? ALL;

  // Filtros por URL (links dos cards do Início): ?filter=stopped|alert|inactive e ?unit=
  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState(() => { const u = param('unit'); return u && unitIds.includes(u) ? u : ALL; });
  const [env, setEnv] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState(() => {
    const f = param('filter');
    return f === 'running' ? statusIdByVisual('sucesso') : f === 'maintenance' ? statusIdByVisual('informativo') : f === 'stopped' ? statusIdByVisual('critico') : f === 'alert' ? statusIdByVisual('atencao') : f === 'inactive' ? (eqStatuses.find((s) => refs.base(s.id) === 'cancelado')?.id ?? ALL) : ALL;
  });
  const [criticality, setCriticality] = useState(ALL);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [treePage, setTreePage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [toggling, setToggling] = useState<Equipment | null>(null);
  const [qr, setQr] = useState<{ id: string; mode: 'qr' | 'label' } | null>(null);

  const visibleUnits = useMemo(() => db.units.filter((u) => unitIds.includes(u.id)), [db.units, unitIds]);
  const visible = useMemo(() => db.equipments.filter((e) => unitIds.includes(e.unitId)), [db.equipments, unitIds]);
  const unitOf = (id: string) => db.units.find((u) => u.id === id);
  const envOf = (id: string) => db.environments.find((e) => e.id === id);

  // ── Resumo (RF302/RF303): sobre todos os ativos visíveis ao perfil ──
  const kpis = useMemo(() => {
    const live = visible.filter((e) => !isInactive(refs, e));
    const ids = new Set(visible.map((e) => e.id));
    return {
      total: live.length,
      stopped: live.filter((e) => isStopped(refs, e)).length,
      alert: live.filter((e) => isAlert(refs, e)).length,
      openOrders: visible.reduce((n, e) => n + openOrdersOf(db, refs, e.id).length, 0),
      spent: spent30d(db, refs, ids),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, refs.admin, visible]);

  // ── Filtros cumulativos + busca ──
  const filtering = !!query.trim() || [unit, env, category, status, criticality].some((v) => v !== ALL);
  const q = normalize(query);
  const has = (...v: Array<string | undefined>) => v.some((x) => !!x && normalize(x).includes(q));
  const structFiltering = [unit, env, category, status, criticality].some((v) => v !== ALL);
  // Filtros estruturados (tudo menos a busca)
  const passes = (e: Equipment) => (unit === ALL || e.unitId === unit) && (env === ALL || envOf(e.environmentId)?.name === env)
    && (category === ALL || e.categoryId === category) && (status === ALL || e.statusId === status) && (criticality === ALL || e.criticalityId === criticality);
  const matches = (e: Equipment) => (!q || has(e.name, e.code, unitOf(e.unitId)?.name, envOf(e.environmentId)?.name)) && passes(e);
  const filtered = useMemo(() => visible.filter(matches), [visible, query, unit, env, category, status, criticality, db.units, db.environments]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredNoQuery = useMemo(() => visible.filter(passes), [visible, unit, env, category, status, criticality, db.environments]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows: Row[] = useMemo(() => filtered.map((e) => ({
    id: e.id, name: e.name, code: e.code, categoryName: refs.category(e.categoryId)?.name ?? '-', unitName: unitOf(e.unitId)?.name ?? '-', envName: envOf(e.environmentId)?.name ?? '-',
    statusId: e.statusId, criticalityId: e.criticalityId, open: openOrdersOf(db, refs, e.id).length, next: nextPreventive(db, e.id), cost: spentOf(db, refs, e.id), equipment: e,
  })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') * (sortDir === 'asc' ? 1 : -1)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [filtered, db, refs.admin, sortDir]);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Árvore (RF302): totalizadores somam os equipamentos abaixo de cada nível (RGN001) ──
  const totals = (list: Equipment[]) => ({
    total: list.filter((e) => !isInactive(refs, e)).length,
    stopped: list.filter((e) => !isInactive(refs, e) && isStopped(refs, e)).length,
    alert: list.filter((e) => !isInactive(refs, e) && isAlert(refs, e)).length,
    open: list.reduce((n, e) => n + openOrdersOf(db, refs, e.id).length, 0),
  });
  // A busca da aba Hierárquica localiza unidades, ambientes e equipamentos. Unidade ou ambiente que casam trazem toda a estrutura
  // abaixo (com os filtros aplicados); equipamento que casa mantém seu ambiente e sua unidade visíveis.
  const treeModel = useMemo(() => {
    const out: Array<{ unit: Unit; envs: Array<{ env: Environment; eqs: Equipment[] }> }> = [];
    [...visibleUnits].sort((x, y) => x.name.localeCompare(y.name, 'pt-BR')).forEach((u) => {
      const uMatch = !!q && has(u.name, u.code);
      const ue = filteredNoQuery.filter((e) => e.unitId === u.id);
      const envs: Array<{ env: Environment; eqs: Equipment[] }> = [];
      db.environments.filter((x) => x.unitId === u.id).forEach((x) => {
        const xMatch = !!q && has(x.name);
        const ee = ue.filter((e) => e.environmentId === x.id);
        const eqs = !q || uMatch || xMatch ? ee : ee.filter((e) => has(e.name, e.code));
        if (q && !uMatch && !xMatch && eqs.length === 0) return;
        if (structFiltering && eqs.length === 0) return;
        envs.push({ env: x, eqs });
      });
      if ((q || structFiltering) && envs.length === 0 && !(q && uMatch && !structFiltering)) return;
      out.push({ unit: u, envs });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleUnits, filteredNoQuery, db.environments, query, structFiltering]);
  const treeUnits = treeModel;
  const treeRows: TreeRow[] = useMemo(() => {
    const out: TreeRow[] = [];
    treeUnits.slice((treePage - 1) * TREE_PAGE_SIZE, treePage * TREE_PAGE_SIZE).forEach(({ unit: u, envs }) => {
      out.push({ rowId: u.id, kind: 'unit', level: 0, name: u.name, sub: u.code, unitId: u.id, ...totals(envs.flatMap((x) => x.eqs)), expandable: envs.length > 0, isOpen: expanded.has(u.id) });
      if (!expanded.has(u.id)) return;
      envs.forEach(({ env: x, eqs: ee }) => {
        out.push({ rowId: x.id, kind: 'env', level: 1, name: x.name, sub: u.name, unitId: u.id, envId: x.id, ...totals(ee), expandable: ee.length > 0, isOpen: expanded.has(x.id) });
        if (!expanded.has(x.id)) return;
        [...ee].sort((p, r) => p.name.localeCompare(r.name, 'pt-BR')).forEach((e) => {
          out.push({ rowId: e.id, kind: 'eq', level: 2, name: e.name, sub: e.code, unitId: u.id, envId: x.id, equipment: e, ...totals([e]), expandable: false, isOpen: false });
        });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeUnits, treePage, expanded, db, refs.admin]);

  useEffect(() => setPage(1), [query, unit, env, category, status, criticality, sortDir]);
  useEffect(() => setTreePage(1), [query, unit, env, category, status, criticality]);
  // Com busca ou filtro ativos, a árvore abre sozinha nos níveis com resultado (CTA002 segue valendo: dá para recolher)
  useEffect(() => {
    if (!filtering) return;
    setExpanded(new Set(treeModel.flatMap(({ unit: u, envs }) => [...(envs.length ? [u.id] : []), ...envs.filter((x) => x.eqs.length).map((x) => x.env.id)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, unit, env, category, status, criticality]);
  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!expanded.size && !filtering) setExpanded(new Set(visibleUnits.slice(0, 1).map((u) => u.id)));
    if (mode === 'expanded') setExpanded(new Set([...visibleUnits.map((u) => u.id), ...db.environments.filter((x) => unitIds.includes(x.unitId)).map((x) => x.id)]));
    if (mode === 'noresults') setQuery('Coifa industrial 99');
    if (mode === 'inactivate') setToggling(visible.find((e) => !isInactive(refs, e) && openOrdersOf(db, refs, e.id).length > 0) ?? visible[0] ?? null);
    if (mode === 'qr' && visible[0]) setQr({ id: visible[0].id, mode: 'qr' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const toggleExpand = (id: string) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // ── Seleção para impressão de etiquetas em lote (só na Lista, desktop) ──
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);   // mobile: modo explícito de seleção nos cards
  const pageIds = pageRows.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));
  const toggleOne = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const togglePage = () => setSelected((s) => { const n = new Set(s); if (allPageSelected) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id)); return n; });
  const selectAllResult = () => setSelected((s) => new Set([...s, ...rows.map((r) => r.id)]));
  const clearSelection = () => setSelected(new Set());
  // A seleção é independente de busca, filtros e página: só muda por ação explícita (marcar/desmarcar, selecionar o resultado, limpar)
  const selectedEquipments = visible.filter((e) => selected.has(e.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const selectedCount = selectedEquipments.length;
  const hiddenSelected = selectedEquipments.filter((e) => !rows.some((r) => r.id === e.id)).length;
  const canExtend = allPageSelected && rows.some((r) => !selected.has(r.id));
  const selectionBar = selectedCount > 0 ? (
    <DevNote note="RF305 (sugestão): seleção múltipla na Lista só para imprimir etiquetas em lote (sem editar/inativar em lote). A barra aparece abaixo da busca e dos filtros, que continuam visíveis. O checkbox do cabeçalho seleciona a página atual; para o resultado inteiro (todas as páginas) há a ação explícita “Selecionar os N equipamentos deste resultado”. A seleção persiste ao buscar, filtrar ou trocar de página (itens fora do resultado atual continuam selecionados e entram na impressão); só muda por ação explícita, e “Limpar seleção” remove tudo. Não existe na visão Hierárquica nem nos cards do mobile.">
      <div className="eq-selbar" role="region" aria-label="Seleção de equipamentos">
        <span className="eq-selbar-info" aria-live="polite">
          <strong>{selectedCount === 1 ? '1 equipamento selecionado' : `${selectedCount} equipamentos selecionados`}</strong>
          {hiddenSelected > 0 && <span>{hiddenSelected === 1 ? '(1 fora da busca ou dos filtros atuais)' : `(${hiddenSelected} fora da busca ou dos filtros atuais)`}</span>}
          {canExtend && <Button variant="ghost" size="sm" onClick={selectAllResult}>{`Selecionar os ${rows.length} equipamentos deste resultado`}</Button>}
        </span>
        <span className="eq-selbar-actions">
          <Button variant="secondary" size="sm" iconLeft={<IconPrinter size={16} />} onClick={() => setBatchOpen(true)}>Imprimir etiquetas</Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>Limpar seleção</Button>
        </span>
      </div>
    </DevNote>
  ) : null;
  const cancelSelectMode = () => { setSelectMode(false); clearSelection(); };
  /** Mobile: estado normal só tem o botão “Selecionar”; no modo de seleção entra a barra com contagem, “selecionar todos os N resultados” e Cancelar. */
  const mobileSelectBar = !selectMode ? (
    <DevNote note="RF305 (sugestão): no mobile a seleção em lote é um modo explícito. Estado normal: cards limpos, ⋮ individual; “Selecionar” liga o modo (checkbox em cada card, tocar no card marca/desmarca, ⋮ oculto, busca e filtros continuam visíveis). A seleção persiste entre buscas, filtros e páginas; “Cancelar” sai do modo e limpa tudo. CTA fixo “Imprimir N etiquetas” abre o mesmo modal do desktop.">
      <Button variant="secondary" size="sm" iconLeft={<IconChecklist size={16} />} onClick={() => setSelectMode(true)}>Selecionar</Button>
    </DevNote>
  ) : (
    <div className="eq-selmobile" role="region" aria-label="Seleção de equipamentos">
      <div className="eq-selmobile-row">
        <span className="eq-selchip" aria-live="polite">{selectedCount === 1 ? '1 selecionado' : `${selectedCount} selecionados`}</span>
        {rows.length > 0 && (rows.some((r) => !selected.has(r.id))
          ? <Button variant="ghost" size="sm" onClick={selectAllResult} aria-label={`Selecionar todos os ${rows.length} resultados`}>{`Todos (${rows.length})`}</Button>
          : <Button variant="ghost" size="sm" onClick={clearSelection}>Limpar</Button>)}
        <Button variant="ghost" size="sm" onClick={cancelSelectMode}>Cancelar</Button>
      </div>
      {hiddenSelected > 0 && <span className="eq-selmobile-note">{hiddenSelected === 1 ? '(1 fora da busca ou dos filtros atuais)' : `(${hiddenSelected} fora da busca ou dos filtros atuais)`}</span>}
    </div>
  );
  const selectColumn: TableColumn<Row> = {
    key: 'select', label: 'Selecionar', width: 48,
    headerContent: <Checkbox aria-label="Selecionar todos os equipamentos desta página" checked={allPageSelected} indeterminate={somePageSelected && !allPageSelected} onChange={togglePage} />,
    render: (_, r) => <Checkbox aria-label={`Selecionar ${r.name}`} checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} />,
  };

  const clearFilters = () => { setQuery(''); setUnit(ALL); setEnv(ALL); setCategory(ALL); setStatus(ALL); setCriticality(ALL); };

  const statusFilterOptions = [{ value: ALL, label: 'Todos os status' }, ...eqStatuses.map((s) => ({ value: s.id, label: s.name }))];
  const envNames = [...new Set(db.environments.filter((x) => unitIds.includes(x.unitId)).map((x) => x.name))];
  const empty = {
    title: 'Nenhum equipamento encontrado',
    description: filtering ? 'Revise a busca ou os filtros aplicados.' : 'Cadastre o primeiro equipamento para começar.',
    action: filtering ? <Button variant="secondary" size="sm" onClick={clearFilters}>Limpar filtros</Button> : undefined,
  };

  const request = (e: Equipment) => goTo(`solicitacao-form.html?equipment=${e.id}`);
  const canRequest = can('solicitacoes', 'cadastrar');
  /** Menu ⋮ do equipamento (lista, árvore e cards): Visualizar, Editar e Imprimir QR Code; Solicitar manutenção e Ativar/Inativar seguem as permissões. */
  const rowActions = (e: Equipment, withToggle = false, expanded = false) => {
    const inactive = isInactive(refs, e);
    const items: RowMenuItem[] = [{ label: 'Visualizar', icon: <IconEye size={16} />, onClick: () => goTo(`equipamento.html?id=${e.id}`) }];
    if (can('equipamentos', 'editar')) items.push({ label: 'Editar', icon: <IconPencil size={16} />, onClick: () => goTo(`equipamento-form.html?id=${e.id}`) });
    items.push({ label: 'Imprimir QR Code', icon: <IconPrinter size={16} />, onClick: () => setQr({ id: e.id, mode: 'label' }) });
    if (canRequest && !inactive) items.push({ label: 'Solicitar manutenção', icon: <IconTool size={16} />, onClick: () => request(e) });
    if (withToggle && can('equipamentos', 'ativar')) {
      items.push(inactive
        ? { label: 'Ativar', icon: <IconCircleCheck size={16} />, onClick: () => setToggling(e) }
        : { label: 'Inativar', icon: <IconCircleOff size={16} />, onClick: () => setToggling(e) });
    }
    if (expanded) {
      // Cards da Lista no mobile: todas as ações já abertas, como ícones
      return <>{items.map((it) => <RowAction key={it.label} icon={it.icon as ReactElement} label={it.label} target={e.name} onClick={it.onClick} />)}</>;
    }
    return (
      <DevNote note="Menu ⋮ com Visualizar, Editar (só com permissão), Imprimir QR Code (abre direto a prévia da etiqueta para impressão, sem passar por Visualizar; o QR Code continua nos detalhes do equipamento) Solicitar manutenção e Ativar/Inativar, conforme a permissão (com confirmação; RF301-RGN004: equipamento nunca é excluído). Mesmo menu na visão Hierárquica e na Lista.">
        <RowMenu target={e.name} label="Ações do equipamento" items={items} />
      </DevNote>
    );
  };

  const nextCell = (date?: string) => (date ? <span className={isOverdue(date) ? 'eq-overdue' : undefined}>{formatDate(date)}{isOverdue(date) ? ' · vencida' : ''}</span> : '-');
  const columns: TableColumn<Row>[] = [
    { key: 'name', label: 'Equipamento', sortable: true, render: (_, r) => <CellPair primary={<a className="text-link" href={`equipamento.html?id=${r.id}`}>{r.name}</a>} secondary={r.code || r.id} /> },
    { key: 'categoryName', label: 'Categoria' },
    { key: 'unitName', label: 'Unidade' },
    { key: 'envName', label: 'Ambiente' },
    { key: 'statusId', label: 'Status', render: (v) => refs.statusBadge(String(v)) },
    { key: 'criticalityId', label: 'Criticidade', render: (v) => refs.criticalityBadge(String(v)) },
    { key: 'open', label: 'OS abertas', align: 'right' },
    { key: 'next', label: 'Próxima preventiva', render: (v) => nextCell(v as string | undefined) },
    ...(canSeeCosts ? [{ key: 'cost', label: 'Gasto acumulado', align: 'right' as const, render: (v: unknown) => formatMoney(Number(v)) }] : []),
    { key: 'id', label: 'Ações', sticky: 'right', render: (_, r) => <RowActions>{rowActions(r.equipment, true)}</RowActions> },
  ];

  const { columns: shownColumns, control, fieldsFor } = useColumnPrefs('sub-equipamentos', columns, { locked: ['name'], mobileFixed: ['statusId', 'name'] });
  const toolbarFor = (withColumns: boolean, extra?: ReactNode) => (
    <>
    <TableToolbar
      search={(
        <Input
          type="search"
          aria-label={withColumns ? 'Buscar equipamento por nome, código, patrimônio, unidade ou ambiente' : 'Buscar equipamento, unidade ou ambiente'}
          placeholder={withColumns ? 'Buscar nome, código/patrimônio, unidade ou ambiente' : 'Buscar equipamento, unidade ou ambiente'}
          iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)}
        />
      )}
      filters={(
        <FilterControl
          note="RF303-FLU003 / CTA001: filtros cumulativos por unidade, ambiente, categoria, status e criticidade, agrupados no botão “Filtros” e compartilhados entre as abas (a busca também). Quando a tela abre por um link do Início (?filter=stopped|alert|inactive|running|maintenance ou ?unit=), o filtro aparece aplicado no controle e conta no botão; “Limpar” remove todos."
          filters={[
            { id: 'unit', label: 'Unidade', value: unit, onChange: setUnit, options: [{ value: ALL, label: 'Todas as unidades' }, ...visibleUnits.map((u) => ({ value: u.id, label: u.name }))] },
            { id: 'env', label: 'Ambiente', value: env, onChange: setEnv, options: [{ value: ALL, label: 'Todos os ambientes' }, ...envNames.map((n) => ({ value: n, label: n }))] },
            { id: 'category', label: 'Categoria', value: category, onChange: setCategory, options: [{ value: ALL, label: 'Todas as categorias' }, ...refs.admin.categories.filter((c) => c.status === 'ativo').map((c) => ({ value: c.id, label: c.name }))] },
            { id: 'status', label: 'Status', value: status, onChange: setStatus, options: statusFilterOptions },
            { id: 'criticality', label: 'Criticidade', value: criticality, onChange: setCriticality, options: [{ value: ALL, label: 'Todas as criticidades' }, ...refs.admin.criticalities.map((c) => ({ value: c.id, label: c.name }))] },
          ]}
        />
      )}
      columns={withColumns ? control : undefined}
    />
    {extra}
    </>
  );

  const listView = isMobile ? (
    <MobileCardList
      headingId="equipments-title" title="Lista de equipamentos" titleHidden toolbar={toolbarFor(true, mobileSelectBar)} emptyTitle={empty.title}
      selection={selectMode ? { selectedIds: selected, onToggle: toggleOne, label: (id) => `Selecionar ${rows.find((r) => r.id === id)?.name ?? 'equipamento'}` } : undefined}
      stickyFooter={selectMode && selectedCount > 0 ? <Button iconLeft={<IconPrinter size={20} />} onClick={() => setBatchOpen(true)}>{selectedCount === 1 ? 'Imprimir 1 etiqueta' : `Imprimir ${selectedCount} etiquetas`}</Button> : undefined}
      page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage}
      items={pageRows.map((r): MobileCardItem => ({
        id: r.id, title: r.name, subtitle: r.code || r.id, badge: refs.statusBadge(r.statusId),
        fields: fieldsFor([
          { label: 'Categoria', value: r.categoryName }, { label: 'Criticidade', value: refs.criticalityBadge(r.criticalityId) },
          { label: 'Unidade', value: r.unitName }, { label: 'Ambiente', value: r.envName },
          { label: 'OS abertas', value: r.open }, { label: 'Próxima preventiva', value: nextCell(r.next) },
          ...(canSeeCosts ? [{ label: 'Gasto acumulado', value: formatMoney(r.cost) }] : []),
        ]),
        actions: <RowActions>{rowActions(r.equipment, true, true)}</RowActions>,
      }))}
    />
  ) : (
    <Table<Row>
      caption="Lista de equipamentos" toolbar={toolbarFor(true, selectionBar)} columns={[selectColumn, ...shownColumns]} rows={pageRows}
      sortKey="name" sortDir={sortDir} onSort={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
      empty={empty} pagination={{ page, pageSize: PAGE_SIZE, total: rows.length, onPageChange: setPage }}
    />
  );

  // ── Aba Hierárquica ──
  // Unidade ou ambiente inativo não é ofertado em novos cadastros (RF202-CTA002): o atalho "+" abre o cadastro já com a localização preenchida e, para inativos, aparece desabilitado com o motivo no tooltip
  const unavailableReason = (r: TreeRow) => (unitOf(r.unitId)?.status === 'inativo' ? 'Unidade inativa: não é possível cadastrar equipamentos'
    : r.envId && envOf(r.envId)?.status === 'inativo' ? 'Ambiente inativo: não é possível cadastrar equipamentos' : undefined);
  const treeActions = (r: TreeRow) => (
    <RowActions>
      {r.kind === 'eq' && r.equipment ? rowActions(r.equipment, true) : can('equipamentos', 'cadastrar') && (
        <RowAction
          icon={<IconPlus size={16} />} label={r.kind === 'unit' ? 'Cadastrar equipamento na unidade' : 'Cadastrar equipamento no ambiente'} target={r.name}
          unavailableReason={unavailableReason(r)}
          onClick={() => goTo(`equipamento-form.html?unit=${r.unitId}${r.envId ? `&env=${r.envId}` : ''}`)}
        />
      )}
    </RowActions>
  );
  const expandButton = (r: TreeRow) => (r.expandable ? (
    <Button
      variant="ghost" size="sm" iconOnly iconLeft={r.isOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
      aria-expanded={r.isOpen} aria-label={`${r.isOpen ? 'Recolher' : 'Expandir'} ${r.name}`} onClick={() => toggleExpand(r.rowId)}
    />
  ) : <span aria-hidden="true" style={{ width: 'var(--spacing-xl)', flexShrink: 0 }} />);
  /** Apoio visual do nível: ícone de Unidade/Ambiente (neutro) ou miniatura do equipamento (placeholder quando não há foto). */
  const eqThumb = (e?: Equipment) => (photoSrc(e?.photoName) ? <img src={photoSrc(e?.photoName)} alt="" /> : <IconPhoto size={16} />);
  const treeLead = (r: TreeRow) => (
    <span className={`tree-lead tree-lead--${r.kind}`} aria-hidden="true">
      {r.kind === 'unit' ? <IconBuildingStore size={20} /> : r.kind === 'env' ? <IconLayoutGrid size={20} /> : eqThumb(r.equipment)}
    </span>
  );
  const treeColumns: TableColumn<TreeRow>[] = [
    {
      key: 'name', label: 'Nome',
      render: (_, r) => (
        <Stack direction="horizontal" align="center" gap="xs">
          <span aria-hidden="true" style={{ width: `calc(var(--spacing-lg) * ${r.level})`, flexShrink: 0 }} />
          {expandButton(r)}
          {treeLead(r)}
          <CellPair
            primary={r.kind === 'eq' ? <a className="text-link" href={`equipamento.html?id=${r.rowId}`}>{r.name}</a> : <strong>{r.name}</strong>}
            secondary={`${KIND_LABEL[r.kind]} · ${r.sub || '-'}`}
          />
        </Stack>
      ),
    },
    { key: 'kind', label: 'Status', render: (_, r) => (r.kind === 'eq' && r.equipment ? refs.statusBadge(r.equipment.statusId) : r.kind === 'unit' ? recordStatusBadge(unitOf(r.unitId)?.status ?? 'ativo') : '-') },
    { key: 'total', label: 'Total de equipamentos', align: 'right' },
    { key: 'stopped', label: 'Parados', align: 'right' },
    { key: 'alert', label: 'Com alerta', align: 'right' },
    { key: 'open', label: 'OS abertas', align: 'right' },
    { key: 'rowId', label: 'Ações', sticky: 'right', render: (_, r) => treeActions(r) },
  ];
  const treeEmpty = { title: 'Nenhuma unidade encontrada', description: filtering ? 'Revise a busca ou os filtros aplicados.' : undefined, action: empty.action };
  // Mobile: a hierarquia vira uma única árvore por unidade (sem um card por nível): Unidade → Ambiente → Equipamento, com indentação,
  // chevrons só em Unidade e Ambiente, resumo compacto e menu ⋮ nos equipamentos.
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const summary = (t: ReturnType<typeof totals>) => [
    plural(t.total, 'equipamento', 'equipamentos'), plural(t.stopped, 'parado', 'parados'), plural(t.alert, 'alerta', 'alertas'), `${t.open} OS`,
  ].join(' · ');
  const mChevron = (id: string, name: string, open: boolean, expandable: boolean) => (expandable ? (
    <Button
      variant="ghost" size="sm" iconOnly className="hit-44" iconLeft={open ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
      aria-expanded={open} aria-label={`${open ? 'Recolher' : 'Expandir'} ${name}`} onClick={() => toggleExpand(id)}
    />
  ) : <span className="mtree-spacer" aria-hidden="true" />);
  const mobileTree = (
    <Stack gap="md" as="section">
      <h2 id="tree-title" className="sr-only">Equipamentos por unidade e ambiente</h2>
      {toolbarFor(false)}
      {treeUnits.length === 0 ? (
        <Card><EmptyState title={treeEmpty.title} description={treeEmpty.description} action={treeEmpty.action} /></Card>
      ) : treeUnits.slice((treePage - 1) * TREE_PAGE_SIZE, treePage * TREE_PAGE_SIZE).map(({ unit: u, envs }) => {
        const unitOpen = expanded.has(u.id);
        const uRow = { rowId: u.id, kind: 'unit', name: u.name, unitId: u.id } as unknown as TreeRow;
        return (
          <Card key={u.id} padding="none">
            <div className="mtree">
              <div className="mtree-row">
                {mChevron(u.id, u.name, unitOpen, envs.length > 0)}
                <span className="tree-lead tree-lead--unit" aria-hidden="true"><IconBuildingStore size={20} /></span>
                <div className="mtree-text">
                  <strong className="mtree-name">{u.name}</strong>
                  <span className="cell-secondary">{`${KIND_LABEL.unit} · ${u.code || '-'}`}</span>
                  <span className="cell-secondary">{summary(totals(envs.flatMap((x) => x.eqs)))}</span>
                  {u.status !== 'ativo' && recordStatusBadge(u.status)}
                </div>
                {treeActions(uRow)}
              </div>
              {unitOpen && envs.map(({ env: x, eqs }) => {
                const envOpen = expanded.has(x.id);
                const xRow = { rowId: x.id, kind: 'env', name: x.name, unitId: u.id, envId: x.id } as unknown as TreeRow;
                return (
                  <div key={x.id} className="mtree-group">
                    <div className="mtree-row mtree-row--env">
                      {mChevron(x.id, x.name, envOpen, eqs.length > 0)}
                      <span className="tree-lead tree-lead--env" aria-hidden="true"><IconLayoutGrid size={20} /></span>
                      <div className="mtree-text">
                        <strong className="mtree-name">{x.name}</strong>
                        <span className="cell-secondary">{`${KIND_LABEL.env} · ${plural(eqs.length, 'equipamento', 'equipamentos')}`}</span>
                      </div>
                      {treeActions(xRow)}
                    </div>
                    {envOpen && [...eqs].sort((p, r) => p.name.localeCompare(r.name, 'pt-BR')).map((e) => (
                      <div key={e.id} className="mtree-row mtree-row--eq">
                        <span className="mtree-spacer" aria-hidden="true" />
                        <span className="tree-lead tree-lead--eq" aria-hidden="true">{eqThumb(e)}</span>
                        <div className="mtree-text">
                          <a className="text-link mtree-name" href={`equipamento.html?id=${e.id}`}>{e.name}</a>
                          <span className="cell-secondary">{`${KIND_LABEL.eq} · ${e.code || '-'}`}</span>
                          {refs.statusBadge(e.statusId)}
                        </div>
                        <RowActions>{rowActions(e, true)}</RowActions>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      {treeUnits.length > 0 && (
        <Stack gap="sm" align="center">
          <span className="page-text" aria-live="polite">{`Mostrando ${(treePage - 1) * TREE_PAGE_SIZE + 1}–${Math.min(treePage * TREE_PAGE_SIZE, treeUnits.length)} de ${treeUnits.length} unidades`}</span>
          {treeUnits.length > TREE_PAGE_SIZE && <Pagination page={treePage} pageCount={Math.ceil(treeUnits.length / TREE_PAGE_SIZE)} onPageChange={setTreePage} />}
        </Stack>
      )}
    </Stack>
  );
  const treeView = isMobile ? (
    mobileTree
  ) : (
    <Table<TreeRow>
      caption="Equipamentos por unidade e ambiente" toolbar={toolbarFor(false)} columns={treeColumns} rows={treeRows} empty={treeEmpty}
      pagination={{ page: treePage, pageSize: TREE_PAGE_SIZE, total: treeUnits.length, onPageChange: setTreePage, rangeLabel: (from, to, total) => `Mostrando ${from}–${to} de ${total} unidades` }}
    />
  );

  const qrEquipment = qr ? db.equipments.find((e) => e.id === qr.id) ?? null : null;

  return (
    <AppLayout active="equipamentos" screen="equipamentos">
      <Stack gap="xl">
        <PageHeader
          title="Equipamentos"
          subtitle="Gerencie os equipamentos da sua operação e acompanhe sua situação"
          actions={can('equipamentos', 'cadastrar') && (
            <DevNote note="Abre o cadastro de equipamento (RF301-FLU001). Só perfis com permissão “Cadastrar” em Equipamentos veem o botão (Solicitante e Executor só leem). Respeita as unidades do perfil (RF302-RGN002). O botão não deve ser exibido para usuários sem a permissão “Cadastrar” em Equipamentos.">
              <Button iconLeft={<IconPlus size={20} />} onClick={() => goTo('equipamento-form.html')}>Novo equipamento</Button>
            </DevNote>
          )}
        />

        <DevNote note="RF302/RF303: os mesmos cards de resumo nas duas abas. Total de equipamentos não conta equipamentos inativos; Parados = status do tipo visual Crítico e Com alerta/falha = tipo Atenção (RF407). Gasto com manutenção = custos realizados das OS movimentadas nos últimos 30 dias (💡 data de referência a confirmar) e só aparece para Administrador e Gestor (RF304-RGN003). Sem exportar (FE010).">
          <div className="eq-kpis">
            <KpiCard tone="neutral" label="Total de equipamentos" value={formatNumber(kpis.total)} icon={<IconMicrowave size={20} />} />
            <KpiCard tone="error" label="Parados" value={formatNumber(kpis.stopped)} icon={<IconPlayerStop size={20} />} />
            <KpiCard tone="warning" label="Com alerta ou falha" value={formatNumber(kpis.alert)} icon={<IconAlertTriangle size={20} />} />
            <KpiCard tone="info" label="OS abertas vinculadas" value={formatNumber(kpis.openOrders)} icon={<IconClipboardList size={20} />} />
            {canSeeCosts && <KpiCard tone="neutral" label="Gasto com manutenção · 30 dias" value={formatMoney(kpis.spent)} icon={<IconReportMoney size={20} />} />}
          </div>
        </DevNote>

        <DevNote note="Duas visões do mesmo cadastro: Hierárquica (RF302 - Unidade → Ambiente → Equipamento, com totalizadores que somam o que há abaixo e paginação no nível de unidade) e Lista (RF303 - tabela plana, com botão “Exibição” para escolher e ordenar colunas; a visão Hierárquica tem estrutura de colunas fixa). Busca e filtros são compartilhados entre as abas.">
          <Tab
            aria-label="Visões de equipamentos" defaultIndex={(mode === 'idle' && !param('filter')) || mode === 'hierarchical' || mode === 'expanded' || mode === 'inactivate' ? 0 : 1}
            tabs={[
              { label: 'Hierárquica', content: treeView },
              { label: 'Lista', content: listView },
            ]}
          />
        </DevNote>
      </Stack>

      <EquipmentToggleDialog equipment={toggling} onClose={() => setToggling(null)} />

      {batchOpen && selectedCount > 0 && <BatchLabelDialog equipments={selectedEquipments} onClose={() => setBatchOpen(false)} />}
      <QrDialogs equipment={qrEquipment} mode={qr?.mode ?? null} onMode={(m) => setQr(m && qr ? { id: qr.id, mode: m } : null)} />

    </AppLayout>
  );
}

mountApp(<EquipamentosScreen />);
