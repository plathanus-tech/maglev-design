# Instruções para agentes de IA

Este projeto é um Design System (Storybook + React + CSS Modules). Regra central: **reutilizar antes de criar**.

## Antes de escrever qualquer interface

1. Leia `COMPONENTS.md` e identifique o componente que atende à necessidade.
2. Reutilize-o. Ajuste por **props/variantes**, não por CSS extra.
3. Se um único componente não basta, **componha** os existentes (`Card` + `Stack` + `Input` + `Button`…). Veja `Patterns/Composições`.
4. Só proponha um componente novo se as três perguntas de "Quando um componente novo é justificado" (em `COMPONENTS.md`) forem "não". Proponha primeiro (nome, problema, props, tokens, estados, acessibilidade) e espere aprovação.

## Proibido

- Criar `CustomButton`, `ProjectInput`, `NewTable`, `MyCard` ou variações que dupliquem o que já existe.
- Escrever CSS de página para reproduzir algo que um componente/`Stack`/`Card` já faz (`display:flex; gap`, caixas com borda/sombra, etc.).
- Usar cores, fontes, radius ou tamanhos de fonte fixos (`#hex`, `rgb()`, `font-family: Roboto`, `border-radius: 8px`, `font-size: 14px`). Use tokens (`TOKENS.md`).
- Editar `src/tokens/tokens.css` ou componentes para mudar a identidade. Identidade = `src/tokens/brand.css`.
- Importar de caminhos internos quando o barrel serve: importe de `src/index.ts`.
- Usar outra biblioteca de ícones: **Tabler Icons** (`@tabler/icons-react`, componentes `Icon*`) é a única permitida.
- Desativar o foco visível, remover `label`/`aria-label` ou substituir controles nativos por `div` clicável.

## Convenções

- Um componente = pasta `src/components/<Nome>/` com `<Nome>.tsx`, `<Nome>.module.css`, `<Nome>.stories.tsx`.
- Props tipadas com JSDoc (é a documentação que aparece no Storybook). Usar `cx()` de `src/utils/cx.ts` para juntar classes.
- Campos de formulário compõem `FormField` (label, ajuda, erro, ids e ARIA já resolvidos).
- Textos visíveis por padrão em pt-BR; textos internos de acessibilidade são props (`labels`, `closeLabel`…) para i18n.
- Acessibilidade (WCAG 2.2 AA): teclado completo, foco visível, `aria-*` corretos, erro associado ao campo, cor nunca é a única pista.

## Privacidade nas interfaces (decisões de UX/UI)

Estas regras vêm do checklist de privacidade (P01–P45) e valem para qualquer produto criado com a Base. Elas não determinam conformidade legal: bases legais, finalidades e retenção devem ser validadas com o responsável pelo projeto e o jurídico/DPO.

- **Coleta (P01–P03):** peça só o dado necessário, no momento em que é necessário. Se o motivo não é óbvio, explique junto ao campo com `helperText`.
- **Dados pessoais:** passe `autoComplete` correto (`name`, `email`, `tel`, `bday`…). Senhas usam `type="password"`; nunca exiba senha por padrão (P28).
- **Consentimento (P12–P16):** um `Checkbox` por finalidade, **sempre desmarcado por padrão** (P13, P14); explique a consequência de recusar; permita revogar depois em área acessível.
- **Aceitar e recusar com o mesmo peso (P29, P33, P34):** mesma variante e mesmo tamanho de `Button` para as duas opções, inclusive no mobile. Nunca `primary` para aceitar e `ghost` escondido para recusar. Não use textos com culpa ou medo (P30) nem dupla negativa (P32).
- **Exposição (P05–P07):** em `Table`, `Card` e listagens mostre só o necessário para a tarefa; mascare identificadores (ex.: CPF) via `render` da coluna quando o valor completo não for necessário e leve o detalhe para uma tela restrita.
- **`Toast`/`Feedback`:** não coloque dados pessoais na mensagem (podem ser vistos por outras pessoas ou aparecer em leitores de tela compartilhados).
- **`Avatar` e imagens:** hospede as imagens no seu domínio; `src` de terceiros expõe o IP do usuário.
- **Fontes e scripts:** use `@fontsource/*` (local). Não adicione `<link>`/scripts de terceiros (Google Fonts, analytics, chat) sem validar antes.
- **Padrões seguros:** perfis/compartilhamento começam privados (P25); permissões do navegador só quando a funcionalidade precisa (P26).

Exemplo: story **Patterns/Composições › Consentimento e privacidade**.

## Acessibilidade (WCAG 2.2 AA)

- Toda ação por teclado; foco sempre visível (não remova `:focus-visible`); alvos ≥ 24×24 px (2.5.8).
- Texto ≥ 4.5:1 e bordas de controles ≥ 3:1: use os tokens semânticos, que já respeitam isso. Cor da marca nova → confira `--brand-primary` (TOKENS.md).
- Erros associados ao campo (`FormField` faz isso); mensagens de status com `role="status"`/`"alert"` (`Feedback`, `Toast`).
- Não use `<input type="date">` para datas visíveis ao usuário: use `DatePicker`.
- Mensagens que somem sozinhas (`Toast`) não devem conter informação indispensável; erros persistem por padrão.

## Verificação antes de concluir

```bash
npm run typecheck
npm run check:tokens
npm run storybook
```

No Storybook: confira claro/escuro e a aba Accessibility da story alterada.
