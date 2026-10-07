import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Button, Card, Dropdown, Feedback, Input, RadioButton, Stack } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { useHashState } from './useHashState';
import { getDb, logActivity, nextId, useSession, updateDb } from './store';
import { CONTACT_AREAS, Contact, ContactArea, PLANS, Subscriber, SubscriberStatus, subscriberName } from './data';
import {
  UFS, formatCep, formatCnpj, formatPhone, isValidCnpj, isValidEmail, isValidPhone, onlyDigits, requiredMessage,
} from './format';
import { lookupCep } from './cep';
import { Col, Grid, ReadField, goTo, param, setFlash } from './ui';

/** Estados: idle · required (salvar vazio) · cnpjinvalid · cnpjduplicate (CTA001) */
const STATES = ['idle', 'required', 'cnpjinvalid', 'cnpjduplicate'] as const;
type Mode = (typeof STATES)[number];

type Draft = Pick<Subscriber, 'cnpj' | 'legalName' | 'tradeName' | 'stateReg' | 'cityReg' | 'address' | 'contractedUnits' | 'contacts' | 'plan' | 'status' | 'admin'>;

const blankContact = (area: ContactArea = 'responsavel'): Contact => ({ id: `new-${Math.random().toString(36).slice(2, 8)}`, area, name: '', email: '', phone: '' });
const BLANK: Draft = {
  cnpj: '', legalName: '', tradeName: '', stateReg: '', cityReg: '',
  address: { cep: '', street: '', number: '', complement: '', district: '', city: '', uf: '' },
  contractedUnits: '', contacts: [blankContact()], plan: '', status: 'ativo',
  admin: { name: '', email: '', phone: '' },
};
const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inadimplente', label: 'Inadimplente' },
];

function AssinanteFormScreen() {
  const { db, user: me } = useSession();
  const editingId = param('id');
  const editing = useMemo(() => db.subscribers.find((s) => s.id === editingId), [db, editingId]);
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [d, setD] = useState<Draft>(() => (editing ? structuredClone(editing) : structuredClone(BLANK)));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  // Aviso no topo: só após tentar salvar com campos obrigatórios vazios ou com mais de um erro; some ao editar qualquer campo
  const [banner, setBanner] = useState<'required' | 'multiple' | null>(null);
  const [submitTick, setSubmitTick] = useState(0);

  // Variantes do navegador: preenchem um exemplo e mostram os erros.
  useEffect(() => {
    if (editing || mode === 'idle') return;
    if (mode === 'cnpjinvalid') setD((x) => ({ ...x, cnpj: '12.345.678/0001-00', legalName: 'Bar do Porto Ltda', tradeName: 'Bar do Porto' }));
    if (mode === 'cnpjduplicate') setD((x) => ({ ...x, cnpj: formatCnpj(getDb().subscribers[0].cnpj), legalName: 'Cantina Dona Rosa Ltda', tradeName: 'Cantina Dona Rosa' }));
    setTried(true);
    setSubmitTick((n) => n + 1);   // mostra o aviso do topo exatamente como após tentar salvar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setAddr = (k: keyof Draft['address'], v: string) => setD((x) => ({ ...x, address: { ...x.address, [k]: v } }));
  const setAdmin = (k: keyof Draft["admin"], v: string) => setD((x) => ({ ...x, admin: { ...x.admin, [k]: v } }));
  // CEP completo (8 dígitos) consulta o ViaCEP e preenche logradouro, bairro, cidade e estado (continuam editáveis);
  // número e complemento ficam com o usuário.
  const [cepMsg, setCepMsg] = useState<string>();
  const cepAbort = useRef<AbortController>();
  const onCep = (v: string) => {
    setAddr('cep', v);
    setCepMsg(undefined);
    cepAbort.current?.abort();
    if (onlyDigits(v).length !== 8) return;
    const ctl = new AbortController();
    cepAbort.current = ctl;
    lookupCep(v, ctl.signal)
      .then((found) => {
        if (!found) return setCepMsg('CEP não encontrado. Confira o número ou preencha o endereço manualmente.');
        setD((x) => ({ ...x, address: { ...x.address, ...found } }));
      })
      .catch((err) => { if (err?.name !== 'AbortError') setCepMsg('Não foi possível consultar o CEP agora. Preencha o endereço manualmente.'); });
  };
  const setContact = (id: string, patch: Partial<Contact>) => setD((x) => ({ ...x, contacts: x.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  // ── validação (CTA001: CNPJ inválido ou já cadastrado não salva) ──
  const duplicate = !editing && db.subscribers.some((s) => s.cnpj === onlyDigits(d.cnpj));
  const req = (v: string, field: string) => (tried && !v.trim() ? requiredMessage(field) : undefined);
  const errors = {
    cnpj: editing ? undefined
      : req(d.cnpj, 'CNPJ') ?? (tried && !isValidCnpj(d.cnpj) ? 'Informe um CNPJ válido' : undefined)
        ?? (tried && duplicate ? 'Este CNPJ já está cadastrado em outro assinante' : undefined),
    legalName: req(d.legalName, 'Razão social'),
    tradeName: req(d.tradeName, 'Nome fantasia'),
    cep: req(d.address.cep, 'CEP') ?? (tried && onlyDigits(d.address.cep).length !== 8 ? 'Informe um CEP válido' : undefined),
    street: req(d.address.street, 'Logradouro'),
    number: req(d.address.number, 'Número'),
    district: req(d.address.district, 'Bairro'),
    city: req(d.address.city, 'Cidade'),
    uf: req(d.address.uf, 'UF'),
    plan: req(d.plan, 'Plano / contratação'),
    adminName: editing ? undefined : req(d.admin.name, 'Nome do administrador'),
    adminEmail: editing ? undefined : req(d.admin.email, 'E-mail do administrador') ?? (tried && !isValidEmail(d.admin.email) ? 'Informe um e-mail válido' : undefined),
    adminPhone: editing ? undefined : req(d.admin.phone, 'Telefone do administrador') ?? (tried && !isValidPhone(d.admin.phone) ? 'Informe um telefone válido' : undefined),
  };
  const contactErrors = (c: Contact) => ({
    name: req(c.name, 'Nome'),
    email: req(c.email, 'E-mail') ?? (tried && !isValidEmail(c.email) ? 'Informe um e-mail válido' : undefined),
    phone: tried && c.phone && !isValidPhone(c.phone) ? 'Informe um telefone válido' : undefined,
  });

  // Depois de tentar salvar (erros já renderizados): decide o aviso e leva o foco ao primeiro campo com erro
  useEffect(() => {
    if (!submitTick) return;
    const messages = [...Object.values(errors), ...d.contacts.flatMap((c) => Object.values(contactErrors(c)))].filter(Boolean) as string[];
    if (!messages.length) return;
    const empty = messages.filter((m) => /é obrigatório$/.test(m)).length;
    // só vazios: aviso de obrigatórios · um único erro de outro tipo: só foco no campo · tipos misturados ou vários erros: aviso genérico
    setBanner(messages.length === 1 ? null : empty === messages.length ? 'required' : 'multiple');
    const first = document.querySelector<HTMLElement>('form [aria-invalid="true"]');
    first?.scrollIntoView({ block: 'center' });
    first?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitTick]);

  const validNow = () => {
    // Mesma regra de `errors`, calculada sem depender do estado `tried`.
    const filled = (v: string) => !!v.trim();
    const base = [d.legalName, d.tradeName, d.address.street, d.address.number, d.address.district, d.address.city, d.address.uf, d.plan].every(filled)
      && onlyDigits(d.address.cep).length === 8
      && d.contacts.every((c) => filled(c.name) && isValidEmail(c.email) && (!c.phone || isValidPhone(c.phone)));
    const company = editing ? true : isValidCnpj(d.cnpj) && !duplicate;
    const admin = editing ? true : filled(d.admin.name) && isValidEmail(d.admin.email) && isValidPhone(d.admin.phone);
    return base && company && admin;
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setBanner(null);
    setSubmitTick((n) => n + 1);
    if (!validNow()) return;
    setSaving(true);
    const clean: Draft = { ...d, cnpj: onlyDigits(d.cnpj), address: { ...d.address, cep: onlyDigits(d.address.cep) }, admin: { ...d.admin, phone: onlyDigits(d.admin.phone) }, contacts: d.contacts.map((c) => ({ ...c, phone: onlyDigits(c.phone) })) };
    let id = editing?.id;
    updateDb((db0) => {
      if (editing) return { ...db0, subscribers: db0.subscribers.map((s) => (s.id === editing.id ? { ...s, ...clean } : s)) };
      id = nextId('ASS', db0.subscribers.map((s) => s.id));
      const created: Subscriber = {
        ...clean, id, since: new Date().toISOString().slice(0, 10), units: 0, equipments: 0, maintenanceCents: 0, requests30d: 0, envHistory: [],
      };
      return { ...db0, subscribers: [...db0.subscribers, created] };
    });
    const subName = subscriberName(clean);
    if (!editing) logActivity(me.id, 'Assinantes', 'cadastro', `Cadastrou o assinante ${subName}`);
    else {
      if (clean.status !== editing.status) logActivity(me.id, 'Assinantes', 'edicao', `Alterou o status do assinante ${subName} para ${STATUS_OPTIONS.find((o) => o.value === clean.status)?.label ?? clean.status}`);
      logActivity(me.id, 'Assinantes', 'edicao', `Editou os dados do assinante ${subName}`);
    }
    setFlash(editing
      ? { type: 'success', title: 'Assinante atualizado', message: 'As alterações foram salvas.' }
      : { type: 'success', title: 'Assinante cadastrado', message: 'O ambiente foi criado e o convite de primeiro acesso foi enviado ao administrador indicado.' });
    window.setTimeout(() => goTo(`assinante.html?id=${id}`), 400);
  };

  const cancel = () => goTo(editing ? `assinante.html?id=${editing.id}` : 'assinantes.html');
  const title = editing ? `Editar ${subscriberName(editing)}` : 'Novo assinante';
  const crumbs = [
    { label: 'Assinantes', href: 'assinantes.html' },
    { label: editing ? 'Editar' : 'Novo assinante' },
  ];

  if (editingId && !editing) {
    return (
      <AppLayout active="assinantes" screen="assinantes">
        <Feedback type="error" title="Assinante não encontrado" message="Volte para a listagem e tente novamente." />
      </AppLayout>
    );
  }

  return (
    <AppLayout active="assinantes" screen="assinantes">
      <form className="form-page" onSubmit={onSubmit} onChangeCapture={() => setBanner(null)} noValidate>
        <Stack gap="xl">
          <PageHeader
            title={title}
            breadcrumb={crumbs}
            subtitle={editing ? 'Alterações de dados cadastrais solicitadas pelo assinante são feitas aqui pelo suporte Maglev' : 'Cadastre os dados necessários para configurar o novo assinante'}
          />

          {banner && (
            <div className="floating-feedback">
              {banner === 'required'
                ? <Feedback type="error" title="Preencha os campos obrigatórios" message="Revise os campos destacados para continuar" dismissible onDismiss={() => setBanner(null)} />
                : <Feedback type="error" title="Não foi possível salvar" message="Corrija os campos destacados e tente novamente" dismissible onDismiss={() => setBanner(null)} />}
            </div>
          )}

          <DevNote note="RF202-RGN005: dados sensíveis (CNPJ, razão social, nome, endereço e inscrições) só são alterados pelo Admin Maglev; o assinante edita apenas os contatos. Os dados servem também para a emissão manual da nota fiscal, fora da plataforma (RGN007).">
            <Card className="card-open" title="Dados da empresa" subtitle="Informações cadastrais e fiscais do assinante">
              <div className="card-body-tight">
                <Grid>
                  <Col span={12}><Input label="Nome fantasia" required value={d.tradeName} onChange={(e) => set('tradeName', e.target.value)} error={errors.tradeName} /></Col>
                  <Col span={6}><Input label="Razão social" required value={d.legalName} onChange={(e) => set('legalName', e.target.value)} error={errors.legalName} /></Col>
                  <Col span={6}>
                    {editing ? (
                      <DevNote note="CNPJ não pode ser alterado após o cadastro (RGN001 / CTA003): exibido somente leitura na edição.">
                        <Input label="CNPJ" value={formatCnpj(d.cnpj)} readOnly helperText="Não pode ser alterado após o cadastro" />
                      </DevNote>
                    ) : (
                      <DevNote note="O CNPJ é obrigatório, deve possuir formato válido (dígitos verificadores) e deve ser único na plataforma (CTA001). Máscara 00.000.000/0000-00.">
                        <Input label="CNPJ" required inputMode="numeric" placeholder="00.000.000/0000-00" value={d.cnpj} onChange={(e) => set('cnpj', formatCnpj(e.target.value))} error={errors.cnpj} />
                      </DevNote>
                    )}
                  </Col>
                  <Col span={6}><Input optional label="Inscrição estadual" inputMode="numeric" value={d.stateReg} onChange={(e) => set('stateReg', e.target.value)} /></Col>
                  <Col span={6}><Input optional label="Inscrição municipal" inputMode="numeric" value={d.cityReg} onChange={(e) => set('cityReg', e.target.value)} /></Col>
                </Grid>
              </div>
            </Card>
          </DevNote>

          <DevNote note="Ao completar o CEP (8 dígitos), logradouro, bairro, cidade e estado são preenchidos automaticamente e continuam editáveis; número e complemento são digitados pelo usuário. A consulta usa o ViaCEP (gratuito, sem chave); CEP inexistente ou serviço fora do ar mostra aviso e o endereço é preenchido manualmente. Em produção, avaliar um serviço contratado/SLA.">
          <Card className="card-open" title="Endereço da matriz" subtitle="Endereço principal da empresa">
            <div className="card-body-tight">
              <Grid>
                <Col span={4}><Input label="CEP" required inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={formatCep(d.address.cep)} onChange={(e) => onCep(e.target.value)} error={errors.cep ?? cepMsg} /></Col>
                <Col span={12}><Input label="Logradouro" required autoComplete="address-line1" value={d.address.street} onChange={(e) => setAddr('street', e.target.value)} error={errors.street} /></Col>
                <Col span={6}><Input label="Número" required value={d.address.number} onChange={(e) => setAddr('number', e.target.value)} error={errors.number} /></Col>
                <Col span={6}><Input optional label="Complemento" autoComplete="address-line2" value={d.address.complement} onChange={(e) => setAddr('complement', e.target.value)} /></Col>
                <Col span={12}><Input label="Bairro" required value={d.address.district} onChange={(e) => setAddr('district', e.target.value)} error={errors.district} /></Col>
                <Col span={6}><Input label="Cidade" required autoComplete="address-level2" value={d.address.city} onChange={(e) => setAddr('city', e.target.value)} error={errors.city} /></Col>
                <Col span={6}><Dropdown label="Estado" required options={UFS.map((u) => ({ value: u, label: u }))} value={d.address.uf} onChange={(v) => setAddr('uf', v)} error={errors.uf} /></Col>
              </Grid>
            </div>
          </Card>
          </DevNote>

          <Card className="card-open" title="Contratação">
            <div className="card-body-tight">
              <Grid>
                <Col span={editing ? 4 : 6}>
                  <DevNote note="Campo informativo (P01): não há cobrança nem pagamento na plataforma (RGN002). Alterações de plano são feitas pelo suporte neste cadastro (RGN003). Planos com limites são FE012 (fora do escopo).">
                    <Dropdown label="Plano / contratação" required options={PLANS.map((p) => ({ value: p, label: p }))} value={d.plan} onChange={(v) => set('plan', v)} error={errors.plan} />
                  </DevNote>
                </Col>
                <Col span={editing ? 4 : 6}>
                  <DevNote note="💡 Citada pela cliente em 28/09 - a confirmar se é informativa ou se limita o cadastro de unidades (FE012). No protótipo, informativa e opcional.">
                    <Input optional label="Unidades contratadas" inputMode="numeric" value={d.contractedUnits} onChange={(e) => set('contractedUnits', onlyDigits(e.target.value))} />
                  </DevNote>
                </Col>
                {editing && (
                  <Col span={editing ? 4 : 6}>
                    {d.status === 'inativo' ? (
                      <ReadField label="Status do assinante" value="Inativo - use “Ativar ambiente” no detalhe" />
                    ) : (
                      <DevNote note="Status alterado manualmente (RF201-RGN002). Inativo não aparece aqui: inativar é a ação “Inativar ambiente” (RF204), que pede confirmação e motivo e bloqueia usuários e QR Codes.">
                        <RadioButton name="status" label="Status do assinante" orientation="horizontal" options={STATUS_OPTIONS} value={d.status} onChange={(v) => set('status', v as SubscriberStatus)} />
                      </DevNote>
                    )}
                  </Col>
                )}
              </Grid>
            </div>
          </Card>

          {editing ? (
            <Card className="card-open" title="Administrador do assinante" subtitle="Recebeu o convite de primeiro acesso. Depois do cadastro, os usuários são gerenciados pelo próprio assinante">
              <div className="card-body-tight">
                <Grid>
                  <Col span={12}><ReadField label="Nome" value={d.admin.name} /></Col>
                  <Col span={6}><ReadField label="E-mail" value={d.admin.email} /></Col>
                  <Col span={6}><ReadField label="Telefone" value={formatPhone(d.admin.phone)} /></Col>
                </Grid>
              </div>
            </Card>
          ) : (
            <DevNote note="Ao salvar, o sistema cria o ambiente do assinante e envia o convite de primeiro acesso a este administrador (FLU004 / CTA002 → Assinante RF003). 💡 Sugestão RGN004: e-mail único na plataforma.">
              <Card className="card-open" title="Administrador do assinante" subtitle="Administrador principal que receberá o primeiro acesso ao ambiente">
                <div className="card-body-tight">
                  <Grid>
                    <Col span={12}><Input label="Nome" required autoComplete="off" value={d.admin.name} onChange={(e) => setAdmin('name', e.target.value)} error={errors.adminName} /></Col>
                    <Col span={6}><Input label="E-mail" required type="email" autoComplete="off" value={d.admin.email} onChange={(e) => setAdmin('email', e.target.value)} error={errors.adminEmail} /></Col>
                    <Col span={6}><Input label="Telefone" required type="tel" autoComplete="off" value={formatPhone(d.admin.phone)} onChange={(e) => setAdmin('phone', e.target.value)} error={errors.adminPhone} /></Col>
                  </Grid>
                </div>
              </Card>
            </DevNote>
          )}

          <DevNote note="Contatos por área (1..N), inclusive pessoas sem acesso ao sistema - “para saber com quem falar” (CTA005). Área, nome e e-mail obrigatórios; telefone opcional (💡 a confirmar). Contatos alterados pelo assinante aparecem atualizados aqui (CTA004).">
            <Card className="card-open" title="Contatos" subtitle="Pessoas de referência para contato em diferentes áreas do assinante">
              <div className="card-body-tight">
                <Stack gap="lg">
                  {d.contacts.map((c, i) => {
                    const err = contactErrors(c);
                    return (
                      <Card key={c.id} className="card-open contact-card">
                        <Stack gap="md">
                          <Stack direction="horizontal" justify="between" align="center">
                            <h3 className="page-label">{`Contato ${i + 1}`}</h3>
                            {d.contacts.length > 1 && (
                              <Button variant="ghost" size="sm" iconLeft={<IconTrash size={16} />} aria-label={`Remover contato ${i + 1}`} onClick={() => set('contacts', d.contacts.filter((x) => x.id !== c.id))}>Remover</Button>
                            )}
                          </Stack>
                          <Grid>
                            <Col span={12}><Input label="Nome" required autoComplete="off" value={c.name} onChange={(e) => setContact(c.id, { name: e.target.value })} error={err.name} /></Col>
                            <Col span={12}><Dropdown label="Área" required options={CONTACT_AREAS} value={c.area} onChange={(v) => setContact(c.id, { area: v as ContactArea })} /></Col>
                            <Col span={6}><Input label="E-mail" required type="email" autoComplete="off" value={c.email} onChange={(e) => setContact(c.id, { email: e.target.value })} error={err.email} /></Col>
                            <Col span={6}><Input optional label="Telefone" type="tel" autoComplete="off" value={formatPhone(c.phone)} onChange={(e) => setContact(c.id, { phone: e.target.value })} error={err.phone} /></Col>
                          </Grid>
                        </Stack>
                      </Card>
                    );
                  })}
                  <Stack direction="horizontal">
                    <Button variant="ghost" size="sm" iconLeft={<IconPlus size={16} />} onClick={() => set('contacts', [...d.contacts, blankContact('outro')])}>Adicionar contato</Button>
                  </Stack>
                </Stack>
              </div>
            </Card>
          </DevNote>

          <Stack direction="horizontal" justify="start" gap="sm" wrap>
            {editing ? (
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</Button>
            ) : (
              <DevNote note="A data de cadastro (cliente desde) é registrada automaticamente ao salvar.">
                <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar assinante'}</Button>
              </DevNote>
            )}
            <Button variant="secondary" onClick={cancel} disabled={saving}>Cancelar</Button>
          </Stack>
        </Stack>
      </form>
    </AppLayout>
  );
}

mountApp(<AssinanteFormScreen />);
