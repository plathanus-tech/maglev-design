import { ReactNode } from 'react';
import { Card, EmptyState, Pagination, Stack } from '@maglev/ds';
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

export function MobileCardList({ title, titleHidden, subtitle, toolbar, items, emptyTitle, page, pageSize, total, onPageChange, headingId }: {
  title: string;
  titleHidden?: boolean;
  subtitle?: string;
  toolbar?: ReactNode;
  items: MobileCardItem[];
  emptyTitle: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  headingId: string;
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
        <Card><EmptyState title={emptyTitle} /></Card>
      ) : items.map((it) => (
        <Card key={it.id} title={it.title} subtitle={it.subtitle} actions={it.badge} headingLevel={3} footer={it.actions}>
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
      ))}

      {total > 0 && (
        <Stack gap="sm" align="center">
          <span className="page-text" aria-live="polite">{`Mostrando ${from}–${to} de ${total}`}</span>
          {pageCount > 1 && <Pagination page={page} pageCount={pageCount} onPageChange={onPageChange} />}
        </Stack>
      )}
    </Stack>
  );
}
