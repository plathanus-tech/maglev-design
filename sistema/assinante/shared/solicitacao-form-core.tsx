import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { IconBulb, IconCircleCheck } from '@tabler/icons-react';
import { IconPlus } from '@tabler/icons-react';
import { Button, Card, Checkbox, Dialog, Dropdown, EmptyState, Feedback, ImageUpload, Input, RadioButton, Stack, Table, TableColumn, Textarea, useToast } from '@maglev/ds';
import { MobileCardList } from '../../admin/shared/MobileCardList';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { PhotoSlot } from './photo-slot';
import { useHashState } from '../../admin/shared/useHashState';
import { formatDateTime, formatPhone, isValidPhone, noBreak, onlyDigits, requiredMessage, PHONE_INVALID_EXAMPLE, PHONE_INVALID_MESSAGE } from '../../admin/shared/format';
import { IMPACT_LABEL, Impact, Request, TipResult, TroubleshootingRun, nowLocal } from './data';
import { logEntry, nextSeq, notify, updateSubDb, useSubDb, useSubSession } from './store';
import { CellPair, Col, FormSection, Grid, ReadField, param, takeFlash, useRefs } from './ui';
import { SafetyGuidance } from './equipamento-lib';
import { IS_THUMB, STS, isOpenBase } from './solicitacoes-shared';
import { OpenRequestCard } from '../../colaborador/shared/open-request-card';

import { LegalText } from './legal-placeholder';
import '../../admin/shared/primeiro-acesso.css';
import './solicitacao-form.css';

/** Estados: idle · required · duplicate (aviso de duplicidade) · troubleshooting (aviso + Começar) · tip1 · lasttip · tipsdone (volta ao formulário) · resolved · review (revisão antes de enviar) · phoneinvalid (telefone de contato inválido) */
const STATES = ['idle', 'required', 'duplicate', 'troubleshooting', 'tip1', 'lasttip', 'tipsdone', 'resolved', 'review', 'phoneinvalid'] as const;
type Mode = (typeof STATES)[number];
type Stage = 'form' | 'tips' | 'resolved' | 'review';
const MAX_PHOTOS = 5;
const DESC_MAX = 1000;

type ExistingRow = Record<string, unknown> & { id: string; r: Request };
const shortText = (t: string) => (t.length > 48 ? `${t.slice(0, 48)}…` : t);

const DRAFT_KEY = 'maglev.v2.sub.solicitacaoDraft';
const IS_THUMB_URL = new URLSearchParams(location.search).has('thumb');
interface Draft { unitId: string; problemId: string; impact: string; description: string; related: string; prevNote: string }
/** Lê (e apaga) o que o usuário já tinha preenchido antes de ir cadastrar um equipamento. */
let draftCache: Draft | null | undefined;   // o React (modo dev) chama o inicializador do estado duas vezes: lê uma única vez por carregamento
function takeDraft(): Draft | null {
  if (draftCache !== undefined) return draftCache;
  try { const raw = sessionStorage.getItem(DRAFT_KEY); sessionStorage.removeItem(DRAFT_KEY); draftCache = raw ? (JSON.parse(raw) as Draft) : null; } catch { draftCache = null; }
  return draftCache;
}

export interface SolicitacaoFormCoreProps {
  /** Colaborador via QR Code (sem login): equipamento fixo, aceite de termos, sem triagem/permissões. */
  external?: boolean;
  /** Casca da tela: AppLayout (logado) ou ExternalLayout (QR Code). */
  shell: (content: ReactNode) => ReactNode;
  header: ReactNode;
  /** Quem abre: usuário logado, ou o que o navegador do colaborador lembrou (nome/telefone). */
  actor: { id?: string; name: string; phone: string };
  unitIds: string[];
  fixedEquipmentId?: string;
  channel: Request['channel'];
  onSent: (id: string) => void;
  onCancel: () => void;
  /** Ações da tela "Problema resolvido" (voltar à lista/ao equipamento). */
  resolvedActions: (equipmentId?: string) => ReactNode;
  /** Link de acompanhamento de uma solicitação existente. */
  /** Cabeçalho das etapas de solução de problemas e da confirmação de "problema resolvido" (solicitante); sem ele, usa o cabeçalho do formulário */
  troubleshootingHeader?: ReactNode;
  trackHref: (id: string) => string;
  /** Lembra nome/telefone no dispositivo (Colaborador RF002-RGN011), chamado ao enviar. */
  onRemember?: (name: string, phone: string) => void;
}

/**
 * Formulário "Abrir solicitação" compartilhado: Área do assinante (RF404) e Colaborador via QR Code (RF002).
 * Mesma ordem de tela (RGN013): equipamento → problema → solução de problemas (opcional) → demais campos → enviar.
 */
export function SolicitacaoFormCore({ external = false, shell, header, actor, unitIds, fixedEquipmentId, channel, onSent, onCancel, resolvedActions, troubleshootingHeader, trackHref, onRemember }: SolicitacaoFormCoreProps) {
  // Portal: seções recolhíveis no mobile (consistência com os demais formulários); o QR Code (externo) mantém os cards
  const Section = external ? Card : FormSection;
  const refs = useRefs();
  const db = useSubDb();
  const user = actor;
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const toast = useToast();
  const { can } = useSubSession();
  // Volta do cadastro de equipamento (?restore=1): devolve o que já tinha sido preenchido antes de sair
  const [draft] = useState(() => (param('restore') ? takeDraft() : null));
  useEffect(() => { if (IS_THUMB_URL) return; const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeUnits = db.units.filter((u) => u.status === 'ativo' && unitIds.includes(u.id));
  const usable = (eid?: string | null) => db.equipments.find((e) => e.id === eid && e.statusId !== 'STE-05' && activeUnits.some((u) => u.id === e.unitId));
  const fromUrl = usable(fixedEquipmentId ?? param('equipment'));

  const [unitId, setUnitId] = useState(fromUrl?.unitId ?? draft?.unitId ?? '');
  const [equipmentId, setEquipmentId] = useState(fromUrl?.id ?? '');
  const [problemId, setProblemId] = useState(draft?.problemId ?? '');
  const [impact, setImpact] = useState<Impact | ''>((draft?.impact as Impact | '') ?? '');
  const [description, setDescription] = useState(draft?.description ?? '');
  const [photos, setPhotos] = useState<Array<{ name: string; url: string }>>([]);
  const [related, setRelated] = useState(draft?.related ?? '');
  const [prevNote, setPrevNote] = useState(draft?.prevNote ?? '');
  const [contactName, setContactName] = useState(user.name);
  const [contactPhone, setContactPhone] = useState(formatPhone(user.phone));
  const [terms, setTerms] = useState(false);
  const [tried, setTried] = useState(false);
  const [tick, setTick] = useState(0);
  const [saving, setSaving] = useState(false);
  // Telefone marcado como inválido (variante do protótipo; a regra real de DDD/sequência é de desenvolvimento): o erro some ao editar o número
  const [badPhone, setBadPhone] = useState('');
  const [banner, setBanner] = useState(false);
  const [dupDismissed, setDupDismissed] = useState(false);
  // Troubleshooting (RF403)
  const [stage, setStage] = useState<Stage>('form');
  const [tipIdx, setTipIdx] = useState(0);
  const [done, setDone] = useState<boolean[]>([]);
  const [run, setRun] = useState<TroubleshootingRun>({ overall: 'nao-iniciado', tips: [] });
  const [finished, setFinished] = useState(false);
  const [resolvedId, setResolvedId] = useState('');
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);

  const equipment = db.equipments.find((e) => e.id === equipmentId);
  const tips = equipment?.troubleshooting.find((t) => t.problemId === problemId)?.tips ?? [];
  const problemName = refs.requestType(problemId)?.name ?? '';
  const openOnes = useMemo(() => db.requests.filter((r) => r.equipmentId === equipmentId && isOpenBase(refs.base(r.statusId))).sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.requests, equipmentId, refs.admin]);

  // Variantes de demonstração: equipamento com dicas e sem solicitação aberta (ou, para duplicidade, com solicitação aberta)
  useEffect(() => {
    if (mode === 'idle') return;
    const eqs = db.equipments.filter((e) => usable(e.id));
    const hasOpen = (id: string) => db.requests.some((r) => r.equipmentId === id && isOpenBase(refs.base(r.statusId)));
    if (mode === 'required') { setTried(true); setTick((n) => n + 1); return; }
    if (mode === 'duplicate') {
      const e = eqs.find((x) => hasOpen(x.id));
      if (e) { setUnitId(e.unitId); setEquipmentId(e.id); setProblemId('TSO-002'); }
      return;
    }
    const withTips = eqs.filter((e) => e.troubleshooting.length).sort((a, b) => Number(hasOpen(a.id)) - Number(hasOpen(b.id)) || Math.max(...b.troubleshooting.map((t) => t.tips.length)) - Math.max(...a.troubleshooting.map((t) => t.tips.length)));
    const fixed = fixedEquipmentId ? eqs.find((x) => x.id === fixedEquipmentId) : undefined;
    const e = fixed?.troubleshooting.length ? fixed : withTips[0];
    if (!e) return;
    const entry = [...e.troubleshooting].sort((a, b) => b.tips.length - a.tips.length)[0];
    setUnitId(e.unitId); setEquipmentId(e.id); setProblemId(entry.problemId);
    if (mode === 'tip1') { setDone(entry.tips.map(() => false)); setStage('tips'); setTipIdx(0); }
    if (mode === 'lasttip') { setDone(entry.tips.map((_, k) => k % 2 === 0)); setStage('tips'); setTipIdx(entry.tips.length - 1); }
    if (mode === 'tipsdone') { setFinished(true); setRun({ overall: 'sem-sucesso', tips: entry.tips.map((t, k) => ({ text: t.text, result: k % 2 === 0 ? 'realizada' : 'pulada' })) }); }
    if (mode === 'resolved') setStage('resolved');
    if (mode === 'phoneinvalid') {
      setImpact('medio'); setDescription('A porta não veda direito e forma gelo na borda.'); setRelated('nao'); setTerms(true);
      setContactPhone(PHONE_INVALID_EXAMPLE); setBadPhone(PHONE_INVALID_EXAMPLE); setTried(true); setTick((n) => n + 1);
    }
    if (mode === 'review') {
      setImpact('medio'); setDescription('A porta não veda direito e forma gelo na borda. Percebi ontem à noite, durante o fechamento.'); setRelated('nao'); setTerms(true);
      setStage('review');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── Opções ──
  const equipmentOptions = db.equipments
    .filter((e) => usable(e.id) && (!unitId || e.unitId === unitId))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map((e) => ({ value: e.id, label: e.name, description: `${e.code}${unitId ? '' : ` · ${db.units.find((u) => u.id === e.unitId)?.name}`}`, keywords: e.code }));
  const isMobile = useIsMobile() || external;
  const existingCols: TableColumn<ExistingRow>[] = [
    { key: 'id', label: 'Protocolo', render: (_, row) => <a className="text-link" href={trackHref(row.r.id)}>{noBreak(row.r.id)}</a> },
    { key: 'type', label: 'Tipo de solicitação / Descrição', render: (_, row) => <CellPair primary={refs.requestType(row.r.problemId)?.name ?? '-'} secondary={shortText(row.r.description)} /> },
    { key: 'r', label: 'Aberta em', render: (_, row) => noBreak(formatDateTime(row.r.openedAt)) },
    { key: 'status', label: 'Status', render: (_, row) => refs.statusBadge(row.r.statusId) },
  ];
  // Tipos sugeridos pela categoria do equipamento: sem categoria = vale para todas (Outro e as emergências ficam sempre à mão)
  const typeFits = (t: { categoryIds?: string[] }, categoryId?: string) => !categoryId || !t.categoryIds?.length || t.categoryIds.includes(categoryId);
  const activeTypes = refs.admin.requestTypes.filter((t) => t.status === 'ativo');
  const typeOptions = activeTypes.filter((t) => typeFits(t, equipment?.categoryId)).map((t) => ({ value: t.id, label: t.name }));
  const typesFiltered = typeOptions.length < activeTypes.length;

  const problems = {
    unit: !external && !unitId ? requiredMessage('Unidade') : undefined,
    equipment: !external && !equipmentId ? requiredMessage('Equipamento') : undefined,
    problem: !problemId ? requiredMessage('Tipo de solicitação') : undefined,
    impact: !impact ? requiredMessage('Impacto') : undefined,
    description: !description.trim() ? requiredMessage('Descrição') : undefined,
    related: !related ? requiredMessage('Relacionado a reparo anterior') : undefined,
    name: !contactName.trim() ? requiredMessage('Nome para contato') : undefined,
    phone: !onlyDigits(contactPhone) ? requiredMessage('Telefone para contato') : !isValidPhone(contactPhone) ? 'Informe um telefone válido' : badPhone && contactPhone === badPhone ? PHONE_INVALID_MESSAGE : undefined,
    terms: external && !terms ? 'Aceite os Termos de Uso e a Política de Privacidade para enviar' : undefined,
  };
  const show = (k: keyof typeof problems) => (tried ? problems[k] : undefined);
  const invalid = Object.values(problems).some(Boolean);

  useEffect(() => {
    if (!tick) return;
    if (Object.values(problems).filter(Boolean).length > 1) setBanner(true);
    const first = document.querySelector<HTMLElement>('form [aria-invalid="true"]');
    first?.scrollIntoView({ block: 'center' });
    first?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  /**
   * Equipamento não está na lista: abre o cadastro (equipamento-form) e, ao salvar, volta para esta tela com o equipamento já escolhido (?equipment=).
   * O que já foi preenchido fica guardado na sessão e volta junto (as fotos anexadas não; o upload é simulado).
   */
  const registerEquipment = () => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ unitId, problemId, impact, description, related, prevNote })); } catch { /* sem storage */ }
    window.location.href = `equipamento-form.html?return=solicitacao-form.html${unitId ? `&unit=${unitId}` : ''}`;
  };
  const allowRegister = !external && can('equipamentos', 'cadastrar');
  /** Dentro da lista, quando a busca não acha nada */
  const registerAction = allowRegister
    ? <Button variant="ghost" size="sm" iconLeft={<IconPlus size={16} />} onClick={registerEquipment}>Cadastrar equipamento</Button>
    : undefined;
  /** Discreto, abaixo do campo, enquanto nenhum equipamento está escolhido */
  const registerLink = allowRegister
    ? <Button variant="ghost" size="sm" className="register-link" onClick={registerEquipment}>Não encontrou o equipamento? Cadastre um novo</Button>
    : undefined;

  const pickUnit = (v: string) => { setUnitId(v); if (equipment && equipment.unitId !== v) { setEquipmentId(''); setProblemId(''); } };
  const pickEquipment = (v: string) => {
    const e = db.equipments.find((x) => x.id === v);
    setEquipmentId(v); setDupDismissed(false); resetRun();
    if (e) setUnitId(e.unitId);
    // se o tipo escolhido não se aplica à categoria do novo equipamento, volta a pedir o tipo
    const cur = refs.admin.requestTypes.find((t) => t.id === problemId);
    if (cur && !typeFits(cur, e?.categoryId)) setProblemId('');
  };
  const pickProblem = (v: string) => { setProblemId(v); resetRun(); };
  function resetRun() { setRun({ overall: 'nao-iniciado', tips: [] }); setFinished(false); setDone([]); setTipIdx(0); }

  // ── Troubleshooting ──
  const start = () => { setDone(tips.map(() => false)); setTipIdx(0); setStage('tips'); window.scrollTo({ top: 0 }); };
  const resultsUpTo = (n: number): Array<{ text: string; result: TipResult }> => tips.slice(0, n + 1).map((t, k) => ({ text: t.text, result: done[k] ? 'realizada' : 'pulada' }));
  const toggleDone = (v: boolean) => setDone((d) => d.map((x, k) => (k === tipIdx ? v : x)));
  const solved = () => {
    // CTA002: conclui sem criar solicitação para triagem e registra a ocorrência no histórico do equipamento
    const results = tips.slice(0, tipIdx + 1).map((t, k): { text: string; result: TipResult } => ({ text: t.text, result: k === tipIdx || done[k] ? 'realizada' : 'pulada' }));
    if (!IS_THUMB && mode !== 'resolved' && equipment) {
      const db0 = JSON.parse(JSON.stringify(db)) as typeof db;
      const id = nextSeq('SOL', db0.requests.map((r) => r.id));
      const r: Request = {
        id, equipmentId: equipment.id, problemId, impact: impact || 'baixo', description: `Resolvida na solução de problemas (dica nº ${tipIdx + 1}): ${problemName}`, photos: 0,
        requesterName: user.name || contactName.trim() || 'Colaborador', requesterPhone: user.phone || onlyDigits(contactPhone), requesterUserId: user.id, channel, openedAt: nowLocal(), statusId: STS.DONE, statusChangedAt: nowLocal(),
        previousRepair: { related: false }, troubleshooting: { overall: 'resolvido', tips: results }, closeReason: 'Resolvida no troubleshooting',
        log: [logEntry(user.name || 'Colaborador', 'Abriu a solicitação'), logEntry(user.name || 'Colaborador', `Concluída sem OS: resolvida no troubleshooting (dica nº ${tipIdx + 1})`)],
      };
      updateSubDb((d) => ({ ...d, requests: [...d.requests, { ...r, id: nextSeq('SOL', d.requests.map((x) => x.id)) }] }));
      setResolvedId(r.id);
    }
    setRun({ overall: 'resolvido', tips: results });
    setStage('resolved');
    window.scrollTo({ top: 0 });
  };
  const next = () => { setTipIdx((i) => i + 1); };
  const noSuccess = () => {
    setRun({ overall: 'sem-sucesso', tips: resultsUpTo(tipIdx) });
    setFinished(true); setStage('form');
    window.scrollTo({ top: 0 });
  };

  // ── Envio ──
  // Etapa de revisão (sempre antes de enviar): o formulário só valida e leva ao resumo; o envio é confirmado lá
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true); setBanner(false); setTick((n) => n + 1);
    if (invalid || !equipment) return;
    setStage('review');
    window.scrollTo({ top: 0 });
  };
  /** Volta ao formulário (nada se perde) e leva a pessoa à seção que quer corrigir. */
  const backToEdit = (section?: 'equipment' | 'problem' | 'contact') => {
    setStage('form');
    window.setTimeout(() => (section ? document.querySelector(`.sec-${section}`)?.scrollIntoView({ block: 'start' }) : window.scrollTo({ top: 0 })), 50);
  };
  const send = () => {
    if (!equipment) return;
    setSaving(true);
    let id = '';
    updateSubDb((d) => {
      id = nextSeq('SOL', d.requests.map((r) => r.id));
      const created: Request = {
        id, equipmentId: equipment.id, problemId, impact: impact as Impact, description: description.trim(), photos: photos.length,
        requesterName: contactName.trim(), requesterPhone: onlyDigits(contactPhone), requesterUserId: user.id, channel,
        openedAt: nowLocal(), statusId: STS.NEW, statusChangedAt: nowLocal(),
        previousRepair: related === 'sim' ? { related: true, note: prevNote.trim() || undefined } : { related: false },
        troubleshooting: run, log: [logEntry(contactName.trim(), 'Abriu a solicitação')],
      };
      return { ...d, requests: [...d.requests, created] };
    });
    // Notifica quem faz a triagem: Administradores e Gestores de manutenção (RF404-FLU006)
    const triagers = db.users.filter((u) => u.status === 'ativo' && (u.profile === 'administrador' || u.profile === 'gestor') && u.id !== user.id).map((u) => u.id);
    onRemember?.(contactName.trim(), formatPhone(contactPhone));
    notify(triagers, { title: 'Nova solicitação aberta', text: `${id}: ${equipment.name} · ${problemName} (impacto ${IMPACT_LABEL[impact as Impact].toLowerCase()})`, href: `solicitacao.html?id=${id}`, kind: 'solicitacao' });
    onSent(id);
  };

  // ── Resolvido no troubleshooting ──
  if (stage === 'resolved') {
    return shell(<>
        <Stack gap="xl">
          {external && troubleshootingHeader ? troubleshootingHeader : header}
          {external ? (
            <DevNote note="RF403-FLU004 / CTA002: “Isso resolveu o problema!” encerra o fluxo sem abrir solicitação para triagem. É criado um registro Concluída sem OS (resolvida no troubleshooting) e a ocorrência fica no histórico do equipamento. O nome do equipamento não se repete aqui: já aparece no cabeçalho.">
                <div className="ext-empty is-success">
                  <EmptyState
                    compact icon={<IconCircleCheck size={32} />} headingLevel={2} title="Problema resolvido!"
                    description="A ocorrência foi registrada no histórico do equipamento, sem necessidade de abrir uma solicitação."
                    action={(
                      <Stack gap="sm" align="center">
                        {resolvedId && <span className="ext-item-date">Registro {resolvedId}</span>}
                        <Stack direction="horizontal" gap="sm" wrap justify="center">{resolvedActions(equipment?.id)}</Stack>
                      </Stack>
                    )}
                  />
                </div>
            </DevNote>
          ) : (
            <>
          <DevNote note="RF403-FLU004 / CTA002: “Isso resolveu o problema!” encerra o fluxo sem abrir solicitação para triagem. É criado um registro Concluída sem OS (resolvida no troubleshooting) e a ocorrência fica no histórico do equipamento.">
            <Feedback type="success" title="Problema resolvido" message={`Que bom que deu certo${equipment ? `: ${equipment.name} voltou a funcionar` : ''}. Nenhuma solicitação foi enviada para análise`} />
          </DevNote>
          <Card>
            <EmptyState
              title="Ocorrência registrada"
              description={`A solução ficou registrada no histórico do equipamento${resolvedId ? ` (${resolvedId})` : ''}.`}
              headingLevel={2}
              action={(
                <Stack direction="horizontal" gap="sm" wrap justify="center">
                  {resolvedActions(equipment?.id)}
                </Stack>
              )}
            />
          </Card>
            </>
          )}
        </Stack>
      </>);
  }

  // ── Revisão antes de enviar ──
  if (stage === 'review' && equipment) {
    const unit = db.units.find((u) => u.id === equipment.unitId);
    const env = db.environments.find((x) => x.id === equipment.environmentId);
    const edit = (section: 'equipment' | 'problem' | 'contact') => <Button variant="ghost" size="sm" disabled={saving} onClick={() => backToEdit(section)}>Editar</Button>;
    return shell(<>
      <Stack gap="xl" className="form-page">
        {header}
        <DevNote note="Etapa de revisão: sempre que se cria uma solicitação (portal e QR Code), o formulário leva a este resumo antes do envio. Mostra unidade e ativo, a ocorrência e o contato; cada bloco tem Editar (volta ao formulário na seção, sem perder o que foi preenchido) e o envio só acontece em “Confirmar e enviar”. Os mesmos dados do formulário, sem campos novos.">
          <Feedback type="info" title="Revise sua solicitação" message="Confira as informações abaixo. Se algo estiver errado, corrija antes de enviar" />
        </DevNote>
        <Card title="Unidade e ativo" actions={edit('equipment')}>
          <div className="card-body-tight">
            <Grid>
              <Col span={6} mobileFull><ReadField label="Unidade" value={unit?.name ?? '-'} /></Col>
              <Col span={6} mobileFull><ReadField label="Ambiente" value={env?.name ?? '-'} /></Col>
              <Col span={6} mobileFull><ReadField label="Equipamento" value={equipment.name} /></Col>
              <Col span={6} mobileFull><ReadField label="Código" value={equipment.code || equipment.id} /></Col>
            </Grid>
          </div>
        </Card>
        <Card title="Ocorrência" actions={edit('problem')}>
          <div className="card-body-tight">
            <Grid>
              <Col span={6} mobileFull><ReadField label="Tipo de solicitação" value={problemName} /></Col>
              <Col span={6} mobileFull><ReadField label="Impacto" value={impact ? IMPACT_LABEL[impact as Impact] : '-'} /></Col>
              <Col span={12}><ReadField label="Descrição" value={description.trim()} /></Col>
              <Col span={6} mobileFull><ReadField label="Fotos" value={photos.length ? (photos.length === 1 ? '1 foto anexada' : `${photos.length} fotos anexadas`) : 'Nenhuma foto'} /></Col>
              <Col span={6} mobileFull><ReadField label="Relacionado a reparo anterior" value={related === 'sim' ? 'Sim' : 'Não'} /></Col>
              {related === 'sim' && prevNote.trim() && <Col span={12}><ReadField label="Observação do reparo anterior" value={prevNote.trim()} /></Col>}
              {!external && <Col span={12}><ReadField label="Solução de problemas" value={run.overall === 'sem-sucesso' ? 'Tentada, sem sucesso' : tips.length ? 'Não iniciada' : 'Sem dicas para este problema'} /></Col>}
            </Grid>
          </div>
        </Card>
        <Card title="Contato para retorno" actions={edit('contact')}>
          <div className="card-body-tight">
            <Grid>
              <Col span={6} mobileFull><ReadField label="Nome" value={contactName.trim()} /></Col>
              <Col span={6} mobileFull><ReadField label="Telefone" value={contactPhone} /></Col>
            </Grid>
          </div>
        </Card>
        <div className={external ? 'ext-actions' : undefined}>
          <Stack direction="horizontal" justify="start" gap="sm" wrap>
            <Button disabled={saving} onClick={send}>{saving ? 'Enviando...' : 'Confirmar e enviar'}</Button>
            <Button variant="secondary" disabled={saving} onClick={() => backToEdit()}>Voltar e corrigir</Button>
          </Stack>
        </div>
      </Stack>
    </>);
  }

  // ── Dicas ──
  if (stage === 'tips' && tips.length) {
    const last = tipIdx === tips.length - 1;
    const pct = Math.round(((tipIdx + 1) / tips.length) * 100);
    return shell(<>
        <Stack gap="xl" className="form-page">
          {external && troubleshootingHeader ? troubleshootingHeader : header}
          <DevNote note="RF403-FLU002/FLU003, RGN005 e CTA004: uma dica por tela, da mais simples à mais complexa, com barra de progresso. “Próxima dica” sem marcar “Testei esta dica” registra Pulada; marcando, Realizada. É possível voltar à dica anterior. Na última dica, o botão vira “Sem sucesso? Envie uma solicitação”. Etapas de risco (elétrica, gás) só orientam a observar (RGN002).">
            <Card
              className="card-open ts-step" title={external ? problemName : 'Solução de problemas'} subtitle={external ? undefined : `${equipment?.name} · ${problemName}`}
              actions={<span className="ts-count" aria-hidden="true">{tipIdx + 1} de {tips.length}</span>}
            >
              <div className="card-body-tight">
                <Stack gap="lg">
                  <SafetyGuidance note={equipment?.safetyNote} />
                  <div className="tip-progress" role="progressbar" aria-label="Progresso das dicas" aria-valuemin={0} aria-valuemax={tips.length} aria-valuenow={tipIdx + 1} aria-valuetext={`Dica ${tipIdx + 1} de ${tips.length}`}>
                    <div className="tip-progress-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="ts-instruction" aria-live="polite">
                    <span className="ts-instruction-icon" aria-hidden="true"><IconBulb size={24} /></span>
                    <p className="ts-instruction-text">{tips[tipIdx].text}</p>
                  </div>
                  <div className="ts-attempt">
                    <Checkbox label="Testei esta dica" checked={!!done[tipIdx]} onChange={(e) => toggleDone(e.target.checked)} />
                  </div>
                  <Stack gap="md" className="ts-actions">
                    <Button className="ts-primary" onClick={solved}>Isso resolveu o problema!</Button>
                    <div className="ts-nav">
                      <Button variant="secondary" disabled={tipIdx === 0} onClick={() => setTipIdx((i) => i - 1)}>Dica anterior</Button>
                      {last
                        ? <Button variant="secondary" onClick={noSuccess}>Sem sucesso? Envie uma solicitação</Button>
                        : <Button variant="secondary" onClick={next}>Próxima dica</Button>}
                    </div>
                  </Stack>
                  <div className="ts-back"><Button variant="ghost" size="sm" onClick={() => { setStage('form'); resetRun(); }}>Voltar ao formulário</Button></div>
                </Stack>
              </div>
            </Card>
          </DevNote>
        </Stack>
      </>);
  }

  const showTsOffer = !!equipment && !!problemId && tips.length > 0 && !finished && run.overall === 'nao-iniciado';

  return shell(<>
      <form className="form-page" onSubmit={onSubmit} onChangeCapture={() => setBanner(false)} noValidate>
        <Stack gap={external ? 'lg' : 'xl'}>
          {header}
          {banner && (
            <div className="floating-feedback">
              <Feedback type="error" title="Preencha os campos obrigatórios" message="Revise os campos destacados para continuar" dismissible onDismiss={() => setBanner(false)} />
            </div>
          )}
          {finished && (
            <DevNote note="RF403-FLU005: na última dica, sem solução, o usuário volta ao formulário com a mensagem “Solução de problemas concluída”. A solicitação segue com as notas (cada dica e Realizada/Pulada; resultado geral Sem sucesso - FLU006).">
              <Feedback type="info" title="Solução de problemas concluída" message={external ? 'O problema não foi resolvido. Continue preenchendo a solicitação.' : 'O problema não foi resolvido. As dicas tentadas serão enviadas junto com a solicitação. Complete os dados e envie a solicitação para análise'} />
            </DevNote>
          )}

          {external && equipment ? (
            <DevNote note="Colaborador RF002: equipamento, unidade e ambiente pré-preenchidos pelo QR Code - não há escolha de equipamento.">
              <Section className="card-open" title="Equipamento" subtitle="Identificado pelo QR Code">
                <div className="card-body-tight">
                  <dl className="ext-kv">
                    <div><dt>Nome</dt><dd>{equipment.name}</dd></div>
                    <div><dt>Código</dt><dd>{equipment.code}</dd></div>
                    <div><dt>Unidade</dt><dd>{db.units.find((u) => u.id === equipment.unitId)?.name ?? '-'}</dd></div>
                    <div><dt>Ambiente</dt><dd>{db.environments.find((x) => x.id === equipment.environmentId)?.name ?? '-'}</dd></div>
                  </dl>
                </div>
              </Section>
            </DevNote>
          ) : (
          <Section className="card-open sec-equipment" title="Equipamento" subtitle="Escolha a unidade e o equipamento com o problema">
            <div className="card-body-tight">
              <Grid>
                <Col span={12}>
                  <DevNote note="RF404-FLU002: apenas unidades ativas e do perfil do usuário. Equipamento localizado por nome ou código/patrimônio, sem QR Code (CTA002), filtrado pela unidade; só equipamentos ativos. Pré-selecionado quando vem do ativo (?equipment=).">
                    <Dropdown label="Unidade" required placeholder="Selecione a unidade" options={activeUnits.map((u) => ({ value: u.id, label: u.name }))} value={unitId} onChange={pickUnit} error={show('unit')} />
                  </DevNote>
                </Col>
                <Col span={12}>
                  <DevNote note="Equipamento não encontrado: o atalho fica discreto abaixo do campo (“Não encontrou o equipamento? Cadastre um novo”, some depois de escolher um equipamento) e também aparece dentro da lista quando a busca não acha nada (“Cadastrar equipamento”) (só para quem pode cadastrar equipamentos). Leva ao cadastro de equipamento (mesma tela de Equipamentos > Novo, sem duplicar) com a unidade já escolhida; ao salvar, volta para Nova solicitação com o equipamento novo selecionado, e o que já estava preenchido volta junto (menos as fotos). Cancelar no cadastro também volta para cá.">
                  <Dropdown label="Equipamento" emptyAction={registerAction} required placeholder="Buscar por nome ou código/patrimônio" searchable searchPlaceholder="Buscar por nome ou código/patrimônio" searchLabel="Buscar equipamento por nome ou código/patrimônio" emptyText="Nenhum equipamento encontrado" options={equipmentOptions} value={equipmentId} onChange={pickEquipment} error={show('equipment')} />
                  </DevNote>
                  {registerLink && !equipmentId && <div>{registerLink}</div>}
                </Col>
              </Grid>
            </div>
          </Section>
          )}

          {equipment?.safetyNote && (
            <DevNote note="💡 Orientação de segurança cadastrada no equipamento (texto livre, opcional): aparece assim que o equipamento é escolhido, antes de descrever o problema, no portal e no QR Code. Só orienta; não substitui o procedimento interno de emergência.">
              <SafetyGuidance note={equipment.safetyNote} />
            </DevNote>
          )}

          {equipment && openOnes.length > 0 && !dupDismissed && (
            <DevNote note="RF404-FLU003 / RGN004 / CTA003: com solicitações abertas para o equipamento, o sistema avisa e lista os protocolos; o usuário pode acompanhar uma existente ou seguir com a nova. O aviso não impede o envio.">
              {external ? (
                <div className="ext-dup-group">
                  <Feedback
                    type="warning" title="Já existem solicitações abertas" message="Confira se o problema já foi relatado antes de continuar."
                    dismissible onDismiss={() => setDupDismissed(true)}
                  />
                  {openOnes.map((r) => <OpenRequestCard key={r.id} request={r} href={trackHref(r.id)} />)}
                </div>
              ) : (
              <Stack gap="md">
                <Feedback
                  type="warning" title="Já existem solicitações abertas para este equipamento"
                  message="Confira se o seu problema já foi informado. Você pode acompanhar uma delas ou seguir com a nova solicitação"
                  dismissible onDismiss={() => setDupDismissed(true)}
                />
                {isMobile ? (
                  <MobileCardList
                    headingId="existing-title" title="Acompanhar uma solicitação existente" subtitle="Verifique se o mesmo problema já foi registrado em outra solicitação" emptyTitle="Nenhuma solicitação aberta"
                    page={1} pageSize={Math.max(1, openOnes.length)} total={openOnes.length} onPageChange={() => undefined}
                    items={openOnes.map((r) => ({ id: r.id, title: <a className="text-link" href={trackHref(r.id)}>{r.id}</a>, subtitle: refs.requestType(r.problemId)?.name ?? '-', badge: refs.statusBadge(r.statusId), fields: [...(external ? [] : [{ label: 'Descrição', value: shortText(r.description) }]), { label: 'Aberta em', value: formatDateTime(r.openedAt) }] }))}
                  />
                ) : (
                  <Table<ExistingRow> title="Acompanhar uma solicitação existente" subtitle="Verifique se o mesmo problema já foi registrado em outra solicitação" columns={existingCols} rows={openOnes.map((r) => ({ id: r.id, r }))} />
                )}
              </Stack>
              )}
            </DevNote>
          )}
          {external && equipment && openOnes.length > 0 && !dupDismissed && (
            <div className="ext-divider" role="separator" aria-label="Abrir nova solicitação"><span>Abrir nova solicitação</span></div>
          )}

          <Section className="card-open sec-problem" title="Problema" subtitle="Conte o que está acontecendo">
            <div className="card-body-tight">
              <Grid>
                <Col span={6}><Dropdown label="Tipo de solicitação" required placeholder="Selecione" options={typeOptions} value={problemId} onChange={pickProblem} error={show('problem')} helperText={typesFiltered ? 'Mostramos os tipos mais comuns para esta categoria. Se não encontrar, use Outro' : undefined} /></Col>
                <Col span={6}>
                  <DevNote note="💡 Impacto: sugestão Baixo / Médio / Alto, a confirmar. A triagem usa o impacto na matriz de prioridade (Admin RF405).">
                    <RadioButton name="impact" label="Impacto" orientation="horizontal" options={(Object.keys(IMPACT_LABEL) as Impact[]).map((v) => ({ value: v, label: IMPACT_LABEL[v] }))} value={impact} onChange={(v) => setImpact(v as Impact)} error={show('impact')} />
                  </DevNote>
                </Col>
                {showTsOffer && (
                  <Col span={12}>
                    <DevNote note="RF403-FLU001 / RF404-RGN006: o troubleshooting é oferecido depois de escolher equipamento e tipo de solicitação, se houver dicas cadastradas (CTA001). Iniciar é opcional (RGN008): se não iniciar, a solicitação registra “Não iniciado”. Sem dicas, segue direto para o envio (RGN004).">
                      <Card
                        className="ts-offer" padding="none" title={<span className="ts-offer-title"><IconBulb size={20} aria-hidden="true" />Solução de problemas</span>}
                        subtitle={external
                          ? `Confira ${tips.length === 1 ? '1 dica que pode resolver' : `${tips.length} dicas que podem resolver`} o problema antes de enviar a solicitação`
                          : `Antes de enviar a solicitação, confira ${tips.length === 1 ? 'esta dica' : `estas ${tips.length} dicas`} para tentar resolver o problema`}
                        actions={<Button onClick={start}>Começar</Button>}
                      />
                    </DevNote>
                  </Col>
                )}
                <Col span={12}>
                  <Textarea
                    label="Descrição" required rows={5} maxLength={DESC_MAX} value={description} onChange={(e) => setDescription(e.target.value)} error={show('description')}
                    helperText={`${description.length}/${DESC_MAX} caracteres`}
                  />
                </Col>
                <Col span={12}>
                  <DevNote note="💡 RF404: quantidade e tamanho máximos das fotos a definir (aqui, até 5). Envio simulado no protótipo.">
                    <Stack gap="md">
                      {photos.map((p, i) => (
                        <PhotoSlot
                          key={`${p.name}-${i}`} label={i === 0 ? 'Fotos' : `Foto ${i + 1}`} optional={i === 0} photo={p}
                          onChange={(next) => setPhotos((l) => (next ? l.map((x, k) => (k === i ? next : x)) : l.filter((_, k) => k !== i)))}
                        />
                      ))}
                      {photos.length < MAX_PHOTOS && (
                        <PhotoSlot key={`new-${photos.length}`} label={photos.length === 0 ? 'Fotos' : `Foto ${photos.length + 1}`} optional={photos.length === 0} onChange={(next) => next && setPhotos((l) => [...l, next])} />
                      )}
                    </Stack>
                  </DevNote>
                </Col>
                <Col span={12}>
                  <DevNote note="RF404 (v0.4): “Relacionado a reparo anterior?” é obrigatório (Sim/Não); a observação é opcional e não exige vincular protocolo. O reparo também tem garantia.">
                    <RadioButton name="related" label="Relacionado a reparo anterior?" orientation="horizontal" options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]} value={related} onChange={setRelated} error={show('related')} />
                  </DevNote>
                </Col>
                {related === 'sim' && (
                  <Col span={12}><Textarea label="Observação do reparo anterior" optional rows={3} value={prevNote} onChange={(e) => setPrevNote(e.target.value)} placeholder="Descreva o reparo realizado anteriormente." /></Col>
                )}
              </Grid>
            </div>
          </Section>

          <Section className="card-open sec-contact" title="Contato para retorno" subtitle="Usaremos estes dados para falar com você sobre a solicitação">
            <div className="card-body-tight">
              <Grid>
                <Col span={6} mobileFull><Input label="Nome" required autoComplete="name" value={contactName} onChange={(e) => setContactName(e.target.value)} error={show('name')} /></Col>
                <Col span={6} mobileFull><Input label="Telefone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" value={contactPhone} onChange={(e) => setContactPhone(formatPhone(e.target.value))} error={show('phone')} helperText="Usaremos este número para retorno e avisos pelo WhatsApp" /></Col>
              </Grid>
            </div>
          </Section>

          {external && (
            <DevNote note="Colaborador RF002: aceite dos Termos e da Política de Privacidade obrigatório (LGPD). Cada documento abre em um modal; os textos serão fornecidos pelo cliente e hoje são provisórios (placeholder, sinalizado no modal).">
              <Checkbox
                checked={terms} onChange={(e) => setTerms(e.target.checked)} error={show('terms')}
                label={<>Li e aceito os <button type="button" className="legal-link" onClick={() => setLegal('terms')}>Termos de Uso</button> e a <button type="button" className="legal-link" onClick={() => setLegal('privacy')}>Política de Privacidade</button></>}
              />
            </DevNote>
          )}

          <div className={external ? 'ext-actions' : undefined}>
            <Stack direction="horizontal" justify="start" gap="sm" wrap>
              <Button type="submit">Revisar solicitação</Button>
              <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
            </Stack>
          </div>
        </Stack>
      </form>
      {external && (
        <>
          <Dialog open={legal === 'terms'} onClose={() => setLegal(null)} size="lg" className="dialog-legal" title="Termos de Uso" subtitle="Leia os termos aplicáveis ao uso da plataforma Maglev">
            <Stack gap="md">
              <Feedback type="info" title="Texto provisório" message="O conteúdo definitivo dos Termos de Uso será fornecido pelo cliente. O texto abaixo é apenas um exemplo." />
              <LegalText kind="terms" label="Texto dos Termos de Uso" showNote={false} />
            </Stack>
          </Dialog>
          <Dialog open={legal === 'privacy'} onClose={() => setLegal(null)} size="lg" className="dialog-legal" title="Política de Privacidade" subtitle="Entenda como seus dados pessoais são tratados na plataforma Maglev">
            <Stack gap="md">
              <Feedback type="info" title="Texto provisório" message="O conteúdo definitivo da Política de Privacidade será fornecido pelo cliente. O texto abaixo é apenas um exemplo." />
              <LegalText kind="privacy" label="Texto da Política de Privacidade" showNote={false} />
            </Stack>
          </Dialog>
        </>
      )}
    </>);
}

