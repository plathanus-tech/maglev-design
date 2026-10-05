import { useCallback, useEffect, useState } from 'react';
import { ActionKey, Activity, ActivityKind, ActivityModule, AdminUser, DB_VERSION, Db, Profile, ScreenKey, seed } from './data';

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
  const entry: Activity = { id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), userId, module, kind, action };
  updateDb((db) => ({ ...db, activity: [...(db.activity ?? []), entry] }));
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
export const nowIso = () => new Date().toISOString();
