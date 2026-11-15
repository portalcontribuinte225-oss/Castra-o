# Reescrita completa do sistema (frontend + backend)

## Objetivo

Reescrever o sistema municipal de castração animal do zero — frontend e backend — eliminando código legado, remendos, sobreposições de CSS e comentários/anotações de correções acumuladas ao longo do tempo, como se o sistema estivesse sendo construído em uma única vez, com arquitetura limpa desde o início.

## Paridade funcional

Manter exatamente as mesmas telas, fluxos e regras de negócio existentes hoje (reescrita 1:1) — não é uma revisão de UX, é uma reorganização estrutural do código por baixo.

## Escopo

- **Frontend**: `src/App.tsx` (~12 mil linhas, componente monolítico) quebrado em módulos por domínio (componentes, hooks, PDF generation, features), seguindo as regras de Single Responsibility, separação de camadas e tamanho de arquivo (150–400 linhas) já definidas no `/AGENT.md` do próprio projeto.
- **CSS**: `src/styles.css` (~26 mil linhas, com duplicação confirmada entre módulos `ag-`, `cr-`, `reports-`, e uso de `!important` para sobrepor regras antigas em vez de removê-las) reorganizado sem sobreposição.
- **Backend**: `backend/src` também entra na reescrita (já é razoavelmente modular por rotas, mas deve ser revisado nos mesmos critérios).
- **Nomenclatura**: inglês em todo o código novo/reescrito, seguindo a seção "English-Only Codebase" do `/AGENT.md`.

## Fora de escopo

Mudanças de UX/fluxo, novas funcionalidades, alterações de regra de negócio.

## Estratégia de entrega

Fatias pequenas por módulo/domínio — não é uma reescrita monolítica de uma vez. Cada fatia deve ser validada manualmente pelo usuário no navegador (subindo o app com a skill `rodar`) antes de prosseguir para a próxima, já que a magnitude da mudança não é verificável apenas por `typecheck`/`build`.

## Contexto adicional

- Este projeto **ainda não foi para produção** — não há usuários reais dependendo do comportamento atual, o que reduz (mas não elimina) o risco de uma reescrita ampla.
- O projeto não usa branch `staging` nem PR — fluxo é commit direto em `main` (mas dado o risco desta mudança específica, vale considerar com o usuário, durante o planejamento, se abrir uma branch temporária faz sentido aqui, mesmo fora do padrão usual do projeto).
- O `/AGENT.md` do projeto já proíbe explicitamente "God Files" e já pede a separação de camadas que esta reescrita busca aplicar — ou seja, a reescrita é uma aplicação retroativa das próprias regras que o projeto já declara seguir.
