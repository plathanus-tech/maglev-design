import { ReactNode } from 'react';
import { Badge, Card, Stack } from '@maglev/ds';
import { useDb as useAdminDb } from '../../admin/shared/store';
import { StatusItem, LevelItem, ConfigItem, Visual } from '../../admin/shared/data';
import { levelBadgeOf, statusBadgeOf } from '../../admin/shared/ui';
import { TroubleshootingRun } from './data';

/**
 * Atalhos compartilhados da Área do assinante. Tudo o que é do Admin (Grid, Col, ReadField, CellPair, TableToolbar,
 * RowAction, setFlash/takeFlash…) é reutilizado - as mesmas decisões de design - e reexportado daqui.
 */
export {
  CellPair, Col, Grid, ReadField, RowAction, RowActions, SectionLabel, TableToolbar, Text,
  goTo, param, setFlash, takeFlash, recordStatusBadge, statusBadgeOf, visualBadgeOf, levelBadgeOf,
} from '../../admin/shared/ui';

/**
 * Configurações globais do Admin (status, prioridades, criticidades, categorias, tipos), só leitura aqui.
 * Status vêm com o tipo visual (RF407 / RNF014): o Badge usa o ícone e a cor do tipo.
 */
export function useRefs() {
  const admin = useAdminDb();
  const byId = <T extends { id: string }>(list: T[], id?: string) => list.find((x) => x.id === id);
  const statusNode = (id: string | undefined, fallback = '-'): ReactNode => {
    const s: StatusItem | undefined = byId(admin.statuses, id);
    return s ? statusBadgeOf(s.visual, s.name) : fallback;
  };
  const levelNode = (list: LevelItem[], id?: string): ReactNode => {
    const l = byId(list, id);
    return l ? levelBadgeOf(l.visual, l.name) : '-';
  };
  return {
    admin,
    status: (id?: string) => byId(admin.statuses, id),
    priority: (id?: string) => byId(admin.priorities, id),
    criticality: (id?: string) => byId(admin.criticalities, id),
    category: (id?: string): ConfigItem | undefined => byId(admin.categories, id),
    requestType: (id?: string): ConfigItem | undefined => byId(admin.requestTypes, id),
    maintType: (id?: string): ConfigItem | undefined => byId(admin.maintenanceTypes, id),
    /** Badge de status (com ícone do tipo visual). */
    statusBadge: statusNode,
    priorityBadge: (id?: string) => levelNode(admin.priorities, id),
    criticalityBadge: (id?: string) => levelNode(admin.criticalities, id),
    /** Situação-base do status (Aberto, Em andamento, Aguardando, Concluído, Cancelado) - RF407-RGN004. */
    base: (id?: string) => byId(admin.statuses, id)?.base,
    visualOf: (id?: string): Visual | undefined => byId(admin.statuses, id)?.visual,
    activeStatuses: (module: StatusItem['module']) => admin.statuses.filter((s) => s.module === module && s.status === 'ativo'),
  };
}

/** Pessoa que abriu/atende: nome curto para células. */
export const firstName = (name: string) => name.split(' ')[0];

const OVERALL: Record<TroubleshootingRun['overall'], { label: string; badge: 'success' | 'warning' | 'neutral' }> = {
  resolvido: { label: 'Resolvido', badge: 'success' },
  'sem-sucesso': { label: 'Sem sucesso', badge: 'warning' },
  'nao-iniciado': { label: 'Não iniciado', badge: 'neutral' },
};

/**
 * Bloco "Notas do troubleshooting" (RF402-RGN008 / RF403-CTA003): resultado geral (Sem sucesso / Não iniciado /
 * Resolvido) e a lista de dicas com o resultado de cada uma (Realizada / Pulada). Aparece na triagem da solicitação
 * e na OS (visível ao técnico/prestador). Só leitura.
 */
export function TroubleshootingNotes({ run }: { run?: TroubleshootingRun }) {
  if (!run) return null;
  const overall = OVERALL[run.overall];
  return (
    <Card className="card-open" title="Notas do troubleshooting" subtitle="O que foi tentado antes de abrir a solicitação">
      <div className="card-body-tight">
        <Stack gap="md">
          <Stack direction="horizontal" align="center" gap="sm" wrap>
            <span className="read-label">Resultado geral</span>
            <Badge status={overall.badge} dot>{overall.label}</Badge>
          </Stack>
          {run.tips.length === 0
            ? <p className="page-text">Nenhuma dica foi exibida para este equipamento e problema</p>
            : (
              <Stack as="ol" gap="sm" className="ts-list">
                {run.tips.map((t, i) => (
                  <li key={i} className="ts-item">
                    <Stack direction="horizontal" justify="between" align="start" gap="md">
                      <span className="page-text"><strong>Dica nº {i + 1}</strong> · {t.text}</span>
                      <Badge status={t.result === 'realizada' ? 'success' : 'neutral'} dot>{t.result === 'realizada' ? 'Realizada' : 'Pulada'}</Badge>
                    </Stack>
                  </li>
                ))}
              </Stack>
            )}
        </Stack>
      </div>
    </Card>
  );
}
