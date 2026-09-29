# Validação da Base — acessibilidade (WCAG 2.2) e privacidade

Resultado das verificações feitas nesta Base e o que **ainda exige validação manual**. Repita ao alterar componentes ou tokens.

> Ferramentas automáticas cobrem só parte dos critérios de acessibilidade (na prática, cerca de um terço). Este documento **não declara conformidade** com WCAG, LGPD ou GDPR: registra o que foi verificado e o que falta verificar.

## 1. Acessibilidade — verificado automaticamente

**axe-core 4.13** (regras WCAG 2.0/2.1/2.2 A e AA + boas práticas), em **todas as 104 stories**, nos temas **claro e escuro**, e nos estados abertos de Dropdown, Dialog, DatePicker e Toast.

| Achado inicial | Correção |
|---|---|
| Contraste 4,0:1 em texto terciário (Breadcrumb, subtítulo do Card, e-mail da Sidebar, tabela vazia) | `--color-text-tertiary` → `gray-600` |
| Contraste 2,4:1 (claro) e 2,0:1 (escuro) no placeholder de Input, Textarea e Dropdown | placeholder usa `--color-text-tertiary` |
| Bordas de controles < 3:1 (1.4.11) — Input, Dropdown, Checkbox, Radio, Toggle | `--color-border-muted` → `gray-500` (claro) e `gray-500` (escuro); `--color-border-default` do escuro → `gray-400` |
| Dropdown sem nome acessível quando não há `label` | nova prop `aria-label`; story ajustada |

Após as correções: **0 violações** nas stories afetadas, nos dois temas. O aviso restante do axe é a regra de boa prática "conteúdo fora de landmarks", que é artefato das stories isoladas (não há `<main>` no iframe), não dos componentes.

## 2. Acessibilidade — verificado por interação (script no navegador)

| Componente | Confirmado |
|---|---|
| Tab | setas mudam a aba e o foco; `tabindex` móvel |
| Dropdown | ArrowDown abre; setas, Home e End movem a opção ativa (`aria-activedescendant`); Enter seleciona e fecha; Esc fecha |
| Dialog | foco entra no diálogo; Tab e Shift+Tab ciclam; Esc fecha; foco volta ao gatilho; scroll do fundo trava e libera |
| Tooltip | aparece no foco; `aria-describedby` ligado; Esc esconde |
| Accordion | `aria-expanded` alterna; painel fechado fica `hidden`; `region` ligada ao botão |
| Toast | aparece com `role="status"` |
| DatePicker | digitar 18092026 vira 18/09/2026 e valor ISO; setas, PageDown e Home/End movem o dia (rótulo completo por dia); seleção fecha e devolve o foco ao botão; Esc fecha |

## 3. Acessibilidade — precisa de validação manual

- **Leitor de tela** (NVDA/JAWS no Windows, VoiceOver no macOS/iOS, TalkBack): Dropdown, DatePicker (grade de dias), Dialog, Tabs, Toast e mensagens de erro de formulário.
- **Enter/Espaço em botões nativos** (dias do calendário, opções): dependem do comportamento padrão do navegador; o teste automatizado só dispara eventos, não a ativação real do teclado.
- **Zoom 200% e 400%**, reflow em 320 px e espaçamento de texto (1.4.4, 1.4.10, 1.4.12) — o calendário tem largura fixa de 20,5rem e foi pensado para caber, mas não foi medido.
- **Estados de hover e foco renderizados**: verificados estaticamente (o CSS só usa tokens; `check:tokens` passa), mas não capturados em tela.
- **Contraste da cor de marca do projeto**: cada nova `--brand-primary` precisa ser conferida (texto do botão ≥ 4,5:1).
- **Alto contraste do Windows** e `prefers-reduced-motion` (regra global existe, não foi exercitada).
- **Idiomas**: os textos internos vêm em português; para outros idiomas passe `labels`.
- **Dropdown no celular real** (iOS/Android): a folha inferior foi verificada em viewport de 375 px emulado (abre, escurece o fundo, fecha pelo fundo, trava o scroll, itens de 48 px), mas não em aparelho. Validar toque, teclado virtual e leitura com VoiceOver/TalkBack, que costumam tratar listbox customizado de forma diferente do `<select>` nativo.

## 4. Privacidade (UX/UI) — revisão com o checklist P01–P45

Escopo: componentes de formulário, Toast/Feedback, Dialog e configuração do Storybook. É uma biblioteca sem produto, então critérios de fluxo (cookies, exclusão de conta, permissões) são **N/A** e dependem de cada produto.

**Atendido**
- ✓ **P13** — Checkbox e Toggle começam desmarcados/desligados (`checked = false`); nenhum exemplo pré-marca um consentimento.
- ✓ **P28** — Input repassa `type`; `type="password"` fica mascarado; não há revelação automática.
- ✓ **P03 / P21** — `FormField` oferece `helperText` para explicar o campo no ponto de coleta.
- ✓ Dados de exemplo são fictícios (domínio `exemplo.com`).

**Corrigido nesta rodada**
- Fontes eram carregadas do Google Fonts (requisição a terceiros com o IP de quem abre o Storybook) → agora `@fontsource`, servidas localmente.
- Telemetria do Storybook desativada.
- Toast de erro/aviso desaparecia em 5 s → agora persiste até ser fechado (o usuário precisa ler e agir).
- Lacuna de orientação: nova seção "Privacidade nas interfaces" em `AGENTS.md` e story **Patterns/Composições › Consentimento e privacidade**.

**Pontos de atenção que ficam com o produto** (a Base só pode orientar)
- **P29 / P33 / P34 (média):** nada impede um produto de usar `primary` para aceitar e `ghost` para recusar. Mitigação: regra em `AGENTS.md` e story de exemplo. Validar em cada produto.
- **P05 / P06 (baixa):** `Table` renderiza o que receber; mascaramento de CPF etc. é feito no produto via `render`. Regra documentada.
- **P08 / P44 (baixa):** mensagens de Toast/Feedback aparecem na tela; documentado para não incluir dados pessoais.

**Necessita validação (fora do alcance da Base)**
- Bases legais, finalidades, retenção e consentimentos exigidos: responsável pelo projeto e jurídico/DPO.
- Comportamento real de cookies/rastreadores (P19): não existe na Base; validar com desenvolvimento em cada produto.
- P45: testar com usuários os textos e escolhas de privacidade de cada produto.

**Observação fora do checklist:** imagens de `Avatar` com `src` externo expõem o IP a terceiros; documentado em `AGENTS.md`.
