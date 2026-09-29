# Catálogo de componentes

Ponto único de importação: `import { Button, Input } from '<caminho>/src'` (ver `src/index.ts`).
Cada componente tem story com props e exemplos em `Components/<Nome>`; composições prontas em `Patterns/Composições`.
Tudo abaixo está em ordem alfabética.

**Índice A–Z:** Accordion · AppHeader · Avatar · Badge · Breadcrumb · Button · Card · Checkbox · DatePicker · Dialog · Dropdown · EmptyState · Feedback · FormField · Input · Pagination · RadioButton · Sidebar · Spinner · Stack · Tab · Table · Textarea · Toast · Toggle · Tooltip

## Como escolher (por necessidade)

| Preciso de… | Use | Não use / observação |
|---|---|---|
| Ação clicável | `Button` (`primary` 1 por área · `secondary` · `destructive` · `ghost`) | Não crie `CustomButton`. Só ícone → `iconOnly` + `aria-label`. |
| Agrupar conteúdo relacionado | `Card` (`padding="none"` p/ tabelas) | Não faça `div` com borda/sombra própria |
| Alternar seções de conteúdo | `Tab` | — |
| Barra superior | `AppHeader` (recebe `logo`, `actions`) | — |
| Campo de data | `DatePicker` (valor ISO `YYYY-MM-DD`) | Não use `<input type="date">`: o calendário é do navegador e não segue a identidade |
| Campo de tipo novo (hora, cor…) | `FormField` + `fieldControlClass` no controle | Não reimplemente label/erro/ajuda |
| Campo de texto (1 linha) | `Input` | Dados pessoais: passe `autoComplete` |
| Campo de texto (várias linhas) | `Textarea` | — |
| Carregando | `Spinner` | Em tabela: prop `loading` |
| Confirmação efêmera após ação | `Toast` (`ToastProvider` + `useToast`) | — |
| Confirmar/decidir sem sair da tela | `Dialog` | — |
| Dica curta em hover/foco | `Tooltip` | Nunca para conteúdo essencial |
| Escolher 1 entre poucas opções visíveis | `RadioButton` | Mais de ~5 opções → `Dropdown` |
| Escolher 1 opção de uma lista | `Dropdown` (no celular abre como folha inferior) | Poucas opções visíveis (até ~5) → `RadioButton` |
| Espaçar/alinhar elementos | `Stack` | Não escreva CSS de página com `display:flex; gap` |
| Estado de um registro (Ativo, Pendente) | `Badge` | Em tabela: coluna `type: 'badge'` |
| Foto/iniciais de pessoa | `Avatar` | — |
| Lista de dados tabulares | `Table` (colunas por `type`) | Não crie `NewTable` |
| Lista/seção sem dados | `EmptyState` | Em tabela: já usa `EmptyState`; personalize com a prop `empty` |
| Ligar/desligar com efeito imediato | `Toggle` | — |
| Marcar/desmarcar (envia depois) | `Checkbox` | Consentimento: nunca pré-marcado |
| Menu lateral de área logada | `Sidebar` (recebe `items`, `logo`, `user`) | Permissões por papel ficam no produto |
| Mensagem permanente na página | `Feedback` | — |
| Muitas páginas de dados | `Pagination` + `Table` | — |
| Perguntas/seções expansíveis | `Accordion` | — |
| Trilha de navegação | `Breadcrumb` | — |

## Componentes (A–Z)

| Componente | Variantes / props-chave | Tokens que controlam a aparência |
|---|---|---|
| **Accordion** | `items` `allowMultiple` `defaultOpenIndex` `headingLevel` | `--radius-control`, `--font-display` |
| **AppHeader** | `logo` `actions` `align` | `--color-bg-surface`, `--z-sticky` |
| **Avatar** | `name` `src` `size` | `--color-bg-brand`, `--color-text-brand` |
| **Badge** | `status` neutral/brand/success/error/warning/info · `dot` | `--color-status-*`, `--radius-pill` |
| **Breadcrumb** | `items` (label, href, icon) | `--color-text-*` |
| **Button** | `variant` primary/secondary/destructive/ghost · `size` sm/md/lg · `iconLeft/Right` · `iconOnly` | `--color-action-*`, `--color-on-action-*`, `--radius-control(-sm)`, `--control-*`, `--font-display` |
| **Card** | `title` `subtitle` `actions` `footer` `padding` none/md/lg | `--color-bg-surface`, `--radius-card` |
| **Checkbox** | `label` `checked` `indeterminate` `disabled` | `--color-action-primary`, `--radius-control-sm` |
| **DatePicker** | `value` (ISO) `onChange` `label` `min` `max` `locale` `weekStartsOn` `showShortcuts` `labels` (teclado: setas, Home/End, PageUp/Down, Esc) | idem Input + `--radius-overlay`, `--z-dropdown` |
| **Dialog** | `open` `onClose` `title` `actions` `size` | `--radius-overlay`, `--color-overlay`, `--z-overlay` |
| **Dropdown** | `options` `value` `onChange` `label` `aria-label` `error` (teclado: setas, Enter, Esc, Home/End; abre para cima se faltar espaço; ≤ 640px vira folha inferior) | idem Input, `--color-overlay`, `--z-dropdown`, `--z-overlay` |
| **EmptyState** | `icon` `title` `description` `action` | `--color-text-*` |
| **Feedback** | `type` success/error/warning/info · `title` `message` `dismissible` | `--color-status-*` |
| **FormField** | `label` `helperText` `error` `success` `required` · children = `(control) => …` | `--color-text-*`, `--color-status-*` |
| **Input** | props de `<input>` + `label` `helperText` `error` `success` `iconLeft/Right` | `--radius-control`, `--focus-glow*`, `--color-border-*` |
| **Pagination** | `page` `pageCount` `onPageChange` | herda de Button |
| **RadioButton** | `options` `value` `onChange` `name` `label` `orientation` | `--color-action-primary` |
| **Sidebar** | `items` `logo` `activeItem` `onNavClick` `user` `onLogout` `open` `onToggle` `labels` | `--color-nav-*` |
| **Spinner** | `size` `label` | `--color-action-primary` |
| **Stack** | `direction` `gap` (escala `--spacing-*`) `align` `justify` `wrap` `as` | `--spacing-*` |
| **Tab** | `tabs` `defaultIndex` `onChange` | `--color-action-primary`, `--font-display` |
| **Table** | `columns` (`type`: text/link/badge/avatar/toggle/actions) `rows` `loading` `empty` `sortKey/sortDir/onSort` | `--color-bg-surface`, `--color-bg-stripe` (linhas alternadas, escala de cinza; a 1ª linha é cinza), `--font-display` (cabeçalho) |
| **Textarea** | props de `<textarea>` + `label` `helperText` `error` | idem Input |
| **Toast** | `useToast().show({ type, message, title, duration })` | herda de Feedback, `--z-toast` |
| **Toggle** | `label` `checked` `size` sm/md | `--color-action-primary`, `--radius-pill` |
| **Tooltip** | `content` `placement` · filho focável | `--color-bg-inverse`, `--z-tooltip` |

## Composição típica

- **Formulário:** `Card` (footer com `Button`s) → `Stack` → `Input`/`Dropdown`/`DatePicker`/`Textarea`/`Checkbox`. Erros por campo via prop `error`; resumo via `Feedback`.
- **Listagem:** título + `Button` numa `Stack horizontal` → `Table` → `Pagination`; sem dados → `EmptyState`.
- **Área logada:** `Sidebar` + conteúdo com `Card`s.

Exemplos executáveis: story **Patterns/Composições**.

## Quando um componente novo é justificado

Só se **todas** as respostas forem "não":
1. Existe componente (ou prop/variante) que faça isso? Revise as tabelas acima.
2. Uma composição de componentes existentes resolve? (`Card` + `Stack` + …)
3. É apenas ajuste de aparência? Ajuste **tokens** em `brand.css`, não crie componente.

Se ainda assim faltar, proponha o componente antes de implementar: nome, problema que resolve, props, tokens usados, estados (hover, foco, disabled, erro) e requisitos de acessibilidade. Depois de aprovado, crie em `src/components/<Nome>/` (tsx + module.css + stories), exporte em `src/index.ts` **na posição alfabética** e adicione uma linha aqui (índice A–Z e tabela).
