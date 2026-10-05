import { KeyboardEvent, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { Button, FormField, Input, Stack } from '@maglev/ds';
import { ICON_GROUPS, iconById } from './icon-catalog';
import { normalize } from './format';
import { Text } from './ui';

/** Ícone de uma categoria a partir do identificador salvo; sem ícone (ou id desconhecido) não renderiza nada. */
export function CategoryIcon({ id, size = 16 }: { id?: string; size?: number }) {
  const found = iconById(id);
  return found ? <span className="category-icon" aria-hidden="true"><found.Icon size={size} /></span> : null;
}

/**
 * Seleção de ícone (opcional) para categorias. Mostra o ícone atual e abre um painel, dentro do próprio formulário,
 * com busca por nome amigável e palavras-chave e a grade do catálogo curado (`icon-catalog.ts`).
 * Salva só o identificador estável (`onChange(id)`); `onChange(undefined)` remove o ícone.
 */
export function IconPicker({ value, onChange }: { value?: string; onChange: (id?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const panelId = useId();
  const fieldId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = iconById(value);

  const groups = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return ICON_GROUPS;
    const hits = ICON_GROUPS.flatMap((g) => g.icons).filter((c) => normalize(c.name).includes(q) || c.keywords.some((k) => normalize(k).includes(q)));
    return hits.length ? [{ label: `${hits.length} ${hits.length === 1 ? 'resultado' : 'resultados'}`, icons: hits }] : [];
  }, [query]);

  /** Nome do ícone sob o mouse/foco: renderizado no <body> para não ser cortado pela área rolável nem ficar atrás da busca. */
  const [tip, setTip] = useState<{ name: string; x: number; y: number } | null>(null);
  const showTip = (name: string, el: HTMLElement) => { const r = el.getBoundingClientRect(); setTip({ name, x: r.left + r.width / 2, y: r.top }); };

  const close = () => { setTip(null); setOpen(false); setQuery(''); document.getElementById(fieldId)?.focus(); };
  const pick = (id: string) => { onChange(id); close(); };

  /** Esc fecha só o painel (não o modal); setas movem o foco pela grade. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const cells = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('.icon-cell') ?? []);
    const at = cells.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    const cols = cells.filter((c) => c.offsetTop === cells[0].offsetTop).length || 1;
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key as 'ArrowRight'];
    cells[Math.min(Math.max(at + step, 0), cells.length - 1)]?.focus();
  };

  return (
    <FormField label="Ícone" optional id={fieldId}>
      {(control) => (
        <div className="icon-picker">
          <div className="icon-picker-row">
            {/* Dica só ao passar o mouse (não no foco que volta ao fechar o painel) e fora do corte do modal */}
            <Button
              id={control.id} variant="secondary" iconOnly className={`icon-picker-trigger${selected ? ' has-icon' : ''}`}
              iconLeft={selected ? <selected.Icon size={24} /> : <IconPlus size={20} />}
              aria-label={selected ? 'Alterar ícone' : 'Selecionar ícone'} aria-expanded={open} aria-controls={open ? panelId : undefined}
              onMouseEnter={(e) => showTip(selected ? 'Alterar ícone' : 'Selecionar ícone', e.currentTarget)} onMouseLeave={() => setTip(null)}
              onClick={() => { setTip(null); if (open) close(); else setOpen(true); }}
            />
            {selected && (
              <Button
                size="sm" variant="ghost" iconOnly className="icon-picker-remove" iconLeft={<IconX size={16} />} aria-label="Remover ícone"
                onMouseEnter={(e) => showTip('Remover ícone', e.currentTarget)} onFocus={(e) => showTip('Remover ícone', e.currentTarget)}
                onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)}
                onClick={() => { setTip(null); onChange(undefined); }}
              />
            )}
          </div>

          {tip && createPortal(<div role="tooltip" className="icon-tip" style={{ left: tip.x, top: tip.y }}>{tip.name}</div>, document.body)}
          {open && (
            <div id={panelId} ref={panelRef} className="icon-picker-panel" role="group" aria-label="Selecionar ícone" onKeyDown={onKeyDown}>
              <Input
                type="search" aria-label="Buscar ícone" placeholder="Buscar ícone" autoFocus
                iconLeft={<IconSearch size={20} />} value={query} onChange={(e) => setQuery(e.target.value)}
              />
              <div className="icon-picker-list">
                {groups.length === 0 ? (
                  <Stack gap="2xs">
                    <Text>Nenhum ícone encontrado</Text>
                    <Text>Tente outra palavra, como “frio”, “forno” ou “água”</Text>
                  </Stack>
                ) : (
                  <Stack gap="md">
                    {groups.map((g) => (
                      <Stack gap="xs" key={g.label}>
                        <span className="page-label">{g.label}</span>
                        <div className="icon-grid">
                          {g.icons.map((c) => (
                <button
                              key={c.id} type="button" className="icon-cell" aria-label={c.name} aria-pressed={c.id === value}
                              onClick={() => pick(c.id)}
                              onMouseEnter={(e) => showTip(c.name, e.currentTarget)} onFocus={(e) => showTip(c.name, e.currentTarget)}
                              onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)}
                            >
                              <c.Icon size={24} />
                              {c.id === value && <span className="icon-cell-check" aria-hidden="true"><IconCheck size={12} /></span>}
                            </button>
                          ))}
                        </div>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </FormField>
  );
}
