# Maglev Design System

Storybook do design system da Maglev (React + CSS Modules), derivado do Storybook Base.

**Storybook publicado:** https://plathanus-tech.github.io/maglev-design/storybook/

A publicação fica no subcaminho `/storybook/`. A raiz do GitHub Pages (`/maglev-design/`) não é usada pelo Storybook.

## Identidade

- **Cores:** primária `#F96900`, secundária `#051730`. Definidas em `src/tokens/brand.css`.
- **Tipografia:** Inter (`@fontsource/inter`, servida localmente). Peso 600 em títulos e botões, 500 em labels de campos e cabeçalho de tabela, 400 no restante.
- **Ícones:** [Tabler Icons](https://tabler.io/icons) (`@tabler/icons-react`) é a única biblioteca permitida.
- **Logo:** `public/maglev-logo.svg` (tema claro) e `public/maglev-logo-dark.svg` (tema escuro); símbolo em `public/maglev-symbol*.svg`.

Regras para quem constrói interfaces: leia `AGENTS.md`, `COMPONENTS.md` e `TOKENS.md`.

## Rodar localmente

```bash
npm install
npm run storybook
```

Abre em http://localhost:6006.

## Verificações

```bash
npm run typecheck      # TypeScript sem gerar arquivos
npm run check:tokens   # falha se houver cor, fonte ou radius fixos fora dos tokens
```

## Publicação (GitHub Pages)

O workflow `.github/workflows/storybook-pages.yml` roda a cada push na `main`: verifica, faz o build com
`STORYBOOK_BASE=/maglev-design/storybook/` e publica em `/storybook/`.

Build local no mesmo subcaminho:

```bash
STORYBOOK_BASE=/maglev-design/storybook/ npx storybook build -o _site/storybook
```
