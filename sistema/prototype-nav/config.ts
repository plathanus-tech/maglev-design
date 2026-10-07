/**
 * Config do Navegador de Protótipo v2 - MAGLEV, Admin da plataforma.
 * Serve só para navegar entre as telas do protótipo; não faz parte da interface final.
 * Cada tela é uma página real do produto (admin/screens/*.html, React + Storybook MAGLEV).
 * Tela nova: adicione aqui (caminho com query/hash da variante) e em SCREENS no vite.config.ts.
 */
export interface ScreenNode {
  id: string;
  label: string;
  path: string;
  mobilePath?: string;
  variants?: Array<{ id: string; label: string; path: string }>;
}
export interface FlowNode { id: string; label: string; type: 'flow'; screens: ScreenNode[] }
export interface Journey { id: string; label: string; items: Array<ScreenNode | FlowNode> }

const s = 'admin/screens';
const v = (id: string, label: string, path: string) => ({ id, label, path: `${s}/${path}` });

export const journeys: Journey[] = [
  {
    id: 'acesso',
    label: 'Acesso',
    items: [
      {
        id: 'login', label: 'RF001 - Login', path: `${s}/login.html`,
        variants: [
          v('login-required', 'Campos obrigatórios', 'login.html#state=required'),
          v('login-invalid', 'E-mail ou senha incorretos', 'login.html#state=invalid'),
          v('login-domain', 'E-mail fora do domínio @maglev.com.br', 'login.html#state=domain'),
          v('login-inactive', 'Usuário inativo', 'login.html#state=inactive'),
          v('login-passwordchanged', 'Senha alterada com sucesso', 'login.html#state=passwordchanged'),
        ],
      },
      {
        id: 'recuperacao', label: 'RF002 - Recuperação de senha', type: 'flow',
        screens: [
          {
            id: 'recuperar-senha', label: 'Informar e-mail', path: `${s}/recuperar-senha.html`,
            variants: [
              v('recuperar-required', 'Campo obrigatório', 'recuperar-senha.html#state=required'),
              v('recuperar-invalid', 'E-mail inválido', 'recuperar-senha.html#state=invalid'),
              v('recuperar-senderror', 'Erro ao enviar código', 'recuperar-senha.html#state=senderror'),
            ],
          },
          {
            id: 'codigo', label: 'Código de verificação', path: `${s}/codigo-verificacao.html`,
            variants: [
              v('codigo-incorrect', 'Código incorreto', 'codigo-verificacao.html#state=incorrect'),
              v('codigo-expired', 'Código expirado', 'codigo-verificacao.html#state=expired'),
              v('codigo-toomany', 'Muitas tentativas', 'codigo-verificacao.html#state=toomany'),
              v('codigo-commerror', 'Erro ao validar código', 'codigo-verificacao.html#state=commerror'),
            ],
          },
          {
            id: 'nova-senha', label: 'Criar nova senha', path: `${s}/criar-nova-senha.html`,
            variants: [
              v('senha-required', 'Campos obrigatórios', 'criar-nova-senha.html#state=required'),
              v('senha-criteria', 'Política de senha não atendida', 'criar-nova-senha.html#state=criteriaunmet'),
              v('senha-mismatch', 'Senhas diferentes', 'criar-nova-senha.html#state=mismatch'),
              v('senha-saveerror', 'Erro ao salvar', 'criar-nova-senha.html#state=saveerror'),
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'dashboard-j',
    label: 'Dashboard',
    items: [
      {
        id: 'dashboard', label: 'RF101 - Dashboard da plataforma', path: `${s}/dashboard.html`,
        variants: [v('dashboard-empty', 'Sem chamados em aberto', 'dashboard.html#state=empty')],
      },
    ],
  },
  {
    id: 'assinantes-j',
    label: 'Gestão de Assinantes',
    items: [
      {
        id: 'assinantes', label: 'RF201 - Listar assinantes', path: `${s}/assinantes.html`,
        variants: [
          v('assinantes-overdue', 'Filtro: inadimplentes', 'assinantes.html#state=overdue'),
          v('assinantes-noresults', 'Busca sem resultados', 'assinantes.html#state=noresults'),
          v('assinantes-columns', 'Personalizar colunas', 'assinantes.html#state=columns'),
          v('assinantes-suporte', 'Perfil Suporte (sem cadastrar/inativar)', 'assinantes.html?as=USR-0003'),
        ],
      },
      {
        id: 'assinante-novo', label: 'RF202 - Cadastrar assinante', path: `${s}/assinante-form.html`,
        variants: [
          v('assinante-novo-required', 'Campos obrigatórios', 'assinante-form.html#state=required'),
          v('assinante-novo-cnpjinvalid', 'CNPJ inválido', 'assinante-form.html#state=cnpjinvalid'),
          v('assinante-novo-cnpjduplicate', 'CNPJ já cadastrado', 'assinante-form.html#state=cnpjduplicate'),
        ],
      },
      { id: 'assinante-editar', label: 'RF202 - Editar assinante', path: `${s}/assinante-form.html?id=ASS-0001` },
      {
        id: 'assinante-detalhe', label: 'RF203 - Detalhe do assinante', path: `${s}/assinante.html?id=ASS-0001`,
        variants: [
          v('assinante-detalhe-overdue', 'Assinante inadimplente', 'assinante.html?id=ASS-0008'),
          v('assinante-detalhe-inactive', 'Ambiente inativo (com histórico)', 'assinante.html?id=ASS-0013'),
        ],
      },
      {
        id: 'ambiente', label: 'RF204 - Ativar/inativar ambiente', type: 'flow',
        screens: [
          { id: 'ambiente-inativar', label: 'Inativar (confirmação + motivo)', path: `${s}/assinante.html?id=ASS-0001#state=deactivate` },
          { id: 'ambiente-ativar', label: 'Ativar (confirmação)', path: `${s}/assinante.html?id=ASS-0013#state=activate` },
          { id: 'ambiente-lista', label: 'Inativar pela listagem', path: `${s}/assinantes.html#state=deactivate` },
        ],
      },
    ],
  },
  {
    id: 'usuarios-j',
    label: 'Gestão de Usuários',
    items: [
      {
        id: 'usuarios', label: 'RF301 - Listar usuários', path: `${s}/usuarios.html`,
        variants: [
          v('usuarios-noresults', 'Busca sem resultados', 'usuarios.html#state=noresults'),
          v('usuarios-columns', 'Personalizar colunas', 'usuarios.html#state=columns'),
          v('usuarios-deactivate', 'Inativar usuário (confirmação)', 'usuarios.html#state=deactivate'),
        ],
      },
      {
        id: 'usuario-novo', label: 'RF302 - Cadastrar usuário', path: `${s}/usuario-form.html`,
        variants: [
          v('usuario-novo-required', 'Campos obrigatórios', 'usuario-form.html#state=required'),
          v('usuario-novo-domain', 'E-mail fora do domínio', 'usuario-form.html#state=domain'),
          v('usuario-novo-duplicate', 'E-mail já cadastrado', 'usuario-form.html#state=duplicate'),
        ],
      },
      { id: 'usuario-editar', label: 'RF302 - Editar usuário', path: `${s}/usuario-form.html?id=USR-0003` },
      {
        id: 'usuario-detalhe', label: 'RF301 - Visualizar usuário', path: `${s}/usuario.html?id=USR-0003`,
        variants: [v('usuario-detalhe-self', 'O próprio usuário (não pode se inativar)', 'usuario.html?id=USR-0001')],
      },
      {
        id: 'perfis', label: 'RF303 - Perfis de acesso', path: `${s}/perfis.html`,
        variants: [v('perfis-deleteblocked', 'Exclusão bloqueada (usuários vinculados)', 'perfis.html#state=deleteblocked')],
      },
      {
        id: 'perfil-novo', label: 'RF303 - Cadastrar perfil', path: `${s}/perfil-form.html`,
        variants: [
          v('perfil-novo-required', 'Campos obrigatórios', 'perfil-form.html#state=required'),
          v('perfil-novo-duplicate', 'Nome já cadastrado', 'perfil-form.html#state=duplicate'),
          v('perfil-novo-nopermission', 'Nenhuma permissão selecionada', 'perfil-form.html#state=nopermission'),
        ],
      },
      {
        id: 'perfil-editar', label: 'RF303 - Editar perfil', path: `${s}/perfil-form.html?id=PER-SUP`,
        variants: [v('perfil-admin', 'Perfil Administrador (fixo)', 'perfil-form.html?id=PER-ADM')],
      },
    ],
  },
  {
    id: 'config-j',
    label: 'Configurações',
    items: [
      {
        id: 'cfg-categorias', label: 'RF402 - Categorias de equipamentos', path: `${s}/configuracoes-categorias.html`,
        variants: [
          v('cfg-cat-new', 'Novo registro', 'configuracoes-categorias.html#state=new'),
          v('cfg-cat-edit', 'Editar registro', 'configuracoes-categorias.html#state=edit'),
          v('cfg-cat-duplicate', 'Nome já cadastrado', 'configuracoes-categorias.html#state=duplicate'),
          v('cfg-cat-delete', 'Excluir (sem vínculos)', 'configuracoes-categorias.html#state=delete'),
          v('cfg-cat-deleteblocked', 'Exclusão bloqueada (com vínculos)', 'configuracoes-categorias.html#state=deleteblocked'),
        ],
      },
      { id: 'cfg-tipos-solicitacao', label: 'RF403 - Tipos de solicitação', path: `${s}/configuracoes-tipos-solicitacao.html` },
      { id: 'cfg-tipos-manutencao', label: 'RF404 - Tipos de manutenção', path: `${s}/configuracoes-tipos-manutencao.html` },
      {
        id: 'cfg-prioridades', label: 'RF405 - Prioridades', path: `${s}/configuracoes-prioridades.html`,
        variants: [v('cfg-pri-edit', 'Editar nível', 'configuracoes-prioridades.html#state=edit')],
      },
      {
        id: 'cfg-criticidades', label: 'RF406 - Criticidades', path: `${s}/configuracoes-criticidades.html`,
        variants: [v('cfg-cri-edit', 'Editar nível', 'configuracoes-criticidades.html#state=edit')],
      },
      {
        id: 'cfg-status', label: 'RF407 - Status', path: `${s}/configuracoes-status.html`,
        variants: [
          v('cfg-st-new', 'Novo status', 'configuracoes-status.html#state=new'),
          v('cfg-st-required', 'Campos obrigatórios', 'configuracoes-status.html#state=required'),
        ],
      },
    ],
  },
];
