import { Provider, SubDb, Technician } from '../../assinante/shared/data';
import { onlyDigits } from '../../admin/shared/format';

/**
 * Acesso do Prestador de serviço por celular + código (OTP). O link recebido por e-mail/WhatsApp só identifica o prestador (`?p=`) e,
 * se individual, o técnico (`?tec=`); para abrir qualquer tela a pessoa confirma o celular cadastrado e digita o código enviado por SMS.
 * A sessão vale `SESSION_HOURS`: depois disso o código é pedido de novo (confirma que é a pessoa certa, mesmo com o link encaminhado).
 * 💡 A confirmar com o cliente: duração da sessão (12 h), canal (SMS; WhatsApp depois da homologação) e limites de tentativas.
 */
export const SESSION_HOURS = 12;
export const OTP_CODE = '111111';             // protótipo: único código aceito
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_EXPIRY_SECONDS = 300;        // validade do código: 5 min
export const OTP_RESEND_SECONDS = 30;         // intervalo mínimo entre reenvios

const SESSION_KEY = 'maglev.v2.prestador.session';
const PENDING_KEY = 'maglev.v2.prestador.otp';

export interface ProviderSession { providerId: string; technicianId?: string; verifiedAt: number }
export interface PendingOtp { phone: string; next?: string; p?: string }

const read = <T,>(store: Storage, key: string): T | null => { try { const v = store.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };

/** Sessão válida (dentro do prazo) ou null; `expired` indica que havia uma sessão e ela venceu. */
export function readSession(): { session: ProviderSession | null; expired: boolean } {
  const s = read<ProviderSession>(localStorage, SESSION_KEY);
  if (!s) return { session: null, expired: false };
  if (Date.now() - s.verifiedAt > SESSION_HOURS * 3_600_000) return { session: null, expired: true };
  return { session: s, expired: false };
}
export const startSession = (s: Omit<ProviderSession, 'verifiedAt'>) => { try { localStorage.setItem(SESSION_KEY, JSON.stringify({ ...s, verifiedAt: Date.now() })); } catch { /* sem storage */ } };
export const endSession = () => { try { localStorage.removeItem(SESSION_KEY); } catch { /* sem storage */ } };

export const getPending = (): PendingOtp | null => read<PendingOtp>(sessionStorage, PENDING_KEY);
export const setPending = (p: PendingOtp) => { try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { /* sem storage */ } };
export const clearPending = () => { try { sessionStorage.removeItem(PENDING_KEY); } catch { /* sem storage */ } };

/** Só vale destino relativo dentro da área do prestador (nunca URL externa). */
export const safeNext = (next?: string | null) => (next && /^[a-z0-9-]+\.html(\?[^#]*)?$/i.test(next) ? next : undefined);

const norm = (v: string) => onlyDigits(v).replace(/^55(?=\d{10,11}$)/, '');

export interface Identity { provider: Provider; technician?: Technician }
/** Quem é dono do celular: contato do prestador ou técnico dele. Com `providerId` (link), o celular precisa ser desse prestador. */
export function identifyByPhone(db: SubDb, phone: string, providerId?: string): Identity | null {
  const n = norm(phone);
  if (n.length < 10) return null;
  for (const provider of db.providers) {
    if (providerId && provider.id !== providerId) continue;
    const technician = provider.technicians.find((t) => norm(t.phone) === n);
    if (technician) return { provider, technician };
    if (provider.contacts.some((c) => norm(c.phone) === n)) return { provider };
  }
  return null;
}

export const acessoUrl = (next: string, expired: boolean) => `acesso.html?next=${encodeURIComponent(next)}${expired ? '#state=expired' : ''}`;
