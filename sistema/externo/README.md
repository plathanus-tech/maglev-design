# Atores externos (v2): Prestador de serviço e Colaborador/Solicitante

Telas **sem login e sem conta**, escolhidas no Navegador de Protótipo em **Ator → Prestador de serviço** / **Colaborador / Solicitante**
(abrem já em Mobile: são mobile-first). Especificação: frentes "Prestador de Serviço" e "Colaborador / Solicitante (PWA)".

## Casca
`externo/shared/ExternalLayout.tsx` (+ `externo.css`): só logo, nome do assinante + área e tema. Sem sidebar, busca, notificações ou conta.
Mesmas regras de design do Admin/Assinante (layout só com componentes do `@maglev/ds`, tokens, subtítulo sem ponto final, DevNote).

## Prestador de serviço (`prestador/`) - acesso por link web
- Identidade pelo link: `?p=<id do prestador>` e, no link individual do técnico, `?tec=<id do técnico>` (💡 P09: modelo de link a confirmar).
- `minhas-os.html` (RF101): OS atribuídas, filtros e ordenação padrão prioridade + prazo. Prestador inativo não acessa (CTA002); link inválido.
- `os.html?os=` (RF102): aceite → visita (várias) → chegada → diagnóstico/orçamento (bloqueia a execução até a aprovação do assinante) →
  execução (solução, atividades, fotos, anexos, materiais/custos, horas, observações) → indicar conclusão (OS vai a "Aguardando validação").
  Prestador nunca encerra a OS nem aprova orçamento. OS encerrada: link expira (💡 RGN004).
- `execucao-preventiva.html?os=`: **a mesma execução da Área do assinante** (`assinante/shared/execucao-preventiva-core.tsx`), na casca externa.
- Autônomo: é o próprio executor (sem técnicos); o e-mail do contato principal recebe o link (ver `notifyProviderLog` em `os-common.tsx`).

## Colaborador / Solicitante (`colaborador/`) - PWA via QR Code
- Equipamento pelo QR: `?q=<qrToken>` (o protótipo também aceita `?e=<id>`). Acompanhamento pelo protocolo: `?p=SOL-…`.
- `equipamento.html` (RF001/RF003): resumo sem dados sensíveis + solicitações abertas (status simplificado, responsável, previsão) + busca por protocolo.
- `solicitar.html` (RF002): **o mesmo formulário da Área do assinante** (`assinante/shared/solicitacao-form-core.tsx`) em modo `external`:
  equipamento fixo, nome e telefone obrigatórios (lembrados no dispositivo), aceite dos termos, canal "QR", troubleshooting na ordem do Modelo 1.
- `acompanhar.html` (RF004): status simplificado, histórico em linguagem simples, resposta à complementação e "O problema foi resolvido?"
  (usa `applyOrderValidation`, compartilhado com a validação da Área do assinante).

## Código compartilhado com a Área do assinante
`solicitacao-form-core.tsx`, `execucao-preventiva-core.tsx` (casca/identidade por props), `os-common.tsx`
(`applyOrderValidation`, `applyOrderConclusion`, `AttachmentField`, `dueCell`). Novos campos opcionais em `WorkOrder`: `accepted`, `workedHours`.
