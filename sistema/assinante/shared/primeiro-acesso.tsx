import { mountScreen } from '../../admin/shared/AuthLayout';
import { PrimeiroAcessoCore } from '../../admin/shared/PrimeiroAcessoCore';
import { setPrototypePassword } from '../../admin/shared/recovery';
import { useDb as useAdminDb } from '../../admin/shared/store';
import { SubUser } from './data';
import { setSubSessionUser, updateSubDb, useSubDb } from './store';
import { param } from './ui';

/** RF003 - Primeiro acesso do assinante via convite. A tela é a mesma do Admin (PrimeiroAcessoCore), com os dados e textos do assinante. */
function PrimeiroAcessoScreen() {
  const db = useSubDb();
  const admin = useAdminDb();

  // Convite: ?id= (padrão: o primeiro usuário com convite pendente).
  const id = param('id');
  const invited: SubUser | undefined = id ? db.users.find((u) => u.id === id) : db.users.find((u) => u.status === 'convite');
  const reference = invited ?? db.users.find((u) => u.status === 'convite') ?? db.users[0];
  const company = admin.subscribers.find((s) => s.id === db.subscriberId)?.tradeName ?? '';

  return (
    <PrimeiroAcessoCore
      intro={<>Você recebeu um convite da <strong>{company}</strong>. Crie sua senha para concluir seu acesso</>}
      initialName={reference.name}
      email={reference.email}
      used={!invited || invited.status !== 'convite'}
      expired={{ title: 'O link do convite expirou', message: 'Entre em contato com o administrador da sua empresa para solicitar um novo convite.' }}
      usedInfo={{ title: 'Este convite já foi utilizado', message: 'Se você não reconhece essa ativação, entre em contato com o administrador da sua empresa.' }}
      notes={{
        link: 'RF003-CTA002 / RGN002 / RGN003: link expirado (💡 7 dias) ou já utilizado (uso único); não há formulário nesses casos, então o subtítulo de ativação não aparece. Expirado = atenção (warning); já utilizado = informativo. O sistema só sabe que o link foi usado, não por quem, então a mensagem não afirma que a pessoa ativou a conta. Nos dois casos “Ir para o login” é a ação primária (a única disponível na interface; quem chega pelo link do convite não necessariamente veio do login), e a orientação de pedir novo convite fica no alert.',
        data: 'RF003-RGN004: no primeiro acesso o convidado confirma o nome e define a senha. Nome completo vem preenchido com o informado pelo administrador no convite e é o único dado editável; o e-mail (endereço do convite, usado para acessar) é um input somente leitura (readOnly), sem edição. Celular, perfil de acesso, unidades e empresa não fazem parte desta etapa; a empresa aparece no texto introdutório.',
      }}
      loginHref="login.html"
      onActivate={(name, password) => {
        // Ativa o usuário (RF003-FLU004), guarda a senha do protótipo e entra com o perfil dele.
        updateSubDb((d) => ({ ...d, users: d.users.map((u) => (u.id === reference.id ? { ...u, name, status: 'ativo', invitedAt: undefined } : u)) }));
        setPrototypePassword(password);
        setSubSessionUser(reference.id);
        window.location.href = 'inicio.html';
      }}
    />
  );
}

mountScreen(<PrimeiroAcessoScreen />);
