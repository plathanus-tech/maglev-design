# Área do assinante (protótipo v2)

Frente "Área do Assinante" da Especificação Funcional (MAGLEV v0.4). Mesmo app Vite do Admin (`npm run dev:v2`,
http://127.0.0.1:5176/), escolhendo **Ator → Assinante** no Navegador de Protótipo. Telas: `assinante/screens/*.html`
+ `assinante/shared/*.tsx` (uma entrada por tela, descoberta automaticamente pelo `vite.config.ts`).

Fonte da especificação: `C:\Users\conta\Downloads\Especificação Funcional-20261001093648.md`
(seção "Área do Assinante", linhas ~1101-2466; consulte o RF da tela que está fazendo).

## Regras de design (vêm do Admin - valem aqui sem exceção)
- **Layout = Storybook.** Estrutura só com componentes do `@maglev/ds` (Stack, Card, Table, Tab, Dialog, KpiCard, Badge,
  Feedback, Accordion, Input `readOnly` para campos em leitura…). Nada de div/CSS próprio para caixa, espaçamento ou superfície;
  nenhum token novo; nenhum componente novo no Storybook. Se faltar uma peça (gráfico, linha do tempo, QR Code, árvore, stepper),
  componha com o DS e, só no mínimo, use CSS num arquivo da própria tela (`assinante/shared/<tela>.css`) com **tokens existentes**
  (`storybook-maglev/src/tokens/tokens.css`) - zero valores fixos.
- Grid de página: `Grid`/`Col` de `admin/shared/ui.tsx` (4·8·12 colunas). Título/subtítulo: `PageHeader` do `AppLayout`.
- **Subtítulos nunca terminam com ponto final** (Card, Dialog, PageHeader, Table, cards no mobile…).
- **Campos obrigatórios não levam asterisco** - só os opcionais, com a prop `optional` do DS; `required` vai ao controle (a11y).
  Erro de campo obrigatório: sempre "O campo [nome] é obrigatório" (`requiredMessage`).
- **Breadcrumb só com hierarquia real de páginas navegáveis e estável** (Lista > Visualização: `Equipamentos > Nome`;
  Edição: `Equipamentos > Editar`; Cadastro: `Equipamentos > Novo equipamento`). Telas de menu/Configurações ficam sem breadcrumb.
- Tabelas: `Table` do DS com `TableToolbar` (busca + filtros), paginação 10, ações por linha com `RowAction`, coluna de ações
  `sticky: 'right'`; **mobile (< 768px, `useIsMobile()`) vira `MobileCardList`** com as mesmas linhas. Toda tabela de listagem tem o botão **Exibição** (`useColumnPrefs`/`ColumnsControl`; é a FE011, incluída a pedido para avaliação). Listagem com **2+ filtros** usa `FilterControl` (botão "Filtros", valor "todos" = sem filtro); com 1 filtro, ele fica solto na barra.
- Estados de tela por `#state=<estado>` com `useHashState` (como no Admin); registrar cada variante no navegador.
- Notas para desenvolvimento: `<DevNote note="...">elemento</DevNote>` (cite o RF/RGN/CTA; marque 💡 o que está a confirmar).
- Dados só de restaurante (cozinha profissional). Datas/valores: `admin/shared/format.ts` (`formatMoney` recebe centavos).
- Tema claro/escuro e mobile precisam funcionar (só tokens). Toast pós-ação: `setFlash` + `takeFlash` (como no Admin).
- Fora do escopo (FE001 SLA, FE002 WhatsApp, FE004 emergência, FE005 solicitação detalhada, FE006 aprovação de cadastro,
  FE007 garantia na OS, FE008 documentos, FE010 exportar, FE011 colunas, FE013 estágio, FE015 tutorial, FE017 biblioteca): não criar.

## Base compartilhada (não alterar sem avisar)
- `shared/data.ts` - tipos + carga inicial (Cantina Dona Rosa, ASS-0001). `shared/store.ts` - `useSubDb`, `updateSubDb`,
  `useSubSession` (`user`, `can(tela, ação)`, `unitIds`, `canSeeCosts`, `company`), `notify`, `nextSeq`, `logEntry`, ajudantes.
- `shared/AppLayout.tsx` - `AppLayout active=<item do menu> screen=<ScreenKey>`, `PageHeader`, `mountApp`.
- `shared/ui.tsx` - `useRefs()` (status/prioridade/criticidade/categoria/tipos do Admin, só leitura), `TroubleshootingNotes`
  e reexport dos atalhos do Admin. Telas do Admin reutilizáveis: `admin/shared/{MobileCardList,AuthLayout,ChangePasswordDialog,
  UserMenu,useHashState,useMediaQuery,format,recovery,cep}`.
- Configurações globais (Admin RF402-RF407) vêm de `useRefs()` / `useAdminDb()` - o assinante não edita.
- Permissões por perfil: `PERMISSIONS` em `data.ts`. Telas escondem ação sem permissão; Solicitante/Executor só veem
  as unidades vinculadas (`unitIds`); valores/custos só `canSeeCosts`. Variantes por perfil: `?as=<id do usuário>`
  (`userIdOf('gestor')`…) - ids reais: ver `seed()`; o usuário padrão é o Administrador.

## Mapa de telas (nomes de arquivo combinados - link entre telas usa estes nomes)
Acesso: `login` · `recuperar-senha` · `codigo-verificacao` · `criar-nova-senha` · `primeiro-acesso`
Início: `inicio` · Notificações: `notificacoes`
Estrutura: `empresa` · `unidades` · `unidade-form` (?id=) · `ambientes` · `equipe` · `membro-form` (?id=)
Equipamentos: `equipamentos` · `equipamento-form` (?id=) · `equipamento` (?id=)
Solicitações: `solicitacoes` · `solicitacao` (?id=, triagem) · `solicitacao-form` (?equipment=)
OS: `ordens-servico` · `os-form` (?request= para criar, ?id= para editar) · `os` (?id=, acompanhar)
Preventivas: `planos` · `plano` (?id=) · `plano-form` (?id=) · `execucao-preventiva` (?os=)
Prestadores: `prestadores` · `prestador` (?id=) · `prestador-form` (?id=)
Item do menu (`AppLayout active=`): `inicio` `equipamentos` `solicitacoes` `os` `planos` `prestadores` `empresa` `unidades` `ambientes` `equipe`.

## Registrar no Navegador de Protótipo
Cada módulo tem **um arquivo seu** em `prototype-nav/assinante/NN-modulo.ts` exportando `journeys: Journey[]` (mesmo formato de
`prototype-nav/config.ts`; caminhos como `assinante/screens/x.html#state=y`). Ids só precisam ser únicos dentro do seu arquivo.
Inclua as variantes de estado (erro, vazio, confirmação) e, onde fizer diferença, variantes por perfil (`?as=`).

## Ids de referência (configurações do Admin - carga inicial; use sempre `useRefs()` para nome/visual)
- Status de equipamento `STE-01` Em funcionamento · `02` Com alerta/falha · `03` Parado · `04` Em manutenção · `05` Inativo
- Status de solicitação `STS-01` Nova · `02` Em triagem · `03` Aguardando informação · `04` Aprovada · `05` Convertida em OS · `06` Recusada · `07` Concluída sem OS
- Status de OS `STO-01` Aberta · `02` Em andamento · `03` Aguardando orçamento · `04` Aguardando aprovação · `05` Aguardando peça/recurso · `06` Aguardando prestador · `07` Aguardando validação · `08` Concluída · `09` Cancelada
- Prioridade `PRI-1` Emergência · `2` Alta · `3` Média · `4` Baixa. Criticidade `CRI-A/B/C`. Tipo de manutenção `TMA-003` = Preventiva.
- Tipos de problema (solicitação) `TSO-001` Não liga · `002` Não refrigera · `003` Não aquece · `004` Vazamento · `005` Ruído anormal · `006` Elétrica · `007` Quebra física · `008` Outro.
- "Em aberto/pendente/concluído" decidem-se pela **situação-base** do status (`useRefs().base(id)`: aberto, andamento, aguardando, concluido, cancelado), não por id.
- Ciclo: solicitação encerra quando a OS encerra após a validação do solicitante (RF402-RGN004); solicitação convertida em OS fica `STS-05` e segue o status da OS.

## Filtros por URL (links entre telas, ex.: cards do Início). Quem tem a lista implementa; quem linka usa.
- `solicitacoes.html?filter=` `assigned-me` (atribuídas a mim) · `new` (novas) · `pending` (aprovadas + aguardando informação) · `triage` (em triagem) · `converted` (convertidas em OS); também `?equipment=EQP-0001`, `?unit=UNI-001`.
- `ordens-servico.html?filter=` `assigned-me` · `active` (ativas = abertas/andamento/aguardando) · `action` (ação necessária: aguardando aprovação/validação/peça) · `awaiting-validation` · `overdue` (prazo vencido) · `awaiting-technician` (aguardando prestador/técnico); também `?equipment=`, `?unit=`.
- `equipamentos.html?filter=` `stopped` · `alert` · `inactive`; `?unit=`. `planos.html?filter=` `overdue` · `upcoming`.
- Ao abrir com `filter`, mostre o filtro aplicado no controle da tela (dropdown de status/filtro) para o usuário poder tirá-lo.

## Verificação
- `npx tsc -p v2/tsconfig.json --noEmit` (use `../storybook-maglev/node_modules/.bin/tsc` se necessário) deve passar para os seus arquivos.
- Servidor próprio, **na porta que lhe foi atribuída** (outras portas são de outras pessoas): na raiz do projeto,
  `PORT=<porta> npx vite --config v2/vite.config.ts` (em background). Abra `http://127.0.0.1:<porta>/assinante/screens/<tela>.html` e
  confira também as variantes `#state=...`. Pode usar o navegador (abra a sua própria aba, feche ao terminar); no mínimo,
  faça `curl` do módulo `/assinante/shared/<tela>.tsx` para garantir que o Vite compila sem erro. Pare o seu servidor no fim.
