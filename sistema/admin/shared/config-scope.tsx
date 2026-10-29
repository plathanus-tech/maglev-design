import { useMemo, useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { Badge, Button, Card, Checkbox, EmptyState, Feedback, Input, RadioButton, Stack } from '@maglev/ds';
import { DevNote } from './dev-notes/DevNote';
import { useSession } from './store';
import { formatCnpj, normalize } from './format';
import { FormSection } from './ui';

/**
 * Alcance de um cadastro de Configurações (categorias, tipos de solicitação, tipos de manutenção, status): por padrão vale para todos
 * os assinantes; em "Todos, exceto os selecionados" marca-se quem NÃO o recebe (`exceptionIds`). Mesmo bloco em todos os formulários em página.
 */
export type Scope = 'all' | 'except';
export const scopeOf = (exceptionIds?: string[]): Scope => (exceptionIds?.length ? 'except' : 'all');
export const reachText = (exceptionIds?: string[]) => (exceptionIds?.length ? `Todos, exceto ${exceptionIds.length} ${exceptionIds.length === 1 ? 'assinante' : 'assinantes'}` : 'Todos os assinantes');
export const scopeError = (scope: Scope, exceptions: string[]) => (scope === 'except' && !exceptions.length ? 'Escolha ao menos um assinante ou volte para “Todos os assinantes”' : undefined);

/** `noun`: "categoria", "tipo de solicitação"…; `fem`: gênero do substantivo (muda o artigo e o demonstrativo). */
export function ScopeCard({ noun, fem, scope, onScope, exceptions, onExceptions, error }: {
  noun: string; fem?: boolean; scope: Scope; onScope: (s: Scope) => void; exceptions: string[]; onExceptions: (ids: string[]) => void; error?: string;
}) {
  const { db } = useSession();
  const [query, setQuery] = useState('');
  const art = fem ? 'A' : 'O';
  // Assinantes inativos continuam na lista só se já eram exceção (nada some sem a pessoa perceber)
  const subscribers = useMemo(() => db.subscribers.filter((s) => s.status !== 'inativo' || exceptions.includes(s.id)), [db.subscribers, exceptions]);
  const visible = useMemo(() => {
    const q = normalize(query);
    return subscribers.filter((s) => !q || normalize(`${s.tradeName} ${s.cnpj} ${formatCnpj(s.cnpj)} ${s.address.city}`).includes(q));
  }, [subscribers, query]);
  const visibleIds = visible.map((s) => s.id);
  const allVisible = visibleIds.length > 0 && visibleIds.every((id) => exceptions.includes(id));
  const toggle = (id: string, on: boolean) => onExceptions(on ? [...exceptions, id] : exceptions.filter((x) => x !== id));
  const toggleVisible = (on: boolean) => onExceptions(on ? [...new Set([...exceptions, ...visibleIds])] : exceptions.filter((x) => !visibleIds.includes(x)));

  return (
    <DevNote note={`Exceções por assinante: por padrão ${fem ? 'a' : 'o'} ${noun} vale para todos os assinantes. Em “Todos, exceto os selecionados”, os assinantes marcados NÃO ${fem ? 'a' : 'o'} recebem (não aparece nos cadastros e filtros deles). A busca filtra só pelo que aparece na lista: nome fantasia, CNPJ ou cidade (a razão social fica de fora porque “Ltda” etc. traria resultados que não batem com o que se vê); “Selecionar resultados” marca de uma vez todos os que aparecem. Registros já existentes continuam como estão (nada é excluído). No protótipo a exceção é só cadastrada e exibida; aplicá-la nas telas do assinante é de desenvolvimento. 💡 A confirmar com o cliente: o que acontece com registros já existentes de quem passa a ser exceção.`}>
      <FormSection className="card-open" title="Alcance" subtitle={`Escolha quais assinantes podem usar ${fem ? 'esta' : 'este'} ${noun}`}>
        <div className="card-body-tight">
          <Stack gap="md">
            <RadioButton
              name="scope" label="Quem pode usar" value={scope} onChange={(v) => onScope(v as Scope)}
              options={[
                { value: 'all', label: 'Todos os assinantes', description: `${art} ${noun} fica disponível para todos os assinantes.` },
                { value: 'except', label: 'Todos, exceto os selecionados', description: `${art} ${noun} fica disponível para todos, menos para os assinantes selecionados abaixo.` },
              ]}
            />
            {scope === 'except' && (
              <Stack gap="md">
                <Input
                  type="search" aria-label="Buscar assinante por nome, CNPJ ou cidade" placeholder="Buscar assinante"
                  iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)}
                />
                <Stack direction="horizontal" align="center" justify="between" gap="md" wrap>
                  <span aria-live="polite">
                    <Badge status={exceptions.length ? 'warning' : 'neutral'}>{exceptions.length === 1 ? '1 exceção' : `${exceptions.length} exceções`}</Badge>
                  </span>
                  <Stack direction="horizontal" gap="xs" wrap>
                    <Button type="button" size="sm" variant="secondary" disabled={!visibleIds.length || allVisible} onClick={() => toggleVisible(true)}>
                      {query.trim() ? `Selecionar resultados (${visibleIds.length})` : `Selecionar todos (${visibleIds.length})`}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={!exceptions.length} onClick={() => onExceptions([])}>Limpar seleção</Button>
                  </Stack>
                </Stack>
                {error && <Feedback type="error" message={error} />}
                <Card padding="md">
                  {visible.length === 0 ? (
                    <EmptyState title="Nenhum assinante encontrado" description="Revise a busca." headingLevel={3} />
                  ) : (
                    <div className="exc-list" role="group" aria-label="Assinantes exceção">
                      {visible.map((s) => (
                        <Checkbox
                          key={s.id} checked={exceptions.includes(s.id)} onChange={(e) => toggle(s.id, e.target.checked)}
                          label={<span className="exc-item"><span className="exc-name">{s.tradeName}</span><span className="exc-sub">{`${formatCnpj(s.cnpj)} · ${s.address.city}`}</span></span>}
                        />
                      ))}
                    </div>
                  )}
                </Card>
              </Stack>
            )}
          </Stack>
        </div>
      </FormSection>
    </DevNote>
  );
}
