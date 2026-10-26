import { useEffect, useMemo, useRef } from 'react';
import { Stack } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { ExternalLayout, PageHeader, mountApp } from '../../externo/shared/ExternalLayout';
import { ReadField } from '../../admin/shared/ui';
import { param } from '../../assinante/shared/ui';
import logoLight from '../../../public/maglev-logo.svg';
import {
  CONVITE_VARS, NOVA_OS_VARS, OS_NOTIFICATION_VARS, RECUPERACAO_CODE_VAR, RECUPERACAO_VARS, TemplateId,
  budgetApprovalNotification, conviteSubject, suspensionNoticeNotification, novaOsSubject, osUpdateNotification, preventiveOverdueNotification, recuperacaoSubject,
  renderConviteEmail, renderNovaOsEmail, renderOsNotification, renderRecuperacaoEmail,
} from './templates';

interface Meta { id: TemplateId; label: string; subject: string; to: string; note: string; html: (vars: boolean) => string }

const abs = (path: string) => new URL(path, window.location.origin).href;
const logoUrl = () => new URL(logoLight, window.location.href).href;

/** Dados fictícios (rede de restaurantes). Links reais da pré-visualização apontam para as telas do protótipo; "Variáveis" mostra os marcadores. */
const nova = { providerName: 'Roberto', osNumber: 'OS-000054', equipment: 'Freezer vertical 01', unit: 'Cantina Dona Rosa Centro', summary: 'A porta do freezer não veda direito e forma gelo na borda', priority: 'Média' as const, dueDate: '07/10/2026' };
const convite = { name: 'Patrícia', company: 'Cantina Dona Rosa', email: 'patricia.lima@cantinadonarosa.com.br', profile: 'Gestor de manutenção', validityDays: 7 };
const recuperacao = { name: 'Larissa', code: '482915', validityMinutes: 5 };
const orcamento = { recipientName: 'Larissa', osNumber: 'OS-000009', equipment: 'Lava-louças 01', unit: 'Cantina Dona Rosa Centro', provider: 'Lava Forte Assistência Técnica', amount: 'R$ 1.380,00' };
const atualizacao = { recipientName: 'Fernanda', osNumber: 'OS-000011', equipment: 'Coifa 01', unit: 'Cantina Dona Rosa Centro', status: 'Em andamento', statusTone: 'info' as const, detail: 'Retirada do motor agendada para 05/10/2026, das 10:00 às 12:00.' };

const vencida = { recipientName: 'Larissa', osNumber: 'OS-000048', plan: 'Preventiva mensal das câmaras frias', equipment: 'Câmara fria 01', unit: 'Cantina Dona Rosa Centro', dueDate: '03/10/2026', overdueDays: 2, responsible: 'Larissa Teixeira' };

const inativacao = { recipientName: 'Larissa', company: 'Cantina Dona Rosa', deadline: '02/11/2026', daysLeft: 7 };

const TEMPLATES: Meta[] = [
  {
    id: 'nova-os', label: 'Nova OS atribuída', subject: novaOsSubject(nova), to: 'Prestador de serviço',
    note: 'Complemento à Especificação. O botão leva à RF102 da OS pelo acesso por link do prestador (sem login, sem dado sensível); o link secundário leva à lista Minhas OS (RF101).',
    html: (vars) => renderNovaOsEmail(nova, vars ? NOVA_OS_VARS : { osUrl: abs('/prestador/screens/os.html?p=PRE-001&os=OS-000054'), minhasOsUrl: abs('/prestador/screens/minhas-os.html?p=PRE-001'), logoUrl: logoUrl() }),
  },
  {
    id: 'convite', label: 'Convite de acesso', subject: conviteSubject(), to: 'Usuário convidado',
    note: 'Assinante RF003/RF204: o botão abre o primeiro acesso (definir a senha e aceitar os termos). Link de uso único; a validade de 7 dias é a sugestão do projeto (💡 a confirmar) e a observação some quando não houver prazo definido.',
    html: (vars) => renderConviteEmail(convite, vars ? CONVITE_VARS : { acceptUrl: abs('/assinante/screens/primeiro-acesso.html'), logoUrl: logoUrl() }),
  },
  {
    id: 'recuperacao-senha', label: 'Recuperação de senha', subject: recuperacaoSubject(), to: 'Usuário que pediu a recuperação',
    note: 'Fluxo de recuperação de senha: o código é digitado na tela de verificação (sem botão no e-mail). O código vale 5 minutos (regra da tela de código). Orientação para ignorar se não foi a pessoa que solicitou.',
    html: (vars) => renderRecuperacaoEmail(vars ? { ...recuperacao, code: RECUPERACAO_CODE_VAR } : recuperacao, vars ? RECUPERACAO_VARS : { logoUrl: logoUrl() }),
  },
  {
    id: 'acao-pendente', label: 'Notificação de ação pendente', subject: budgetApprovalNotification(orcamento).subject, to: 'Gestor ou administrador do assinante',
    note: 'Assinante RF503: só quem decide orçamentos (administrador/gestor) recebe e acessa; o botão leva à OS na Área do assinante, onde valem as permissões do perfil. Mesmo modelo serve para validar a conclusão de um atendimento, trocando título, texto, dados e botão.',
    html: (vars) => renderOsNotification(budgetApprovalNotification(orcamento), vars ? OS_NOTIFICATION_VARS : { ctaUrl: abs('/assinante/screens/os.html?id=OS-000009'), logoUrl: logoUrl() }),
  },
  {
    id: 'atualizacao', label: 'Notificação de atualização', subject: osUpdateNotification(atualizacao).subject, to: 'Responsável ou solicitante da OS',
    note: 'Mesma base da notificação de ação pendente, sem ação imediata: informa a mudança de status da OS. Não é necessário um e-mail por status; troca-se status e informação complementar.',
    html: (vars) => renderOsNotification(osUpdateNotification(atualizacao), vars ? OS_NOTIFICATION_VARS : { ctaUrl: abs('/assinante/screens/os.html?id=OS-000011'), logoUrl: logoUrl() }),
  },
  {
    id: 'preventiva-vencida', label: 'Notificação de preventiva vencida', subject: preventiveOverdueNotification(vencida).subject, to: 'Responsável e gestores do assinante',
    note: 'Mesma base das demais notificações de OS, com o atraso em destaque (etiqueta de erro, como no produto). O botão leva à OS preventiva na Área do assinante, respeitando o perfil do destinatário.',
    html: (vars) => renderOsNotification(preventiveOverdueNotification(vencida), vars ? OS_NOTIFICATION_VARS : { ctaUrl: abs('/assinante/screens/os.html?id=OS-000048'), logoUrl: logoUrl() }),
  },
  {
    id: 'inativacao-prevista', label: 'Inativação prevista do ambiente', subject: suspensionNoticeNotification(inativacao).subject, to: 'Administradores e gestores do assinante',
    note: 'Enviado quando o Admin marca o assinante como Inadimplente: abre o prazo de regularização (7 dias, 💡 por enquanto) e informa o impacto da inativação (acesso, QR Codes já colados, chamados em andamento, histórico e dados). O mesmo conteúdo aparece num modal ao entrar na Área do assinante. O botão abre o contato com o suporte Maglev; não há pagamento na plataforma.',
    html: (vars) => renderOsNotification(suspensionNoticeNotification(inativacao), vars ? OS_NOTIFICATION_VARS : { ctaUrl: 'mailto:suporte@maglev.com.br', logoUrl: logoUrl() }),
  },
];

const FROM = 'Maglev <nao-responda@maglev.com.br>';

function Preview({ meta }: { meta: Meta }) {
  // Sempre com os dados de exemplo; Desktop/Mobile vem do navegador de protótipo (a largura da página define o layout do e-mail)
  const html = useMemo(() => meta.html(false), [meta]);
  // O quadro cresce até a altura do e-mail: só a página rola (sem segunda barra de rolagem dentro do iframe)
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    let ro: ResizeObserver | undefined;
    const fit = () => {
      const doc = el.contentDocument;
      if (doc?.documentElement) el.style.height = `${doc.documentElement.scrollHeight + 4}px`;
    };
    const onLoad = () => {
      fit();
      const body = el.contentDocument?.body;
      if (body && 'ResizeObserver' in window) { ro = new ResizeObserver(fit); ro.observe(body); }
    };
    el.addEventListener('load', onLoad);
    if (el.contentDocument?.readyState === 'complete') onLoad();
    window.addEventListener('resize', fit);
    return () => { el.removeEventListener('load', onLoad); window.removeEventListener('resize', fit); ro?.disconnect(); };
  }, [html]);
  return (
    <Stack gap="lg">
      <DevNote note={meta.note}>
        <div className="ex-meta">
          <ReadField label="De" value={FROM} />
          <ReadField label="Para" value={meta.to} />
          <ReadField label="Assunto" value={meta.subject} />
        </div>
      </DevNote>
      <div className="mail-frame-wrap">
        <iframe ref={frame} title={`Pré-visualização: ${meta.label}`} className="mail-frame" style={{ width: '100%' }} scrolling="no" srcDoc={html} />
      </div>
    </Stack>
  );
}

/**
 * Pré-visualização dos e-mails transacionais da Maglev (só para revisar o design; nada é enviado). Área separada das jornadas
 * operacionais. Modelo escolhido pelo Navegador de Protótipo, por `?t=` (nova-os, convite, recuperacao-senha, acao-pendente, atualizacao).
 */
function EmailsScreen() {
  // O modelo vem do Navegador de Protótipo (?t=); sem parâmetro, abre o primeiro
  const meta = TEMPLATES.find((t) => t.id === param('t')) ?? TEMPLATES[0];
  return (
    <ExternalLayout area="Pré-visualização de e-mails" wide>
      <Stack gap="lg">
        <PageHeader title={meta.label} subtitle="Pré-visualização do e-mail transacional" />
        <Preview key={meta.id} meta={meta} />
      </Stack>
    </ExternalLayout>
  );
}

mountApp(<EmailsScreen />);
