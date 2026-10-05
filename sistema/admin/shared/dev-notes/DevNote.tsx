import { ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge, Card } from '@maglev/ds';
import { useDevNotesEnabled } from './devNotesFlag';
import './dev-notes.css';

export interface DevNoteProps {
  /** Texto da nota, direcionado ao time de desenvolvimento. */
  note: ReactNode;
  /** O elemento da interface a que a nota se refere. */
  children: ReactNode;
}

/**
 * Nota para desenvolvimento ancorada ao elemento relacionado, como um comentário:
 * um pin numerado aparece sobre o elemento e abre a nota ao clicar.
 * Só existe no protótipo, e só quando "Notas para desenvolvimento" está ligado no
 * Navegador de Protótipo. Nunca faz parte da interface final.
 *
 *   <DevNote note="Nova remessa não impacta outras páginas."><Button>Salvar</Button></DevNote>
 */
export function DevNote({ note, children }: DevNoteProps) {
  const [enabled] = useDevNotesEnabled();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const noteId = useId();

  // O popover vai para o <body> (portal): o Card do DS usa overflow hidden e cortaria a nota.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const pin = pinRef.current?.getBoundingClientRect();
      const pop = popRef.current?.getBoundingClientRect();
      if (!pin) return;
      const width = pop?.width ?? 0;
      const gutter = 8;
      const left = Math.min(Math.max(gutter, pin.right - width), window.innerWidth - width - gutter);
      setPos({ top: pin.bottom + gutter, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { const t = e.target as Node; if (!rootRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`dev-anchor${enabled ? ' is-annotated' : ''}`} ref={rootRef}>
      {children}
      {enabled && (
        <>
          <button
            type="button"
            ref={pinRef}
            className="dev-pin"
            aria-label="Nota para desenvolvimento"
            aria-expanded={open}
            aria-controls={noteId}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="dev-pin-num" aria-hidden="true" />
          </button>
          {open && createPortal(
            <div
              ref={popRef}
              className="dev-note-popover"
              id={noteId}
              role="region"
              aria-label="Nota para desenvolvimento"
              style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
            >
              <Card padding="md">
                <div className="dev-note-body">
                  <Badge status="info">Nota para desenvolvimento</Badge>
                  <p className="dev-note-text">{note}</p>
                </div>
              </Card>
            </div>,
            document.body,
          )}
        </>
      )}
    </div>
  );
}
