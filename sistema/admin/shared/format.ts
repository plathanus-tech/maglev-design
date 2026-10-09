/** Formatação, máscaras e validações usadas nas telas (pt-BR, RNF017). */

export const onlyDigits = (v: string) => v.replace(/\D/g, '');

export const formatCnpj = (v: string) => {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

/** CNPJ válido: 14 dígitos, não repetidos, com dígitos verificadores corretos. */
export function isValidCnpj(v: string) {
  const d = onlyDigits(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = d.slice(0, len).split('').reduce((s, n, i) => s + Number(n) * w[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export const formatCep = (v: string) => onlyDigits(v).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');

/** Máscara de valor em reais enquanto digita: os dígitos entram como centavos (1380 → 13,80; 138000 → 1.380,00). */
export const maskMoney = (v: string) => {
  const digits = v.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  return (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatPhone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
/** Anonimiza o telefone para listagens: mantém o DDD e os 4 últimos dígitos (ex.: (48) *****-6354). */
export const maskPhone = (v: string) => {
  const d = onlyDigits(v);
  if (d.length < 6) return '*****';
  return `(${d.slice(0, 2)}) ${'*'.repeat(d.length - 6)}-${d.slice(-4)}`;
};
export const isValidPhone = (v: string) => onlyDigits(v).length >= 10;

export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
/** Admin: somente e-mails corporativos (RF001-RGN005, RF302-RGN003, RNF021). */
export const CORPORATE_DOMAIN = '@maglev.com.br';
export const isCorporateEmail = (v: string) => v.trim().toLowerCase().endsWith(CORPORATE_DOMAIN);

export const requiredMessage = (field: string) => `O campo ${field} é obrigatório`;

export const formatMoney = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Valor abreviado (mil, mi, bi) no formato brasileiro, ex.: R$ 2,21 mi. Abaixo de mil devolve o valor completo. */
export const formatMoneyCompact = (cents: number) => {
  const v = Math.abs(cents / 100);
  const [div, suffix] = v >= 1e9 ? [1e9, 'bi'] : v >= 1e6 ? [1e6, 'mi'] : v >= 1e3 ? [1e3, 'mil'] : [1, ''];
  if (!suffix) return formatMoney(cents);
  const n = (cents / 100 / div).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `R$ ${n} ${suffix}`;
};

export const formatNumber = (n: number) => n.toLocaleString('pt-BR');

export const formatDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('pt-BR');
export const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

/** Data de cadastro e tempo como cliente: { date: "15/03/2025", tenure: "18 meses" }. */
export function sinceParts(iso: string, now = new Date()) {
  const d = new Date(`${iso}T00:00:00`);
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  const years = Math.floor(months / 12);
  const tenure = months < 1 ? 'menos de 1 mês'
    : months < 12 ? (months === 1 ? '1 mês' : `${months} meses`)
    : `${years} ${years === 1 ? 'ano' : 'anos'}${months % 12 ? ` e ${months % 12} ${months % 12 === 1 ? 'mês' : 'meses'}` : ''}`;
  return { date: d.toLocaleDateString('pt-BR'), tenure };
}
export const formatSince = (iso: string) => { const p = sinceParts(iso); return `${p.date} · ${p.tenure}`; };

export const openedAgo = (hours: number) => {
  if (hours < 1) return 'menos de 1 h';
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 dia' : `${days} dias`;
};

/** Normaliza para comparar nomes (unicidade em cadastros - RF401-CTA003). */
export const normalize = (v: string) => v.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

/** Tempo de cliente em meses, para colunas de tabela (ex.: "18 meses" - RF201). */
export function tenureMonths(iso: string, now = new Date()) {
  const d = new Date(`${iso}T00:00:00`);
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  return months < 1 ? 'menos de 1 mês' : months === 1 ? '1 mês' : `${months} meses`;
}

/** Impede quebra de linha dentro de identificadores (CNPJ, telefone, protocolo) nas células do Table. */
export const noBreak = (v: string) => v.replace(/([/\-\s])/g, (c) => (c === ' ' ? ' ' : `${c}⁠`));
