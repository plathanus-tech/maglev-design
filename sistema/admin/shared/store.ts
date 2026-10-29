import { useCallback, useEffect, useState } from 'react';
import { SUSPENSION_GRACE_DAYS, AccessSession, ActionKey, Activity, ActivityKind, ActivityModule, AdminUser, DB_VERSION, Db, Profile, ScreenKey, Subscriber, seed, subscriberName } from './data';
import { addDaysIso } from './format';
import { AccessAlert, deviceLabel, ACCESS_POLICY } from './access-security';
import { QrReason, RegEquipment, currentQr, qrReasonLabel, tokenFor } from './qr-registry';
import { clockNow, clockIso, todayIso } from './clock';

/**
 * "Banco" do protótipo: carga inicial + alterações feitas nas telas, salvos em localStorage.
 * Assim, cadastrar/editar/inativar numa tela reflete nas demais (listagem, detalhe, dashboard).
 * O Navegador de Protótipo tem "Restaurar dados de demonstração" (resetDb).
 */
const DB_KEY = 'maglev.v2.db';
const SESSION_KEY = 'maglev.v2.session';
const EVENT = 'maglev-db';

let cache: Db | null = null;

export function getDb(): Db {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    const parsed = raw ? (JSON.parse(raw) as Db) : null;
    cache = parsed && parsed.version === DB_VERSION ? parsed : seed();
  } catch { cache = seed(); }
  return cache;
}

export function setDb(next: Db) {
  cache = next;
  try { localStorage.setItem(DB_KEY, JSON.stringify(next)); } catch { /* sem storage */ }
  window.dispatchEvent(new Event(EVENT));
}

export function updateDb(fn: (db: Db) => Db) { setDb(fn(getDb())); }

/** Registra no histórico de ações o que o usuário logado acabou de fazer (aparece em Usuários > Histórico de ações). */
export function logActivity(userId: string, module: ActivityModule, kind: ActivityKind, action: string) {
  const entry: Activity = { id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: clockIso(), userId, module, kind, action };
  updateDb((db) => ({ ...db, activity: [...(db.activity ?? []), entry] }));
}

/** Reenvia o convite de primeiro acesso de um usuário do Admin com convite pendente (atualiza a data do envio e registra a ação). */
export function resendAdminInvite(actorId: string, user: AdminUser) {
  const today = todayIso();
  updateDb((db) => ({ ...db, adminUsers: db.adminUsers.map((u) => (u.id === user.id ? { ...u, invitedAt: today } : u)) }));
  logActivity(actorId, 'Usuários', 'edicao', `Reenviou o convite de acesso para ${user.name}`);
}

/**
 * Inativa o código QR atual de um equipamento do assinante, com motivo, e já gera o novo código (sem exclusão: o antigo
 * fica no histórico). Registra a ação do usuário do Admin. Devolve o novo código.
 */
export function inactivateQr(actorId: string, subscriber: Subscriber, equipment: RegEquipment, reason: QrReason, detail?: string): string {
  const db = getDb();
  const oldToken = currentQr(equipment, db.qrEvents).token;
  const newToken = tokenFor(`${subscriber.id}-${equipment.id}-${Date.now()}`);
  const at = clockIso();
  updateDb((d) => ({ ...d, qrEvents: [...d.qrEvents, { id: `QRE-${Date.now()}`, subscriberId: subscriber.id, equipmentId: equipment.id, at, byUserId: actorId, reason, detail: detail?.trim() || undefined, oldToken, newToken }] }));
  logActivity(actorId, 'Assinantes', 'inativacao', `Inativou o código QR do equipamento ${equipment.name} (${subscriberName(subscriber)}) e gerou um novo código. Motivo: ${qrReasonLabel(reason).toLowerCase()}`);
  return newToken;
}

/** Marca o assinante como inadimplente (manual) e abre o prazo de regularização antes da inativação do ambiente. */
export function markOverdue(actorId: string, subscriber: Subscriber) {
  const suspendAt = addDaysIso(SUSPENSION_GRACE_DAYS);
  updateDb((db) => ({ ...db, subscribers: db.subscribers.map((s) => (s.id === subscriber.id ? { ...s, status: 'inadimplente', overdueSince: addDaysIso(0), suspendAt } : s)) }));
  logActivity(actorId, 'Assinantes', 'edicao', `Marcou o assinante ${subscriberName(subscriber)} como inadimplente (inativação prevista para ${suspendAt.split('-').reverse().join('/')})`);
  return suspendAt;
}
/** Volta o assinante inadimplente para Ativo (regularizado): o aviso e o prazo deixam de valer. */
export function regularize(actorId: string, subscriber: Subscriber) {
  updateDb((db) => ({ ...db, subscribers: db.subscribers.map((s) => (s.id === subscriber.id ? { ...s, status: 'ativo', overdueSince: undefined, suspendAt: undefined } : s)) }));
  logActivity(actorId, 'Assinantes', 'edicao', `Marcou o assinante ${subscriberName(subscriber)} como ativo (regularizado)`);
}

/**
 * Registra o acesso (login) e detecta os eventos da política: novo dispositivo e tentativas de senha falhas antes do acesso.
 * “Novo dispositivo” = o usuário não tem esse dispositivo como confiável (reconhecido pelo administrador). Em desenvolvimento a confiança também depende do IP: IP diferente do reconhecido alerta de novo.
 * “Contexto inesperado” (rede/região) depende de dados do servidor e não é detectado no protótipo. Devolve os alertas gerados.
 */
export function recordAccess(user: AdminUser, failedAttempts = 0): AccessAlert[] {
  const db = getDb();
  const device = deviceLabel();
  const now = clockNow();
  const alerts: AccessAlert[] = [];
  const trusted = db.accessSessions.some((x) => x.userId === user.id && x.device === device && x.trusted);
  if (!trusted) alerts.push('novo-dispositivo');
  if (failedAttempts >= ACCESS_POLICY.failedAttempts) alerts.push('tentativas-falhas');
  const entry = { id: `ACS-${Date.now()}`, userId: user.id, at: now.toISOString(), device, alerts, status: 'ativa' as const, ...(trusted ? { trusted: true } : {}) };
  updateDb((d) => ({ ...d, accessSessions: [...d.accessSessions.map((x) => (x.userId === user.id && x.status === 'ativa' ? { ...x, status: 'expirada' as const } : x)), entry] }));
  return alerts;
}

/** Encerra uma sessão ativa de outro usuário (ação de resposta do administrador); com `passwordReset`, exige nova senha no próximo acesso. */
export function endSession(actorId: string, session: AccessSession, passwordReset: boolean) {
  const target = getDb().adminUsers.find((u) => u.id === session.userId);
  updateDb((d) => ({
    ...d,
    // Encerrar a sessão retira a confiança do dispositivo: o próximo login dele alerta de novo
    accessSessions: d.accessSessions.map((x) => (x.userId === session.userId && x.device === session.device ? { ...x, trusted: false } : x)).map((x) => (x.id === session.id ? { ...x, status: 'encerrada' as const, endedAt: clockIso(), endedBy: actorId, passwordReset, reviewed: true } : x)),
    adminUsers: passwordReset ? d.adminUsers.map((u) => (u.id === session.userId ? { ...u, mustReset: true } : u)) : d.adminUsers,
  }));
  logActivity(actorId, 'Usuários', 'edicao', `Encerrou a sessão de ${target?.name ?? 'um usuário'}${passwordReset ? ' e pediu nova senha' : ''}`);
}

/** O administrador reconheceu o acesso: o alerta some da notificação e o dispositivo passa a ser confiável para esse usuário (não alerta mais). */
export function markAccessReviewed(id: string) {
  updateDb((d) => {
    const s = d.accessSessions.find((x) => x.id === id);
    return { ...d, accessSessions: d.accessSessions.map((x) => (x.id === id || (s && x.userId === s.userId && x.device === s.device) ? { ...x, trusted: true, ...(x.id === id ? { reviewed: true } : {}) } : x)) };
  });
}

export function resetDb() {
  cache = null;
  try { localStorage.removeItem(DB_KEY); localStorage.removeItem(SESSION_KEY); } catch { /* sem storage */ }
  window.dispatchEvent(new Event(EVENT));
}

window.addEventListener('storage', (e) => {
  if (e.key === DB_KEY || e.key === null) { cache = null; window.dispatchEvent(new Event(EVENT)); }
});

export function useDb(): Db {
  const [db, set] = useState(getDb);
  useEffect(() => {
    const on = () => set(getDb());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return db;
}

// ─── Sessão (usuário logado) ───────────────────────────────────────
const DEFAULT_USER = 'USR-0001';

/**
 * Protótipo: `?as=USR-0003` abre a tela como outro usuário (para ver as permissões de outro perfil),
 * só naquela página - não altera a sessão salva (as miniaturas do navegador também abrem essas URLs).
 */
const AS_OVERRIDE = new URLSearchParams(location.search).get('as');

export const setSessionUser = (id: string) => { try { localStorage.setItem(SESSION_KEY, id); } catch { /* sem storage */ } };

export function getSessionUser(db = getDb()): AdminUser {
  let id = DEFAULT_USER;
  try { id = AS_OVERRIDE ?? localStorage.getItem(SESSION_KEY) ?? DEFAULT_USER; } catch { /* sem storage */ }
  return db.adminUsers.find((u) => u.id === id) ?? db.adminUsers[0];
}

export function profileOf(user: AdminUser, db = getDb()): Profile | undefined {
  return db.profiles.find((p) => p.id === user.profileId);
}

/** Permissão do usuário logado (RF303-FLU005: cada tela/ação oculta ou bloqueia o que não é permitido). */
export function useSession() {
  const db = useDb();
  const user = getSessionUser(db);
  const profile = profileOf(user, db);
  const can = useCallback(
    (screen: ScreenKey, action: ActionKey = 'visualizar') => !!profile?.permissions[screen]?.includes(action),
    [profile],
  );
  return { db, user, profile, can };
}

export const nextId = (prefix: string, ids: string[]) => {
  const max = ids.reduce((m, id) => Math.max(m, Number(id.replace(/\D/g, '')) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
};

/** Registro de quem fez o quê (RNF011 / RF301-RGN004) - o feed por usuário é ZC004 e não entra. */
export const nowIso = () => clockIso();
