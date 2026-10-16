import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { useToast } from '@maglev/ds';

/** Copia um texto para a área de transferência (API moderna ou, sem ela, o método antigo). Devolve se realmente copiou. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(t);
    return ok;
  } catch {
    return false;
  }
}

/** Código do registro (ex.: OS-000009) com um pequeno ícone de copiar: clicar no código ou no ícone copia o código. */
export function CopyCode({ code }: { code: string }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => { window.clearTimeout(timer.current); }, []);
  const copy = async () => {
    if (await copyText(code)) {
      setDone(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setDone(false), 2000);
      toast.show({ type: 'success', title: 'Código copiado', message: code });
    } else {
      toast.show({ type: 'error', title: 'Não foi possível copiar o código', message: 'Selecione o código e copie manualmente.' });
    }
  };
  return (
    <button type="button" className="copy-code" onClick={copy} aria-label={`Copiar código ${code}`}>
      <strong>{code}</strong>
      {done ? <IconCheck size={14} aria-hidden="true" /> : <IconCopy size={14} aria-hidden="true" />}
    </button>
  );
}
