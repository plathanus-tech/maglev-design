/** Saudação do Início: usa o relógio real (dia atual e período do dia), não a data fixa dos dados de demonstração. */
export const greeting = (now = new Date()) => { const h = now.getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
export const todayText = (now = new Date()) => {
  const t = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
