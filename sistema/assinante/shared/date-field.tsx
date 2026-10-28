import { useEffect, useState, type ComponentProps } from 'react';
import { DatePicker } from '@maglev/ds';

export const INVALID_DATE_MESSAGE = 'Data inválida';

type Props = ComponentProps<typeof DatePicker> & {
  /** Há texto digitado que não vira data aceita (o DatePicker só devolve '' nesse caso, igual a campo vazio). */
  invalid?: boolean;
  onInvalid?: (invalid: boolean) => void;
  /** Mensagem quando a data existe, mas é anterior a `min` (ex.: "A data não pode ser anterior a hoje"). */
  minMessage?: string;
  /** Mensagem quando a data existe, mas é posterior a  (ex.: "A data não pode ser posterior a hoje"). */
  maxMessage?: string;
};

/** dd/mm/aaaa → ISO, ou null se a data não existe. */
const parseText = (t: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t.trim());
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return d.getFullYear() === +m[3] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[1] ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/**
 * DatePicker que separa "campo vazio" (O campo X é obrigatório) de "data inexistente/incompleta" (Data inválida) e de
 * "data anterior ao mínimo" (minMessage). O DatePicker do Storybook devolve '' em todos; aqui o texto digitado é lido ao sair do campo.
 */
export function DateField({ invalid, onInvalid, minMessage, maxMessage, error, value, min, ...rest }: Props) {
  const [outside, setOutside] = useState<'min' | 'max' | null>(null);
  // Uma data nova aceita (digitada ou escolhida no calendário) limpa o erro; o DatePicker mantém o valor anterior quando o texto digitado não é uma data aceita
  useEffect(() => { onInvalid?.(false); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const message = invalid ? ((outside === 'min' && minMessage) || (outside === 'max' && maxMessage) || INVALID_DATE_MESSAGE) : undefined;
  return (
    <div
      style={{ display: 'contents' }}
      onInput={() => { if (invalid) onInvalid?.(false); setOutside(null); }}
      onBlurCapture={(e) => {
        const t = e.target as HTMLElement;
        if (t.tagName !== 'INPUT') return;
        const text = (t as HTMLInputElement).value;
        const iso = parseText(text);
        setOutside(iso && min && iso < min ? 'min' : iso && rest.max && iso > rest.max ? 'max' : null);
        const outOfRange = !!iso && ((!!min && iso < min) || (!!rest.max && iso > rest.max));
        onInvalid?.(text.trim() !== '' && (!iso || outOfRange));
      }}
    >
      <DatePicker {...rest} min={min} value={value} error={message ?? error} />
    </div>
  );
}

