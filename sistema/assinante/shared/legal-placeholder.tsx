import { Stack } from '@maglev/ds';

/**
 * ⚠️ CONTEÚDO PLACEHOLDER (fictício). Os textos de Termos de Uso e Política de Privacidade serão fornecidos e validados
 * pelo cliente / jurídico / DPO e devem substituir este conteúdo. Está longo de propósito, para testar a rolagem interna
 * dos modais. Não é texto jurídico.
 */
const SECTIONS: Record<'terms' | 'privacy', Array<[string, string]>> = {
  terms: [
    ['1. Aceitação dos termos', 'Este texto é um exemplo provisório. Ao usar a plataforma Maglev, a pessoa usuária declara que leu e compreendeu as condições de uso aplicáveis ao seu perfil de acesso. O conteúdo definitivo será fornecido pelo cliente.'],
    ['2. Descrição do serviço', 'A plataforma Maglev apoia a gestão de manutenção de equipamentos de restaurantes: cadastro de equipamentos, abertura e acompanhamento de solicitações, ordens de serviço, planos de manutenção preventiva e prestadores. Os recursos disponíveis dependem do perfil de acesso definido pelo administrador da empresa.'],
    ['3. Conta e acesso', 'O acesso é pessoal e criado por convite. A pessoa usuária é responsável por manter a confidencialidade da senha e por todas as ações realizadas com a sua conta. Em caso de suspeita de uso indevido, deve avisar o administrador da empresa.'],
    ['4. Uso adequado', 'A plataforma deve ser usada apenas para finalidades relacionadas à operação e à manutenção da empresa assinante. É vedado tentar acessar dados de outras empresas, burlar controles de segurança ou inserir conteúdo ilícito.'],
    ['5. Dados inseridos', 'As informações cadastradas (equipamentos, solicitações, ordens de serviço, fotos e anexos) pertencem à empresa assinante, que responde pela veracidade e pela atualização desses dados.'],
    ['6. Disponibilidade', 'A Maglev empenha-se em manter a plataforma disponível, mas podem ocorrer interrupções para manutenção ou por motivos fora de seu controle. Avisos de manutenção programada serão comunicados com antecedência razoável.'],
    ['7. Suspensão do acesso', 'O acesso pode ser suspenso quando o ambiente da empresa for desativado ou quando houver violação destes termos. Nesses casos, o administrador será orientado a contatar o suporte Maglev.'],
    ['8. Alterações destes termos', 'Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas na plataforma, e o uso continuado após a comunicação indica ciência da nova versão.'],
    ['9. Contato', 'Dúvidas sobre estes termos podem ser enviadas ao suporte Maglev pelos canais informados na plataforma.'],
  ],
  privacy: [
    ['1. Quem somos', 'Este texto é um exemplo provisório. A Maglev é a responsável pela plataforma de gestão de manutenção. O conteúdo definitivo será fornecido e validado pelo cliente, pelo jurídico e pelo encarregado de proteção de dados (DPO).'],
    ['2. Dados pessoais tratados', 'Para o funcionamento da plataforma são tratados dados como nome completo, e-mail, celular, perfil de acesso, unidades vinculadas e registros de uso (por exemplo, ações realizadas em solicitações e ordens de serviço).'],
    ['3. Para que usamos os dados', 'Os dados são usados para criar e manter a sua conta, identificar quem realizou cada ação, enviar notificações operacionais e garantir a segurança da plataforma. Cada finalidade deverá ter a sua base legal indicada no documento definitivo.'],
    ['4. Com quem compartilhamos', 'Os dados podem ser acessados por pessoas autorizadas da sua empresa, conforme o perfil de acesso, e por prestadores de serviço quando necessário para o atendimento de uma ordem de serviço. Operadores de infraestrutura em nuvem tratam os dados em nome da Maglev.'],
    ['5. Por quanto tempo guardamos', 'Os dados são mantidos enquanto a conta estiver ativa e pelo prazo necessário para cumprir obrigações legais e preservar o histórico de manutenção dos equipamentos. Os prazos definitivos serão informados no documento validado.'],
    ['6. Segurança', 'São adotadas medidas técnicas e organizacionais para proteger os dados contra acesso não autorizado, perda ou alteração, como controle de acesso por perfil e política de senha.'],
    ['7. Seus direitos', 'A pessoa titular pode solicitar confirmação do tratamento, acesso, correção, anonimização ou eliminação de dados, entre outros direitos previstos na legislação, pelos canais indicados no documento definitivo.'],
    ['8. Cookies e tecnologias semelhantes', 'A plataforma pode usar armazenamento local do navegador para lembrar preferências, como o tema claro ou escuro. Detalhes serão descritos no documento definitivo.'],
    ['9. Atualizações desta política', 'Esta política pode ser atualizada, e mudanças relevantes serão comunicadas na plataforma.'],
    ['10. Contato do encarregado', 'Os dados de contato do encarregado (DPO) serão informados no documento definitivo.'],
  ],
};

/** Corpo dos modais legais: região focável (rolagem por teclado) com o texto placeholder repetido para testar textos longos. */
export function LegalText({ kind, label }: { kind: 'terms' | 'privacy'; label: string }) {
  return (
    <div className="legal-scroll" tabIndex={0} role="region" aria-label={label}>
      <Stack gap="md">
        <p className="field-note">Conteúdo provisório (placeholder): será substituído pelo documento fornecido e validado pelo cliente</p>
        {[0, 1].flatMap((round) => SECTIONS[kind].map(([title, text]) => (
          <section key={`${round}-${title}`}>
            <h3 className="legal-heading">{round ? `${title} (repetição de teste)` : title}</h3>
            <p className="page-text">{text}</p>
          </section>
        )))}
      </Stack>
    </div>
  );
}
