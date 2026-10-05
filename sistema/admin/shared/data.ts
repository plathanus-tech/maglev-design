/**
 * DADOS DE DEMONSTRAÇÃO - Admin da plataforma (sistema). A MAGLEV atende só restaurantes:
 * assinantes, unidades e equipamentos são de cozinha profissional.
 * Tipos e carga inicial seguem a Especificação Funcional (v0.4) - só o que é do Admin e está no contrato.
 */
import { BadgeStatus } from '@maglev/ds';

// ═══ Tipo visual (RF407 / RNF014) ════════════════════════════════════
export type Visual = 'sucesso' | 'informativo' | 'atencao' | 'critico' | 'neutro';
export const VISUALS: Array<{ value: Visual; label: string; badge: BadgeStatus }> = [
  { value: 'sucesso', label: 'Sucesso (verde)', badge: 'success' },
  { value: 'informativo', label: 'Informativo (azul)', badge: 'info' },
  { value: 'atencao', label: 'Atenção (amarelo)', badge: 'warning' },
  { value: 'critico', label: 'Crítico (vermelho)', badge: 'error' },
  { value: 'neutro', label: 'Neutro (cinza)', badge: 'neutral' },
];
export const visualBadge = (v: Visual): BadgeStatus => VISUALS.find((x) => x.value === v)!.badge;
export const visualLabel = (v: Visual) => VISUALS.find((x) => x.value === v)!.label;

export type RecordStatus = 'ativo' | 'inativo';
export const RECORD_STATUS_LABEL: Record<RecordStatus, string> = { ativo: 'Ativo', inativo: 'Inativo' };

// ═══ Assinantes (RF201–RF204) ════════════════════════════════════════
export type SubscriberStatus = 'ativo' | 'inadimplente' | 'inativo';
export const SUBSCRIBER_STATUS_LABEL: Record<SubscriberStatus, string> = { ativo: 'Ativo', inadimplente: 'Inadimplente', inativo: 'Inativo' };
export const SUBSCRIBER_STATUS_BADGE: Record<SubscriberStatus, BadgeStatus> = { ativo: 'success', inadimplente: 'warning', inativo: 'neutral' };

export type ContactArea = 'responsavel' | 'comercial' | 'financeiro' | 'tecnico' | 'outro';
export const CONTACT_AREAS: Array<{ value: ContactArea; label: string }> = [
  { value: 'responsavel', label: 'Responsável / Principal' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'outro', label: 'Outro' },
];
export const contactAreaLabel = (a: ContactArea) => CONTACT_AREAS.find((x) => x.value === a)!.label;

/** Plano/contratação: campo informativo (P01); planos com limites são FE012 (fora do escopo). */
export const PLANS = ['Mensal', 'Trimestral', 'Semestral', 'Anual'];

export interface Contact { id: string; area: ContactArea; name: string; email: string; phone: string }
export interface Address { cep: string; street: string; number: string; complement: string; district: string; city: string; uf: string }
/** Registro de ativação/inativação do ambiente (RF204-FLU003 / CTA003). */
export interface EnvChange { at: string; by: string; action: 'ativou' | 'inativou'; reason?: string }

export type InactivationReason = 'inadimplencia' | 'contrato' | 'outro';
export const INACTIVATION_REASONS: Array<{ value: InactivationReason; label: string }> = [
  { value: 'inadimplencia', label: 'Inadimplência' },
  { value: 'contrato', label: 'Contrato encerrado' },
  { value: 'outro', label: 'Outro' },
];

export interface Subscriber {
  id: string;
  /** Só dígitos (14). */
  cnpj: string;
  legalName: string;
  tradeName: string;
  stateReg: string;
  cityReg: string;
  address: Address;
  /** 💡 Quantidade de unidades contratadas - informativa (confirmar se limita: FE012). */
  contractedUnits: string;
  contacts: Contact[];
  plan: string;
  status: SubscriberStatus;
  admin: { name: string; email: string; phone: string };
  /** Data de cadastro (ISO) - "cliente desde". */
  since: string;
  units: number;
  equipments: number;
  /** Soma dos custos realizados das OS, em centavos. */
  maintenanceCents: number;
  /** Solicitações abertas nos últimos 30 dias (ranking "Clientes com mais solicitações · 30 dias"). */
  requests30d: number;
  envHistory: EnvChange[];
}

export const subscriberName = (s: Pick<Subscriber, 'tradeName' | 'legalName'>) => s.tradeName || s.legalName;

// ═══ Usuários do assinante (somente leitura no Admin - RF203-RGN001) ═══
export const SUBSCRIBER_PROFILES = ['Administrador', 'Gestor de manutenção', 'Solicitante / Gestor da unidade', 'Executor'];
export type SubscriberUserStatus = 'ativo' | 'inativo' | 'convite';
export const SUBSCRIBER_USER_STATUS: Record<SubscriberUserStatus, { label: string; badge: BadgeStatus }> = {
  ativo: { label: 'Ativo', badge: 'success' },
  inativo: { label: 'Inativo', badge: 'neutral' },
  convite: { label: 'Convite pendente', badge: 'info' },
};
export interface SubscriberUser { id: string; name: string; email: string; profile: string; status: SubscriberUserStatus }

// ═══ Usuários do Admin (RF301–RF302) e perfis (RF303) ═══════════════
/**
 * Histórico de ações: log do que cada usuário do Admin fez no sistema (cadastrou assinante, inativou ambiente,
 * alterou perfil…). `kind` define a cor; `action` é a frase exibida.
 */
export type ActivityModule = 'Assinantes' | 'Usuários' | 'Perfis de acesso' | 'Configurações';
export type ActivityKind = 'cadastro' | 'edicao' | 'ativacao' | 'inativacao' | 'exclusao';
export interface Activity { id: string; at: string; userId: string; module: ActivityModule; kind: ActivityKind; action: string }
export interface AdminUser { id: string; name: string; email: string; phone: string; profileId: string; status: RecordStatus; createdAt: string;
  /** Preferências de comunicação (só a própria conta edita). Sem valor: e-mail ligado, WhatsApp desligado. */
  notifyEmail?: boolean; notifyWhatsapp?: boolean }

export type ScreenKey = 'dashboard' | 'assinantes' | 'usuarios' | 'perfis' | 'configuracoes';
export type ActionKey = 'visualizar' | 'cadastrar' | 'editar' | 'excluir' | 'ativar';
export const ACTIONS: Array<{ key: ActionKey; label: string }> = [
  { key: 'visualizar', label: 'Visualizar' },
  { key: 'cadastrar', label: 'Cadastrar' },
  { key: 'editar', label: 'Editar' },
  { key: 'excluir', label: 'Excluir' },
  { key: 'ativar', label: 'Ativar/Inativar' },
];
/** Telas × ações que existem em cada tela (ex.: assinante não é excluído, só inativado). */
export const SCREENS: Array<{ key: ScreenKey; label: string; actions: ActionKey[] }> = [
  { key: 'dashboard', label: 'Dashboard', actions: ['visualizar'] },
  { key: 'assinantes', label: 'Assinantes', actions: ['visualizar', 'cadastrar', 'editar', 'ativar'] },
  { key: 'usuarios', label: 'Usuários', actions: ['visualizar', 'cadastrar', 'editar', 'ativar'] },
  { key: 'perfis', label: 'Perfis de acesso', actions: ['visualizar', 'cadastrar', 'editar', 'excluir', 'ativar'] },
  { key: 'configuracoes', label: 'Configurações', actions: ['visualizar', 'cadastrar', 'editar', 'excluir', 'ativar'] },
];
export type Permissions = Record<ScreenKey, ActionKey[]>;
export const FULL_ACCESS: Permissions = Object.fromEntries(SCREENS.map((s) => [s.key, [...s.actions]])) as Permissions;

export interface Profile { id: string; name: string; description: string; fixed?: boolean; status: RecordStatus; permissions: Permissions }

// ═══ Configurações (RF401–RF407) ════════════════════════════
/** `icon`: identificador estável do ícone no catálogo (icon-catalog.ts) - só categorias de equipamento usam; opcional. */
export interface ConfigItem { id: string; name: string; description: string; status: RecordStatus; links: number; icon?: string }
/** Prioridades e criticidades: níveis fixos - só nome, descrição e cor (tipo visual) editáveis. */
export interface LevelItem { id: string; level: string; name: string; description: string; visual: Visual; links: number }

export type StatusModule = 'equipamento' | 'solicitacao' | 'os' | 'preventiva';
export const STATUS_MODULES: Array<{ value: StatusModule; label: string }> = [
  { value: 'equipamento', label: 'Equipamento' },
  { value: 'solicitacao', label: 'Solicitação (triagem)' },
  { value: 'os', label: 'Ordem de serviço' },
  { value: 'preventiva', label: 'Preventiva' },
];
export const moduleLabel = (m: StatusModule) => STATUS_MODULES.find((x) => x.value === m)!.label;
export type BaseSituation = 'aberto' | 'andamento' | 'aguardando' | 'concluido' | 'cancelado';
export const BASE_SITUATIONS: Array<{ value: BaseSituation; label: string }> = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'andamento', label: 'Em andamento' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
];
export const baseLabel = (b: BaseSituation) => BASE_SITUATIONS.find((x) => x.value === b)!.label;
export interface StatusItem { id: string; module: StatusModule; name: string; visual: Visual; base: BaseSituation; order: number; status: RecordStatus; links: number }

// ═══ Chamados em aberto (Dashboard RF101) ═══════════════════════════
export type TicketType = 'solicitacao' | 'os';
export interface Ticket {
  id: string; type: TicketType; subscriberId: string; unit: string; equipment: string;
  /** id da prioridade (PRI-1 Emergência … PRI-4 Baixa) e da criticidade (CRI-A … CRI-C). */
  priorityId: string; criticalityId: string; statusId: string; hoursAgo: number;
}

// ─────────────────────────────────────────────────────────────────────
// Carga inicial
// ─────────────────────────────────────────────────────────────────────
const pad = (n: number, l: number) => String(n).padStart(l, '0');

const PEOPLE = [
  'Mariana Costa', 'Rafael Lima', 'Juliana Alves', 'Bruno Martins', 'Camila Rocha', 'Diego Ferreira', 'Patrícia Gomes',
  'Lucas Barbosa', 'Fernanda Ribeiro', 'Gustavo Pereira', 'Aline Carvalho', 'Thiago Mendes', 'Renata Dias', 'Felipe Araújo',
  'Larissa Teixeira', 'Eduardo Nunes', 'Beatriz Moreira', 'Rodrigo Cardoso', 'Vanessa Pinto', 'Marcelo Duarte',
];
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

function cnpjFrom(base: number): string {
  const d = (pad(base, 8) + '0001').split('').map(Number);
  const dv = (nums: number[]) => {
    const w = nums.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = nums.reduce((s, n, i) => s + n * w[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  d.push(dv(d));
  d.push(dv(d));
  return d.join('');
}

const FEATURED: Array<[string, string]> = [
  ['Cantina Dona Rosa Alimentação Ltda', 'Cantina Dona Rosa'],
  ['Bistrô Alecrim Gastronomia Ltda', 'Bistrô Alecrim'],
  ['Sushi Kaze Culinária Japonesa Ltda', 'Sushi Kaze'],
  ['Pizzaria Forno de Pedra Ltda', 'Pizzaria Forno de Pedra'],
  ['Brasa Viva Hamburgueria Ltda', 'Hamburgueria Brasa Viva'],
  ['Maré Alta Restaurante e Eventos Ltda', 'Restaurante Maré Alta'],
];
const KIND = ['Restaurante', 'Cantina', 'Bistrô', 'Pizzaria', 'Churrascaria', 'Trattoria', 'Temakeria', 'Hamburgueria', 'Taberna', 'Cozinha'];
const NAME = [
  'Sabor da Ilha', 'Casa Nossa', 'Dom Vicenzo', 'Ponto do Chef', 'Mesa Farta', 'Bella Nonna', 'Porto Seguro', 'Lua Cheia',
  'Tempero Caseiro', 'Vila Rica', 'Recanto Verde', 'Brasa & Cia', 'Terra e Mar', 'Oliveira', 'Sal Grosso', 'Fogo Alto',
];
const CITIES: Array<[string, string, string]> = [
  ['Florianópolis', 'SC', '880'], ['São José', 'SC', '881'], ['Joinville', 'SC', '892'], ['Balneário Camboriú', 'SC', '883'],
  ['Curitiba', 'PR', '800'], ['Porto Alegre', 'RS', '900'], ['São Paulo', 'SP', '014'],
];
const STREETS = ['Rua das Palmeiras', 'Avenida Beira-Mar Norte', 'Rua Bocaiúva', 'Rua Felipe Schmidt', 'Avenida Atlântica', 'Rua XV de Novembro', 'Rua Esteves Júnior'];
const DISTRICTS = ['Centro', 'Agronômica', 'Trindade', 'Pioneiros', 'Batel', 'Moinhos de Vento', 'Pinheiros'];

const TOTAL = 140;
const OVERDUE = new Set([7, 23, 41, 66, 88, 115]);
const INACTIVE = new Set([12, 35, 58, 79, 101, 133]);

function buildSubscribers(): Subscriber[] {
  const list: Subscriber[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const featured = FEATURED[i];
    const kind = KIND[Math.floor(i / NAME.length) % KIND.length];
    const tradeName = featured ? featured[1] : `${kind} ${NAME[(i * 5) % NAME.length]}`;
    const legalName = featured ? featured[0] : `${tradeName} Comércio de Alimentos Ltda`;
    const units = 2 + (i % 5 === 0 ? 1 : 0) + (i % 11 === 0 ? 1 : 0) + (i < 6 ? 3 : 0);
    const monthsAgo = 1 + ((i * 13) % 44);
    const since = new Date(Date.UTC(2026, 8 - monthsAgo, 1 + ((i * 5) % 27))).toISOString().slice(0, 10);
    const [city, uf, cepPrefix] = CITIES[i % CITIES.length];
    const domain = `${slug(tradeName).replace(/\./g, '')}.com.br`;
    const p = (k: number) => PEOPLE[(i * 3 + k) % PEOPLE.length];
    const phone = (k: number) => `48${9}${pad(8800_0000 + ((i * 7919 + k * 131) % 9999_999), 8)}`;
    const status: SubscriberStatus = OVERDUE.has(i) ? 'inadimplente' : INACTIVE.has(i) ? 'inativo' : 'ativo';
    const contacts: Contact[] = [
      { id: `C${i}-1`, area: 'responsavel', name: p(0), email: `${slug(p(0))}@${domain}`, phone: phone(1) },
      { id: `C${i}-2`, area: 'financeiro', name: p(1), email: `financeiro@${domain}`, phone: phone(2) },
    ];
    if (i % 2 === 0) contacts.push({ id: `C${i}-3`, area: 'tecnico', name: p(2), email: `manutencao@${domain}`, phone: phone(3) });
    if (i % 3 === 0) contacts.push({ id: `C${i}-4`, area: 'comercial', name: p(3), email: `compras@${domain}`, phone: phone(4) });

    const envHistory: EnvChange[] = [];
    if (status === 'inativo') {
      envHistory.push({
        at: new Date(Date.UTC(2026, 8, 2 + (i % 25), 13, 20)).toISOString(),
        by: 'Ana Paula Ribeiro', action: 'inativou',
        reason: i % 2 ? 'Contrato encerrado' : 'Inadimplência - sem retorno após 3 cobranças',
      });
    }

    list.push({
      id: `ASS-${pad(i + 1, 4)}`,
      cnpj: cnpjFrom(11_000_000 + i * 7919),
      legalName,
      tradeName,
      stateReg: i % 4 === 3 ? '' : `${pad(250_000_000 + i * 3701, 9)}`,
      cityReg: i % 3 === 2 ? '' : `${pad(400_000 + i * 113, 7)}`,
      address: {
        cep: `${cepPrefix}${pad((i * 37) % 100, 2)}${pad((i * 71) % 1000, 3)}`,
        street: STREETS[i % STREETS.length],
        number: String(100 + ((i * 47) % 1800)),
        complement: i % 3 === 0 ? `Sala ${100 + (i % 9)}` : '',
        district: DISTRICTS[i % DISTRICTS.length],
        city, uf,
      },
      contractedUnits: String(units + (i % 4 === 0 ? 1 : 0)),
      contacts,
      plan: PLANS[i % 7 === 0 ? 3 : i % 5 === 0 ? 2 : i % 3 === 0 ? 1 : 0],
      status,
      admin: { name: p(0), email: `${slug(p(0))}@${domain}`, phone: phone(1) },
      since,
      units,
      equipments: units * 5 + (i % 4),
      maintenanceCents: units * 185_000 + ((i * 3719) % 240_000) * 10,
      requests30d: featured ? [64, 52, 47, 39, 33, 28][i] : 1 + ((i * 7) % 22),
      envHistory,
    });
  }
  // Totais coerentes com o protótipo v1: 342 unidades e 1.876 equipamentos.
  const unitDiff = 342 - list.reduce((s, x) => s + x.units, 0);
  for (let k = 0; k < Math.abs(unitDiff); k++) list[6 + (k % (TOTAL - 6))].units += Math.sign(unitDiff);
  const eqDiff = 1876 - list.reduce((s, x) => s + x.equipments, 0);
  for (let k = 0; k < Math.abs(eqDiff); k++) list[k % TOTAL].equipments += Math.sign(eqDiff);
  return list;
}

/** Usuários vinculados ao assinante (gestão é do próprio assinante - Assinante RF204). */
export function subscriberUsers(s: Subscriber): SubscriberUser[] {
  const n = Number(s.id.slice(-4));
  const domain = s.admin.email.split('@')[1] ?? 'empresa.com.br';
  const total = Math.min(4 + (n % 9), 14);
  // Assinante cadastrado no protótipo: só o administrador indicado, com convite pendente (RF202-FLU004).
  const isNew = n > TOTAL;
  const users: SubscriberUser[] = [{
    id: `${s.id}-U1`, name: s.admin.name, email: s.admin.email, profile: 'Administrador',
    status: isNew ? 'convite' : s.status === 'inativo' ? 'inativo' : 'ativo',
  }];
  if (isNew) return users;
  for (let k = 1; k < total; k++) {
    const name = PEOPLE[(n * 5 + k * 3) % PEOPLE.length];
    const status: SubscriberUserStatus = s.status === 'inativo' ? 'inativo' : k === total - 1 ? 'convite' : k % 6 === 5 ? 'inativo' : 'ativo';
    users.push({
      id: `${s.id}-U${k + 1}`, name, email: `${slug(name)}@${domain}`,
      profile: SUBSCRIBER_PROFILES[1 + (k % 3)], status,
    });
  }
  return users;
}
/** Usuários ativos = só quem tem conta no sistema (não conta solicitantes anônimos via QR - RF201). */
export const activeUsersCount = (s: Subscriber) => subscriberUsers(s).filter((u) => u.status === 'ativo').length;

const PROFILES: Profile[] = [
  { id: 'PER-ADM', name: 'Administrador', description: 'Acesso total. Recebe as notificações críticas (inativação de assinante e de usuário).', fixed: true, status: 'ativo', permissions: FULL_ACCESS },
  {
    id: 'PER-SUP', name: 'Suporte', description: 'Atendimento aos assinantes: consulta e atualiza cadastros, sem inativar ambientes.', status: 'ativo',
    permissions: { dashboard: ['visualizar'], assinantes: ['visualizar', 'editar'], usuarios: ['visualizar'], perfis: [], configuracoes: ['visualizar'] },
  },
  {
    id: 'PER-IMP', name: 'Implantação', description: 'Cadastro inicial de novos assinantes e carga das configurações.', status: 'ativo',
    permissions: { dashboard: ['visualizar'], assinantes: ['visualizar', 'cadastrar', 'editar'], usuarios: [], perfis: [], configuracoes: ['visualizar', 'cadastrar', 'editar', 'ativar'] },
  },
  {
    id: 'PER-FIN', name: 'Financeiro', description: 'Acompanha a carteira e a inadimplência; pode ativar e inativar ambientes.', status: 'ativo',
    permissions: { dashboard: ['visualizar'], assinantes: ['visualizar', 'editar', 'ativar'], usuarios: [], perfis: [], configuracoes: [] },
  },
  {
    id: 'PER-OPE', name: 'Operador (legado)', description: 'Perfil antigo, substituído por Suporte.', status: 'inativo',
    permissions: { dashboard: ['visualizar'], assinantes: ['visualizar'], usuarios: [], perfis: [], configuracoes: [] },
  },
];

const ADMIN_USERS: AdminUser[] = ([
  ['Ana Paula Ribeiro', 'PER-ADM', 'ativo'],
  ['Carlos Henrique Souza', 'PER-ADM', 'ativo'],
  ['Débora Lins', 'PER-SUP', 'ativo'],
  ['Eduardo Matos', 'PER-SUP', 'ativo'],
  ['Fabiana Quintino', 'PER-SUP', 'ativo'],
  ['Gabriel Torres', 'PER-IMP', 'ativo'],
  ['Helena Vasconcelos', 'PER-IMP', 'ativo'],
  ['Igor Nascimento', 'PER-FIN', 'ativo'],
  ['Joana Prado', 'PER-FIN', 'ativo'],
  ['Kleber Antunes', 'PER-SUP', 'inativo'],
  ['Letícia Fontes', 'PER-SUP', 'ativo'],
  ['Murilo Bastos', 'PER-IMP', 'inativo'],
] as Array<[string, string, RecordStatus]>).map(([name, profileId, status], i) => ({
  id: `USR-${pad(i + 1, 4)}`,
  name,
  email: `${slug(name).split('.').filter((_, k, a) => k === 0 || k === a.length - 1).join('.')}@maglev.com.br`,
  phone: `489${pad(9100_0000 + i * 431_77, 8)}`,
  profileId, status,
  createdAt: new Date(Date.UTC(2026, 4 + (i % 4), 3 + i * 2)).toISOString().slice(0, 10),
}));

const cfg = (prefix: string, rows: Array<[string, string, number, RecordStatus?]>): ConfigItem[] =>
  rows.map(([name, description, links, status], i) => ({ id: `${prefix}-${pad(i + 1, 3)}`, name, description, links, status: status ?? 'ativo' }));

/** DADOS DE DEMONSTRAÇÃO - ícone de cada categoria de exemplo (ids do icon-catalog.ts). */
const CATEGORY_ICONS: Record<string, string> = {
  Refrigeração: 'frio', Cocção: 'calor', Exaustão: 'ventilador', Lavagem: 'lavagem', 'Produção de gelo': 'gelo',
  Climatização: 'ar-condicionado', Panificação: 'paes', Bebidas: 'bebidas',
};
const CATEGORIES = cfg('CAT', [
  ['Refrigeração', 'Câmaras frias, refrigeradores, freezers, balcões e mesas refrigeradas', 612],
  ['Cocção', 'Fornos, fogões, chapas, fritadeiras e salamandras', 488],
  ['Exaustão', 'Coifas, exaustores e dutos', 173],
  ['Lavagem', 'Lava-louças e lava-panelas', 141],
  ['Produção de gelo', 'Máquinas de gelo', 96],
  ['Climatização', 'Ar-condicionado do salão e da cozinha', 214],
  ['Panificação', 'Masseiras, cilindros e modeladoras', 0, 'inativo'],
  ['Bebidas', 'Chopeiras e refrigeradores de bebidas', 0],
]).map((c) => ({ ...c, icon: CATEGORY_ICONS[c.name] }));
const REQUEST_TYPES = cfg('TSO', [
  ['Não liga', 'O equipamento não liga ou desliga sozinho', 211],
  ['Não refrigera', 'Temperatura acima do esperado em equipamento de refrigeração', 186],
  ['Não aquece', 'Equipamento de cocção não atinge a temperatura', 97],
  ['Vazamento', 'Vazamento de água, gás ou fluido', 74],
  ['Ruído anormal', 'Barulho diferente do habitual durante o funcionamento', 58],
  ['Elétrica', 'Disjuntor desarmando, fiação ou tomada com problema', 66],
  ['Quebra física', 'Peça quebrada, porta, puxador ou vedação danificada', 43],
  ['Outro', 'Problema que não se encaixa nos tipos acima', 31],
  ['Gás', 'Cheiro de gás (substituído por Vazamento)', 12, 'inativo'],
]);
const MAINTENANCE_TYPES = cfg('TMA', [
  ['Corretiva não planejada', 'Falha que exige atendimento sem programação prévia', 534],
  ['Corretiva planejada', 'Correção agendada a partir de um problema conhecido', 128],
  ['Preventiva', 'Atribuído automaticamente às OS geradas por plano de preventiva', 862],
  ['Inspeção', 'Verificação técnica sem intervenção', 47],
  ['Instalação', 'Instalação ou reinstalação de equipamento', 0],
]);
const PRIORITIES: LevelItem[] = [
  { id: 'PRI-1', level: '1', name: 'Emergência', description: 'Parada total de equipamento essencial; atendimento imediato', visual: 'critico', links: 38 },
  { id: 'PRI-2', level: '2', name: 'Alta', description: 'Impacto relevante na operação', visual: 'atencao', links: 126 },
  { id: 'PRI-3', level: '3', name: 'Média', description: 'Operação segue com degradação', visual: 'informativo', links: 284 },
  { id: 'PRI-4', level: '4', name: 'Baixa', description: 'Alerta sem impacto imediato', visual: 'neutro', links: 197 },
];
const CRITICALITIES: LevelItem[] = [
  { id: 'CRI-A', level: 'A', name: 'A - Alta', description: 'Equipamento essencial para a operação e sem reserva', visual: 'critico', links: 523 },
  { id: 'CRI-B', level: 'B', name: 'B - Média', description: 'A operação continua, mas com restrição', visual: 'atencao', links: 811 },
  { id: 'CRI-C', level: 'C', name: 'C - Baixa', description: 'A parada não afeta a operação ou há equipamento reserva', visual: 'neutro', links: 542 },
];
/** Matriz de prioridade sugerida (RF405): criticidade × impacto operacional - fixa no MVP. */
export const PRIORITY_MATRIX: Array<{ criticality: string; cells: [string, string, string] }> = [
  { criticality: 'CRI-A', cells: ['PRI-1', 'PRI-2', 'PRI-3'] },
  { criticality: 'CRI-B', cells: ['PRI-2', 'PRI-3', 'PRI-4'] },
  { criticality: 'CRI-C', cells: ['PRI-3', 'PRI-4', 'PRI-4'] },
];
export const IMPACTS = ['Parada total', 'Degradação', 'Alerta'];

const st = (module: StatusModule, rows: Array<[string, Visual, BaseSituation, number, RecordStatus?]>, prefix: string): StatusItem[] =>
  rows.map(([name, visual, base, links, status], i) => ({ id: `${prefix}-${pad(i + 1, 2)}`, module, name, visual, base, order: i + 1, links, status: status ?? 'ativo' }));
const STATUSES: StatusItem[] = [
  ...st('equipamento', [
    ['Em funcionamento', 'sucesso', 'concluido', 1602],
    ['Com alerta/falha', 'atencao', 'aberto', 96],
    ['Parado', 'critico', 'aberto', 41],
    ['Em manutenção', 'informativo', 'andamento', 74],
    ['Inativo', 'neutro', 'cancelado', 63],
  ], 'STE'),
  ...st('solicitacao', [
    ['Nova', 'neutro', 'aberto', 9],
    ['Em triagem', 'informativo', 'andamento', 6],
    ['Aguardando informação', 'atencao', 'aguardando', 4],
    ['Aprovada', 'informativo', 'andamento', 3],
    ['Convertida em OS', 'sucesso', 'concluido', 1204],
    ['Recusada', 'neutro', 'cancelado', 88],
    ['Concluída sem OS', 'sucesso', 'concluido', 312],
  ], 'STS'),
  ...st('os', [
    ['Aberta', 'neutro', 'aberto', 4],
    ['Em andamento', 'informativo', 'andamento', 5],
    ['Aguardando orçamento', 'atencao', 'aguardando', 2],
    ['Aguardando aprovação', 'atencao', 'aguardando', 2],
    ['Aguardando peça/recurso', 'atencao', 'aguardando', 3],
    ['Aguardando prestador', 'atencao', 'aguardando', 2],
    ['Aguardando validação', 'informativo', 'aguardando', 2],
    ['Concluída', 'sucesso', 'concluido', 1980],
    ['Cancelada', 'neutro', 'cancelado', 117],
  ], 'STO'),
];

/** Chamados em aberto (solicitações não encerradas e OS não concluídas/canceladas) de todos os assinantes. */
function buildTickets(subscribers: Subscriber[]): Ticket[] {
  const open = subscribers.filter((s) => s.status !== 'inativo');
  const units = ['Unidade Centro', 'Unidade Beira-Mar', 'Cozinha central', 'Unidade Trindade', 'Unidade Shopping', 'Unidade Norte', 'Unidade Aeroporto'];
  const equipments = [
    'Câmara fria 02', 'Mesa refrigerada 04', 'Forno combinado 01', 'Ultracongelador 01', 'Forno de pizza 01', 'Chapa 01',
    'Balcão refrigerado 02', 'Coifa 01', 'Lava-louças 01', 'Refrigerador de bebidas 03', 'Câmara fria 01', 'Fritadeira 02',
    'Máquina de gelo 01', 'Freezer 01', 'Fogão industrial 02', 'Salamandra 01', 'Estufa 01',
  ];
  const solStatus = ['STS-01', 'STS-02', 'STS-03', 'STS-04'];
  const osStatus = ['STO-01', 'STO-02', 'STO-03', 'STO-04', 'STO-05', 'STO-06', 'STO-07'];
  // [tipo, assinante (índice), prioridade, criticidade, horas]
  const fixed: Array<[TicketType, number, string, string, number]> = [
    ['os', 0, 'PRI-1', 'CRI-A', 3], ['solicitacao', 1, 'PRI-1', 'CRI-A', 5], ['os', 5, 'PRI-2', 'CRI-A', 30],
    ['solicitacao', 2, 'PRI-1', 'CRI-A', 52], ['os', 3, 'PRI-2', 'CRI-B', 100], ['solicitacao', 4, 'PRI-2', 'CRI-B', 8],
    ['os', 1, 'PRI-3', 'CRI-B', 70], ['solicitacao', 5, 'PRI-3', 'CRI-A', 2], ['os', 0, 'PRI-3', 'CRI-C', 6],
    ['solicitacao', 3, 'PRI-4', 'CRI-C', 10], ['solicitacao', 1, 'PRI-2', 'CRI-B', 20], ['os', 4, 'PRI-3', 'CRI-B', 26],
    ['solicitacao', 2, 'PRI-4', 'CRI-C', 40], ['os', 5, 'PRI-3', 'CRI-B', 48], ['solicitacao', 0, 'PRI-3', 'CRI-C', 60],
    ['os', 3, 'PRI-4', 'CRI-B', 80], ['solicitacao', 4, 'PRI-4', 'CRI-C', 96], ['os', 1, 'PRI-4', 'CRI-C', 120],
    ['solicitacao', 2, 'PRI-3', 'CRI-C', 150], ['os', 4, 'PRI-2', 'CRI-A', 220], ['solicitacao', 0, 'PRI-3', 'CRI-B', 300],
    ['solicitacao', 2, 'PRI-2', 'CRI-B', 250],
  ];
  for (let i = 0; i < 18; i++) {
    fixed.push([i % 3 === 1 ? 'os' : 'solicitacao', 6 + ((i * 11) % (open.length - 6)), i % 3 === 0 ? 'PRI-3' : 'PRI-4', i % 4 === 0 ? 'CRI-B' : 'CRI-C', 180 + i * 26]);
  }
  return fixed.map(([type, si, priorityId, criticalityId, hoursAgo], i) => ({
    id: `${type === 'os' ? 'OS' : 'SOL'}-${pad(2000 + i * 7, 5)}`,
    type,
    subscriberId: open[si].id,
    unit: units[(i * 3) % units.length],
    equipment: equipments[i % equipments.length],
    priorityId, criticalityId,
    statusId: type === 'os' ? osStatus[i % osStatus.length] : solStatus[i % solStatus.length],
    hoursAgo,
  }));
}

export interface Db {
  version: number;
  subscribers: Subscriber[];
  adminUsers: AdminUser[];
  /** Histórico de ações dos usuários do Admin (ver `Activity`). */
  activity: Activity[];
  profiles: Profile[];
  categories: ConfigItem[];
  requestTypes: ConfigItem[];
  maintenanceTypes: ConfigItem[];
  priorities: LevelItem[];
  criticalities: LevelItem[];
  statuses: StatusItem[];
  tickets: Ticket[];
  /** Planos de preventiva existentes (dado agregado da área do assinante). */
  preventivePlans: number;
}

/**
 * DADOS DE DEMONSTRAÇÃO - referência dos KPIs de Assinantes (RF201): há 7 dias.
 * Ativos e inadimplentes: quantidade de uma semana atrás. Gasto: custos realizados das OS nos últimos 7 dias
 * (o valor de há 7 dias é o total atual menos isso).
 */
export const KPI_HISTORY = { activeWeekAgo: 125, overdueWeekAgo: 5, spent7dCents: 4_832_000 };

export const DB_VERSION = 8;

/**
 * DADOS DE DEMONSTRAÇÃO - histórico de ações de cada usuário do Admin, depois do próprio cadastro.
 * Carlos Henrique Souza (USR-0002) tem um histórico longo (mais de 10 registros, paginação).
 */
function buildActivity(users: AdminUser[], subs: Subscriber[]): Activity[] {
  const out: Activity[] = [];
  users.forEach((u, i) => {
    const total = i === 1 ? 24 : 3 + ((i * 5) % 9);
    for (let n = 0; n < total; n++) {
      const sub = subscriberName(subs[(i * 7 + n * 5) % subs.length]);
      const other = users[(i + n + 1) % users.length].name;
      const status = ['Ativo', 'Inadimplente'][n % 2];
      const templates: Array<[ActivityModule, ActivityKind, string]> = [
        ['Assinantes', 'cadastro', `Cadastrou o assinante ${sub}`],
        ['Assinantes', 'edicao', `Editou os dados do assinante ${sub}`],
        ['Assinantes', 'edicao', `Alterou o status do assinante ${sub} para ${status}`],
        ['Assinantes', 'inativacao', `Inativou o ambiente do assinante ${sub}`],
        ['Assinantes', 'ativacao', `Ativou o ambiente do assinante ${sub}`],
        ['Usuários', 'cadastro', `Cadastrou o usuário ${other}`],
        ['Usuários', 'inativacao', `Inativou o usuário ${other}`],
        ['Perfis de acesso', 'edicao', `Editou o perfil ${PROFILES[n % PROFILES.length].name}`],
        ['Configurações', 'cadastro', `Cadastrou a categoria ${CATEGORIES[n % CATEGORIES.length].name}`],
        ['Configurações', 'edicao', `Editou o status ${STATUSES[n % STATUSES.length].name}`],
      ];
      const [module, kind, action] = templates[(n * 3 + i) % templates.length];
      const d = new Date(`${u.createdAt}T${pad(8 + ((n * 5 + i) % 10), 2)}:${pad((n * 17 + i * 7) % 60, 2)}:00Z`);
      d.setUTCDate(d.getUTCDate() + 2 + n * 6 + (i % 4));
      if (d.getTime() > Date.UTC(2026, 9, 1)) continue;
      out.push({ id: `ACT-${pad(i + 1, 2)}-${pad(n + 1, 3)}`, at: d.toISOString(), userId: u.id, module, kind, action });
    }
  });
  return out;
}

export function seed(): Db {
  const subscribers = buildSubscribers();
  return {
    version: DB_VERSION,
    subscribers,
    adminUsers: ADMIN_USERS,
    activity: buildActivity(ADMIN_USERS, subscribers),
    profiles: PROFILES,
    categories: CATEGORIES,
    requestTypes: REQUEST_TYPES,
    maintenanceTypes: MAINTENANCE_TYPES,
    priorities: PRIORITIES,
    criticalities: CRITICALITIES,
    statuses: STATUSES,
    tickets: buildTickets(subscribers),
    preventivePlans: 214,
  };
}
