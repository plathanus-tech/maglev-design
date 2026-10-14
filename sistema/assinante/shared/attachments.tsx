import { useEffect, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconExternalLink, IconFileText, IconPhoto, IconPhotoPlus, IconX } from '@tabler/icons-react';
import { Button, Dialog, FormField, ImageUpload, Stack, useToast } from '@maglev/ds';
import demoPdf from '../assets/documento-demonstracao.pdf';
import { photoSrc } from './photos';
import './preventivas.css';

export type Picked = { name: string; url?: string; fileUrl?: string };
const isPdf = (name: string) => /\.pdf$/i.test(name);

const ACCEPT_IMG = ['image/png', 'image/jpeg'];
const ACCEPT_REPORT = [...ACCEPT_IMG, 'application/pdf'];

/**
 * Evidência com várias fotos: vazio = área de upload do sistema (ImageUpload); com fotos = grade compacta de miniaturas
 * (clique amplia, remoção individual) e "Adicionar foto" como último item da grade, que aceita várias de uma vez.
 * Cada arquivo é validado separadamente; os inválidos não afetam os já anexados.
 */
export function EvidenceGallery({ label, items, onAdd, onRemove, report }: { label: string; items: Picked[]; onAdd: (p: Picked[]) => void; onRemove: (i: number) => void; report?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [view, setView] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number>();
  useEffect(() => () => { window.clearTimeout(timer.current); }, []);
  const allowed = report ? ACCEPT_REPORT : ACCEPT_IMG;
  const msg = report ? 'Envie arquivos JPG, PNG ou PDF' : 'Envie imagens JPG ou PNG';
  const receive = (list: File[]) => {
    const ok = list.filter((x) => allowed.includes(x.type));
    setError(ok.length < list.length ? msg : undefined);
    if (!ok.length) return;
    setLoading(true);
    timer.current = window.setTimeout(() => { onAdd(ok.map((x) => ({ name: x.name, url: x.type.startsWith('image/') ? URL.createObjectURL(x) : undefined, fileUrl: URL.createObjectURL(x) }))); setLoading(false); }, 600);
  };
  const noun = report ? 'arquivo' : 'foto';
  return (
    <Stack gap="sm">
      {items.length === 0 ? (
        <ImageUpload
          label={label} className="ev-hide-label" loading={loading} onChange={(x) => x && receive([x])}
          accept={allowed.join(',')} helperText={report ? 'JPG, PNG ou PDF' : 'JPG ou PNG'}
          labels={report ? { add: 'Adicionar arquivo', loading: 'Enviando arquivo...', invalidType: msg } : { invalidType: msg }}
        />
      ) : (
        <ul className="ev-grid" aria-label={`${label}: ${items.length} ${items.length === 1 ? noun : noun + 's'}`}>
          {items.map((it, i) => (
            <li key={`${it.name}-${i}`} className="ev-item">
              <button type="button" className="ev-thumb" onClick={() => setView(i)} aria-label={`Ampliar ${noun}: ${it.name}`}>
                {it.url ? <img src={it.url} alt="" /> : <span className="ev-ph">{isPdf(it.name) ? <IconFileText size={24} aria-hidden="true" /> : <IconPhoto size={24} aria-hidden="true" />}<span className="ev-ph-name">{it.name}</span></span>}
              </button>
              <button type="button" className="ev-remove" onClick={() => onRemove(i)} aria-label={`Remover ${noun}: ${it.name}`}><IconX size={14} aria-hidden="true" /></button>
            </li>
          ))}
          <li className="ev-item">
            <button type="button" className="ev-add" disabled={loading} onClick={() => inputRef.current?.click()}>
              <IconPhotoPlus size={24} aria-hidden="true" />
              <span>{loading ? 'Enviando...' : `Adicionar ${noun}`}</span>
            </button>
            <input ref={inputRef} type="file" multiple accept={allowed.join(',')} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { receive([...(e.target.files ?? [])]); e.target.value = ''; }} />
          </li>
        </ul>
      )}
      {error && <span className="ev-error" role="alert">{error}</span>}
      {view !== null && items[view] && (
        <Dialog open onClose={() => setView(null)} size="md" title={items[view].name} subtitle={label} actions={<Button size="sm" variant="secondary" onClick={() => setView(null)}>Fechar</Button>}>
          {items[view].url ? <img className="ev-full" src={items[view].url} alt={items[view].name} /> : <span className="cell-secondary">Pré-visualização indisponível no protótipo</span>}
        </Dialog>
      )}
    </Stack>
  );
}

export function EvidenceGalleryView({ items, label, compact }: { items: Picked[]; label: string; compact?: boolean }) {
  const [view, setView] = useState<number | null>(null);
  return (
    <>
      <ul className={compact ? 'ev-grid ev-grid-sm' : 'ev-grid'} aria-label={label}>
        {items.map((it, i) => (
          <li key={i} className="ev-item">
            <button type="button" className="ev-thumb" onClick={() => setView(i)} aria-label={`Ampliar: ${it.name}`}>
              {it.url ? <img src={it.url} alt="" /> : <span className="ev-ph">{isPdf(it.name) ? <IconFileText size={24} aria-hidden="true" /> : <IconPhoto size={24} aria-hidden="true" />}<span className="ev-ph-name">{it.name}</span></span>}
            </button>
          </li>
        ))}
      </ul>
      {view !== null && items[view] && (
        <Dialog open onClose={() => setView(null)} size="md" title={items[view].name} subtitle={label} actions={<Button size="sm" variant="secondary" onClick={() => setView(null)}>Fechar</Button>}>
          {items[view].url ? <img className="ev-full" src={items[view].url} alt={items[view].name} /> : <span className="cell-secondary">Pré-visualização indisponível no protótipo</span>}
        </Dialog>
      )}
    </>
  );
}


/** Miniaturas escolhidas nesta sessão (nome → URL local): o cadastro guarda só os nomes; os de demonstração vêm de photos.ts. */
const previews = new Map<string, string>();
export const previewOf = (name: string) => previews.get(name) ?? photoSrc(name);
/** URL do arquivo para abrir em nova aba: o escolhido nesta sessão ou, nos anexos de demonstração (sem arquivo real), um PDF ilustrativo. */
const fileUrls = new Map<string, string>();
const fileUrlOf = (name: string) => fileUrls.get(name) ?? (isPdf(name) ? demoPdf : undefined);
/** Nomes dos anexos de um orçamento/item de custo (aceita o formato antigo, com um só `attachment`). */
export const namesOf = (x: { attachments?: string[]; attachment?: string }) => x.attachments ?? (x.attachment ? [x.attachment] : []);

/**
 * Campo "Anexos" com vários arquivos (JPG, PNG e PDF), usado no orçamento do prestador e no item de custo do assinante.
 * Sem arquivos: a área de upload do sistema; com arquivos: grade de miniaturas com "Adicionar arquivo" ao lado (EvidenceGallery).
 * Sem limite de quantidade ou de tamanho (nenhum foi definido nas regras).
 */
export function AttachmentsField({ label = 'Anexos', optional = true, items, onChange, error }: { label?: string; optional?: boolean; items: Picked[]; onChange: (p: Picked[]) => void; error?: string }) {
  return (
    <FormField label={label} optional={optional} error={error}>
      {() => (
        <EvidenceGallery
          label={label} report items={items}
          onAdd={(p) => { p.forEach((x) => { if (x.url) previews.set(x.name, x.url); if (x.fileUrl) fileUrls.set(x.name, x.fileUrl); }); onChange([...items, ...p]); }}
          onRemove={(i) => onChange(items.filter((_, n) => n !== i))}
        />
      )}
    </FormField>
  );
}

/** Anexos já salvos (só nomes), em leitura: miniaturas que ampliam e PDFs com ícone. */
export function AttachmentsView({ names, label = 'Anexos', compact }: { names: string[]; label?: string; compact?: boolean }) {
  if (!names.length) return <>-</>;
  return <EvidenceGalleryView items={names.map((name) => ({ name, url: previewOf(name) }))} label={label} compact={compact} />;
}

/**
 * Prévia compacta dos anexos para células de tabela: miniatura do primeiro arquivo e "+N" com os demais (sem sobreposição); altura
 * fixa, sem crescer com a quantidade. Um único botão abre o visualizador com setas, contador e nome do arquivo.
 */
export function AttachmentsStack({ names, label }: { names: string[]; label: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const count = names.length;
  useEffect(() => {
    if (!open || count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + count) % count);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % count);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, count]);
  if (!names.length) return <>-</>;
  const items = names.map((name) => ({ name, url: previewOf(name) }));
  const first = items[0];
  const many = items.length > 1;
  const go = (d: number) => setIndex((i) => (i + d + items.length) % items.length);
  const cur = items[index];
  const openPdf = () => {
    const url = fileUrlOf(cur.name);
    if (!url) { toast.show({ type: 'error', title: 'Arquivo indisponível', message: `Não foi possível abrir ${cur.name}.` }); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <>
      <button
        type="button" className="att-stack" onClick={() => { setIndex(0); setOpen(true); }}
        aria-label={many ? `Visualizar ${items.length} anexos do ${label}` : `Visualizar anexo do ${label}`}
      >
        <span className="att-tile" aria-hidden="true">
          {first.url ? <img src={first.url} alt="" /> : isPdf(first.name) ? <IconFileText size={20} /> : <IconPhoto size={20} />}
        </span>
        {many && <span className="att-more" aria-hidden="true">+{items.length - 1}</span>}
      </button>
      {open && (
        <Dialog open onClose={() => setOpen(false)} size="md" title={cur.name} subtitle={many ? `${index + 1} de ${items.length}` : undefined} closeLabel="Fechar visualização">
          <div className="att-viewer" role="group" aria-roledescription="galeria" aria-label={label}>
            <div className="att-stage" aria-live="polite">
              {cur.url
                ? <img className="att-img" src={cur.url} alt={cur.name} />
                : (
                  <span className="att-doc">
                    {isPdf(cur.name) ? <IconFileText size={32} aria-hidden="true" /> : <IconPhoto size={32} aria-hidden="true" />}
                    <span className="att-doc-name">{cur.name}</span>
                    <span className="cell-secondary">{isPdf(cur.name) ? 'Documento PDF' : 'Arquivo'}</span>
                    {isPdf(cur.name) && <Button iconRight={<IconExternalLink size={20} />} onClick={openPdf}>Abrir PDF</Button>}
                  </span>
                )}
            </div>
            {many && (
              <>
                <button type="button" className="att-nav is-prev" onClick={() => go(-1)} aria-label="Anexo anterior"><IconChevronLeft size={20} aria-hidden="true" /></button>
                <button type="button" className="att-nav is-next" onClick={() => go(1)} aria-label="Próximo anexo"><IconChevronRight size={20} aria-hidden="true" /></button>
              </>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
