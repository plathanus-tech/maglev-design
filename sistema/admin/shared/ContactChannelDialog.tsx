import { useState } from 'react';
import { Button, Checkbox, Dialog, Input, Stack, useToast } from '@maglev/ds';
import { DevNote } from './dev-notes/DevNote';
import { PHONE_INVALID_MESSAGE, formatPhone, isValidPhone, onlyDigits } from './format';

export interface ContactChoice { phone: string; notifyEmail: boolean; notifyWhatsapp: boolean }

/**
 * Orientação do primeiro acesso sobre o canal de avisos: o WhatsApp é o canal principal, então a pessoa confere (ou atualiza) o número cadastrado,
 * pode escolher também o e-mail e vê para quais avisos o contato será usado. O envio por WhatsApp só é considerado homologado depois do teste de
 * comunicação da auditoria, (isso fica só na nota para o desenvolvimento, não na tela). Compartilhado entre o Admin e a Área do assinante (cada um grava no seu cadastro).
 */
export function ContactChannelDialog({ initial, email, notices, onSave, onClose }: {
  initial: ContactChoice;
  email: string;
  /** Avisos para os quais o contato é usado (texto curto, sem ponto final). */
  notices: string[];
  onSave: (c: ContactChoice) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [phone, setPhone] = useState(formatPhone(initial.phone));
  const [viaEmail, setViaEmail] = useState(initial.notifyEmail);
  // No primeiro acesso o WhatsApp já vem marcado (canal principal); a pessoa pode desmarcar
  const [viaWhatsapp, setViaWhatsapp] = useState(true);
  const [error, setError] = useState('');

  const save = () => {
    if (viaWhatsapp && !isValidPhone(phone)) { setError(phone.trim() ? PHONE_INVALID_MESSAGE : 'O campo Celular é obrigatório para receber avisos pelo WhatsApp'); return; }
    if (phone.trim() && !isValidPhone(phone)) { setError(PHONE_INVALID_MESSAGE); return; }
    onSave({ phone: onlyDigits(phone), notifyEmail: viaEmail, notifyWhatsapp: viaWhatsapp });
    toast.show({ type: 'success', title: 'Contato confirmado', message: 'Suas preferências de aviso foram salvas' });
    onClose();
  };

  return (
    <Dialog
      sheet open onClose={onClose} size="md"
      title="Como você quer receber os avisos"
      subtitle="O WhatsApp é o canal principal de atualizações. Confira seu número e escolha os canais"
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Agora não</Button>
          <Button size="sm" onClick={save}>Confirmar contato</Button>
        </>
      )}
    >
      <Stack gap="lg">
        <DevNote note="Pedido do cliente: como o WhatsApp é o canal principal, o primeiro acesso orienta e deixa conferir/atualizar o telefone, explicando para quais avisos o contato é usado. O número gravado é o do cadastro (editável aqui). Os canais são os mesmos das preferências de notificação (E-mail e WhatsApp; a plataforma é sempre ativa). O envio por WhatsApp só é considerado homologado quando o teste de comunicação da auditoria for aprovado (decisão de desenvolvimento, sem aviso na tela); até lá os avisos seguem por e-mail e na plataforma. Em desenvolvimento: abrir no primeiro acesso, uma vez por usuário.">
          <Input
            label="Celular (WhatsApp)" type="tel" autoComplete="tel" placeholder="(00) 00000-0000"
            value={phone} onChange={(e) => { setPhone(formatPhone(e.target.value)); setError(''); }}
            error={error || undefined}
            helperText="Número cadastrado para você. Se mudou, atualize aqui"
          />
        </DevNote>
        <Stack gap="sm">
          <Checkbox label="WhatsApp (canal principal)" checked={viaWhatsapp} onChange={(e) => { setViaWhatsapp(e.target.checked); setError(''); }} />
          <Checkbox label={`E-mail (${email})`} checked={viaEmail} onChange={(e) => setViaEmail(e.target.checked)} />
          <Checkbox label="Plataforma (sino de notificações)" checked disabled />
        </Stack>
        <Stack gap="xs">
          <span className="page-label">Usaremos o contato para avisar sobre</span>
          <ul className="page-text contact-notices">{notices.map((n) => <li key={n}>{n}</li>)}</ul>
        </Stack>
      </Stack>
    </Dialog>
  );
}
