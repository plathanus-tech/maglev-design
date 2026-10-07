import { KeyboardEvent, ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { IconBuildingStore, IconClipboardList, IconHelp, IconMessageReport, IconMicrowave, IconSearch, IconTruck } from '@tabler/icons-react';
import { Button, Input, Spinner, Tooltip } from '@maglev/ds';
import { normalize } from '../../admin/shared/format';
import { SubDb } from './data';
import { equipmentOf, environmentName, ordersVisible, requestsVisible, unitName, useSubSession } from './store';
import { useRefs } from './ui';

/**
 * Busca global do cabeçalho (RF101-FLU004): localiza e abre registros de Equipamentos, Solicitações, OS, Unidades e
 * Prestadores sem página de resultados - tudo no próprio campo + lista de resultados agrupada por tipo.
 * Respeita permissão (`can`) e contexto do usuário (unidades vinculadas; Executor só as OS dele).
 * Teclado: setas navegam, Enter abre, Esc fecha (padrão combobox/listbox).
 */
type Kind = 'equipamentos' | 'solicitacoes' | 'os' | 'unidades' | 'prestadores';
interface Hit { id: string; kind: Kind; title: string; subtitle: string; href: string }

const GROUPS: Array<{ kind: Kind; label: string; icon: ReactNode }> = [
  { kind: 'equipamentos', label: 'Equipamentos', icon: <IconMicrowave size={16} /> },
  { kind: 'os', label: 'Ordens de serviço', icon: <IconClipboardList size={16} /> },
  { kind: 'solicitacoes', label: 'Solicitações', icon: <IconMessageReport size={16} /> },
  { kind: 'unidades', label: 'Unidades', icon: <IconBuildingStore size={16} /> },
  { kind: 'prestadores', label: 'Prestadores', icon: <IconTruck size={16} /> },
];
const PER_GROUP = 4;
const MIN_CHARS = 2;
const DELAY_MS = 250; // simula a consulta (estado de carregamento)

const has = (q: string, ...fields: Array<string | undefined>) => fields.some((f) => f && normalize(f).includes(q));

function search(query: string, db: SubDb, ctx: { can: ReturnType<typeof useSubSession>['can']; unitIds: string[]; userId: string; executor: boolean; type: (id: string) => string }): Hit[] {
  const q = normalize(query);
  const out: Hit[] = [];
  const add = (hit: Hit) => out.push(hit);

  if (ctx.can('equipamentos')) {
    db.equipments.filter((e) => ctx.unitIds.includes(e.unitId) && has(q, e.name, e.code, e.model, e.maker, e.serial)).forEach((e) =>
      add({ id: e.id, kind: 'equipamentos', title: e.name, subtitle: `${unitName(db, e.unitId)} · ${environmentName(db, e.environmentId)}`, href: `equipamento.html?id=${e.id}` }));
  }
  if (ctx.can('os')) {
    ordersVisible(db, ctx.unitIds, ctx.userId, ctx.executor).filter((o) => has(q, o.id, o.subject, equipmentOf(db, o.equipmentId)?.name)).forEach((o) =>
      add({ id: o.id, kind: 'os', title: `${o.id} · ${equipmentOf(db, o.equipmentId)?.name ?? ''}`, subtitle: o.subject, href: `os.html?id=${o.id}` }));
  }
  if (ctx.can('solicitacoes')) {
    requestsVisible(db, ctx.unitIds).filter((r) => has(q, r.id, r.description, equipmentOf(db, r.equipmentId)?.name, ctx.type(r.problemId))).forEach((r) =>
      add({ id: r.id, kind: 'solicitacoes', title: `${r.id} · ${ctx.type(r.problemId)}`, subtitle: equipmentOf(db, r.equipmentId)?.name ?? '', href: `solicitacao.html?id=${r.id}` }));
  }
  if (ctx.can('unidades')) {
    db.units.filter((u) => ctx.unitIds.includes(u.id) && has(q, u.name, u.code, u.city)).forEach((u) =>
      add({ id: u.id, kind: 'unidades', title: u.name, subtitle: `${u.city}/${u.uf} · ${u.code}`, href: `unidade.html?id=${u.id}` }));
  }
  if (ctx.can('prestadores')) {
    db.providers.filter((p) => has(q, p.name, p.tradeName, ...p.specialties)).forEach((p) =>
      add({ id: p.id, kind: 'prestadores', title: p.tradeName || p.name, subtitle: p.specialties.join(', '), href: `prestador.html?id=${p.id}` }));
  }
  return GROUPS.flatMap((g) => out.filter((h) => h.kind === g.kind).slice(0, PER_GROUP));
}

export function GlobalSearch() {
  const { db, can, unitIds, user } = useSubSession();
  const refs = useRefs();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const ready = query.trim().length >= MIN_CHARS;

  const requestType = (id: string) => refs.requestType(id)?.name ?? 'Solicitação';
  const ctx = useMemo(
    () => ({ can, unitIds, userId: user.id, executor: user.profile === 'executor', type: requestType }),
    [can, unitIds, user.id, user.profile], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Consulta com atraso curto: mostra "carregando" e, depois, resultados ou "nenhum resultado"
  useEffect(() => {
    setActive(-1);
    if (!ready) { setLoading(false); setHits([]); return; }
    setLoading(true);
    const t = window.setTimeout(() => { setHits(search(query.trim(), db, ctx)); setLoading(false); }, DELAY_MS);
    return () => window.clearTimeout(t);
  }, [query, ready, db, ctx]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const go = (h: Hit) => { setOpen(false); window.location.href = h.href; };
  const optionId = (i: number) => `${baseId}-opt-${i}`;
  const showPanel = open && ready;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { if (open) { e.preventDefault(); setOpen(false); } return; }
    if (!ready) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (!hits.length) return;
      setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % hits.length : (i <= 0 ? hits.length - 1 : i - 1)));
    } else if (e.key === 'Enter' && showPanel && active >= 0 && hits[active]) {
      e.preventDefault();
      go(hits[active]);
    }
  };

  useEffect(() => { if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' }); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  let flat = -1;
  return (
    <div className="gsearch" ref={rootRef}>
      <Input
        type="search"
        aria-label="Busca global"
        placeholder="Buscar equipamentos, solicitações, OS..."
        iconLeft={<IconSearch size={20} />}
        autoComplete="off"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && active >= 0 ? optionId(active) : undefined}
      />
      {showPanel && (
        <div className="gsearch-panel">
          {loading ? (
            <div className="gsearch-state"><Spinner size="sm" label="Buscando resultados" /><span>Buscando...</span></div>
          ) : hits.length === 0 ? (
            <p className="gsearch-state" role="status">Nenhum resultado para “{query.trim()}”</p>
          ) : (
            <div id={listId} role="listbox" aria-label="Resultados da busca">
              {GROUPS.filter((g) => hits.some((h) => h.kind === g.kind)).map((g) => (
                <div key={g.kind} role="group" aria-label={g.label}>
                  <div className="gsearch-group" aria-hidden="true">{g.label}</div>
                  {hits.filter((h) => h.kind === g.kind).map((h) => {
                    flat += 1;
                    const i = flat;
                    return (
                      <div
                        key={h.id} id={optionId(i)} role="option" aria-selected={active === i}
                        className={`gsearch-option${active === i ? ' is-active' : ''}`}
                        onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => go(h)}
                      >
                        <span className="gsearch-icon" aria-hidden="true">{g.icon}</span>
                        <span className="gsearch-text">
                          <span className="gsearch-title">{h.title}</span>
                          <span className="cell-secondary">{h.subtitle}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Ajuda (genérica): o canal definitivo de atendimento ainda será validado com o cliente. Quando definido, preencha
 * `SUPPORT_CHANNEL` (WhatsApp ou e-mail) e o botão passa a abrir o canal; até lá, informa que o canal virá em breve.
 * Não há número, e-mail, central de ajuda nem FAQ aqui.
 */
export const SUPPORT_CHANNEL: { kind: 'whatsapp' | 'email' | null; url: string | null } = { kind: null, url: null };

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const configured = !!SUPPORT_CHANNEL.url;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const onClick = () => {
    if (configured) { window.open(SUPPORT_CHANNEL.url!, '_blank', 'noopener,noreferrer'); return; }
    setOpen((v) => !v);
  };
  return (
    <div className="bell-root" ref={rootRef}>
      <Tooltip content="Ajuda" placement="bottom">
        <Button variant="ghost" iconOnly className="theme-btn" iconLeft={<IconHelp size={16} />} aria-label="Ajuda" aria-expanded={configured ? undefined : open} aria-haspopup={configured ? undefined : 'true'} onClick={onClick} />
      </Tooltip>
      {open && (
        <div className="bell-panel" role="region" aria-label="Ajuda">
          <div className="bell-head"><span className="user-menu-name">Ajuda</span></div>
          <div className="user-menu-sep" role="separator" />
          <p className="bell-empty">O canal de atendimento do suporte Maglev será disponibilizado em breve</p>
        </div>
      )}
    </div>
  );
}
