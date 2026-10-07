/**
 * Navegador de Protótipo - Área do assinante · Prestadores (RF701-RF703).
 * Ids de referência: PRE-001 Frio Sul (OS em validação e preventivas), PRE-002 Chama Viva, PRE-004 Ar Puro, PRE-005 Lava Forte
 * (orçamento aguardando aprovação), PRE-006 José Almeida (autônomo, inativo). Perfis: gestor ASS-0001-U4, executor ASS-0001-U3.
 */
import type { Journey } from '../config';

const s = 'assinante/screens';
const v = (id: string, label: string, path: string) => ({ id, label, path: `${s}/${path}` });

export const journeys: Journey[] = [
  {
    id: 'sub-prestadores',
    label: 'Prestadores',
    items: [
      {
        id: 'prestadores', label: 'RF701 - Gerenciar prestadores', path: `${s}/prestadores.html`,
        variants: [
          v('prestadores-noresults', 'Busca sem resultados', 'prestadores.html#state=noresults'),
          v('prestadores-empty', 'Nenhum prestador cadastrado', 'prestadores.html#state=empty'),
          v('prestadores-inactivate', 'Inativar prestador (confirmação)', 'prestadores.html#state=inactivate'),
          v('prestadores-activate', 'Ativar prestador (confirmação)', 'prestadores.html#state=activate'),
          v('prestadores-gestor', 'Perfil Gestor', 'prestadores.html?as=ASS-0001-U4'),
          v('prestadores-executor', 'Perfil Executor (sem acesso)', 'prestadores.html?as=ASS-0001-U3'),
        ],
      },
      {
        id: 'prestador-novo', label: 'RF702 - Cadastrar prestador', path: `${s}/prestador-form.html`,
        variants: [
          v('prestador-novo-required', 'Campos obrigatórios', 'prestador-form.html#state=required'),
          v('prestador-novo-duplicate', 'CNPJ já cadastrado', 'prestador-form.html#state=duplicate'),
          v('prestador-novo-invalid', 'CNPJ inválido', 'prestador-form.html#state=invalid'),
        ],
      },
      {
        id: 'prestador-editar', label: 'RF702 - Editar prestador', path: `${s}/prestador-form.html?id=PRE-001`,
        variants: [v('prestador-editar-autonomo', 'Profissional autônomo (CPF)', 'prestador-form.html?id=PRE-006')],
      },
      {
        id: 'prestador', label: 'RF703 - Perfil do prestador', path: `${s}/prestador.html?id=PRE-001`,
        variants: [
          v('prestador-lava', 'Com orçamento aguardando aprovação (Lava Forte)', 'prestador.html?id=PRE-005'),
          v('prestador-chama', 'Com OS em andamento (Chama Viva)', 'prestador.html?id=PRE-002'),
          v('prestador-inativo', 'Prestador inativo (autônomo)', 'prestador.html?id=PRE-006'),
          v('prestador-gestor', 'Perfil Gestor (vê custos)', 'prestador.html?id=PRE-001&as=ASS-0001-U4'),
          v('prestador-inactivate', 'Inativar (confirmação)', 'prestador.html?id=PRE-001#state=inactivate'),
        ],
      },
    ],
  },
];
