import { mountScreen } from './AuthLayout';
import { PrimeiroAcessoCore } from './PrimeiroAcessoCore';
import { setPrototypePassword } from './recovery';
import { logActivity, setSessionUser, updateDb, useDb } from './store';
import { param } from './ui';
import { todayIso } from './clock';

/**
 * Primeiro acesso do Admin via convite (cadastro de usuário RF302 → e-mail de convite → esta tela → Dashboard).
 * Mesma tela e mesmos dados do primeiro acesso do assinante (PrimeiroAcessoCore), adaptada ao Admin: convite da Maglev,
 * e-mail corporativo, perfil de acesso definido por outro administrador da plataforma.
 */
function PrimeiroAcessoScreen() {
  const db = useDb();

  // Convite: ?id= (padrão: o primeiro usuário com convite pendente).
  const id = param('id');
  const invited = id ? db.adminUsers.find((u) => u.id === id) : db.adminUsers.find((u) => u.status === 'convite');
  const reference = invited ?? db.adminUsers.find((u) => u.status === 'convite') ?? db.adminUsers[0];
  const profile = db.profiles.find((p) => p.id === reference.profileId)?.name;

  return (
    <PrimeiroAcessoCore
      intro={<>Você recebeu um convite para acessar o painel administrativo da <strong>Maglev</strong>{profile ? <> com o perfil <strong>{profile}</strong></> : null}. Crie sua senha para concluir seu acesso</>}
      initialName={reference.name}
      email={reference.email}
      used={!invited || invited.status !== 'convite'}
      expired={{ title: 'O link do convite expirou', message: 'Peça a um administrador da plataforma para reenviar o seu convite.' }}
      usedInfo={{ title: 'Este convite já foi utilizado', message: 'Se você não reconhece essa ativação, avise um administrador da plataforma.' }}
      notes={{
        link: 'Primeiro acesso do Admin (novo épico, espelha o primeiro acesso do assinante): link expirado (💡 7 dias, mesmo prazo do assinante) ou já utilizado (uso único), sem formulário. O novo convite é reenviado por outro administrador em Usuários (Reenviar convite), por isso a orientação não cita a empresa do assinante. “Ir para o login” é a ação primária.',
        data: 'Mesmos dados do primeiro acesso do assinante: o convidado confirma o nome e define a senha. Nome completo vem preenchido com o informado no cadastro do usuário (RF302) e é o único dado editável; o e-mail corporativo (@maglev.com.br, usado para acessar) é somente leitura. Celular e perfil de acesso são definidos por quem cadastrou e não fazem parte desta etapa; o perfil aparece no texto introdutório.',
      }}
      loginHref="login.html"
      onActivate={(name, password) => {
        // Ativa o usuário (convite pendente → ativo), registra a data de entrada, guarda a senha do protótipo e entra com o perfil dele.
        const today = todayIso();
        updateDb((d) => ({ ...d, adminUsers: d.adminUsers.map((u) => (u.id === reference.id ? { ...u, name, status: 'ativo', joinedAt: today, invitedAt: undefined } : u)) }));
        logActivity(reference.id, 'Usuários', 'ativacao', 'Concluiu o primeiro acesso e ativou a conta');
        setPrototypePassword(password);
        setSessionUser(reference.id);
        window.location.href = 'dashboard.html';
      }}
    />
  );
}

mountScreen(<PrimeiroAcessoScreen />);
