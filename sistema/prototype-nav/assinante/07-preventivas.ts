/**
 * Navegador de Protótipo - Área do assinante · Preventivas (RF601-RF603).
 * Ids de referência da carga inicial: planos PLA-001 (câmaras frias, atrasado), PLA-002 (coifas), PLA-003 (fritadeiras, executor interno),
 * PLA-004 (fornos, pausado). OS preventivas: OS-000021 (PLA-001, em andamento/atrasada), OS-000022 e OS-000023 (PLA-001), OS-000024/25 (PLA-002),
 * OS-000026 (PLA-003, executor ASS-0001-U3). Usuários: gestor ASS-0001-U4, executor ASS-0001-U3, solicitante ASS-0001-U2.
 */
import type { Journey } from '../config';

const s = 'assinante/screens';
const v = (id: string, label: string, path: string) => ({ id, label, path: `${s}/${path}` });

export const journeys: Journey[] = [
  {
    id: 'sub-preventivas',
    label: 'Preventivas',
    items: [
      {
        id: 'planos', label: 'RF602 - Planos de manutenção', path: `${s}/planos.html`,
        variants: [
          v('planos-overdue', 'Atalho do Início: execuções atrasadas', 'planos.html?filter=overdue'),
          v('planos-upcoming', 'Atalho do Início: próximas execuções (7 dias)', 'planos.html?filter=upcoming'),
          v('planos-noresults', 'Busca sem resultados', 'planos.html#state=noresults'),
          v('planos-empty', 'Nenhum plano cadastrado', 'planos.html#state=empty'),
          v('planos-pause', 'Pausar plano (confirmação)', 'planos.html#state=pause'),
          v('planos-activate', 'Ativar plano pausado (confirmação)', 'planos.html#state=activate'),
          v('planos-executor', 'Perfil Executor (só os planos dele)', 'planos.html?as=ASS-0001-U3'),
        ],
      },
      {
        id: 'plano', label: 'RF602 - Histórico do plano', path: `${s}/plano.html?id=PLA-001`,
        variants: [
          v('plano-paused', 'Plano pausado', 'plano.html?id=PLA-004'),
          v('plano-interno', 'Executor interno', 'plano.html?id=PLA-003'),
          v('plano-equipments', 'Associar/desassociar equipamentos', 'plano.html?id=PLA-001#state=equipments'),
          v('plano-pause', 'Pausar (confirmação)', 'plano.html?id=PLA-001#state=pause'),
          v('plano-activate', 'Ativar (confirmação)', 'plano.html?id=PLA-004#state=activate'),
          v('plano-gestor', 'Perfil Gestor', 'plano.html?id=PLA-001&as=ASS-0001-U4'),
        ],
      },
      {
        id: 'plano-novo', label: 'RF601 - Criar plano (6 passos)', type: 'flow',
        screens: [
          {
            id: 'plano-novo-1', label: 'Passo 1 - Informações', path: `${s}/plano-form.html`,
            variants: [v('plano-novo-required', 'Campos obrigatórios', 'plano-form.html#state=required')],
          },
          { id: 'plano-novo-2', label: 'Passo 2 - Programação (com prévia)', path: `${s}/plano-form.html#state=step2` },
          { id: 'plano-novo-3', label: 'Passo 3 - Executor', path: `${s}/plano-form.html#state=step3` },
          { id: 'plano-novo-4', label: 'Passo 4 - Checklist', path: `${s}/plano-form.html#state=step4` },
          { id: 'plano-novo-5', label: 'Passo 5 - Evidências e anomalia', path: `${s}/plano-form.html#state=step5` },
          { id: 'plano-novo-6', label: 'Passo 6 - Revisão e salvar', path: `${s}/plano-form.html#state=step6` },
        ],
      },
      {
        id: 'plano-editar', label: 'RF601 - Editar plano', path: `${s}/plano-form.html?id=PLA-001`,
        variants: [v('plano-editar-interno', 'Executor interno', 'plano-form.html?id=PLA-003')],
      },
      {
        id: 'execucao', label: 'RF603 - Execução da preventiva', path: `${s}/execucao-preventiva.html?os=OS-000022`,
        variants: [
          v('execucao-incomplete', 'Concluir com pendências', 'execucao-preventiva.html?os=OS-000022#state=incomplete'),
          v('execucao-anomaly', 'Com anomalia (gera solicitação corretiva)', 'execucao-preventiva.html?os=OS-000023#state=anomaly'),
          v('execucao-done', 'Execução concluída (leitura)', 'execucao-preventiva.html?os=OS-000022#state=done'),
          v('execucao-interno', 'Executor interno (perfil Executor)', 'execucao-preventiva.html?os=OS-000026&as=ASS-0001-U3'),
          v('execucao-bloqueada', 'Executor sem acesso à OS', 'execucao-preventiva.html?os=OS-000022&as=ASS-0001-U3'),
        ],
      },
    ],
  },
];
