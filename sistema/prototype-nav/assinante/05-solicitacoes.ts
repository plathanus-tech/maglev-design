/**
 * Navegador de Protótipo - Área do assinante, jornada Solicitações (RF401-RF404).
 * Ids de solicitação da carga inicial (assinante/shared/data.ts, `seed()`), em ordem de criação:
 * SOL-000119 Nova (QR, troubleshooting sem sucesso) · 120 Em triagem (câmara fria) · 121 Aguardando informação (coifa) ·
 * 122 Aprovada · 123 Em triagem (QR) · 124 Recusada como duplicada de 120 · 125 Convertida (OS-000009) ·
 * 137 Concluída sem OS (resolvida no troubleshooting) · 138 Recusada.
 */
import type { Journey } from '../config';
import { seed } from '../../assinante/shared/data';

const s = 'assinante/screens';
const v = (id: string, label: string, path: string) => ({ id, label, path: `${s}/${path}` });
const users = seed().users;
const idOf = (profile: string) => users.find((u) => u.profile === profile && u.status === 'ativo')?.id ?? users[0].id;
const executor = idOf('executor');

export const journeys: Journey[] = [
  {
    id: 'sub-solicitacoes',
    label: 'Solicitações',
    items: [
      {
        id: 'sol-lista', label: 'RF401 - Listar solicitações', path: `${s}/solicitacoes.html`,
        variants: [
          v('sol-lista-new', 'Filtro: novas', 'solicitacoes.html?filter=new'),
          v('sol-lista-triage', 'Filtro: em triagem', 'solicitacoes.html?filter=triage'),
          v('sol-lista-pending', 'Filtro: pendentes (aprovadas e aguardando informação)', 'solicitacoes.html?filter=pending'),
          v('sol-lista-pending-await', 'Filtro: pendentes · aguardando informação', 'solicitacoes.html?filter=pending&sub=awaiting-info'),
          v('sol-lista-me', 'Filtro: atribuídas a mim', 'solicitacoes.html?filter=assigned-me'),
          v('sol-lista-me-new', 'Filtro: atribuídas a mim · novas', 'solicitacoes.html?filter=assigned-me&sub=new'),
          v('sol-lista-converted', 'Filtro: convertidas em OS (histórico)', 'solicitacoes.html?filter=converted'),
          v('sol-lista-equipment', 'Filtro: por equipamento (histórico)', 'solicitacoes.html?equipment=EQP-0001'),
          v('sol-lista-noresults', 'Busca sem resultados', 'solicitacoes.html#state=noresults'),
          v('sol-lista-conclude', 'Concluir sem OS (motivo obrigatório)', 'solicitacoes.html#state=conclude'),
          v('sol-lista-executor', 'Perfil Executor (somente leitura)', `solicitacoes.html?as=${executor}`),
        ],
      },
      {
        id: 'sol-triagem', label: 'RF402 - Triagem da solicitação', path: `${s}/solicitacao.html?id=SOL-000119`,
        variants: [
          v('sol-tri-triage', 'Em triagem (câmara fria, prioridade sugerida)', 'solicitacao.html?id=SOL-000120'),
          v('sol-tri-triage2', 'Em triagem (via QR, sem classificação)', 'solicitacao.html?id=SOL-000123'),
          v('sol-tri-awaiting', 'Aguardando informação', 'solicitacao.html?id=SOL-000121'),
          v('sol-tri-answered', 'Resposta do solicitante recebida', 'solicitacao.html?id=SOL-000121#state=answered'),
          v('sol-tri-approved', 'Aprovada (ainda sem OS)', 'solicitacao.html?id=SOL-000122'),
          v('sol-tri-converted', 'Convertida em OS', 'solicitacao.html?id=SOL-000125'),
          v('sol-tri-duplicate', 'Recusada como duplicada', 'solicitacao.html?id=SOL-000124'),
          v('sol-tri-rejected', 'Recusada', 'solicitacao.html?id=SOL-000138'),
          v('sol-tri-resolved', 'Concluída sem OS (resolvida no troubleshooting)', 'solicitacao.html?id=SOL-000137'),
          v('sol-tri-required', 'Campos obrigatórios (Aprovar e criar OS)', 'solicitacao.html?id=SOL-000123#state=required'),
          v('sol-tri-complement', 'Solicitar complementação', 'solicitacao.html?id=SOL-000123#state=complement'),
          v('sol-tri-close', 'Concluir sem OS (motivo obrigatório)', 'solicitacao.html?id=SOL-000123#state=close'),
          v('sol-tri-reject', 'Rejeitar (com opção Duplicada)', 'solicitacao.html?id=SOL-000120#state=reject'),
        ],
      },
      {
        id: 'sol-nova', label: 'RF404 - Nova solicitação', path: `${s}/solicitacao-form.html`,
        variants: [
          v('sol-nova-required', 'Campos obrigatórios', 'solicitacao-form.html#state=required'),
          v('sol-nova-equipment', 'Equipamento pré-selecionado (?equipment=)', 'solicitacao-form.html?equipment=EQP-0001'),
          v('sol-nova-duplicate', 'Aviso de duplicidade', 'solicitacao-form.html#state=duplicate'),
        ],
      },
      {
        id: 'sol-troubleshooting', label: 'RF403 - Troubleshooting na abertura', type: 'flow',
        screens: [
          { ...v('sol-ts-offer', 'Aviso de solução de problemas + Começar', 'solicitacao-form.html#state=troubleshooting') },
          { ...v('sol-ts-tip1', 'Dica nº 1 em andamento', 'solicitacao-form.html#state=tip1') },
          { ...v('sol-ts-last', 'Última dica (Sem sucesso? Envie uma solicitação)', 'solicitacao-form.html#state=lasttip') },
          { ...v('sol-ts-done', 'Solução de problemas concluída (volta ao formulário)', 'solicitacao-form.html#state=tipsdone') },
          { ...v('sol-ts-resolved', 'Problema resolvido (sem solicitação)', 'solicitacao-form.html#state=resolved') },
        ],
      },
    ],
  },
];
