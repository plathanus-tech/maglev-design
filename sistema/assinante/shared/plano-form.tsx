import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowDown, IconArrowLeft, IconArrowUp, IconChevronLeft, IconGripVertical, IconChevronRight, IconPlus, IconTrash } from '@tabler/icons-react';
import { Accordion, Badge, Button, Card, DatePicker, Dialog, Dropdown, Feedback, Input, RadioButton, Stack, Textarea } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { formatDate, requiredMessage } from '../../admin/shared/format';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { CHECKLIST_KIND_LABEL, ChecklistItem, ChecklistKind, EVIDENCE_OPTIONS, NO_UNIT, READING_UNITS, Executor, Frequency, Plan, nowLocal } from './data';
import { CheckGroup } from './ListKit';
import { FormStepper, FormStepState } from './form-stepper';
import { useLeaveGuard } from './leave-guard';
import { EquipmentPicker } from './PlanEquipmentPicker';
import { EVERY_UNIT, FREQUENCY_OPTIONS, TODAY, WEEKDAY_OPTIONS, describeFrequency, executorOf, occurrences, savePlan } from './preventivas';
import { nextSeq, unitName, useSubSession } from './store';
import { useRefs } from './ui';
import { Col, Grid, ReadField, SectionLabel, Text, goTo, param, setFlash } from './ui';

/**
 * RF601 - Criar/editar plano em 6 passos. Stepper de formulário próprio (form-stepper.tsx, mesma linguagem do Andamento da OS) + um Card por passo. Variantes: #state=required · step2 … step6 · ?id= (edição).
 */
const STEPS = ['Informações', 'Programação', 'Executor', 'Checklist', 'Evidências e anomalia', 'Revisão'];
/** Rótulos do indicador de progresso (o nome completo fica no conteúdo da etapa). */
const STEP_SHORT = ['Informações', 'Programação', 'Executor', 'Checklist', 'Evidências', 'Revisão'];

interface Draft {
  name: string; description: string; equipmentIds: string[];
  startDate: string; endDate: string; frequency: Frequency; every: string; refDay: string; winFrom: string; winTo: string; durationH: string;
  executorKind: '' | 'interno' | 'prestador'; userId: string; providerId: string; technician: string;
  checklist: ChecklistItem[]; evidences: string[]; onAnomaly: '' | Plan['onAnomaly'];
}

const uid = () => `new-${Math.random().toString(36).slice(2, 8)}`;
const CHK_END = '__end';
const blankItem = (): ChecklistItem => ({ id: uid(), text: '', kind: 'obrigatorio' });
const BLANK: Draft = {
  name: '', description: '', equipmentIds: [], startDate: '', endDate: '', frequency: 'mensal', every: '1', refDay: '', winFrom: '', winTo: '', durationH: '',
  executorKind: '', userId: '', providerId: '', technician: '', checklist: [blankItem()], evidences: [], onAnomaly: '',
};
const READING = 'Leitura/medição';
const UNIT_OPTIONS = READING_UNITS.map((u) => ({ value: u, label: u }));
const blankReading = (): ChecklistItem => ({ id: uid(), text: '', kind: 'leitura', unit: '' });
// As medições são itens do checklist do tipo leitura (fonte única); o checklist da etapa 4 lista só os demais tipos
const KIND_OPTIONS = (Object.keys(CHECKLIST_KIND_LABEL) as ChecklistKind[]).filter((k) => k !== 'leitura').map((value) => ({ value, label: CHECKLIST_KIND_LABEL[value] }));
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
  technician: p.executor.kind === 'prestador' ? p.executor.technician ?? '' : '', checklist: p.checklist.map((c) => ({ ...c })), evidences: p.checklist.some((c) => c.kind === 'leitura') && !p.evidences.includes(READING) ? [...p.evidences, READING] : [...p.evidences], onAnomaly: p.onAnomaly,
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
      checklist: [{ id: uid(), text: 'Limpar os braços de lavagem', kind: 'obrigatorio' }, { id: uid(), text: 'Medir a temperatura de enxágue', kind: 'leitura' }, { id: uid(), text: 'Verificar o dreno', kind: 'opcional' }],
      evidences: ['Foto antes/depois'], onAnomaly: 'abrir-solicitacao',
    };
  });
  const initialDraft = useRef<string>();
  if (initialDraft.current === undefined) initialDraft.current = JSON.stringify(d);
  const dirty = JSON.stringify(d) !== initialDraft.current;
  const guard = useLeaveGuard(dirty);
  const [confirmImpact, setConfirmImpact] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
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
  // reordenação por setas ou arraste pela alça (ids estáveis: só muda a posição do item, nunca os valores)
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [showAllEq, setShowAllEq] = useState(false);
  const [dragDy, setDragDy] = useState(0);
  const dragStartY = useRef(0);
  const [liveMsg, setLiveMsg] = useState('');
  const focusAfter = useRef<{ id: string; dir: 'up' | 'down' } | null>(null);
  const relocate = (id: string, to: number) => {
    const from = d.checklist.findIndex((c) => c.id === id);
    if (from < 0 || from === to || to < 0 || to >= d.checklist.length) return;
    const a = [...d.checklist]; const [it] = a.splice(from, 1); a.splice(to, 0, it);
    setD((x) => ({ ...x, checklist: a }));
    setLiveMsg(`Item movido para a posição ${to + 1} de ${a.length}`);
  };
  const plain = d.checklist.filter((c) => c.kind !== 'leitura');
  const readingItems = d.checklist.filter((c) => c.kind === 'leitura');
  const fullIndex = (id: string) => d.checklist.findIndex((c) => c.id === id);
  const moveItem = (i: number, dir: -1 | 1) => { const id = plain[i].id; const target = plain[i + dir]; if (!target) return; focusAfter.current = { id, dir: dir === -1 ? 'up' : 'down' }; relocate(id, fullIndex(target.id)); };
  useEffect(() => {
    const f = focusAfter.current; if (!f) return; focusAfter.current = null;
    const pick = (k: string) => document.querySelector<HTMLButtonElement>(`[data-chk="${f.id}-${k}"] button:not(:disabled)`);
    (pick(f.dir) ?? pick(f.dir === 'up' ? 'down' : 'up'))?.focus();
  }, [d.checklist]);

  // Evidências: ao marcar Leitura/medição já nasce a primeira medição; ao desmarcar com medições, confirma antes de descartá-las
  const [confirmReadingsOff, setConfirmReadingsOff] = useState(false);
  const changeEvidences = (v: string[]) => {
    const had = d.evidences.includes(READING); const has = v.includes(READING);
    if (had && !has && readingItems.length) { setConfirmReadingsOff(true); return; }
    setD((x) => ({ ...x, evidences: v, checklist: !had && has && !x.checklist.some((c) => c.kind === 'leitura') ? [...x.checklist, blankReading()] : x.checklist }));
  };
  const dropReadings = () => { setD((x) => ({ ...x, evidences: x.evidences.filter((e) => e !== READING), checklist: x.checklist.filter((c) => c.kind !== 'leitura') })); setConfirmReadingsOff(false); };

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
      d.checklist.filter((c) => c.kind !== 'leitura').forEach((c) => {
        e[`${c.id}.text`] = !c.text.trim() ? requiredMessage('Descrição') : undefined;
      });
      return e;
    }
    if (n === 5) {
      const e: Record<string, string | undefined> = { onAnomaly: !d.onAnomaly ? requiredMessage('Comportamento em caso de anomalia') : undefined };
      if (d.evidences.includes(READING)) {
        const list = d.checklist.filter((c) => c.kind === 'leitura');
        e.readings = !list.length ? 'Adicione ao menos uma medição' : undefined;
        list.forEach((c) => { e[`${c.id}.name`] = !c.text.trim() ? requiredMessage('Nome da medição') : undefined; e[`${c.id}.unit`] = !c.unit ? requiredMessage('Unidade de medida') : undefined; });
      }
      return e;
    }
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
    if (saving) return;
    if (editing) { if (!dirty) return; } else if (step < 6) return next();
    const bad = [1, 2, 3, 4, 5].find(hasErrors);
    if (bad) { goStep(bad); window.setTimeout(attempt, 0); return; }
    if (editing && impactful) { setConfirmImpact(true); return; }
    save();
  };

  // Mudanças que alteram as próximas execuções (equipamentos, datas, recorrência, horário): pedem confirmação antes de salvar
  const impactful = (() => {
    if (!editing) return false;
    const o = JSON.parse(initialDraft.current!) as Draft;
    const keys: (keyof Draft)[] = ['equipmentIds', 'startDate', 'endDate', 'frequency', 'every', 'refDay', 'winFrom', 'winTo', 'durationH'];
    return keys.some((k) => JSON.stringify(o[k]) !== JSON.stringify(d[k]));
  })();

  const save = () => {
    setConfirmImpact(false);
    setSaving(true);
    const id = editing?.id ?? nextSeq('PLA', db.plans.map((p) => p.id), 3);
    const executor: Executor = d.executorKind === 'interno' ? { kind: 'interno', userId: d.userId } : { kind: 'prestador', providerId: d.providerId, technician: d.technician || undefined };
    const plan: Plan = {
      id, name: d.name.trim(), description: d.description.trim() || undefined, equipmentIds: d.equipmentIds,
      startDate: d.startDate, endDate: d.endDate || undefined, frequency: d.frequency, every: everyN, refDay: schedule.refDay,
      window: d.winFrom && d.winTo ? { from: d.winFrom, to: d.winTo } : undefined, durationH: d.durationH ? Number(d.durationH.replace(',', '.')) : undefined,
      executor, evidences: d.evidences, onAnomaly: d.onAnomaly as Plan['onAnomaly'],
      checklist: d.checklist.map((c) => ({ id: c.id.startsWith('new-') ? `${id}-${c.id.slice(4)}` : c.id, text: c.text.trim(), kind: c.kind, unit: c.kind === 'leitura' ? c.unit : undefined })),
      status: editing?.status ?? 'ativo', createdAt: editing?.createdAt ?? nowLocal(),
    };
    const r = savePlan(plan, user, !!editing);
    setFlash(editing
      ? { type: 'success', title: 'Plano atualizado', message: 'As alterações valem para as próximas execuções.' }
      : { type: 'success', title: 'Plano criado', message: `O plano está ativo: ${r.newExecutions} execuções previstas e ${r.newOrders} OS preventiva${r.newOrders === 1 ? '' : 's'} geradas.` });
    initialDraft.current = JSON.stringify(d);
    guard.allow();
    window.setTimeout(() => goTo(`plano.html?id=${id}`), 400);
  };

  const allowed = can('planos', editing ? 'editar' : 'cadastrar');
  const crumbs = [{ label: 'Planos de manutenção', href: 'planos.html' }, { label: editing ? 'Editar' : 'Novo plano' }];

  if (editing === undefined && param('id')) {
    return <AppLayout active="planos" screen="planos" layout="focused"><Feedback type="error" title="Plano não encontrado" message="Volte para a lista de planos e tente novamente" /></AppLayout>;
  }
  if (!allowed) {
    return <AppLayout active="planos" screen="planos" layout="focused"><Feedback type="error" title="Sem permissão" message={`Seu perfil não pode ${editing ? 'editar' : 'criar'} planos de manutenção`} /></AppLayout>;
  }

  // ── passos ──
  // Etapa só é "concluída" quando alcançada, não é a atual e passa nas validações; futuras ficam indisponíveis
  const stepStates: FormStepState[] = STEPS.map((_, i) => {
    const n = i + 1;
    if (editing) return n === step ? 'current' : hasErrors(n) ? 'invalid' : 'available';
    return n === step ? 'current' : n > maxStep ? 'future' : hasErrors(n) ? 'reached' : 'done';
  });
  const stepper = <FormStepper ariaLabel="Passos do plano" steps={STEP_SHORT} states={stepStates} onSelect={goStep} />;

  // Resumo recolhido dos equipamentos do plano (etapas 2 a 6), agrupados por unidade, só leitura
  const byUnit = [...new Set(selectedEquipments.map((e) => e.unitId))].map((uid) => ({ uid, items: selectedEquipments.filter((e) => e.unitId === uid) }));
  const equipmentSummary = (
    <DevNote note="Resumo dos equipamentos escolhidos na etapa Informações, para manter o contexto nas etapas seguintes: recolhido por padrão, agrupado por unidade, sem checkboxes. “Alterar equipamentos” volta à etapa 1 sem perder o que já foi preenchido.">
      <Accordion
        headingLevel={2}
        items={[{
          title: 'Equipamentos do plano',
          subtitle: `${selectedEquipments.length} ${selectedEquipments.length === 1 ? 'equipamento' : 'equipamentos'}${byUnit.length > 1 ? ` em ${byUnit.length} unidades` : ''}`,
          content: (
            <Stack gap="md">
              {byUnit.map((g) => (
                <Stack key={g.uid} gap="xs">
                  <span className="plan-sum-unit">{unitName(db, g.uid)}</span>
                  <ul className="plan-sum-list">{g.items.map((e) => <li key={e.id}>{e.name}</li>)}</ul>
                </Stack>
              ))}
              <Stack direction="horizontal"><button type="button" className="text-link plan-sum-change" onClick={() => goStep(1)}>Alterar equipamentos</button></Stack>
            </Stack>
          ),
        }]}
      />
    </DevNote>
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
  // Texto da recorrência em linguagem natural: só aparece com um número inteiro maior que zero
  const everyNumber = Number(d.every);
  const SINGULAR_ADV: Record<Frequency, string> = { diaria: 'diariamente', semanal: 'semanalmente', mensal: 'mensalmente', anual: 'anualmente' };
  const everyHelp = d.every.trim() && Number.isInteger(everyNumber) && everyNumber >= 1
    ? `A manutenção será programada ${everyNumber === 1 ? SINGULAR_ADV[d.frequency] : `a cada ${everyNumber} ${EVERY_UNIT[d.frequency]}`}`
    : undefined;
  const step2 = (
    <Stack gap="xl">
      <Card className="card-open" title="Programação" subtitle="As manutenções seguem as datas programadas, independentemente da conclusão das anteriores">
        <div className="card-body-tight">
          <Grid>
            <Col span={6}><DatePicker label="Data de início" required value={d.startDate} onChange={(v) => set('startDate', v)} error={shown('startDate')} /></Col>
            <Col span={6}><DatePicker optional label="Data de término" value={d.endDate} min={d.startDate || undefined} onChange={(v) => set('endDate', v)} error={shown('endDate')} /></Col>
            <Col span={6}>
              <DevNote note="RF601: periodicidade = frequência (diária, semanal, mensal, anual) + “a cada N” + dia de referência (ex.: dia 15). Recorrência fixa (RGN005): a próxima execução é gerada na data prevista mesmo que a anterior não tenha sido concluída (CTA003).">
                <Dropdown
                  label="Frequência" required options={FREQUENCY_OPTIONS} value={d.frequency}
                  onChange={(v) => setD((x) => ({ ...x, frequency: v as Frequency, refDay: v === 'semanal' ? '1' : v === x.frequency ? x.refDay : '' }))}
                />
              </DevNote>
            </Col>
            <Col span={6}><Input label={everyLabel} required type="number" min={1} inputMode="numeric" value={d.every} onChange={(e) => set('every', e.target.value)} error={shown('every')} helperText={everyHelp} /></Col>
            {d.frequency === 'semanal' && <Col span={6}><Dropdown label="Dia da semana" required options={WEEKDAY_OPTIONS} value={d.refDay} onChange={(v) => set('refDay', v)} error={shown('refDay')} /></Col>}
            {(d.frequency === 'mensal' || d.frequency === 'anual') && (
              <Col span={6}>
                <Input
                  label="Dia do mês de referência" required type="number" min={1} max={31} inputMode="numeric" value={d.refDay} onChange={(e) => set('refDay', e.target.value)} error={shown('refDay')}
                  helperText={d.frequency === 'anual' ? 'O mês é o da data de início' : 'Em meses mais curtos, usa o último dia do mês'}
                />
              </Col>
            )}
            <Col span={12}>
              <DevNote note="Os horários previstos viram o período de atendimento (agendamento) das OS preventivas geradas: data prevista da execução + este intervalo. Não mudam a regra de geração das OS.">
                <div role="group" aria-label="Período previsto para atendimento" aria-describedby="plan-window-help">
                  <Stack gap="xs">
                    <Grid>
                      <Col span={6}><Input optional label="Horário inicial previsto" type="time" value={d.winFrom} onChange={(e) => set('winFrom', e.target.value)} error={shown('winFrom')} /></Col>
                      <Col span={6}><Input optional label="Horário final previsto" type="time" value={d.winTo} onChange={(e) => set('winTo', e.target.value)} error={shown('winTo')} /></Col>
                    </Grid>
                    <span id="plan-window-help" className="cell-secondary">Período previsto para a realização da manutenção.</span>
                  </Stack>
                </div>
              </DevNote>
            </Col>
            <Col span={6}><Input optional label="Duração estimada (horas)" inputMode="decimal" value={d.durationH} onChange={(e) => set('durationH', e.target.value.replace(/[^\d.,]/g, ''))} error={shown('durationH')} /></Col>
          </Grid>
        </div>
      </Card>
      <DevNote note="Prévia calculada na hora a partir das regras acima, a partir de hoje (uma execução por equipamento - 💡 RF601-RGN003). Informativa: não indica execuções já realizadas. As OS são abertas automaticamente (RGN002); 💡 antecedência de geração a confirmar.">
        <Card
          className="card-open plan-next" title="Próximas execuções" subtitle="Prévia das próximas 6 datas programadas"
          actions={d.startDate && preview.length > 0 ? <span className="cell-secondary">{d.equipmentIds.length ? `${d.equipmentIds.length} ${d.equipmentIds.length === 1 ? 'equipamento' : 'equipamentos'} por execução` : 'Nenhum equipamento selecionado'}</span> : undefined}
        >
          <div className="card-body-tight">
            {preview.length === 0
              ? <Text>{d.startDate ? 'Nenhuma execução prevista com a programação informada' : 'Informe a data de início e a recorrência para ver as próximas datas'}</Text>
              : (
                <ul className="plan-cal" aria-label="Próximas datas programadas">
                  {/* o ano entra na linha do mês apenas se as datas forem de anos diferentes */}
                  {preview.map((date) => {
                    const dt = new Date(`${date}T00:00:00`);
                    const wd = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
                    const mo = dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                    const multiYear = new Set(preview.map((x) => x.slice(0, 4))).size > 1;
                    return (
                      <li key={date} className="plan-cal-item" aria-label={dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>
                        <span className="plan-cal-wd" aria-hidden="true">{wd}</span>
                        <span className="plan-cal-day" aria-hidden="true">{String(dt.getDate()).padStart(2, '0')}</span>
                        <span className="plan-cal-mo" aria-hidden="true">{multiYear ? `${mo} ${dt.getFullYear()}` : mo}</span>
                      </li>
                    );
                  })}
                </ul>
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
            <span className="sr-only" role="status" aria-live="polite">{liveMsg}</span>
            {plain.map((c, i) => (
              <div key={c.id} data-chk-id={c.id} style={dragId === c.id ? { transform: `translateY(${dragDy}px)` } : undefined} className={`chk-item${dragId === c.id ? ' is-dragging' : ''}${overId === c.id && dragId && dragId !== c.id ? ' is-over' : ''}`}>
              <Card className="card-open contact-card">
                <Stack gap="md">
                  <Stack direction="horizontal" justify="between" align="center" wrap>
                    <Stack direction="horizontal" gap="xs" align="center">
                      <span
                        className="chk-grip" aria-hidden="true" title="Arrastar para reordenar"
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dragStartY.current = e.clientY; setDragDy(0); setDragId(c.id); }}
                        onPointerMove={(e) => {
                          if (dragId !== c.id) return;
                          setDragDy(e.clientY - dragStartY.current);
                          const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-chk-id]');
                          setOverId(el?.dataset.chkId ?? null);
                        }}
                        onPointerUp={() => { if (dragId && overId) relocate(dragId, overId === CHK_END ? fullIndex(plain[plain.length - 1].id) : fullIndex(overId)); setDragId(null); setOverId(null); setDragDy(0); }}
                        onPointerCancel={() => { setDragId(null); setOverId(null); setDragDy(0); }}
                      ><IconGripVertical size={18} /></span>
                      <h3 className="page-label">{`Item ${i + 1}`}</h3>
                    </Stack>
                    <Stack direction="horizontal" gap="2xs">
                      <span data-chk={`${c.id}-up`}><Button variant="ghost" size="sm" iconOnly iconLeft={<IconArrowUp size={16} />} aria-label={`Mover item ${i + 1} para cima`} disabled={i === 0} onClick={() => moveItem(i, -1)} /></span>
                      <span data-chk={`${c.id}-down`}><Button variant="ghost" size="sm" iconOnly iconLeft={<IconArrowDown size={16} />} aria-label={`Mover item ${i + 1} para baixo`} disabled={i === plain.length - 1} onClick={() => moveItem(i, 1)} /></span>
                      <Button variant="ghost" size="sm" iconLeft={<IconTrash size={16} />} aria-label={`Remover item ${i + 1}`} onClick={() => set('checklist', d.checklist.filter((x) => x.id !== c.id))}>Remover</Button>
                    </Stack>
                  </Stack>
                  <div className="chk-fields">
                    <Input label="Descrição" required autoComplete="off" value={c.text} onChange={(e) => setItem(c.id, { text: e.target.value })} error={shown(`${c.id}.text`)} />
                    <Dropdown label="Tipo" required options={KIND_OPTIONS} value={c.kind} onChange={(v) => setItem(c.id, { kind: v as ChecklistKind })} />
                  </div>
                </Stack>
              </Card>
              </div>
            ))}
            {dragId && <div data-chk-id={CHK_END} className={`chk-end${overId === CHK_END ? ' is-over' : ''}`} aria-hidden="true" />}
            <Stack direction="horizontal">
              <Button variant="ghost" size="sm" iconLeft={<IconPlus size={16} />} onClick={() => set('checklist', [...d.checklist, blankItem()])}>Adicionar item</Button>
            </Stack>
          </Stack>
        </div>
      </Card>
    </DevNote>
  );

  const step5 = (
    <Card className="card-open" title="Evidências e anomalias" subtitle="Defina os registros exigidos durante a execução e o tratamento de anomalias">
      <div className="card-body-tight">
        <Stack gap="xl">
          <DevNote note="RF601 / RF603-RGN002: a seleção é opcional na configuração; selecionada, a evidência passa a ser obrigatória para concluir a execução. Foto antes/depois = ao menos 1 foto antes e 1 depois (guardadas com o momento); Foto da placa = ao menos 1 imagem, separada das demais; Relatório técnico = texto preenchido no sistema; Leitura/medição = medições configuradas abaixo (são os itens de leitura do checklist, fonte única, com id estável).">
            <CheckGroup
              label="Evidências exigidas" helperText="Selecione os registros obrigatórios para concluir cada execução" columns
              options={EVIDENCE_OPTIONS.map((o) => ({ value: o, label: o }))} value={d.evidences} onChange={changeEvidences}
            />
          </DevNote>
          {d.evidences.includes(READING) && (
            <Stack gap="md">
              <Stack gap="2xs">
                <h3 className="page-label">Leituras e medições</h3>
                <Text>Defina os valores que deverão ser registrados durante a execução</Text>
              </Stack>
              {shown('readings') && <Feedback type="error" message={shown('readings')!} />}
              {readingItems.map((c, i) => (
                <Card key={c.id} className="card-open contact-card">
                  <Stack gap="md">
                    <Stack direction="horizontal" justify="between" align="center" wrap>
                      <h4 className="page-label">{`Medição ${i + 1}`}</h4>
                      <Button variant="ghost" size="sm" iconLeft={<IconTrash size={16} />} aria-label={`Remover medição ${i + 1}`} onClick={() => set('checklist', d.checklist.filter((x) => x.id !== c.id))}>Remover</Button>
                    </Stack>
                    <div className="chk-fields">
                      <Input label="Nome da medição" required autoComplete="off" placeholder="Ex.: Temperatura interna" value={c.text} onChange={(e) => setItem(c.id, { text: e.target.value })} error={shown(`${c.id}.name`)} />
                      <Dropdown label="Unidade de medida" required options={UNIT_OPTIONS} value={c.unit ?? ''} placeholder="Selecione" onChange={(v) => setItem(c.id, { unit: v })} error={shown(`${c.id}.unit`)} />
                    </div>
                  </Stack>
                </Card>
              ))}
              <Stack direction="horizontal">
                <Button variant="ghost" size="sm" iconLeft={<IconPlus size={16} />} onClick={() => set('checklist', [...d.checklist, blankReading()])}>Adicionar medição</Button>
              </Stack>
            </Stack>
          )}
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
        message="As execuções seguem as datas programadas, mesmo que a anterior não tenha sido concluída. Execuções pendentes são registradas como não realizadas."
      />
      <Card className="card-open" title="Informações" actions={editBtn(1)}>
        <div className="card-body-tight">
          <Grid>
            <Col span={6}><ReadField label="Nome do plano" value={d.name} /></Col>
            <Col span={6}><ReadField label="Descrição" value={d.description} /></Col>
            <Col span={12}>
              <Stack gap="xs">
                <span className="page-label">Equipamentos</span>
                <span className="page-text">{`${selectedEquipments.length} ${selectedEquipments.length === 1 ? 'equipamento' : 'equipamentos'} em ${unitsOfSelection.length} ${unitsOfSelection.length === 1 ? 'unidade' : 'unidades'}`}</span>
                <Stack gap="sm" className="rev-units">
                  {(showAllEq || selectedEquipments.length <= 6 ? byUnit : byUnit.slice(0, 2)).map((g) => (
                    <Stack key={g.uid} gap="2xs">
                      <span className="plan-sum-unit">{unitName(db, g.uid)}</span>
                      <ul className="plan-sum-list">{g.items.map((e) => <li key={e.id}>{e.name}</li>)}</ul>
                    </Stack>
                  ))}
                </Stack>
                {selectedEquipments.length > 6 && byUnit.length > 2 && (
                  <Stack direction="horizontal"><button type="button" className="text-link plan-sum-change" aria-expanded={showAllEq} onClick={() => setShowAllEq((v) => !v)}>{showAllEq ? 'Mostrar menos' : `Ver todas as ${byUnit.length} unidades`}</button></Stack>
                )}
              </Stack>
            </Col>
          </Grid>
        </div>
      </Card>
      <Card className="card-open" title="Programação" actions={editBtn(2)}>
        <div className="card-body-tight">
          <Grid>
            <Col span={6}><ReadField label="Início" value={d.startDate ? formatDate(d.startDate) : undefined} /></Col>
            <Col span={6}><ReadField label="Término" value={d.endDate ? formatDate(d.endDate) : 'Sem data de término'} /></Col>
            <Col span={6}><ReadField label="Periodicidade" value={describeFrequency({ ...schedule })} /></Col>
            <Col span={6}><ReadField label="Horário previsto" value={d.winFrom && d.winTo ? `${d.winFrom} às ${d.winTo}` : undefined} /></Col>
            <Col span={6}><ReadField label="Duração estimada" value={d.durationH ? `${d.durationH} ${Number(String(d.durationH).replace(',', '.')) === 1 ? 'hora' : 'horas'}` : undefined} /></Col>
            <Col span={12}>
              <Stack gap="xs">
                <span className="page-label">Próximas execuções</span>
                {preview.length
                  ? <ul className="rev-dates" aria-label="Próximas execuções">{preview.slice(0, 3).map((x) => <li key={x}><Badge status="neutral">{formatDate(x)}</Badge></li>)}</ul>
                  : <span className="page-text">-</span>}
              </Stack>
            </Col>
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
                <span className="page-text"><strong>{c.text || '-'}</strong></span>
                <Badge status={c.kind === 'opcional' ? 'neutral' : c.kind === 'leitura' ? 'info' : 'brand'}>{CHECKLIST_KIND_LABEL[c.kind]}</Badge>
              </Stack>
            ))}
          </Stack>
        </div>
      </Card>
      <Card className="card-open" title="Evidências e anomalias" actions={editBtn(5)}>
        <div className="card-body-tight">
          <Grid>
            <Col span={6}><ReadField label="Evidências exigidas" value={d.evidences.length ? d.evidences.join(', ') : 'Nenhuma'} /></Col>
            <Col span={6}><ReadField label="Em caso de anomalia" value={ANOMALY_OPTIONS.find((o) => o.value === d.onAnomaly)?.label} /></Col>
            {d.evidences.includes(READING) && readingItems.length > 0 && (
              <Col span={12}>
                <Accordion
                  headingLevel={3}
                  items={[{
                    title: 'Leituras e medições', subtitle: `${readingItems.length} ${readingItems.length === 1 ? 'medição' : 'medições'}`,
                    content: (
                      <ul className="plan-sum-list">
                        {readingItems.map((c) => <li key={c.id}>{`${c.text || '-'}${c.unit && c.unit !== NO_UNIT ? ` (${c.unit})` : ''}`}</li>)}
                      </ul>
                    ),
                  }]}
                />
              </Col>
            )}
          </Grid>
        </div>
      </Card>
    </Stack>
  );

  const body = [step1, step2, step3, step4, step5, step6][step - 1];
  const last = step === 6;

  return (
    <AppLayout active="planos" screen="planos" layout="focused">
      <form className="form-page" onSubmit={onSubmit} onChangeCapture={() => setBanner(null)} noValidate>
        <Stack gap="xl">
          <Stack gap="sm">
            <DevNote note="Layout focado (sem sidebar): o retorno à listagem é explícito no topo, no lugar do breadcrumb. Não é o “Voltar” das etapas. Com dados não salvos, pede confirmação antes de sair.">
              <a className="back-link" href="planos.html"><IconArrowLeft size={16} aria-hidden="true" />Voltar para planos de manutenção</a>
            </DevNote>
            <PageHeader
              title={editing ? 'Editar plano' : 'Novo plano'}
              subtitle={editing ? 'As alterações serão aplicadas apenas às próximas execuções' : 'Configure as manutenções preventivas dos seus equipamentos'}
            />
          </Stack>
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

          {step > 1 && step < 6 && equipmentSummary}

          {body}

          {last && (
            <DevNote note="Regra implementada (RF601-CTA001, RGN002/RGN003 a confirmar): ao criar, o plano fica Ativo, as próximas execuções são calculadas e uma OS preventiva é aberta de imediato para cada equipamento (apenas a próxima execução de cada um); as demais ficam previstas, sem OS. A antecedência de geração das OS segue a confirmar na especificação. Aprovação do plano pelo gestor é FE006 (fora do escopo).">
              <Text>{editing
                ? 'Ao salvar, as próximas execuções são recalculadas e as OS abertas que ainda não foram iniciadas são substituídas. Execuções passadas e OS em andamento não mudam'
                : 'Ao criar o plano, ele será ativado e uma ordem de serviço preventiva será gerada para cada equipamento selecionado.'}
              </Text>
            </DevNote>
          )}

          {editing
            ? (
              <Stack direction="horizontal" justify="between" gap="sm" className="wizard-nav">
                <Button variant="secondary" disabled={saving || !dirty} onClick={() => setConfirmDiscard(true)}>Descartar alterações</Button>
                <DevNote note="Edição: a navegação é livre pelo stepper, sem Voltar/Continuar. Um único estado guarda as alterações de todas as etapas; Salvar alterações grava o plano inteiro, só fica habilitado com mudanças pendentes e valida todas as etapas (a que tiver erro fica marcada no stepper). Mudanças em equipamentos, datas ou recorrência pedem confirmação antes de salvar. Descartar alterações (com confirmação) volta todos os campos ao último valor salvo, na mesma etapa, sem chamar a atualização.">
                  <Button type="submit" disabled={saving || !dirty}>{saving ? 'Salvando...' : 'Salvar alterações'}</Button>
                </DevNote>
              </Stack>
            )
            : (
            <Stack direction="horizontal" justify={step > 1 ? 'between' : 'end'} gap="sm" className="wizard-nav">
              {step > 1 && <Button variant="secondary" iconLeft={<IconChevronLeft size={20} />} onClick={() => goStep(step - 1)} disabled={saving}>Voltar</Button>}
              {last
                ? (
                  <DevNote note="Ao salvar: plano Ativo, próximas execuções calculadas e OS preventivas geradas (tipo Preventiva, status Aberta, uma por equipamento), vinculadas ao plano; o executor/responsável é notificado (RF601). Padrão B (wizard): Voltar à esquerda e Continuar/Criar plano à direita; sem Cancelar, a saída é pelo breadcrumb, com confirmação se houver dados não salvos.">
                    <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar plano'}</Button>
                  </DevNote>
                )
                : <Button type="submit" iconRight={<IconChevronRight size={20} />}>Continuar</Button>}
            </Stack>
              )}
        </Stack>
      </form>
      {guard.dialog}
      {confirmReadingsOff && (
        <Dialog
          open onClose={() => setConfirmReadingsOff(false)} size="sm" title="Remover leituras e medições?" subtitle="As medições configuradas neste plano serão descartadas"
          actions={(
            <>
              <Button size="sm" variant="secondary" onClick={() => setConfirmReadingsOff(false)}>Manter medições</Button>
              <Button size="sm" variant="destructive" onClick={dropReadings}>Remover medições</Button>
            </>
          )}
        />
      )}
      {confirmDiscard && (
        <Dialog
          open onClose={() => setConfirmDiscard(false)} size="sm" title="Descartar alterações?" subtitle="Todas as alterações não salvas serão perdidas"
          actions={(
            <>
              <Button size="sm" variant="secondary" onClick={() => setConfirmDiscard(false)}>Continuar editando</Button>
              <Button size="sm" onClick={() => { setD(JSON.parse(initialDraft.current!) as Draft); setTried(false); setBanner(null); setConfirmDiscard(false); }}>Descartar alterações</Button>
            </>
          )}
        />
      )}
      {confirmImpact && (
        <Dialog
          open onClose={() => setConfirmImpact(false)} size="sm" title="Salvar alterações?" subtitle="As próximas execuções serão recalculadas"
          actions={(
            <>
              <Button size="sm" variant="secondary" onClick={() => setConfirmImpact(false)}>Continuar editando</Button>
              <Button size="sm" onClick={save}>Salvar alterações</Button>
            </>
          )}
        >
          <Text>As OS abertas que ainda não foram iniciadas serão substituídas pelas novas datas. Execuções passadas e OS em andamento não mudam.</Text>
        </Dialog>
      )}
    </AppLayout>
  );
}

mountApp(<PlanoFormScreen />);
