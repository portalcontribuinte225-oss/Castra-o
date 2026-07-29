---
name: limpar
description: Analytical dead code and duplication audit for AI-generated codebases — detects dead code, code duplication, overlapping versions (v1/v2 coexistence), stale comments, obsolete props/interfaces, debug artifacts, orphaned routes, unused dependencies, misplaced code, unnecessary abstractions, forgotten feature flags, inconsistent patterns, redundant defensive guards, hardcoded values, incomplete removals masked with !important/specificity overrides, and concealed rather than removed code (display:none, if(false), commented-out blocks, disabled flags used to hide instead of delete). Covers frontend, backend, and database schema (orphaned tables/columns). Produces a findings report with file:line references; operates in report-only mode — no edits without explicit user approval. Trigger when user says "limpeza", "código sobre código", "remover duplicação", "dead code", "deixar pronto pra produção", "código bagunçado" or similar.
---

# Objetivo

Após múltiplas iterações de IA sobre o mesmo código, é comum acumular: function nova ao lado da antiga (que nunca foi removida), estilo CSS duplicado em `styles.css`, stale comment descrevendo comportamento que não existe mais, obsolete prop herdada de uma versão anterior do componente, `console.log` esquecido, feature flag cujo rollout já terminou.

Esta skill executa um dead code and duplication audit sobre o código e retorna um **findings report**. Ela opera em **report-only mode** — nenhuma edição é feita sem aprovação explícita do usuário.

Diferença em relação a outras skills:
- `/code-review` → foca em bugs e correctness
- `/simplify` → aplica simplificação diretamente
- `/limpar` → exclusivamente **resíduo, duplication, dead code** — sempre report-only até aprovação

---

# Scope Resolution

Por padrão, auditar o **diff atual**:

```bash
git status
git diff
git diff --staged
git diff main...HEAD
```

Se o usuário indicar um arquivo ou pasta explicitamente (ex.: `/limpar src/components/Agenda`), auditar tudo ali independente de mudanças recentes — útil para limpeza geral de módulo legado.

Ao revisar o diff, **ler o arquivo inteiro**, não só o hunk. Code duplication e version coexistence só aparecem com visão completa do arquivo — o hunk mostra a função nova, mas a antiga (dead code) fica fora do diff.

**Scope por camada:**

- Frontend (`src/`): componentes, hooks, estilos
- Backend (`backend/src/routes`, `backend/src/services`, `backend/src/middleware`): rotas, services, middlewares
- Database (`backend/src/db/migrations.js`): orphaned tables/columns — ver seção "Database Audit" abaixo antes de reportar qualquer achado aqui

Se o scope tocar o backend, ler também `backend/AGENT.md` quando existir.

---

# Fluxo Obrigatório

```txt
1. scope resolution (diff ou caminho indicado)
2. ler arquivos completos envolvidos
3. executar symbol search (grep) monorepo-wide para cada candidato
4. auditar cada categoria de resíduo (ver CATEGORIAS.md)
5. classificar achados por categoria e confidence level
6. apresentar findings report ao usuário
7. perguntar quais achados aplicar (explicit approval gate)
8. aplicar apenas os aprovados, um por vez
9. rodar lint/typecheck pass no scope afetado
```

Leia [CATEGORIAS.md](CATEGORIAS.md) para o catálogo completo de categorias com exemplos.

---

# False Positive Prevention

Antes de marcar qualquer símbolo como dead code ou duplicate:

- Executar **monorepo-wide symbol search** (`grep` pelo nome exportado em `frontend/` e `backend/`) — dynamic import, uso em teste, ou consumo por outro pacote do monorepo invalida o achado
- Código legado em português (ver "English-Only Codebase" no `/AGENT.md`) **não é automaticamente dead code** — só reportar se não houver nenhuma referência no repositório
- Duas funções parecidas só configuram code duplication se executarem a mesma lógica — validar o corpo antes de propor merge
- Em caso de dúvida, classificar como `suspected` com explicação da incerteza, nunca como `confirmed`

## Incomplete Removal Masked com `!important`

Alto valor neste projeto (`styles.css` ~26k linhas, forte duplicação entre módulos `ag-`, `cr-`, `reports-`): executar `grep` por `!important` no diff/scope e, para cada ocorrência, verificar se o comentário adjacente menciona "sobrepor", "vencer" ou "fora de escopo" uma regra específica. Se a regra "vencida" pertence ao mesmo módulo sendo auditado, isso é **incomplete removal** (categoria 13 em CATEGORIAS.md) — a correção correta é remover a classe do combined selector compartilhado, não manter duas regras em conflito com specificity override.

---

# Database Audit

Tratamento especial — dados têm custo de recuperação muito maior que código.

- Ler `backend/src/db/migrations.js` para mapear o schema atual (tabelas/colunas)
- Para cada tabela/coluna, executar symbol search em `backend/src/routes`, `backend/src/services` e no frontend (API payloads/responses) — ausência em todo SELECT/INSERT/UPDATE/response é sinal de orphaned schema
- Achados de database **nunca** recebem confidence level `confirmed` — sempre `suspected`, mesmo com grep limpo, pois pode haver consumo externo ao repo (relatório externo, export, integração de terceiros)
- **Nunca editar `migrations.js`, gerar `ALTER TABLE`/`DROP COLUMN`, nem propor execução de migration** — decisão sempre manual, coluna por coluna, pelo usuário
- Reportar separadamente do código: `"Table/column X — no references found in any query. Confirm manually before any schema change."`

---

# Naming Convention Audit

Ver "English-Only Codebase" no `/AGENT.md`: código novo deve usar identificadores em inglês; código legado em português é technical debt aceita, não deve ser reescrita em massa sem pedido explícito.

Nesta skill:

- Auditar naming conventions **apenas dentro do scope revisado** (diff atual ou caminho indicado)
- Reportar identifier em português (função, variável, classe, tipo, arquivo, tabela/coluna) **somente se for código novo/recente** — não sinalizar legado intocado
- Se o usuário pedir auditoria explícita de nomenclatura de um módulo inteiro, listar todos os identifiers em português como achados de naming convention — sempre `suspected`, nunca renomeado automaticamente (risco de quebrar contrato frontend/backend)

---

# Formato do Findings Report

Agrupar por categoria, ordenado por confidence level (`confirmed` antes de `suspected`). Para cada achado:

```md
### [categoria] arquivo:linha
**What:** descrição curta do resíduo.
**Evidence:** resultado do symbol search ou trecho que confirma (ex.: "0 references found monorepo-wide").
**Confidence:** confirmed | suspected
**Recommendation:** remove / merge with X / update stale comment / move to correct layer
```

Ao final, summary obrigatório:

```md
## Summary
- N confirmed findings
- N suspected findings (manual review required)
- Report-only mode — no changes applied — awaiting explicit approval
```

---

# Explicit Approval Gate e Aplicação

Após o findings report, perguntar:

```txt
Quais achados quer que eu aplique?

1. Todos os confirmed
2. Selecionar individualmente
3. Nenhum agora (só o relatório)
```

Editar arquivos apenas após approval explícita, e apenas os itens aprovados — nunca aplicar em massa itens `suspected` sem confirmação individual.

**Fase de aplicação (após approval):** responder `codando...` e aplicar as edições em segundo plano, sem narrar cada arquivo ou colar diffs no chat. Minimizar tool calls (agrupar edições relacionadas, evitar reler o mesmo trecho). Ao concluir, resumir em poucas linhas: achados aplicados vs. pulados, resultado do lint/typecheck pass — sem código, encerrando com "o que fazer agora?".

A fase de findings report (antes da approval) continua completa — é o entregável principal desta skill, não deve ser resumida.

Após aplicar, executar lint/typecheck pass do scope afetado (ver `/AGENT.md` — `npm run lint`, `npm run typecheck`, ou equivalentes com `--prefix frontend`/`--prefix backend`) para garantir que nenhuma remoção quebrou o build.

Esta skill não executa commit nem push — isso é responsabilidade da skill `finalizar`.

---

# Proibições

- Não editar nada antes da explicit approval do usuário
- Não classificar código legado em português como dead code ou naming convention violation por estar em português
- Não tocar em `.env`, CI/CD, lockfiles
- Não editar `backend/src/db/migrations.js` nem gerar/executar `ALTER TABLE`, `DROP COLUMN` ou qualquer migration
- Não fazer commit/push
- Não remover código por parecer não-idiomático — o critério é resíduo/duplication/dead code, não preferência de estilo
- Não renomear identifiers em massa sem pedido explícito (risco de quebrar contrato frontend/backend)

---

# Concealed Rather Than Removed

Padrão comum em refatorações feitas por IA: em vez de deletar o código substituído, a IA o **oculta** — deixando dead code disfarçado que infla o bundle, confunde leitura e nunca é limpo naturalmente.

Verificar ativamente no diff/scope:

- `display: none` / `visibility: hidden` / `opacity: 0` adicionados onde o elemento deveria ter sido removido do JSX
- `{false && <Component />}` ou `{null && ...}` — componente nunca renderiza
- `if (false) { ... }` ou `if (0) { ... }` em lógica JS/TS
- Blocos inteiros comentados (`/* código antigo */`, `// TODO: remover`)
- `return null` no topo de um componente que deveria ter sido deletado
- Feature flag criada com valor fixo `false` para "desativar" em vez de remover
- `enabled: false` / `active: false` em objeto de config sem plano de reativação
- `// @ts-ignore` ou `// eslint-disable` adicionados para suprimir erro de código que deveria ter saído

Ver categoria 18 em [CATEGORIAS.md](CATEGORIAS.md).

---

# Quando Parar e Pedir Intervenção

- Achado com alto impacto (ex.: remover símbolo usado em rota pública ou fluxo multi-tenant) mesmo com symbol search limpo — perguntar antes de aplicar
- Dúvida se uma aparente duplication é variação intencional (ex.: validação diferente por role/tenant) — reportar como `suspected`, nunca `confirmed`
- Achado em database schema com qualquer indício de consumo externo — reportar como `suspected` e recomendar validação manual
