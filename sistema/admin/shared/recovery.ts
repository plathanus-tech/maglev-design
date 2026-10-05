/** Recuperação de senha (RF002): e-mail compartilhado entre as telas do fluxo e senha do protótipo. */
const KEY = 'maglev.v2.recovery.email';

export const getRecoveryEmail = (): string => {
  try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; }
};
export const setRecoveryEmail = (email: string) => {
  try { sessionStorage.setItem(KEY, email); } catch { /* sem storage */ }
};
export const clearRecoveryEmail = () => {
  try { sessionStorage.removeItem(KEY); } catch { /* sem storage */ }
};

/**
 * Anonimiza o e-mail para exibição, mas reconhecível para quem o digitou: 3 primeiros e último
 * caractere do usuário e 2 primeiros do domínio, com quantidade fixa de asteriscos
 * (ex.: ana.ribeiro@maglev.com.br → ana****o@ma****.com.br).
 */
export const maskEmail = (email: string) => {
  const [user = '', domain = ''] = email.trim().split('@');
  const [host = '', ...ext] = domain.split('.');
  const maskedUser = user.length > 4 ? `${user.slice(0, 3)}****${user.slice(-1)}` : `${user.slice(0, 1)}****`;
  if (!host) return maskedUser;
  return `${maskedUser}@${host.slice(0, 2)}****${ext.length ? `.${ext.join('.')}` : ''}`;
};

/** Protótipo: senha aceita no login (a padrão ou a criada na recuperação de senha). */
const PWD_KEY = 'maglev.v2.prototype.password';
export const DEFAULT_PASSWORD = 'Maglev@123';
export const getPrototypePassword = (): string => {
  try { return sessionStorage.getItem(PWD_KEY) ?? DEFAULT_PASSWORD; } catch { return DEFAULT_PASSWORD; }
};
export const setPrototypePassword = (password: string) => {
  try { sessionStorage.setItem(PWD_KEY, password); } catch { /* sem storage */ }
};

/** Política de senha (RF002-RGN003 / RNF019): 8+ caracteres, maiúscula, minúscula e especial. */
export const PASSWORD_CRITERIA = [
  { id: 'length', label: 'Pelo menos 8 caracteres', test: (v: string) => v.length >= 8 },
  { id: 'upper', label: 'Uma letra maiúscula', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'Uma letra minúscula', test: (v: string) => /[a-z]/.test(v) },
  { id: 'special', label: 'Um caractere especial', test: (v: string) => /[^A-Za-z0-9\s]/.test(v) },
];
