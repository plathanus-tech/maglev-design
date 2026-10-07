/**
 * Navegador de Protótipo - Área do assinante, módulo Estrutura (Configurações): RF201 Empresa, RF202 Unidades,
 * RF203 Ambientes, RF204 Usuários. Só serve para navegar; não faz parte da interface final.
 * Ids de perfil para `?as=` (carga inicial de `seed()`): Administrador ASS-0001-U1 (padrão), Solicitante ASS-0001-U2,
 * Executor ASS-0001-U3, Gestor de manutenção ASS-0001-U4.
 */
import type { Journey } from '../config';

const s = 'assinante/screens';
const v = (id: string, label: string, path: string) => ({ id, label, path: `${s}/${path}` });
const GESTOR = 'ASS-0001-U4';

export const journeys: Journey[] = [
  {
    id: 'sub-configuracoes',
    label: 'Configurações',
    items: [
      {
        id: 'sub-empresa', label: 'RF201 - Empresa', path: `${s}/empresa.html`,
        variants: [
          v('sub-empresa-edit', 'Editar contato', 'empresa.html#state=edit'),
          v('sub-empresa-required', 'Editar contato: e-mail obrigatório', 'empresa.html#state=required'),
          v('sub-empresa-gestor', 'Perfil Gestor (contatos só leitura)', `empresa.html?as=${GESTOR}`),
        ],
      },
      {
        id: 'sub-unidades-flow', label: 'RF202 - Unidades', type: 'flow',
        screens: [
          {
            id: 'sub-unidades', label: 'Listagem de unidades', path: `${s}/unidades.html`,
            variants: [
              v('sub-unidades-noresults', 'Busca sem resultados', 'unidades.html#state=noresults'),
              v('sub-unidades-deactivate', 'Inativar (confirmação)', 'unidades.html#state=deactivate'),
              v('sub-unidades-deleteblocked', 'Excluir com vínculos (bloqueado)', 'unidades.html#state=deleteblocked'),
              v('sub-unidades-delete', 'Excluir sem vínculos (confirmação)', 'unidades.html#state=delete'),
              v('sub-unidades-menu', 'Menu de ações aberto', 'unidades.html#state=menu'),
              v('sub-unidades-gestor', 'Perfil Gestor (só visualiza)', `unidades.html?as=${GESTOR}`),
            ],
          },
          {
            id: 'sub-unidade-ver', label: 'RF202 - Visualizar unidade', path: `${s}/unidade.html?id=UNI-001`,
            variants: [
              v('sub-unidade-ver-inativa', 'Unidade inativa', 'unidade.html?id=UNI-007'),
              v('sub-unidade-ver-deactivate', 'Inativar (confirmação)', 'unidade.html?id=UNI-001#state=deactivate'),
              v('sub-unidade-ver-deleteblocked', 'Excluir com vínculos (bloqueado)', 'unidade.html?id=UNI-001#state=deleteblocked'),
              v('sub-unidade-ver-delete', 'Excluir sem vínculos (confirmação)', 'unidade.html?id=UNI-001#state=delete'),
              v('sub-unidade-ver-gestor', 'Perfil Gestor (só leitura)', `unidade.html?id=UNI-001&as=${GESTOR}`),
              v('sub-unidade-ver-naoencontrada', 'Unidade não encontrada', 'unidade.html?id=UNI-999'),
            ],
          },
          {
            id: 'sub-unidade-nova', label: 'Nova unidade', path: `${s}/unidade-form.html`,
            variants: [
              v('sub-unidade-nova-required', 'Campo obrigatório (um erro, sem aviso)', 'unidade-form.html#state=required'),
              v('sub-unidade-nova-requiredmany', 'Campos obrigatórios (vários erros)', 'unidade-form.html#state=requiredmany'),
            ],
          },
          { id: 'sub-unidade-editar', label: 'Editar unidade', path: `${s}/unidade-form.html?id=UNI-001` },
        ],
      },
      {
        id: 'sub-ambientes', label: 'RF203 - Ambientes', path: `${s}/ambientes.html`,
        variants: [
          v('sub-ambientes-unit', 'A partir da unidade (filtrada)', 'ambientes.html?unit=UNI-001'),
          v('sub-ambientes-noresults', 'Busca sem resultados', 'ambientes.html#state=noresults'),
          v('sub-ambientes-new', 'Novo ambiente (modal)', 'ambientes.html#state=new'),
          v('sub-ambientes-view', 'Visualizar ambiente (modal)', 'ambientes.html#state=view'),
          v('sub-ambientes-menu', 'Menu de ações aberto', 'ambientes.html#state=menu'),
          v('sub-ambientes-required', 'Campos obrigatórios', 'ambientes.html#state=required'),
          v('sub-ambientes-duplicate', 'Nome já existe na unidade', 'ambientes.html#state=duplicate'),
          v('sub-ambientes-deactivate', 'Inativar (confirmação)', 'ambientes.html#state=deactivate'),
          v('sub-ambientes-deleteblocked', 'Excluir com equipamentos (bloqueado)', 'ambientes.html#state=deleteblocked'),
          v('sub-ambientes-delete', 'Excluir sem vínculos (confirmação)', 'ambientes.html#state=delete'),
        ],
      },
      {
        id: 'sub-equipe-flow', label: 'RF204 - Usuários', type: 'flow',
        screens: [
          {
            id: 'sub-equipe', label: 'Listagem de usuários', path: `${s}/equipe.html`,
            variants: [
              v('sub-equipe-noresults', 'Busca sem resultados', 'equipe.html#state=noresults'),
              v('sub-equipe-deactivate', 'Inativar membro (confirmação)', 'equipe.html#state=deactivate'),
              v('sub-equipe-activate', 'Ativar membro (confirmação)', 'equipe.html#state=activate'),
              v('sub-equipe-selfdeactivate', 'Inativar a si mesmo (bloqueado)', 'equipe.html#state=selfdeactivate'),
            ],
          },
          {
            id: 'sub-membro-novo', label: 'Convidar membro', path: `${s}/membro-form.html`,
            variants: [
              v('sub-membro-required', 'Campos obrigatórios', 'membro-form.html#state=required'),
              v('sub-membro-duplicate', 'E-mail já cadastrado', 'membro-form.html#state=duplicate'),
              v('sub-membro-profiles', 'Modal Perfis de acesso', 'membro-form.html#state=profiles'),
            ],
          },
          { id: 'sub-membro-editar', label: 'Editar membro', path: `${s}/membro-form.html?id=ASS-0001-U2` },
          { id: 'sub-membro-self', label: 'Editar o próprio usuário (com Segurança)', path: `${s}/membro-form.html?id=ASS-0001-U1` },
        ],
      },
    ],
  },
];
