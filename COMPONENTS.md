# Catálogo de componentes

Ponto único de importação: `import { Button, Input } from '<caminho>/src'` (ver `src/index.ts`).
Cada componente tem story com props e exemplos em `Components/<Nome>`; composições prontas em `Patterns/Composições`.
Tudo abaixo está em ordem alfabética.

**Índice A–Z:** Accordion · AppHeader · Avatar · Badge · Breadcrumb · Button · Card · Checkbox · DatePicker · Dialog · Dropdown · EmptyState · Feedback · FormField · ImageUpload · Input · KpiCard · Pagination · Popover · RadioButton · Sidebar · Spinner · Stack · Tab · Table · Textarea · Toast · Toggle · Tooltip

## Como escolher (por necessidade)

| Preciso de… | Use | Não use / observação |
|---|---|---|
| Ação clicável | `Button` (`primary` 1 por área · `secondary` tonal, sem borda, para ações alternativas/voltar · `destructive` · `ghost` · `outline` branco com borda neutra, para configuração da tela como "Colunas") | Não crie `CustomButton`. Só ícone → `iconOnly` + `aria-label`. |
| Agrupar conteúdo relacionado | `Card` (`padding="none"` p/ tabelas) | Não faça `div` com borda/sombra própria |
| Alternar seções de conteúdo | `Tab` | — |
| Barra superior | `AppHeader` (recebe `logo`, `actions`) | — |
| Campo de data | `DatePicker` (valor ISO `YYYY-MM-DD`) | Não use `<input type="date">`: o calendário é do navegador e não segue a identidade |
| Campo de tipo novo (hora, cor…) | `FormField` + `fieldControlClass` no controle | Não reimplemente label/erro/ajuda |
| Campo de texto (1 linha) | `Input` | Dados pessoais: passe `autoComplete`. Ação dentro do campo (mostrar senha, limpar) → `iconRightAction` |
| Campo de texto (várias linhas) | `Textarea` | — |
| Carregando | `Spinner` | Em tabela: prop `loading` |
| Confirmação efêmera após ação | `Toast` (`ToastProvider` + `useToast`) | — |
| Confirmar/decidir sem sair da tela | `Dialog` | — |
| Dica curta em hover/foco | `Tooltip` | Nunca para conteúdo essencial |
| Painel ancorado a um botão (filtros de tabela) | `Popover` | Sem decisão obrigatória; no mobile, use `Dialog` |
| Escolher 1 entre poucas opções visíveis | `RadioButton` | Mais de ~5 opções → `Dropdown` |
| Escolher 1 opção de uma lista | `Dropdown` (no celular abre como folha inferior) | Poucas opções visíveis (até ~5) → `RadioButton` |
| Espaçar/alinhar elementos | `Stack` | Não escreva CSS de página com `display:flex; gap` |
| Estado de um registro (Ativo, Pendente) | `Badge` | Em tabela: coluna `type: 'badge'` |
| Foto/iniciais de pessoa | `Avatar` | — |
| Enviar uma imagem/foto (com miniatura) | `ImageUpload` | Não use `<input type="file">` solto nem `Input readOnly` para isso |
| Lista de dados tabulares | `Table` (colunas por `type`) | Não crie `NewTable` |
| Lista/seção sem dados | `EmptyState` | Em tabela: já usa `EmptyState`; personalize com a prop `empty` |
| Indicador numérico de dashboard (KPI) | `KpiCard` (`trend` opcional: comparativo com período anterior) | Não invente tendência sem histórico real; a cor do `trend` vem de `sentiment`, não da seta |
| Ligar/desligar com efeito imediato | `Toggle` | — |
| Marcar/desmarcar (envia depois) | `Checkbox` | Consentimento: nunca pré-marcado |
| Menu lateral de área logada | `Sidebar` (recebe `items`, `logo`, `user`) | Permissões por papel ficam no produto. Seção com páginas filhas → `children` no item (accordion), um nível, ícone opcional |
| Mensagem permanente na página | `Feedback` | — |
| Muitas páginas de dados | `Table` com prop `pagination` (rodapé dentro da tabela) | Fora de tabela: `Pagination` |
| Busca/filtros de uma tabela | `Table` com prop `toolbar` (dentro do card, campos de 44px) | Não coloque os filtros soltos acima da tabela |
| Perguntas/seções expansíveis | `Accordion` | — |
| Trilha de navegação | `Breadcrumb` | — |

## Componentes (A–Z)

| Componente | Variantes / props-chave | Tokens que controlam a aparência |
|---|---|---|
| **Accordion** | `items` (`title` `subtitle` `collapsedSubtitle` `meta` `content`) `allowMultiple` `defaultOpenIndex` `headingLevel` | `--radius-control`, `--font-display` |
| **AppHeader** | `logo` `actions` `align` | `--color-bg-surface`, `--z-sticky` |
| **Avatar** | `name` `src` `size` | `--color-bg-brand`, `--color-text-brand` |
| **Badge** | `status` neutral/brand/success/error/warning/info · `dot` | `--color-status-*`, `--radius-pill` |
| **Breadcrumb** | `items` (label, href, icon) | `--color-text-*` |
| **Button** | `variant` primary/secondary/destructive/ghost/outline · `size` sm/md/lg · `iconLeft/Right` · `iconOnly` | `--color-action-*`, `--color-on-action-*`, `--radius-control(-sm)`, `--control-*`, `--font-display` |
| **Card** | `title` `subtitle` `actions` `footer` `padding` none/md/lg | `--color-bg-surface`, `--radius-card` |
| **Checkbox** | `label` `checked` `indeterminate` `disabled` | `--color-action-primary`, `--radius-control-sm` |
| **DatePicker** | `size="sm"` (compacto de 36px, filtros de tabela) · `value` (ISO) `onChange` `label` `min` `max` `locale` `weekStartsOn` `showShortcuts` `labels` (teclado: setas, Home/End, PageUp/Down, Esc) | idem Input + `--radius-overlay`, `--z-dropdown` |
| **Dialog** | `open` `onClose` `title` `actions` `size` | `--radius-overlay`, `--color-overlay`, `--z-overlay` |
| **Dropdown** | `options` (`label` `value` + opcionais `description` `leading` `keywords`) `searchable` (busca no topo da lista) `size="sm"` (compacto de 36px para filtros de tabela) `value` `onChange` `label` `aria-label` `error` (teclado: setas, Enter, Esc, Home/End; abre para cima se faltar espaço; ≤ 640px vira folha inferior) | idem Input, `--color-overlay`, `--z-dropdown`, `--z-overlay` |
| **EmptyState** | `icon` `title` `description` `action` | `--color-text-*` |
| **Feedback** | `type` success/error/warning/info · `title` `message` `link` `dismissible` | `--color-status-*` |
| **FormField** | `label` `helperText` `error` `success` `required` · children = `(control) => …` | `--color-text-*`, `--color-status-*` |
| **ImageUpload** | `label` `optional` `fileName` `previewUrl` `onChange(file|null)` `loading` `error` `disabled` `accept` (padrão JPG/PNG) `maxSizeBytes` (sem valor = sem limite) `helperText` `labels` · vazio: área clicável + arrastar e soltar; com imagem: miniatura, nome, Trocar/Remover | `--color-action-primary` (só ícone/texto da ação), `--color-border-*`, `--focus-glow*` |
| **Input** | props de `<input>` + `label` `helperText` `error` `success` `iconLeft/Right` (decorativos) · `iconRightAction` (ícone clicável: mostrar/ocultar senha, limpar) | `--radius-control`, `--focus-glow*`, `--color-border-*` |
| **KpiCard** | `tone` (neutral/error/warning/info: cor semântica só no ícone e no valor) `label` `value` (número, moeda ou texto; mesmo tamanho) · `ranking` (top N compacto, trunca nomes) `icon` · `description` (linha complementar) · `trend` { direction up/down/flat, percent, sentiment positive/negative/neutral, reference } · `locale` `labels` | Card + `--color-bg-brand`/`--brand-primary` (ícone), `--color-text-success/error/tertiary` (trend) |
| **Pagination** | `page` `pageCount` `onPageChange` | herda de Button |
| **RadioButton** | `options` `value` `onChange` `name` `label` `orientation` | `--color-action-primary` |
| **Sidebar** | `items` (com `children` vira grupo recolhível/accordion) `logo` `activeItem` `onNavClick` `user` `onLogout` `open` `onToggle` `labels` | `--color-nav-*` |
| **Spinner** | `size` `label` | `--color-action-primary` |
| **Stack** | `direction` `gap` (escala `--spacing-*`) `align` `justify` `wrap` `as` | `--spacing-*` |
| **Tab** | `tabs` `defaultIndex` `onChange` | `--color-text-brand` (aba ativa, contraste AA), `--font-display` |
| **Table** | `columns` (`type`: text/link/badge/avatar/toggle/actions · `sticky: 'right'`) `rows` `loading` `empty` `sortKey/sortDir/onSort` `pagination` `toolbar` · **Regra:** ações sempre fixas à direita (só as demais colunas rolam); 1ª/última coluna com `--spacing-lg` da borda; scrollbar segue o padrão global (`--scrollbar-*`) | `--color-bg-surface`, `--color-bg-stripe` (linhas alternadas, escala de cinza; a 1ª linha é cinza), `--font-display` (cabeçalho) |
| **Textarea** | props de `<textarea>` + `label` `helperText` `error` | idem Input |
| **Toast** | `useToast().show({ type, message, title, duration })` | herda de Feedback, `--z-toast` |
| **Toggle** | `label` `checked` `size` sm/md | `--color-action-primary`, `--radius-pill` |
| **Popover** | `open` `onClose` `anchorRef` `label` `align` · filhos livres | `--color-bg-raised`, `--shadow-lg`, `--z-dropdown` |
| **Tooltip** | `content` `placement` · filho focável | `--color-bg-inverse`, `--z-tooltip` |

## Composição típica

- **Formulário:** `Card` (footer com `Button`s) → `Stack` → `Input`/`Dropdown`/`DatePicker`/`Textarea`/`Checkbox`.
  **Espaçamento padrão:** 16px entre campos (`Stack gap="md"`), 24px do último campo até o botão principal (`gap="lg"` entre o grupo de campos e o grupo de ações) e 16px entre o botão e ações secundárias/links abaixo dele (`gap="md"`). Campos e botões (tamanho padrão `md`, texto 16px `--font-size-base`): 44px de altura (`--control-height-md`). Erros por campo via prop `error`; resumo via `Feedback`.
- **Listagem:** título + `Button` numa `Stack horizontal` → `Table` → `Pagination`; sem dados → `EmptyState`.
- **Área logada:** `Sidebar` + conteúdo com `Card`s.

Exemplos executáveis: story **Patterns/Composições**.

## Quando um componente novo é justificado

Só se **todas** as respostas forem "não":
1. Existe componente (ou prop/variante) que faça isso? Revise as tabelas acima.
2. Uma composição de componentes existentes resolve? (`Card` + `Stack` + …)
3. É apenas ajuste de aparência? Ajuste **tokens** em `brand.css`, não crie componente.

Se ainda assim faltar, proponha o componente antes de implementar: nome, problema que resolve, props, tokens usados, estados (hover, foco, disabled, erro) e requisitos de acessibilidade. Depois de aprovado, crie em `src/components/<Nome>/` (tsx + module.css + stories), exporte em `src/index.ts` **na posição alfabética** e adicione uma linha aqui (índice A–Z e tabela).
