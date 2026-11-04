import { ReactNode } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { Button, EmptyStateProps } from '@maglev/ds';

/**
 * Estados vazios padronizados das telas de lista/gerenciamento (mesmos nas tabelas do desktop e nas listas de cards do mobile).
 *  · **Sem cadastros** (o módulo ainda não tem nenhum registro): ícone do módulo, título "Nenhum X cadastrado", descrição com o próximo passo
 *    e a ação primária de criação ("Novo X", só para quem pode cadastrar). Busca e filtros ficam visíveis, mas inativos (`ToolbarGate`).
 *  · **Nenhum resultado** (busca/filtros não retornam nada): mantém o ícone padrão da tabela e os textos que cada tela já usava, com a
 *    ação "Limpar busca e filtros" quando há o que limpar.
 * O cabeçalho com os rótulos das colunas e a barra de busca/filtros permanecem nos dois casos; só o corpo da tabela troca.
 */
export interface ListEmptyOptions {
  /** O módulo não tem nenhum registro (antes de busca e filtros). */
  noRecords: boolean;
  /** Ícone do módulo (o mesmo do menu lateral), 40px. */
  icon: ReactNode;
  /** Texto do estado sem cadastros. `create` = ação primária de criação (omitir sem permissão ou quando não há criação nesta tela). */
  none: { title: string; description: string; create?: { label: string; onClick: () => void } };
  /** Texto do estado "nenhum resultado" (o que a tela já usava). `onClear` aparece como "Limpar busca e filtros" quando há filtro ativo. */
  results: { title: string; description?: string; onClear?: () => void; clearLabel?: string };
}

export function listEmpty({ noRecords, icon, none, results }: ListEmptyOptions): Partial<EmptyStateProps> {
  if (noRecords) {
    return {
      icon, title: none.title, description: none.description,
      action: none.create ? <Button iconLeft={<IconPlus size={20} />} onClick={none.create.onClick}>{none.create.label}</Button> : undefined,
    };
  }
  return {
    title: results.title, description: results.description,
    action: results.onClear ? <Button variant="secondary" size="sm" onClick={results.onClear}>{results.clearLabel ?? 'Limpar busca e filtros'}</Button> : undefined,
  };
}

/** Busca e filtros sem função (módulo vazio): continuam na tela para manter a estrutura, mas não recebem foco nem clique e ficam esmaecidos. */
export function ToolbarGate({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  if (!disabled) return <>{children}</>;
  return <div className="toolbar-gate" aria-disabled="true" {...({ inert: '' } as object)}>{children}</div>;
}
