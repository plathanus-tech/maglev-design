import { CSSProperties, FormEvent, KeyboardEvent, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCamera, IconQrcode } from '@tabler/icons-react';
import { Button, Dialog, Feedback, Input, Stack } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { normalize, requiredMessage } from '../../admin/shared/format';
import { CategoryIcon } from '../../admin/shared/IconPicker';
import '../../externo/shared/externo.css';
import { useSubDb, useSubSession } from './store';
import { goTo, useRefs } from './ui';
import './rowmenu.css';

/** Leitor de QR Code do navegador (Chrome/Android e similares); onde não existir, a pessoa digita o código da etiqueta. */
type Detector = { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
const makeDetector = (): Detector | null => {
  const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  return Ctor ? new Ctor({ formats: ['qr_code'] }) : null;
};

const norm = (v: string) => v.trim().toLowerCase();
/** Aceita o código da etiqueta ou o link do QR (…/q/<identificador>). */
const tokenOf = (raw: string) => /\/q\/([\w-]+)/.exec(raw)?.[1];

/**
 * Atalho ao lado de “Nova solicitação”: ler o QR Code (mobile) ou informar o código do equipamento (desktop e mobile) e cair direto na
 * solicitação dele, com equipamento, unidade e ambiente já preenchidos, sem passar pela busca.
 */
export function OpenByCode() {
  const isMobile = useIsMobile();
  const db = useSubDb();
  const refs = useRefs();
  const { unitIds } = useSubSession();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string>();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  // Sugestões enquanto digita (código ou nome), só equipamentos ativos das unidades do usuário; no máximo 6 (mesmo comportamento da busca do solicitante)
  const [showList, setShowList] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const fieldRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>();

  const mine = db.equipments.filter((e) => unitIds.includes(e.unitId));
  const suggestions = useMemo(() => {
    const q = normalize(code);
    if (!q) return [];
    return mine.filter((e) => e.statusId !== 'STE-05' && (normalize(e.code).includes(q) || normalize(e.name).includes(q)))
      .sort((a, b) => Number(normalize(b.code).startsWith(q)) - Number(normalize(a.code).startsWith(q)) || a.code.localeCompare(b.code)).slice(0, 6);
  }, [mine, code]);
  const listOpen = showList && suggestions.length > 0;
  // A lista flutua sobre o modal (portal, posição fixa sob o campo), sem expandir o card; reposiciona ao rolar ou redimensionar
  useLayoutEffect(() => {
    if (!listOpen) return;
    const place = () => {
      const r = fieldRef.current?.querySelector('input')?.getBoundingClientRect();
      if (r) setPanelStyle({ position: 'fixed', top: r.bottom + 4, left: r.left, right: 'auto', width: r.width, zIndex: 'calc(var(--z-overlay) + 1)' as unknown as number });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [listOpen, code]);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { if (listOpen) { e.preventDefault(); e.stopPropagation(); setShowList(false); } return; }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && suggestions.length) {
      e.preventDefault(); setShowList(true);
      setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % suggestions.length : (i <= 0 ? suggestions.length - 1 : i - 1)));
    } else if (e.key === 'Enter' && listOpen && active >= 0 && suggestions[active]) {
      e.preventDefault(); resolve(suggestions[active].code);
    }
  };
  const stopCamera = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setScanning(false); };
  const close = () => { stopCamera(); setOpen(false); setCode(''); setError(undefined); setScanMsg(undefined); setShowList(false); setActive(-1); };
  useEffect(() => stopCamera, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Localiza o equipamento pelo código digitado ou pelo identificador do QR e abre a solicitação dele. */
  const resolve = (raw: string): boolean => {
    const t = tokenOf(raw);
    const e = mine.find((x) => (t ? x.qrToken === t : norm(x.code) === norm(raw) || norm(x.id) === norm(raw)));
    if (!e) { setError('Não encontramos um equipamento com este código. Confira o código na etiqueta'); return false; }
    if (e.statusId === 'STE-05') { setError('Este equipamento está inativo e não aceita novas solicitações'); return false; }
    goTo(`solicitacao-form.html?equipment=${e.id}`);
    return true;
  };
  const submit = (ev?: FormEvent) => {
    ev?.preventDefault();
    if (!code.trim()) { setError(requiredMessage('Código do equipamento')); return; }
    resolve(code);
  };

  const startCamera = async () => {
    setScanMsg(undefined); setError(undefined);
    const detector = makeDetector();
    if (!detector || !navigator.mediaDevices?.getUserMedia) { setScanMsg('Este navegador não consegue ler o QR Code. Digite o código da etiqueta'); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.current = s; setScanning(true);
      await new Promise((r) => setTimeout(r, 0));
      if (video.current) { video.current.srcObject = s; await video.current.play(); }
      const tick = async () => {
        if (!stream.current || !video.current) return;
        try {
          const hit = (await detector.detect(video.current))[0];
          if (hit && resolve(hit.rawValue)) { stopCamera(); return; }
          if (hit) { stopCamera(); return; }
        } catch { /* frame sem leitura */ }
        window.setTimeout(tick, 300);
      };
      tick();
    } catch {
      setScanMsg('Não foi possível abrir a câmera. Permita o acesso ou digite o código da etiqueta');
    }
  };

  return (
    <>
      <DevNote note="Atalho para abrir a solicitação de um equipamento pelo código da etiqueta, sem a busca. Mobile: botão só com o ícone de QR Code ao lado de “Nova solicitação” (“Ler QR Code”), que usa a câmera (onde o navegador permitir) e também aceita digitar o código; desktop: só informar o código. Enquanto digita, mostra sugestões (código ou nome, até 6, só equipamentos ativos das unidades do usuário), como na busca do solicitante; escolher uma abre a solicitação. Reconhece o código do equipamento (o que está impresso na etiqueta, único por equipamento) ou o link do QR. Equipamento inativo ou código desconhecido mostram o motivo. Só para quem pode cadastrar solicitações.">
        {isMobile
          // Mobile: só o ícone, ao lado de “Nova solicitação” (a classe row-menu-btn reaproveita o layout em linha e a área de toque dos botões de ícone do cabeçalho)
          ? <Button variant="secondary" size="md" iconOnly className="row-menu-btn qr-icon-btn" iconLeft={<IconQrcode size={20} />} aria-label="Ler QR Code" onClick={() => setOpen(true)} />
          : <Button variant="secondary" iconLeft={<IconQrcode size={20} />} onClick={() => setOpen(true)}>Informar código</Button>}
      </DevNote>
      {open && (
        <Dialog
          open onClose={close} size="sm" title="Abrir solicitação pelo código"
          subtitle={isMobile ? 'Leia o QR Code da etiqueta ou digite o código do equipamento' : 'Digite o código que está na etiqueta do equipamento'}
          actions={<><Button size="sm" variant="secondary" onClick={close}>Cancelar</Button><Button size="sm" onClick={() => submit()}>Abrir solicitação</Button></>}
        >
          <form onSubmit={submit} noValidate>
            <Stack gap="md">
              {isMobile && (
                scanning
                  ? <video ref={video} className="qr-video" playsInline muted aria-label="Câmera para ler o QR Code" />
                  : <Button variant="secondary" iconLeft={<IconCamera size={20} />} onClick={startCamera}>Ler com a câmera</Button>
              )}
              {scanMsg && <Feedback type="info" message={scanMsg} />}
              <div className="ext-suggest" ref={fieldRef}>
                <Input
                  label="Código do equipamento" placeholder="Ex.: PAT-1000" autoComplete="off" autoCapitalize="characters" spellCheck={false}
                  value={code} onChange={(e) => { setCode(e.target.value); setError(undefined); setShowList(true); setActive(-1); }}
                  onKeyDown={onKeyDown} error={error} helperText="Está na etiqueta, abaixo do QR Code"
                  role="combobox" aria-expanded={listOpen} aria-controls={listId} aria-autocomplete="list"
                  aria-activedescendant={listOpen && active >= 0 ? `${listId}-opt-${active}` : undefined}
                />
                {listOpen && panelStyle && createPortal(
                  <div className="ext-suggest-panel" style={panelStyle}>
                    <div id={listId} role="listbox" aria-label="Equipamentos encontrados">
                      {suggestions.map((e, i) => (
                        <div
                          key={e.id} id={`${listId}-opt-${i}`} role="option" aria-selected={active === i}
                          className={`ext-suggest-option${active === i ? ' is-active' : ''}`}
                          onMouseEnter={() => setActive(i)} onMouseDown={(ev) => ev.preventDefault()} onClick={() => resolve(e.code)}
                        >
                          <span className="ext-suggest-icon" aria-hidden="true"><CategoryIcon id={refs.category(e.categoryId)?.icon} size={16} /></span>
                          <span className="ext-suggest-text">
                            <span>{e.name}</span>
                            <span className="ext-suggest-desc">{e.code} · {db.units.find((u) => u.id === e.unitId)?.name ?? ''}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>,
                  document.body,
                )}
              </div>
            </Stack>
          </form>
        </Dialog>
      )}
    </>
  );
}
