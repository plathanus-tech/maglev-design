/**
 * Navegador de Protótipo - Prestador de serviço (acesso por link web, sem login): prestador/screens/*.html.
 * Fluxo: link recebido por e-mail → celular e código (OTP) → Minhas OS (RF101, abas Ativas e Histórico) → Atendimento da OS (RF102) → execução da preventiva (RF603 adaptado).
 * O link identifica o prestador (`?p=`) e, quando individual, o técnico (`?tec=`). 💡 P09: modelo de link a confirmar.
 */
import type { Journey } from '../config';
import { seed } from '../../assinante/shared/data';

const s = 'prestador/screens';
/** As telas do prestador pedem celular e código; nas variantes o Navegador abre uma sessão de demonstração (`otp=demo`) para ir direto à tela */
const demo = (path: string) => {
  const [rest, hash = ''] = path.split('#');
  return `${rest}${rest.includes('?') ? '&' : '?'}otp=demo${hash ? `#${hash}` : ''}`;
};
const v = (id: string, label: string, path: string) => ({ id, label, path: `${s}/${demo(path)}` });
const db = seed();

const provOf = (o: (typeof db.orders)[number]) => (o.executor.kind === 'prestador' ? o.executor.providerId : '');
const byProvider = db.orders.filter((o) => o.executor.kind === 'prestador');
const find = (pred: (o: (typeof db.orders)[number]) => boolean) => byProvider.find(pred);
const link = (o: (typeof db.orders)[number] | undefined, page = 'os.html', extra = '') => (o ? `${page}?p=${provOf(o)}&os=${o.id}${extra}` : `${page}?p=PRE-001`);

const main = db.providers.find((p) => p.status === 'ativo' && p.technicians.length > 0) ?? db.providers[0];
const tech = main.technicians[0];
const inactive = db.providers.find((p) => p.status === 'inativo') ?? db.providers[db.providers.length - 1];
const scheduled = find((o) => o.visits.length > 0 && o.visits.every((vi) => !vi.arrivedAt) && o.kind === 'corretiva');
const newOrder = find((o) => ['STO-01', 'STO-06'].includes(o.statusId) && o.kind === 'corretiva');
const inProgress = find((o) => o.statusId === 'STO-02' && o.kind === 'corretiva');
const budgetApproved = find((o) => o.budget?.decision === 'aprovado' && ['STO-02', 'STO-03', 'STO-05'].includes(o.statusId));
const budgetWait = find((o) => o.statusId === 'STO-04');
const validation = find((o) => o.statusId === 'STO-07');
const closed = find((o) => o.statusId === 'STO-08' && o.kind === 'corretiva');
const preventive = find((o) => o.kind === 'preventiva' && !['STO-08', 'STO-09'].includes(o.statusId));
const preventiveCancelled = find((o) => o.kind === 'preventiva' && o.statusId === 'STO-09');
const preventiveNew = find((o) => o.kind === 'preventiva' && o.statusId === 'STO-01') ?? preventive;
const preventiveDone = find((o) => o.kind === 'preventiva' && o.statusId === 'STO-08');

export const journeys: Journey[] = [
  {
    id: 'prest-link',
    label: 'Acesso por link e código',
    items: [
      {
        id: 'prest-acesso', label: 'RF001 - Acesso: celular e código (OTP)', path: `${s}/acesso.html`,
        variants: [
          { id: 'prest-ac-link', label: 'Chegando por um link (pede o código e volta à OS)', path: `${s}/${link(inProgress)}&otp=reset` },
          { id: 'prest-ac-expired', label: 'Sessão vencida (confirmar de novo)', path: `${s}/acesso.html#state=expired` },
          { id: 'prest-ac-required', label: 'Celular obrigatório', path: `${s}/acesso.html#state=required` },
          { id: 'prest-ac-invalid', label: 'Celular inválido', path: `${s}/acesso.html#state=invalid` },
          { id: 'prest-ac-senderror', label: 'Falha ao enviar o código', path: `${s}/acesso.html#state=senderror` },
          { id: 'prest-ac-code', label: 'Código de verificação', path: `${s}/acesso-codigo.html` },
          { id: 'prest-ac-incorrect', label: 'Código incorreto', path: `${s}/acesso-codigo.html#state=incorrect` },
          { id: 'prest-ac-codeexpired', label: 'Código expirado', path: `${s}/acesso-codigo.html#state=expired` },
          { id: 'prest-ac-toomany', label: 'Excedeu as tentativas', path: `${s}/acesso-codigo.html#state=toomany` },
          { id: 'prest-ac-commerror', label: 'Falha ao validar o código', path: `${s}/acesso-codigo.html#state=commerror` },
        ],
      },
      {
        id: 'prest-minhas-os', label: 'RF001/RF101 - Minhas OS', path: `${s}/${demo(`minhas-os.html?p=${main.id}`)}`,
        variants: [
          v('prest-mos-tech', 'Link individual do técnico', `minhas-os.html?p=${main.id}&tec=${tech.id}`),
          v('prest-mos-history', 'Aba Histórico (OS concluídas e canceladas)', `minhas-os.html?p=${main.id}#state=history`),
          v('prest-mos-nohistory', 'Histórico vazio', `minhas-os.html?p=${main.id}#state=nohistory`),
          v('prest-mos-empty', 'Sem OS atribuídas', `minhas-os.html?p=${main.id}#state=empty`),
          v('prest-mos-inactive', 'Prestador inativo (sem acesso)', `minhas-os.html?p=${inactive.id}`),
          v('prest-mos-invalid', 'Link inválido ou expirado', `minhas-os.html?p=INVALIDO`),
        ],
      },
      {
        id: 'prest-atendimento', label: 'RF102 - Atendimento da OS', path: `${s}/${demo(link(inProgress))}`,
        variants: [
          v('prest-at-new', 'OS nova (aceitar o atendimento)', link(newOrder)),
          v('prest-at-scheduled', 'Visita já agendada (só registrar a chegada)', link(scheduled)),
          v('prest-at-diag', 'Diagnóstico sem orçamento (execução liberada)', link(inProgress)),
          v('prest-at-diag-budget', 'Orçamento em preenchimento (aviso antes do envio)', link(inProgress, 'os.html', '#state=budgetform')),
          v('prest-at-budget', 'Orçamento enviado, aguardando aprovação (execução bloqueada)', link(budgetWait)),
          v('prest-at-approved', 'Orçamento aprovado (execução liberada)', link(budgetApproved ?? inProgress)),
          v('prest-at-validation', 'Conclusão indicada (aguardando validação)', link(validation)),
          v('prest-at-expired', 'OS concluída (somente consulta, vinda do Histórico)', link(closed)),
          v('prest-at-other', 'OS de outro prestador (sem acesso)', `os.html?p=${inactive.id === main.id ? 'PRE-002' : main.id}&os=${(byProvider.find((o) => provOf(o) !== main.id) ?? db.orders[0]).id}`),
        ],
      },
      {
        id: 'prest-preventiva', label: 'RF102/RF603 - Executar preventiva', path: `${s}/${demo(link(preventiveNew, 'execucao-preventiva.html'))}`,
        variants: [
          v('prest-pv-os', 'OS preventiva (resumo e acesso à execução)', link(preventive)),
          v('prest-pv-incomplete', 'Tentativa de concluir com pendências', link(preventive, 'execucao-preventiva.html', '#state=incomplete')),
          v('prest-pv-anomaly', 'Com anomalia (abre solicitação corretiva)', link(preventive, 'execucao-preventiva.html', '#state=anomaly')),
          v('prest-pv-cancelled', 'OS cancelada (execução não realizada)', link(preventiveCancelled ?? preventive, 'execucao-preventiva.html')),
          v('prest-pv-done', 'Execução concluída (leitura)', link(preventiveDone ?? preventive, 'execucao-preventiva.html', '#state=done')),
        ],
      },
    ],
  },
];
