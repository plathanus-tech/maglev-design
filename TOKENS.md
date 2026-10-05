# Foundations e customização de identidade

A identidade de um projeto é trocada **somente em `src/tokens/brand.css`**.
`src/tokens/tokens.css` é da Base — não edite por projeto. Componentes não contêm valores visuais fixos.

## O que editar em `brand.css`

| Token | Efeito | Obrigatório |
|---|---|---|
| `--brand-primary` | Gera `--color-brand-50…950`; alimenta `action-primary`, links de marca, foco, Sidebar, Tabs, Toggle… | Sim (já vem com verde padrão) |
| `--brand-secondary` | Gera `--color-secondary-50…950` e `--color-action-secondary-*` | Não |
| `--font-display` | Títulos (`h1–h6`), botões, abas, cabeçalho de tabela, títulos de Feedback/Accordion | Não |
| `--font-body` | Textos, labels, campos, tabelas, descrições | Não |
| `--font-weight-heading` · `-button` · `-label` · `-body` | Pesos semânticos (Maglev: 600 · 600 · 500 · 400). Componentes usam estes, não os crus. Definidos em `tokens.css` | Não |
| `--radius-scale` | Multiplica toda a escala de radius (1 padrão · 0 quadrado · 1.5 suave) | Não |

- **Uma cor da marca:** informe só `--brand-primary`; para a secundária use `--brand-secondary: var(--brand-primary)` ou deixe o padrão.
- **Duas cores:** informe as duas.
- **Contraste:** `--brand-primary` precisa de contraste ≥ 4.5:1 com branco (texto do botão). Cor clara? Defina também `--color-on-action-primary` (ex.: `var(--color-gray-950)`).
- **Uma fonte:** `--font-display: var(--font-body);` **Duas fontes:** informe as duas.
- **Carregar fontes:** use pacotes `@fontsource/<fonte>` (servidos localmente, sem requisição a terceiros) e troque as importações em `.storybook/preview.ts` e no app do produto. Evite Google Fonts via `<link>`: expõe o IP do usuário a terceiros.
- **Radius sob medida:** além de `--radius-scale`, sobrescreva os semânticos: `--radius-control` (botões/campos), `--radius-control-sm`, `--radius-card`, `--radius-overlay`, `--radius-pill`. Não os altere se o projeto não definir estilo de arredondamento.

## Tokens disponíveis (em `tokens.css`)

- **Cor semântica:** `--color-text-*`, `--color-bg-*`, `--color-border-*`, `--color-action-*` (+ `-hover`, `-pressed`), `--color-on-action-*`, `--color-status-*-bg/fg`, `--color-nav-*`, `--color-overlay`. Tema escuro em `[data-theme="dark"]`.
- **Escalas cruas:** `--color-brand-*`, `--color-secondary-*`, `--color-gray-*`, `--color-red/green/blue/yellow/orange/indigo/violet/pink-*`. Componentes preferem os semânticos.
- **Tipografia:** `--font-size-*`, `--font-weight-*`, `--line-height-*`, `--letter-spacing-*`.
- **Espaçamento:** `--spacing-2xs … 4xl`. **Controles:** `--control-*`.
- **Forma:** `--radius-*`, `--border-width-*`, `--shadow-*`, `--opacity-*`, `--transition-*`.
- **Foco:** `--focus-ring-*`, `--focus-glow`, `--focus-glow-error`.
- **Barra de rolagem:** `--scrollbar-size-x` (horizontal, 24px), `--scrollbar-size-y` (vertical, 16px), `--scrollbar-thickness` (8px visível), `--scrollbar-thumb(-hover)`. Aplicada globalmente a todo elemento com rolagem (ver `Foundations/Scrollbar`).
- **Camadas:** `--z-dropdown/sticky/overlay/toast/tooltip`.
- **Breakpoints:** `--breakpoint-sm/md/lg/xl` (640/768/1024/1280) e `breakpoints.ts`. Media queries não aceitam `var()`; escreva `@media (min-width: 768px)` com o valor literal.

## Regras

1. Nunca escreva `#hex`, `rgb()`, `font-family`, `font-size` ou `border-radius` em px em CSS/TSX de componentes ou páginas. Use tokens.
2. Precisa de uma cor/medida que não existe? Adicione um **token semântico** em `tokens.css` (na Base) — não um valor local.
3. `npm run check:tokens` valida isso (falha o build de CI se houver valor fixo). Exceção pontual: comentário `token-ok` na linha.

## Como validar uma nova identidade

1. Edite `brand.css`; rode `npm run storybook`.
2. Confira `Foundations/Colors`, `Typography` e `Border Radius`, alterne claro/escuro e abra a aba **Accessibility** das stories principais (contraste).
3. Rode `npm run check:tokens`.

## Paleta Maglev: Navy + Ink + tokens semânticos (`brand.css`)

Direção cromática: **navy (#051730) + neutros frios** constroem a base; o **laranja é accent** (CTA, indicador do item ativo).
No dark mode os neutros têm a mesma matiz do navy do Sidebar, para a interface parecer um sistema só. Light mode: valores inalterados.

Três camadas — componentes só usam a terceira:

| Camada | Tokens | Para quê |
|---|---|---|
| 1. Escalas cruas | `--color-navy-50…950` (900 = #051730), `--color-ink-50…950` (neutros frios do dark) | Matéria-prima; ajustadas à mão, não interpoladas |
| 2. Semânticos | `--background-page / -sidebar / -surface / -surface-raised / -surface-hover / -selected / -stripe`, `--border-subtle / -card / -control / -strong`, `--text-primary / -secondary / -tertiary`, `--action-primary / -hover / -pressed` | Mudam de valor por tema (`:root` e `:root[data-theme="dark"]`) |
| 3. Componente | `--color-bg-*`, `--color-border-*`, `--color-text-*`, `--color-action-*`, `--color-nav-*` | Já existentes; apontam para a camada 2 |

Regras:
- Contorno de Card/KPI/tabela: `--color-border-card` (light `gray-200` a 64%, mais visível que o divisor `border-subtle`, que fica para linhas internas).
- Superfícies flutuantes (Dialog, menu do Dropdown, calendário, Toast) usam `--color-bg-raised`; cards e tabelas usam `--color-bg-surface`.
- `--color-bg-brand` = `background/selected`: no light é a tinta laranja de sempre; no dark é uma tinta navy (hover de linha, chip de ícone, item selecionado).
- Sidebar: default `navy-200` · hover `navy-800` a 55% · selecionado `navy-800` + barra laranja · foco = anel da marca.
- Contrastes validados (WCAG): texto ≥ 4,5:1 (menor caso: terciário sobre hover, 4,78:1); bordas de campo e foco ≥ 3:1; texto navy sobre o laranja do botão 6,49:1.
- Para trocar o tema de um componente, mude o **semântico** em `brand.css`, nunca o valor dentro do componente.
