import { useEffect, useRef, useState } from 'react';
import { IconBrandWhatsapp, IconCheck, IconCopy, IconShare } from '@tabler/icons-react';
import { Button, Dialog, Stack, Tooltip, useToast } from '@maglev/ds';
import { copyText } from '../../assinante/shared/copy-code';

/** Tipo de registro compartilhado: define o texto da mensagem. */
const KINDS = {
  os: { noun: 'ordem de serviço', label: 'desta ordem de serviço' },
  preventiva: { noun: 'manutenção preventiva', label: 'desta manutenção preventiva' },
  solicitacao: { noun: 'solicitação', label: 'desta solicitação' },
  equipamento: { noun: 'equipamento', label: 'deste equipamento' },
  plano: { noun: 'plano de manutenção', label: 'deste plano de manutenção' },
  prestador: { noun: 'prestador', label: 'deste prestador' },
  assinante: { noun: 'assinante', label: 'deste assinante' },
} as const;
export type ShareKind = keyof typeof KINDS;

/** URL direta do registro aberto: a da própria tela (sem o #estado do protótipo). A rota já identifica o registro (?os=, ?id=) e o acesso segue as mesmas regras de hoje. */
const currentRecordUrl = () => `${window.location.origin}${window.location.pathname}${window.location.search}`;

/**
 * Compartilhar um registro (OS, preventiva, solicitação, equipamento, plano, prestador ou assinante): botão só com ícone no cabeçalho e modal com duas opções, WhatsApp (link oficial
 * de compartilhamento, mensagem pré-preenchida; a pessoa escolhe o contato dentro do WhatsApp) e Copiar link. Compartilhar o link não
 * concede acesso: quem abrir passa pelas mesmas regras de acesso da tela (link do prestador ou login com perfil autorizado).
 */
export function ShareButton({ kind, id, url: directUrl, requiresLogin }: { kind: ShareKind; id: string; /** Registro da área logada: quem abrir o link precisa entrar com um perfil que tenha acesso (sem login, o link não mostra dados). */ requiresLogin?: boolean; /** Link próprio do registro, quando a URL da tela não é a rota estável (ex.: acompanhamento por token). */ url?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => { window.clearTimeout(timer.current); }, []);
  const toast = useToast();
  const k = KINDS[kind];
  const url = directUrl ? new URL(directUrl, window.location.href).href : currentRecordUrl();
  const message = `Confira os detalhes ${k.label} (${id}): ${url}`;

  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };
  const copy = async () => {
    if (await copyText(url)) {
      // Feedback no próprio botão (só depois de a cópia realmente funcionar)
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2500);
    } else {
      toast.show({ type: 'error', title: 'Não foi possível copiar o link', message: 'Copie o endereço da página manualmente.' });
    }
  };

  return (
    <>
      <Tooltip content="Compartilhar">
        <Button variant="ghost" iconOnly iconLeft={<IconShare size={20} />} aria-label="Compartilhar" aria-haspopup="dialog" onClick={() => setOpen(true)} />
      </Tooltip>
      {open && (
        <Dialog sheet open onClose={() => { setOpen(false); setCopied(false); }} size="sm" title="Compartilhar" subtitle={requiresLogin ? `Compartilhe o link ${k.label}. Quem abrir precisa entrar com um perfil que tenha acesso` : `Compartilhe o link ${k.label}`}>
          <Stack gap="sm">
            <span className="share-id">{id}</span>
            <Button size="sm" className="share-option share-whatsapp" iconLeft={<IconBrandWhatsapp size={16} />} onClick={whatsapp}>Compartilhar pelo WhatsApp</Button>
            <Button size="sm" variant="outline" className="share-option" iconLeft={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy}>
              <span aria-live="polite">{copied ? 'Link copiado' : 'Copiar link'}</span>
            </Button>
          </Stack>
        </Dialog>
      )}
    </>
  );
}
