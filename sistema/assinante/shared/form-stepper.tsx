import { IconCheck } from '@tabler/icons-react';
import './form-stepper.css';

/**
 * Stepper de formulário (RF601): indicadores circulares com conectores, na mesma linguagem do "Andamento da OS" (RF503),
 * mas com o comportamento de um fluxo de preenchimento: só dá para ir a etapas já alcançadas, e uma etapa só aparece
 * como concluída quando está alcançada, não é a atual e passa nas validações (não basta ter acessado).
 */
export type FormStepState = 'done' | 'current' | 'reached' | 'future' | 'available' | 'invalid';
// Edição: só a etapa atual se destaca; as demais ficam neutras e navegáveis ('available'), ou 'invalid' quando precisam de correção

const SR: Record<FormStepState, string> = { done: 'concluída', current: 'etapa atual', reached: 'pendente de revisão', future: 'indisponível até concluir as anteriores', available: 'disponível', invalid: 'precisa de correção' };

export function FormStepper({ steps, states, onSelect, ariaLabel }: {
  steps: string[]; states: FormStepState[]; onSelect: (n: number) => void; ariaLabel: string;
}) {
  const current = states.findIndex((s) => s === 'current');
  const total = steps.length;
  const editable = states.some((s) => s === 'available' || s === 'invalid');
  return (
    <nav aria-label={ariaLabel} className={`fs${editable ? ' fs-editable' : ''}`}>
      <p className="fs-compact-text">{`Etapa ${current + 1} de ${total}`}</p>
      <ol className="fs-list">
        {steps.map((label, i) => {
          const st = states[i];
          const mark = st === 'done' ? <IconCheck size={14} /> : <span>{i + 1}</span>;
          const body = (
            <>
              <span className="fs-mark" aria-hidden="true">{mark}</span>
              <span className="fs-label">{label}<span className="sr-only"> ({SR[st]})</span></span>
            </>
          );
          return (
            <li key={label} className={`fs-step is-${st}`} aria-current={st === 'current' ? 'step' : undefined}>
              {st === 'future'
                ? <span className="fs-item" aria-disabled="true">{body}</span>
                : <button type="button" className="fs-item" onClick={() => onSelect(i + 1)}>{body}</button>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
