# Sistema · Admin MAGLEV

Protótipo navegável de referência do Admin da plataforma (RF001–RF407, Especificação Funcional v0.4). React + TypeScript + Vite.
Os componentes, tokens e ícones vêm do Storybook deste repositório (`@maglev/ds` → `../src`); nada é copiado.

```bash
npm install
npm run dev:sistema     # http://127.0.0.1:5176/ (Navegador de Protótipo: Desktop/Mobile, Claro/Escuro, Notas para desenvolvimento)
npm run build:sistema   # saída em sistema/dist
```

- Telas: `admin/screens/*.html` + `admin/shared/*.tsx`. Tela nova: registrar em `prototype-nav/config.ts` e em `SCREENS` de `vite.config.ts`.
- Dados de demonstração: `admin/shared/data.ts`; persistência em localStorage (`maglev.v2.db`), com “Restaurar dados de demonstração” no navegador.
- Login: qualquer e-mail @maglev.com.br + `Maglev@123` (`kleber.antunes@maglev.com.br` está inativo); código de recuperação `111111`.

Publicado em https://plathanus-tech.github.io/maglev-design/sistema/ (workflow `storybook-pages.yml`).

## Regras de UI
- Layout só com componentes do Storybook; `admin/shared/page.css` não tem valores fixos (apenas tokens).
- Subtítulos nunca terminam com ponto final.
- Campos obrigatórios sem asterisco; opcionais com “(opcional)” (prop `optional` do DS).
- Breadcrumb só com hierarquia real e estável: `Usuários > Nome`, `Usuários > Editar`, `Usuários > Novo usuário`
  (idem Assinantes e Perfis). Nunca espelha a sidebar nem o caminho percorrido; telas de Configurações não têm breadcrumb.
