import { useState } from 'react';
import { IconCircle, IconCircleCheck, IconEye, IconEyeOff } from '@tabler/icons-react';
import { Button, Dialog, Input, Stack, useToast } from '@maglev/ds';
import { DevNote } from './dev-notes/DevNote';
import { requiredMessage } from './format';
import { PASSWORD_CRITERIA, getPrototypePassword, setPrototypePassword } from './recovery';
import { logActivity, useSession } from './store';

/**
 * Alteração da própria senha (edição da própria conta em Usuários): senha atual, nova senha e confirmação.
 * Modal, porque é uma ação curta e pontual dentro de uma tela que já tem outro "Salvar" (não mistura os dois fluxos).
 */
export function ChangePasswordDialog({ onClose, onSaved, successMessage = 'Use a nova senha no próximo acesso ao painel' }: {
  onClose: () => void;
  /** Quando informado, substitui o registro de atividade do Admin (ex.: Área do assinante). */
  onSaved?: () => void;
  successMessage?: string;
}) {
  const toast = useToast();
  const { user: me } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [tried, setTried] = useState(false);

  const met = PASSWORD_CRITERIA.map((c) => c.test(next));
  const allMet = met.every(Boolean);
  const errors = {
    current: !current ? requiredMessage('Senha atual') : current !== getPrototypePassword() ? 'A senha atual está incorreta' : undefined,
    next: !next ? requiredMessage('Nova senha')
      : !allMet ? 'A senha não atende a todos os critérios'
      : next === current ? 'A nova senha deve ser diferente da senha atual' : undefined,
    confirm: !confirm ? requiredMessage('Confirmar nova senha') : confirm !== next ? 'As senhas informadas não coincidem' : undefined,
  };
  const invalid = Object.values(errors).some(Boolean);

  const eye = (key: keyof typeof show, name: string) => ({
    icon: show[key] ? <IconEyeOff size={20} /> : <IconEye size={20} />,
    label: show[key] ? `Ocultar ${name}` : `Mostrar ${name}`,
    pressed: show[key],
    onClick: () => setShow((s) => ({ ...s, [key]: !s[key] })),
  });

  const save = () => {
    setTried(true);
    if (invalid) return;
    setPrototypePassword(next);
    if (onSaved) onSaved(); else logActivity(me.id, 'Usuários', 'edicao', 'Alterou a própria senha');
    toast.show({ type: 'success', title: 'Senha alterada', message: successMessage });
    onClose();
  };

  return (
    <Dialog
      open onClose={onClose} title="Alterar senha"
      actions={<><Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button><Button size="sm" onClick={save}>Alterar senha</Button></>}
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <Stack gap="md">
          <DevNote note="Alteração da própria senha: exige a senha atual (protótipo: a senha vigente, Maglev@123 ou a criada na recuperação), uma nova senha dentro da política (RF002-RGN003 / RNF019) e a confirmação. Não é exibida nenhuma senha armazenada.">
            <Input
              label="Senha atual" required autoFocus type={show.current ? 'text' : 'password'} autoComplete="current-password"
              value={current} onChange={(e) => setCurrent(e.target.value)} error={tried ? errors.current : undefined}
              iconRightAction={eye('current', 'senha atual')}
            />
          </DevNote>
          <Stack gap="sm">
            <Input
              label="Nova senha" required type={show.next ? 'text' : 'password'} autoComplete="new-password"
              value={next} onChange={(e) => setNext(e.target.value)} error={tried ? errors.next : undefined}
              iconRightAction={eye('next', 'nova senha')}
            />
            <ul className="pwd-criteria" aria-label="Critérios da senha">
              {PASSWORD_CRITERIA.map((c, i) => (
                <li key={c.id} className={`pwd-criteria-item${met[i] ? ' is-met' : tried && !allMet ? ' is-unmet-error' : ''}`}>
                  {met[i] ? <IconCircleCheck size={16} aria-hidden="true" /> : <IconCircle size={16} aria-hidden="true" />}
                  <span>{c.label}</span>
                  <span className="sr-only">{met[i] ? ' (atendido)' : ' (não atendido)'}</span>
                </li>
              ))}
            </ul>
          </Stack>
          <Input
            label="Confirmar nova senha" required type={show.confirm ? 'text' : 'password'} autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} error={tried ? errors.confirm : undefined}
            iconRightAction={eye('confirm', 'confirmação de senha')}
          />
        </Stack>
      </form>
    </Dialog>
  );
}
