/**
 * Navegador de Protótipo - Colaborador/Solicitante (PWA via QR Code): telas externas, sem login (colaborador/screens/*.html).
 * Fluxo da especificação: escanear o QR → resumo do equipamento (RF001/RF003) → abrir solicitação (RF002) → acompanhar e confirmar (RF004).
 * O equipamento vem do QR Code (`?q=` = identificador não adivinhável) e o acompanhamento, do protocolo (`?p=`).
 */
import type { Journey } from '../config';
import { seed } from '../../assinante/shared/data';

import { linkToRequestByToken } from '../../colaborador/shared/token';
const s = 'colaborador/screens';
const v = (id: string, label: string, path: string) => ({ id, label, path: `${s}/${path}` });
const db = seed();

const OPEN = new Set(['STS-01', 'STS-02', 'STS-03', 'STS-04', 'STS-05']);
const tokenOf = (id: string) => db.equipments.find((e) => e.id === id)?.qrToken ?? '';
const withOpen = db.equipments.find((e) => db.requests.some((r) => r.equipmentId === e.id && OPEN.has(r.statusId)) && e.statusId !== 'STE-05');
const withoutOpen = db.equipments.find((e) => e.statusId !== 'STE-05' && !db.requests.some((r) => r.equipmentId === e.id && OPEN.has(r.statusId)));
const withTips = db.equipments.find((e) => e.statusId !== 'STE-05' && e.troubleshooting.length > 0 && !db.requests.some((r) => r.equipmentId === e.id && OPEN.has(r.statusId))) ?? withoutOpen;
const reqBy = (pred: (r: (typeof db.requests)[number]) => boolean) => db.requests.find(pred)?.id ?? db.requests[0].id;
const awaitingInfo = reqBy((r) => r.statusId === 'STS-03' && !!r.complement && !r.complement.answeredAt);
const triage = reqBy((r) => r.statusId === 'STS-02');
const newest = reqBy((r) => r.statusId === 'STS-01');
const rejected = reqBy((r) => r.statusId === 'STS-06');
const doneNoOs = reqBy((r) => r.statusId === 'STS-07');
const toValidate = db.orders.find((o) => o.statusId === 'STO-07' && o.validation && !o.validation.result)?.requestId ?? db.requests[0].id;
const inService = db.orders.find((o) => ['STO-01', 'STO-02', 'STO-03', 'STO-04', 'STO-05', 'STO-06'].includes(o.statusId) && o.requestId)?.requestId ?? db.requests[0].id;
const concluded = db.orders.find((o) => o.statusId === 'STO-08' && o.requestId)?.requestId ?? db.requests[0].id;
const q = (e?: { qrToken: string }) => `q=${e?.qrToken ?? tokenOf('EQP-0001')}`;

export const journeys: Journey[] = [
  {
    id: 'colab-qr',
    label: 'Via QR Code',
    items: [
      {
        id: 'colab-equipamento', label: 'RF001/RF003 - Resumo do equipamento e solicitações abertas', path: `${s}/equipamento.html?${q(withOpen)}`,
        variants: [
          v('colab-eq-noopen', 'Sem solicitações abertas', `equipamento.html?${q(withoutOpen)}`),
          v('colab-eq-inactive', 'Equipamento inativo (não abre solicitação)', `equipamento.html?${q(withOpen)}#state=inactive`),
          v('colab-eq-envinactive', 'Ambiente do assinante desativado', `equipamento.html?${q(withOpen)}#state=envinactive`),
          v('colab-eq-search', 'Busca por código do equipamento', `equipamento.html`),
          { ...v('colab-eq-search-ok', 'Código encontrado (PAT-1000)', `equipamento.html#state=searchfound`), sub: true },
          { ...v('colab-eq-search-no', 'Equipamento não encontrado', `equipamento.html#state=searchnotfound`), sub: true },
          v('colab-eq-notfound', 'QR Code não reconhecido', `equipamento.html?q=invalido#state=notfound`),
        ],
      },
      {
        id: 'colab-solicitar', label: 'RF002 - Abrir solicitação rápida', path: `${s}/solicitar.html?${q(withoutOpen)}`,
        variants: [
          v('colab-sol-required', 'Campos obrigatórios e aceite dos termos', `solicitar.html?${q(withoutOpen)}#state=required`),
          v('colab-sol-duplicate', 'Aviso de duplicidade (solicitação já aberta)', `solicitar.html?${q(withOpen)}#state=duplicate`),
          v('colab-sol-troubleshooting', 'Com solução de problemas', `solicitar.html?${q(withTips)}#state=troubleshooting`),
          { ...v('colab-sol-ts-tips', 'Dicas de solução de problemas', `solicitar.html?${q(withTips)}#state=tip1`), sub: true },
          { ...v('colab-sol-ts-resolved', 'Problema resolvido', `solicitar.html?${q(withTips)}#state=resolved`), sub: true },
          { ...v('colab-sol-ts-done', 'Problema não resolvido — continuar solicitação', `solicitar.html?${q(withTips)}#state=tipsdone`), sub: true },
        ],
      },
      {
        id: 'colab-acompanhar', label: 'RF004 - Acompanhar solicitação e confirmar resolução', path: `${s}/acompanhar.html?p=${triage}`,
        variants: [
          v('colab-ac-sent', 'Solicitação enviada (protocolo e link de acompanhamento)', `${linkToRequestByToken(newest)}&novo=1`),
          v('colab-ac-info', 'Aguardando sua informação (responder à complementação)', `acompanhar.html?p=${awaitingInfo}`),
          v('colab-ac-service', 'Em atendimento', `acompanhar.html?p=${inService}`),
          v('colab-ac-validate', 'Aguardando confirmação (O problema foi resolvido?)', `acompanhar.html?p=${toValidate}`),
          { ...v('colab-ac-val-yes', 'Problema resolvido — confirmação registrada', `acompanhar.html?p=${toValidate}#state=resolvedok`), sub: true },
          { ...v('colab-ac-val-no', 'Problema não resolvido — resposta registrada', `acompanhar.html?p=${toValidate}#state=unresolved`), sub: true },
          v('colab-ac-concluded', 'Concluída', `acompanhar.html?p=${concluded}`),
          v('colab-ac-resolved', 'Concluída sem atendimento (resolvida nas dicas)', `acompanhar.html?p=${doneNoOs}`),
          v('colab-ac-rejected', 'Recusada', `acompanhar.html?p=${rejected}`),
          v('colab-ac-notfound', 'Protocolo não encontrado', `acompanhar.html?p=SOL-999999`),
        ],
      },
    ],
  },
];
