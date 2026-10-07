/**
 * Jornada Equipamentos (Área do assinante): RF301-RF305.
 * Ids reais de demonstração: EQP-0016 parado (stoppedSince) · EQP-0004 sem valor de aquisição · EQP-0029 inativo (STE-05) ·
 * EQP-0001 com troubleshooting · EQP-0002 em garantia.
 */
import type { Journey } from '../config';

const s = 'assinante/screens';
const v = (id: string, label: string, path: string) => ({ id, label, path: `${s}/${path}` });

export const journeys: Journey[] = [
  {
    id: 'equipamentos',
    label: 'Equipamentos',
    items: [
      {
        id: 'equipamentos-lista', label: 'RF302/RF303 - Hierárquica e lista', path: `${s}/equipamentos.html`,
        variants: [
          v('eqp-expanded', 'Hierárquica com todos os níveis abertos', 'equipamentos.html#state=expanded'),
          v('eqp-list', 'Aba Lista', 'equipamentos.html#state=list'),
          v('eqp-stopped', 'Filtro: parados', 'equipamentos.html?filter=stopped'),
          v('eqp-alert', 'Filtro: com alerta/falha', 'equipamentos.html?filter=alert'),
          v('eqp-inactive', 'Filtro: inativos', 'equipamentos.html?filter=inactive'),
          v('eqp-unit', 'Filtro: uma unidade', 'equipamentos.html?unit=UNI-001'),
          v('eqp-inactivate', 'Inativar equipamento', 'equipamentos.html#state=inactivate'),
          v('eqp-noresults', 'Busca sem resultados', 'equipamentos.html#state=noresults'),
          v('eqp-qr-list', 'QR Code pela lista', 'equipamentos.html#state=qr'),
        ],
      },
      {
        id: 'equipamento-form', label: 'RF301 - Cadastrar equipamento', path: `${s}/equipamento-form.html`,
        variants: [
          v('eqf-required', 'Campos obrigatórios', 'equipamento-form.html#state=required'),
          v('eqf-warranty', 'Garantia = Sim sem datas', 'equipamento-form.html#state=warranty'),
          v('eqf-troubleshooting', 'Troubleshooting preenchido', 'equipamento-form.html#state=troubleshooting'),
          v('eqf-edit', 'Editar equipamento', 'equipamento-form.html?id=EQP-0001'),
          v('eqf-next', 'Cadastrar próximo (unidade e ambiente mantidos)', 'equipamento-form.html?unit=UNI-001&env=AMB-011'),
        ],
      },
      {
        id: 'equipamento', label: 'RF304 - Detalhe do equipamento', path: `${s}/equipamento.html?id=EQP-0001`,
        variants: [
          v('eqd-photos', 'Com fotos (equipamento e etiqueta)', 'equipamento.html?id=EQP-0011'),
          v('eqd-stopped', 'Alerta: somente equipamento parado', 'equipamento.html?id=EQP-0016#state=stopped'),
          v('eqd-recurrence', 'Alerta: somente falhas recorrentes', 'equipamento.html?id=EQP-0016#state=recurrence'),
          v('eqd-attention', 'Alerta: pontos de atenção agrupados (parado + falhas recorrentes)', 'equipamento.html?id=EQP-0016'),
          v('eqd-novalue', 'Sem valor de aquisição', 'equipamento.html?id=EQP-0004'),
          v('eqd-inactive', 'Equipamento inativo', 'equipamento.html?id=EQP-0029'),
          v('eqd-warranty', 'Em garantia', 'equipamento.html?id=EQP-0002'),
        ],
      },
      {
        id: 'equipamento-qr', label: 'RF305 - QR Code e etiqueta', path: `${s}/equipamento.html?id=EQP-0001#state=qr`,
      },
    ],
  },
];
