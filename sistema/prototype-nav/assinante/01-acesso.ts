/** Jornada "Acesso" da Área do assinante: login (RF001), recuperação de senha (RF002) e primeiro acesso via convite (RF003). */
import type { Journey } from '../config';

const s = 'assinante/screens';
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
          v('login-inactive', 'Usuário inativo', 'login.html#state=inactive'),
          v('login-pending', 'Convite pendente', 'login.html#state=pending'),
          v('login-envinactive', 'Ambiente desativado', 'login.html#state=envinactive'),
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
              v('recuperar-envinactive', 'Ambiente desativado', 'recuperar-senha.html#state=envinactive'),
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
      {
        id: 'primeiro-acesso', label: 'RF003 - Primeiro acesso via convite', path: `${s}/primeiro-acesso.html`,
        variants: [
          v('pa-required', 'Campos obrigatórios', 'primeiro-acesso.html#state=required'),
          v('pa-criteria', 'Política de senha não atendida', 'primeiro-acesso.html#state=criteriaunmet'),
          v('pa-mismatch', 'Senhas diferentes', 'primeiro-acesso.html#state=mismatch'),
          v('pa-terms', 'Termos não aceitos', 'primeiro-acesso.html#state=termsrequired'),
          v('pa-expired', 'Link expirado', 'primeiro-acesso.html#state=expired'),
          v('pa-used', 'Link já utilizado', 'primeiro-acesso.html#state=used'),
        ],
      },
    ],
  },
];
