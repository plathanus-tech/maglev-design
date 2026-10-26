import { useEffect, useMemo, useState } from 'react';
import { IconEye, IconPrinter, IconQrcodeOff, IconSearch } from '@tabler/icons-react';
import { Badge, Button, Checkbox, Dialog, Dropdown, Feedback, Input, Stack, Table, TableColumn, Textarea, useToast } from '@maglev/ds';
import { BatchLabelDialog, QrDialogs } from '../../assinante/shared/equipamento-lib';
import { QrCode } from '../../assinante/shared/QrCode';
import { DevNote } from './dev-notes/DevNote';
import { FilterControl } from './FilterControl';
import { MobileCardList } from './MobileCardList';
import { useIsMobile } from './useMediaQuery';
import { Subscriber } from './data';
import { QR_REASONS, QrReason, RegEquipment, QrVersion, currentQr, qrHistory, qrReasonLabel, qrUrl, subscriberEquipments } from './qr-registry';
import { inactivateQr, useSession } from './store';
import { formatDate, formatDateTime, normalize, requiredMessage } from './format';
import { CellPair, Col, Grid, ReadField, RowAction, RowActions, TableToolbar } from './ui';

const PAGE_SIZE = 10;
const ALL = 'todos';

type Row = Record<string, unknown> & { id: string; name: string; code: string; unit: string; environment: string; category: string; token: string; issuedAt: string; changes: number; eq: RegEquipment };
type HistoryRow = Record<string, unknown> & QrVersion & { who: string };

/** Inativar o código QR do equipamento: pede o motivo e gera o novo código na hora (o antigo fica no histórico, nada é excluído). */
function InactivateQrDialog({ equipment, subscriber, onClose, onDone }: { equipment: RegEquipment; subscriber: Subscriber; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { user: me } = useSession();
  const [reason, setReason] = useState<QrReason | ''>('');
  const [other, setOther] = useState('');
  const [tried, setTried] = useState(false);
  const reasonError = tried && !reason ? requiredMessage('Motivo') : undefined;
  const otherError = tried && reason === 'outro' && !other.trim() ? requiredMessage('Descreva o motivo') : undefined;

  const confirm = () => {
    setTried(true);
    if (!reason || (reason === 'outro' && !other.trim())) return;
    const token = inactivateQr(me.id, subscriber, equipment, reason, reason === 'outro' ? other : undefined);
    toast.show({ type: 'success', title: 'Novo código QR gerado', message: `O código anterior de ${equipment.name} foi inativado e o novo (${token}) já está ativo. Imprima e substitua a etiqueta.` });
    onDone();
  };

  return (
    <Dialog
      open onClose={onClose} size="sm" className="dialog-confirm"
      title={`Inativar o código QR de ${equipment.name}?`}
      subtitle="Um novo código será gerado automaticamente e o atual deixa de funcionar"
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button size="sm" variant="destructive" onClick={confirm}>Inativar código</Button>
        </>
      )}
    >
      <Stack gap="md">
        <DevNote note="Inativar o código não exclui nada: o código antigo continua no histórico do equipamento e o novo já nasce ativo (sem pergunta se quer gerar outro). O equipamento mantém cadastro, vínculos e histórico; só muda o código da etiqueta, então a etiqueta física precisa ser reimpressa e substituída. Para etiqueta apenas danificada ou ilegível basta reimprimir (mesmo código); inativar é para quando o código não pode mais valer. Motivo obrigatório, registrado com data e usuário.">
          <Feedback type="warning" title="A etiqueta atual deixa de funcionar" message="Quem ler o QR Code antigo não conseguirá abrir solicitações. Imprima a etiqueta com o novo código." />
        </DevNote>
        <Dropdown label="Motivo" required options={QR_REASONS} value={reason} onChange={(v) => setReason(v as QrReason)} error={reasonError} />
        {reason === 'outro' && <Textarea label="Descreva o motivo" required rows={3} value={other} onChange={(e) => setOther(e.target.value)} error={otherError} />}
      </Stack>
    </Dialog>
  );
}

/** Ficha do equipamento: QR atual + histórico de códigos (atual e inativados, com motivo, data e responsável). */
function QrDetailsDialog({ equipment, events, onClose, onPrint, onInactivate }: {
  equipment: RegEquipment; events: ReturnType<typeof useSession>['db']['qrEvents']; onClose: () => void; onPrint: () => void; onInactivate?: () => void;
}) {
  const { db } = useSession();
  const versions = qrHistory(equipment, events);
  const current = versions[versions.length - 1];
  const rows: HistoryRow[] = [...versions].reverse().map((v) => ({ ...v, who: v.byUserId ? db.adminUsers.find((u) => u.id === v.byUserId)?.name ?? '-' : '-' }));
  const cols: TableColumn<HistoryRow>[] = [
    { key: 'token', label: 'Código', render: (v) => <span className="cell-nowrap">{String(v)}</span> },
    { key: 'current', label: 'Situação', render: (v) => <Badge status={v ? 'success' : 'neutral'} dot>{v ? 'Ativo' : 'Inativo'}</Badge> },
    { key: 'issuedAt', label: 'Emitido em', render: (v) => formatDate(String(v)) },
    { key: 'inactivatedAt', label: 'Inativado em', render: (v) => (v ? formatDateTime(String(v)) : '-') },
    { key: 'reason', label: 'Motivo', render: (_, r) => (r.reason ? (r.detail ? `${qrReasonLabel(r.reason)}: ${r.detail}` : qrReasonLabel(r.reason)) : '-') },
    { key: 'who', label: 'Responsável' },
  ];
  return (
    <Dialog
      open onClose={onClose} size="lg" title={equipment.name} subtitle={`${equipment.unit} · ${equipment.environment}`}
      actions={(
        <>
          <Button size="sm" variant="secondary" iconLeft={<IconPrinter size={16} />} onClick={onPrint}>Imprimir QR Code</Button>
          {onInactivate && <Button size="sm" variant="secondary" iconLeft={<IconQrcodeOff size={16} />} onClick={onInactivate}>Inativar código</Button>}
        </>
      )}
    >
      <Stack gap="lg">
        <DevNote note="Localiza o ativo vinculado ao código: o QR atual, o patrimônio e a unidade/ambiente do equipamento. O histórico mostra todos os códigos que o equipamento já teve (o ativo e os inativados, com motivo, data e responsável): trocar a etiqueta não perde o vínculo nem a identificação do ativo.">
          <Grid>
            <Col span={4} mobileFull>
              <Stack align="center"><div className="eq-qr eq-qr--lg"><QrCode value={qrUrl(current.token)} label={`QR Code atual de ${equipment.name}`} /></div></Stack>
            </Col>
            <Col span={8} mobileFull>
              <Grid>
                <Col span={6} mobileFull><ReadField label="Código / patrimônio" value={equipment.code} /></Col>
                <Col span={6} mobileFull><ReadField label="Categoria" value={equipment.category} /></Col>
                <Col span={6} mobileFull><ReadField label="Unidade" value={equipment.unit} /></Col>
                <Col span={6} mobileFull><ReadField label="Ambiente" value={equipment.environment} /></Col>
                <Col span={12}><ReadField label="Código QR atual" value={<span className="cell-nowrap">{current.token}</span>} /></Col>
              </Grid>
            </Col>
          </Grid>
        </DevNote>
        <Table<HistoryRow> title="Histórico de códigos" subtitle="Código atual e códigos já inativados deste equipamento" columns={cols} rows={rows} empty={{ title: 'Nenhum código' }} />
      </Stack>
    </Dialog>
  );
}

/** Aba "Equipamentos" do detalhe do assinante (RF203): localizar o ativo, imprimir a etiqueta e inativar o código com motivo. */
export function SubscriberEquipmentsTab({ subscriber }: { subscriber: Subscriber }) {
  const isMobile = useIsMobile();
  const { db, can } = useSession();
  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState(ALL);
  const [changed, setChanged] = useState(ALL);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [viewing, setViewing] = useState<RegEquipment | null>(null);
  const [printing, setPrinting] = useState<RegEquipment | null>(null);
  const [inactivating, setInactivating] = useState<RegEquipment | null>(null);
  useEffect(() => setPage(1), [query, unit, changed]);

  const all = useMemo(() => subscriberEquipments(subscriber), [subscriber]);
  const events = db.qrEvents;
  const rowOf = (e: RegEquipment): Row => {
    const h = qrHistory(e, events);
    const cur = h[h.length - 1];
    return { id: e.id, name: e.name, code: e.code, unit: e.unit, environment: e.environment, category: e.category, token: cur.token, issuedAt: cur.issuedAt, changes: h.length - 1, eq: e };
  };
  const rows = useMemo(() => {
    const q = normalize(query);
    return all.map(rowOf)
      .filter((r) => (unit === ALL || r.unit === unit) && (changed === ALL || (changed === 'sim' ? r.changes > 0 : r.changes === 0))
        && (!q || normalize(`${r.name} ${r.code} ${r.unit} ${r.environment} ${r.token}`).includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, events, query, unit, changed]);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const units = [...new Set(all.map((e) => e.unit))];

  // Seleção para imprimir etiquetas em lote (mesmo comportamento do assinante; só na lista desktop)
  const pageIds = pageRows.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));
  const toggleOne = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const togglePage = () => setSelected((s) => { const n = new Set(s); if (allPageSelected) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id)); return n; });
  const selectedRows = all.filter((e) => selected.has(e.id)).map(rowOf);
  const hiddenSelected = selectedRows.filter((r) => !rows.some((x) => x.id === r.id)).length;
  const canExtend = allPageSelected && rows.some((r) => !selected.has(r.id));
  const labels = selectedRows.map((r) => ({ id: r.id, name: r.name, code: r.code, qrToken: r.token }));
  const labelOf = (e: RegEquipment) => ({ id: e.id, name: e.name, code: e.code, qrToken: currentQr(e, events).token });

  const selectionBar = selected.size > 0 ? (
    <DevNote note="Seleção múltipla só para imprimir etiquetas em lote, como na lista de equipamentos do assinante. O checkbox do cabeçalho marca a página; “Selecionar os N equipamentos deste resultado” marca todas as páginas. A seleção persiste ao buscar, filtrar e trocar de página; só muda por ação explícita. Não existe nos cards do mobile.">
      <div className="eq-selbar" role="region" aria-label="Seleção de equipamentos">
        <span className="eq-selbar-info" aria-live="polite">
          <strong>{selected.size === 1 ? '1 equipamento selecionado' : `${selected.size} equipamentos selecionados`}</strong>
          {hiddenSelected > 0 && <span>{hiddenSelected === 1 ? '(1 fora da busca ou dos filtros atuais)' : `(${hiddenSelected} fora da busca ou dos filtros atuais)`}</span>}
          {canExtend && <Button variant="ghost" size="sm" onClick={() => setSelected((s) => new Set([...s, ...rows.map((r) => r.id)]))}>{`Selecionar os ${rows.length} equipamentos deste resultado`}</Button>}
        </span>
        <span className="eq-selbar-actions">
          <Button variant="secondary" size="sm" iconLeft={<IconPrinter size={16} />} onClick={() => setBatchOpen(true)}>Imprimir etiquetas</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
        </span>
      </div>
    </DevNote>
  ) : null;

  const actions = (r: Row) => (
    <RowActions>
      <RowAction icon={<IconEye size={16} />} label="Visualizar equipamento" target={r.name} onClick={() => setViewing(r.eq)} />
      <RowAction icon={<IconPrinter size={16} />} label="Imprimir QR Code" target={r.name} onClick={() => setPrinting(r.eq)} />
      {can('assinantes', 'ativar') && <RowAction icon={<IconQrcodeOff size={16} />} label="Inativar código QR" target={r.name} onClick={() => setInactivating(r.eq)} />}
    </RowActions>
  );

  const columns: TableColumn<Row>[] = [
    {
      key: 'select', label: 'Selecionar', width: 48,
      headerContent: <Checkbox aria-label="Selecionar todos os equipamentos desta página" checked={allPageSelected} indeterminate={somePageSelected && !allPageSelected} onChange={togglePage} />,
      render: (_, r) => <Checkbox aria-label={`Selecionar ${r.name}`} checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} />,
    },
    { key: 'name', label: 'Equipamento', render: (_, r) => <CellPair primary={r.name} secondary={r.code} /> },
    { key: 'unit', label: 'Unidade', render: (_, r) => <CellPair primary={r.unit} secondary={r.environment} /> },
    { key: 'category', label: 'Categoria' },
    { key: 'token', label: 'Código QR atual', render: (v) => <span className="cell-nowrap">{String(v)}</span> },
    { key: 'issuedAt', label: 'Emitido em', render: (v) => formatDate(String(v)) },
    { key: 'changes', label: 'Trocas de código', align: 'right', render: (v) => (Number(v) ? String(v) : '-') },
    { key: 'id', label: 'Ações', sticky: 'right', render: (_, r) => actions(r) },
  ];

  const toolbar = (
    <>
      <TableToolbar
        search={<Input type="search" aria-label="Buscar equipamento por nome, patrimônio, unidade ou código QR" placeholder="Buscar por nome, patrimônio ou código QR" iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)} />}
        filters={(
          <FilterControl
            note="Filtros da aba: Unidade e Código QR (já teve o código trocado ou ainda está no original)."
            filters={[
              { id: 'unit', label: 'Unidade', options: [{ value: ALL, label: 'Todas as unidades' }, ...units.map((u) => ({ value: u, label: u }))], value: unit, onChange: setUnit },
              { id: 'changed', label: 'Código QR', options: [{ value: ALL, label: 'Todos' }, { value: 'sim', label: 'Com código trocado' }, { value: 'nao', label: 'Código original' }], value: changed, onChange: setChanged },
            ]}
          />
        )}
      />
      {selectionBar}
    </>
  );
  const empty = { title: 'Nenhum equipamento encontrado', description: 'Revise a busca ou os filtros aplicados.' };
  const detailEvents = events;

  return (
    <>
      <DevNote note="Aba Equipamentos (visão do Admin sobre os QR Codes do assinante): lista só para consulta, sem cadastrar nem editar equipamento (a gestão é do assinante). Ações: Visualizar (QR atual + histórico de códigos), Imprimir QR Code (reimpressão, mesmo código, sem motivo) e Inativar código QR (pede o motivo e gera o novo código na hora; o antigo fica no histórico, nada é excluído). A quantidade de QR Codes ativos é igual à de equipamentos, por isso não há indicador separado. Inativar exige a permissão “Ativar/Inativar” em Assinantes.">
        {isMobile ? (
          <MobileCardList
            headingId="sub-equipments-title" title="Equipamentos" titleHidden toolbar={toolbar} emptyTitle={empty.title}
            page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage}
            items={pageRows.map((r) => ({
              id: r.id, title: r.name, subtitle: r.code,
              fields: [
                { label: 'Unidade', value: r.unit },
                { label: 'Ambiente', value: r.environment },
                { label: 'Código QR atual', value: r.token },
                { label: 'Emitido em', value: formatDate(r.issuedAt) },
                { label: 'Trocas de código', value: r.changes ? String(r.changes) : '-' },
              ],
              actions: actions(r),
            }))}
          />
        ) : (
          <Table<Row>
            title="Equipamentos" subtitle="Equipamentos do assinante e o código QR de cada um"
            toolbar={toolbar} columns={columns} rows={pageRows} empty={empty}
            pagination={{ page, pageSize: PAGE_SIZE, total: rows.length, onPageChange: setPage }}
          />
        )}
      </DevNote>

      {viewing && (
        <QrDetailsDialog
          equipment={viewing} events={detailEvents} onClose={() => setViewing(null)}
          onPrint={() => { const e = viewing; setViewing(null); setPrinting(e); }}
          onInactivate={can('assinantes', 'ativar') ? () => { const e = viewing; setViewing(null); setInactivating(e); } : undefined}
        />
      )}
      <QrDialogs equipment={printing ? labelOf(printing) : null} mode={printing ? 'label' : null} onMode={() => setPrinting(null)} />
      {batchOpen && <BatchLabelDialog equipments={labels} onClose={() => setBatchOpen(false)} />}
      {inactivating && <InactivateQrDialog equipment={inactivating} subscriber={subscriber} onClose={() => setInactivating(null)} onDone={() => setInactivating(null)} />}
    </>
  );
}
