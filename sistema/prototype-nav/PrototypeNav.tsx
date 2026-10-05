import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconChevronLeft, IconChevronRight, IconCode, IconDeviceDesktop, IconDeviceMobile,
  IconExternalLink, IconGitBranch, IconMoon, IconRefresh, IconRoute, IconSearch, IconShield, IconSun,
} from '@tabler/icons-react';
import { useDevNotesEnabled } from '../admin/shared/dev-notes/devNotesFlag';
import { useTheme } from '../admin/shared/theme';
import { resetDb } from '../admin/shared/store';
import { HoverPreview, Thumb, type Device } from './Thumb';
import { journeys, type FlowNode, type ScreenNode } from './config';

interface Entry { id: string; label: string; path: string; mobilePath?: string; trail: string; groups: string[] }

const STORAGE_KEY = 'maglev.v2.protoNav.state';
const isFlow = (n: ScreenNode | FlowNode): n is FlowNode => 'type' in n && n.type === 'flow';

/** Achata a config em uma lista de telas/variantes navegáveis. */
function flatten(): Entry[] {
  const out: Entry[] = [];
  const addScreen = (s: ScreenNode, trail: string, groups: string[]) => {
    out.push({ id: s.id, label: s.label, path: s.path, mobilePath: s.mobilePath, trail, groups });
    s.variants?.forEach((v) =>
      out.push({ id: v.id, label: v.label, path: v.path, trail: `${trail} / ${s.label}`, groups: [...groups, `v:${s.id}`] }));
  };
  journeys.forEach((j) => j.items.forEach((n) => {
    if (isFlow(n)) n.screens.forEach((s) => addScreen(s, `${j.label} / ${n.label}`, [j.id, n.id]));
    else addScreen(n, j.label, [j.id]);
  }));
  return out;
}

function load(): { open: string[]; collapsed: boolean; device: Device } {
  const base = { open: [] as string[], collapsed: false, device: 'desktop' as Device };
  try { return { ...base, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }; }
  catch { return base; }
}

export function PrototypeNav() {
  const entries = useMemo(flatten, []);
  const saved = useMemo(load, []);
  const [device, setDevice] = useState<Device>(saved.device);
  const [collapsed, setCollapsed] = useState(saved.collapsed);
  const [open, setOpen] = useState<string[]>(saved.open.length ? saved.open : journeys.flatMap((j) => [j.id, ...j.items.filter(isFlow).map((f) => f.id)]));
  const [query, setQuery] = useState('');
  const [notesOn, setNotesOn] = useDevNotesEnabled();
  const [theme, setTheme] = useTheme();
  const [hover, setHover] = useState<{ src: string; rect: DOMRect } | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const hideTimer = useRef<number>();
  const [currentId, setCurrentId] = useState(() => entries.find((e) => e.id === location.hash.slice(1))?.id ?? entries[0]?.id);
  const [frameSrc, setFrameSrc] = useState(() => (entries.find((e) => e.id === currentId) ?? entries[0])?.path ?? '');

  const current = entries.find((e) => e.id === currentId);
  const srcFor = (e: Entry | undefined, d: Device) => (d === 'mobile' && e?.mobilePath) || e?.path || '';

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ open, collapsed, device })); } catch { /* sem storage */ }
  }, [open, collapsed, device]);

  // A tela dentro do iframe avisa qual página/variante está aberta (admin/shared/nav-sync.ts).
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      // Só a tela principal comanda a seleção; miniaturas e prévias também enviam a mensagem.
      if (ev.source !== frameRef.current?.contentWindow || ev.data?.source !== 'maglev-proto-nav') return;
      const url = new URL(ev.data.href);
      // Caminho relativo + query (sem `as=`/`thumb=`) + hash, no mesmo formato de config.ts.
      const search = url.search.replace(/[?&](as|thumb)=[^&]*/g, '').replace(/^&/, '?');
      const rel = url.pathname.replace(/^\//, '') + search + url.hash;
      const hit = entries.find((e) => e.path === rel) ?? entries.find((e) => rel.startsWith(e.path.split('#')[0]));
      if (hit) setCurrentId(hit.id);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [entries]);

  useEffect(() => { history.replaceState(null, '', `#${currentId}`); }, [currentId]);

  // Expande a árvore até o item ativo (jornada, fluxo e variantes).
  useEffect(() => {
    const groups = entries.find((e) => e.id === currentId)?.groups ?? [];
    setOpen((o) => (groups.every((g) => o.includes(g)) ? o : [...new Set([...o, ...groups])]));
  }, [currentId, entries]);

  const select = (e: Entry) => { setCurrentId(e.id); setFrameSrc(srcFor(e, device)); };
  const changeDevice = (d: Device) => { setDevice(d); setFrameSrc(srcFor(current, d)); };
  const toggle = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const matches = (label: string) => !query.trim() || label.toLowerCase().includes(query.trim().toLowerCase());

  const item = (id: string, label: string, variant = false, extra?: ReactNode) => {
    const e = entries.find((x) => x.id === id)!;
    return matches(label) && (
      <div key={id} className={`pn-item${variant ? ' pn-item--variant' : ''}${currentId === id ? ' is-active' : ''}`}>
        <Thumb
          src={srcFor(e, device)}
          device={device}
          size={variant ? 44 : 56}
          onHover={(rect) => { window.clearTimeout(hideTimer.current); setHover({ src: srcFor(e, device), rect }); }}
          onLeave={() => { hideTimer.current = window.setTimeout(() => setHover(null), 80); }}
          onClick={() => select(e)}
        />
        <button
          type="button"
          className="pn-item-label"
          aria-current={currentId === id ? 'page' : undefined}
          onClick={() => select(e)}
        >{label}</button>
        {extra}
      </div>
    );
  };

  const screen = (s: ScreenNode) => {
    const hasVariants = !!s.variants?.length;
    const key = `v:${s.id}`;
    const expanded = open.includes(key);
    return (
      <div key={s.id} className="pn-screen">
        {item(s.id, s.label, false, hasVariants && (
          <button type="button" className="pn-variant-toggle" aria-expanded={expanded}
            aria-label={`Variantes de ${s.label}`} onClick={() => toggle(key)}>
            <IconChevronRight size={14} className={`pn-chevron${expanded ? ' is-open' : ''}`} />
          </button>
        ))}
        {hasVariants && expanded && (
          <div className="pn-variants">{s.variants!.map((v) => item(v.id, v.label, true))}</div>
        )}
      </div>
    );
  };

  const group = (id: string, label: string, icon: ReactNode, children: ReactNode, cls: string) => (
    <div key={id} className={cls}>
      <button type="button" className="pn-group-header" aria-expanded={open.includes(id)} onClick={() => toggle(id)}>
        <IconChevronRight size={12} className={`pn-chevron${open.includes(id) ? ' is-open' : ''}`} aria-hidden="true" />
        {icon}
        <span>{label}</span>
      </button>
      {open.includes(id) && <div className="pn-group-body">{children}</div>}
    </div>
  );

  return (
    <div className={`pn-root${collapsed ? ' is-collapsed' : ''}`}>
      <aside className="pn-sidebar" id="pn-sidebar" aria-hidden={collapsed}>
        <div className="pn-sidebar-header">
          <div className="pn-brand">
            <IconShield size={16} aria-hidden="true" />
            <span>Sistema - Admin da plataforma</span>
          </div>

          <div className="pn-device-switch" role="group" aria-label="Alternar dispositivo">
            <button type="button" className={`pn-device-btn${device === 'desktop' ? ' is-active' : ''}`}
              aria-pressed={device === 'desktop'} onClick={() => changeDevice('desktop')}>
              <IconDeviceDesktop size={14} aria-hidden="true" /> Desktop
            </button>
            <button type="button" className={`pn-device-btn${device === 'mobile' ? ' is-active' : ''}`}
              aria-pressed={device === 'mobile'} onClick={() => changeDevice('mobile')}>
              <IconDeviceMobile size={14} aria-hidden="true" /> Mobile
            </button>
          </div>

          <div className="pn-device-switch" role="group" aria-label="Alternar tema">
            <button type="button" className={`pn-device-btn${theme === 'light' ? ' is-active' : ''}`}
              aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
              <IconSun size={14} aria-hidden="true" /> Claro
            </button>
            <button type="button" className={`pn-device-btn${theme === 'dark' ? ' is-active' : ''}`}
              aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
              <IconMoon size={14} aria-hidden="true" /> Escuro
            </button>
          </div>

          <button type="button" className={`pn-notes-toggle${notesOn ? ' is-active' : ''}`}
            aria-pressed={notesOn} onClick={() => setNotesOn(!notesOn)}>
            <IconCode size={14} aria-hidden="true" />
            <span className="pn-notes-label">Notas para desenvolvimento</span>
            <span className="pn-notes-state">{notesOn ? 'On' : 'Off'}</span>
          </button>

          <label className="pn-search">
            <IconSearch size={14} aria-hidden="true" />
            <input type="text" placeholder="Buscar tela..." autoComplete="off" aria-label="Buscar tela"
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>

        <nav className="pn-tree" aria-label="Telas do protótipo do administrador">
          {journeys.map((j) => group(j.id, j.label, <IconRoute size={14} aria-hidden="true" />, j.items.map((n) =>
            isFlow(n)
              ? group(n.id, n.label, <IconGitBranch size={14} aria-hidden="true" />, n.screens.map(screen), 'pn-flow')
              : screen(n)), 'pn-journey'))}
        </nav>
      </aside>

      <button type="button" className="pn-sidebar-toggle" aria-controls="pn-sidebar" aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'} onClick={() => setCollapsed((c) => !c)}>
        {collapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
      </button>

      <main className="pn-viewport">
        <div className="pn-topbar">
          <span className="pn-current">{current ? `${current.trail} / ${current.label}` : '-'}</span>
          <span className="pn-topbar-actions">
            <button type="button" className="pn-open-raw" onClick={() => { resetDb(); frameRef.current?.contentWindow?.location.reload(); }}
              title="Desfaz cadastros e edições feitos no protótipo">
              <IconRefresh size={12} aria-hidden="true" /> Restaurar dados de demonstração
            </button>
            <a className="pn-open-raw" href={frameSrc} target="_blank" rel="noopener noreferrer">
              Abrir em nova aba <IconExternalLink size={12} aria-hidden="true" />
            </a>
          </span>
        </div>
        <div className="pn-frame-wrap" data-device={device}>
          <iframe ref={frameRef} className="pn-frame" title="Prévia da tela" src={frameSrc} />
        </div>
      </main>
      {hover && <HoverPreview src={hover.src} device={device} rect={hover.rect} />}
    </div>
  );
}
