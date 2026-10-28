/**
 * Navegador de Protótipo - Prestador de serviço (acesso por link web, sem login): prestador/screens/*.html.
 * Fluxo: link recebido por e-mail → Minhas OS (RF101) → Atendimento da OS (RF102) → execução da preventiva (RF603 adaptado).
 * O link identifica o prestador (`?p=`) e, quando individual, o técnico (`?tec=`). 💡 P09: modelo de link a confirmar.
 */
import type { Journey } from '../config';
import { seed } from '../../assinante/shared/data';

const s = 'prestador/screens';
const v = (id: string, label: string, path: string) => ({ id, label, path: `${s}/${path}` });
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
    label: 'Acesso por link',
    items: [
      {
        id: 'prest-minhas-os', label: 'RF001/RF101 - Minhas OS', path: `${s}/minhas-os.html?p=${main.id}`,
        variants: [
          v('prest-mos-tech', 'Link individual do técnico', `minhas-os.html?p=${main.id}&tec=${tech.id}`),
          v('prest-mos-empty', 'Sem OS atribuídas', `minhas-os.html?p=${main.id}#state=empty`),
          v('prest-mos-inactive', 'Prestador inativo (sem acesso)', `minhas-os.html?p=${inactive.id}`),
          v('prest-mos-invalid', 'Link inválido ou expirado', `minhas-os.html?p=INVALIDO`),
        ],
      },
      {
        id: 'prest-atendimento', label: 'RF102 - Atendimento da OS', path: `${s}/${link(inProgress)}`,
        variants: [
          v('prest-at-new', 'OS nova (aceitar o atendimento)', link(newOrder)),
          v('prest-at-scheduled', 'Visita já agendada (só registrar a chegada)', link(scheduled)),
          v('prest-at-diag', 'Diagnóstico sem orçamento (execução liberada)', link(inProgress)),
          v('prest-at-diag-budget', 'Orçamento em preenchimento (aviso antes do envio)', link(inProgress, 'os.html', '#state=budgetform')),
          v('prest-at-budget', 'Orçamento enviado, aguardando aprovação (execução bloqueada)', link(budgetWait)),
          v('prest-at-approved', 'Orçamento aprovado (execução liberada)', link(budgetApproved ?? inProgress)),
          v('prest-at-validation', 'Conclusão indicada (aguardando validação)', link(validation)),
          v('prest-at-expired', 'OS encerrada (link expirado)', link(closed)),
          v('prest-at-other', 'OS de outro prestador (sem acesso)', `os.html?p=${inactive.id === main.id ? 'PRE-002' : main.id}&os=${(byProvider.find((o) => provOf(o) !== main.id) ?? db.orders[0]).id}`),
        ],
      },
      {
        id: 'prest-preventiva', label: 'RF102/RF603 - Executar preventiva', path: `${s}/${link(preventiveNew, 'execucao-preventiva.html')}`,
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
