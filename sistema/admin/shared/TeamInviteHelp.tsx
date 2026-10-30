import { useState } from 'react';
import { Button, Dialog, Stack } from '@maglev/ds';

/**
 * Orientação de quem ainda não tem acesso: não há cadastro público, o acesso vem por convite do administrador.
 * Link de texto sob o login que abre o modal "Entrando para uma equipe" (`open` controla a abertura inicial, para a variante do navegador).
 */
export function TeamInviteHelp({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <Stack gap="2xs" align="center">
        <span className="page-text page-text--center">Faz parte de uma equipe?</span>
        <Button variant="ghost" size="sm" className="auth-help-link" onClick={() => setOpen(true)} aria-haspopup="dialog">Solicite um convite ao administrador</Button>
      </Stack>
      {open && (
        <Dialog sheet open onClose={() => setOpen(false)} size="sm" title="Entrando para uma equipe" actions={<Button onClick={() => setOpen(false)}>Entendi</Button>}>
          <Stack gap="md">
            <p className="page-text">Se você for membro de uma equipe, sua empresa enviará um convite para você participar.</p>
            <p className="page-text">Não recebeu um convite? Solicite um ao seu administrador.</p>
          </Stack>
        </Dialog>
      )}
    </>
  );
}
