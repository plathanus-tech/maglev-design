import { useState } from 'react';
import { Button, Dialog, Feedback, Stack } from '@maglev/ds';
import { DevNote } from './dev-notes/DevNote';
import { Col, Grid, ReadField } from './ui';

/**
 * Sessão única do Admin: uma conta só pode estar conectada em uma sessão por vez. Quem entra com a conta já aberta em outro lugar vê este modal,
 * que não pode ser fechado; o painel fica atrás, bem desfocado e inacessível, até a pessoa escolher: encerrar a outra sessão e seguir aqui
 * ou voltar para a sessão que já está ativa.
 */
export function SessionConflictModal({ device, since, onContinueHere }: { device: string; since: string; onContinueHere: () => void }) {
  const [keptOther, setKeptOther] = useState(false);

  if (keptOther) {
    return (
      <Dialog
        open dismissible={false} onClose={() => undefined} size="md" sheet className="session-dialog"
        title="Você continua na outra sessão"
        subtitle="Esta entrada foi interrompida. Volte para a sessão que já está ativa para continuar usando o painel"
        actions={<Button size="sm" onClick={() => { window.location.href = 'login.html'; }}>Voltar ao login</Button>}
      >
        <Feedback type="info" title="Sessão ativa" message={`Ela está aberta em ${device}`} />
      </Dialog>
    );
  }

  return (
    <DevNote note="Sessão única (Admin): não é permitido acessar o painel em duas sessões ao mesmo tempo. Ao entrar com a conta já conectada em outra sessão, aparece este modal sem botão de fechar (Esc e clique fora também não fecham), com o painel desfocado e inacessível atrás. DADOS DE EXEMPLO: dispositivo e horário da sessão existente são fictícios; em desenvolvimento vêm da sessão ativa no servidor. PONTOS DE INTEGRAÇÃO: (1) detectar sessão ativa no login e devolver dispositivo e início; (2) “Encerrar outra sessão e continuar aqui” deve invalidar a sessão anterior no servidor e só então liberar o painel (hoje apenas libera a tela); (3) “Continuar na outra sessão” descarta a entrada atual (sem criar sessão) e orienta a voltar à sessão ativa (hoje leva ao login). 💡 A confirmar: aviso à sessão derrubada e registro do encerramento no histórico de acessos do usuário.">
      <Dialog
        open dismissible={false} onClose={() => undefined} size="lg" sheet className="session-dialog"
        title="Sua conta já está conectada em outra sessão"
        subtitle="Não é possível acessar o painel em duas sessões ao mesmo tempo. Você pode encerrar a outra sessão para continuar neste dispositivo ou voltar para a sessão que já está ativa"
        actions={(
          <>
            <Button size="sm" variant="secondary" onClick={() => setKeptOther(true)}>Continuar na outra sessão</Button>
            <Button size="sm" onClick={onContinueHere}>Encerrar outra sessão e continuar aqui</Button>
          </>
        )}
      >
        <Feedback
          type="warning" title="Sessão ativa"
          details={(
            <Grid>
              <Col span={6} mobileFull><ReadField label="Dispositivo" value={device} /></Col>
              <Col span={6} mobileFull><ReadField label="Conectada desde" value={since} /></Col>
            </Grid>
          )}
          message="Se você não reconhece essa sessão, encerre-a e troque sua senha após entrar."
        />
      </Dialog>
    </DevNote>
  );
}
