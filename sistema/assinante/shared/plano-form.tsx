import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowDown, IconArrowUp, IconChevronLeft, IconChevronRight, IconPlus, IconTrash } from '@tabler/icons-react';
import { Badge, Button, Card, DatePicker, Dropdown, Feedback, Input, RadioButton, Stack, Textarea } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { formatDate, requiredMessage } from '../../admin/shared/format';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { CHECKLIST_KIND_LABEL, ChecklistItem, ChecklistKind, EVIDENCE_OPTIONS, Executor, Frequency, Plan, nowLocal } from './data';
import { CheckGroup } from './ListKit';
import { EquipmentPicker } from './PlanEquipmentPicker';
import { EVERY_UNIT, FREQUENCY_OPTIONS, TODAY, WEEKDAY_OPTIONS, describeFrequency, executorOf, occurrences, savePlan } from './preventivas';
import { nextSeq, unitName, useSubSession } from './store';
import { useRefs } from './ui';
import { Col, Grid, ReadField, SectionLabel, Text, goTo, param, setFlash } from './ui';

/**
 * RF601 - Criar/editar plano em 6 passos. O DS não tem Stepper: composto com Stack de Buttons (passos futuros
 * desabilitados) + texto "Passo N de 6" e um Card por passo. Variantes: #state=required · step2 … step6 · ?id= (edição).
 */
const STEPS = ['Informações', 'Programação', 'Executor', 'Checklist', 'Evidências e anomalia', 'Revisão'];

interface Draft {
  name: string; description: string; equipmentIds: string[];
  startDate: string; endDate: string; frequency: Frequency; every: string; refDay: string; winFrom: string; winTo: string; durationH: string;
  executorKind: '' | 'interno' | 'prestador'; userId: string; providerId: string; technician: string;
  checklist: ChecklistItem[]; evidences: string[]; onAnomaly: '' | Plan['onAnomaly'];
}

const uid = () => `new-${Math.random().toString(36).slice(2, 8)}`;
const blankItem = (): ChecklistItem => ({ id: uid(), text: '', kind: 'obrigatorio' });
const BLANK: Draft = {
  name: '', description: '', equipmentIds: [], startDate: '', endDate: '', frequency: 'mensal', every: '1', refDay: '', winFrom: '', winTo: '', durationH: '',
  executorKind: '', userId: '', providerId: '', technician: '', checklist: [blankItem()], evidences: [], onAnomaly: '',
};
const KIND_OPTIONS = (Object.keys(CHECKLIST_KIND_LABEL) as ChecklistKind[]).map((value) => ({ value, label: CHECKLIST_KIND_LABEL[value] }));
const ANOMALY_OPTIONS = [
  { value: 'abrir-solicitacao', label: 'Abrir solicitação corretiva automaticamente' },
  { value: 'registrar', label: 'Apenas registrar a anomalia' },
];

/** `#state=step3` (letras e dígitos - o `useHashState` do Admin só lê letras). */
const readState = () => /state=([a-z0-9]+)/.exec(location.hash)?.[1] ?? 'idle';

const fromPlan = (p: Plan): Draft => ({
  name: p.name, description: p.description ?? '', equipmentIds: p.equipmentIds, startDate: p.startDate, endDate: p.endDate ?? '', frequency: p.frequency, every: String(p.every),
  refDay: p.frequency === 'diaria' ? '' : String(p.refDay), winFrom: p.window?.from ?? '', winTo: p.window?.to ?? '', durationH: p.durationH ? String(p.durationH) : '',
  executorKind: p.executor.kind, userId: p.executor.kind === 'interno' ? p.executor.userId : '', providerId: p.executor.kind === 'prestador' ? p.executor.providerId : '',
  technician: p.executor.kind === 'prestador' ? p.executor.technician ?? '' : '', checklist: p.checklist.map((c) => ({ ...c })), evidences: [...p.evidences], onAnomaly: p.onAnomaly,
});

function PlanoFormScreen() {
  const { db, user, can, unitIds } = useSubSession();
  const refs = useRefs();
  const editing = db.plans.find((p) => p.id === param('id'));
  const initialState = useMemo(readState, []);
  const startStep = /^step([2-6])$/.exec(initialState)?.[1];
  const [d, setD] = useState<Draft>(() => {
    if (editing) return fromPlan(editing);
    if (!startStep) return structuredClone(BLANK);
    // Variantes do navegador: exemplo preenchido para abrir direto no passo
    const lava = db.equipments.filter((e) => e.name.startsWith('Lava-louças') && unitIds.includes(e.unitId)).slice(0, 2).map((e) => e.id);
    return {
      name: 'Preventiva trimestral das lava-louças', description: 'Limpeza dos braços de lavagem e checagem das bombas', equipmentIds: lava,
      startDate: TODAY, endDate: '', frequency: 'mensal', every: '3', refDay: '10', winFrom: '08:00', winTo: '10:00', durationH: '2',
      executorKind: 'prestador', userId: '', providerId: 'PRE-005', technician: 'Nilson Ferraz',
      checklist: [{ id: uid(), text: 'Limpar os braços de lavagem', kind: 'obrigatorio' }, { id: uid(), text: 'Medir a temperatura de enxágue', kind: 'leitura', unit: '°C' }, { id: uid(), text: 'Verificar o dreno', kind: 'opcional' }],
      evidences: ['Foto antes/depois'], onAnomaly: 'abrir-solicitacao',
    };
  });
  const [step, setStep] = useState(editing ? 1 : Number(startStep ?? 1));
  const [maxStep, setMaxStep] = useState(editing ? 6 : Number(startStep ?? 1));
  const [tried, setTried] = useState(initialState === 'required');
  const [banner, setBanner] = useState<'required' | 'multiple' | null>(null);
  const [tick, setTick] = useState(initialState === 'required' ? 1 : 0);
  const [saving, setSaving] = useState(false);
  const topRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const on = () => {
      const m = /^step([2-6])$/.exec(readState());
      if (m && !editing) { setStep(Number(m[1])); setMaxStep((x) => Math.max(x, Number(m[1]))); setTried(false); }
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, [editing]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setItem = (id: string, patch: Partial<ChecklistItem>) => setD((x) => ({ ...x, checklist: x.checklist.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const moveItem = (i: number, dir: -1 | 1) => setD((x) => { const a = [...x.checklist]; const j = i + dir; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, checklist: a }; });

  // ── dados de apoio ──
  const selectedEquipments = d.equipmentIds.map((id) => db.equipments.find((e) => e.id === id)).filter(Boolean) as typeof db.equipments;
  const categories = [...new Set(selectedEquipments.map((e) => e.categoryId))];
  const executorUsers = db.users.filter((u) => (u.profile === 'executor' && u.status === 'ativo') || u.id === d.userId);
  const providers = db.providers.filter((p) => p.status === 'ativo' && categories.every((c) => p.categoryIds.includes(c)));
  const provider = db.providers.find((p) => p.id === d.providerId);
  const providerInactive = !!provider && provider.status === 'inativo';
  const everyN = Math.floor(Number(d.every));
  const schedule = { startDate: d.startDate, endDate: d.endDate || undefined, frequency: d.frequency, every: everyN > 0 ? everyN : 1, refDay: d.frequency === 'diaria' ? 1 : Number(d.refDay) || 1 };
  const preview = useMemo(() => (d.startDate ? occurrences(schedule, TODAY, 6) : []), [d.startDate, d.endDate, d.frequency, d.every, d.refDay]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── validação por passo (CTA002: não salva sem equipamento, periodicidade, executor e checklist) ──
  const errorsOf = (n: number): Record<string, string | undefined> => {
    if (n === 1) return { name: !d.name.trim() ? requiredMessage('Nome do plano') : undefined, equipments: !d.equipmentIds.length ? requiredMessage('Equipamentos') : undefined };
    if (n === 2) {
      const day = Number(d.refDay);
      const dayErr = d.frequency === 'diaria' ? undefined
        : d.frequency === 'semanal' ? (!d.refDay ? requiredMessage('Dia da semana') : undefined)
        : !d.refDay ? requiredMessage('Dia do mês') : !(day >= 1 && day <= 31) ? 'Informe um dia entre 1 e 31' : undefined;
      return {
        startDate: !d.startDate ? requiredMessage('Data de início') : undefined,
        endDate: d.endDate && d.startDate && d.endDate < d.startDate ? 'A data de término deve ser igual ou posterior ao início' : undefined,
        every: !d.every.trim() ? requiredMessage('Repetir a cada') : !(everyN >= 1) ? 'Informe um número maior que zero' : undefined,
        refDay: dayErr,
        winFrom: d.winTo && !d.winFrom ? requiredMessage('Início da janela') : undefined,
        winTo: d.winFrom && !d.winTo ? requiredMessage('Fim da janela') : d.winFrom && d.winTo && d.winTo <= d.winFrom ? 'O fim deve ser depois do início' : undefined,
        durationH: d.durationH && !(Number(d.durationH.replace(',', '.')) > 0) ? 'Informe uma duração maior que zero' : undefined,
      };
    }
    if (n === 3) {
      return {
        kind: !d.executorKind ? requiredMessage('Tipo de executor') : undefined,
        userId: d.executorKind === 'interno' && !d.userId ? requiredMessage('Executor padrão') : undefined,
        providerId: d.executorKind === 'prestador' && (!d.providerId || providerInactive || !providers.some((p) => p.id === d.providerId)) ? requiredMessage('Prestador padrão') : undefined,
      };
    }
    if (n === 4) {
      const e: Record<string, string | undefined> = { checklist: !d.checklist.length ? requiredMessage('Checklist') : undefined };
      d.checklist.forEach((c) => {
        e[`${c.id}.text`] = !c.text.trim() ? requiredMessage('Descrição') : undefined;
        e[`${c.id}.unit`] = c.kind === 'leitura' && !c.unit?.trim() ? requiredMessage('Unidade da leitura') : undefined;
      });
      return e;
    }
    if (n === 5) return { onAnomaly: !d.onAnomaly ? requiredMessage('Comportamento em caso de anomalia') : undefined };
    return {};
  };
  const stepErrors = errorsOf(step);
  const shown = (k: string) => (tried ? stepErrors[k] : undefined);
  const hasErrors = (n: number) => Object.values(errorsOf(n)).some(Boolean);

  // Depois de tentar avançar (erros já renderizados): aviso no topo e foco no primeiro campo com erro
  useEffect(() => {
    if (!tick) return;
    const messages = Object.values(stepErrors).filter(Boolean) as string[];
    if (!messages.length) return;
    const empty = messages.filter((m) => /é obrigatório$/.test(m)).length;
    setBanner(messages.length === 1 ? null : empty === messages.length ? 'required' : 'multiple');
    const t = window.setTimeout(() => {
      const first = document.querySelector<HTMLElement>('form [aria-invalid="true"]');
      first?.scrollIntoView({ block: 'center' });
      first?.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const goStep = (n: number) => { setStep(n); setMaxStep((m) => Math.max(m, n)); setTried(false); setBanner(null); window.scrollTo({ top: 0 }); window.setTimeout(() => topRef.current?.focus(), 0); };
  const attempt = () => { setTried(true); setBanner(null); setTick((n) => n + 1); };
  const next = () => { if (hasErrors(step)) return attempt(); goStep(step + 1); };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step < 6) return next();
    const bad = [1, 2, 3, 4, 5].find(hasErrors);
    if (bad) { goStep(bad); window.setTimeout(attempt, 0); return; }
    setSaving(true);
    const id = editing?.id ?? nextSeq('PLA', db.plans.map((p) => p.id), 3);
    const executor: Executor = d.executorKind === 'interno' ? { kind: 'interno', userId: d.userId } : { kind: 'prestador', providerId: d.providerId, technician: d.technician || undefined };
    const plan: Plan = {
      id, name: d.name.trim(), description: d.description.trim() || undefined, equipmentIds: d.equipmentIds,
      startDate: d.startDate, endDate: d.endDate || undefined, frequency: d.frequency, every: everyN, refDay: schedule.refDay,
      window: d.winFrom && d.winTo ? { from: d.winFrom, to: d.winTo } : undefined, durationH: d.durationH ? Number(d.durationH.replace(',', '.')) : undefined,
      executor, evidences: d.evidences, onAnomaly: d.onAnomaly as Plan['onAnomaly'],
      checklist: d.checklist.map((c) => ({ id: c.id.startsWith('new-') ? `${id}-${c.id.slice(4)}` : c.id, text: c.text.trim(), kind: c.kind, unit: c.kind === 'leitura' ? c.unit?.trim() : undefined })),
      status: editing?.status ?? 'ativo', createdAt: editing?.createdAt ?? nowLocal(),
    };
    const r = savePlan(plan, user, !!editing);
    setFlash(editing
      ? { type: 'success', title: 'Plano atualizado', message: 'As alterações valem para as próximas execuções.' }
      : { type: 'success', title: 'Plano criado', message: `O plano está ativo: ${r.newExecutions} execuções previstas e ${r.newOrders} OS preventiva${r.newOrders === 1 ? '' : 's'} geradas.` });
    window.setTimeout(() => goTo(`plano.html?id=${id}`), 400);
  };

  const cancel = () => goTo(editing ? `plano.html?id=${editing.id}` : 'planos.html');
  const allowed = can('planos', editing ? 'editar' : 'cadastrar');
  const crumbs = [{ label: 'Planos de manutenção', href: 'planos.html' }, { label: editing ? 'Editar' : 'Novo plano' }];

  if (editing === undefined && param('id')) {
    return <AppLayout active="planos" screen="planos"><Feedback type="error" title="Plano não encontrado" message="Volte para a lista de planos e tente novamente" /></AppLayout>;
  }
  if (!allowed) {
    return <AppLayout active="planos" screen="planos"><Feedback type="error" title="Sem permissão" message={`Seu perfil não pode ${editing ? 'editar' : 'criar'} planos de manutenção`} /></AppLayout>;
  }

  // ── passos ──
  const stepper = (
    <Stack gap="sm">
      <nav aria-label="Passos do plano">
        <ol className="step-list">
          {STEPS.map((label, i) => {
            const n = i + 1;
            return (
              <li key={label}>
                <Button size="sm" variant={n === step ? 'primary' : 'secondary'} disabled={n > maxStep} aria-current={n === step ? 'step' : undefined} onClick={() => goStep(n)}>{`${n}. ${label}`}</Button>
              </li>
            );
          })}
        </ol>
      </nav>
      <Text>{`Passo ${step} de ${STEPS.length} · ${STEPS[step - 1]}`}</Text>
    </Stack>
  );

  const step1 = (
    <Card className="card-open" title="Informações" subtitle="Identifique o plano e escolha os equipamentos que seguem a preventiva">
      <div className="card-body-tight">
        <Stack gap="lg">
          <Grid>
            <Col span={12}><Input label="Nome do plano" required autoComplete="off" value={d.name} onChange={(e) => set('name', e.target.value)} error={shown('name')} /></Col>
            <Col span={12}><Textarea optional label="Descrição" rows={3} value={d.description} onChange={(e) => set('description', e.target.value)} /></Col>
          </Grid>
          <DevNote note="RF601-FLU002: vários equipamentos, de uma ou mais unidades (agrupados por unidade, com busca). 💡 RGN003: o plano gera uma execução e uma OS por equipamento (a confirmar). Obrigatório pelo menos 1 (CTA002).">
            <Stack gap="xs">
              <SectionLabel>Equipamentos</SectionLabel>
              <EquipmentPicker selected={d.equipmentIds} onChange={(ids) => set('equipmentIds', ids)} error={shown('equipments')} />
            </Stack>
          </DevNote>
        </Stack>
      </div>
    </Card>
  );

  const everyLabel = `Repetir a cada (${EVERY_UNIT[d.frequency]})`;
  const step2 = (
    <Stack gap="xl">
      <Card className="card-open" title="Programação" subtitle="Calendário fixo: as execuções seguem as datas, mesmo que a anterior não seja concluída">
        <div className="card-body-tight">
          <Grid>
            <Col span={6}><DatePicker label="Data de início" required value={d.startDate} onChange={(v) => set('startDate', v)} error={shown('startDate')} /></Col>
            <Col span={6}><DatePicker optional label="Data de término" value={d.endDate} min={d.startDate || undefined} onChange={(v) => set('endDate', v)} error={shown('endDate')} /></Col>
            <Col span={12}>
              <DevNote note="RF601: periodicidade = frequência (diária, semanal, mensal, anual) + “a cada N” + dia de referência (ex.: dia 15). Recorrência fixa (RGN005): a próxima execução é gerada na data prevista mesmo que a anterior não tenha sido concluída (CTA003).">
                <Dropdown
                  label="Frequência" required options={FREQUENCY_OPTIONS} value={d.frequency}
                  onChange={(v) => setD((x) => ({ ...x, frequency: v as Frequency, refDay: v === 'semanal' ? '1' : v === x.frequency ? x.refDay : '' }))}
                />
              </DevNote>
            </Col>
            <Col span={6}><Input label={everyLabel} required type="number" min={1} inputMode="numeric" value={d.every} onChange={(e) => set('every', e.target.value)} error={shown('every')} /></Col>
            {d.frequency === 'semanal' && <Col span={6}><Dropdown label="Dia da semana" required options={WEEKDAY_OPTIONS} value={d.refDay} onChange={(v) => set('refDay', v)} error={shown('refDay')} /></Col>}
            {(d.frequency === 'mensal' || d.frequency === 'anual') && (
              <Col span={6}>
                <Input
                  label="Dia do mês de referência" required type="number" min={1} max={31} inputMode="numeric" value={d.refDay} onChange={(e) => set('refDay', e.target.value)} error={shown('refDay')}
                  helperText={d.frequency === 'anual' ? 'O mês é o da data de início' : 'Em meses mais curtos, usa o último dia do mês'}
                />
              </Col>
            )}
            <Col span={6}><Input optional label="Início da janela de execução" type="time" value={d.winFrom} onChange={(e) => set('winFrom', e.target.value)} error={shown('winFrom')} /></Col>
            <Col span={6}><Input optional label="Fim da janela de execução" type="time" value={d.winTo} onChange={(e) => set('winTo', e.target.value)} error={shown('winTo')} /></Col>
            <Col span={6}><Input optional label="Duração estimada (horas)" inputMode="decimal" value={d.durationH} onChange={(e) => set('durationH', e.target.value.replace(/[^\d.,]/g, ''))} error={shown('durationH')} /></Col>
          </Grid>
        </div>
      </Card>
      <DevNote note="Prévia calculada na hora a partir das regras acima, a partir de hoje (uma execução por equipamento - 💡 RF601-RGN003). As OS são abertas automaticamente (RGN002); 💡 antecedência de geração a confirmar.">
        <Card className="card-open" title="Prévia das próximas execuções" subtitle={d.startDate ? `${d.equipmentIds.length || 'Nenhum'} ${d.equipmentIds.length === 1 ? 'equipamento' : 'equipamentos'} em cada data` : 'Informe a data de início para ver as datas'}>
          <div className="card-body-tight">
            {preview.length === 0
              ? <Text>{d.startDate ? 'Nenhuma execução prevista com a programação informada' : 'Preencha a programação para calcular as datas'}</Text>
              : (
                <Stack direction="horizontal" gap="sm" wrap>
                  {preview.map((date) => <Badge key={date} status="info">{new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</Badge>)}
                </Stack>
              )}
          </div>
        </Card>
      </DevNote>
    </Stack>
  );

  const step3 = (
    <Card className="card-open" title="Executor" subtitle="Quem recebe as OS preventivas geradas pelo plano">
      <div className="card-body-tight">
        <Grid>
          <Col span={12}>
            <RadioButton
              name="executor-kind" label="Tipo de executor" orientation="horizontal" value={d.executorKind} error={shown('kind')}
              options={[{ value: 'interno', label: 'Equipe interna' }, { value: 'prestador', label: 'Prestador externo' }]}
              onChange={(v) => setD((x) => ({ ...x, executorKind: v as Draft['executorKind'] }))}
            />
          </Col>
          {d.executorKind === 'interno' && (
            <Col span={12}>
              <DevNote note="Usuários ativos com perfil Executor (RF204). Ele recebe a OS preventiva e acessa só as suas OS.">
                <Dropdown label="Executor padrão" required options={executorUsers.map((u) => ({ value: u.id, label: u.name }))} value={d.userId} onChange={(v) => set('userId', v)} error={shown('userId')} placeholder="Selecione o executor" />
              </DevNote>
            </Col>
          )}
          {d.executorKind === 'prestador' && (
            <>
              <Col span={12}>
                <DevNote note="RF702-RGN004 / CTA001: só prestadores ativos (RF701-RGN001) que atendem as categorias de todos os equipamentos selecionados. Se mudar os equipamentos, a lista muda.">
                  <Dropdown
                    label="Prestador padrão" required options={providers.map((p) => ({ value: p.id, label: p.tradeName ?? p.name }))} value={d.providerId}
                    onChange={(v) => setD((x) => ({ ...x, providerId: v, technician: '' }))} error={shown('providerId')} placeholder="Selecione o prestador"
                    helperText={categories.length ? `Atendem as categorias: ${categories.map((c) => refs.category(c)?.name ?? c).join(', ')}` : undefined}
                  />
                </DevNote>
              </Col>
              {providerInactive && <Col span={12}><Feedback type="warning" title="Prestador inativo" message="O prestador padrão deste plano está inativo e não é ofertado. Escolha outro" /></Col>}
              {providers.length === 0 && <Col span={12}><Feedback type="info" message="Nenhum prestador ativo atende todas as categorias dos equipamentos selecionados. Revise a seleção no passo 1 ou cadastre um prestador" /></Col>}
              <Col span={12}>
                <Dropdown
                  optional label="Técnico" placeholder="Qualquer técnico do prestador" value={d.technician} onChange={(v) => set('technician', v)}
                  options={[{ value: '', label: 'Qualquer técnico do prestador' }, ...(provider?.technicians ?? []).map((t) => ({ value: t.name, label: `${t.name} · ${t.specialty}` }))]}
                />
              </Col>
            </>
          )}
        </Grid>
      </div>
    </Card>
  );

  const step4 = (
    <DevNote note="RF601-FLU005 / CTA002: ao menos 1 item. Tipos: Obrigatório (precisa ser marcado), Leitura obrigatória (valor + unidade de medida na execução - RF603) e Opcional.">
      <Card className="card-open" title="Checklist" subtitle="Procedimentos que o executor percorre em cada preventiva">
        <div className="card-body-tight">
          <Stack gap="lg">
            {shown('checklist') && <Feedback type="error" message={shown('checklist')!} />}
            {d.checklist.map((c, i) => (
              <Card key={c.id} className="card-open contact-card">
                <Stack gap="md">
                  <Stack direction="horizontal" justify="between" align="center" wrap>
                    <h3 className="page-label">{`Item ${i + 1}`}</h3>
                    <Stack direction="horizontal" gap="2xs">
                      <Button variant="ghost" size="sm" iconOnly iconLeft={<IconArrowUp size={16} />} aria-label={`Subir item ${i + 1}`} disabled={i === 0} onClick={() => moveItem(i, -1)} />
                      <Button variant="ghost" size="sm" iconOnly iconLeft={<IconArrowDown size={16} />} aria-label={`Descer item ${i + 1}`} disabled={i === d.checklist.length - 1} onClick={() => moveItem(i, 1)} />
                      <Button variant="ghost" size="sm" iconLeft={<IconTrash size={16} />} aria-label={`Remover item ${i + 1}`} onClick={() => set('checklist', d.checklist.filter((x) => x.id !== c.id))}>Remover</Button>
                    </Stack>
                  </Stack>
                  <Grid>
                    <Col span={12}><Input label="Descrição" required autoComplete="off" value={c.text} onChange={(e) => setItem(c.id, { text: e.target.value })} error={shown(`${c.id}.text`)} /></Col>
                    <Col span={6}><Dropdown label="Tipo" required options={KIND_OPTIONS} value={c.kind} onChange={(v) => setItem(c.id, { kind: v as ChecklistKind })} /></Col>
                    {c.kind === 'leitura' && <Col span={6}><Input label="Unidade da leitura" required placeholder="°C, bar, A…" autoComplete="off" value={c.unit ?? ''} onChange={(e) => setItem(c.id, { unit: e.target.value })} error={shown(`${c.id}.unit`)} /></Col>}
                  </Grid>
                </Stack>
              </Card>
            ))}
            <Stack direction="horizontal">
              <Button variant="ghost" size="sm" iconLeft={<IconPlus size={16} />} onClick={() => set('checklist', [...d.checklist, blankItem()])}>Adicionar item</Button>
            </Stack>
          </Stack>
        </div>
      </Card>
    </DevNote>
  );

  const step5 = (
    <Card className="card-open" title="Evidências e anomalias" subtitle="O que o executor precisa anexar e o que acontece se encontrar um problema">
      <div className="card-body-tight">
        <Stack gap="xl">
          <CheckGroup
            optional label="Evidências obrigatórias" helperText="Sem estas evidências a execução não pode ser concluída" columns
            options={EVIDENCE_OPTIONS.map((o) => ({ value: o, label: o }))} value={d.evidences} onChange={(v) => set('evidences', v)}
          />
          <DevNote note="RF601 / RF603-RGN002: com “abrir solicitação corretiva”, a anomalia registrada na execução cria uma solicitação vinculada ao equipamento, que segue a triagem normal (RF603-RGN004 / P15). A política por assinante seria FE009 (fora do escopo).">
            <RadioButton name="on-anomaly" label="Comportamento em caso de anomalia" options={ANOMALY_OPTIONS} value={d.onAnomaly} onChange={(v) => set('onAnomaly', v as Draft['onAnomaly'])} error={shown('onAnomaly')} />
          </DevNote>
        </Stack>
      </div>
    </Card>
  );

  const editBtn = (n: number) => <Button size="sm" variant="ghost" onClick={() => goStep(n)}>Editar</Button>;
  const execName = d.executorKind === 'interno' ? executorOf(db, { kind: 'interno', userId: d.userId }).primary : d.executorKind === 'prestador' ? executorOf(db, { kind: 'prestador', providerId: d.providerId }).primary : undefined;
  const unitsOfSelection = [...new Set(selectedEquipments.map((e) => e.unitId))];
  const step6 = (
    <Stack gap="xl">
      <Feedback
        type="info" title="Recorrência fixa"
        message="As execuções seguem o calendário mesmo que a anterior não tenha sido concluída. A execução não concluída fica como “Não realizada” e continua contando como atrasada no cumprimento"
      />
      <DevNote note="RF601-RGN005 / CTA003 (recorrência fixa, decisão 29/09). 💡 RGN002/RGN003 (a confirmar): uma OS preventiva por equipamento, gerada para a próxima execução; antecedência de geração a definir. Aprovação do plano pelo gestor é FE006 (fora do escopo).">
        <Text>{editing
          ? 'Ao salvar, o plano é atualizado e as próximas execuções são recalculadas. As execuções passadas e as OS em andamento não mudam'
          : `Ao salvar, o plano fica Ativo, as próximas execuções são calculadas e uma OS preventiva é aberta para cada um dos ${d.equipmentIds.length} equipamentos`}
        </Text>
      </DevNote>
      <Card className="card-open" title="Informações" actions={editBtn(1)}>
        <div className="card-body-tight">
          <Grid>
            <Col span={6}><ReadField label="Nome do plano" value={d.name} /></Col>
            <Col span={6}><ReadField label="Descrição" value={d.description} /></Col>
            <Col span={12}><ReadField label="Equipamentos" value={`${d.equipmentIds.length} em ${unitsOfSelection.length} ${unitsOfSelection.length === 1 ? 'unidade' : 'unidades'}: ${selectedEquipments.map((e) => `${e.name} (${unitName(db, e.unitId)})`).join(', ')}`} /></Col>
          </Grid>
        </div>
      </Card>
      <Card className="card-open" title="Programação" actions={editBtn(2)}>
        <div className="card-body-tight">
          <Grid>
            <Col span={6}><ReadField label="Início" value={d.startDate ? formatDate(d.startDate) : undefined} /></Col>
            <Col span={6}><ReadField label="Término" value={d.endDate ? formatDate(d.endDate) : 'Sem data de término'} /></Col>
            <Col span={6}><ReadField label="Periodicidade" value={describeFrequency({ ...schedule })} /></Col>
            <Col span={6}><ReadField label="Janela / duração" value={[d.winFrom && d.winTo ? `${d.winFrom} às ${d.winTo}` : '', d.durationH ? `${d.durationH} h` : ''].filter(Boolean).join(' · ') || undefined} /></Col>
            <Col span={12}><ReadField label="Próximas execuções" value={preview.slice(0, 3).map(formatDate).join(', ') || undefined} /></Col>
          </Grid>
        </div>
      </Card>
      <Card className="card-open" title="Executor" actions={editBtn(3)}>
        <div className="card-body-tight">
          <Grid>
            <Col span={6}><ReadField label="Tipo de executor" value={d.executorKind === 'interno' ? 'Equipe interna' : d.executorKind === 'prestador' ? 'Prestador externo' : undefined} /></Col>
            <Col span={6}><ReadField label={d.executorKind === 'prestador' ? 'Prestador padrão' : 'Executor padrão'} value={execName} /></Col>
            {d.executorKind === 'prestador' && <Col span={12}><ReadField label="Técnico" value={d.technician || 'Qualquer técnico do prestador'} /></Col>}
          </Grid>
        </div>
      </Card>
      <Card className="card-open" title="Checklist" actions={editBtn(4)}>
        <div className="card-body-tight">
          <Stack gap="sm">
            {d.checklist.map((c) => (
              <Stack key={c.id} direction="horizontal" justify="between" align="start" gap="md">
                <span className="page-text"><strong>{c.text || '-'}</strong>{c.kind === 'leitura' && c.unit ? ` (${c.unit})` : ''}</span>
                <Badge status={c.kind === 'opcional' ? 'neutral' : c.kind === 'leitura' ? 'info' : 'brand'}>{CHECKLIST_KIND_LABEL[c.kind]}</Badge>
              </Stack>
            ))}
          </Stack>
        </div>
      </Card>
      <Card className="card-open" title="Evidências e anomalias" actions={editBtn(5)}>
        <div className="card-body-tight">
          <Grid>
            <Col span={6}><ReadField label="Evidências obrigatórias" value={d.evidences.length ? d.evidences.join(', ') : 'Nenhuma'} /></Col>
            <Col span={6}><ReadField label="Em caso de anomalia" value={ANOMALY_OPTIONS.find((o) => o.value === d.onAnomaly)?.label} /></Col>
          </Grid>
        </div>
      </Card>
    </Stack>
  );

  const body = [step1, step2, step3, step4, step5, step6][step - 1];
  const last = step === 6;

  return (
    <AppLayout active="planos" screen="planos">
      <form className="form-page" onSubmit={onSubmit} onChangeCapture={() => setBanner(null)} noValidate>
        <Stack gap="xl">
          <PageHeader
            title={editing ? `Editar ${editing.name}` : 'Novo plano'} breadcrumb={crumbs}
            subtitle={editing ? 'Alterar o plano afeta apenas as execuções futuras' : 'Configure a preventiva em 6 passos; as OS são geradas automaticamente'}
          />
          <h2 className="sr-only" tabIndex={-1} ref={topRef}>{`Passo ${step} de ${STEPS.length}: ${STEPS[step - 1]}`}</h2>

          {banner && (
            <div className="floating-feedback">
              {banner === 'required'
                ? <Feedback type="error" title="Preencha os campos obrigatórios" message="Revise os campos destacados para continuar" dismissible onDismiss={() => setBanner(null)} />
                : <Feedback type="error" title="Não foi possível continuar" message="Corrija os campos destacados e tente novamente" dismissible onDismiss={() => setBanner(null)} />}
            </div>
          )}

          <DevNote note="Wizard de 6 passos (RF601-FLU002…FLU007): Informações · Programação · Executor · Checklist · Evidências e anomalia · Revisão. O DS não tem Stepper: passos futuros ficam desabilitados e cada passo valida antes de avançar. Ao salvar, o plano fica Ativo (FLU007).">
            {stepper}
          </DevNote>

          {body}

          <Stack direction="horizontal" justify="start" gap="sm" wrap>
            {step > 1 && <Button variant="secondary" iconLeft={<IconChevronLeft size={20} />} onClick={() => goStep(step - 1)} disabled={saving}>Voltar</Button>}
            {last
              ? (
                <DevNote note="Ao salvar: plano Ativo, próximas execuções calculadas e OS preventivas geradas (tipo Preventiva, status Aberta, uma por equipamento), vinculadas ao plano; o executor/responsável é notificado (RF801).">
                  <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar plano'}</Button>
                </DevNote>
              )
              : <Button type="submit" iconRight={<IconChevronRight size={20} />}>Continuar</Button>}
            <Button variant="ghost" onClick={cancel} disabled={saving}>Cancelar</Button>
          </Stack>
        </Stack>
      </form>
    </AppLayout>
  );
}

mountApp(<PlanoFormScreen />);
