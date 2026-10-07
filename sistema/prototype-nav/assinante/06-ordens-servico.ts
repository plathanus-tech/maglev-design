/**
 * Navegador de Protótipo - Área do assinante · Ordens de serviço (RF501-RF503).
 * Ids reais da carga inicial (assinante/shared/data.ts): OS-000009 lava-louças (Aguardando aprovação com orçamento),
 * OS-000010 freezer (Aguardando validação), OS-000011 coifa (Em andamento), OS-000012 chapa (Aberta, executor interno),
 * OS-000013 fogão (Aguardando peça), OS-000014 ar-condicionado (Aguardando prestador), OS-000015 mesa refrigerada
 * (Em andamento, vencida, executor interno), OS-000016 concluída, OS-000021 preventiva em andamento.
 * SOL-000122 = solicitação aprovada (STS-04) ainda sem OS. Perfis por `?as=`: U1 Administrador, U2 Solicitante,
 * U3 Executor, U4 Gestor.
 */
import type { Journey } from '../config';

const s = 'assinante/screens';
const v = (id: string, label: string, path: string) => ({ id, label, path: `${s}/${path}` });
const os = (id: string) => `os.html?id=${id}`;

export const journeys: Journey[] = [
  {
    id: 'ordens-servico',
    label: 'Ordens de serviço',
    items: [
      {
        id: 'ordens-servico', label: 'RF501 - Listar OS', path: `${s}/ordens-servico.html`,
        variants: [
          v('os-filter-overdue', 'Filtro: prazo vencido', 'ordens-servico.html?filter=overdue'),
          v('os-filter-action', 'Filtro: ação necessária', 'ordens-servico.html?filter=action'),
          v('os-filter-validation', 'Filtro: aguardando validação', 'ordens-servico.html?filter=awaiting-validation'),
          v('os-filter-technician', 'Filtro: aguardando prestador/técnico', 'ordens-servico.html?filter=awaiting-technician'),
          v('os-filter-active', 'Filtro: ativas', 'ordens-servico.html?filter=active'),
          v('os-filter-mine', 'Filtro: atribuídas a mim', 'ordens-servico.html?filter=assigned-me'),
          v('os-filter-mine-approval', 'Atribuídas a mim · necessitam de aprovação', 'ordens-servico.html?filter=assigned-me&sub=approval'),
          v('os-filter-equipment', 'Filtro: por equipamento', 'ordens-servico.html?equipment=EQP-0001'),
          v('os-status-approval', 'Resumo: Aguardando aprovação (30 dias)', 'ordens-servico.html?status=STO-04'),
          v('os-noresults', 'Busca sem resultados', 'ordens-servico.html#state=noresults'),
          v('os-empty', 'Sem nenhuma OS', 'ordens-servico.html#state=empty'),
          v('os-reassign', 'Reatribuir (diálogo rápido)', 'ordens-servico.html#state=reassign'),
          v('os-executor', 'Perfil Executor (só as OS dele)', 'ordens-servico.html?as=ASS-0001-U3'),
          v('os-gestor', 'Perfil Gestor', 'ordens-servico.html?as=ASS-0001-U4'),
        ],
      },
      {
        id: 'os-form', label: 'RF502 - Criar / editar OS', path: `${s}/os-form.html?request=SOL-000122`,
        variants: [
          v('osf-required', 'Campos obrigatórios', 'os-form.html?request=SOL-000122#state=required'),
          v('osf-provider', 'Prestador externo filtrado pela categoria', 'os-form.html?request=SOL-000122#state=providerfilter'),
          v('osf-edit', 'Editar / classificar OS em andamento', 'os-form.html?id=OS-000011'),
          v('osf-edit-internal', 'Editar OS com executor interno', 'os-form.html?id=OS-000012'),
          v('osf-noorigin', 'Sem origem (OS avulsa não existe)', 'os-form.html#state=noorigin'),
          v('osf-closed', 'OS concluída (somente leitura)', 'os-form.html?id=OS-000016'),
        ],
      },
      {
        id: 'os-detalhe', label: 'RF503 - Acompanhar OS', type: 'flow',
        screens: [
          {
            id: 'os-orcamento', label: 'Aguardando aprovação (orçamento)', path: `${s}/${os('OS-000009')}`,
            variants: [
              v('os-approve', 'Aprovar orçamento', `${os('OS-000009')}#state=approve`),
              v('os-reject', 'Reprovar orçamento (justificativa obrigatória)', `${os('OS-000009')}#state=reject`),
              v('os-orcamento-executor', 'Perfil Executor (sem decisão do orçamento)', `${os('OS-000009')}&as=ASS-0001-U3`),
              v('os-orcamento-gestor', 'Perfil Gestor aprova', `${os('OS-000009')}&as=ASS-0001-U4`),
              v('os-addbudget', 'Registrar orçamento (OS em andamento)', `${os('OS-000011')}#state=addbudget`),
            ],
          },
          {
            id: 'os-validacao', label: 'Aguardando validação', path: `${s}/${os('OS-000010')}`,
            variants: [
              v('os-validate', 'Validação: Sim (conclui a OS)', `${os('OS-000010')}#state=validate`),
              v('os-validateno', 'Validação: Não (reabre para o responsável)', `${os('OS-000010')}#state=validateno`),
            ],
          },
          {
            id: 'os-andamento', label: 'Em andamento', path: `${s}/${os('OS-000011')}`,
            variants: [
              v('os-conclude', 'Indicar conclusão', `${os('OS-000011')}#state=conclude`),
              v('os-addvisit', 'Adicionar visita / revisita', `${os('OS-000011')}#state=addvisit`),
              v('os-addcost', 'Adicionar item de custo', `${os('OS-000011')}#state=addcost`),
              v('os-cancel', 'Cancelar OS (motivo obrigatório)', `${os('OS-000011')}#state=cancel`),
              v('os-reassign-detail', 'Reatribuir responsável/executor', `${os('OS-000011')}#state=reassign`),
              v('os-vencida', 'Prazo vencido (executor interno)', `${os('OS-000015')}&as=ASS-0001-U3`),
            ],
          },
          { id: 'os-aberta', label: 'Aberta', path: `${s}/${os('OS-000012')}` },
          { id: 'os-peca', label: 'Aguardando peça/recurso', path: `${s}/${os('OS-000013')}` },
          { id: 'os-prestador', label: 'Aguardando prestador', path: `${s}/${os('OS-000014')}` },
          { id: 'os-concluida', label: 'Concluída (somente leitura)', path: `${s}/${os('OS-000016')}` },
          { id: 'os-preventiva', label: 'OS preventiva (checklist do plano)', path: `${s}/${os('OS-000021')}` },
        ],
      },
    ],
  },
];
