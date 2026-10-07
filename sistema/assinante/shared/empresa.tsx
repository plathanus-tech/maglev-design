import { FormEvent, useEffect, useState } from 'react';
import { IconBrandWhatsapp, IconExternalLink, IconPencil } from '@tabler/icons-react';
import { Button, Card, Dialog, Dropdown, Input, Stack, Table, TableColumn, useToast } from '@maglev/ds';
import { CONTACT_AREAS, Contact, ContactArea, contactAreaLabel } from '../../admin/shared/data';
import { updateDb as updateAdminDb } from '../../admin/shared/store';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useHashState } from '../../admin/shared/useHashState';
import { MobileCardList } from '../../admin/shared/MobileCardList';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { formatCep, formatCnpj, formatDate, formatPhone, isValidEmail, isValidPhone, noBreak, onlyDigits, requiredMessage } from '../../admin/shared/format';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { useSubSession } from './store';
import { Col, Grid, ReadField } from './ui';

import './empresa.css';

/** 💡 Número do suporte Maglev: placeholder (não aparece na tela, só no link). */
const SUPPORT_WHATSAPP = `https://wa.me/5548999990000?text=${encodeURIComponent('Olá! Gostaria de falar sobre meu plano na Maglev.')}`;

/** Estados: idle · edit (modal Editar contato) · required (modal com e-mail vazio e erro) */
const STATES = ['idle', 'edit', 'required'] as const;
type Mode = (typeof STATES)[number];

type ContactRow = Record<string, unknown> & Contact;
const FORM_ID = 'contact-form';

/** Modal Editar contato: Área e Nome só leitura; editáveis apenas E-mail e Telefone (opcional, com máscara). */
function ContactDialog({ contact, forceErrors, onClose, onSave }: { contact: Contact; forceErrors?: boolean; onClose: () => void; onSave: (c: Contact) => void }) {
  const [email, setEmail] = useState(forceErrors ? '' : contact.email);
  const [phone, setPhone] = useState(contact.phone ? formatPhone(contact.phone) : '');
  const [tried, setTried] = useState(!!forceErrors);
  const errors = {
    email: !email.trim() ? requiredMessage('E-mail') : !isValidEmail(email) ? 'Informe um e-mail válido' : undefined,
    phone: phone && !isValidPhone(phone) ? 'Informe um telefone válido' : undefined,
  };
  const show = (k: keyof typeof errors) => (tried ? errors[k] : undefined);
  const focusFirstError = () => window.setTimeout(() => document.querySelector<HTMLElement>(`#${FORM_ID} [aria-invalid="true"]`)?.focus(), 0);

  useEffect(() => { if (forceErrors) focusFirstError(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.values(errors).some(Boolean)) { focusFirstError(); return; }
    onSave({ ...contact, email: email.trim(), phone: onlyDigits(phone) });
  };

  return (
    <Dialog
      open onClose={onClose} size="md" title="Editar contato"
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button size="sm" type="submit" form={FORM_ID}>Salvar alterações</Button>
        </>
      )}
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <Stack gap="md">
          <ReadField label="Nome" value={contact.name} />
          <ReadField label="Área" value={contactAreaLabel(contact.area)} />
          <Input label="E-mail" required type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} error={show('email')} />
          <Input optional label="Telefone" type="tel" autoComplete="off" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} error={show('phone')} />
        </Stack>
      </form>
    </Dialog>
  );
}

function EmpresaScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const { company, can } = useSubSession();
  const editable = can('empresa', 'editar');
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const contacts = company.contacts;
  const [dialog, setDialog] = useState<{ contact: Contact; forceErrors?: boolean } | null>(null);

  // Variantes do navegador
  useEffect(() => {
    if (!editable) return;
    const first = contacts.find((c) => c.area === 'financeiro') ?? contacts[0];
    if (first && mode === 'edit') setDialog({ contact: first });
    if (first && mode === 'required') setDialog({ contact: first, forceErrors: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // CTA002: os contatos salvos aqui são os mesmos que o Admin vê (Admin RF202/RF203); a alteração vale na hora
  const persist = (next: Contact[], title: string, message: string) => {
    updateAdminDb((d) => ({ ...d, subscribers: d.subscribers.map((s) => (s.id === company.id ? { ...s, contacts: next } : s)) }));
    toast.show({ type: 'success', title, message });
  };
  const save = (c: Contact) => {
    persist(contacts.map((x) => (x.id === c.id ? c : x)), 'Contato atualizado', 'As alterações foram salvas');
    setDialog(null);
  };

  const a = company.address;
  // Só há uma ação (Editar): direto na linha, sem menu
  const rowAction = (c: Contact) => (
        <Button variant="ghost" size="sm" iconLeft={<IconPencil size={16} />} aria-label={`Editar contato ${c.name}`} onClick={() => setDialog({ contact: c })}>Editar</Button>
  );
  const columns: TableColumn<ContactRow>[] = [
    { key: 'name', label: 'Nome' },
    { key: 'area', label: 'Área', render: (v) => contactAreaLabel(v as ContactArea) },
    { key: 'email', label: 'E-mail' },
    { key: 'phone', label: 'Telefone', render: (v) => (v ? noBreak(formatPhone(String(v))) : '-') },
    ...(editable ? [{ key: 'id', label: 'Ação', sticky: 'right' as const, render: (_: unknown, r: ContactRow) => rowAction(r) }] : []),
  ];
  const subtitle = 'Pessoas de referência para contato em diferentes áreas da empresa. Este cadastro não concede acesso à plataforma';

  return (
    <AppLayout active="empresa" screen="empresa">
      <Stack gap="xl">
        <PageHeader title="Empresa" subtitle="Dados cadastrais e contatos da sua empresa" />

        <DevNote note="RF201-FLU002 / CTA001: dados cadastrais sem opção de edição; FLU004 / RGN003: a orientação de falar com o suporte Maglev para alterar fica no subtítulo (texto exato a confirmar), sem alerta. RGN001: CNPJ não é editável. RGN004: o cadastro da empresa é feito pela implantação MAGLEV; o assinante gerencia o que está abaixo (unidades, ambientes, equipamentos).">
          <Card className="card-open" title="Dados da empresa" subtitle="Informações cadastrais e fiscais. Para alterações, fale com o suporte Maglev">
            <div className="card-body-tight">
              <Grid>
                <Col span={12}><ReadField label="Nome fantasia" value={company.tradeName} /></Col>
                <Col span={6}><ReadField label="Razão social" value={company.legalName} /></Col>
                <Col span={6}><ReadField label="CNPJ" value={formatCnpj(company.cnpj)} /></Col>
                <Col span={6}><ReadField label="Inscrição estadual" value={company.stateReg} /></Col>
                <Col span={6}><ReadField label="Inscrição municipal" value={company.cityReg} /></Col>
              </Grid>
            </div>
          </Card>
        </DevNote>

        <Card className="card-open" title="Endereço da matriz" subtitle="Endereço principal da empresa">
          <div className="card-body-tight">
            <Grid>
              <Col span={4}><ReadField label="CEP" value={formatCep(a.cep)} /></Col>
              <Col span={12}><ReadField label="Logradouro" value={a.street} /></Col>
              <Col span={6}><ReadField label="Número" value={a.number} /></Col>
              <Col span={6}><ReadField label="Complemento" value={a.complement} /></Col>
              <Col span={12}><ReadField label="Bairro" value={a.district} /></Col>
              <Col span={6}><ReadField label="Cidade" value={a.city} /></Col>
              <Col span={6}><ReadField label="Estado" value={a.uf} /></Col>
            </Grid>
          </div>
        </Card>

        <DevNote note="Plano/contratação é informativo e somente leitura; alteração via suporte Maglev (RF201). Limites por plano são FE012 (fora do escopo). O link “Falar com o suporte” abre o WhatsApp do suporte em nova aba, com mensagem inicial pré-preenchida; o número não aparece no texto da página. 💡 Número do WhatsApp do suporte a definir (placeholder).">
          <Card
            className="card-open" title="Plano e contratação" subtitle="Alterações de plano são realizadas pelo suporte Maglev"
            actions={(
              <a className="support-link" href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer">
                <IconBrandWhatsapp size={16} aria-hidden="true" />
                Falar com o suporte
                <IconExternalLink size={14} aria-hidden="true" />
                <span className="sr-only"> (abre o WhatsApp em uma nova aba)</span>
              </a>
            )}
          >
            <div className="card-body-tight">
              <Grid>
                <Col span={4}><ReadField label="Plano" value={company.plan} /></Col>
                <Col span={4}><ReadField label="Unidades contratadas" value={company.contractedUnits} /></Col>
                <Col span={4}><ReadField label="Cliente desde" value={formatDate(company.since)} /></Col>
              </Grid>
            </div>
          </Card>
        </DevNote>

        <DevNote note="RF201-FLU003 / RGN002: o assinante só atualiza o e-mail e o telefone dos contatos já cadastrados por tipo (Área e Nome são só leitura; não há criar nem excluir contatos nesta tela). Só o Administrador edita; salvar reflete no Admin (CTA002). E-mail obrigatório; telefone opcional (💡 a confirmar, igual ao Admin). O Admin continua gerenciando os contatos na edição geral do assinante.">
        {isMobile ? (
          <MobileCardList
            headingId="contacts-title" title="Contatos" subtitle={subtitle} emptyTitle="Nenhum contato cadastrado"
            page={1} pageSize={contacts.length || 1} total={contacts.length} onPageChange={() => undefined}
            items={contacts.map((c) => ({
              id: c.id, title: c.name, subtitle: contactAreaLabel(c.area),
              fields: [{ label: 'E-mail', value: c.email }, { label: 'Telefone', value: c.phone ? noBreak(formatPhone(c.phone)) : '-' }],
              actions: editable ? rowAction(c) : undefined,
            }))}
          />
        ) : (
          <Table<ContactRow> title="Contatos" subtitle={subtitle} columns={columns} rows={contacts as ContactRow[]} empty={{ title: 'Nenhum contato cadastrado' }} />
        )}
        </DevNote>
      </Stack>

      {dialog && <ContactDialog contact={dialog.contact} forceErrors={dialog.forceErrors} onClose={() => setDialog(null)} onSave={save} />}
    </AppLayout>
  );
}

mountApp(<EmpresaScreen />);
