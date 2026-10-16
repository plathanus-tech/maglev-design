import { FormEvent, KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { Button, Card, Feedback, Input, Stack } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { CategoryIcon } from '../../admin/shared/IconPicker';
import { normalize } from '../../admin/shared/format';
import { PageHeader } from '../../externo/shared/ExternalLayout';
import { useSubDb } from '../../assinante/shared/store';
import { linkToEquipment, useRefs } from './lib';

/**
 * Busca por código (Colaborador RF001, acesso pelo endereço da plataforma, sem QR Code): o solicitante digita o código do equipamento,
 * confere o resultado e segue para o mesmo resumo do acesso por QR Code. A busca fica restrita ao assinante do acesso e só devolve
 * identificação (nome, código, unidade e ambiente); o restante vem do resumo.
 */
export function EquipmentSearch({ demo }: { demo?: 'found' | 'notfound' }) {
  const db = useSubDb();
  const refs = useRefs();
  const demoCode = demo === 'found' ? 'PAT-1000' : demo === 'notfound' ? 'PAT-9999' : '';
  const [code, setCode] = useState(demoCode);
  const [searched, setSearched] = useState<string | null>(demoCode || null);
  const typed = code.trim();
  const found = searched ? db.equipments.find((e) => e.code.toUpperCase() === searched.toUpperCase()) : undefined;
  const unit = db.units.find((u) => u.id === found?.unitId);
  const env = db.environments.find((x) => x.id === found?.environmentId);
  // Sugestões enquanto digita (código ou nome), só entre os equipamentos do assinante do acesso; no máximo 6
  const [openList, setOpenList] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const suggestions = useMemo(() => {
    const q = normalize(typed);
    if (!q) return [];
    return db.equipments.filter((e) => normalize(e.code).includes(q) || normalize(e.name).includes(q))
      .sort((a, b) => Number(normalize(b.code).startsWith(q)) - Number(normalize(a.code).startsWith(q)) || a.code.localeCompare(b.code)).slice(0, 6);
  }, [db.equipments, typed]);
  const showList = openList && !!typed && !(searched && found);
  useEffect(() => {
    if (!openList) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpenList(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openList]);
  const pick = (eqCode: string) => { setCode(eqCode); setSearched(eqCode); setOpenList(false); setActive(-1); };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { if (showList) { e.preventDefault(); setOpenList(false); } return; }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && suggestions.length) {
      e.preventDefault(); setOpenList(true);
      setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % suggestions.length : (i <= 0 ? suggestions.length - 1 : i - 1)));
    } else if (e.key === 'Enter' && showList && active >= 0 && suggestions[active]) {
      e.preventDefault(); pick(suggestions[active].code);
    }
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!typed) return;
    setSearched(typed);
    setOpenList(false);
  };

  return (
    <Stack gap="lg">
      <PageHeader title="Encontrar equipamento" subtitle="Informe o código de identificação do equipamento" />
      <DevNote note="Colaborador RF001 (acesso pelo endereço, sem QR Code): o código é comparado sem diferenciar maiúsculas de minúsculas e sem espaços nas pontas, só entre os equipamentos do assinante do acesso (sugestões enquanto digita, só deste assinante, até 6, por código ou nome; sem listagem geral). O resultado mostra apenas identificação; valor, custos e dados administrativos não aparecem. Selecionar leva ao mesmo resumo do QR Code. 💡 Se o endereço identificar só o assinante, a busca cobre todas as unidades dele; seleção de unidade fica pendente de validação.">
        <form onSubmit={submit} noValidate>
          <Stack gap="md">
            <div className="ext-suggest" ref={rootRef}>
              <Input
                label="Código do equipamento" placeholder="Ex.: PAT-1000" autoComplete="off" autoCapitalize="characters" spellCheck={false}
                value={code} onChange={(e) => { setCode(e.target.value); setSearched(null); setOpenList(true); setActive(-1); }}
                onFocus={() => setOpenList(true)} onKeyDown={onKeyDown}
                role="combobox" aria-expanded={showList && suggestions.length > 0} aria-controls={listId} aria-autocomplete="list"
                aria-activedescendant={showList && active >= 0 ? `${listId}-opt-${active}` : undefined}
              />
              {showList && suggestions.length > 0 && (
                <div className="ext-suggest-panel">
                  <div id={listId} role="listbox" aria-label="Equipamentos encontrados">
                    {suggestions.map((e, i) => (
                      <div
                        key={e.id} id={`${listId}-opt-${i}`} role="option" aria-selected={active === i}
                        className={`ext-suggest-option${active === i ? ' is-active' : ''}`}
                        onMouseEnter={() => setActive(i)} onMouseDown={(ev) => ev.preventDefault()} onClick={() => pick(e.code)}
                      >
                        <span className="ext-suggest-icon" aria-hidden="true"><CategoryIcon id={refs.category(e.categoryId)?.icon} size={16} /></span>
                        <span className="ext-suggest-text">
                          <span>{e.name}</span>
                          <span className="ext-suggest-desc">{e.code} · {db.units.find((u) => u.id === e.unitId)?.name ?? ''}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="ext-actions"><Button type="submit" variant={found ? 'secondary' : 'primary'} disabled={!typed}>Buscar equipamento</Button></div>
          </Stack>
        </form>
      </DevNote>

      {searched && !found && (
        <Feedback type="warning" title="Equipamento não encontrado" message="Confira o código informado ou procure o responsável pela unidade." />
      )}

      {found && (
        <DevNote note="Resultado da busca: o card inteiro é o link para o resumo do equipamento (RF001), como o card de OS do prestador. Alterar o código esconde o resultado até uma nova busca (botão ou Enter). Ícone da categoria vem do cadastro de categorias do Admin.">
          <a className="ext-link-card" href={linkToEquipment(found)} aria-label={`Selecionar equipamento ${found.name}, código ${found.code}`}>
            <Card padding="none">
              <div className="ext-os-card">
                <div className="ext-found-head">
                  <span className="ext-os-cat" aria-hidden="true"><CategoryIcon id={refs.category(found.categoryId)?.icon} size={24} /></span>
                  <div className="ext-found-id">
                    <span className="ext-found-name">{found.name}</span>
                    <span className="ext-found-code">{found.code}</span>
                  </div>
                  <IconChevronRight className="ext-found-chevron" size={20} aria-hidden="true" />
                </div>
                <div className="ext-pair">
                  <div className="ext-field"><span className="ext-field-label">Unidade</span><span className="ext-sit-value">{unit?.name ?? '-'}</span></div>
                  <div className="ext-field"><span className="ext-field-label">Ambiente</span><span className="ext-sit-value">{env?.name ?? '-'}</span></div>
                </div>
              </div>
            </Card>
          </a>
        </DevNote>
      )}
    </Stack>
  );
}
