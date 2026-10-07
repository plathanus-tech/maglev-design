import { ReactNode, useState } from 'react';
import { IconAlertCircle, IconAlertTriangle, IconCopy, IconInfoCircle, IconPrinter } from '@tabler/icons-react';
import { Button, Card, Dialog, Feedback, Input, Stack, useToast } from '@maglev/ds';
import logoLight from '../../../public/maglev-logo.svg';
import { MobileCardItem, MobileCardList } from '../../admin/shared/MobileCardList';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { Table, TableColumn } from '@maglev/ds';
import { DEMO_NOW, RECURRENCE_DAYS, RECURRENCE_N, Equipment, Executor, SubDb, WorkOrder, dayOnly, qrLink } from './data';
import { useRefs } from './ui';
import { updateSubDb, useSubSession } from './store';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { QrCode } from './QrCode';
import './equipamento.css';

/** Cálculos do módulo Equipamentos (RF302-RF304): tudo é derivado de equipamentos, OS e execuções de preventiva. */
export type Refs = ReturnType<typeof useRefs>;

/** Status de equipamento por tipo visual (RF304-RGN005: "Parado" = tipo crítico; "Com alerta/falha" = atenção; inativo = cancelado). */
export const isStopped = (r: Refs, e: Equipment) => r.visualOf(e.statusId) === 'critico';
export const isAlert = (r: Refs, e: Equipment) => r.visualOf(e.statusId) === 'atencao';
export const isInactive = (r: Refs, e: Equipment) => r.base(e.statusId) === 'cancelado';

export const openOrdersOf = (db: SubDb, r: Refs, equipmentId: string): WorkOrder[] =>
  db.orders.filter((o) => o.equipmentId === equipmentId && !['concluido', 'cancelado'].includes(r.base(o.statusId) ?? ''));

/** Custos realizados de uma OS: itens lançados, sem OS cancelada e sem orçamento ainda não decidido (RF303-RGN003). */
export const realizedCents = (r: Refs, o: WorkOrder) => (r.base(o.statusId) === 'cancelado' ? 0
  : o.costs.filter((c) => !(c.kind === 'orcamento' && o.budget && !o.budget.decision)).reduce((n, c) => n + c.cents, 0));
export const spentOf = (db: SubDb, r: Refs, equipmentId: string) => db.orders.filter((o) => o.equipmentId === equipmentId).reduce((n, o) => n + realizedCents(r, o), 0);
/** Data de referência do custo: última movimentação da OS (💡 a confirmar com o negócio). */
const costDate = (o: WorkOrder) => (o.activities.length ? o.activities.reduce((m, a) => (a.at > m ? a.at : m), o.createdAt) : o.createdAt);
export const spent30d = (db: SubDb, r: Refs, equipmentIds: Set<string>) => {
  const since = dayOnly(30);
  return db.orders.filter((o) => equipmentIds.has(o.equipmentId) && costDate(o).slice(0, 10) >= since).reduce((n, o) => n + realizedCents(r, o), 0);
};

/** Próxima preventiva = menor data entre as execuções pendentes do equipamento. */
/** Corretivas (não canceladas) abertas no período do alerta de reincidência; `alert` quando atinge N. */
export const recurrenceOf = (db: SubDb, r: Refs, equipmentId: string) => {
  const since = dayOnly(RECURRENCE_DAYS);
  const count = db.orders.filter((o) => o.equipmentId === equipmentId && o.kind === 'corretiva' && r.base(o.statusId) !== 'cancelado' && o.createdAt.slice(0, 10) >= since).length;
  return { count, alert: count >= RECURRENCE_N };
};

export interface AttentionPoint { id: string; severity: 'info' | 'warning' | 'error'; title: string; message: string }
const ATTENTION_ICON = { info: IconInfoCircle, warning: IconAlertTriangle, error: IconAlertCircle } as const;
const ATTENTION_LABEL = { info: 'Informação', warning: 'Atenção', error: 'Crítico' } as const;

/**
 * Pontos de atenção do ativo: 1 ponto vira o Feedback individual; 2 ou mais ficam agrupados num único card, cada item com o
 * ícone da sua severidade (o card não assume a cor do mais grave).
 */
export function AttentionPoints({ points }: { points: AttentionPoint[] }) {
  if (points.length === 0) return null;
  if (points.length === 1) { const p = points[0]; return <Feedback type={p.severity} title={p.title} message={p.message} />; }
  return (
    <Card title="Pontos de atenção" subtitle={points.length === 1 ? '1 situação requer atenção' : `${points.length} situações requerem atenção`}>
      <ul className="eq-attn" aria-label="Pontos de atenção do equipamento">
        {points.map((p) => {
          const Icon = ATTENTION_ICON[p.severity];
          return (
            <li key={p.id} className={`eq-attn-item is-${p.severity}`}>
              <Icon size={20} className="eq-attn-icon" aria-hidden="true" />
              <div className="eq-attn-body">
                <span className="eq-attn-title"><span className="sr-only">{ATTENTION_LABEL[p.severity]}: </span>{p.title}</span>
                <span className="eq-attn-text">{p.message}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export const nextPreventive = (db: SubDb, equipmentId: string) => db.executions
  .filter((x) => x.equipmentId === equipmentId && x.status === 'pendente').map((x) => x.dueDate).sort()[0];
/** Vencida: data anterior a hoje (RF303-RGN004). */
export const isOverdue = (date?: string) => !!date && date < dayOnly(0);

/** Downtime atual (RF304-RGN005): tempo desde `stoppedSince`; zerado quando não está parado. */
export function downtimeText(since?: string): string {
  if (!since) return '0 h';
  const min = Math.max(0, Math.floor((DEMO_NOW.getTime() - new Date(since).getTime()) / 60_000));
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export const executorName = (db: SubDb, ex: Executor) => {
  if (ex.kind === 'interno') return db.users.find((u) => u.id === ex.userId)?.name ?? '-';
  const p = db.providers.find((x) => x.id === ex.providerId);
  return p ? (p.tradeName ?? p.name) : '-';
};

/** Copia texto (navigator.clipboard com try/catch) e avisa por Toast. */
export function useCopy() {
  const toast = useToast();
  return async (text: string, what = 'Link') => {
    try { await navigator.clipboard.writeText(text); toast.show({ type: 'success', title: `${what} copiado`, message: 'Cole onde precisar para abrir a solicitação deste equipamento.' }); }
    catch { toast.show({ type: 'warning', title: 'Não foi possível copiar', message: 'Selecione o link e copie manualmente.', duration: 6000 }); }
  };
}

/** Frequência do plano por extenso (ex.: "A cada 3 meses"). */
export const frequencyText = (p: { frequency: 'diaria' | 'semanal' | 'mensal' | 'anual'; every: number }) => {
  const unit = { diaria: ['dia', 'dias'], semanal: ['semana', 'semanas'], mensal: ['mês', 'meses'], anual: ['ano', 'anos'] }[p.frequency];
  const label = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal', anual: 'Anual' }[p.frequency];
  return p.every <= 1 ? label : `A cada ${p.every} ${unit[1]}`;
};

// ─── QR Code e etiqueta (RF305) ─────────────────────────────────────

/**
 * Dialog "QR Code do equipamento" (`mode='qr'`: QR + link com "Copiar") e prévia da etiqueta para impressão (`mode='label'`:
 * QR + nome + código + logo MAGLEV, com "Imprimir" que chama window.print com estilo @media print mínimo).
 */
/** Etiqueta do equipamento (mesma da impressão individual): logo, QR Code, nome, código e instrução de leitura. */
export function EquipmentLabel({ equipment, className = '' }: { equipment: Equipment; className?: string }) {
  return (
    <div className={`eq-label ${className}`.trim()}>
      <img className="eq-label-logo" src={logoLight} alt="MAGLEV" />
      <div className="eq-qr"><QrCode value={qrLink(equipment)} label={`QR Code da etiqueta de ${equipment.name}`} /></div>
      <p className="eq-label-name">{equipment.name}</p>
      <p className="eq-label-code">{equipment.code || equipment.id}</p>
      <p className="eq-label-hint">Aponte a câmera para solicitar manutenção</p>
      <p className="eq-label-fallback"><span>Não conseguiu ler o QR Code?</span><strong>maglev.com.br/solicitar</strong></p>
    </div>
  );
}

const PREVIEW_LABELS = 4;
/** Impressão em lote (RF305, sugestão): uma etiqueta por equipamento selecionado. A prévia mostra as primeiras; a impressão leva todas. */
export function BatchLabelDialog({ equipments, onClose }: { equipments: Equipment[]; onClose: () => void }) {
  const n = equipments.length;
  return (
    <>
      <Dialog
        open onClose={onClose} title="Imprimir etiquetas" subtitle={n === 1 ? '1 equipamento selecionado' : `${n} equipamentos selecionados`} size="md"
        actions={(
          <>
            <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button size="sm" iconLeft={<IconPrinter size={16} />} onClick={() => window.print()}>{n === 1 ? 'Imprimir 1 etiqueta' : `Imprimir ${n} etiquetas`}</Button>
          </>
        )}
      >
        <DevNote note="RF305 (sugestão de impressão em lote): cada equipamento selecionado gera a própria etiqueta, no mesmo layout da impressão individual (QR + nome + código + logo), sem configuração de tamanho ou margens. A prévia mostra só as primeiras; a impressão inclui todas.">
          <Stack gap="md">
            <div className="eq-batch-preview">
              {equipments.slice(0, PREVIEW_LABELS).map((e) => <EquipmentLabel key={e.id} equipment={e} className="eq-label--preview" />)}
            </div>
            {n > PREVIEW_LABELS && <p className="field-note">{`A impressão incluirá as ${n} etiquetas selecionadas`}</p>}
          </Stack>
        </DevNote>
      </Dialog>
      <div className="eq-print-sheet" aria-hidden="true">
        {equipments.map((e) => <EquipmentLabel key={e.id} equipment={e} />)}
      </div>
    </>
  );
}

export function QrDialogs({ equipment, mode, onMode }: { equipment: Equipment | null; mode: 'qr' | 'label' | null; onMode: (m: 'qr' | 'label' | null) => void }) {
  const copy = useCopy();
  if (!equipment || !mode) return null;
  const link = qrLink(equipment);
  const close = () => onMode(null);

  if (mode === 'label') {
    return (
      <Dialog
        open onClose={close} title="Etiqueta do equipamento" subtitle="Prévia da etiqueta que será impressa" size="sm"
        actions={<Button size="sm" iconLeft={<IconPrinter size={16} />} onClick={() => window.print()}>Imprimir</Button>}
      >
        <Stack align="center" gap="md">
          <EquipmentLabel equipment={equipment} />
          <Input
            label="Link de abertura de solicitação" value={link} readOnly
            iconRightAction={{ icon: <IconCopy size={20} />, label: 'Copiar link', onClick: () => copy(link) }}
          />
        </Stack>
      </Dialog>
    );
  }
  return (
    <Dialog
      open onClose={close} title="QR Code do equipamento" subtitle={`${equipment.name}${equipment.code ? ` · ${equipment.code}` : ''}`}
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={close}>Fechar</Button>
          <Button size="sm" iconLeft={<IconPrinter size={16} />} onClick={() => onMode('label')}>Imprimir etiqueta</Button>
        </>
      )}
    >
      <Stack gap="md">
        <Stack align="center"><div className="eq-qr eq-qr--lg"><QrCode value={link} label={`QR Code de ${equipment.name}`} /></div></Stack>
        <Input label="Link de abertura de solicitação" value={link} readOnly helperText="O QR Code e este link abrem a mesma página de solicitação do equipamento" />
        <Stack direction="horizontal"><Button variant="secondary" size="sm" iconLeft={<IconCopy size={16} />} onClick={() => copy(link)}>Copiar</Button></Stack>
      </Stack>
    </Dialog>
  );
}

// ─── Lista simples (desktop Table / mobile cards) usada nas abas do detalhe ───

export type ListRow = Record<string, unknown>;
export function SimpleList<T extends ListRow>({ id, title, subtitle, rows, columns, toItem, emptyTitle, emptyDescription, pageSize = 5, aside }: {
  id: string; title: string; subtitle?: string; rows: T[]; columns: TableColumn<T>[]; toItem: (r: T) => MobileCardItem;
  emptyTitle: string; emptyDescription?: string; pageSize?: number; aside?: ReactNode;
}) {
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);
  const slice = rows.slice((page - 1) * pageSize, page * pageSize);
  return isMobile ? (
    <MobileCardList
      headingId={id} title={title} subtitle={subtitle} emptyTitle={emptyTitle}
      page={page} pageSize={pageSize} total={rows.length} onPageChange={setPage} items={slice.map(toItem)}
    />
  ) : (
    <Table<T>
      title={title} subtitle={subtitle} columns={columns} rows={slice} actions={aside}
      empty={{ title: emptyTitle, description: emptyDescription }}
      pagination={rows.length > pageSize ? { page, pageSize, total: rows.length, onPageChange: setPage } : undefined}
    />
  );
}

export const withUnit = (db: SubDb, e: Equipment) => `${db.units.find((u) => u.id === e.unitId)?.name ?? '-'} · ${db.environments.find((x) => x.id === e.environmentId)?.name ?? '-'}`;

/** Aviso padrão de segurança do troubleshooting (RGN006 / RF403: etapas de risco). */
export const TroubleshootingSafety = () => (
  <Feedback
    type="warning" title="Cuidado com etapas que envolvem risco"
    message="Não inclua instruções que exijam abrir o equipamento ou mexer em eletricidade e gás. Dicas erradas podem causar acidentes: o troubleshooting é cadastrado e editado só por quem gerencia a manutenção."
  />
);

/** Confirmação de ativar/inativar equipamento (RF301-RGN004: nunca exclui), compartilhada entre a listagem e o detalhe. */
export function EquipmentToggleDialog({ equipment, onClose }: { equipment: Equipment | null; onClose: () => void }) {
  const toast = useToast();
  const refs = useRefs();
  const { db } = useSubSession();
  if (!equipment) return null;
  const inactive = isInactive(refs, equipment);
  const openCount = openOrdersOf(db, refs, equipment.id).length;
  const statuses = refs.activeStatuses('equipamento');
  const confirm = () => {
    const target = inactive ? statuses.find((x) => refs.base(x.id) === 'concluido') : statuses.find((x) => refs.base(x.id) === 'cancelado');
    if (target) updateSubDb((d) => ({ ...d, equipments: d.equipments.map((e) => (e.id === equipment.id ? { ...e, statusId: target.id, stoppedSince: undefined } : e)) }));
    toast.show(inactive
      ? { type: 'success', title: 'Equipamento ativado', message: `${equipment.name} voltou a ficar disponível para solicitações.` }
      : { type: 'success', title: 'Equipamento inativado', message: `${equipment.name} foi inativado. O histórico foi preservado.` });
    onClose();
  };
  return (
    <Dialog
      open onClose={onClose} size="sm" className="dialog-confirm"
      title={inactive ? `Ativar ${equipment.name}?` : `Inativar ${equipment.name}?`}
      subtitle={inactive ? 'O equipamento volta a aceitar solicitações' : 'O equipamento deixa de aceitar novas solicitações'}
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          {inactive
            ? <Button size="sm" onClick={confirm}>Ativar equipamento</Button>
            : <Button size="sm" variant="destructive" onClick={confirm}>Inativar equipamento</Button>}
        </>
      )}
    >
      <DevNote note="RF301-RGN004: equipamento não é excluído, só inativado, preservando o histórico de solicitações, OS e custos. 💡 Comportamento com OS e preventivas abertas a confirmar - aqui apenas avisamos.">
        <Feedback
          type={inactive ? 'info' : 'warning'}
          title={inactive ? 'Equipamento volta ao status Em funcionamento' : 'O histórico é preservado'}
          message={inactive
            ? 'O QR Code e o cadastro voltam a ser usados normalmente.'
            : openCount > 0
              ? `Há ${openCount} OS aberta${openCount > 1 ? 's' : ''} vinculada${openCount > 1 ? 's' : ''}: elas continuam até serem encerradas. Solicitações, OS e custos anteriores continuam consultáveis.`
              : 'Solicitações, OS e custos anteriores continuam consultáveis. Você pode ativar o equipamento de novo quando precisar.'}
        />
      </DevNote>
    </Dialog>
  );
}
