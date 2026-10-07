import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDb as useAdminDb } from '../../admin/shared/store';
import {
  ActionKey, DB_VERSION, Equipment, LogEntry, Notification, PERMISSIONS, ProfileKey, Request, ScreenKey, SubDb, SubUser, WorkOrder, nowLocal, seed,
} from './data';

/**
 * "Banco" da área do assinante: carga inicial + alterações feitas nas telas, em localStorage (chave própria,
 * separada do Admin). Cadastrar/editar numa tela reflete em todas. "Restaurar dados de demonstração" do
 * Navegador de Protótipo chama `resetSubDb` (e o `resetDb` do Admin).
 * Configurações globais (status, prioridades, criticidades, categorias, tipos) vêm do Admin: `useAdminDb()`.
 */
const DB_KEY = 'maglev.v2.sub.db';
const SESSION_KEY = 'maglev.v2.sub.session';
const EVENT = 'maglev-sub-db';

let cache: SubDb | null = null;

export function getSubDb(): SubDb {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    const parsed = raw ? (JSON.parse(raw) as SubDb) : null;
    cache = parsed && parsed.version === DB_VERSION ? parsed : seed();
  } catch { cache = seed(); }
  return cache;
}

export function setSubDb(next: SubDb) {
  cache = next;
  try { localStorage.setItem(DB_KEY, JSON.stringify(next)); } catch { /* sem storage */ }
  window.dispatchEvent(new Event(EVENT));
}
export const updateSubDb = (fn: (db: SubDb) => SubDb) => setSubDb(fn(getSubDb()));

export function resetSubDb() {
  cache = null;
  try { localStorage.removeItem(DB_KEY); localStorage.removeItem(SESSION_KEY); } catch { /* sem storage */ }
  window.dispatchEvent(new Event(EVENT));
}

window.addEventListener('storage', (e) => {
  if (e.key === DB_KEY || e.key === null) { cache = null; window.dispatchEvent(new Event(EVENT)); }
});

export function useSubDb(): SubDb {
  const [db, set] = useState(getSubDb);
  useEffect(() => {
    const on = () => set(getSubDb());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return db;
}

// ─── Sessão (usuário logado do assinante) ─────────────────────────
const DEFAULT_USER = (db: SubDb) => db.users.find((u) => u.profile === 'administrador' && u.status === 'ativo') ?? db.users[0];
/** Protótipo: `?as=<id do usuário>` abre a tela como outro usuário/perfil, só naquela página (não altera a sessão salva). */
const AS_OVERRIDE = new URLSearchParams(location.search).get('as');

export const setSubSessionUser = (id: string) => { try { localStorage.setItem(SESSION_KEY, id); } catch { /* sem storage */ } };

export function getSubSessionUser(db = getSubDb()): SubUser {
  let id: string | null = null;
  try { id = AS_OVERRIDE ?? localStorage.getItem(SESSION_KEY); } catch { /* sem storage */ }
  return db.users.find((u) => u.id === id) ?? DEFAULT_USER(db);
}

/** Id do usuário do assinante por perfil - para variantes do navegador (`?as=`). */
export const userIdOf = (profile: ProfileKey, db = getSubDb()) => db.users.find((u) => u.profile === profile && u.status === 'ativo')?.id ?? db.users[0].id;

/**
 * Sessão + permissões (VISÃO GERAL §6, RF204-RGN001): `can(tela, ação)` oculta/bloqueia o que o perfil não pode;
 * `unitIds` = unidades visíveis (Solicitante/Gestor da unidade e Executor veem só as vinculadas - RF101-RGN002);
 * `canSeeCosts` = valor de aquisição e custos só para Administrador e Gestor (RF304-RGN003).
 */
export function useSubSession() {
  const db = useSubDb();
  const admin = useAdminDb();
  const user = getSubSessionUser(db);
  const can = useCallback((screen: ScreenKey, action: ActionKey = 'visualizar') => !!PERMISSIONS[user.profile][screen]?.includes(action), [user.profile]);
  const scoped = user.profile === 'solicitante' || user.profile === 'executor';
  const unitIds = useMemo(() => (scoped ? user.unitIds : db.units.map((u) => u.id)), [scoped, user.unitIds, db.units]);
  const canSeeCosts = user.profile === 'administrador' || user.profile === 'gestor';
  const company = admin.subscribers.find((s) => s.id === db.subscriberId)!;
  return { db, admin, user, can, scoped, unitIds, canSeeCosts, company };
}

// ─── Ajudantes de leitura (usados por várias telas) ─────────────────
export const equipmentOf = (db: SubDb, id: string): Equipment | undefined => db.equipments.find((e) => e.id === id);
export const unitName = (db: SubDb, unitId: string) => db.units.find((u) => u.id === unitId)?.name ?? '-';
export const environmentName = (db: SubDb, envId: string) => db.environments.find((e) => e.id === envId)?.name ?? '-';
export const userName = (db: SubDb, id?: string) => (id ? db.users.find((u) => u.id === id)?.name ?? '-' : '-');
/** Unidade da solicitação/OS vem do equipamento. */
export const unitIdOfEquipment = (db: SubDb, equipmentId: string) => equipmentOf(db, equipmentId)?.unitId ?? '';
export const requestsVisible = (db: SubDb, unitIds: string[]): Request[] => db.requests.filter((r) => unitIds.includes(unitIdOfEquipment(db, r.equipmentId)));
export const ordersVisible = (db: SubDb, unitIds: string[], userId?: string, executorOnly = false): WorkOrder[] =>
  db.orders.filter((o) => unitIds.includes(unitIdOfEquipment(db, o.equipmentId)) && (!executorOnly || (o.executor.kind === 'interno' && o.executor.userId === userId)));

// ─── Escrita (ids sequenciais e registro) ───────────────────────────
export const nextSeq = (prefix: string, ids: string[], pad = 6) => {
  const max = ids.reduce((m, id) => Math.max(m, Number(id.replace(/\D/g, '')) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(pad, '0')}`;
};
export const nextShortId = (prefix: string, ids: string[]) => nextSeq(prefix, ids, 4);
export const logEntry = (by: string, text: string): LogEntry => ({ id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: nowLocal(), by, text });

/** Notifica quem está ligado ao item (RF801-RGN001): cria a notificação na central de cada destinatário. */
export function notify(userIds: string[], n: Omit<Notification, 'id' | 'userId' | 'at' | 'read'>) {
  const unique = [...new Set(userIds.filter(Boolean))];
  updateSubDb((db) => ({
    ...db,
    notifications: [
      ...db.notifications,
      ...unique.filter((id) => db.users.some((u) => u.id === id)).map((userId): Notification => ({ ...n, id: `NOT-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, userId, at: nowLocal(), read: false })),
    ],
  }));
}
