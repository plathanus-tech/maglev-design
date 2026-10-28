import { FormEvent, useEffect, useMemo, useState } from 'react';
import { IconInfoCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import { Button, Card, Checkbox, Dialog, Dropdown, Feedback, Input, MultiSelect, RadioButton, Stack, Textarea } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { PHONE_INVALID_EXAMPLE, PHONE_INVALID_MESSAGE, UFS, formatCnpj, formatPhone, isValidCnpj, isValidEmail, isValidPhone, onlyDigits, requiredMessage } from '../../admin/shared/format';
import { useHashState } from '../../admin/shared/useHashState';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { Provider, ProviderContact, SPECIALTIES, Technician } from './data';
import { CheckGroup } from './ListKit';
import { docKind, formatCpf, isValidCpf, mainContact, providerName } from './prestadores';
import { nextSeq, updateSubDb, useSubSession } from './store';
import { Col, Grid, ReadField, goTo, param, setFlash, useRefs } from './ui';

/** Estados: idle · required (salvar vazio) · duplicate (CNPJ/CPF já cadastrado - CTA002) · invalid (CNPJ inválido) */
const STATES = ['idle', 'required', 'duplicate', 'invalid', 'phoneinvalid'] as const;
type Mode = (typeof STATES)[number];

interface Region { id: string; city: string; uf: string }
interface Draft {
  kind: Provider['kind']; name: string; tradeName: string; doc: string; status: Provider['status']; notes: string;
  /** Só autônomo: e-mail e telefone dos Dados principais; viram o contato principal (fonte única) */
  email: string; phone: string;
  contacts: ProviderContact[]; specialties: string[]; categoryIds: string[]; equipmentTypes: string[]; regions: Region[]; technicians: Technician[];
}
const uid = () => `new-${Math.random().toString(36).slice(2, 8)}`;
const blankContact = (main = false): ProviderContact => ({ id: uid(), name: '', role: '', phone: '', email: '', main });
const blankTech = (): Technician => ({ id: uid(), name: '', specialties: [], phone: '', email: '' });
const blankRegion = (): Region => ({ id: uid(), city: '', uf: 'SC' });
const BLANK: Draft = {
  kind: 'empresa', name: '', tradeName: '', doc: '', status: 'ativo', notes: '', email: '', phone: '', contacts: [blankContact(true)],
  specialties: [], categoryIds: [], equipmentTypes: [], regions: [blankRegion()], technicians: [],
};
const toRegion = (s: string): Region => { const i = s.lastIndexOf('/'); return { id: uid(), city: i < 0 ? s : s.slice(0, i), uf: i < 0 ? 'SC' : s.slice(i + 1) }; };
const fromProvider = (p: Provider): Draft => ({
  kind: p.kind, name: p.name, tradeName: p.tradeName ?? '', doc: p.kind === 'empresa' || docKind(p.doc) === 'CNPJ' ? formatCnpj(p.doc) : formatCpf(p.doc), status: p.status, notes: p.notes ?? '',
  email: p.kind === 'autonomo' ? mainContact(p)?.email ?? '' : '', phone: p.kind === 'autonomo' ? formatPhone(mainContact(p)?.phone ?? '') : '',
  // Autônomo: o principal vem dos Dados principais; aqui ficam só os contatos adicionais
  contacts: p.contacts.filter((c) => p.kind !== 'autonomo' || c !== mainContact(p)).map((c) => ({ ...c, phone: formatPhone(c.phone), main: p.kind === 'autonomo' ? false : c.main })), specialties: [...p.specialties], categoryIds: [...p.categoryIds], equipmentTypes: [...p.equipmentTypes],
  regions: p.regions.length ? p.regions.map(toRegion) : [blankRegion()], technicians: p.technicians.map((t) => ({ ...t, phone: formatPhone(t.phone) })),
});

function PrestadorFormScreen() {
  const { db, can } = useSubSession();
  const refs = useRefs();
  const editing = db.providers.find((p) => p.id === param('id'));
  const [mode] = useHashState<Mode>(STATES, 'idle');
  // Aberto pelo Novo plano (?return=plano-form.html): sem menu lateral, breadcrumb de volta ao plano e, ao salvar, volta com o prestador escolhido
  const returnTo = !editing && param('return') === 'plano-form.html' ? 'plano-form.html' : null;
  const [d, setD] = useState<Draft>(() => (editing ? fromProvider(editing) : { ...structuredClone(BLANK), categoryIds: (param('cat') ?? '').split(',').filter(Boolean) }));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<'required' | 'multiple' | null>(null);
  const [tick, setTick] = useState(0);
  // Telefone marcado como inválido (variante do protótipo; a regra real de DDD/sequência é de desenvolvimento): o erro some ao editar o número
  const [badPhone, setBadPhone] = useState('');

  // Variantes do navegador: demais campos preenchidos, para o CNPJ ser o único erro
  useEffect(() => {
    if (editing || mode === 'idle') return;
    if (mode !== 'required') {
      setD((x) => ({
        ...x, name: 'Ar Frio Climatização Ltda', tradeName: 'Ar Frio', doc: mode === 'duplicate' ? formatCnpj(db.providers[0].doc) : mode === 'phoneinvalid' ? '11.222.333/0001-81' : '12.345.678/0001-00',
        contacts: [{ id: uid(), name: 'Marcos Teixeira', role: 'Sócio', phone: mode === 'phoneinvalid' ? PHONE_INVALID_EXAMPLE : formatPhone('48991234567'), email: 'marcos@arfrio.com.br', main: true }],
        specialties: ['Climatização'], categoryIds: ['CAT-006'], regions: [{ id: uid(), city: 'Florianópolis', uf: 'SC' }],
      }));
    }
    if (mode === 'phoneinvalid') setBadPhone(PHONE_INVALID_EXAMPLE);
    setTried(true); setTick((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setContact = (id: string, patch: Partial<ProviderContact>) => setD((x) => ({ ...x, contacts: x.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const setMain = (id: string) => setD((x) => ({ ...x, contacts: x.contacts.map((c) => ({ ...c, main: c.id === id })) }));
  const removeContact = (id: string) => setD((x) => { const rest = x.contacts.filter((c) => c.id !== id); if (rest.length && !rest.some((c) => c.main)) rest[0] = { ...rest[0], main: true }; return { ...x, contacts: rest }; });
  /** Rola até o card Atuação e leva o foco para ele (link do estado vazio do dropdown de especialidade do técnico) */
  const goToAtuacao = (ev: { preventDefault: () => void }) => {
    ev.preventDefault();
    const el = document.getElementById('prestador-atuacao');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
  };
  // Desmarcar em Atuação uma especialidade já vinculada a técnicos pede confirmação: os vínculos também são removidos
  const [pendingSpecs, setPendingSpecs] = useState<string[] | null>(null);
  const applySpecialties = (next: string[]) => setD((x) => ({ ...x, specialties: next, technicians: x.technicians.map((t) => ({ ...t, specialties: t.specialties.filter((s) => next.includes(s)) })) }));
  const changeSpecialties = (next: string[]) => {
    const dropped = d.specialties.filter((s) => !next.includes(s));
    if (dropped.some((s) => d.technicians.some((t) => t.specialties.includes(s)))) setPendingSpecs(next);
    else applySpecialties(next);
  };
  // Troca de tipo: empresa -> autônomo descarta técnicos (com confirmação); autônomo -> empresa devolve o autônomo como contato comum, sem duplicar
  const [pendingKind, setPendingKind] = useState<Provider['kind'] | null>(null);
  const convertKind = (x: Draft, kind: Provider['kind']): Draft => {
    if (kind === 'autonomo') {
      return { ...x, kind, doc: '', tradeName: '', technicians: [], email: '', phone: '', contacts: x.contacts.filter((c) => !isBlankContact(c)).map((c) => ({ ...c, main: false })) };
    }
    const self: ProviderContact[] = x.email.trim() || x.phone.trim() ? [{ id: uid(), name: x.name.trim(), role: 'Profissional autônomo', phone: x.phone, email: x.email, main: true }] : [];
    const others = x.contacts.map((c) => ({ ...c, main: false }));
    const contacts = [...self, ...others];
    if (!contacts.length) contacts.push(blankContact(true)); else if (!contacts.some((c) => c.main)) contacts[0] = { ...contacts[0], main: true };
    return { ...x, kind, doc: '', email: '', phone: '', contacts };
  };
  const changeKind = (kind: Provider['kind']) => {
    if (kind === d.kind) return;
    if (kind === 'autonomo' && d.technicians.length) setPendingKind(kind);
    else setD((x) => convertKind(x, kind));
  };
  const setTech = (id: string, patch: Partial<Technician>) => setD((x) => ({ ...x, technicians: x.technicians.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const setRegion = (id: string, patch: Partial<Region>) => setD((x) => ({ ...x, regions: x.regions.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const company = d.kind === 'empresa';
  const isBlankContact = (c: ProviderContact) => !c.name.trim() && !c.role.trim() && !c.phone.trim() && !c.email.trim();
  const docName = company ? 'CNPJ' : 'CPF/CNPJ';
  const autoCnpj = !company && docKind(d.doc) === 'CNPJ';
  const nameLabel = company ? 'Nome da empresa' : 'Nome do prestador';
  const docDigits = onlyDigits(d.doc);
  const docChanged = !editing || docDigits !== editing.doc;
  const duplicate = db.providers.some((p) => p.id !== editing?.id && p.doc === docDigits);
  const docValid = company || autoCnpj ? isValidCnpj(d.doc) : isValidCpf(d.doc);
  const equipmentTypeOptions = useMemo(() => [...new Set([...db.equipments.map((e) => e.name.replace(/\s+\d+$/, '')), ...d.equipmentTypes])].sort((a, b) => a.localeCompare(b, 'pt-BR')), [db.equipments]); // eslint-disable-line react-hooks/exhaustive-deps
  const categoryOptions = refs.admin.categories.filter((c) => c.status === 'ativo' || d.categoryIds.includes(c.id)).map((c) => ({ value: c.id, label: c.name }));

  // ── validação ──
  const req = (v: string, field: string) => (!v.trim() ? requiredMessage(field) : undefined);
  const e = {
    name: req(d.name, nameLabel),
    doc: !docDigits ? requiredMessage(docName) : duplicate ? `Já existe um prestador com este ${docName}` : docChanged && !docValid ? `Informe um ${company ? 'CNPJ' : autoCnpj ? 'CNPJ' : docDigits.length > 11 ? 'CNPJ' : 'CPF'} válido` : undefined,
    email: company ? undefined : req(d.email, 'E-mail') ?? (!isValidEmail(d.email) ? 'Informe um e-mail válido' : undefined),
    phone: company ? undefined : req(d.phone, 'Telefone/WhatsApp') ?? (!isValidPhone(d.phone) ? 'Informe um telefone válido' : undefined),
    specialties: !d.specialties.length ? requiredMessage('Especialidades') : undefined,
    categories: !d.categoryIds.length ? requiredMessage('Categorias atendidas') : undefined,
    regions: !d.regions.length ? requiredMessage('Região de atendimento') : undefined,
  };
  const contactErr = (c: ProviderContact) => ({
    name: req(c.name, 'Nome'), role: req(c.role, 'Função'),
    phone: req(c.phone, 'Telefone/WhatsApp') ?? (!isValidPhone(c.phone) ? 'Informe um telefone válido' : badPhone && c.phone === badPhone ? PHONE_INVALID_MESSAGE : undefined),
    email: req(c.email, 'E-mail') ?? (!isValidEmail(c.email) ? 'Informe um e-mail válido' : undefined),
  });
  const regionErr = (r: Region) => ({ city: req(r.city, 'Cidade'), uf: req(r.uf, 'UF') });
  const techErr = (t: Technician) => ({
    name: req(t.name, 'Nome do técnico'),
    phone: !t.phone.trim() ? requiredMessage('Telefone') : !isValidPhone(t.phone) ? 'Informe um telefone válido' : undefined,
    email: t.email && !isValidEmail(t.email) ? 'Informe um e-mail válido' : undefined,
  });
  const all = (): Array<string | undefined> => [...Object.values(e), ...d.contacts.flatMap((c) => Object.values(contactErr(c))), ...d.regions.flatMap((r) => Object.values(regionErr(r))), ...(company ? d.technicians.flatMap((t) => Object.values(techErr(t))) : [])];
  const show = (v?: string) => (tried ? v : undefined);

  useEffect(() => {
    if (!tick) return;
    const messages = all().filter(Boolean) as string[];
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

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    setTried(true); setBanner(null); setTick((n) => n + 1);
    if (all().some(Boolean)) return;
    setSaving(true);
    const id = editing?.id ?? nextSeq('PRE', db.providers.map((p) => p.id), 3);
    const provider: Provider = {
      id, kind: d.kind, name: d.name.trim(), tradeName: company && d.tradeName.trim() ? d.tradeName.trim() : undefined, doc: docDigits, status: d.status, notes: d.notes.trim() || undefined,
      // Autônomo: contato principal gerado dos Dados principais (única fonte de nome/e-mail/telefone) + adicionais opcionais
      contacts: [
        ...(company ? [] : [{ id: mainContact(editing ?? { contacts: [] } as unknown as Provider)?.id ?? `${id}-C0`, name: d.name.trim(), role: 'Profissional autônomo', phone: onlyDigits(d.phone), email: d.email.trim(), main: true }]),
        ...d.contacts.map((c, i) => ({ ...c, main: company ? c.main : false, id: c.id.startsWith('new-') ? `${id}-C${Date.now().toString(36)}${i}` : c.id, name: c.name.trim(), role: c.role.trim(), phone: onlyDigits(c.phone), email: c.email.trim() })),
      ],
      specialties: d.specialties, categoryIds: d.categoryIds, equipmentTypes: d.equipmentTypes,
      regions: d.regions.map((r) => `${r.city.trim()}/${r.uf}`),
      technicians: !company ? [] : d.technicians.map((t, i) => ({ ...t, id: t.id.startsWith('new-') ? `${id}-T${Date.now().toString(36)}${i}` : t.id, name: t.name.trim(), phone: onlyDigits(t.phone), email: t.email.trim() })),
    };
    updateSubDb((db0) => ({ ...db0, providers: editing ? db0.providers.map((p) => (p.id === id ? provider : p)) : [...db0.providers, provider] }));
    if (returnTo) {
      setFlash({ type: 'success', title: 'Prestador cadastrado', message: 'Ele já está selecionado como executor do plano.' });
      window.setTimeout(() => goTo(`${returnTo}?restore=1&provider=${id}`), 400);
      return;
    }
    setFlash(editing
      ? { type: 'success', title: 'Prestador atualizado', message: 'As alterações foram salvas.' }
      : { type: 'success', title: 'Prestador cadastrado', message: d.status === 'ativo' ? 'Ele já pode ser escolhido em OS e planos das categorias que atende.' : 'Ele está inativo e não será ofertado em OS e planos.' });
    window.setTimeout(() => goTo(`prestador.html?id=${id}`), 400);
  };

  const cancel = () => goTo(editing ? `prestador.html?id=${editing.id}` : returnTo ? `${returnTo}?restore=1` : 'prestadores.html');
  const allowed = can('prestadores', editing ? 'editar' : 'cadastrar');

  if (param('id') && !editing) {
    return <AppLayout active="prestadores" screen="prestadores"><Feedback type="error" title="Prestador não encontrado" message="Volte para a lista de prestadores e tente novamente" /></AppLayout>;
  }
  if (!allowed) {
    return <AppLayout active="prestadores" screen="prestadores"><Feedback type="error" title="Sem permissão" message={`Seu perfil não pode ${editing ? 'editar' : 'cadastrar'} prestadores`} /></AppLayout>;
  }

  return (
    <AppLayout active={returnTo ? 'planos' : 'prestadores'} screen="prestadores" layout={returnTo ? 'focused' : 'default'}>
      <form className="form-page" onSubmit={onSubmit} onChangeCapture={() => setBanner(null)} noValidate>
        <Stack gap="xl">
          <PageHeader
            title={editing ? `Editar ${providerName(editing)}` : 'Novo prestador'}
            breadcrumb={returnTo
              ? [{ label: 'Planos de manutenção', href: 'planos.html' }, { label: 'Novo plano', href: `${returnTo}?restore=1` }, { label: 'Novo prestador' }]
              : [{ label: 'Prestadores', href: 'prestadores.html' }, { label: editing ? 'Editar' : 'Novo prestador' }]}
            subtitle={editing ? undefined : returnTo ? 'Ao salvar, você volta para o Novo plano com este prestador já selecionado' : 'Informe os dados do prestador de serviços'}
          />
          {banner && (
            <div className="floating-feedback">
              {banner === 'required'
                ? <Feedback type="error" title="Preencha os campos obrigatórios" message="Revise os campos destacados para continuar" dismissible onDismiss={() => setBanner(null)} />
                : <Feedback type="error" title="Não foi possível salvar" message="Corrija os campos destacados e tente novamente" dismissible onDismiss={() => setBanner(null)} />}
            </div>
          )}

          <Card className="card-open" title="Dados principais" subtitle="Identificação do prestador">
            <div className="card-body-tight">
              <Grid>
                <Col span={12}>
                  <RadioButton
                    name="kind" label="Tipo de prestador" orientation="horizontal" value={d.kind}
                    options={[{ value: 'empresa', label: 'Empresa' }, { value: 'autonomo', label: 'Profissional autônomo' }]}
                    onChange={(v) => changeKind(v as Provider['kind'])}
                  />
                </Col>
                <Col span={12}><Input label={nameLabel} required autoComplete="off" value={d.name} onChange={(ev) => set('name', ev.target.value)} error={show(e.name)} /></Col>
                {company && <Col span={12}><Input optional label="Nome fantasia" autoComplete="off" value={d.tradeName} onChange={(ev) => set('tradeName', ev.target.value)} /></Col>}
                <Col span={editing ? 6 : 12}>
                  <DevNote note="RF702-CTA002: CNPJ (empresa) ou CPF (autônomo), com dígitos verificadores válidos e único por assinante - não permite dois prestadores com o mesmo documento. Na edição, um documento já cadastrado e inalterado não é revalidado.">
                    <Input
                      label={docName} required inputMode="numeric" placeholder={company ? '00.000.000/0000-00' : '000.000.000-00 ou 00.000.000/0000-00'} value={d.doc}
                      onChange={(ev) => set('doc', company || docKind(ev.target.value) === 'CNPJ' ? formatCnpj(ev.target.value) : formatCpf(ev.target.value))} error={show(e.doc)}
                    />
                  </DevNote>
                </Col>
                {editing && (
                  <Col span={6}>
                    <DevNote note="Status só aparece na edição: todo prestador novo nasce ativo. Prestador inativo não é ofertado em novas OS e planos (RF701-RGN001); OS e planos existentes continuam atribuídos.">
                      <RadioButton name="status" label="Status" orientation="horizontal" value={d.status} options={[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]} onChange={(v) => set('status', v as Provider['status'])} />
                    </DevNote>
                  </Col>
                )}
                {!company && (
                  <>
                    <Col span={6}>
                      <DevNote note="Autônomo: o e-mail daqui é o do contato principal e o destinatário padrão dos links de acesso às OS atribuídas a ele (RF102). Obrigatório e validado. Nome, e-mail e telefone têm uma única fonte (Dados principais): o contato principal é gerado deles e não é editável na seção Contatos.">
                        <Input label="E-mail" required type="email" autoComplete="off" value={d.email} onChange={(ev) => set('email', ev.target.value)} error={show(e.email)} />
                      </DevNote>
                    </Col>
                    <Col span={6}><Input label="Telefone/WhatsApp" required type="tel" autoComplete="off" value={formatPhone(d.phone)} onChange={(ev) => set('phone', ev.target.value)} error={show(e.phone)} helperText="Usado para contato e avisos de ordens de serviço pelo WhatsApp" /></Col>
                  </>
                )}
                <Col span={12}>
                  <Textarea optional label="Observações" rows={3} maxLength={200} value={d.notes} onChange={(ev) => set('notes', ev.target.value)} helperText={`${d.notes.length}/200 caracteres`} />
                </Col>
              </Grid>
            </div>
          </Card>

          <DevNote note="RF702 (🔄 CTA003): o prestador aceita mais de um contato (1..N), com ao menos um principal. O e-mail do contato é usado para enviar o link de acesso às OS (RF102). Nome, função, telefone/WhatsApp e e-mail obrigatórios.">
            <Card className="card-open" title="Contatos" subtitle="Cadastre os contatos do prestador que poderão receber por e-mail links de acesso às ordens de serviço">
              <div className="card-body-tight">
                <Stack gap="lg">
                  {!company && (
                    <Card className="card-open contact-card">
                      <Stack gap="md">
                        <h3 className="page-label">Contato principal</h3>
                        <Grid>
                          <Col span={d.phone.trim() ? 3 : 4}><ReadField label="Nome" value={d.name.trim() || '-'} /></Col>
                          <Col span={d.phone.trim() ? 3 : 4}><ReadField label="Função" value="Profissional autônomo" /></Col>
                          <Col span={d.phone.trim() ? 3 : 4}><ReadField label="E-mail" value={d.email.trim() || '-'} /></Col>
                          {d.phone.trim() && <Col span={3}><ReadField label="Telefone/WhatsApp" value={formatPhone(d.phone)} /></Col>}
                        </Grid>
                        <p className="field-note">Este e-mail será utilizado para o envio dos links de acesso às OSs</p>
                      </Stack>
                    </Card>
                  )}
                  {d.contacts.map((c, i) => {
                    const err = contactErr(c);
                    return (
                      <Card key={c.id} className="card-open contact-card">
                        <Stack gap="md">
                          <Stack direction="horizontal" justify="between" align="center">
                            <h3 className="page-label">{company ? `Contato ${i + 1}` : `Contato adicional ${i + 1}`}</h3>
                            {(!company || d.contacts.length > 1) && <Button variant="ghost" size="sm" iconLeft={<IconTrash size={16} />} aria-label={`Remover contato ${i + 1}`} onClick={() => removeContact(c.id)}>Remover</Button>}
                          </Stack>
                          <Grid>
                            <Col span={6}><Input label="Nome" required autoComplete="off" value={c.name} onChange={(ev) => setContact(c.id, { name: ev.target.value })} error={show(err.name)} /></Col>
                            <Col span={6}><Input label="Função" required autoComplete="off" value={c.role} onChange={(ev) => setContact(c.id, { role: ev.target.value })} error={show(err.role)} /></Col>
                            <Col span={6}><Input label="Telefone/WhatsApp" required type="tel" autoComplete="off" value={formatPhone(c.phone)} onChange={(ev) => setContact(c.id, { phone: ev.target.value })} error={show(err.phone)} helperText="Usado para contato e avisos de ordens de serviço pelo WhatsApp" /></Col>
                            <Col span={6}><Input label="E-mail" required type="email" autoComplete="off" value={c.email} onChange={(ev) => setContact(c.id, { email: ev.target.value })} error={show(err.email)} /></Col>
                            {company && <Col span={12}>
                              <Checkbox label="Contato principal" checked={!!c.main} disabled={!!c.main} onChange={() => setMain(c.id)} />
                              {c.main && d.contacts.length > 1 && <p className="field-note">Para trocar o principal, marque outro contato</p>}
                            </Col>}
                          </Grid>
                        </Stack>
                      </Card>
                    );
                  })}
                  <Stack direction="horizontal"><Button variant="ghost" size="sm" iconLeft={<IconPlus size={16} />} onClick={() => set('contacts', [...d.contacts, blankContact(company && !d.contacts.length)])}>{company ? 'Adicionar contato' : 'Adicionar contato adicional'}</Button></Stack>
                </Stack>
              </div>
            </Card>
          </DevNote>

          <div id="prestador-atuacao" tabIndex={-1}>
          <Card className="card-open" title="Atuação" subtitle="Defina os serviços prestados e as regiões atendidas">
            <div className="card-body-tight">
              <Stack gap="xl">
                <DevNote note="RF702: especialidades de uma lista fixa no protótipo. 💡 Lista cadastrável - definir se é global (Admin) ou por assinante.">
                  <CheckGroup label="Especialidades" columns options={SPECIALTIES.map((s) => ({ value: s, label: s }))} value={d.specialties} onChange={changeSpecialties} error={show(e.specialties)} />
                </DevNote>
                <DevNote note="Categorias de equipamento do Admin (RF402), múltiplas. Na criação de OS e planos, os prestadores sugeridos são filtrados por estas categorias (RGN004 / CTA001).">
                  <CheckGroup label="Categorias atendidas" columns options={categoryOptions} value={d.categoryIds} onChange={(v) => set('categoryIds', v)} error={show(e.categories)} />
                </DevNote>
                <DevNote note="💡 ZC002 (a confirmar): tipos de equipamento atendidos, ex.: técnico de refrigeração que só atende freezer (Cristiane, 29/09). Se aprovado, filtra também os prestadores sugeridos na OS.">
                  <CheckGroup optional label="Tipos de equipamento atendidos" columns options={equipmentTypeOptions.map((t) => ({ value: t, label: t }))} value={d.equipmentTypes} onChange={(v) => set('equipmentTypes', v)} />
                </DevNote>
                <DevNote note="RF702: região de atendimento obrigatória, uma ou mais Cidade/UF. 💡 Granularidade a confirmar (cidade/UF no protótipo).">
                  <Stack gap="md">
                    <h3 className="read-label">Região de atendimento</h3>
                    {show(e.regions) && <p className="field-error" role="alert">{show(e.regions)}</p>}
                    {d.regions.map((r, i) => {
                      const err = regionErr(r);
                      return (
                        <Card key={r.id} className="card-open contact-card">
                          <Stack gap="md">
                            <Stack direction="horizontal" justify="between" align="center">
                              <h4 className="page-label">{`Região ${i + 1}`}</h4>
                              <Button variant="ghost" size="sm" iconLeft={<IconTrash size={16} />} aria-label={`Remover região ${i + 1}`} onClick={() => set('regions', d.regions.filter((x) => x.id !== r.id))}>Remover</Button>
                            </Stack>
                            <Grid>
                              <Col span={8}><Input label="Cidade" required autoComplete="off" value={r.city} onChange={(ev) => setRegion(r.id, { city: ev.target.value })} error={show(err.city)} /></Col>
                              <Col span={4}><Dropdown label="UF" required options={UFS.map((u) => ({ value: u, label: u }))} value={r.uf} onChange={(v) => setRegion(r.id, { uf: v })} error={show(err.uf)} /></Col>
                            </Grid>
                          </Stack>
                        </Card>
                      );
                    })}
                    <Stack direction="horizontal"><Button variant="ghost" size="sm" aria-invalid={show(e.regions) ? true : undefined} iconLeft={<IconPlus size={16} />} onClick={() => set('regions', [...d.regions, blankRegion()])}>Adicionar região</Button></Stack>
                  </Stack>
                </DevNote>
              </Stack>
            </div>
          </Card>
          </div>

          {company && (
          <DevNote note="RF702-RGN002: um prestador pode ter vários técnicos, de especialidades diferentes (0..N). 💡 RGN003 / P09: a confirmar se o técnico precisa de e-mail/telefone próprio para receber o seu link de acesso - por isso ficam opcionais.">
            <Card className="card-open" title="Técnicos vinculados" subtitle="Profissionais do prestador que atendem as OS">
              <div className="card-body-tight">
                <Stack gap="lg">
                  {d.technicians.length === 0 && <p className="page-text">Nenhum técnico vinculado. Adicione se o prestador tiver mais de um profissional</p>}
                  {d.technicians.map((t, i) => {
                    const err = techErr(t);
                    return (
                      <Card key={t.id} className="card-open contact-card">
                        <Stack gap="md">
                          <Stack direction="horizontal" justify="between" align="center">
                            <h3 className="page-label">{`Técnico ${i + 1}`}</h3>
                            <Button variant="ghost" size="sm" iconLeft={<IconTrash size={16} />} aria-label={`Remover técnico ${i + 1}`} onClick={() => set('technicians', d.technicians.filter((x) => x.id !== t.id))}>Remover</Button>
                          </Stack>
                          <Grid>
                            <Col span={6}><Input label="Nome do técnico" required autoComplete="off" value={t.name} onChange={(ev) => setTech(t.id, { name: ev.target.value })} error={show(err.name)} /></Col>
                            <Col span={6}><MultiSelect optional label="Especialidades" placeholder="Selecione" removeLabel={(l) => `Remover especialidade ${l}`} emptyIcon={<IconInfoCircle size={20} />} emptyText="Nenhuma especialidade disponível." emptyAction={<a className="text-link" href="#prestador-atuacao" onClick={goToAtuacao}>Ir para Atuação</a>} options={d.specialties.map((s) => ({ value: s, label: s }))} value={t.specialties.filter((s) => d.specialties.includes(s))} onChange={(v) => setTech(t.id, { specialties: v })} /></Col>
                            <Col span={6}><Input required label="Telefone" type="tel" autoComplete="off" value={formatPhone(t.phone)} onChange={(ev) => setTech(t.id, { phone: ev.target.value })} error={show(err.phone)} /></Col>
                            <Col span={6}><Input optional label="E-mail" type="email" autoComplete="off" value={t.email} onChange={(ev) => setTech(t.id, { email: ev.target.value })} error={show(err.email)} /></Col>
                          </Grid>
                        </Stack>
                      </Card>
                    );
                  })}
                  <Stack direction="horizontal"><Button variant="ghost" size="sm" iconLeft={<IconPlus size={16} />} onClick={() => set('technicians', [...d.technicians, blankTech()])}>Adicionar técnico</Button></Stack>
                </Stack>
              </div>
            </Card>
          </DevNote>
          )}

          <Stack direction="horizontal" justify="start" gap="sm" wrap>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar prestador'}</Button>
            <Button variant="secondary" onClick={cancel} disabled={saving}>Cancelar</Button>
          </Stack>
        </Stack>
      </form>
      {pendingKind && (
        <Dialog
          open onClose={() => setPendingKind(null)} size="sm" title="Alterar para profissional autônomo?"
          subtitle={`${d.technicians.length === 1 ? 'O técnico vinculado será removido' : `Os ${d.technicians.length} técnicos vinculados serão removidos`} e o prestador passa a ser o próprio responsável pelas OS`}
          actions={(
            <>
              <Button size="sm" variant="secondary" onClick={() => setPendingKind(null)}>Cancelar</Button>
              <Button size="sm" variant="destructive" onClick={() => { setD((x) => convertKind(x, pendingKind)); setPendingKind(null); }}>Remover técnicos e alterar</Button>
            </>
          )}
        />
      )}
      {pendingSpecs && (() => {
        const dropped = d.specialties.filter((s) => !pendingSpecs.includes(s) && d.technicians.some((t) => t.specialties.includes(s)));
        const affected = d.technicians.filter((t) => t.specialties.some((s) => dropped.includes(s)));
        return (
          <Dialog
            open onClose={() => setPendingSpecs(null)} size="sm" title={`Remover ${dropped.length === 1 ? 'a especialidade' : 'as especialidades'} da atuação?`}
            subtitle={`${dropped.join(', ')} ${dropped.length === 1 ? 'também será removida' : 'também serão removidas'} de ${affected.length === 1 ? 'um técnico vinculado' : `${affected.length} técnicos vinculados`}`}
            actions={(
              <>
                <Button size="sm" variant="secondary" onClick={() => setPendingSpecs(null)}>Cancelar</Button>
                <Button size="sm" variant="destructive" onClick={() => { applySpecialties(pendingSpecs); setPendingSpecs(null); }}>Remover especialidade</Button>
              </>
            )}
          />
        );
      })()}
    </AppLayout>
  );
}

mountApp(<PrestadorFormScreen />);
