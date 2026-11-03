import { useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconSearch } from '@tabler/icons-react';
import { Button, Checkbox, Dialog, EmptyState, Feedback, Input, Stack, useToast } from '@maglev/ds';
import { CategoryIcon } from '../../admin/shared/IconPicker';
import { FilterControl } from '../../admin/shared/FilterControl';
import { ListFilters } from './ListKit';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { requiredMessage } from '../../admin/shared/format';
import { Plan } from './data';
import { setPlanEquipments } from './preventivas';
import { environmentName, useSubSession } from './store';
import { Text, useRefs } from './ui';
import { photoSrc } from './photos';
import { Equipment } from './data';

/**
 * Seleção de equipamentos do plano (RF601-FLU002): vários equipamentos, agrupados por unidade, com busca e "selecionar a unidade toda".
 * Um plano só tem equipamentos de UMA unidade: ao escolher o primeiro, os das outras unidades ficam desabilitados (voltam ao esvaziar a seleção).
 * Equipamento inativo não é ofertado.
 */
export function EquipmentPicker(props: { selected: string[]; onChange: (ids: string[]) => void; error?: string }) {
  // Padrão (v2): seleção visual por categorias, com busca e filtros por unidade e ambiente. A lista anterior (v1) fica na variante #state=picker1
  return typeof location !== 'undefined' && location.hash.includes('state=picker1') ? <EquipmentPickerV1 {...props} /> : <EquipmentPickerV2 {...props} />;
}

function EquipmentPickerV1({ selected, onChange, error }: { selected: string[]; onChange: (ids: string[]) => void; error?: string }) {
  const { db, unitIds } = useSubSession();
  const [query, setQuery] = useState('');
  // Unidade do plano: a dos equipamentos já escolhidos (só trava quando todos são de uma mesma unidade; planos antigos com várias unidades seguem editáveis)
  const picked = new Set(selected.map((id) => db.equipments.find((e) => e.id === id)?.unitId).filter(Boolean));
  const lockedUnitId = picked.size === 1 ? [...picked][0] : undefined;
  const lockedUnit = db.units.find((u) => u.id === lockedUnitId);
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.units.filter((u) => unitIds.includes(u.id) && u.status === 'ativo').map((u) => ({
      unit: u,
      items: db.equipments.filter((e) => e.unitId === u.id && (e.statusId !== 'STE-05' || selected.includes(e.id))
        && (!q || `${e.name} ${e.code} ${environmentName(db, e.environmentId)} ${u.name}`.toLowerCase().includes(q))),
    })).filter((g) => g.items.length);
  }, [db, unitIds, query, selected]);

  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((x) => x !== id));
  const toggleUnit = (ids: string[], on: boolean) => onChange(on ? [...new Set([...selected, ...ids])] : selected.filter((x) => !ids.includes(x)));

  return (
    <Stack gap="md">
      <Input
        type="search" aria-label="Buscar equipamento por nome, código, ambiente ou unidade" placeholder="Buscar equipamento"
        iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)}
      />
      <p className="field-note" aria-live="polite">{selected.length === 1 ? '1 equipamento selecionado' : `${selected.length} equipamentos selecionados`}</p>
      <DevNote note="Regra: um plano só pode ter equipamentos de uma mesma unidade. Ao escolher o primeiro equipamento, a unidade dele fica como a do plano e os equipamentos das outras unidades ficam desabilitados; esvaziar a seleção libera todas de novo. Planos antigos com equipamentos de várias unidades continuam editáveis (mostram erro ao salvar até ficarem em uma unidade).">
        <p className="field-note">{lockedUnit ? `Plano da unidade ${lockedUnit.name}: os equipamentos das outras unidades ficam indisponíveis` : 'Um plano só pode ter equipamentos de uma mesma unidade'}</p>
      </DevNote>
      {error && <Feedback type="error" message={error} />}
      {groups.length === 0 && <EmptyState title="Nenhum equipamento encontrado" description="Revise a busca." headingLevel={3} />}
      {groups.map(({ unit, items }) => {
        const ids = items.map((e) => e.id);
        const count = ids.filter((id) => selected.includes(id)).length;
        const blocked = !!lockedUnitId && unit.id !== lockedUnitId;
        return (
          <Stack as="fieldset" key={unit.id} gap="sm" className="check-group">
            <legend className="sr-only">{unit.name}</legend>
            <div className="pick-head">
              <Checkbox
                label={<span className="pick-unit">{unit.name}</span>} checked={count === ids.length} indeterminate={count > 0 && count < ids.length} disabled={blocked}
                onChange={(e) => toggleUnit(ids, e.target.checked)}
              />
              <span className="pick-count" aria-live="polite">{`${count} de ${items.length} selecionados`}</span>
            </div>
            <div className="check-group-grid pick-items">
              {items.map((e) => (
                <Checkbox
                  key={e.id} checked={selected.includes(e.id)} disabled={blocked} onChange={(ev) => toggle(e.id, ev.target.checked)}
                  label={<span className="pick-eq"><span className="pick-eq-name">{e.name}</span><span className="pick-eq-env">{environmentName(db, e.environmentId)}</span></span>}
                />
              ))}
            </div>
          </Stack>
        );
      })}
    </Stack>
  );
}

/** RF601-FLU008: associar/desassociar equipamentos depois de criado o plano. Só afeta execuções futuras (RGN004). */
export function PlanEquipmentsDialog({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const toast = useToast();
  const { user } = useSubSession();
  const [ids, setIds] = useState<string[]>(plan?.equipmentIds ?? []);
  const [tried, setTried] = useState(false);
  if (!plan) return null;

  const save = () => {
    setTried(true);
    if (!ids.length) return;
    const r = setPlanEquipments(plan, ids, user);
    toast.show({ type: 'success', title: 'Equipamentos atualizados', message: r.newOrders ? `${r.newOrders} OS preventiva${r.newOrders === 1 ? '' : 's'} gerada${r.newOrders === 1 ? '' : 's'} para os novos equipamentos.` : 'A alteração vale para as próximas execuções.' });
    onClose();
  };

  return (
    <Dialog
      open onClose={onClose} size="lg" title="Gerenciar equipamentos" subtitle="Selecione os equipamentos das próximas execuções deste plano, todos da mesma unidade"
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={save}>Salvar equipamentos</Button>
        </>
      )}
    >
      <Stack gap="md">
        <DevNote note="RF601-FLU008 / RGN004: equipamentos desassociados perdem as execuções futuras ainda não iniciadas (OS aberta é cancelada); novos equipamentos recebem execuções e OS a partir de hoje. Histórico é preservado. CTA002: o plano precisa de ao menos 1 equipamento.">
          <EquipmentPicker selected={ids} onChange={setIds} error={tried && !ids.length ? requiredMessage('Equipamentos') : undefined} />
        </DevNote>
      </Stack>
    </Dialog>
  );
}

/**
 * Faixa horizontal de categorias (substitui o grid, que no mobile ocupava muita altura): uma única linha que nunca quebra.
 * Desktop: 5 cartões visíveis. As setas ficam nas pontas da faixa (desabilitadas nos limites; rolam 2 cartões por clique). Mobile: ~2,5 cartões,
 * com parte do próximo à vista, rolagem por toque e as setas embaixo dos cartões (centralizadas), e sem prender a rolagem vertical da página. Navegar não muda a categoria escolhida.
 */
function CategoryStrip({ items, active, onPick }: { items: { id: string; name: string; icon?: string; total: number; chosen: number }[]; active: string; onPick: (id: string) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  const update = () => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  };
  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);
  const move = (dir: 1 | -1) => {
    const el = track.current;
    const card = el?.querySelector<HTMLElement>('.pick-cat');
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: dir * 2 * (card.offsetWidth + gap), behavior: 'smooth' });
  };
  return (
    <div className="pick-strip">
      <div ref={track} className="pick-strip-track" role="group" aria-label="Filtrar por categoria" onScroll={update}>
        {items.map((c) => (
          <button key={c.id} type="button" className="pick-cat" aria-pressed={active === c.id} onClick={() => onPick(active === c.id ? '' : c.id)}>
            <span className="pick-cat-icon"><CategoryIcon id={c.icon} size={28} /></span>
            <span className="pick-cat-text">
              <span className="pick-cat-name">{c.name}</span>
              <span className="pick-cat-count">{c.chosen ? `${c.chosen} de ${c.total}` : c.total === 1 ? '1 equipamento' : `${c.total} equipamentos`}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="pick-strip-nav">
        <Button variant="ghost" size="sm" iconOnly className="pick-strip-arrow pick-strip-arrow--prev" iconLeft={<IconChevronLeft size={20} />} aria-label="Ver categorias anteriores" disabled={edge.start} onClick={() => move(-1)} />
        <Button variant="ghost" size="sm" iconOnly className="pick-strip-arrow pick-strip-arrow--next" iconLeft={<IconChevronRight size={20} />} aria-label="Ver próximas categorias" disabled={edge.end} onClick={() => move(1)} />
      </div>
    </div>
  );
}

/** Miniatura do equipamento: foto real cadastrada ou, sem foto, o ícone da categoria em um quadro neutro (nunca uma imagem genérica que pareça foto). */
function EquipmentThumb({ equipment, icon }: { equipment: Equipment; icon?: string }) {
  const src = photoSrc(equipment.photoName);
  return src
    ? <img className="pick-thumb" src={src} alt="" loading="lazy" />
    : <span className="pick-thumb pick-thumb--icon" aria-hidden="true"><CategoryIcon id={icon} size={20} /></span>;
}

/**
 * v2 da seleção de equipamentos (pedido do cliente: no lugar da lista longa, categorias com ícone + busca + filtros por unidade e ambiente).
 * Mesma regra de uma unidade por plano e equipamento inativo fora. As categorias são filtros (um clique filtra, outro limpa) e mostram
 * quantos equipamentos têm e quantos já foram escolhidos; a lista abaixo continua agrupada por unidade, só com o que passa nos filtros.
 */
function EquipmentPickerV2({ selected, onChange, error }: { selected: string[]; onChange: (ids: string[]) => void; error?: string }) {
  const { db, unitIds } = useSubSession();
  const refs = useRefs();
  const [query, setQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [envFilter, setEnvFilter] = useState('');
  const [category, setCategory] = useState('');

  const picked = new Set(selected.map((id) => db.equipments.find((e) => e.id === id)?.unitId).filter(Boolean));
  const lockedUnitId = picked.size === 1 ? [...picked][0] : undefined;
  const lockedUnit = db.units.find((u) => u.id === lockedUnitId);

  const visibleUnits = db.units.filter((u) => unitIds.includes(u.id) && u.status === 'ativo');
  const envOptions = useMemo(() => {
    const names = new Set<string>();
    db.environments.filter((e) => visibleUnits.some((u) => u.id === e.unitId)).forEach((e) => names.add(e.name));
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [db.environments, visibleUnits.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Equipamentos que passam em busca, unidade e ambiente (a categoria entra depois, para os cartões mostrarem os totais de cada uma)
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.equipments.filter((e) => {
      const u = visibleUnits.find((x) => x.id === e.unitId);
      if (!u) return false;
      if (e.statusId === 'STE-05' && !selected.includes(e.id)) return false;
      if (unitFilter && e.unitId !== unitFilter) return false;
      const env = environmentName(db, e.environmentId);
      if (envFilter && env !== envFilter) return false;
      return !q || `${e.name} ${e.code} ${env} ${u.name}`.toLowerCase().includes(q);
    });
  }, [db, visibleUnits.length, query, unitFilter, envFilter, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = refs.admin.categories
    .map((c) => ({ c, total: base.filter((e) => e.categoryId === c.id).length, chosen: base.filter((e) => e.categoryId === c.id && selected.includes(e.id)).length }))
    .filter((x) => x.total > 0);

  const groups = visibleUnits
    .map((u) => ({ unit: u, items: base.filter((e) => e.unitId === u.id && (!category || e.categoryId === category)) }))
    .filter((g) => g.items.length);

  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((x) => x !== id));
  const toggleUnit = (ids: string[], on: boolean) => onChange(on ? [...new Set([...selected, ...ids])] : selected.filter((x) => !ids.includes(x)));
  const hasFilters = !!(query || unitFilter || envFilter || category);
  // Selecionados que os filtros atuais escondem: continuam no plano, só ficam fora da lista
  const visibleIds = new Set(groups.flatMap((g) => g.items.map((e) => e.id)));
  const hiddenSelected = selected.filter((id) => !visibleIds.has(id)).length;

  return (
    <Stack gap="md">
      <div className="pick-toolbar">
        <ListFilters
          searchLabel="Buscar equipamento por nome, código, ambiente ou unidade" placeholder="Buscar equipamento" query={query} onQuery={setQuery}
          filterControl={(
            <FilterControl
              note="v2: os filtros de Unidade e Ambiente ficam agrupados no botão Filtros, no mesmo padrão das tabelas; só mudam a lista ao clicar em Aplicar, e Limpar volta tudo para Todos."
              filters={[
                { id: 'unit', label: 'Unidade', value: unitFilter || 'todos', onChange: (v) => setUnitFilter(v === 'todos' ? '' : v), options: [{ value: 'todos', label: 'Todas as unidades' }, ...visibleUnits.map((u) => ({ value: u.id, label: u.name }))] },
                { id: 'env', label: 'Ambiente', value: envFilter || 'todos', onChange: (v) => setEnvFilter(v === 'todos' ? '' : v), options: [{ value: 'todos', label: 'Todos os ambientes' }, ...envOptions.map((n) => ({ value: n, label: n }))] },
              ]}
            />
          )}
        />
      </div>
      <CategoryStrip items={categories.map(({ c, total, chosen }) => ({ id: c.id, name: c.name, icon: c.icon, total, chosen }))} active={category} onPick={setCategory} />
      <p className="field-note" aria-live="polite">{selected.length === 1 ? '1 equipamento selecionado' : `${selected.length} equipamentos selecionados`}{hiddenSelected > 0 ? ` · ${hiddenSelected} fora dos filtros atuais` : ''}</p>
      <DevNote note="Seleção visual por categorias com ícone grande (cartões de mesma largura, distribuídos em linhas equilibradas conforme a largura), miniatura do equipamento (foto real cadastrada ou o ícone da categoria quando não há foto), busca textual e filtros por unidade e ambiente, no lugar da lista longa de nomes. Categoria é um filtro (clicar de novo limpa) com a contagem de equipamentos e de escolhidos; os totais respeitam a busca, a unidade e o ambiente. A regra de uma unidade por plano continua: escolhido o primeiro equipamento, as outras unidades ficam indisponíveis. Selecionar a unidade toda vale só para o que está filtrado.">
        <p className="field-note">{lockedUnit ? `Plano da unidade ${lockedUnit.name}: os equipamentos das outras unidades ficam indisponíveis` : 'Um plano só pode ter equipamentos de uma mesma unidade'}</p>
      </DevNote>
      {error && <Feedback type="error" message={error} />}
      {groups.length === 0 && <EmptyState title="Nenhum equipamento encontrado" description={hasFilters ? 'Revise a busca ou limpe os filtros.' : 'Não há equipamentos ativos para escolher.'} headingLevel={3} action={hasFilters ? <Button size="sm" variant="secondary" onClick={() => { setQuery(''); setUnitFilter(''); setEnvFilter(''); setCategory(''); }}>Limpar filtros</Button> : undefined} />}
      {groups.map(({ unit, items }) => {
        const ids = items.map((e) => e.id);
        const count = ids.filter((id) => selected.includes(id)).length;
        const blocked = !!lockedUnitId && unit.id !== lockedUnitId;
        return (
          <Stack as="fieldset" key={unit.id} gap="sm" className="check-group">
            <legend className="sr-only">{unit.name}</legend>
            <div className="pick-head">
              <Checkbox
                label={<span className="pick-unit">{unit.name}</span>} checked={count === ids.length} indeterminate={count > 0 && count < ids.length} disabled={blocked}
                onChange={(e) => toggleUnit(ids, e.target.checked)}
              />
              <span className="pick-count" aria-live="polite">{`${count} de ${items.length} selecionados`}</span>
            </div>
            <div className="check-group-grid pick-items">
              {items.map((e) => (
                <Checkbox
                  key={e.id} checked={selected.includes(e.id)} disabled={blocked} onChange={(ev) => toggle(e.id, ev.target.checked)}
                  label={<span className="pick-eq pick-eq--media"><EquipmentThumb equipment={e} icon={refs.category(e.categoryId)?.icon} /><span className="pick-eq-text"><span className="pick-eq-name">{e.name}</span><span className="pick-eq-env">{environmentName(db, e.environmentId)}</span></span></span>}
                />
              ))}
            </div>
          </Stack>
        );
      })}
    </Stack>
  );
}
