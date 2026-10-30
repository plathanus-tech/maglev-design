import { useState } from 'react';
import { Button, Dialog, Input, Stack } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { normalize, requiredMessage } from '../../admin/shared/format';
import { ChecklistItem, ChecklistTemplate } from './data';

/** Itens de checklist que podem ser salvos: só os procedimentos (as medições são configuradas na etapa de Evidências e não entram). */
export const savableItems = (items: ChecklistItem[]) => items.filter((c) => c.kind !== 'leitura' && c.text.trim());

/** Salvar o checklist do plano como modelo, com nome, para reaproveitar em outros planos. */
export function SaveChecklistDialog({ items, templates, onClose, onSave, initialName }: {
  items: ChecklistItem[]; templates: ChecklistTemplate[]; onClose: () => void; onSave: (name: string) => void; /** Variante do navegador: já abre com este nome e os erros à mostra. */ initialName?: string;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [tried, setTried] = useState(!!initialName);
  const clean = name.trim();
  const dup = templates.some((t) => normalize(t.name) === normalize(clean));
  const error = !tried ? undefined : !clean ? requiredMessage('Nome do checklist') : dup ? 'Já existe um checklist salvo com este nome' : undefined;
  const n = items.length;
  const submit = () => { setTried(true); if (clean && !dup) onSave(clean); };
  return (
    <Dialog
      open onClose={onClose} size="sm" title="Salvar checklist"
      subtitle="Guarde estes itens com um nome para reaproveitar em outros planos"
      actions={<><Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button><Button size="sm" onClick={submit}>Salvar checklist</Button></>}
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <Stack gap="md">
          <DevNote note="Checklist salvo (modelo reutilizável do assinante): guarda só os itens de procedimento do passo Checklist (descrição e tipo); as medições ficam de fora porque são configuradas no passo Evidências e anomalia. O nome é obrigatório e único entre os checklists salvos (sem diferenciar maiúsculas e acentos). Salvar não altera o plano: o checklist continua sendo editado no plano normalmente, e mudar o modelo salvo depois não muda planos já criados. 💡 Gerenciar (renomear, excluir) os checklists salvos fica para depois, a confirmar.">
            <Input label="Nome do checklist" required autoComplete="off" placeholder="Ex.: Higienização da câmara fria" value={name} onChange={(e) => { setName(e.target.value); setTried(false); }} error={error} />
          </DevNote>
          <p className="field-note">{`${n} ${n === 1 ? 'item do checklist será salvo' : 'itens do checklist serão salvos'}`}</p>
        </Stack>
      </form>
    </Dialog>
  );
}

/** Confirma trocar os itens atuais pelos do checklist salvo (só quando já há itens preenchidos). */
export function ReplaceChecklistDialog({ template, onClose, onConfirm }: { template: ChecklistTemplate; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog
      open onClose={onClose} size="sm" className="dialog-confirm" title={`Usar o checklist “${template.name}”?`}
      subtitle="Os itens atuais do checklist serão substituídos pelos do checklist salvo. Depois você pode editar, remover e adicionar itens"
      actions={<><Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button><Button size="sm" onClick={onConfirm}>Substituir itens</Button></>}
    />
  );
}

/** Texto de apoio de um checklist salvo na lista de busca. */
export const templateHint = (t: ChecklistTemplate) => `${t.items.length} ${t.items.length === 1 ? 'item' : 'itens'} · ${t.items.slice(0, 2).map((i) => i.text).join(', ')}${t.items.length > 2 ? '…' : ''}`;
