import { clockNow } from '../../admin/shared/clock';
/** Saudação do Início: usa o relógio real (dia atual e período do dia), não a data fixa dos dados de demonstração. */
export const greeting = (now = clockNow()) => { const h = now.getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
export const todayText = (now = clockNow()) => {
  const t = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
