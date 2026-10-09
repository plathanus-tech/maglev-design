import { ReactNode } from 'react';
import { IconInbox } from '@tabler/icons-react';
import { Card, Checkbox, EmptyState, Pagination, Stack } from '@maglev/ds';
import { Col, Grid, SectionLabel, Text } from './ui';

/**
 * Versão mobile (< 768px) das tabelas - padrão Nivelo: cada linha vira um Card do Storybook
 * (título + subtítulo; status em `actions`), campos em grade de 2 e ações no `footer` do Card.
 * Recebe as MESMAS linhas (filtradas, ordenadas e paginadas) da tabela do desktop.
 */
export interface MobileCardItem {
  id: string;
  title: ReactNode;
  subtitle?: string;
  badge?: ReactNode;
  fields: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode;
}

/** Modo de seleção múltipla: cada card ganha um Checkbox, tocar no card marca/desmarca e o rodapé de ações individuais (⋮) some. */
export interface MobileSelection { selectedIds: Set<string>; onToggle: (id: string) => void; label: (id: string) => string }

export function MobileCardList({ title, titleHidden, subtitle, toolbar, items, emptyTitle, emptyDescription, page, pageSize, total, onPageChange, headingId, selection, stickyFooter }: {
  title: string;
  titleHidden?: boolean;
  subtitle?: string;
  toolbar?: ReactNode;
  items: MobileCardItem[];
  emptyTitle: string;
  /** Texto de apoio do estado vazio (o mesmo que a tabela do desktop mostra). */
  emptyDescription?: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  headingId: string;
  selection?: MobileSelection;
  /** Fixo na base da viewport enquanto a lista rola (ex.: CTA de impressão em lote); termina junto da lista, sem cobrir o último card. */
  stickyFooter?: ReactNode;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <Stack gap="md" as="section">
      {titleHidden ? <h2 id={headingId} className="sr-only">{title}</h2> : (
        <Stack gap="2xs">
          <SectionLabel id={headingId}>{title}</SectionLabel>
          {subtitle && <Text>{subtitle}</Text>}
        </Stack>
      )}
      {toolbar}

      {items.length === 0 ? (
        <Card><EmptyState icon={<IconInbox size={40} />} title={emptyTitle} description={emptyDescription} /></Card>
      ) : items.map((it) => {
        const checked = !!selection?.selectedIds.has(it.id);
        const card = (
          <Card
            key={it.id} title={it.title} subtitle={it.subtitle} headingLevel={3} footer={selection ? undefined : it.actions}
            actions={selection ? (
              <Stack direction="horizontal" align="center" gap="sm">
                {it.badge}
                {/* o clique no controle (ou no rótulo) não sobe ao card: senão alterna duas vezes e nada muda */}
                <span onClick={(e) => e.stopPropagation()}><Checkbox aria-label={selection.label(it.id)} checked={checked} onChange={() => selection.onToggle(it.id)} /></span>
              </Stack>
            ) : it.badge}
          >
            <Grid>
              {it.fields.map((f) => (
                <Col key={f.label} span={3}>
                  <Stack gap="2xs">
                    <span className="page-label">{f.label}</span>
                    <span className="page-text">{f.value}</span>
                  </Stack>
                </Col>
              ))}
            </Grid>
          </Card>
        );
        return selection ? (
          <div key={it.id} className={`mcl-select${checked ? ' is-selected' : ''}`} onClick={() => selection.onToggle(it.id)}>{card}</div>
        ) : card;
      })}

      {total > 0 && (
        <Stack gap="sm" align="center">
          <span className="page-text" aria-live="polite">{`Mostrando ${from}–${to} de ${total}`}</span>
          {pageCount > 1 && <Pagination page={page} pageCount={pageCount} onPageChange={onPageChange} />}
        </Stack>
      )}
      {stickyFooter && <div className="mcl-sticky">{stickyFooter}</div>}
    </Stack>
  );
}
