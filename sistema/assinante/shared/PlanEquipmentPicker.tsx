import { useMemo, useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { Button, Checkbox, Dialog, EmptyState, Feedback, Input, Stack, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { requiredMessage } from '../../admin/shared/format';
import { Plan } from './data';
import { setPlanEquipments } from './preventivas';
import { environmentName, useSubSession } from './store';
import { Text } from './ui';

/**
 * Seleção de equipamentos do plano (RF601-FLU002): vários equipamentos de uma ou mais unidades, agrupados por unidade,
 * com busca e "selecionar a unidade toda". Equipamento inativo não é ofertado.
 */
export function EquipmentPicker({ selected, onChange, error }: { selected: string[]; onChange: (ids: string[]) => void; error?: string }) {
  const { db, unitIds } = useSubSession();
  const [query, setQuery] = useState('');
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
      {error && <Feedback type="error" message={error} />}
      {groups.length === 0 && <EmptyState title="Nenhum equipamento encontrado" description="Revise a busca." headingLevel={3} />}
      {groups.map(({ unit, items }) => {
        const ids = items.map((e) => e.id);
        const count = ids.filter((id) => selected.includes(id)).length;
        return (
          <Stack as="fieldset" key={unit.id} gap="sm" className="check-group">
            <legend className="sr-only">{unit.name}</legend>
            <div className="pick-head">
              <Checkbox
                label={<span className="pick-unit">{unit.name}</span>} checked={count === ids.length} indeterminate={count > 0 && count < ids.length}
                onChange={(e) => toggleUnit(ids, e.target.checked)}
              />
              <span className="pick-count" aria-live="polite">{`${count} de ${items.length} selecionados`}</span>
            </div>
            <div className="check-group-grid pick-items">
              {items.map((e) => (
                <Checkbox
                  key={e.id} checked={selected.includes(e.id)} onChange={(ev) => toggle(e.id, ev.target.checked)}
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
      open onClose={onClose} size="lg" title="Gerenciar equipamentos" subtitle="Selecione os equipamentos que farão parte das próximas execuções deste plano"
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
