import { useEffect, useRef, useState } from 'react';
import { IconAlertOctagon, IconCircleCheck, IconClock } from '@tabler/icons-react';
import { Accordion, Badge, Button, Checkbox, Dropdown, Feedback, Input, Popover, RadioButton, Stack, Textarea, Tooltip } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { formatDate } from '../../admin/shared/format';
import { todayIso } from '../../admin/shared/clock';
import { DateField } from './date-field';
import { Equipment, RequestDetails } from './data';
import { SafetyGuidance } from './equipamento-lib';
import { Col, Grid, ReadField } from './ui';
import './solicitacao-details.css';

/**
 * Detalhes opcionais da solicitação (v2): a pessoa que precisa dar mais contexto (urgência, risco, acesso) abre só as seções que interessam.
 * Nada aqui é obrigatório; os campos essenciais ficam no formulário principal.
 */
export const EMPTY_DETAILS: RequestDetails = {
  startedDate: '', startedTime: '', pattern: '', frequency: '', tried: [], triedNotes: '', errorCode: '', impacts: [], alternative: '',
  risks: [], riskNotes: '', bestTime: '', accessRestricted: '', accessInfo: '', extra: '',
};

const TRIED = [
  { value: 'ligado', label: 'Equipamento ligado e energizado' }, { value: 'energia', label: 'Disjuntor e tomada verificados' },
  { value: 'reiniciou', label: 'Desliguei e liguei novamente' }, { value: 'limpeza', label: 'Limpeza básica feita' }, { value: 'outro', label: 'Outra tentativa' },
];
const IMPACTS = [
  { value: 'indisponivel', label: 'Equipamento indisponível' }, { value: 'producao', label: 'Produção interrompida' },
  { value: 'estoque', label: 'Estoque ou produto em risco' }, { value: 'parcial', label: 'Operação parcial' },
];
const RISKS = [
  { value: 'agua', label: 'Vazamento de água' }, { value: 'gas', label: 'Cheiro de gás' }, { value: 'fumaca', label: 'Fumaça' },
  { value: 'eletrico', label: 'Risco elétrico' }, { value: 'nenhum', label: 'Nenhum risco identificado' },
];
const SERIOUS = ['gas', 'fumaca', 'eletrico'];
const FREQUENCY = [
  { value: 'varias', label: 'Várias vezes ao dia' }, { value: 'diaria', label: 'Uma vez ao dia' },
  { value: 'semanal', label: 'Algumas vezes na semana' }, { value: 'ocasional', label: 'Ocasionalmente' },
];
const BEST_TIME = [
  { value: 'qualquer', label: 'Qualquer horário' }, { value: 'manha', label: 'Manhã (antes das 12h)' },
  { value: 'tarde', label: 'Tarde (12h às 18h)' }, { value: 'fora', label: 'Fora do horário de funcionamento' },
];
// Horários sugeridos em intervalos de 30 minutos (lista que abre ao clicar no relógio; o seletor de hora do navegador não segue a identidade visual)
const TIMES = Array.from({ length: 48 }, (_, i) => { const t = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`; return { value: t, label: t }; });
const labelOf = (list: Array<{ value: string; label: string }>, v: string) => list.find((x) => x.value === v)?.label ?? v;
const NOTES_MAX = 300;
const EXTRA_MAX = 500;

/** Quantas informações foram preenchidas em cada seção (aparece no cabeçalho do acordeão). */
const counts = (d: RequestDetails) => [
  [d.startedDate, d.startedTime, d.pattern, d.pattern === 'intermitente' ? d.frequency : ''].filter(Boolean).length,
  d.tried.length + [d.triedNotes.trim(), d.errorCode.trim()].filter(Boolean).length,
  d.impacts.length + (d.alternative ? 1 : 0),
  d.risks.length + (d.riskNotes.trim() ? 1 : 0),
  [d.bestTime, d.accessRestricted, d.accessRestricted === 'sim' ? d.accessInfo.trim() : ''].filter(Boolean).length,
  d.extra.trim() ? 1 : 0,
];
/** Riscos de segurança graves informados (gás, fumaça, elétrico), por extenso; vazamento de água não conta. */
export const seriousRisks = (d?: RequestDetails) => (d ? d.risks.filter((r) => SERIOUS.includes(r)).map((r) => labelOf(RISKS, r).toLowerCase()) : []);
export const hasSafetyRisk = (d?: RequestDetails) => seriousRisks(d).length > 0;

/** Aviso discreto na linha das listas: só o ícone (com dica) quando o solicitante informou risco de segurança grave. Não muda a ordem nem a prioridade. */
export function SafetyRiskFlag({ details }: { details?: RequestDetails }) {
  const risks = seriousRisks(details);
  if (!risks.length) return null;
  const text = `Risco de segurança informado: ${risks.join(', ')}`;
  return (
    <Tooltip content={text} placement="right">
      <span className="risk-flag" role="img" aria-label={text} tabIndex={0}><IconAlertOctagon size={16} aria-hidden="true" /></span>
    </Tooltip>
  );
}

export const detailsFilled = (d: RequestDetails) => counts(d).some((n) => n > 0);

type ReadRow = { label: string; value: string };
/** Leitura agrupada pelas mesmas categorias do preenchimento (só o que foi informado; categoria sem nada some). */
export function detailsGroups(d: RequestDetails): Array<{ title: string; rows: ReadRow[] }> {
  const when = [d.startedDate ? formatDate(d.startedDate) : '', d.startedTime ? `às ${d.startedTime}` : ''].filter(Boolean).join(' ');
  const groups: Array<{ title: string; rows: Array<ReadRow | null> }> = [
    { title: 'Ocorrência', rows: [
      when ? { label: 'Quando começou', value: when } : null,
      d.pattern ? { label: 'O problema é', value: `${d.pattern === 'continuo' ? 'Contínuo' : 'Intermitente'}${d.pattern === 'intermitente' && d.frequency ? ` · ${labelOf(FREQUENCY, d.frequency)}` : ''}` } : null,
    ] },
    { title: 'O que já foi tentado', rows: [
      d.tried.length ? { label: 'Verificações feitas', value: d.tried.map((v) => labelOf(TRIED, v)).join(', ') } : null,
      d.triedNotes.trim() ? { label: 'Observações', value: d.triedNotes.trim() } : null,
      d.errorCode.trim() ? { label: 'Código de erro', value: d.errorCode.trim() } : null,
    ] },
    { title: 'Impacto na operação', rows: [
      d.impacts.length ? { label: 'O que está sendo afetado', value: d.impacts.map((v) => labelOf(IMPACTS, v)).join(', ') } : null,
      d.alternative ? { label: 'Equipamento alternativo', value: d.alternative === 'sim' ? 'Sim' : d.alternative === 'nao' ? 'Não' : 'Não sei' } : null,
    ] },
    { title: 'Segurança', rows: [
      d.risks.length ? { label: 'Riscos identificados', value: d.risks.map((v) => labelOf(RISKS, v)).join(', ') } : null,
      d.riskNotes.trim() ? { label: 'Outros detalhes', value: d.riskNotes.trim() } : null,
    ] },
    { title: 'Acesso e atendimento', rows: [
      d.bestTime ? { label: 'Melhor horário para atendimento', value: labelOf(BEST_TIME, d.bestTime) } : null,
      d.accessRestricted ? { label: 'Restrição de acesso', value: d.accessRestricted === 'sim' ? 'Sim' : 'Não' } : null,
      d.accessRestricted === 'sim' && d.accessInfo.trim() ? { label: 'Como acessar', value: d.accessInfo.trim() } : null,
    ] },
    { title: 'Informações adicionais', rows: [d.extra.trim() ? { label: 'Observações', value: d.extra.trim() } : null] },
  ];
  return groups.map((g) => ({ title: g.title, rows: g.rows.filter((r): r is ReadRow => !!r) })).filter((g) => g.rows.length > 0);
}

/** Detalhes adicionais em leitura (revisão antes de enviar e detalhe da solicitação): título pequeno por categoria e os campos agrupados embaixo. */
export function DetailsReadOnly({ details }: { details: RequestDetails }) {
  return (
    <div className="det-read">
      {detailsGroups(details).map((g) => (
        <section key={g.title} className="det-read-group">
          <Stack gap="sm">
          <h3 className="page-label">{g.title}</h3>
          <Grid>
            {g.rows.map((r) => {
              // linha inteira só nos textos longos; `mobileFull` não vale junto de span 12 (no desktop ele encolhe a coluna para 4)
              const wide = r.value.length > 36;
              return <Col key={r.label} span={wide ? 12 : 6} mobileFull={!wide}><ReadField label={r.label} value={r.value} /></Col>;
            })}
          </Grid>
          </Stack>
        </section>
      ))}
    </div>
  );
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/**
 * Horário digitável (00:00, com máscara) e, ao clicar no relógio, uma lista de horários no padrão do sistema. Só o horário válido vai para o formulário;
 * incompleto ou inexistente (ex.: 25:70) mostra "Horário inválido" ao sair do campo.
 */
function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  const [bad, setBad] = useState(false);
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  // Valor que vem de fora (ex.: variante do navegador) aparece no campo
  useEffect(() => { if (TIME_RE.test(value) && value !== text) { setText(value); setBad(false); } }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const type = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    const masked = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
    setText(masked); setBad(false);
    onChange(TIME_RE.test(masked) ? masked : '');
  };
  const pick = (t: string) => { setText(t); setBad(false); onChange(t); setOpen(false); };
  return (
    <div ref={anchor}>
      <Input
        label={label} optional inputMode="numeric" autoComplete="off" placeholder="00:00" maxLength={5} value={text}
        onChange={(e) => type(e.target.value)} onBlur={() => setBad(!!text && !TIME_RE.test(text))} error={bad ? 'Horário inválido' : undefined}
        iconRightAction={{ icon: <IconClock size={20} />, label: 'Escolher horário na lista', onClick: () => setOpen((o) => !o) }}
      />
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} label="Horários" align="start">
        <div role="listbox" aria-label="Horários">
          <Stack gap="2xs">
            {TIMES.map((t) => (
              <Button key={t.value} variant={t.value === value ? 'secondary' : 'ghost'} size="sm" role="option" aria-selected={t.value === value} onClick={() => pick(t.value)}>{t.label}</Button>
            ))}
          </Stack>
        </div>
      </Popover>
    </div>
  );
}

/** Grupo de caixas de seleção com rótulo (mesma semântica de fieldset, sem CSS próprio de caixa). */
function CheckGroup({ label, id, options, value, onChange }: { label: string; id: string; options: Array<{ value: string; label: string }>; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Stack gap="sm">
      <span className="read-label" id={id}>{label}</span>
      <div role="group" aria-labelledby={id}>
        <Stack gap="sm">
          {options.map((o) => (
            <Checkbox key={o.value} label={o.label} checked={value.includes(o.value)} onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((x) => x !== o.value))} />
          ))}
        </Stack>
      </div>
    </Stack>
  );
}

/** `none` = tudo fechado (padrão) · `filled` = ao voltar da revisão: abre o bloco e só as categorias preenchidas · `all` = variante do navegador. */
export type DetailsOpen = 'none' | 'filled' | 'all';

export function AdvancedDetails({ value: d, onChange, equipment, open = 'none' }: { value: RequestDetails; onChange: (next: RequestDetails) => void; equipment?: Equipment; open?: DetailsOpen }) {
  const set = <K extends keyof RequestDetails>(k: K, v: RequestDetails[K]) => onChange({ ...d, [k]: v });
  const n = counts(d);
  const meta = (i: number) => (n[i] ? `${n[i]} ${n[i] === 1 ? 'informação' : 'informações'}` : undefined);
  const seriousRisk = d.risks.some((r) => SERIOUS.includes(r));

  const items = [
    {
      title: 'Ocorrência', subtitle: 'Quando começou e como o problema se comporta', meta: meta(0),
      content: (
        <Grid>
          <Col span={6} mobileFull><DateField label="Quando o problema começou" optional max={todayIso()} value={d.startedDate} onChange={(v) => set('startedDate', v)} /></Col>
          <Col span={6} mobileFull><TimeField label="Horário aproximado" value={d.startedTime} onChange={(v) => set('startedTime', v)} /></Col>
          <Col span={12}>
            <RadioButton name="det-pattern" label="O problema é" orientation="horizontal" options={[{ value: 'continuo', label: 'Contínuo' }, { value: 'intermitente', label: 'Intermitente' }]} value={d.pattern} onChange={(v) => set('pattern', v as RequestDetails['pattern'])} />
          </Col>
          {d.pattern === 'intermitente' && (
            <Col span={6} mobileFull><Dropdown label="Com que frequência acontece" optional placeholder="Selecione" options={FREQUENCY} value={d.frequency} onChange={(v) => set('frequency', v)} /></Col>
          )}
        </Grid>
      ),
    },
    {
      title: 'O que já foi tentado', subtitle: 'Ajuda a equipe a não repetir verificações', meta: meta(1),
      content: (
        <Stack gap="md">
          <CheckGroup label="Marque o que você já verificou ou fez" id="det-tried" options={TRIED} value={d.tried} onChange={(v) => set('tried', v)} />
          <Textarea label="Observações sobre o que foi feito" optional rows={3} maxLength={NOTES_MAX} value={d.triedNotes} onChange={(e) => set('triedNotes', e.target.value)} helperText={`${d.triedNotes.length}/${NOTES_MAX} caracteres`} />
          <Input label="Código de erro exibido" optional placeholder="Ex.: E1, Erro 24" autoComplete="off" value={d.errorCode} onChange={(e) => set('errorCode', e.target.value)} helperText="Se o equipamento mostrar algum código no painel" />
        </Stack>
      ),
    },
    {
      title: 'Impacto na operação', subtitle: 'O que o problema está afetando agora', meta: meta(2),
      content: (
        <Stack gap="md">
          <DevNote note="O Impacto (Baixo, Médio, Alto) do formulário principal é a gravidade e entra na matriz de prioridade da triagem. Aqui a pessoa diz o que está sendo afetado (vários itens podem valer) e se há equipamento alternativo; a triagem lê como contexto, não muda a prioridade sozinha.">
            <CheckGroup label="O que está sendo afetado" id="det-impacts" options={IMPACTS} value={d.impacts} onChange={(v) => set('impacts', v)} />
          </DevNote>
          <RadioButton name="det-alt" label="Existe equipamento alternativo?" orientation="horizontal" options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }, { value: 'nao-sei', label: 'Não sei' }]} value={d.alternative} onChange={(v) => set('alternative', v as RequestDetails['alternative'])} />
        </Stack>
      ),
    },
    {
      title: 'Segurança', subtitle: 'Riscos para pessoas ou para o local', meta: meta(3),
      content: (
        <Stack gap="md">
          <CheckGroup
            label="Há algum risco identificado?" id="det-risks" options={RISKS} value={d.risks}
            // "Nenhum risco" exclui os demais, e qualquer risco desmarca "Nenhum"
            onChange={(v) => set('risks', v.includes('nenhum') && !d.risks.includes('nenhum') ? ['nenhum'] : v.filter((x) => x !== 'nenhum' || v.length === 1))}
          />
          {seriousRisk && (
            <DevNote note="Risco de gás, fumaça ou elétrico: o formulário avisa para afastar as pessoas e seguir o procedimento de emergência da operação antes de continuar, e repete a orientação de segurança do equipamento, se houver. Só orienta: não aciona ninguém. 💡 A confirmar com o cliente se esse risco deve elevar o impacto ou notificar o gestor automaticamente.">
              <Stack gap="md">
                <Feedback type="warning" title="Em caso de risco imediato, priorize a segurança" message="Afaste as pessoas do local e siga o procedimento de emergência da sua operação. Depois, envie a solicitação" />
                <SafetyGuidance note={equipment?.safetyNote} />
              </Stack>
            </DevNote>
          )}
          <Textarea label="Outros detalhes" optional rows={3} maxLength={NOTES_MAX} value={d.riskNotes} onChange={(e) => set('riskNotes', e.target.value)} helperText={`${d.riskNotes.length}/${NOTES_MAX} caracteres`} placeholder="Descreva outros riscos ou informações relevantes" />
        </Stack>
      ),
    },
    {
      title: 'Acesso e atendimento', subtitle: 'Ajuda o prestador a chegar e a combinar a visita', meta: meta(4),
      content: (
        <Grid>
          <Col span={6} mobileFull><Dropdown label="Melhor horário para atendimento" optional placeholder="Selecione" options={BEST_TIME} value={d.bestTime} onChange={(v) => set('bestTime', v)} /></Col>
          <Col span={6} mobileFull>
            <RadioButton name="det-access" label="Há restrição de acesso?" orientation="horizontal" options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]} value={d.accessRestricted} onChange={(v) => set('accessRestricted', v as RequestDetails['accessRestricted'])} />
          </Col>
          {d.accessRestricted === 'sim' && (
            <Col span={12}><Textarea label="Como acessar" optional rows={3} maxLength={NOTES_MAX} value={d.accessInfo} onChange={(e) => set('accessInfo', e.target.value)} placeholder="Portaria, senha, responsável pelo local, chave do armário…" helperText={`${d.accessInfo.length}/${NOTES_MAX} caracteres`} /></Col>
          )}
        </Grid>
      ),
    },
    {
      title: 'Informações adicionais', subtitle: 'Qualquer outra coisa que ajude a equipe', meta: meta(5),
      content: <Textarea label="Informações adicionais" optional rows={4} maxLength={EXTRA_MAX} value={d.extra} onChange={(e) => set('extra', e.target.value)} helperText={`${d.extra.length}/${EXTRA_MAX} caracteres`} />,
    },
  ];

  const total = n.reduce((x, y) => x + y, 0);
  const innerOpen = open === 'all' ? items.map((_, i) => i) : open === 'filled' ? items.map((_, i) => i).filter((i) => n[i] > 0) : [];

  // Bloco recolhível (fechado por padrão) com as categorias dentro, também fechadas: a pessoa abre só o que precisa preencher
  return (
    <div className="det-acc det-acc--outer">
      <Accordion
        key={open} headingLevel={2} defaultOpenIndex={open === 'none' ? [] : [0]}
        items={[{
          title: 'Detalhes adicionais',
          // o total vem numa linha de estado (ícone + peso + cor de sucesso), para não se confundir com a descrição
          subtitle: <>Adicione informações que ajudem a equipe a entender o problema e realizar o atendimento.{total > 0 && <span className="det-count"><IconCircleCheck size={16} aria-hidden="true" />{`${total} ${total === 1 ? 'informação adicionada' : 'informações adicionadas'}`}</span>}</>,
          meta: <Badge status="neutral">Opcional</Badge>,
          content: <div className="det-acc det-acc--inner"><Accordion allowMultiple items={items} defaultOpenIndex={innerOpen} headingLevel={3} /></div>,
        }]}
      />
    </div>
  );
}
