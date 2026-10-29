import { useMemo, useState } from 'react';
import {
  IconAlertOctagon, IconAlertTriangle, IconArrowRight, IconBuildingStore, IconCalendarEvent, IconCalendarRepeat, IconChevronDown, IconChevronRight,
  IconChevronUp, IconCircleCheck, IconClipboardList, IconEye, IconCoin, IconFridge, IconInfoCircle, IconMessageReport, IconMicrowaveOff,
  IconMicrowave, IconPlus, IconStopwatch, IconTool, IconTruck, IconUser, IconUserCheck, IconUserOff, IconMessageOff, IconClipboardOff,
} from '@tabler/icons-react';
import { Badge, Button, Card, EmptyState, KpiCard, Stack, Table, TableColumn } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { RowMenu, RowMenuItem } from './RowMenu';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { MobileCardList } from '../../admin/shared/MobileCardList';
import { useIsMobile, useMediaQuery } from '../../admin/shared/useMediaQuery';
import { useHashState } from '../../admin/shared/useHashState';
import { formatMoney, formatNumber, formatPhone, noBreak } from '../../admin/shared/format';
import { executorPhone } from './preventivas';
import { KpiMoney } from '../../admin/shared/kpi-value';
import { greeting, todayText } from './saudacao';
import { DEMO_NOW, Equipment, Request, WorkOrder, dayOnly, orderRealizedCents } from './data';
import { equipmentOf, ordersVisible, requestsVisible, unitName, userName, useSubSession } from './store';
import { CellPair, RowAction, RowActions, SectionLabel, Text, firstName, goTo, useRefs } from './ui';
import './inicio.css';
import './inicio-layout.css';

/** Estados: idle (cheio) · empty (sem pendências) · v1 (Início anterior: sem a faixa de ações e sem cartão em destaque) · mobilev1 (mobile anterior: cartões completos e sem blocos recolhíveis novos). */
const STATES = ['idle', 'empty', 'v1', 'mobilev1'] as const;
type Mode = (typeof STATES)[number];

const TODAY = dayOnly(0);
const OS_ROWS_SIDE = 7;
const DAYS_PERIOD = 30; // 💡 período padrão dos indicadores de tempo/gasto (RGN004/RGN005) a confirmar
const ellipsis = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hhmm = (iso: string) => iso.slice(11, 16);
const daysBetween = (fromIso: string, to = DEMO_NOW) => (to.getTime() - new Date(fromIso.length === 10 ? `${fromIso}T00:00:00` : fromIso).getTime()) / 86_400_000;

// ─── Requer ação ─────────────────────────────────────────────────────
type Tone = 'critical' | 'warning' | 'info' | 'neutral' | 'blue';
const TONE_ICON: Record<Tone, JSX.Element> = {
  critical: <IconAlertOctagon size={24} />, warning: <IconAlertTriangle size={24} />, info: <IconInfoCircle size={24} />, neutral: <IconCircleCheck size={24} />, blue: <IconInfoCircle size={24} />,
};
const TONE_ICON_SM: Record<Tone, JSX.Element> = {
  critical: <IconAlertOctagon size={18} />, warning: <IconAlertTriangle size={18} />, info: <IconInfoCircle size={18} />, neutral: <IconCircleCheck size={18} />, blue: <IconInfoCircle size={18} />,
};
interface ActionLink { label: string; href: string }

/**
 * Indicador de ação. `hero` = primeiro indicador do card (número maior, ícone e fundo do tom); os demais ficam em
 * hierarquia secundária (só ícone e número com a cor do tom, sem fundo). O tom vem da criticidade (CTA004) e some com 0.
 */
function ActionItem({ tone, value, label, links, hero }: { tone: Tone; value: number; label: string; links: ActionLink[]; hero?: boolean }) {
  const shown = value === 0 ? 'neutral' : tone;
  const single = links.length === 1;
  return (
    <div className={`ag-item ag-${shown}${hero ? ' ag-hero' : ''}`}>
      <div className="ag-text">
        {single
          ? <a className="action-link is-stretched" href={links[0].href}>{label}</a>
          : <span className="ag-label">{label}</span>}
        {!single && links.length > 1 && (
          <span className="action-links">
            {links.map((l) => <a key={l.label} className="action-link" href={l.href}>{l.label}</a>)}
          </span>
        )}
      </div>
      <span className="ag-value">{formatNumber(value)}</span>
    </div>
  );
}

/** Título do card com ícone discreto ao lado (mesma linguagem dos KPIs). */
/** Ícone do canto do card: mesmo container do KpiCard (32px, fundo brand, ícone 20px). */
const KpiIcon = ({ children }: { children: JSX.Element }) => <span className="ag-kpi-icon" aria-hidden="true">{children}</span>;

/** Indicador de atenção compacto: número, título e ícone (mesmo container do KpiCard); a linha inteira leva à lista filtrada. */
function AttentionCard({ label, value, icon, href }: { label: string; value: number; icon: JSX.Element; href: string }) {
  return (
    <Card padding="none" className="ag2-att">
      <a className="ag2-att-link" href={href}>
        <span className="ag2-att-value">{formatNumber(value)}</span>
        <span className="ag2-att-label">{label}</span>
        <KpiIcon>{icon}</KpiIcon>
      </a>
    </Card>
  );
}

// ─── Agenda do dia (só o que está PROGRAMADO) ────────────────────────
type EvKind = 'visita' | 'manutencao' | 'preventiva';
interface DayEvent { time: string; end: string; who: string; kind: EvKind; os: string; text: string; href: string; unit: string; phone?: string; company?: string }
const EV_BADGE: Record<EvKind, { label: string; status: 'info' | 'brand' | 'neutral'; icon: JSX.Element }> = {
  visita: { label: 'Visita técnica', status: 'info', icon: <IconTruck size={14} /> },
  manutencao: { label: 'Manutenção', status: 'neutral', icon: <IconTool size={14} /> },
  preventiva: { label: 'Preventiva', status: 'brand', icon: <IconCalendarRepeat size={14} /> },
};

/** Seta de expandir/recolher dos blocos do Início no mobile (o mesmo gesto da seção "Solicitações recentes"). */
function SectionToggle({ open, onToggle, panelId, name }: { open: boolean; onToggle: () => void; panelId: string; name: string }) {
  return (
    <Button
      variant="ghost" size="sm" iconOnly iconLeft={open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
      aria-label={`${open ? 'Recolher' : 'Expandir'} ${name}`} aria-expanded={open} aria-controls={panelId} onClick={onToggle}
    />
  );
}

const SECTIONS_KEY = 'maglev.sub.inicio.sections';
const readSections = (): Record<string, boolean> => { try { return JSON.parse(sessionStorage.getItem(SECTIONS_KEY) ?? '{}'); } catch { return {}; } };

/** Cabeçalho de seção no mobile: título à esquerda e a seta de expandir/recolher à direita. */
function SectionHead({ id, label, open, onToggle, panelId, name }: { id: string; label: string; open: boolean; onToggle: () => void; panelId: string; name: string }) {
  return (
    <Stack direction="horizontal" align="center" justify="between" gap="sm">
      <SectionLabel id={id}>{label}</SectionLabel>
      <SectionToggle open={open} onToggle={onToggle} panelId={panelId} name={name} />
    </Stack>
  );
}

// ─── Seção recolhível (FLU005) ───────────────────────────────────────
function SectionActions({ open, onToggle, panelId, href, label, name }: { open: boolean; onToggle?: () => void; panelId: string; href: string; label: string; name: string }) {
  if (!onToggle) return <a className="text-link" href={href}>{label}</a>;
  return (
    <Stack direction="horizontal" align="center" gap="md" wrap>
      <a className="text-link" href={href}>{label}</a>
      <Button
        variant="ghost" size="sm" iconOnly iconLeft={open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        aria-label={`${open ? 'Recolher' : 'Expandir'} ${name}`} aria-expanded={open} aria-controls={panelId} onClick={onToggle}
      />
    </Stack>
  );
}

type ReqRow = Record<string, unknown> & { needsOs?: boolean; id: string; equipment: string; unit: string; statusId: string; equipmentStatusId: string; failure: string; description: string };
type OsRow = Record<string, unknown> & { id: string; subject: string; statusId: string; maint: string; equipment: string; unit: string };

// ─── Rosca com tooltip em hover e foco (complementar à legenda) ──────
type Slices = { total: number; items: Array<{ key: string; label: string; count: number; pct: number }> };
function DonutChart({ slices }: { slices: Slices }) {
  const [active, setActive] = useState<string | null>(null);
  const visible = slices.items.filter((x) => x.count > 0);
  let acc = 0;
  const segs = visible.map((x) => {
    const len = (x.count / slices.total) * 100;
    const mid = ((acc + len / 2) / 100) * 2 * Math.PI - Math.PI / 2;
    const seg = { ...x, len, start: acc, dx: Math.cos(mid), dy: Math.sin(mid) };
    acc += len;
    return seg;
  });
  const cur = segs.find((x) => x.key === active);
  return (
    <div className="donut-box" onKeyDown={(e) => { if (e.key === 'Escape') setActive(null); }}>
      <svg className="donut" viewBox="0 0 100 100" role="group" aria-label={`Equipamentos por status: ${slices.items.map((x) => `${x.label} ${x.pct}%`).join(', ')}`}>
        <circle className="donut-track" cx="50" cy="50" r="38" strokeWidth="14" />
        {segs.map((x) => (
          <g key={x.key} className={`donut-g${active === x.key ? ' is-active' : ''}`} style={{ ['--dx' as string]: x.dx, ['--dy' as string]: x.dy }}>
            <circle
              className={`donut-seg dn-${x.key}`} cx="50" cy="50" r="38" strokeWidth="14" pathLength={100}
              strokeDasharray={`${Math.max(x.len - 0.8, 0.2)} ${100 - Math.max(x.len - 0.8, 0.2)}`} strokeDashoffset={-x.start} transform="rotate(-90 50 50)"
              tabIndex={0} role="img" aria-label={`${x.label}, ${x.count} equipamentos, ${x.pct}%`}
              onMouseEnter={() => setActive(x.key)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(x.key)} onBlur={() => setActive(null)}
            />
          </g>
        ))}
        <text className="donut-total" x="50" y="53" textAnchor="middle" fontSize="18">{slices.total}</text>
        <text className="donut-caption" x="50" y="64" textAnchor="middle" fontSize="7">equipamentos</text>
      </svg>
      {cur && (
        <span className="donut-tip" data-side={cur.dy < 0 ? "top" : "bottom"} aria-hidden="true">
          <strong>{cur.label}</strong>
          <span>{`${cur.count} equipamentos · ${cur.pct}%`}</span>
        </span>
      )}
    </div>
  );
}

function InicioScreen() {
  const { db, user, unitIds, canSeeCosts, company, can } = useSubSession();
  const refs = useRefs();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  // Mobile atual (cartões compactos e blocos recolhíveis); a variante v1 mantém a versão anterior
  const isMobile = useIsMobile();
  const mobileNew = isMobile && mode !== 'mobilev1';
  // Faixa "Você tem N ações…" e cartão em destaque (referência do cliente); a variante v1 mantém o Início anterior
  const rq = mode !== 'v1';
  // Lado a lado (≥1440px) a tabela de OS mostra mais linhas para terminar na altura de “Equipamentos por status” (calibrado medindo no navegador); empilhado, mantém 5.
  const sideBySide = useMediaQuery('(min-width: 1440px)');
  const osLimit = sideBySide && !isMobile ? OS_ROWS_SIDE : 5;
  // Seções recolhíveis: tudo aberto por padrão; o que a pessoa fecha fica lembrado nesta sessão (ao ir para outra tela e voltar)
  const [sec, setSecState] = useState<Record<string, boolean>>(() => ({ req: true, os: true, agenda: true, att: true, eq: true, perf: true, ...readSections() }));
  const setSecKey = (k: string, v: boolean | ((x: boolean) => boolean)) => setSecState((x) => {
    const n = { ...x, [k]: typeof v === 'function' ? v(x[k]) : v };
    try { sessionStorage.setItem(SECTIONS_KEY, JSON.stringify(n)); } catch { /* sem storage */ }
    return n;
  });
  const openReq = sec.req;
  const openOs = sec.os;
  const setOpenReq = (v: boolean | ((x: boolean) => boolean)) => setSecKey('req', v);
  const setOpenOs = (v: boolean | ((x: boolean) => boolean)) => setSecKey('os', v);
  const toggleSec = (k: string) => setSecKey(k, (x) => !x);
  const empty = mode === 'empty';

  const isOpenStatus = (id?: string) => { const b = refs.base(id); return b !== 'concluido' && b !== 'cancelado'; };

  const data = useMemo(() => {
    const executorOnly = user.profile === 'executor';
    const requests: Request[] = empty ? [] : requestsVisible(db, unitIds);
    const orders: WorkOrder[] = empty ? [] : ordersVisible(db, unitIds, user.id, executorOnly);
    const equipments: Equipment[] = db.equipments.filter((e) => unitIds.includes(e.unitId));
    const executions = empty ? [] : db.executions.filter((x) => { const e = equipmentOf(db, x.equipmentId); return !!e && unitIds.includes(e.unitId); });
    return { requests, orders, equipments, executions };
  }, [db, unitIds, user, empty]);
  const { requests, orders, equipments, executions } = data;

  const openReqs = requests.filter((r) => isOpenStatus(r.statusId));
  const activeOrders = orders.filter((o) => isOpenStatus(o.statusId));

  // Atribuídas a mim
  const mineReq = openReqs.filter((r) => r.responsibleId === user.id);
  const mineOs = activeOrders.filter((o) => o.responsibleId === user.id || (o.executor.kind === 'interno' && o.executor.userId === user.id));
  const novasReq = mineReq.filter((r) => refs.base(r.statusId) === 'aberto').length;
  const novasOs = mineOs.filter((o) => refs.base(o.statusId) === 'aberto').length;
  const aprovOs = mineOs.filter((o) => o.budget && !o.budget.decision).length;
  const atrasoOs = mineOs.filter((o) => o.dueAt < TODAY).length;
  const mineUrl = (page: string, sub: string) => `${page}.html?filter=assigned-me&sub=${sub}`;
  const linksOf = (page: 'solicitacoes' | 'ordens-servico', sub: string, n: number, noun: string): ActionLink[] => (n > 0 ? [{ label: `${n} ${noun}`, href: mineUrl(page, sub) }] : []);

  // Solicitações pendentes
  const pendAprov = openReqs.filter((r) => r.statusId === 'STS-04').length;
  const pendInfo = openReqs.filter((r) => r.statusId === 'STS-03').length;
  const pendTotal = pendAprov + pendInfo;

  // OS pendentes
  const osAtivas = activeOrders.length;
  const osAcao = activeOrders.filter((o) => ['STO-04', 'STO-05', 'STO-07'].includes(o.statusId)).length;
  const osValid = activeOrders.filter((o) => o.statusId === 'STO-07').length;
  const nothingPending = novasReq + novasOs + aprovOs + atrasoOs + pendTotal + osAtivas === 0;

  // Tabelas recentes
  const reqRows: ReqRow[] = [...requests].sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, 5).map((r) => {
    const e = equipmentOf(db, r.equipmentId);
    return {
      id: r.id, equipment: e?.name ?? '-', unit: e ? unitName(db, e.unitId) : '-', statusId: r.statusId, equipmentStatusId: e?.statusId ?? '',
      failure: refs.requestType(r.problemId)?.name ?? '-', description: ellipsis(r.description), needsOs: r.statusId === 'STS-04' && !r.osId,
    };
  });
  const osRows: OsRow[] = [...activeOrders].sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, osLimit).map((o) => {
    const e = equipmentOf(db, o.equipmentId);
    return { id: o.id, subject: o.subject, statusId: o.statusId, maint: refs.maintType(o.maintTypeId)?.name ?? '-', equipment: e?.name ?? '-', unit: e ? unitName(db, e.unitId) : '-' };
  });

  const reqColumns: TableColumn<ReqRow>[] = [
    { key: 'failure', label: 'Tipo de solicitação / Descrição', render: (v, r) => <CellPair primary={String(v)} secondary={r.description} /> },
    { key: 'statusId', label: 'Status da solicitação', render: (v, r) => (r.needsOs ? <CellPair primary={refs.statusBadge(String(v))} secondary="Falta criar a OS" /> : refs.statusBadge(String(v))) },
    { key: 'unit', label: 'Unidade' },
    { key: 'equipment', label: 'Equipamento' },
    { key: 'equipmentStatusId', label: 'Situação do equipamento', render: (v) => refs.statusBadge(String(v)) },
    { key: 'id', label: 'Ações', sticky: 'right', render: (_, r) => <RowActions><RowAction icon={<IconEye size={16} />} label="Abrir solicitação" target={r.id} onClick={() => goTo(`solicitacao.html?id=${r.id}`)} /></RowActions> },
  ];
  const osColumns: TableColumn<OsRow>[] = [
    { key: 'statusId', label: 'Status', render: (v) => refs.statusBadge(String(v)) },
    { key: 'id', label: 'Código', render: (v) => <a className="text-link" href={`os.html?id=${String(v)}`}>{String(v)}</a> },
    { key: 'maint', label: 'Tipo de manutenção' },
    { key: 'subject', label: 'Assunto' },
    { key: 'unit', label: 'Unidade' },
    { key: 'equipment', label: 'Equipamento' },
  ];

  const nowHm = `${String(DEMO_NOW.getHours()).padStart(2, '0')}:${String(DEMO_NOW.getMinutes()).padStart(2, '0')}`;
  // Agenda do dia: só o que está programado para hoje (visitas, manutenções e preventivas agendadas), nunca eventos já
  // registrados no sistema (log) nem solicitações abertas. Respeita o perfil: `orders` já vem filtrado (Executor só as dele).
  const events = useMemo<DayEvent[]>(() => {
    if (empty) return [];
    const executorName = (o: WorkOrder) => (o.executor.kind === 'interno' ? userName(db, o.executor.userId)
      : o.executor.technician ?? db.providers.find((p) => p.id === (o.executor as { providerId: string }).providerId)?.tradeName ?? 'Prestador');
    const list: DayEvent[] = [];
    activeOrders.forEach((o) => {
      const company = o.executor.kind === 'prestador' ? (db.providers.find((p) => p.id === (o.executor as { providerId: string }).providerId)?.tradeName) : undefined;
      const base = { os: o.id, text: o.subject, href: `os.html?id=${o.id}`, unit: unitName(db, equipmentOf(db, o.equipmentId)?.unitId ?? ''), company };
      const todayVisits = o.visits.filter((v) => v.date === TODAY);
      todayVisits.forEach((v) => list.push({ ...base, time: v.from, end: v.to, who: v.technician, kind: 'visita', phone: executorPhone(db, o.executor, (s) => can(s), v.technician) }));
      if (o.schedule?.date === TODAY && !todayVisits.length) {
        list.push({ ...base, time: o.schedule.from, end: o.schedule.to, who: executorName(o), kind: o.kind === 'preventiva' ? 'preventiva' : 'manutencao', phone: executorPhone(db, o.executor, (s) => can(s)) });
      }
    });
    const byTime = (a: DayEvent, b: DayEvent) => a.time.localeCompare(b.time) || a.os.localeCompare(b.os);
    return [...list.filter((e) => e.end >= nowHm).sort(byTime), ...list.filter((e) => e.end < nowHm).sort(byTime)];
  }, [db, activeOrders, empty, nowHm]);

  // Rosca de equipamentos por status (CTA005)
  const slices = useMemo(() => {
    const def: Array<{ id: string; key: string; label: string; href: string }> = [
      { id: 'STE-01', key: 'running', label: 'Em funcionamento', href: 'equipamentos.html?filter=running' },
      { id: 'STE-03', key: 'stopped', label: 'Parados', href: 'equipamentos.html?filter=stopped' },
      { id: 'STE-05', key: 'inactive', label: 'Inativos', href: 'equipamentos.html?filter=inactive' },
      { id: 'STE-02', key: 'alert', label: 'Com alerta', href: 'equipamentos.html?filter=alert' },
      { id: 'STE-04', key: 'maint', label: 'Em manutenção', href: 'equipamentos.html?filter=maintenance' },
    ];
    const total = equipments.length;
    const raw = def.map((d) => ({ ...d, count: equipments.filter((e) => e.statusId === d.id).length }));
    // Maior resto: os percentuais inteiros somam sempre 100% (CTA005).
    const base = raw.map((s) => ({ ...s, pct: total ? Math.floor((s.count / total) * 100) : 0, rest: total ? ((s.count / total) * 100) % 1 : 0 }));
    let left = total ? 100 - base.reduce((n, s) => n + s.pct, 0) : 0;
    [...base].sort((a, b) => b.rest - a.rest).forEach((s) => { if (left > 0 && s.count > 0) { s.pct += 1; left -= 1; } });
    return { total, items: base };
  }, [equipments]);

  // Indicadores do contrato
  const criticalStopped = equipments.filter((e) => e.criticalityId === 'CRI-A' && e.statusId === 'STE-03').length;
  const awaitingApproval = requests.filter((r) => r.statusId === 'STS-02').length;
  // Novas sem responsável: ninguém assumiu e alguém com permissão de triagem precisa pegar (só aparece para quem pode triar)
  const unassignedNew = can('solicitacoes', 'triar') ? openReqs.filter((r) => r.statusId === 'STS-01' && !r.responsibleId).length : 0;
  const awaitingTech = activeOrders.filter((o) => o.statusId === 'STO-06').length;
  const overduePrev = executions.filter((x) => x.status !== 'concluida' && x.dueDate < TODAY).length;
  const alerts = equipments.filter((e) => e.statusId === 'STE-02').length;
  // Tempo médio de resolução: da abertura da solicitação até a CONCLUSÃO TÉCNICA (quando o executor indica a conclusão), sem contar a espera do aceite do solicitante
  const resolved = orders.filter((o) => o.validation?.requestedAt && daysBetween(o.validation.requestedAt) <= DAYS_PERIOD);
  const avgDays = resolved.length
    ? resolved.reduce((sum, o) => { const r = db.requests.find((x) => x.id === o.requestId); return sum + (new Date(o.validation!.requestedAt).getTime() - new Date(r?.openedAt ?? o.createdAt).getTime()) / 86_400_000; }, 0) / resolved.length
    : null;
  const spend = orders.filter((o) => daysBetween(o.createdAt) <= DAYS_PERIOD).reduce((s, o) => s + orderRealizedCents(o), 0);
  const unitRank = useMemo(() => {
    const short = (n: string) => (n.startsWith(company.tradeName) ? n.slice(company.tradeName.length).trim() || n : n);
    return db.units.filter((u) => unitIds.includes(u.id)).map((u) => {
      const inUnit = (eid: string) => equipmentOf(db, eid)?.unitId === u.id;
      const n = openReqs.filter((r) => inUnit(r.equipmentId)).length + equipments.filter((e) => e.unitId === u.id && (e.statusId === 'STE-02' || e.statusId === 'STE-03')).length;
      return { label: short(u.name), value: n };
    }).filter((u) => u.value > 0).sort((a, b) => b.value - a.value).slice(0, 3);
  }, [db, unitIds, openReqs, equipments, company.tradeName]);

  const dateText = todayText();

  const mineEmpty = novasReq + novasOs + aprovOs + atrasoOs === 0;
  const solEmpty = pendAprov + pendInfo + awaitingApproval + unassignedNew === 0;
  const osEmpty = osAcao + osValid + osAtivas === 0;

  // Requer ação: itens DISTINTOS que esperam uma decisão (sem contar duas vezes o que aparece em mais de um cartão); "aguardando informação" depende do solicitante e fica de fora
  const pendingReqIds = new Set([...mineReq.filter((x) => refs.base(x.statusId) === 'aberto'), ...openReqs.filter((x) => x.statusId === 'STS-04' || x.statusId === 'STS-02' || (x.statusId === 'STS-01' && !x.responsibleId && can('solicitacoes', 'triar')))].map((x) => x.id));
  const pendingOsIds = new Set([...mineOs.filter((o) => refs.base(o.statusId) === 'aberto' || (o.budget && !o.budget.decision) || o.dueAt < TODAY), ...activeOrders.filter((o) => ['STO-04', 'STO-05', 'STO-07'].includes(o.statusId))].map((o) => o.id));
  const pendingTotal = pendingReqIds.size + pendingOsIds.size;
  // Só um cartão fica em destaque: o primeiro com ação pendente (Atribuídas a mim › Solicitações pendentes › OS pendentes)
  const mineCount = novasReq + novasOs + aprovOs + atrasoOs;
  const solCount = pendAprov + awaitingApproval + unassignedNew;
  const focus: 'mine' | 'sol' | 'os' | null = !rq ? null : mineCount > 0 ? 'mine' : solCount > 0 ? 'sol' : osAcao > 0 ? 'os' : null;
  const focusCls = (k: 'mine' | 'sol' | 'os') => (focus === k ? ' is-focus' : '');
  const focusBadge = (k: 'mine' | 'sol' | 'os', n: number) => (focus === k ? <Badge status="error">{n}</Badge> : null);

  // Atalho global de criação: só as ações que o perfil pode cadastrar
  // Solicitante não usa o atalho: já tem o próprio fluxo de solicitação (Nova solicitação na lista e no menu)
  const createItems: RowMenuItem[] = user.profile === 'solicitante' ? [] : [
    ...(can('solicitacoes', 'cadastrar') ? [{ label: 'Nova solicitação', icon: <IconMessageReport size={16} />, onClick: () => goTo('solicitacao-form.html') }] : []),
    ...(can('equipamentos', 'cadastrar') ? [{ label: 'Novo equipamento', icon: <IconMicrowave size={16} />, onClick: () => goTo('equipamento-form.html') }] : []),
    ...(can('planos', 'cadastrar') ? [{ label: 'Novo plano de manutenção', icon: <IconCalendarRepeat size={16} />, onClick: () => goTo('plano-form.html') }] : []),
    ...(can('prestadores', 'cadastrar') ? [{ label: 'Novo prestador', icon: <IconTruck size={16} />, onClick: () => goTo('prestador-form.html') }] : []),
  ];
  const createMenu = createItems.length > 0 && (
    <DevNote note="Atalho global de criação (Início): menu “Criar” com Nova solicitação, Novo equipamento, Novo plano de manutenção e Novo prestador, cada um só para quem tem a permissão “Cadastrar” do módulo (sem nenhuma, o botão não aparece). Perfil Solicitante não vê o atalho: já tem o fluxo próprio de solicitação. Abre o mesmo cadastro de cada módulo. No mobile vira só o “+”, alinhado ao título.">
      <RowMenu target="cadastros" label="Criar" items={createItems} trigger={{ text: 'Criar', icon: <IconPlus size={20} />, iconOnly: isMobile }} />
    </DevNote>
  );
  const reqSectionId = 'inicio-req';
  const osSectionId = 'inicio-os';

  return (
    <AppLayout active="inicio" screen="inicio">
      <Stack gap="xl">
        <DevNote note="RF101-FLU001/FLU002: tela inicial após o login; blocos conforme o perfil e as unidades (RGN002/CTA003). Saudação com a data de hoje e Bom dia/Boa tarde/Boa noite (relógio real). RGN016: o rótulo do menu é “Início”. Fora do escopo: SLA (FE001/RGN008), estágio de implantação (RGN010) e tutorial guiado (FE015/RGN011). Sem filtro de período.">
          <PageHeader title={`${greeting()}, ${firstName(user.name)}`} subtitle={dateText} {...{ [isMobile ? 'iconActions' : 'actions']: createMenu }} />
        </DevNote>

        {rq && pendingTotal > 0 && (
          <DevNote note="Faixa de ações (referência do cliente): só aparece com pendências e diz quantos itens DISTINTOS esperam ação (sem somar duas vezes o que aparece em mais de um cartão; “aguardando informação” fica de fora porque depende do solicitante). “Ver ações” rola até o bloco Requer ação. Sem pendências, a faixa some e o Início fica como sempre, sem laranja, para não gerar falso senso de urgência. A variante v1 não tem a faixa.">
            <Card className="ag-banner" padding="none">
              <Stack direction="horizontal" align="center" justify="between" gap="md" wrap className="ag-banner-in">
                <Stack direction="horizontal" align="center" gap="md">
                  <span className="ag-banner-icon" aria-hidden="true"><IconAlertTriangle size={24} /></span>
                  <Stack gap="2xs">
                    <span className="ag-banner-title">{`Você tem ${pendingTotal} ${pendingTotal === 1 ? 'ação que precisa' : 'ações que precisam'} da sua atenção hoje`}</span>
                    <span className="ag-banner-sub">Comece pelo cartão em destaque abaixo</span>
                  </Stack>
                </Stack>
                <Button iconRight={<IconArrowRight size={16} />} onClick={() => document.getElementById('requer-acao')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Ver ações</Button>
              </Stack>
            </Card>
          </DevNote>
        )}

        <DevNote note="Início (RF101): agenda do dia ao lado de “Requer ação”, no primeiro bloco. Os 3 cards de ação (“ação”) ganham uma linha superior fina e o ícone do canto em tint suave, usando só tokens semânticos do DS pelo significado do indicador principal — Atribuídas a mim = Atenção (--color-status-warning-*: demandas sob responsabilidade do usuário), Solicitações pendentes = Info (--color-status-info-*: itens aguardando decisão, informação ou aprovação), OS pendentes = Atenção (--color-status-warning-*: o principal é “Ação necessária”). Dois cards podem repetir o token; Sucesso e Erro ficam reservados a estados positivos e críticos. A Agenda (“programação”) permanece neutra, com o ícone no padrão da marca. Fundo, textos e números seguem neutros. Os 3 cards são resumos simples, alinhados no topo e com altura própria (a agenda tem a sua). Números, links e tons de criticidade vêm da tela atual. O 1º indicador de cada card é o mais acionável, não o maior número: Atribuídas = Em atraso › Necessitam de aprovação › Novas (zerados vão para o fim; se tudo é 0, Novas); Solicitações = Aprovadas (o gestor precisa criar a OS) › Aguardando informação (depende do solicitante); OS = Ação necessária › Aguardando validação › OS ativas (total só como contexto). Ícone de atenção só em itens com valor. A agenda lista só o que está PROGRAMADO para hoje (visitas técnicas, manutenções e preventivas agendadas em OS ainda não concluídas); programado ≠ registrado: eventos já registrados no sistema (log) e solicitações abertas não entram. Em larguras menores a agenda desce para baixo dos cards.">
          <div className="ag-top" id="requer-acao">
            {rq && pendingTotal > 0 ? (
              <div className="ag-label-top ag-rq-head"><h2 className="page-label">Requer ação</h2><Badge status="error">{pendingTotal}</Badge></div>
            ) : <h2 className="page-label ag-label-top">Requer ação</h2>}
            <div className={`ag-cards${mobileNew ? ' is-compact-grid' : ''}`}>
              <>
                  <DevNote note="Estrutura simples: título e ícone (como no KpiCard) · subtítulo · indicador principal · divisor · secundários · ação. RGN001/RGN009: a cor do número principal segue a criticidade (CTA004: vermelho = crítico, amarelo = atenção) e some com 0. CTA001/CTA002: cada número leva à listagem já filtrada e bate com ela (filtros por URL; “sub” refina assigned-me / pending). Atribuídas a mim: principal = Novas; secundários = Necessitam de aprovação (RF503-RGN008) e Em atraso (RGN013, prazo da OS ultrapassado, sem SLA/FE001).">
                    <Card className={`ag-card ag-accent ${mineEmpty ? 'ag-accent--neutral' : 'ag-accent--warning'}${mobileNew ? ' is-compact' : ''}${focusCls('mine')}`} title={<>Atribuídas a mim {focusBadge('mine', mineCount)}</>} actions={<KpiIcon>{mineEmpty ? <IconUserOff size={20} /> : <IconUser size={20} />}</KpiIcon>} headingLevel={3}>
                      <div className="ag-items">
                        <ActionItem hero tone="warning" value={novasReq + novasOs} label="Novas" links={[...linksOf('solicitacoes', 'new', novasReq, novasReq === 1 ? 'solicitação' : 'solicitações'), ...linksOf('ordens-servico', 'new', novasOs, 'OS')]} />
                        <hr className="ag-divider" />
                        <div className="ag-secondary">
                          <ActionItem tone="warning" value={aprovOs} label="Necessitam de aprovação" links={linksOf('ordens-servico', 'approval', aprovOs, 'OS')} />
                          <ActionItem tone="critical" value={atrasoOs} label="Em atraso" links={linksOf('ordens-servico', 'overdue', atrasoOs, 'OS')} />
                        </div>
                      </div>
                    </Card>
                  </DevNote>
                  <DevNote note="Solicitações pendentes: principal = Aprovadas (o gestor precisa criar a OS); secundários = Aguardando informação (depende do solicitante) e Aguardando aprovação (solicitações em triagem, STS-02, à espera da decisão do gestor; vinha do antigo indicador “Solicitações aguardando aprovação”). 💡 Definição de “Aguardando aprovação” a confirmar com a cliente. “Rascunho” não existe na especificação (RF101-RGN015: salvar como rascunho não está previsto) e por isso não aparece.">
                    <Card className={`ag-card ag-accent ${solEmpty ? 'ag-accent--neutral' : 'ag-accent--info'}${mobileNew ? ' is-compact' : ''}${focusCls('sol')}`} title={<>Solicitações pendentes {focusBadge('sol', solCount)}</>} actions={<KpiIcon>{solEmpty ? <IconMessageOff size={20} /> : <IconMessageReport size={20} />}</KpiIcon>} headingLevel={3}>
                      <div className="ag-items">
                        <ActionItem hero tone="blue" value={pendAprov} label="Aprovadas" links={[{ label: 'Aprovadas', href: 'solicitacoes.html?filter=pending&sub=approved' }]} />
                        <hr className="ag-divider" />
                        <div className="ag-secondary">
                          <ActionItem tone="warning" value={pendInfo} label="Aguardando informação" links={[{ label: 'Aguardando informação', href: 'solicitacoes.html?filter=pending&sub=awaiting-info' }]} />
                          <ActionItem tone="warning" value={awaitingApproval} label="Aguardando aprovação" links={[{ label: 'Aguardando aprovação', href: 'solicitacoes.html?filter=triage' }]} />
                          {unassignedNew > 0 && <ActionItem tone="warning" value={unassignedNew} label="Novas sem responsável" links={[{ label: 'Novas sem responsável', href: 'solicitacoes.html?filter=unassigned' }]} />}
                        </div>
                      </div>
                    </Card>
                  </DevNote>
                  <DevNote note="OS pendentes: principal = Ação necessária; secundários = Aguardando validação e OS ativas (total, só como contexto). 💡 RGN014: a referência traz “Requer faturamento”, mas a plataforma não tem faturamento no MVP; proposta: “Aguardando validação” (OS aguardando a confirmação do solicitante), a confirmar com a cliente.">
                    <Card className={`ag-card ag-accent ${osEmpty ? 'ag-accent--neutral' : 'ag-accent--warning'}${mobileNew ? ' is-compact' : ''}${focusCls('os')}`} title={<>OS pendentes {focusBadge('os', osAcao)}</>} actions={<KpiIcon>{osEmpty ? <IconClipboardOff size={20} /> : <IconClipboardList size={20} />}</KpiIcon>} headingLevel={3}>
                      <div className="ag-items">
                        <ActionItem hero tone="warning" value={osAcao} label="Ação necessária" links={[{ label: 'Ação necessária', href: 'ordens-servico.html?filter=action' }]} />
                        <hr className="ag-divider" />
                        <div className="ag-secondary">
                          <ActionItem tone="warning" value={osValid} label="Aguardando validação" links={[{ label: 'Aguardando validação', href: 'ordens-servico.html?filter=awaiting-validation' }]} />
                          <ActionItem tone="info" value={osAtivas} label="OS ativas" links={[{ label: 'OS ativas', href: 'ordens-servico.html?filter=active' }]} />
                        </div>
                      </div>
                    </Card>
                  </DevNote>
              </>
            </div>
            <div className="ag-agenda">
              <DevNote note="No RF101 o bloco se chama “Atividades dos membros”; na interface usa a nomenclatura de agenda (“Agenda de hoje”). Agenda do dia: só compromissos PROGRAMADOS para hoje, ordenados por horário: visitas técnicas (visitas da OS com data de hoje), manutenções (OS corretivas agendadas) e preventivas (OS geradas por plano, agendadas). Entram OS ainda não concluídas nem canceladas; Executor vê só as dele, Solicitante só as das suas unidades (RGN002). Não usa solicitações abertas nem o histórico/log. Lista com rolagem interna (3 itens completos visíveis; a altura do card não cresce com mais itens); a lista abre no topo com as próximas atividades (primeira cujo horário final ainda não passou, pela hora de demonstração 09:30); as já encerradas ficam ao fim da lista, esmaecidas. Texto longo truncado com ellipsis e completo no title.">
                <Card className={`ag-card${mobileNew ? ' is-compact-agenda' : ''}`} title="Agenda de hoje" subtitle={mobileNew && events.length > 0 ? `Atividades programadas da equipe\n${events.length} ${events.length === 1 ? 'atividade' : 'atividades'}` : 'Atividades programadas da equipe'} actions={<span className="ag-actions">{!mobileNew && events.length > 0 && <span className="ag-count">{`${events.length} ${events.length === 1 ? 'atividade' : 'atividades'}`}</span>}<KpiIcon><IconCalendarEvent size={20} /></KpiIcon>{mobileNew && <SectionToggle open={sec.agenda} onToggle={() => toggleSec('agenda')} panelId="inicio-agenda" name="agenda de hoje" />}</span>} headingLevel={2}>
                  {mobileNew && !sec.agenda ? null : events.length === 0 ? (
                    <EmptyState icon={<IconCalendarEvent size={32} />} title="Nenhuma atividade programada para hoje" description="Visitas técnicas, manutenções e preventivas agendadas aparecem aqui" headingLevel={3} />
                  ) : (
                    <div id="inicio-agenda" className="ag-list" tabIndex={0} role="region" aria-label="Atividades programadas para hoje, role para ver mais">
                      <ol className="ag-ol">
                        {events.map((ev, i) => {
                          const b = EV_BADGE[ev.kind];
                          return (
                            <li key={`${ev.time}-${ev.os}-${i}`} className={`ag-event ${ev.end >= nowHm ? 'is-upcoming' : 'is-past'}`}>
                              <a className="ag-row-link" href={ev.href} title={`${ev.os} · ${ev.text}`} aria-label={`${ev.time}, ${b.label}, ${ev.who}, ${ev.os} ${ev.text}`}>
                                <time className="ag-time" dateTime={ev.time}>{ev.time}</time>
                                <span className="ag-body">
                                  <span className="ag-meta"><Badge status={b.status} icon={b.icon}>{b.label}</Badge><span className="ag-who" title={ev.who}>{ev.who}</span>{ev.phone && <span className="ag-phone">{noBreak(formatPhone(ev.phone))}</span>}</span>
                                  <span className="ag-sub"><span className="ag-sub-unit">{[ev.company, ev.unit].filter(Boolean).join(' · ')}</span></span>
                                </span>
                              </a>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                </Card>
              </DevNote>
            </div>
          </div>
        </DevNote>

        <DevNote note="FLU005: tabela recolhível (só a seta indica recolher/expandir, aberta por padrão). Solicitações recentes: da mais recente para a mais antiga, até 5; “Ver todas” abre a listagem completa. Status com o tipo visual configurado no Admin (RF407). Só unidades do usuário (RGN002).">
          {isMobile ? (
            <Stack gap="md" as="section">
              {mobileNew ? (
                <SectionHead id={`${reqSectionId}-t`} label="Solicitações recentes" open={openReq} onToggle={() => setOpenReq((v) => !v)} panelId={reqSectionId} name="solicitações recentes" />
              ) : (
              <Stack direction="horizontal" justify="between" align="center" gap="sm" wrap>
                <SectionLabel id={`${reqSectionId}-t`}>Solicitações recentes</SectionLabel>
                <SectionActions open={openReq} onToggle={() => setOpenReq((v) => !v)} panelId={reqSectionId} href="solicitacoes.html" label="Ver todas" name="solicitações recentes" />
              </Stack>
              )}
              <div id={reqSectionId} hidden={!openReq}>
                <MobileCardList
                  headingId={`${reqSectionId}-m`} title="Solicitações recentes" titleHidden emptyTitle="Nenhuma solicitação por aqui" page={1} pageSize={5} total={reqRows.length} onPageChange={() => undefined}
                  items={reqRows.map((r) => ({
                    id: r.id,
                    title: <a className="text-link" href={`solicitacao.html?id=${r.id}`}>{r.equipment}</a>,
                    subtitle: r.id,
                    badge: r.needsOs ? <CellPair primary={refs.statusBadge(r.statusId)} secondary="Falta criar a OS" /> : refs.statusBadge(r.statusId),
                    fields: [
                      { label: 'Status do equipamento', value: <span className="field-badge">{refs.statusBadge(r.equipmentStatusId)}</span> },
                      { label: 'Tipo de falha', value: r.failure },
                      { label: 'Descrição', value: r.description, full: true },
                    ],
                  }))}
                  footerAction={mobileNew ? <a className="text-link" href="solicitacoes.html">Ver todas</a> : undefined}
                />
              </div>
            </Stack>
          ) : openReq ? (
            <div id={reqSectionId}>
              <Table<ReqRow>
                title="Solicitações recentes" subtitle="As solicitações mais recentes das suas unidades" columns={reqColumns} rows={reqRows}
                empty={{ title: 'Nenhuma solicitação por aqui' }}
                actions={<SectionActions open onToggle={() => setOpenReq(false)} panelId={reqSectionId} href="solicitacoes.html" label="Ver todas" name="solicitações recentes" />}
              />
            </div>
          ) : (
            <Card title="Solicitações recentes" subtitle="As solicitações mais recentes das suas unidades" actions={<SectionActions open={false} onToggle={() => setOpenReq(true)} panelId={reqSectionId} href="solicitacoes.html" label="Ver todas" name="solicitações recentes" />} />
          )}
        </DevNote>

        <div className="ag2-row">
          <div className="ag2-os">
            <DevNote note="FLU005: no mobile a seção é recolhível; no desktop a tabela fica sempre visível. Ordens de serviço em andamento: todas as OS ainda não concluídas nem canceladas (situação-base), com o prazo mais próximo primeiro, até 5 (empilhado) ou até 7 quando lado a lado com “Equipamentos por status” (nº de linhas calibrado medindo a altura dos dois cards; se houver menos OS, só as existentes); “Ver todas” abre a listagem completa. Executor vê só as OS atribuídas a ele (RGN002). Resumo ao lado de “Equipamentos por status”: a coluna “Tipo de manutenção” (RF101) saiu da visão resumida por falta de largura (status, código, assunto e equipamento bastam para identificar e acompanhar; o tipo está na listagem e no detalhe da OS). Se a cliente exigir, volta quando a tela estiver em largura total. Empilha abaixo de 1440px.">
              {isMobile ? (
                <Stack gap="md" as="section">
                  {mobileNew ? (
                    <SectionHead id={`${osSectionId}-t`} label="Ordens de serviço em andamento" open={openOs} onToggle={() => setOpenOs((v) => !v)} panelId={osSectionId} name="ordens de serviço" />
                  ) : (
                  <Stack direction="horizontal" justify="between" align="center" gap="sm" wrap>
                    <SectionLabel id={`${osSectionId}-t`}>Ordens de serviço em andamento</SectionLabel>
                    <SectionActions open={openOs} onToggle={() => setOpenOs((v) => !v)} panelId={osSectionId} href="ordens-servico.html" label="Ver todas" name="ordens de serviço" />
                  </Stack>
                  )}
                  <div id={osSectionId} hidden={!openOs}>
                    <MobileCardList
                      headingId={`${osSectionId}-m`} title="Ordens de serviço em andamento" titleHidden emptyTitle="Nenhuma ordem de serviço em andamento" page={1} pageSize={5} total={osRows.length} onPageChange={() => undefined}
                      items={osRows.map((o) => ({
                        id: o.id,
                        title: <a className="text-link" href={`os.html?id=${o.id}`}>{o.id}</a>,
                        subtitle: o.subject,
                        badge: refs.statusBadge(o.statusId),
                        fields: [
                          { label: 'Tipo de manutenção', value: o.maint },
                          { label: 'Equipamento', value: o.equipment },
                        ],
                      }))}
                      footerAction={mobileNew ? <a className="text-link" href="ordens-servico.html">Ver todas</a> : undefined}
                    />
                  </div>
                </Stack>
              ) : (
                <div id={osSectionId}>
                  <Table<OsRow>
                    title="Ordens de serviço em andamento" subtitle="OS ainda não concluídas, com o prazo mais próximo primeiro" columns={osColumns} rows={osRows}
                    empty={{ title: 'Nenhuma ordem de serviço em andamento' }}
                    actions={<SectionActions open panelId={osSectionId} href="ordens-servico.html" label="Ver todas" name="ordens de serviço" />}
                  />
                </div>
              )}
            </DevNote>
          </div>
          <div className="ag2-eq">
            <DevNote note="Equipamentos por status (antes “Métricas de manutenção”, RF101): rosca dos equipamentos por status. A especificação cita 4 status (em funcionamento, parados, inativos, com alerta); o cadastro do Admin tem também “Em manutenção”, incluído para os percentuais somarem 100% e baterem com a listagem (CTA005). Cada item da legenda leva à lista de equipamentos filtrada. Cor + rótulo + número + percentual (não só cor). Cada segmento é focável por teclado e mostra tooltip (nome, quantidade e %) em hover e foco, com deslocamento mínimo (sem animação com prefers-reduced-motion); a legenda continua sendo o caminho principal.">
              <Card className={`ag2-eq-card${mobileNew && !sec.eq ? ' is-collapsed' : ''}`} title="Equipamentos por status" subtitle="Distribuição dos equipamentos cadastrados" actions={mobileNew ? <SectionToggle open={sec.eq} onToggle={() => toggleSec('eq')} panelId="inicio-eq" name="equipamentos por status" /> : undefined} headingLevel={2}>
                {mobileNew && !sec.eq ? null : slices.total === 0 ? (
                  <EmptyState title="Nenhum equipamento cadastrado" headingLevel={3} />
                ) : (
                  <div id="inicio-eq" className="donut-wrap ag-metrics">
                    <DonutChart slices={slices} />
                    <ul className="donut-legend">
                      {slices.items.map((s) => (
                        <li key={s.key}>
                          <a href={s.href} aria-label={`${s.label}: ${s.count} equipamentos, ${s.pct}%`}>
                            <span className={`dot-key dn-${s.key}`} aria-hidden="true" />
                            <span>{s.label}</span>
                            <span className="dn-count">{s.count}</span>
                            <span className="dn-pct">{s.pct}%</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </DevNote>
          </div>
        </div>

        <DevNote note="Pontos de atenção (antes parte dos “Indicadores do contrato”; RGN001/RGN012: indicadores em segundo plano, abaixo da rolagem). Revisão contra o topo: REMOVIDOS por duplicarem o topo — “Próximas ações” (v0.3, é a Agenda de hoje) e “OS abertas” (mesma contagem de “OS ativas”); “Solicitações aguardando aprovação” (STS-02, Em triagem) saiu daqui e passou a ser o secundário “Aguardando aprovação” do card Solicitações pendentes. MANTIDOS por medirem algo que o topo não mostra: OS aguardando técnico = “Aguardando prestador” (STO-06), fora de Ação necessária (STO-04/05/07) e de Aguardando validação (STO-07); Equipamentos críticos parados (criticidade A + Parado), Equipamentos com alerta (RGN006) e Preventivas vencidas (RGN003) não existem no topo. Cada um leva à lista filtrada. Cards de SLA ficam de fora (FE001/RGN008).">
          <section className="ag2-sec" aria-labelledby="inicio-atencao">
            {mobileNew ? (
              <SectionHead id="inicio-atencao" label="Pontos de atenção" open={sec.att} onToggle={() => toggleSec('att')} panelId="inicio-atencao-p" name="pontos de atenção" />
            ) : <SectionLabel id="inicio-atencao">Pontos de atenção</SectionLabel>}
            <div id="inicio-atencao-p" className={`ag2-kpis${mobileNew ? ' is-compact-grid' : ''}`} hidden={mobileNew && !sec.att}>
              <DevNote note="Equipamentos de criticidade A com status Parado."><AttentionCard label="Equipamentos críticos parados" value={criticalStopped} icon={<IconMicrowaveOff size={20} />} href="equipamentos.html?filter=stopped" /></DevNote>
              <DevNote note="Equipamentos com status “Com alerta/falha” (RGN006: sinal visual derivado do tipo visual do status)."><AttentionCard label="Equipamentos com alerta" value={alerts} icon={<IconFridge size={20} />} href="equipamentos.html?filter=alert" /></DevNote>
              <DevNote note="RGN003: execuções de plano com data prevista ultrapassada e não concluídas."><AttentionCard label="Preventivas vencidas" value={overduePrev} icon={<IconCalendarRepeat size={20} />} href="planos.html?filter=overdue" /></DevNote>
              <DevNote note="OS no status “Aguardando prestador” (técnico ainda não definido); não está em Ação necessária nem em Aguardando validação."><AttentionCard label="OS aguardando técnico" value={awaitingTech} icon={<IconTruck size={20} />} href="ordens-servico.html?filter=awaiting-technician" /></DevNote>
            </div>
          </section>
        </DevNote>

        <DevNote note="Desempenho, últimos 30 dias (RGN004/RGN005; período padrão a confirmar). Tempo médio de resolução: média entre a abertura da solicitação e a conclusão técnica (antes do aceite do solicitante). Gastos de manutenção: soma dos custos realizados das OS do período; só Administrador e Gestor veem valores (RF304-RGN003). Unidades com mais ocorrências: ranking das 3 unidades com solicitações em aberto + equipamentos com alerta ou parados, em barras horizontais de uma só cor, com o valor ao fim da barra (o tooltip é só complementar).">
          <section className="ag2-sec" aria-labelledby="inicio-desempenho">
            {mobileNew ? (
              <SectionHead id="inicio-desempenho" label={`Desempenho · últimos ${DAYS_PERIOD} dias`} open={sec.perf} onToggle={() => toggleSec('perf')} panelId="inicio-desempenho-p" name="desempenho" />
            ) : <SectionLabel id="inicio-desempenho">{`Desempenho · últimos ${DAYS_PERIOD} dias`}</SectionLabel>}
            <div id="inicio-desempenho-p" className={`ag2-perf-row${canSeeCosts ? '' : ' ag2-perf-row--nocost'}${mobileNew ? ' is-compact-grid' : ''}`} hidden={mobileNew && !sec.perf}>
              <DevNote note={`RGN004: média entre a abertura da solicitação e a conclusão técnica (quando o executor indica a conclusão), nos últimos ${DAYS_PERIOD} dias. Não inclui a espera do aceite do solicitante (a recomendação é parar na conclusão técnica). OS sem indicação de conclusão não entram. 💡 Período padrão a confirmar.`}>
                <Card padding="none">
                  <div className="ag2-stat">
                    <span className="ag2-stat-head"><span className="ag2-stat-label">Tempo médio de resolução</span><KpiIcon><IconStopwatch size={20} /></KpiIcon></span>
                    <span className="ag2-stat-value">{avgDays === null ? '-' : `${avgDays.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`}</span>
                    <span className="ag2-stat-note">Da abertura da solicitação até a conclusão técnica, sem o aceite</span>
                  </div>
                </Card>
              </DevNote>
              {canSeeCosts && (
                <DevNote note={`RGN005: soma dos custos realizados das OS dos últimos ${DAYS_PERIOD} dias. Só Administrador e Gestor veem valores (RF304-RGN003). 💡 Período padrão a confirmar.`}>
                  <Card padding="none">
                    <div className="ag2-stat">
                      <span className="ag2-stat-head"><span className="ag2-stat-label">Gastos de manutenção</span><KpiIcon><IconCoin size={20} /></KpiIcon></span>
                      <span className="ag2-stat-value"><KpiMoney cents={spend} /></span>
                      <span className="ag2-stat-note">Custos realizados nas OS do período</span>
                    </div>
                  </Card>
                </DevNote>
              )}
              <DevNote note="Ranking das 3 unidades com mais ocorrências (solicitações em aberto + equipamentos com alerta ou parados), do maior para o menor. Barras horizontais de uma só cor, sem eixo, grade nem legenda; valor ao fim de cada barra.">
                <Card padding="none" className="ag2-rank-card">
                  <div className="ag2-stat">
                    <span className="ag2-stat-head"><span className="ag2-stat-label">Unidades com mais ocorrências</span><KpiIcon><IconBuildingStore size={20} /></KpiIcon></span>
                    <span className="ag2-stat-note">Solicitações em aberto, equipamentos com alerta ou parados</span>
                      {unitRank.length === 0 ? (
                        <Text>Nenhuma unidade com ocorrências</Text>
                      ) : (
                        <ol className="ag2-bars">
                          {unitRank.map((u) => (
                            <li key={u.label} className="ag2-bar-row" tabIndex={0} role="img" aria-label={`${u.label}, ${u.value} ${u.value === 1 ? 'ocorrência' : 'ocorrências'}`} style={{ ['--r' as string]: u.value / unitRank[0].value }}>
                              <span className="ag2-bar-name" aria-hidden="true">{u.label}</span>
                              <span className="ag2-bar-cell" aria-hidden="true"><span className="ag2-bar" /><span className="ag2-bar-value">{u.value}</span></span>
                              <span className="ag2-bar-tip" aria-hidden="true">{`${u.label} — ${u.value} ${u.value === 1 ? 'ocorrência' : 'ocorrências'}`}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    
                  </div>
                </Card>
              </DevNote>
            </div>
          </section>
        </DevNote>
      </Stack>
    </AppLayout>
  );
}

mountApp(<InicioScreen />);
