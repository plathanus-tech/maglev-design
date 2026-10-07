import { Button, Dialog, Feedback, Stack, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { SubDb, Unit } from './data';
import { updateSubDb, useSubSession } from './store';
import { linksSentence, unitLinks } from './estrutura-utils';
import { Text } from './ui';

/**
 * Confirmações de Unidades (RF202), compartilhadas entre a listagem e a visualização:
 * ativar/inativar, excluir sem vínculos (confirmação) e excluir com vínculos (bloqueado, orienta inativar).
 */
export function UnitDialogs({ toggling, deleting, setToggling, setDeleting, onDeleted }: {
  toggling: Unit | null; deleting: Unit | null;
  setToggling: (u: Unit | null) => void; setDeleting: (u: Unit | null) => void;
  /** Chamado após excluir (a visualização volta para a listagem); sem ele, só mostra o Toast. */
  onDeleted?: (u: Unit) => void;
}) {
  const toast = useToast();
  const { db, can } = useSubSession();

  const confirmToggle = () => {
    if (!toggling) return;
    const deactivate = toggling.status === 'ativo';
    updateSubDb((d) => ({ ...d, units: d.units.map((u) => (u.id === toggling.id ? { ...u, status: deactivate ? 'inativo' : 'ativo' } : u)) }));
    toast.show(deactivate
      ? { type: 'success', title: 'Unidade inativada', message: 'Ela não aparece mais em novos cadastros e solicitações. Os registros existentes foram mantidos' }
      : { type: 'success', title: 'Unidade ativada', message: 'Ela voltou a aparecer em novos cadastros e solicitações' });
    setToggling(null);
  };
  const confirmDelete = () => {
    if (!deleting) return;
    const gone = deleting;
    updateSubDb((d) => ({ ...d, units: d.units.filter((u) => u.id !== gone.id), users: d.users.map((u) => ({ ...u, unitIds: u.unitIds.filter((x) => x !== gone.id) })) }));
    if (onDeleted) onDeleted(gone);
    else toast.show({ type: 'success', title: 'Unidade excluída', message: `${gone.name} foi removida` });
    setDeleting(null);
  };

  const deleteLinks = deleting ? unitLinks(db, deleting.id) : null;

  return (
    <>
      {toggling && (
        <Dialog
          open onClose={() => setToggling(null)} size="sm" className="dialog-confirm"
          title={toggling.status === 'ativo' ? `Inativar ${toggling.name}?` : `Ativar ${toggling.name}?`}
          subtitle={toggling.status === 'ativo'
            ? 'A unidade deixará de aparecer em novos cadastros e solicitações. Ambientes, equipamentos e histórico serão mantidos'
            : 'A unidade voltará a aparecer em novos cadastros e solicitações'}
          actions={(
            <>
              <Button size="sm" variant="secondary" onClick={() => setToggling(null)}>Cancelar</Button>
              {toggling.status === 'ativo'
                ? <DevNote note="RF202-RGN002 / CTA002: unidade inativa não é ofertada em novos cadastros (ambientes, equipamentos, usuários) nem em novas solicitações; ambientes, equipamentos e histórico continuam consultáveis."><Button size="sm" variant="destructive" onClick={confirmToggle}>Inativar unidade</Button></DevNote>
                : <Button size="sm" onClick={confirmToggle}>Ativar unidade</Button>}
            </>
          )}
        />
      )}

      {deleting && deleteLinks && (deleteLinks.total > 0 ? (
        <Dialog
          open onClose={() => setDeleting(null)} size="sm" className="dialog-confirm" title={`Não é possível excluir ${deleting.name}`}
          subtitle="Para preservar o histórico, você pode inativar a unidade. Ela deixará de aparecer em novos cadastros e solicitações"
          actions={(
            <>
              <Button size="sm" variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
              {deleting.status === 'ativo' && can('unidades', 'ativar') && (
                <Button size="sm" onClick={() => { setToggling(deleting); setDeleting(null); }}>Inativar unidade</Button>
              )}
            </>
          )}
        >
          <DevNote note="RF202-RGN002 / CTA003 / FLU004: unidade com registros vinculados (ambientes, equipamentos, solicitações, OS) é bloqueada e o sistema orienta a inativar.">
            <Feedback type="warning" title="Esta unidade possui registros vinculados" message={linksSentence(deleteLinks)} />
          </DevNote>
        </Dialog>
      ) : (
        <Dialog
          open onClose={() => setDeleting(null)} size="sm" className="dialog-confirm" title={`Excluir ${deleting.name}?`}
          actions={(
            <>
              <Button size="sm" variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
              <Button size="sm" variant="destructive" onClick={confirmDelete}>Excluir unidade</Button>
            </>
          )}
        >
          <DevNote note="RF202-RGN003 / FLU004: unidade sem nenhum registro vinculado pode ser excluída, com confirmação. A exclusão não pode ser desfeita.">
            <Text>Esta unidade não tem ambientes, equipamentos, solicitações nem ordens de serviço. A exclusão não pode ser desfeita</Text>
          </DevNote>
        </Dialog>
      ))}
    </>
  );
}

/** Variante `#state=delete`: precisa de uma unidade sem vínculos; se não houver, cria uma de demonstração. */
export function demoDeletableUnit(db: SubDb, tradeName: string, newId: string): Unit {
  const found = db.units.find((u) => unitLinks(db, u.id).total === 0);
  if (found) return found;
  const created: Unit = { id: newId, name: `${tradeName} Pinheira`, code: 'DR-NOVA', cep: '88010000', street: 'Rua Tenente Silveira', number: '210', district: 'Centro', city: 'Florianópolis', uf: 'SC', phone: '4832215500', status: 'ativo', managerId: db.units[0].managerId };
  updateSubDb((d) => ({ ...d, units: [...d.units, created] }));
  return created;
}
