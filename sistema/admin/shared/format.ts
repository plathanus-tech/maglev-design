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

/** Valor monetário a partir deste limite (R$ 100 mil, em centavos) é abreviado nos KPIs; abaixo dele aparece completo. */
const MONEY_COMPACT_FROM_CENTS = 10_000_000;
const round2 = (n: number) => Number(n.toFixed(2));
/** Abrevia um número (já em unidades) em mil/mi/bi com até 2 casas, sem zeros desnecessários; o arredondamento nunca deixa "1.000 mil" (sobe para mi) nem "1.000 mi" (sobe para bi). */
function abbreviate(v: number, units: Array<[number, string]>) {
  let i = units.findIndex(([div]) => v >= div);
  if (i < 0) i = units.length - 1;
  let n = round2(v / units[i][0]);
  while (n >= 1000 && i > 0) { i -= 1; n = round2(v / units[i][0]); }
  return { n: n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }), suffix: units[i][1] };
}
const UNITS_ASC: Array<[number, string]> = [[1e9, 'bi'], [1e6, 'mi'], [1e3, 'mil']];

/** O valor monetário do KPI é abreviado (a partir de R$ 100 mil)? Use para decidir se mostra o tooltip com o valor completo. */
export const isMoneyCompact = (cents: number) => Math.abs(cents) >= MONEY_COMPACT_FROM_CENTS;

/**
 * Valor monetário de KPI (em centavos), no padrão pt-BR: completo abaixo de R$ 100 mil; a partir daí "mil", "mi" e "bi" com até duas casas
 * (R$ 125,37 mil · R$ 2,21 mi · R$ 1,25 bi). Sempre calculado do valor numérico original, nunca de texto. Para tabelas, formulários e
 * detalhes use `formatMoney` (valor completo).
 */
export const formatMoneyCompact = (cents: number) => {
  if (!isMoneyCompact(cents)) return formatMoney(cents);
  const { n, suffix } = abbreviate(Math.abs(cents) / 100, UNITS_ASC);
  return `${cents < 0 ? '-' : ''}R$ ${n} ${suffix}`;
};

export const formatNumber = (n: number) => n.toLocaleString('pt-BR');

/** Quantidade de KPI: completa enquanto legível (1.802, 12.450); só a partir de 1 milhão abrevia (1,2 mi), com a mesma regra do dinheiro. */
export const isCountCompact = (n: number) => Math.abs(n) >= 1e6;
export const formatCountCompact = (n: number) => {
  if (!isCountCompact(n)) return formatNumber(n);
  const { n: txt, suffix } = abbreviate(Math.abs(n), [[1e9, 'bi'], [1e6, 'mi']]);
  return `${n < 0 ? '-' : ''}${txt} ${suffix}`;
};

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
