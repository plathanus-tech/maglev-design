import type { AccessSession, AdminUser } from './data';

/**
 * Acessos e sessões dos usuários do Admin (complemento aos controles de sessão da auditoria). Cada login gera um registro com
 * dispositivo e horário; o sistema marca alertas pelos eventos da política de segurança e o administrador reconhece e encerra a sessão.
 * Sem geolocalização precisa nem vigilância contínua: só o momento do acesso e o dispositivo (lidos do navegador); a região é no máximo aproximada.
 */
export type AccessAlert = 'novo-dispositivo' | 'contexto-inesperado' | 'tentativas-falhas';
export const ACCESS_ALERTS: Record<AccessAlert, { label: string; text: string }> = {
  'novo-dispositivo': { label: 'Novo dispositivo', text: 'Primeiro acesso deste usuário a partir deste dispositivo' },
  'contexto-inesperado': { label: 'Contexto inesperado', text: 'Região ou rede diferente do habitual do usuário' },
  'tentativas-falhas': { label: 'Tentativas de senha falhas', text: 'Várias tentativas de senha incorretas antes do acesso' },
};

/**
 * Não há limite de horário de acesso (a regra de “horário atípico” foi retirada). Três tentativas de senha incorretas seguidas antes de um acesso bem-sucedido geram alerta.
 */
export const ACCESS_POLICY = { failedAttempts: 3 };

/** Dispositivo legível a partir do navegador: “Chrome · Windows”. */
export function deviceLabel(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Sistema desconhecido';
  return `${browser} · ${os}`;
}

const DEVICES = ['Chrome · Windows', 'Edge · Windows', 'Safari · macOS', 'Chrome · Android'];

/** DADOS DE DEMONSTRAÇÃO - acessos recentes dos usuários ativos, com alguns alertas pendentes para ver a resposta do administrador. */
export function seedAccessSessions(users: AdminUser[]): AccessSession[] {
  const out: AccessSession[] = [];
  const iso = (day: number, h: number, m: number) => new Date(Date.UTC(2026, 9, day, h + 3, m)).toISOString();
  users.filter((u) => u.status === 'ativo').forEach((u, i) => {
    const device = DEVICES[i % DEVICES.length];
    [20, 22, 24].forEach((day, k) => out.push({ id: `ACS-${u.id}-${k + 1}`, userId: u.id, at: iso(day - (i % 2), 8 + ((i + k) % 3), 10 + k * 13), device, alerts: [], status: 'expirada' }));
  });
  const put = (userId: string, s: Omit<AccessSession, 'id' | 'userId'>) => out.push({ id: `ACS-${userId}-A`, userId, ...s });
  put('USR-0001', { at: iso(26, 8, 12), device: 'Chrome · Windows', alerts: [], status: 'ativa' });
  put('USR-0003', { at: iso(25, 9, 40), device: 'Safari · iPhone', alerts: ['novo-dispositivo'], status: 'ativa' });
  put('USR-0005', { at: iso(26, 2, 14), device: 'Chrome · Android', region: 'Região diferente do habitual', alerts: ['contexto-inesperado'], status: 'ativa' });
  put('USR-0006', { at: iso(25, 21, 30), device: 'Firefox · Linux', alerts: ['tentativas-falhas', 'novo-dispositivo'], status: 'ativa' });
  put('USR-0002', { at: iso(23, 23, 5), device: 'Edge · Windows', alerts: ['novo-dispositivo'], status: 'encerrada', endedAt: iso(24, 8, 30), endedBy: 'USR-0001', passwordReset: true, reviewed: true });
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
