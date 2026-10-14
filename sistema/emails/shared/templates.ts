import { C, FONT, SummaryRow, button, codeBox, emailLayout, esc, heading, note, paragraph, ph, pill, summary, textLink } from './email-kit';

/**
 * Templates dos e-mails transacionais da Maglev (complemento à Especificação; nenhum é disparado no protótipo).
 * Cada template recebe os dados e os links por parâmetro; nada sensível vai no e-mail além do que o destinatário já pode ver.
 */
export type TemplateId = 'nova-os' | 'convite' | 'recuperacao-senha' | 'acao-pendente' | 'atualizacao' | 'preventiva-vencida';

// ─── Nova OS atribuída (Prestador) ───
export interface NovaOsEmailData {
  providerName: string; osNumber: string; equipment: string; unit: string; summary: string;
  priority: 'Crítica' | 'Alta' | 'Média' | 'Baixa';
  /** Prazo para atendimento já formatado (dd/mm/aaaa); omitido quando a OS não tem prazo */
  dueDate?: string;
}
/** `osUrl`: link individual da OS (RF102) pelo acesso por link do prestador · `minhasOsUrl`: lista Minhas OS (RF101) */
export interface NovaOsEmailLinks { osUrl: string; minhasOsUrl: string; logoUrl: string }
export const NOVA_OS_VARS: NovaOsEmailLinks = { osUrl: ph('os_url'), minhasOsUrl: ph('minhas_os_url'), logoUrl: ph('logo_url') };
export const novaOsSubject = (d: Pick<NovaOsEmailData, 'osNumber' | 'equipment'>) => `Nova OS atribuída: ${d.osNumber} · ${d.equipment}`;
const PRIORITY_TONE = { Crítica: 'error', Alta: 'warning', Média: 'info', Baixa: 'neutral' } as const;

export function renderNovaOsEmail(d: NovaOsEmailData, links: NovaOsEmailLinks = NOVA_OS_VARS): string {
  return emailLayout({
    title: novaOsSubject(d), logoUrl: links.logoUrl,
    preheader: `Uma nova ordem de serviço foi atribuída a você: ${d.osNumber} · ${d.equipment}.`,
    rows: [
      heading('Nova ordem de serviço atribuída'),
      paragraph(`Olá, ${esc(d.providerName)}!<br>Uma nova ordem de serviço foi atribuída a você. Confira os detalhes do atendimento abaixo.`),
      summary([
        { label: 'Número da OS', value: `<strong>${esc(d.osNumber)}</strong>` },
        { label: 'Equipamento', value: esc(d.equipment) },
        { label: 'Unidade', value: esc(d.unit) },
        { label: 'Problema', value: esc(d.summary) },
        { label: 'Prioridade', value: pill(d.priority, PRIORITY_TONE[d.priority]) },
        ...(d.dueDate ? [{ label: 'Prazo para atendimento', value: esc(d.dueDate) }] : []),
      ]),
      button(links.osUrl, 'Visualizar ordem de serviço'),
      textLink(links.minhasOsUrl, 'Ver todas as minhas ordens de serviço'),
    ],
  });
}

// ─── Convite de acesso (Assinante RF003 / RF204) ───
export interface ConviteEmailData {
  name: string; company: string; email: string;
  /** Perfil de acesso (ex.: Gestor de manutenção); omitido quando não for relevante */
  profile?: string;
  /** Validade do link em dias. Projeto: 7 dias, uso único (Assinante RF003-RGN002/RGN003; 💡 a confirmar). Sem valor, a observação de validade não aparece */
  validityDays?: number;
}
/** `acceptUrl`: link único do convite, que abre o primeiro acesso (definir a senha e aceitar os termos) */
export interface ConviteEmailLinks { acceptUrl: string; logoUrl: string }
export const CONVITE_VARS: ConviteEmailLinks = { acceptUrl: ph('accept_url'), logoUrl: ph('logo_url') };
/** O convite é enviado pela Maglev (a plataforma), em nome da empresa do assinante: o assunto não atribui o envio à empresa */
export const conviteSubject = () => 'Você foi convidado para acessar a Maglev';

export function renderConviteEmail(d: ConviteEmailData, links: ConviteEmailLinks = CONVITE_VARS): string {
  const rows: SummaryRow[] = [
    { label: 'Empresa', value: `<strong>${esc(d.company)}</strong>` },
    { label: 'Seu e-mail', value: esc(d.email) },
    ...(d.profile ? [{ label: 'Perfil de acesso', value: esc(d.profile) }] : []),
  ];
  return emailLayout({
    title: conviteSubject(), logoUrl: links.logoUrl,
    preheader: `Aceite o convite para acessar a Maglev na empresa ${d.company}.`,
    rows: [
      heading('Você foi convidado para acessar a Maglev'),
      paragraph(`Olá, ${esc(d.name)}!<br>Você recebeu um convite para acessar a Maglev, a plataforma de gestão de manutenções utilizada pela empresa <strong>${esc(d.company)}</strong>.<br>Para começar, aceite o convite e configure seu acesso.`),
      summary(rows),
      button(links.acceptUrl, 'Aceitar convite'),
      ...(d.validityDays ? [note(`O link do convite pode ser usado uma única vez e vale por ${d.validityDays} dias.`)] : []),
    ],
  });
}

// ─── Recuperação de senha (Admin RF002 / Assinante) ───
export interface RecuperacaoEmailData {
  name: string; code: string;
  /** Validade do código em minutos (protótipo: 5 min, tela de código de verificação); sem valor, a validade não aparece */
  validityMinutes?: number;
}
export interface RecuperacaoEmailLinks { logoUrl: string }
export const RECUPERACAO_VARS: RecuperacaoEmailLinks = { logoUrl: ph('logo_url') };
export const RECUPERACAO_CODE_VAR = ph('codigo');
export const recuperacaoSubject = () => 'Código para redefinir sua senha da Maglev';

/** O mais simples dos e-mails: só o código; sem botão nem bloco de dados */
export function renderRecuperacaoEmail(d: RecuperacaoEmailData, links: RecuperacaoEmailLinks = RECUPERACAO_VARS): string {
  return emailLayout({
    title: recuperacaoSubject(), logoUrl: links.logoUrl,
    preheader: `Seu código de verificação: ${d.code}`,
    rows: [
      heading('Código para redefinir sua senha'),
      paragraph(`Olá, ${esc(d.name)}!<br>Recebemos uma solicitação para redefinir a senha da sua conta Maglev. Utilize o código abaixo para continuar:`, 16),
      `<tr><td align="center" style="font-family:${FONT};font-size:13px;line-height:20px;color:${C.textTertiary};padding-bottom:8px;">Código de verificação</td></tr>`,
      codeBox(d.code),
      ...(d.validityMinutes ? [note(`O código vale por ${d.validityMinutes} minutos.`)] : []),
      note('Se você não solicitou a redefinição, ignore este e-mail. Sua senha continua a mesma.', d.validityMinutes ? 4 : 16),
    ],
  });
}

// ─── Notificação de OS (ação pendente e atualização): mesma base, muda título, texto, dados e botão ───
export interface OsNotificationData {
  recipientName: string; title: string;
  /** Texto após a saudação (HTML já escapado) */
  message: string;
  summary: SummaryRow[];
  ctaLabel: string;
  /** Texto de pré-visualização do cliente de e-mail e assunto */
  subject: string; preheader: string;
}
export interface OsNotificationLinks { ctaUrl: string; logoUrl: string }
export const OS_NOTIFICATION_VARS: OsNotificationLinks = { ctaUrl: ph('cta_url'), logoUrl: ph('logo_url') };

export function renderOsNotification(d: OsNotificationData, links: OsNotificationLinks = OS_NOTIFICATION_VARS): string {
  return emailLayout({
    title: d.subject, logoUrl: links.logoUrl, preheader: d.preheader,
    rows: [
      heading(d.title),
      paragraph(`Olá, ${esc(d.recipientName)}!<br>${d.message}`),
      summary(d.summary),
      button(links.ctaUrl, d.ctaLabel),
    ],
  });
}

/** Exemplo 1 · ação pendente: orçamento aguardando aprovação (Assinante RF503; só gestor/administrador decidem). Serve também para "validar conclusão", trocando título, texto, dados e botão. */
export interface BudgetApprovalData { recipientName: string; osNumber: string; equipment: string; unit: string; provider?: string; amount?: string }
export const budgetApprovalNotification = (d: BudgetApprovalData): OsNotificationData => ({
  recipientName: d.recipientName, title: 'Orçamento aguardando aprovação',
  message: 'Um orçamento foi enviado para sua análise. Acesse a ordem de serviço para conferir os detalhes e tomar uma decisão.',
  summary: [
    { label: 'Número da OS', value: `<strong>${esc(d.osNumber)}</strong>` },
    { label: 'Equipamento', value: esc(d.equipment) },
    { label: 'Unidade', value: esc(d.unit) },
    ...(d.provider ? [{ label: 'Prestador', value: esc(d.provider) }] : []),
    ...(d.amount ? [{ label: 'Valor do orçamento', value: `<strong>${esc(d.amount)}</strong>` }] : []),
  ],
  ctaLabel: 'Revisar orçamento',
  subject: `Orçamento aguardando aprovação: ${d.osNumber} · ${d.equipment}`,
  preheader: `${d.osNumber}: um orçamento aguarda a sua decisão.`,
});

/** Exemplo 2 · atualização importante, sem ação imediata: mudança no andamento da OS */
export interface OsUpdateData { recipientName: string; osNumber: string; equipment: string; unit: string; status: string; statusTone: 'error' | 'warning' | 'info' | 'success' | 'neutral'; detail?: string }
export const osUpdateNotification = (d: OsUpdateData): OsNotificationData => ({
  recipientName: d.recipientName, title: 'Sua ordem de serviço foi atualizada',
  message: 'Houve uma atualização na ordem de serviço abaixo. Confira as informações para acompanhar o atendimento.',
  summary: [
    { label: 'Número da OS', value: `<strong>${esc(d.osNumber)}</strong>` },
    { label: 'Equipamento', value: esc(d.equipment) },
    { label: 'Unidade', value: esc(d.unit) },
    { label: 'Novo status', value: pill(d.status, d.statusTone) },
    ...(d.detail ? [{ label: 'Informação', value: esc(d.detail) }] : []),
  ],
  ctaLabel: 'Visualizar ordem de serviço',
  subject: `Sua ordem de serviço foi atualizada: ${d.osNumber} · ${d.equipment}`,
  preheader: `${d.osNumber} agora está: ${d.status}.`,
});

/** Exemplo 3 · alerta: preventiva vencida (Assinante RF601/RF603: a preventiva atrasada também aparece nas notificações da plataforma). Mesma base, com o atraso em destaque */
export interface PreventiveOverdueData { recipientName: string; osNumber: string; plan: string; equipment: string; unit: string; dueDate: string; overdueDays: number; responsible?: string }
export const preventiveOverdueNotification = (d: PreventiveOverdueData): OsNotificationData => ({
  recipientName: d.recipientName, title: 'Preventiva vencida',
  message: 'A manutenção preventiva abaixo passou do prazo e ainda não foi concluída. Acesse a ordem de serviço para acompanhar a execução.',
  summary: [
    { label: 'Número da OS', value: `<strong>${esc(d.osNumber)}</strong>` },
    { label: 'Plano', value: esc(d.plan) },
    { label: 'Equipamento', value: esc(d.equipment) },
    { label: 'Unidade', value: esc(d.unit) },
    { label: 'Data prevista', value: esc(d.dueDate) },
    { label: 'Atraso', value: pill(`Vencida há ${d.overdueDays} ${d.overdueDays === 1 ? 'dia' : 'dias'}`, 'error') },
    ...(d.responsible ? [{ label: 'Responsável', value: esc(d.responsible) }] : []),
  ],
  ctaLabel: 'Ver ordem de serviço',
  subject: `Preventiva vencida: ${d.osNumber} · ${d.equipment}`,
  preheader: `${d.osNumber}: a preventiva de ${d.equipment} está vencida há ${d.overdueDays} ${d.overdueDays === 1 ? 'dia' : 'dias'}.`,
});
