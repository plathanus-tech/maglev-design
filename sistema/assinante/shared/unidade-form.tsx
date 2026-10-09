import { FormEvent, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Dropdown, Feedback, Input, RadioButton, Stack } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useHashState } from '../../admin/shared/useHashState';
import { lookupCep } from '../../admin/shared/cep';
import { UFS, formatCep, formatPhone, isValidPhone, normalize, onlyDigits, requiredMessage } from '../../admin/shared/format';
import { RecordStatus } from '../../admin/shared/data';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { Unit } from './data';
import { nextSeq, updateSubDb, userName, useSubSession } from './store';
import { useFormFeedback } from './estrutura-utils';
import { Col, Grid, ReadField, goTo, param, setFlash } from './ui';

/** Estados: idle · required (um só campo obrigatório vazio: foco direto, sem aviso) · requiredmany (vários campos obrigatórios vazios: aviso no topo) · duplicate (nome de unidade já existente) */
const STATES = ['idle', 'required', 'requiredmany', 'duplicate'] as const;
type Mode = (typeof STATES)[number];

type Draft = Omit<Unit, 'id' | 'managerId'> & { managerId: string };
const BLANK: Draft = { name: '', code: '', cep: '', street: '', number: '', district: '', city: '', uf: '', managerId: '', phone: '', status: 'ativo' };
const NONE = '__none';

function UnidadeFormScreen() {
  const { db, can } = useSubSession();
  const editingId = param('id');
  const editing = db.units.find((u) => u.id === editingId);
  // Quem só visualiza não edita: vai para a tela de visualização (unidade.html)
  const readOnly = !!editing && !can('unidades', 'editar');
  useEffect(() => { if (readOnly && editing) window.location.replace(`unidade.html?id=${editing.id}`); }, [readOnly, editing]);
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [d, setD] = useState<Draft>(() => (editing ? { ...BLANK, ...editing, managerId: editing.managerId ?? '' } : BLANK));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  // CEP completo consulta o ViaCEP e preenche logradouro, bairro, cidade e UF (continuam editáveis) - mesmo padrão do Admin
  const [cepMsg, setCepMsg] = useState<string>();
  const cepAbort = useRef<AbortController>();
  const onCep = (v: string) => {
    set('cep', onlyDigits(v).slice(0, 8));
    setCepMsg(undefined);
    cepAbort.current?.abort();
    if (onlyDigits(v).length !== 8) return;
    const ctl = new AbortController();
    cepAbort.current = ctl;
    lookupCep(v, ctl.signal)
      .then((found) => {
        if (!found) return setCepMsg('CEP não encontrado. Confira o número ou preencha o endereço manualmente');
        setD((x) => ({ ...x, ...found }));
      })
      .catch((err) => { if (err?.name !== 'AbortError') setCepMsg('Não foi possível consultar o CEP agora. Preencha o endereço manualmente'); });
  };

  const req = (v: string, field: string) => (tried && !v.trim() ? requiredMessage(field) : undefined);
  // 💡 A confirmar: a especificação não define unicidade do nome da unidade; aqui o nome é único por assinante (sem diferenciar maiúsculas e acentos)
  const duplicate = !!d.name.trim() && db.units.some((u) => u.id !== editing?.id && normalize(u.name) === normalize(d.name));
  const errors = {
    name: req(d.name, 'Nome da unidade') ?? (tried && duplicate ? 'Já existe uma unidade com este nome' : undefined),
    cep: req(d.cep, 'CEP') ?? (tried && d.cep.length !== 8 ? 'Informe um CEP válido' : undefined),
    street: req(d.street, 'Logradouro'),
    number: req(d.number, 'Número'),
    district: req(d.district, 'Bairro'),
    city: req(d.city, 'Cidade'),
    uf: req(d.uf, 'Estado'),
    phone: tried && d.phone && !isValidPhone(d.phone) ? 'Informe um telefone válido' : undefined,
  };
  const feedback = useFormFeedback(Object.values(errors));
  const invalid = !d.name.trim() || duplicate || d.cep.length !== 8 || !d.street.trim() || !d.number.trim() || !d.district.trim() || !d.city.trim() || !d.uf || (!!d.phone && !isValidPhone(d.phone));

  useEffect(() => {
    if (editing || mode === 'idle') return;
    const filled = { cep: '03101001', street: 'Rua da Mooca', number: '1200', district: 'Mooca', city: 'São Paulo', uf: 'SP' };
    if (mode === 'required') setD((x) => ({ ...x, ...filled }));
    if (mode === 'duplicate') setD((x) => ({ ...x, ...filled, name: db.units[0]?.name ?? 'Cantina Dona Rosa Beira-Mar' }));
    setTried(true);
    feedback.submitted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setTried(true);
    feedback.submitted();
    if (invalid) return;
    setSaving(true);
    const { managerId, ...rest } = d;
    const data = { ...rest, name: d.name.trim(), code: d.code.trim(), phone: onlyDigits(d.phone), ...(managerId ? { managerId } : { managerId: undefined }) };
    updateSubDb((db0) => (editing
      ? { ...db0, units: db0.units.map((u) => (u.id === editing.id ? { ...u, ...data } : u)) }
      : { ...db0, units: [...db0.units, { ...data, id: nextSeq('UNI', db0.units.map((u) => u.id), 3) }] }));
    // CTA001: a unidade cadastrada já fica disponível para ambientes, equipamentos e usuários
    setFlash(editing
      ? { type: 'success', title: 'Unidade atualizada', message: 'As alterações foram salvas' }
      : { type: 'success', title: 'Unidade cadastrada', message: 'Ela já está disponível para ambientes, equipamentos e usuários' });
    window.setTimeout(() => goTo('unidades.html'), 400);
  };

  if (editingId && !editing) {
    return (
      <AppLayout active="unidades" screen="unidades">
        <Feedback type="error" title="Unidade não encontrada" message="Volte para a listagem e tente novamente" />
      </AppLayout>
    );
  }

  const managers = [{ value: NONE, label: 'Sem responsável' }, ...db.users
    .filter((u) => u.status === 'ativo' || u.id === editing?.managerId)
    .map((u) => ({ value: u.id, label: u.name }))];
  const title = editing ? `Editar ${editing.name}` : 'Nova unidade';
  const crumbs = [{ label: 'Unidades', href: 'unidades.html' }, { label: editing ? 'Editar' : 'Nova unidade' }];

  return (
    <AppLayout active="unidades" screen="unidades">
      <form className="form-page" onSubmit={onSubmit} onChangeCapture={feedback.clear} noValidate>
        <Stack gap="xl">
          <PageHeader
            title={title} breadcrumb={crumbs}
            subtitle={editing ? undefined : 'Adicione uma nova unidade à sua empresa'}
          />
          {feedback.node}

          {!readOnly && (
            <>
              <DevNote note="RF202: nome e status obrigatórios; código interno e telefone opcionais. 💡 Nome único por assinante (a especificação não define a unicidade: a confirmar); duplicado não salva e mostra o erro no campo. Responsável/gestor é um usuário do assinante (RF204) - só usuários ativos são ofertados.">
                <Card className="card-open" title="Dados da unidade" subtitle="Como a unidade aparece nas listagens e solicitações">
                  <div className="card-body-tight">
                    <Grid>
                      <Col span={12}><Input label="Nome da unidade" required autoComplete="off" placeholder="Ex.: Cantina Dona Rosa Mooca" value={d.name} onChange={(e) => set('name', e.target.value)} error={errors.name} /></Col>
                      <Col span={6}><Input optional label="Código interno" autoComplete="off" value={d.code} onChange={(e) => set('code', e.target.value)} /></Col>
                      <Col span={6}><Input optional label="Telefone" type="tel" autoComplete="off" placeholder="(00) 0000-0000" value={formatPhone(d.phone)} onChange={(e) => set('phone', e.target.value)} error={errors.phone} /></Col>
                      <Col span={12}>
                        <Dropdown optional label="Responsável / gestor da unidade" options={managers} value={d.managerId || NONE} onChange={(v) => set('managerId', v === NONE ? '' : v)} />
                      </Col>
                      <Col span={12}>
                        {editing ? (
                          <RadioButton name="status" label="Status" orientation="horizontal" options={[{ value: 'ativo', label: 'Ativa' }, { value: 'inativo', label: 'Inativa' }]} value={d.status} onChange={(v) => set('status', v as RecordStatus)} />
                        ) : (
                          <ReadField label="Status" value={<Badge status="success" dot>Ativa</Badge>} />
                        )}
                      </Col>
                    </Grid>
                  </div>
                </Card>
              </DevNote>

              <DevNote note="RF202: endereço completo obrigatório (💡 a confirmar a obrigatoriedade). Ao completar o CEP, logradouro, bairro, cidade e estado são preenchidos pelo ViaCEP e continuam editáveis; CEP inexistente ou serviço fora do ar pede preenchimento manual (mesmo comportamento do Admin).">
                <Card className="card-open" title="Endereço" subtitle="Onde a unidade funciona">
                  <div className="card-body-tight">
                    <Grid>
                      <Col span={4}><Input label="CEP" required inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={formatCep(d.cep)} onChange={(e) => onCep(e.target.value)} error={errors.cep ?? cepMsg} /></Col>
                      <Col span={12}><Input label="Logradouro" required autoComplete="address-line1" value={d.street} onChange={(e) => set('street', e.target.value)} error={errors.street} /></Col>
                      <Col span={6}><Input label="Número" required value={d.number} onChange={(e) => set('number', e.target.value)} error={errors.number} /></Col>
                      <Col span={6}><Input label="Bairro" required value={d.district} onChange={(e) => set('district', e.target.value)} error={errors.district} /></Col>
                      <Col span={6}><Input label="Cidade" required autoComplete="address-level2" value={d.city} onChange={(e) => set('city', e.target.value)} error={errors.city} /></Col>
                      <Col span={6}><Dropdown label="Estado" required options={UFS.map((u) => ({ value: u, label: u }))} value={d.uf} onChange={(v) => set('uf', v)} error={errors.uf} /></Col>
                    </Grid>
                  </div>
                </Card>
              </DevNote>
            </>
          )}

          <Stack direction="horizontal" justify="start" gap="sm" wrap>
            {!readOnly && <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar unidade'}</Button>}
            <Button variant="secondary" disabled={saving} onClick={() => goTo('unidades.html')}>Cancelar</Button>
          </Stack>
        </Stack>
      </form>
    </AppLayout>
  );
}

mountApp(<UnidadeFormScreen />);
