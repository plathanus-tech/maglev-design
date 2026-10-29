import { FormEvent, useEffect, useRef, useState } from 'react';
import { IconCamera, IconPlus, IconQrcode, IconQrcodeOff } from '@tabler/icons-react';
import { Button, Dialog, Feedback, ImageUpload, Input, Stack, Tooltip } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { requiredMessage } from '../../admin/shared/format';
import '../../externo/shared/externo.css';
import { Equipment, SubDb } from './data';
import { useSubDb } from './store';
import { goTo } from './ui';
import './rowmenu.css';

/**
 * Vínculo de equipamento com um QR Code que já existe (etiqueta já impressa): leitura pela câmera (mobile), por foto ou arquivo de imagem
 * (mobile e desktop) ou digitando o código/link. O sistema valida que o QR Code não está ligado a outro equipamento (nem foi substituído em um).
 *
 * PROTÓTIPO: a leitura da imagem e da câmera usa o BarcodeDetector do navegador (Chrome/Android e similares); onde não existir, a pessoa digita
 * o código. Em desenvolvimento, usar uma biblioteca de leitura de QR Code no navegador ou no servidor e validar o código no servidor.
 */
type Detector = { detect: (v: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> };
export const makeDetector = (): Detector | null => {
  const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  return Ctor ? new Ctor({ formats: ['qr_code'] }) : null;
};

/** Aceita o link do QR (…/q/<identificador>) ou o próprio identificador. */
export const tokenOf = (raw: string): string | undefined => {
  const link = /\/q\/([\w-]+)/.exec(raw)?.[1];
  if (link) return link;
  const bare = raw.trim();
  return /^[\w-]{6,}$/.test(bare) ? bare : undefined;
};

/** Equipamento que já usa (ou já usou) este QR Code: o atual ou um substituído, que não pode ser reutilizado. */
export const qrOwner = (db: SubDb, token: string): { equipment: Equipment; replaced: boolean } | undefined => {
  const now = db.equipments.find((e) => e.qrToken === token);
  if (now) return { equipment: now, replaced: false };
  const old = db.equipments.find((e) => e.qrPrevious?.includes(token));
  return old ? { equipment: old, replaced: true } : undefined;
};

/** Mensagem de erro do QR Code informado (vazio, formato ou já vinculado); `selfId` = equipamento em edição. */
export function qrProblem(db: SubDb, raw: string, selfId?: string): string | undefined {
  if (!raw.trim()) return requiredMessage('QR Code');
  const token = tokenOf(raw);
  if (!token) return 'Informe o código ou o link do QR Code (maglev.com.br/q/código)';
  const owner = qrOwner(db, token);
  if (!owner) return undefined;
  if (owner.equipment.id === selfId) return owner.replaced ? 'Este QR Code já foi usado por este equipamento e não pode ser reutilizado' : 'Este já é o QR Code atual do equipamento';
  const who = `${owner.equipment.name}${owner.equipment.code ? ` (${owner.equipment.code})` : ''}`;
  return owner.replaced ? `Este QR Code foi substituído no equipamento ${who} e não pode ser reutilizado` : `Este QR Code já está vinculado ao equipamento ${who}`;
}

/** Lê o QR Code de uma imagem (foto ou arquivo). `unsupported` = o navegador não sabe ler QR Code. */
export async function readQrFromImage(file: File): Promise<{ raw?: string; unsupported?: boolean }> {
  const detector = makeDetector();
  if (!detector) return { unsupported: true };
  try {
    const bitmap = await createImageBitmap(file);
    const hit = (await detector.detect(bitmap))[0];
    return hit ? { raw: hit.rawValue } : {};
  } catch { return {}; }
}

/** Leitura contínua pela câmera: chama `onRead` com o primeiro QR Code reconhecido. */
export function useQrScanner(onRead: (raw: string) => void) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState<string>();
  const stop = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setScanning(false); };
  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps
  const start = async () => {
    setMsg(undefined);
    const detector = makeDetector();
    if (!detector || !navigator.mediaDevices?.getUserMedia) { setMsg('Este navegador não consegue ler o QR Code. Envie uma foto ou digite o código da etiqueta'); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.current = s; setScanning(true);
      await new Promise((r) => setTimeout(r, 0));
      if (video.current) { video.current.srcObject = s; await video.current.play(); }
      const tick = async () => {
        if (!stream.current || !video.current) return;
        try {
          const hit = (await detector.detect(video.current))[0];
          if (hit) { stop(); onRead(hit.rawValue); return; }
        } catch { /* frame sem leitura */ }
        window.setTimeout(tick, 300);
      };
      void tick();
    } catch {
      setMsg('Não foi possível abrir a câmera. Permita o acesso, envie uma foto ou digite o código da etiqueta');
    }
  };
  return { video, scanning, msg, setMsg, start, stop };
}

/**
 * Campo do QR Code existente: código/link digitado ou lido. Imagem do QR Code no padrão de imagens do sistema (uma só, com rótulo), igual no desktop e
 * no mobile; no mobile há também "Ler com a câmera". Também aceita digitar o código ou colar o link.
 */
export function QrLinkField({ value, onChange, error }: { value: string; onChange: (raw: string) => void; error?: string }) {
  const isMobile = useIsMobile();
  const [note, setNote] = useState<string>();
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<string>();
  const [loading, setLoading] = useState(false);
  const scanner = useQrScanner((raw) => { setNote(undefined); onChange(raw); });

  const onFile = async (file: File | null) => {
    if (!file) { setFileName(''); setPreview(undefined); setNote(undefined); return; }
    setFileName(file.name); setPreview(URL.createObjectURL(file)); setNote(undefined); setLoading(true);
    const r = await readQrFromImage(file);
    setLoading(false);
    if (r.raw) onChange(r.raw);
    else setNote(r.unsupported ? 'A imagem foi recebida, mas este navegador não lê QR Code. Digite o código da etiqueta' : 'Não conseguimos ler o QR Code desta imagem. Envie outra imagem ou digite o código da etiqueta');
  };

  return (
    <Stack gap="md">
      <DevNote note="QR Code que já existe (etiqueta já impressa): imagem do QR Code no padrão de imagens do sistema (uma só, com rótulo, JPG ou PNG), leitura pela câmera (só no mobile) ou código/link digitado. A leitura usa o BarcodeDetector do navegador; onde não houver, a pessoa digita o código (em desenvolvimento, usar uma biblioteca de leitura de QR Code). O sistema valida que o QR Code não está vinculado a outro equipamento, nem foi substituído em um (QR Code substituído nunca é reutilizado). Em desenvolvimento a validação roda no servidor, sobre todos os equipamentos do assinante e o cadastro de QR Codes do Admin.">
        <Stack gap="sm">
          {isMobile && (scanner.scanning
            ? <Button variant="secondary" onClick={scanner.stop}>Parar a câmera</Button>
            : <Button variant="secondary" iconLeft={<IconCamera size={20} />} onClick={() => void scanner.start()}>Ler com a câmera</Button>)}
          {scanner.scanning && <video ref={scanner.video} className="qr-video" playsInline muted aria-label="Câmera para ler o QR Code" />}
          <ImageUpload label="Imagem do QR Code" optional fileName={fileName} previewUrl={preview} loading={loading} onChange={(f) => void onFile(f)} labels={{ add: 'Adicionar imagem', replace: 'Trocar imagem', remove: 'Remover imagem', loading: 'Lendo o QR Code...' }} />
          {(scanner.msg || note) && <Feedback type="info" message={scanner.msg ?? note ?? ''} />}
        </Stack>
      </DevNote>
      <Input
        label="Código ou link do QR Code" placeholder="Ex.: maglev.com.br/q/abc123" autoComplete="off" spellCheck={false}
        value={value} onChange={(e) => onChange(e.target.value)} error={error} helperText="Está na etiqueta, abaixo do QR Code, ou no link do QR"
      />
    </Stack>
  );
}

/** Substituir (ou vincular) o QR Code de um equipamento já cadastrado; a troca só vale depois de salvar o formulário. */
export function ReplaceQrDialog({ current, equipmentId, onClose, onConfirm }: {
  current: string; equipmentId: string; onClose: () => void; onConfirm: (token: string) => void;
}) {
  const db = useSubDb();
  const [raw, setRaw] = useState('');
  const [tried, setTried] = useState(false);
  const problem = tried ? qrProblem(db, raw, equipmentId) : undefined;
  const replacing = !!current;
  const submit = (ev?: FormEvent) => {
    ev?.preventDefault();
    setTried(true);
    if (qrProblem(db, raw, equipmentId)) return;
    onConfirm(tokenOf(raw)!);
  };
  return (
    <Dialog
      open onClose={onClose} size="sm" title={replacing ? 'Substituir QR Code' : 'Vincular QR Code'}
      subtitle={replacing ? 'Envie a imagem ou leia o novo QR Code que passará a identificar este equipamento' : 'Leia ou informe o QR Code da etiqueta que identificará este equipamento'}
      actions={<><Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button><Button size="sm" onClick={() => submit()}>Usar este QR Code</Button></>}
    >
      <form onSubmit={submit} noValidate>
        <Stack gap="md">
          {replacing && <Feedback type="warning" message="O QR Code atual deixa de abrir solicitações quando você salvar o equipamento. Ele fica no histórico e não pode ser reutilizado" />}
          <QrLinkField value={raw} onChange={(v) => { setRaw(v); setTried(false); }} error={problem} />
        </Stack>
      </form>
    </Dialog>
  );
}

/**
 * Modal "Cadastrar equipamento com QR Code": lê (imagem, câmera no mobile) ou recebe o código/link do QR Code de uma etiqueta já impressa, valida que
 * não está vinculado a outro equipamento e abre o Novo equipamento já vinculado. "Cadastrar sem QR Code existente" leva ao cadastro normal (lá se escolhe
 * gerar automático ou vincular depois). `preset` abre já preenchido para as variantes do navegador: 'linked' = QR Code que já pertence a outro equipamento.
 */
export function LinkQrDialog({ onClose, preset }: { onClose: () => void; preset?: 'linked' }) {
  const db = useSubDb();
  const [raw, setRaw] = useState(() => (preset === 'linked' && db.equipments[0] ? `maglev.com.br/q/${db.equipments[0].qrToken}` : ''));
  const [tried, setTried] = useState(preset === 'linked');
  const problem = tried ? qrProblem(db, raw) : undefined;
  const submit = (ev?: FormEvent) => {
    ev?.preventDefault();
    setTried(true);
    if (qrProblem(db, raw)) return;
    goTo(`equipamento-form.html?qr=${tokenOf(raw)}`);
  };
  return (
    <Dialog
      open onClose={onClose} size="sm" title="Cadastrar equipamento com QR Code"
      subtitle="Leia ou informe o QR Code de uma etiqueta que você já tem e o novo equipamento será vinculado a ele"
      actions={<><Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button><Button size="sm" onClick={() => submit()}>Continuar</Button></>}
    >
      <form onSubmit={submit} noValidate>
        <Stack gap="md">
          <QrLinkField value={raw} onChange={(v) => { setRaw(v); setTried(false); }} error={problem} />
          <Button variant="ghost" onClick={() => goTo('equipamento-form.html')}>Cadastrar sem QR Code existente</Button>
        </Stack>
      </form>
    </Dialog>
  );
}

/**
 * Atalho na lista de Equipamentos, depois de "Novo equipamento": cadastrar um equipamento a partir de um QR Code que já existe. Mesmo botão só com o
 * ícone de QR Code da Nova solicitação, mas com o "+" de criação e o texto da função no tooltip (é o cadastro, não a abertura de solicitação).
 */
export function LinkQrButton({ preset }: { preset?: 'empty' | 'linked' }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(!!preset);
  const label = isMobile ? 'Ler QR Code para cadastrar equipamento' : 'Cadastrar equipamento com QR Code existente';
  return (
    <>
      <DevNote note="Cadastrar equipamento a partir de um QR Code que já existe (etiqueta já impressa): botão só com o ícone de QR Code, igual ao da Nova solicitação, mas com o “+” de criação e o tooltip da função própria do equipamento (desktop: “Cadastrar equipamento com QR Code existente”; mobile: “Ler QR Code para cadastrar equipamento”). Fica depois de “Novo equipamento” (no mobile, o botão principal ocupa a largura que sobra). Abre o modal de leitura, que valida que o QR Code não está vinculado a outro equipamento e abre o Novo equipamento já vinculado a ele. Só para quem pode cadastrar equipamentos.">
        <Tooltip content={label} placement="bottom">
          <Button variant="secondary" size="md" iconOnly className="row-menu-btn qr-icon-btn" aria-label={label} onClick={() => setOpen(true)}
            iconLeft={<span className="qr-link-icon"><IconQrcode size={20} /><span className="qr-link-plus" aria-hidden="true"><IconPlus size={10} stroke={3} /></span></span>} />
        </Tooltip>
      </DevNote>
      {open && <LinkQrDialog onClose={() => setOpen(false)} preset={preset === 'linked' ? 'linked' : undefined} />}
    </>
  );
}

/** Indicador discreto na lista: equipamento sem QR Code vinculado (só ícone, com dica). */
export function QrMissingFlag({ equipment }: { equipment: Pick<Equipment, 'qrToken'> }) {
  if (equipment.qrToken) return null;
  return (
    <Tooltip content="Sem QR Code vinculado" placement="right">
      <span className="qr-missing-flag" role="img" aria-label="Sem QR Code vinculado" tabIndex={0}><IconQrcodeOff size={16} aria-hidden="true" /></span>
    </Tooltip>
  );
}
