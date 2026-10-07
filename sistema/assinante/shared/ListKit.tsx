import { ReactNode, useEffect, useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { Checkbox, Input, Stack, Table, TableColumn } from '@maglev/ds';
import { MobileCardItem, MobileCardList } from '../../admin/shared/MobileCardList';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { TableToolbar } from './ui';
import './preventivas.css';

/**
 * Peças de composição das telas de Preventivas e Prestadores (só montagem de componentes do DS):
 * barra de busca + vários filtros, tabela que vira lista de cards no mobile e grupo de Checkbox com rótulo.
 */

/** Busca na linha de cima e os filtros (Dropdown) na linha de baixo - mesma toolbar do Admin, com mais de um filtro. */
export function ListFilters({ searchLabel, placeholder, query, onQuery, filters = [], filterControl, columns }: {
  searchLabel: string; placeholder: string; query: string; onQuery: (v: string) => void; filters?: ReactNode[];
  /** Filtros agrupados (`FilterControl`, 2+ filtros) e botão "Exibição" (`control` de `useColumnPrefs`): ficam à direita da busca. */
  filterControl?: ReactNode; columns?: ReactNode;
}) {
  const search = (
    <Input type="search" aria-label={searchLabel} placeholder={placeholder} iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => onQuery(e.target.value)} />
  );
  return (
    <Stack gap="2xs">
      <TableToolbar search={search} filters={filterControl} columns={columns} />
      {filters.length > 0 && (
        <div className="toolbar-row toolbar-row--search-only toolbar-filters">
          {filters.map((f, i) => <div key={i} className="toolbar-status">{f}</div>)}
        </div>
      )}
    </Stack>
  );
}

/**
 * Tabela do DS no desktop; no mobile (< 768px) a mesma lista vira cards (MobileCardList). Paginação de 10 própria:
 * a página volta à 1 quando `resetKey` muda (busca/filtros).
 */
export function ResponsiveTable<T extends Record<string, unknown>>({ id, title, subtitle, titleHidden, toolbar, columns, rows, card, emptyTitle, emptyDescription, resetKey = '', pageSize = 10 }: {
  id: string; title: string; subtitle?: string; titleHidden?: boolean; toolbar?: ReactNode;
  columns: TableColumn<T>[]; rows: T[]; card: (row: T) => MobileCardItem;
  emptyTitle: string; emptyDescription?: string; resetKey?: string; pageSize?: number;
}) {
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [resetKey]);
  const slice = rows.slice((page - 1) * pageSize, page * pageSize);
  if (isMobile) {
    return (
      <MobileCardList
        headingId={id} title={title} titleHidden={titleHidden} subtitle={subtitle} toolbar={toolbar} emptyTitle={emptyTitle}
        page={page} pageSize={pageSize} total={rows.length} onPageChange={setPage} items={slice.map(card)}
      />
    );
  }
  return (
    <Table<T>
      caption={titleHidden ? title : undefined} title={titleHidden ? undefined : title} subtitle={titleHidden ? undefined : subtitle}
      toolbar={toolbar} columns={columns} rows={slice}
      empty={{ title: emptyTitle, description: emptyDescription }}
      pagination={{ page, pageSize, total: rows.length, onPageChange: setPage }}
    />
  );
}

/** Grupo de Checkbox (seleção múltipla) com legenda; `optional` marca só os opcionais (README). */
export function CheckGroup({ label, optional, helperText, options, value, onChange, error, columns }: {
  label: string; optional?: boolean; helperText?: string; options: Array<{ value: string; label: string }>;
  value: string[]; onChange: (v: string[]) => void; error?: string; columns?: boolean;
}) {
  const toggle = (v: string, on: boolean) => onChange(on ? [...value, v] : value.filter((x) => x !== v));
  return (
    <Stack as="fieldset" gap="sm" className="check-group">
      <legend className="read-label">{label}{optional && <span className="optional-mark"> (opcional)</span>}</legend>
      {helperText && <p className="field-note">{helperText}</p>}
      <div className={columns ? 'check-group-grid' : 'check-group-list'}>
        {options.map((o, i) => (
          <Checkbox key={o.value} label={o.label} checked={value.includes(o.value)} onChange={(e) => toggle(o.value, e.target.checked)} error={i === 0 ? error : undefined} />
        ))}
      </div>
      {error && options.length === 0 && <p className="field-note" role="alert">{error}</p>}
    </Stack>
  );
}
