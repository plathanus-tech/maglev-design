/**
 * DADOS DE DEMONSTRAÇÃO - Área do assinante (protótipo v2). Só restaurantes: o assinante de exemplo é a
 * "Cantina Dona Rosa" (ASS-0001 do Admin) e tudo aqui é coerente com o que o Admin mostra dela
 * (unidades, equipamentos, usuários, contatos). Prioridades, criticidades, status, categorias, tipos de
 * solicitação e de manutenção NÃO ficam aqui: são configurações globais do Admin (RF402-RF407) e vêm de
 * `useDb()` do Admin (`admin/shared/store.ts`) - o assinante só usa.
 * Tipos e carga inicial seguem a Especificação Funcional (v0.4) - frente "Área do Assinante".
 */
import { RecordStatus, Subscriber, seed as adminSeed, subscriberUsers } from '../../admin/shared/data';

export const DB_VERSION = 8;

/** Alerta de reincidência (documento do cliente: “3 falhas em 90 dias”). 💡 Valores a confirmar e, se aprovado, configuráveis. */
export const RECURRENCE_N = 3;
export const RECURRENCE_DAYS = 90;

/** "Hoje" do protótipo: toda a carga inicial é relativa a esta data/hora (datas locais, sem fuso). */
export const DEMO_NOW = new Date('2026-10-05T09:30:00');
const pad = (n: number, l = 2) => String(n).padStart(l, '0');
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
/** ISO local (sem Z) de "há N dias" às hh:mm - N negativo = futuro. */
export const daysAgo = (n: number, h = 9, m = 0) => {
  const d = new Date(DEMO_NOW);
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return local(d);
};
/** ISO local de "há N horas" a partir de agora. */
export const hoursAgo = (n: number) => local(new Date(DEMO_NOW.getTime() - n * 3_600_000));
/** Só a data (AAAA-MM-DD) de "há N dias" - N negativo = futuro. */
export const dayOnly = (n: number) => daysAgo(n).slice(0, 10);
export const nowLocal = () => local(new Date());

// ═══ Perfis e permissões (VISÃO GERAL §6; RF204-RGN001/RGN004 💡 matriz a confirmar) ═════════
export type ProfileKey = 'administrador' | 'gestor' | 'solicitante' | 'executor';
export const PROFILE_LABEL: Record<ProfileKey, string> = {
  administrador: 'Administrador',
  gestor: 'Gestor de manutenção',
  solicitante: 'Solicitante / Gestor da unidade',
  executor: 'Executor',
};
export const PROFILE_OPTIONS = (Object.keys(PROFILE_LABEL) as ProfileKey[]).map((value) => ({ value, label: PROFILE_LABEL[value] }));

export type ScreenKey = 'inicio' | 'equipamentos' | 'solicitacoes' | 'os' | 'planos' | 'prestadores' | 'empresa' | 'unidades' | 'ambientes' | 'equipe';
/** `aprovar` = aprovar/reprovar orçamento (RF503-RGN008); `triar` = triagem da solicitação (RF402). */
export type ActionKey = 'visualizar' | 'cadastrar' | 'editar' | 'excluir' | 'ativar' | 'aprovar' | 'triar';

const ALL: ActionKey[] = ['visualizar', 'cadastrar', 'editar', 'excluir', 'ativar', 'aprovar', 'triar'];
export const PERMISSIONS: Record<ProfileKey, Partial<Record<ScreenKey, ActionKey[]>>> = {
  administrador: {
    inicio: ['visualizar'], equipamentos: ALL, solicitacoes: ALL, os: ALL, planos: ALL, prestadores: ALL,
    empresa: ['visualizar', 'editar'], unidades: ALL, ambientes: ALL, equipe: ALL,
  },
  gestor: {
    inicio: ['visualizar'], equipamentos: ALL, solicitacoes: ALL, os: ALL, planos: ALL, prestadores: ALL,
    empresa: ['visualizar'], unidades: ['visualizar'], ambientes: ['visualizar'],
  },
  solicitante: {
    inicio: ['visualizar'], equipamentos: ['visualizar'], solicitacoes: ['visualizar', 'cadastrar'], os: ['visualizar'],
  },
  executor: {
    inicio: ['visualizar'], equipamentos: ['visualizar'], solicitacoes: ['visualizar'], os: ['visualizar', 'editar'], planos: ['visualizar'],
  },
};

// ═══ Usuários (RF204) ═══════════════════════════════════════════════
export type UserStatus = 'ativo' | 'inativo' | 'convite';
export const USER_STATUS: Record<UserStatus, { label: string; badge: 'success' | 'neutral' | 'info' }> = {
  ativo: { label: 'Ativo', badge: 'success' },
  inativo: { label: 'Inativo', badge: 'neutral' },
  convite: { label: 'Convite pendente', badge: 'info' },
};
export interface SubUser {
  id: string; name: string; email: string; phone: string; profile: ProfileKey;
  /** Unidades vinculadas (Solicitante/Gestor da unidade e Executor veem só estas; Administrador e Gestor veem todas). */
  unitIds: string[];
  status: UserStatus;
  /** Plataforma é sempre ativa (RGN006); e-mail padrão ligado; WhatsApp depende de FE002. */
  notifyEmail: boolean; notifyWhatsapp: boolean;
  lastActivity?: string; invitedAt?: string;
}

// ═══ Estrutura (RF201-RF203) ════════════════════════════════════════
export interface Unit {
  id: string; name: string; code: string;
  cep: string; street: string; number: string; district: string; city: string; uf: string;
  managerId?: string; phone: string; status: RecordStatus;
}
export interface Environment { id: string; unitId: string; name: string; description: string; status: RecordStatus }

// ═══ Equipamentos (RF301-RF305) ═════════════════════════════════════
export interface Tip { id: string; text: string }
/** Troubleshooting por problema (tipo de solicitação, Admin RF403) - dicas da mais simples à mais complexa (RF403). */
export interface TroubleshootingEntry { problemId: string; tips: Tip[] }
export interface Equipment {
  id: string; name: string; categoryId: string; maker: string; model: string; serial: string;
  /** Código interno / patrimônio. */
  code: string;
  unitId: string; environmentId: string;
  /** Status de equipamento (Admin RF407, módulo Equipamento): STE-xx. */
  statusId: string; criticalityId: string;
  /** Data de instalação/aquisição (AAAA-MM-DD). */
  acquiredAt?: string;
  /** Valor de aquisição em centavos - opcional (RF301); sem valor, a relação manutenção/ativo fica zerada (RF304-RGN004). */
  valueCents?: number;
  warranty: { has: boolean; start?: string; end?: string };
  notes?: string;
  /** Nome do arquivo das fotos (upload simulado no protótipo - RF301): do equipamento e da etiqueta/placa. */
  photoName?: string; labelPhotoName?: string;
  createdAt: string;
  /** Identificador não sequencial do QR Code (RF305-RGN004). */
  qrToken: string;
  troubleshooting: TroubleshootingEntry[];
  /** Quando entrou no status "Parado" (downtime - RF304-RGN005). */
  stoppedSince?: string;
}
export const qrLink = (e: Pick<Equipment, 'qrToken'>) => `https://maglev.com.br/q/${e.qrToken}`;

// ═══ Solicitações (RF401-RF404) ═════════════════════════════════════
export type Impact = 'baixo' | 'medio' | 'alto';
export const IMPACT_LABEL: Record<Impact, string> = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };
export type TipResult = 'realizada' | 'pulada';
/** Notas do troubleshooting (RF402-RGN008): resultado geral + resultado de cada dica. */
export interface TroubleshootingRun { overall: 'resolvido' | 'sem-sucesso' | 'nao-iniciado'; tips: Array<{ text: string; result: TipResult }> }
export interface LogEntry { id: string; at: string; by: string; text: string }
export interface Request {
  /** SOL-000124 (RF404-RGN003: sequencial por assinante). */
  id: string;
  equipmentId: string;
  /** Tipo de problema (Admin RF403): TSO-xxx. */
  problemId: string;
  impact: Impact;
  description: string;
  photos: number;
  requesterName: string; requesterPhone: string; requesterUserId?: string;
  channel: 'QR' | 'Portal';
  openedAt: string;
  /** Status de solicitação (Admin RF407): STS-xx. */
  statusId: string;
  /** Última mudança de status ("Aguardando há" - RF401-RGN003). */
  statusChangedAt: string;
  /** Preenchidos na triagem (RF402). */
  maintTypeId?: string; priorityId?: string; responsibleId?: string; group?: string;
  osId?: string;
  previousRepair: { related: boolean; note?: string };
  troubleshooting: TroubleshootingRun;
  internalNotes?: string;
  complement?: { question: string; askedAt: string; answer?: string; answeredAt?: string };
  /** Motivo ao rejeitar / concluir sem OS (RF402) ou observação da conclusão manual (RF401-FLU006). */
  closeReason?: string;
  /** Protocolo original quando recusada como duplicada (RF402-RGN006). */
  duplicateOf?: string;
  log: LogEntry[];
}

// ═══ Ordens de serviço (RF501-RF503) ════════════════════════════════
export interface Visit { id: string; date: string; from: string; to: string; technician: string; arrivedAt?: string; note?: string }
export type CostKind = 'peca' | 'mao-de-obra' | 'orcamento' | 'outro';
export const COST_KIND_LABEL: Record<CostKind, string> = { peca: 'Peça / material', 'mao-de-obra': 'Mão de obra', orcamento: 'Orçamento de prestador', outro: 'Outro' };
export interface CostItem { id: string; kind: CostKind; description: string; cents: number; attachment?: string }
/** Orçamento (RF503-FLU004): valor + descrição + anexo; aprovação só por usuário do assinante (RGN008). */
export interface Budget {
  cents: number; description: string; attachment: string; registeredAt: string; by: string;
  decision?: 'aprovado' | 'reprovado'; decidedAt?: string; decidedBy?: string; justification?: string;
}
export type Executor = { kind: 'interno'; userId: string } | { kind: 'prestador'; providerId: string; technician?: string };
/** Checklist e leituras da execução da preventiva (RF603). */
export interface Execution {
  checks: Record<string, boolean>; readings: Record<string, string>; evidences: string[];
  anomaly?: string; notes?: string; signedBy?: string;
}
export interface WorkOrder {
  /** OS-000012 */
  id: string;
  kind: 'corretiva' | 'preventiva';
  requestId?: string; planId?: string; executionId?: string;
  subject: string; equipmentId: string;
  /** Tipo de manutenção (Admin RF404): TMA-xxx (Preventiva = TMA-003). */
  maintTypeId: string; priorityId: string;
  /** Status de OS (Admin RF407): STO-xx. */
  statusId: string;
  createdAt: string;
  /** Prazo (AAAA-MM-DD). */
  dueAt: string;
  responsibleId: string;
  executor: Executor;
  schedule?: { date: string; from: string; to: string };
  contactName: string; contactPhone: string;
  reported: string; diagnosis?: string; solution?: string;
  visits: Visit[]; costs: CostItem[]; budget?: Budget;
  files: Array<{ id: string; name: string; kind: 'foto' | 'orcamento' | 'outro'; at: string; by: string }>;
  activities: LogEntry[];
  /** Validação da conclusão pelo solicitante (RF503-FLU008-FLU010). */
  validation?: { requestedAt: string; assignedTo: string; result?: 'sim' | 'nao'; comment?: string; at?: string };
  troubleshooting?: TroubleshootingRun;
  cancelReason?: string;
  execution?: Execution;
}

// ═══ Preventivas (RF601-RF603) ══════════════════════════════════════
export type Frequency = 'diaria' | 'semanal' | 'mensal' | 'anual';
export const FREQUENCY_LABEL: Record<Frequency, string> = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal', anual: 'Anual' };
export type ChecklistKind = 'obrigatorio' | 'leitura' | 'opcional';
export const CHECKLIST_KIND_LABEL: Record<ChecklistKind, string> = { obrigatorio: 'Obrigatório', leitura: 'Leitura obrigatória', opcional: 'Opcional' };
export interface ChecklistItem { id: string; text: string; kind: ChecklistKind; unit?: string }
export const EVIDENCE_OPTIONS = ['Foto antes/depois', 'Foto da placa', 'Leitura/medição', 'Assinatura/aceite', 'Relatório técnico'];
export interface Plan {
  id: string; name: string; description?: string;
  equipmentIds: string[];
  startDate: string; endDate?: string;
  frequency: Frequency; every: number;
  /** Dia de referência (ex.: dia 15 do mês; 1-7 = dia da semana p/ semanal). */
  refDay: number;
  window?: { from: string; to: string }; durationH?: number;
  executor: Executor;
  checklist: ChecklistItem[]; evidences: string[];
  onAnomaly: 'abrir-solicitacao' | 'registrar';
  status: 'ativo' | 'pausado';
  createdAt: string;
}
/** Execução prevista de um plano (RF601-RGN005: recorrência fixa; não concluída vira "Não realizada"). */
export interface PlanExecution {
  id: string; planId: string; equipmentId: string; dueDate: string;
  status: 'pendente' | 'concluida' | 'nao-realizada';
  osId?: string; doneAt?: string; doneBy?: string; anomalies?: string;
}

// ═══ Prestadores (RF701-RF703) ══════════════════════════════════════
export interface ProviderContact { id: string; name: string; role: string; phone: string; email: string; main?: boolean }
export interface Technician { id: string; name: string; specialty: string; phone: string; email: string }
export interface Provider {
  id: string; kind: 'empresa' | 'autonomo'; name: string; tradeName?: string;
  /** Só dígitos: CNPJ (14) ou CPF (11). */
  doc: string;
  status: RecordStatus; notes?: string;
  contacts: ProviderContact[];
  specialties: string[]; categoryIds: string[];
  /** Tipos de equipamento atendidos (ZC002 💡). */
  equipmentTypes: string[];
  regions: string[];
  technicians: Technician[];
}
export const SPECIALTIES = ['Refrigeração', 'Elétrica', 'Cocção', 'Gás', 'Exaustão', 'Climatização', 'Hidráulica', 'Lavagem', 'Geral'];

// ═══ Notificações (RF801) ═══════════════════════════════════════════
export interface Notification {
  id: string; userId: string; at: string; title: string; text: string; read: boolean;
  /** Tela relacionada (relativa a `assinante/screens/`). */
  href: string;
  kind: 'solicitacao' | 'os' | 'preventiva' | 'equipamento';
}

export interface SubDb {
  version: number;
  subscriberId: string;
  users: SubUser[]; units: Unit[]; environments: Environment[]; equipments: Equipment[];
  requests: Request[]; orders: WorkOrder[]; providers: Provider[]; plans: Plan[]; executions: PlanExecution[];
  notifications: Notification[];
}

// ─────────────────────────────────────────────────────────────────────
// Carga inicial
// ─────────────────────────────────────────────────────────────────────
const CITY = ['Florianópolis', 'Florianópolis', 'São José', 'Florianópolis', 'Palhoça', 'Florianópolis', 'Biguaçu'];
const UNIT_NAMES = ['Centro', 'Beira-Mar', 'Trindade', 'Shopping Iguatemi', 'Campeche', 'Lagoa da Conceição', 'Aeroporto'];
const STREETS = ['Rua Felipe Schmidt', 'Avenida Beira-Mar Norte', 'Rua Lauro Linhares', 'Rua Bocaiúva', 'Rua Pequeno Príncipe', 'Avenida das Rendeiras', 'Rodovia Ivo Silveira'];
const DISTRICTS = ['Centro', 'Agronômica', 'Trindade', 'Itacorubi', 'Campeche', 'Lagoa da Conceição', 'Carianos'];
const ENV_NAMES: Array<[string, string]> = [
  ['Cozinha quente', 'Fogões, fornos, chapas e fritadeiras'],
  ['Cozinha fria', 'Preparo de saladas, sobremesas e lavagem'],
  ['Câmara frigorífica', 'Armazenamento refrigerado e congelado'],
  ['Estoque', 'Estoque seco e insumos'],
  ['Salão', 'Atendimento ao cliente'],
  ['Bar', 'Bebidas, gelo e chopeira'],
];

/** [nome, categoria, fabricante, modelo, criticidade, ambiente] */
const TEMPLATES: Array<[string, string, string, string, string, string]> = [
  ['Câmara fria', 'CAT-001', 'Fricon', 'CF-2000', 'CRI-A', 'Câmara frigorífica'],
  ['Forno combinado', 'CAT-002', 'Rational', 'iCombi Pro 10', 'CRI-A', 'Cozinha quente'],
  ['Fritadeira', 'CAT-002', 'Venâncio', 'FEA-20', 'CRI-B', 'Cozinha quente'],
  ['Coifa', 'CAT-003', 'Tecnoinox', 'CO-3000', 'CRI-B', 'Cozinha quente'],
  ['Freezer vertical', 'CAT-001', 'Metalfrio', 'VF55', 'CRI-B', 'Cozinha fria'],
  ['Mesa refrigerada', 'CAT-001', 'Gelopar', 'GTPR-150', 'CRI-B', 'Cozinha fria'],
  ['Lava-louças', 'CAT-004', 'Hobart', 'FT-900', 'CRI-B', 'Cozinha fria'],
  ['Chapa', 'CAT-002', 'Skymsen', 'CH-80', 'CRI-B', 'Cozinha quente'],
  ['Fogão industrial', 'CAT-002', 'Progás', 'PR-6', 'CRI-B', 'Cozinha quente'],
  ['Balcão refrigerado', 'CAT-001', 'Refrimate', 'BRE-200', 'CRI-B', 'Salão'],
  ['Máquina de gelo', 'CAT-005', 'Everest', 'EGC-120', 'CRI-C', 'Bar'],
  ['Ar-condicionado', 'CAT-006', 'Daikin', 'Inverter 24k', 'CRI-C', 'Salão'],
  ['Refrigerador de bebidas', 'CAT-008', 'Metalfrio', 'VB40', 'CRI-C', 'Bar'],
  ['Chopeira', 'CAT-008', 'Ibbl', 'CH-4', 'CRI-C', 'Bar'],
  ['Salamandra', 'CAT-002', 'Skymsen', 'SA-60', 'CRI-C', 'Cozinha quente'],
];

/** Dicas de troubleshooting de exemplo (RF403). Etapas de risco só orientam a olhar, nunca a abrir o equipamento. */
const TS: Record<string, Array<[string, string[]]>> = {
  Fritadeira: [
    ['TSO-001', ['Verifique se o plugue está bem encaixado na tomada', 'Confira se o disjuntor do equipamento não desarmou no quadro', 'Veja se o registro de gás está aberto e o botão de segurança foi rearmado', 'Aguarde 10 minutos com o equipamento desligado e tente ligar novamente']],
    ['TSO-003', ['Confirme se o termostato está no nível correto de temperatura', 'Verifique se há óleo suficiente na cuba, acima da marca mínima', 'Observe se a chama do queimador acende; se não acender, não insista e abra uma solicitação']],
  ],
  'Câmara fria': [
    ['TSO-002', ['Verifique se a porta está bem fechada e a borracha de vedação não está solta', 'Confira se o termostato mostra a temperatura de trabalho (0 a 4 °C)', 'Veja se há gelo acumulado na saída de ar do evaporador', 'Confirme no quadro se o disjuntor da câmara está ligado']],
  ],
  'Forno combinado': [
    ['TSO-001', ['Verifique se o plugue está bem encaixado e o disjuntor não desarmou', 'Confira se a porta está bem fechada', 'Veja se o registro de água do forno está aberto']],
  ],
  'Máquina de gelo': [
    ['TSO-002', ['Verifique se o registro de água está aberto', 'Confira se o reservatório de gelo não está cheio', 'Limpe o filtro frontal de ar com um pano úmido']],
  ],
  'Lava-louças': [
    ['TSO-004', ['Confira se o ralo e o filtro da cuba não estão entupidos', 'Verifique se as mangueiras não estão dobradas ou soltas', 'Seque o piso e abra uma solicitação se o vazamento continuar']],
  ],
};

function slug(s: string) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, ''); }

/** Dados do assinante vindos do Admin (ASS-0001 - Cantina Dona Rosa). */
const adminSubscriber = (): Subscriber => adminSeed().subscribers[0];
export const SUBSCRIBER_ID = 'ASS-0001';

export function seed(): SubDb {
  const sub = adminSubscriber();
  const team = subscriberUsers(sub);

  // ── Unidades e ambientes ──
  const units: Unit[] = Array.from({ length: sub.units }, (_, i) => ({
    id: `UNI-${pad(i + 1, 3)}`,
    name: `${sub.tradeName} ${UNIT_NAMES[i % UNIT_NAMES.length]}`,
    code: `DR-${pad(i + 1, 2)}`,
    cep: `88${pad(10 + i, 3)}${pad(100 + i * 7, 3)}`.slice(0, 8),
    street: STREETS[i % STREETS.length], number: String(120 + i * 83), district: DISTRICTS[i % DISTRICTS.length],
    city: CITY[i % CITY.length], uf: 'SC',
    phone: `4832${pad(24000 + i * 713, 5)}`.slice(0, 10),
    status: i === sub.units - 1 ? 'inativo' as RecordStatus : 'ativo' as RecordStatus,
  }));
  const environments: Environment[] = units.flatMap((u, ui) =>
    ENV_NAMES.slice(0, ui === 0 ? 6 : ui % 2 ? 5 : 4).map(([name, description], k) => ({
      id: `AMB-${pad(ui + 1, 2)}${k + 1}`, unitId: u.id, name, description, status: 'ativo' as RecordStatus,
    })));
  const envOf = (unitId: string, name: string) => environments.find((e) => e.unitId === unitId && e.name === name) ?? environments.find((e) => e.unitId === unitId)!;

  // ── Equipe (mesma do Admin RF203) ──
  const roleOf = (p: string): ProfileKey => p.startsWith('Administrador') ? 'administrador' : p.startsWith('Gestor') ? 'gestor' : p.startsWith('Solicitante') ? 'solicitante' : 'executor';
  const allUnits = units.map((u) => u.id);
  const users: SubUser[] = team.map((t, i) => {
    const profile = roleOf(t.profile);
    return {
      id: t.id, name: t.name, email: t.email, phone: `4899${pad(88100 + i * 1371, 5)}${i}`.slice(0, 11), profile,
      unitIds: profile === 'solicitante' ? (i % 2 ? [units[0].id, units[1].id] : [units[2].id]) : allUnits,
      status: t.status, notifyEmail: i !== 3, notifyWhatsapp: false,
      lastActivity: t.status === 'convite' ? undefined : daysAgo(i, 8 + i, 15 + i * 7),
      invitedAt: t.status === 'convite' ? daysAgo(2, 14) : undefined,
    };
  });
  const user = (p: ProfileKey) => users.find((u) => u.profile === p && u.status === 'ativo') ?? users[0];
  const admin = user('administrador'), gestor = user('gestor'), solicit = user('solicitante'), exec = user('executor');
  units.forEach((u, i) => { if (u.status === 'ativo') u.managerId = i % 3 === 1 ? solicit.id : i % 3 === 2 ? gestor.id : admin.id; });

  // ── Equipamentos ──
  const equipments: Equipment[] = [];
  const counter: Record<string, number> = {};
  const total = sub.equipments;
  let n = 0;
  const activeUnits = units.filter((u) => u.status === 'ativo');
  while (n < total) {
    const ui = n % activeUnits.length;
    const u = activeUnits[ui];
    const round = Math.floor(n / activeUnits.length);
    const t = TEMPLATES[(ui * 3 + round * 4 + (round > 5 ? 1 : 0)) % TEMPLATES.length];
    const [name, categoryId, maker, model, criticalityId, envName] = t;
    const key = `${u.id}-${name}`;
    counter[key] = (counter[key] ?? 0) + 1;
    const code = `PAT-${pad(1000 + n * 7, 4)}`;
    const acquired = dayOnly(200 + ((n * 53) % 1400));
    const withValue = n % 7 !== 3;
    const value = withValue ? 180_000 + ((n * 91_700) % 2_900_000) : undefined;
    const inWarranty = n % 5 === 1;
    const entries = TS[name] ?? [];
    equipments.push({
      id: `EQP-${pad(n + 1, 4)}`,
      name: `${name} ${pad(counter[key], 2)}`, categoryId, maker, model, serial: `${maker.slice(0, 2).toUpperCase()}${pad(480_000 + n * 977, 6)}`,
      code, unitId: u.id, environmentId: envOf(u.id, envName).id,
      statusId: 'STE-01', criticalityId, acquiredAt: acquired, valueCents: value,
      warranty: inWarranty ? { has: true, start: dayOnly(120), end: dayOnly(-245) } : { has: false },
      createdAt: daysAgo(190 + (n % 40), 10),
      qrToken: `q${(n * 2654435761 % 4294967296).toString(36)}${pad(n, 2)}`,
      troubleshooting: entries.map(([problemId, tips]) => ({ problemId, tips: tips.map((text, k) => ({ id: `TIP-${n}-${problemId}-${k}`, text })) })),
    });
    n++;
  }
  const eq = (unitIdx: number, name: string) => equipments.find((e) => e.unitId === activeUnits[unitIdx].id && e.name.startsWith(name))
    ?? equipments.find((e) => e.name.startsWith(name))!;
  const setStatus = (e: Equipment, statusId: string, stoppedHours?: number) => { e.statusId = statusId; if (stoppedHours !== undefined) e.stoppedSince = hoursAgo(stoppedHours); };

  // ── Prestadores ──
  const mk = (id: string, name: string, tradeName: string | undefined, doc: string, specialties: string[], categoryIds: string[], regions: string[], contact: [string, string, string, string], techs: Array<[string, string]>, extra: Partial<Provider> = {}): Provider => ({
    id, kind: 'empresa', name, tradeName, doc, status: 'ativo', specialties, categoryIds, equipmentTypes: [], regions,
    contacts: [{ id: `${id}-C1`, name: contact[0], role: contact[1], phone: contact[2], email: contact[3], main: true }],
    technicians: techs.map(([tn, sp], k) => ({ id: `${id}-T${k + 1}`, name: tn, specialty: sp, phone: `4899${pad(70000 + k * 311 + id.length * 17, 5)}${k}`.slice(0, 11), email: `${slug(tn)}@${slug(tradeName ?? name).replace(/\./g, '')}.com.br` })),
    ...extra,
  });
  const providers: Provider[] = [
    mk('PRE-001', 'Frio Sul Refrigeração Comercial Ltda', 'Frio Sul Refrigeração', '12345678000190', ['Refrigeração', 'Climatização'], ['CAT-001', 'CAT-005', 'CAT-006'], ['Florianópolis/SC', 'São José/SC', 'Palhoça/SC'], ['Roberto Veiga', 'Sócio-diretor', '48991230001', 'contato@friosul.com.br'], [['Anderson Pires', 'Refrigeração'], ['Marcelo Tavares', 'Climatização']], { equipmentTypes: ['Câmara fria', 'Freezer', 'Máquina de gelo'] }),
    mk('PRE-002', 'Chama Viva Assistência de Cocção Ltda', 'Chama Viva', '23456789000101', ['Cocção', 'Gás'], ['CAT-002'], ['Florianópolis/SC', 'Biguaçu/SC'], ['Silvana Prado', 'Atendimento', '48991230002', 'atendimento@chamaviva.com.br'], [['Cláudio Neves', 'Cocção'], ['Évandro Luz', 'Gás']]),
    mk('PRE-003', 'ElétricaPro Instalações Ltda', 'ElétricaPro', '34567890000112', ['Elétrica'], ['CAT-001', 'CAT-002', 'CAT-004'], ['Florianópolis/SC', 'São José/SC'], ['Henrique Sales', 'Engenheiro responsável', '48991230003', 'henrique@eletricapro.com.br'], [['Wesley Amorim', 'Elétrica']]),
    mk('PRE-004', 'Ar Puro Climatização e Exaustão Ltda', 'Ar Puro', '45678901000123', ['Exaustão', 'Climatização'], ['CAT-003', 'CAT-006'], ['Florianópolis/SC', 'Palhoça/SC'], ['Tatiana Rocha', 'Comercial', '48991230004', 'comercial@arpuro.com.br'], [['Glauber Lemos', 'Exaustão']]),
    mk('PRE-005', 'Lava Forte Assistência Técnica Ltda', 'Lava Forte', '56789012000134', ['Lavagem', 'Hidráulica'], ['CAT-004'], ['Florianópolis/SC'], ['Osvaldo Brito', 'Gerente', '48991230005', 'osvaldo@lavaforte.com.br'], [['Nilson Ferraz', 'Lavagem']]),
    mk('PRE-006', 'José Almeida', undefined, '12345678909', ['Geral', 'Refrigeração'], ['CAT-001', 'CAT-008'], ['Florianópolis/SC'], ['José Almeida', 'Profissional autônomo', '48991230006', 'jose.almeida@gmail.com'], [], { kind: 'autonomo', status: 'inativo', notes: 'Inativo a pedido do prestador' }),
  ];

  // ── Solicitações e OS ──
  const requests: Request[] = [];
  const orders: WorkOrder[] = [];
  const log = (by: string, text: string, at: string, id: string): LogEntry => ({ id, at, by, text });
  const run = (overall: TroubleshootingRun['overall'], tips: Array<[string, TipResult]>): TroubleshootingRun => ({ overall, tips: tips.map(([text, result]) => ({ text, result })) });
  const tipsOf = (e: Equipment, problemId: string) => e.troubleshooting.find((t) => t.problemId === problemId)?.tips.map((t) => t.text) ?? [];

  let reqN = 118;
  const addRequest = (e: Equipment, p: Partial<Request> & Pick<Request, 'problemId' | 'description' | 'statusId' | 'openedAt'>): Request => {
    reqN++;
    const id = `SOL-${pad(reqN, 6)}`;
    const ts = tipsOf(e, p.problemId);
    const r: Request = {
      id, equipmentId: e.id, impact: 'medio', photos: 1, requesterName: solicit.name, requesterPhone: solicit.phone, requesterUserId: solicit.id,
      channel: 'Portal', statusChangedAt: p.openedAt, previousRepair: { related: false },
      troubleshooting: ts.length ? run('sem-sucesso', ts.map((t, k): [string, TipResult] => [t, k % 2 ? 'pulada' : 'realizada'])) : run('nao-iniciado', []),
      log: [log(p.requesterName ?? solicit.name, 'Abriu a solicitação', p.openedAt, `${id}-L1`)],
      ...p,
    };
    requests.push(r);
    return r;
  };
  let osN = 8;
  const addOrder = (e: Equipment, p: Partial<WorkOrder> & Pick<WorkOrder, 'subject' | 'statusId' | 'createdAt' | 'dueAt' | 'executor' | 'responsibleId'>): WorkOrder => {
    osN++;
    const o: WorkOrder = {
      id: `OS-${pad(osN, 6)}`, kind: 'corretiva', equipmentId: e.id, maintTypeId: 'TMA-001', priorityId: 'PRI-3',
      contactName: solicit.name, contactPhone: solicit.phone, reported: p.subject, visits: [], costs: [], files: [], activities: [],
      ...p,
    };
    if (!o.activities.length) o.activities = [log(gestor.name, 'Criou a OS a partir da solicitação', o.createdAt, `${o.id}-A1`)];
    orders.push(o);
    return o;
  };

  // Em triagem / novas (Dashboard: "solicitações pendentes", "novas")
  const fritadeira = eq(0, 'Fritadeira');
  const r1 = addRequest(fritadeira, {
    problemId: 'TSO-001', description: 'A fritadeira não liga desde o início do turno do almoço. Já tentamos tudo que a dica orienta.', impact: 'alto',
    statusId: 'STS-01', openedAt: hoursAgo(2), requesterName: 'Camila Rocha', requesterPhone: '48991117788', requesterUserId: undefined, channel: 'QR', photos: 2,
    troubleshooting: run('sem-sucesso', tipsOf(fritadeira, 'TSO-001').map((t, k): [string, TipResult] => [t, k === 2 ? 'pulada' : 'realizada'])),
    previousRepair: { related: true, note: 'Técnico trocou o termostato há duas semanas' },
  });
  setStatus(fritadeira, 'STE-03', 2);

  const camara = eq(1, 'Câmara fria');
  const r2 = addRequest(camara, {
    problemId: 'TSO-002', description: 'Temperatura da câmara subiu para 9 °C e os insumos estão em risco.', impact: 'alto', statusId: 'STS-02',
    openedAt: hoursAgo(5), statusChangedAt: hoursAgo(4), requesterName: solicit.name, responsibleId: gestor.id, maintTypeId: 'TMA-001', priorityId: 'PRI-1', channel: 'Portal',
    log: [log(solicit.name, 'Abriu a solicitação', hoursAgo(5), 'x1'), log(gestor.name, 'Iniciou a triagem', hoursAgo(4), 'x2')],
  });
  setStatus(camara, 'STE-02');

  const coifa = eq(2, 'Coifa');
  addRequest(coifa, {
    problemId: 'TSO-005', description: 'Barulho forte no motor da coifa, parece peça solta.', statusId: 'STS-03', openedAt: daysAgo(3, 11),
    statusChangedAt: daysAgo(2, 15), requesterName: 'Diego Ferreira', requesterPhone: '48991114455', requesterUserId: undefined, channel: 'QR', responsibleId: admin.id,
    complement: { question: 'Pode enviar um vídeo curto do barulho, com a coifa ligada?', askedAt: daysAgo(2, 15) },
    log: [log('Diego Ferreira', 'Abriu a solicitação', daysAgo(3, 11), 'y1'), log(admin.name, 'Solicitou complementação', daysAgo(2, 15), 'y2')],
  });

  const forno = eq(0, 'Forno combinado');
  addRequest(forno, {
    problemId: 'TSO-003', description: 'O forno não chega aos 180 °C, assa mais devagar.', statusId: 'STS-04', openedAt: daysAgo(1, 10), statusChangedAt: daysAgo(1, 16),
    responsibleId: gestor.id, maintTypeId: 'TMA-001', priorityId: 'PRI-2', requesterName: solicit.name,
    log: [log(solicit.name, 'Abriu a solicitação', daysAgo(1, 10), 'z1'), log(gestor.name, 'Aprovou a solicitação para criar OS', daysAgo(1, 16), 'z2')],
  });

  const gelo = eq(3, 'Máquina de gelo');
  addRequest(gelo, {
    problemId: 'TSO-002', description: 'A máquina parou de produzir gelo. Dicas feitas, sem sucesso.', statusId: 'STS-02', openedAt: daysAgo(1, 8),
    statusChangedAt: daysAgo(1, 9), responsibleId: admin.id, requesterName: 'Patrícia Gomes', requesterPhone: '48991112299', requesterUserId: undefined, channel: 'QR',
  });

  const duplicada = addRequest(camara, {
    problemId: 'TSO-002', description: 'Câmara fria esquentando.', statusId: 'STS-06', openedAt: hoursAgo(4), statusChangedAt: hoursAgo(3), requesterName: 'Rafael Lima', requesterPhone: '48991113344', requesterUserId: undefined, channel: 'QR',
    duplicateOf: r2.id, closeReason: `Duplicada de ${r2.id}`, responsibleId: gestor.id,
    log: [log('Rafael Lima', 'Abriu a solicitação', hoursAgo(4), 'd1'), log(gestor.name, `Recusou como duplicada de ${r2.id}`, hoursAgo(3), 'd2')],
  });
  void duplicada;

  // Convertidas em OS
  const lava = eq(0, 'Lava-louças');
  const rLava = addRequest(lava, {
    problemId: 'TSO-004', description: 'Vazamento de água embaixo da lava-louças, forma poça no piso.', impact: 'alto', statusId: 'STS-05', openedAt: daysAgo(6, 9),
    statusChangedAt: daysAgo(5, 14), responsibleId: gestor.id, maintTypeId: 'TMA-001', priorityId: 'PRI-2', requesterName: 'Fernanda Ribeiro',
    troubleshooting: run('sem-sucesso', tipsOf(lava, 'TSO-004').map((t): [string, TipResult] => [t, 'realizada'])),
  });
  const osLava = addOrder(lava, {
    subject: 'Vazamento de água na lava-louças', statusId: 'STO-04', createdAt: daysAgo(5, 14), dueAt: dayOnly(-2), priorityId: 'PRI-2',
    requestId: rLava.id, responsibleId: gestor.id, executor: { kind: 'prestador', providerId: 'PRE-005', technician: 'Nilson Ferraz' }, reported: rLava.description,
    diagnosis: 'Retentor da bomba de lavagem ressecado; necessário trocar o conjunto.', troubleshooting: rLava.troubleshooting,
    schedule: { date: dayOnly(4), from: '14:00', to: '16:00' },
    visits: [{ id: 'V1', date: dayOnly(4), from: '14:00', to: '16:00', technician: 'Nilson Ferraz', arrivedAt: daysAgo(4, 14, 10), note: 'Identificado vazamento no retentor da bomba' }],
    budget: { cents: 138_000, description: 'Troca do retentor e do rolamento da bomba de lavagem, com mão de obra', attachment: 'orcamento-lava-forte-0912.pdf', registeredAt: daysAgo(4, 17), by: 'Nilson Ferraz' },
    costs: [{ id: 'C1', kind: 'orcamento', description: 'Orçamento Lava Forte - retentor e rolamento', cents: 138_000, attachment: 'orcamento-lava-forte-0912.pdf' }],
    files: [{ id: 'F1', name: 'foto-vazamento.jpg', kind: 'foto', at: daysAgo(4, 14), by: 'Nilson Ferraz' }, { id: 'F2', name: 'orcamento-lava-forte-0912.pdf', kind: 'orcamento', at: daysAgo(4, 17), by: 'Nilson Ferraz' }],
    activities: [
      log(gestor.name, `Criou a OS a partir da solicitação ${rLava.id}`, daysAgo(5, 14), 'a1'),
      log(gestor.name, 'Atribuiu a OS ao prestador Lava Forte (Nilson Ferraz)', daysAgo(5, 14), 'a2'),
      log('Nilson Ferraz', 'Registrou a chegada na visita', daysAgo(4, 14, 10), 'a3'),
      log('Nilson Ferraz', 'Registrou o diagnóstico', daysAgo(4, 16), 'a4'),
      log('Nilson Ferraz', 'Anexou o orçamento de R$ 1.380,00 - status: Aguardando aprovação', daysAgo(4, 17), 'a5'),
    ],
  });
  rLava.osId = osLava.id;
  setStatus(lava, 'STE-04');

  const rForno = requests[requests.length - 2]; // aprovada do forno (STS-04) ainda sem OS
  void rForno;

  const rCam = addRequest(eq(2, 'Freezer vertical'), {
    problemId: 'TSO-002', description: 'Freezer não congela, produtos amolecendo.', impact: 'alto', statusId: 'STS-05', openedAt: daysAgo(9, 8),
    statusChangedAt: daysAgo(8, 10), responsibleId: gestor.id, maintTypeId: 'TMA-001', priorityId: 'PRI-2', requesterName: 'Fernanda Ribeiro',
  });
  const osFreezer = addOrder(eq(2, 'Freezer vertical'), {
    subject: 'Freezer não congela', statusId: 'STO-07', createdAt: daysAgo(8, 10), dueAt: dayOnly(1), priorityId: 'PRI-2', requestId: rCam.id, responsibleId: gestor.id,
    executor: { kind: 'prestador', providerId: 'PRE-001', technician: 'Anderson Pires' }, reported: rCam.description,
    diagnosis: 'Vazamento de gás refrigerante na serpentina.', solution: 'Reparo da serpentina, recarga de gás e teste de temperatura por 2 horas.',
    contactName: 'Fernanda Ribeiro', contactPhone: solicit.phone,
    visits: [
      { id: 'V1', date: dayOnly(7), from: '09:00', to: '11:00', technician: 'Anderson Pires', arrivedAt: daysAgo(7, 9, 5), note: 'Diagnóstico do vazamento' },
      { id: 'V2', date: dayOnly(3), from: '09:00', to: '12:00', technician: 'Anderson Pires', arrivedAt: daysAgo(3, 9, 0), note: 'Reparo e recarga de gás' },
    ],
    costs: [
      { id: 'C1', kind: 'peca', description: 'Gás refrigerante R-404A (1,2 kg)', cents: 28_000 },
      { id: 'C2', kind: 'mao-de-obra', description: 'Reparo da serpentina - 2 visitas', cents: 42_000 },
    ],
    budget: { cents: 70_000, description: 'Reparo da serpentina e recarga de gás', attachment: 'orcamento-frio-sul-2209.pdf', registeredAt: daysAgo(7, 11), by: 'Anderson Pires', decision: 'aprovado', decidedAt: daysAgo(7, 15), decidedBy: gestor.name },
    files: [{ id: 'F1', name: 'antes.jpg', kind: 'foto', at: daysAgo(3, 9), by: 'Anderson Pires' }, { id: 'F2', name: 'depois.jpg', kind: 'foto', at: daysAgo(3, 12), by: 'Anderson Pires' }],
    validation: { requestedAt: daysAgo(3, 12, 30), assignedTo: 'Fernanda Ribeiro' },
    activities: [
      log(gestor.name, `Criou a OS a partir da solicitação ${rCam.id}`, daysAgo(8, 10), 'a1'),
      log('Anderson Pires', 'Registrou a visita de diagnóstico', daysAgo(7, 9, 5), 'a2'),
      log('Anderson Pires', 'Anexou o orçamento de R$ 700,00', daysAgo(7, 11), 'a3'),
      log(gestor.name, 'Aprovou o orçamento', daysAgo(7, 15), 'a4'),
      log('Anderson Pires', 'Registrou a visita de reparo', daysAgo(3, 9), 'a5'),
      log('Anderson Pires', 'Indicou a conclusão - status: Aguardando validação', daysAgo(3, 12, 30), 'a6'),
    ],
  });
  rCam.osId = osFreezer.id;

  // OS em andamento / abertas / concluídas
  const osAbertas: Array<[Equipment, string, string, string, number, Executor, string]> = [
    [eq(3, 'Coifa'), 'Troca do motor da coifa', 'STO-02', 'PRI-3', -3, { kind: 'prestador', providerId: 'PRE-004', technician: 'Glauber Lemos' }, gestor.id],
    [eq(1, 'Chapa'), 'Chapa não aquece por igual', 'STO-01', 'PRI-3', -6, { kind: 'interno', userId: exec.id }, admin.id],
    [eq(2, 'Fogão industrial'), 'Queimador com chama amarela', 'STO-05', 'PRI-3', -1, { kind: 'prestador', providerId: 'PRE-002', technician: 'Cláudio Neves' }, gestor.id],
    [eq(4, 'Ar-condicionado'), 'Ar-condicionado pingando no salão', 'STO-06', 'PRI-4', -9, { kind: 'prestador', providerId: 'PRE-001' }, admin.id],
    [eq(0, 'Mesa refrigerada'), 'Porta da mesa refrigerada não veda', 'STO-02', 'PRI-4', 4, { kind: 'interno', userId: exec.id }, gestor.id],
  ];
  osAbertas.forEach(([e, subject, statusId, priorityId, due, executor, resp], i) => {
    const r = addRequest(e, { problemId: 'TSO-007', description: subject, statusId: 'STS-05', openedAt: daysAgo(12 + i, 9), statusChangedAt: daysAgo(11 + i, 9), responsibleId: resp, maintTypeId: 'TMA-001', priorityId, requesterName: solicit.name });
    const o = addOrder(e, { subject, statusId, createdAt: daysAgo(11 + i, 9), dueAt: dayOnly(due), priorityId, executor, responsibleId: resp, requestId: r.id, reported: subject, files: [] });
    r.osId = o.id;
    if (statusId === 'STO-02') { o.visits = [{ id: 'V1', date: dayOnly(1 + i), from: '08:00', to: '10:00', technician: executor.kind === 'interno' ? exec.name : 'Técnico do prestador', arrivedAt: daysAgo(1 + i, 8, 5) }]; }
    setStatus(e, e.statusId === 'STE-01' ? 'STE-04' : e.statusId);
  });

  // Agenda de hoje (Início, RF101): visitas e manutenções programadas para a data de demonstração, com horários variados.
  const byOs = (subject: string) => orders.find((o) => o.subject === subject)!;
  byOs('Chapa não aquece por igual').schedule = { date: dayOnly(0), from: '08:30', to: '10:00' };
  byOs('Troca do motor da coifa').visits.push({ id: 'V2', date: dayOnly(0), from: '10:00', to: '12:00', technician: 'Glauber Lemos', note: 'Retirada do motor para troca' });
  byOs('Queimador com chama amarela').schedule = { date: dayOnly(0), from: '14:00', to: '16:00' };
  byOs('Porta da mesa refrigerada não veda').visits.push({ id: 'V2', date: dayOnly(0), from: '15:30', to: '16:30', technician: exec.name, note: 'Troca da borracha de vedação' });

  // Concluídas (histórico / gasto)
  const concluidas: Array<[Equipment, string, number, number, string]> = [
    [eq(0, 'Câmara fria'), 'Troca do termostato da câmara fria', 18, 74_000, 'PRE-001'],
    [eq(1, 'Forno combinado'), 'Descalcificação do forno combinado', 25, 46_000, 'PRE-002'],
    [eq(2, 'Fritadeira'), 'Troca do termostato da fritadeira', 16, 31_000, 'PRE-002'],
    [eq(1, 'Lava-louças'), 'Reparo da bomba de drenagem', 40, 98_000, 'PRE-005'],
    [eq(0, 'Coifa'), 'Substituição das correias do exaustor', 52, 22_000, 'PRE-004'],
    // Fritadeira 02 acumula 3 corretivas em 90 dias (alerta de reincidência, RF304)
    [eq(2, 'Fritadeira'), 'Reparo do queimador da fritadeira', 38, 27_000, 'PRE-002'],
    [eq(2, 'Fritadeira'), 'Troca da resistência da fritadeira', 64, 35_000, 'PRE-002'],
  ];
  concluidas.forEach(([e, subject, ago, cents, pid], i) => {
    const r = addRequest(e, { problemId: 'TSO-001', description: subject, statusId: 'STS-05', openedAt: daysAgo(ago + 3, 9), statusChangedAt: daysAgo(ago + 2, 9), responsibleId: gestor.id, maintTypeId: 'TMA-001', priorityId: 'PRI-3', requesterName: solicit.name });
    const o = addOrder(e, {
      subject, statusId: 'STO-08', createdAt: daysAgo(ago + 2, 9), dueAt: dayOnly(ago - 2), requestId: r.id, responsibleId: gestor.id, executor: { kind: 'prestador', providerId: pid },
      reported: subject, diagnosis: 'Falha identificada e corrigida.', solution: subject,
      visits: [{ id: 'V1', date: dayOnly(ago), from: '09:00', to: '11:00', technician: providers.find((p) => p.id === pid)!.technicians[0]?.name ?? 'Técnico', arrivedAt: daysAgo(ago, 9, 4) }],
      costs: [{ id: 'C1', kind: 'mao-de-obra', description: 'Mão de obra e peças', cents }],
      validation: { requestedAt: daysAgo(ago, 12), assignedTo: solicit.name, result: 'sim', at: daysAgo(ago - 1, 8) },
      activities: [log(gestor.name, 'Criou a OS', daysAgo(ago + 2, 9), `c${i}1`), log(solicit.name, 'Validou a conclusão: o problema foi resolvido', daysAgo(ago - 1, 8), `c${i}2`)],
    });
    r.osId = o.id;
    r.log.push(log(gestor.name, `Criou a ${o.id}`, daysAgo(ago + 2, 9), `rc${i}`));
  });

  // Concluída sem OS (resolvida no troubleshooting) e recusada
  addRequest(eq(0, 'Fritadeira'), { problemId: 'TSO-001', description: 'Fritadeira não ligava; resolvido pela dica (disjuntor desarmado).', statusId: 'STS-07', openedAt: daysAgo(14, 11), statusChangedAt: daysAgo(14, 11), requesterName: 'Camila Rocha', requesterPhone: '48991117788', requesterUserId: undefined, channel: 'QR', troubleshooting: run('resolvido', [['Confira se o disjuntor do equipamento não desarmou no quadro', 'realizada']]), closeReason: 'Resolvida no troubleshooting' });
  addRequest(eq(1, 'Balcão refrigerado'), { problemId: 'TSO-008', description: 'Balcão com adesivo solto.', impact: 'baixo', statusId: 'STS-06', openedAt: daysAgo(20, 15), statusChangedAt: daysAgo(19, 9), responsibleId: gestor.id, requesterName: solicit.name, closeReason: 'Solicitação inválida: não é um defeito do equipamento' });

  // ── Planos de preventiva ──
  const chk = (id: string, items: Array<[string, ChecklistKind, string?]>): ChecklistItem[] => items.map(([text, kind, unit], i) => ({ id: `${id}-${i + 1}`, text, kind, unit }));
  const plans: Plan[] = [
    {
      id: 'PLA-001', name: 'Preventiva mensal das câmaras frias', description: 'Limpeza do condensador, vedações e verificação da temperatura', equipmentIds: equipments.filter((e) => e.name.startsWith('Câmara fria')).map((e) => e.id),
      startDate: dayOnly(200), frequency: 'mensal', every: 1, refDay: 5, window: { from: '08:00', to: '11:00' }, durationH: 2, executor: { kind: 'prestador', providerId: 'PRE-001', technician: 'Anderson Pires' },
      checklist: chk('PLA-001', [['Limpar o condensador', 'obrigatorio'], ['Conferir a vedação das portas', 'obrigatorio'], ['Medir a temperatura interna', 'leitura', '°C'], ['Verificar o dreno do evaporador', 'opcional']]),
      evidences: ['Foto antes/depois', 'Leitura/medição', 'Assinatura/aceite'], onAnomaly: 'abrir-solicitacao', status: 'ativo', createdAt: daysAgo(200),
    },
    {
      id: 'PLA-002', name: 'Limpeza e inspeção das coifas', description: 'Limpeza de filtros e dutos, checagem do motor', equipmentIds: equipments.filter((e) => e.name.startsWith('Coifa')).map((e) => e.id),
      startDate: dayOnly(160), frequency: 'mensal', every: 3, refDay: 15, durationH: 3, executor: { kind: 'prestador', providerId: 'PRE-004', technician: 'Glauber Lemos' },
      checklist: chk('PLA-002', [['Limpar filtros', 'obrigatorio'], ['Inspecionar o motor e as correias', 'obrigatorio'], ['Medir a vazão de ar', 'leitura', 'm³/h']]),
      evidences: ['Foto antes/depois'], onAnomaly: 'abrir-solicitacao', status: 'ativo', createdAt: daysAgo(160),
    },
    {
      id: 'PLA-003', name: 'Revisão semanal das fritadeiras', equipmentIds: equipments.filter((e) => e.name.startsWith('Fritadeira')).map((e) => e.id),
      startDate: dayOnly(120), frequency: 'semanal', every: 1, refDay: 1, durationH: 1, executor: { kind: 'interno', userId: exec.id },
      checklist: chk('PLA-003', [['Verificar o estado do óleo', 'obrigatorio'], ['Limpar a cuba e o cesto', 'obrigatorio'], ['Testar o termostato', 'leitura', '°C']]),
      evidences: ['Foto antes/depois'], onAnomaly: 'registrar', status: 'ativo', createdAt: daysAgo(120),
    },
    {
      id: 'PLA-004', name: 'Descalcificação dos fornos combinados', equipmentIds: equipments.filter((e) => e.name.startsWith('Forno combinado')).map((e) => e.id),
      startDate: dayOnly(300), frequency: 'mensal', every: 2, refDay: 20, durationH: 2, executor: { kind: 'prestador', providerId: 'PRE-002', technician: 'Cláudio Neves' },
      checklist: chk('PLA-004', [['Executar o ciclo de descalcificação', 'obrigatorio'], ['Conferir as vedações da porta', 'obrigatorio']]),
      evidences: ['Foto da placa'], onAnomaly: 'abrir-solicitacao', status: 'pausado', createdAt: daysAgo(300),
    },
  ];
  const nextDue = (p: Plan, k: number) => { const d = new Date(DEMO_NOW); d.setHours(0, 0, 0, 0);
    if (p.frequency === 'semanal') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7 * (k - p.every) ); return local(d).slice(0, 10); }
    d.setDate(p.refDay); d.setMonth(d.getMonth() + k * p.every); return local(d).slice(0, 10); };
  const executions: PlanExecution[] = [];
  plans.forEach((p) => {
    const past = p.frequency === 'semanal' ? [-3, -2, -1] : [-3, -2, -1];
    p.equipmentIds.slice(0, 3).forEach((eid, ei) => {
      past.forEach((k, ki) => {
        const due = nextDue(p, p.frequency === 'semanal' ? k + 1 : k);
        const done = !(p.id === 'PLA-002' && ki === 1) && !(p.id === 'PLA-001' && ei === 1 && ki === 2) && !(p.id === 'PLA-003' && ki === 2 && ei === 0);
        executions.push({ id: `${p.id}-${eid}-${ki}`, planId: p.id, equipmentId: eid, dueDate: due, status: done ? 'concluida' : 'nao-realizada', doneAt: done ? `${due}T10:30:00` : undefined, doneBy: done ? (p.executor.kind === 'interno' ? exec.name : providers.find((x) => x.id === (p.executor as { providerId: string }).providerId)?.technicians[0]?.name) : undefined, anomalies: p.id === 'PLA-001' && ki === 0 && ei === 0 ? 'Vedação da porta ressecada' : undefined });
      });
    });
  });
  // Execuções futuras / do dia: geram OS preventivas
  plans.filter((p) => p.status === 'ativo').forEach((p, pi) => {
    p.equipmentIds.slice(0, 3).forEach((eid, ei) => {
      const due = p.frequency === 'semanal' ? dayOnly(-(2 + ei) + (pi === 2 ? 0 : 0)) : nextDue(p, p.frequency === 'mensal' && p.every === 1 ? 1 : 1);
      const e = equipments.find((x) => x.id === eid)!;
      const overdue = pi === 0 && ei === 0;
      const exId = `${p.id}-${eid}-next`;
      // Preventivas programadas para hoje (agenda do Início): plano-equipamento -> horário
      const todaySlot = ({ '0-1': ['11:30', '13:30'], '1-0': ['16:00', '19:00'], '2-0': ['13:00', '14:00'] } as Record<string, [string, string]>)[`${pi}-${ei}`];
      const dueDate = overdue ? dayOnly(2) : todaySlot ? dayOnly(0) : due;
      const o = addOrder(e, {
        subject: `${p.name} - ${e.name}`, kind: 'preventiva', maintTypeId: 'TMA-003', priorityId: 'PRI-4', statusId: overdue ? 'STO-02' : 'STO-01', createdAt: daysAgo(overdue ? 6 : 1, 6), dueAt: dueDate,
        planId: p.id, executionId: exId, executor: p.executor, responsibleId: gestor.id, reported: p.description ?? p.name, activities: [log('Sistema', `OS gerada automaticamente pelo plano ${p.name}`, daysAgo(overdue ? 6 : 1, 6), `pa${p.id}${ei}`)],
        schedule: { date: dueDate, from: todaySlot?.[0] ?? p.window?.from ?? '09:00', to: todaySlot?.[1] ?? p.window?.to ?? '11:00' },
      });
      executions.push({ id: exId, planId: p.id, equipmentId: eid, dueDate, status: 'pendente', osId: o.id });
    });
  });

  // Estado de equipamentos extra (parado/inativo)
  setStatus(eq(3, 'Ar-condicionado'), 'STE-02');
  setStatus(eq(4, 'Chopeira'), 'STE-05');

  // ── Notificações (RF801) ──
  const notifications: Notification[] = [];
  const note = (userId: string, i: number, kind: Notification['kind'], title: string, text: string, href: string, at: string, read = false) => notifications.push({ id: `NOT-${userId}-${i}`, userId, at, title, text, read, href, kind });
  users.forEach((u) => {
    if (u.status === 'convite') return;
    if (u.profile === 'administrador' || u.profile === 'gestor') {
      note(u.id, 1, 'solicitacao', 'Nova solicitação aberta', `${r1.id}: ${fritadeira.name} não liga (impacto alto)`, `solicitacao.html?id=${r1.id}`, hoursAgo(2));
      note(u.id, 2, 'os', 'Orçamento aguardando aprovação', `${osLava.id}: orçamento de R$ 1.380,00 da Lava Forte`, `os.html?id=${osLava.id}`, daysAgo(4, 17));
      note(u.id, 3, 'solicitacao', 'Resposta à complementação pendente', 'Solicitação da coifa aguarda o vídeo do solicitante', 'solicitacoes.html', daysAgo(2, 15), true);
      note(u.id, 4, 'preventiva', 'Preventiva vencida', 'Preventiva mensal das câmaras frias está atrasada', 'planos.html', daysAgo(1, 7));
      note(u.id, 5, 'os', 'OS aguardando validação', `${osFreezer.id}: aguardando a confirmação do solicitante`, `os.html?id=${osFreezer.id}`, daysAgo(3, 12), true);
      const reinc = eq(2, 'Fritadeira');
      note(u.id, 6, 'equipamento', 'Falhas recorrentes em equipamento', `${reinc.name}: ${RECURRENCE_N} corretivas nos últimos ${RECURRENCE_DAYS} dias`, `equipamento.html?id=${reinc.id}`, daysAgo(16, 12));
    }
    if (u.profile === 'solicitante') {
      note(u.id, 1, 'os', 'Validação pendente', `${osFreezer.id}: o problema foi resolvido?`, `os.html?id=${osFreezer.id}`, daysAgo(3, 12));
      note(u.id, 2, 'solicitacao', 'Sua solicitação mudou de status', `${r2.id} entrou em triagem`, `solicitacao.html?id=${r2.id}`, hoursAgo(4), true);
    }
    if (u.profile === 'executor') {
      note(u.id, 1, 'os', 'Nova OS atribuída a você', 'Chapa não aquece por igual', 'os.html', daysAgo(10, 9));
      note(u.id, 2, 'preventiva', 'Preventiva gerada', 'Revisão semanal das fritadeiras', 'planos.html', daysAgo(1, 6));
    }
  });

  // Exemplos com fotos: Forno combinado 01 e Chapa 01 (foto do equipamento e foto da placa/etiqueta)
  equipments.filter((e) => e.name === 'Forno combinado 01').forEach((e) => { e.photoName = 'forno2.webp'; e.labelPhotoName = 'placa.webp'; });
  equipments.filter((e) => e.name === 'Chapa 01').forEach((e) => { e.photoName = 'chapa.jpg'; e.labelPhotoName = 'images.jpg'; });
  // Mock visual do Histórico de manutenções: uma OS concluída do Forno combinado 01 com foto registrada na manutenção (as demais ficam sem foto)
  const fornoId = equipments.find((e) => e.name === 'Forno combinado 01')?.id;
  orders.filter((o) => o.equipmentId === fornoId && o.subject === 'Descalcificação do forno combinado').forEach((o) => { o.files.push({ id: 'F1', name: 'forno2.webp', kind: 'foto', at: daysAgo(25, 11), by: 'Chama Viva' }); });
  return { version: DB_VERSION, subscriberId: SUBSCRIBER_ID, users, units, environments, equipments, requests, orders, providers, plans, executions, notifications };
}
