---
name: limpar
description: Revisão analítica para remover resíduo típico de código gerado por IA — funções/estilos duplicados, versões sobrepostas (v1/v2 convivendo), comentários e anotações antigas, heranças/props obsoletas, código morto e nomenclatura fora do padrão (não inglês). Cobre frontend, backend e banco de dados (tabelas/colunas não utilizadas). Gera um relatório de achados com arquivo:linha; NÃO edita nada sem aprovação explícita do usuário. Use quando o usuário pedir "revisão de limpeza", "código sobre código", "remover duplicação", "limpar código morto", "deixar pronto pra produção" ou similar.
---

# Objetivo

Depois de muitas iterações de IA sobre o mesmo código, é comum sobrar: função nova ao lado da antiga (que ninguém apagou), estilo CSS duplicado em `styles.css`, comentário explicando um comportamento que já não existe, prop/interface herdada de uma versão anterior do componente, `console.log` de debug, TODO esquecido.

Esta skill varre o código em busca desse resíduo e devolve um **relatório de achados**. Ela não decide sozinha o que sai do projeto — quem decide é o usuário.

Isso é diferente de `/code-review` (foca em bugs) e de `/simplify` (aplica simplificação direto). Esta skill é só sobre **resíduo/duplicação/lixo de produção**, e é sempre report-only.

---

# Escopo da revisão

Por padrão, revisar o **diff atual**:

```bash
git status
git diff
git diff --staged
git diff main...HEAD
```

Se o usuário indicar um arquivo ou pasta explicitamente (ex.: `/limpar src/components/Agenda` ou `/limpar backend/src/routes`), revisar tudo ali, mesmo sem mudanças recentes — útil para "limpeza geral" de um módulo antigo.

Ao revisar o diff, **ler o arquivo inteiro**, não só o hunk. Duplicação e sobreposição de versões só aparecem quando se vê o arquivo completo — o hunk mostra a função nova, mas a antiga (que devia ter sido removida) fica fora do diff.

O escopo cobre **frontend, backend e banco de dados**:

- Frontend (`src/`): componentes, hooks, estilos.
- Backend (`backend/src/routes`, `backend/src/services`, `backend/src/middleware`): rotas, serviços, middlewares.
- Banco de dados (`backend/src/db/migrations.js`): tabelas/colunas definidas ali. Este projeto não usa Drizzle nem uma pasta de migrations históricas — é um único arquivo com `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` idempotente. Ver seção "Revisão de banco de dados" abaixo antes de reportar qualquer coisa aqui.

Se o escopo tocar o backend, ler também `backend/AGENT.md` quando existir.

---

# Fluxo obrigatório

```txt
determinar escopo (diff ou caminho indicado)
→ ler arquivos completos envolvidos
→ procurar cada categoria de resíduo (ver CATEGORIAS.md)
→ para cada achado, confirmar com grep no repo inteiro antes de reportar
→ classificar por categoria e confiança
→ apresentar relatório ao usuário
→ perguntar quais achados aplicar
→ aplicar só os aprovados (Edit), um de cada vez
```

Leia [CATEGORIAS.md](CATEGORIAS.md) para o catálogo completo do que procurar, com exemplos.

---

# Confirmar antes de reportar (evitar falso positivo)

Antes de marcar algo como "morto" ou "duplicado":

- Rodar `grep`/busca pelo nome do símbolo em todo o repositório (não só na pasta atual) — import dinâmico, uso em teste ou em outro pacote do monorepo (`frontend/`, `backend/`) invalida o achado.
- Código legado em português (ver seção "English-Only Codebase" do `/AGENT.md`) **não é automaticamente código morto** — só reportar como resíduo se de fato não for mais referenciado em lugar nenhum.
- Duas funções parecidas só contam como "duplicadas" se fizerem a mesma coisa — validar a lógica antes de propor merge.
- Se não tiver certeza, reportar com confiança "suspeita" em vez de "confirmado", e explicar a dúvida.

---

# Revisão de banco de dados

Tratamento especial — dados são muito mais caros de recuperar do que código.

- Ler `backend/src/db/migrations.js` para ver o schema (tabelas/colunas atuais).
- Para cada tabela/coluna, `grep` pelo nome em `backend/src/routes`, `backend/src/services` e no frontend (payloads/respostas de API) — se não aparecer em nenhum SELECT/INSERT/UPDATE/response, é candidata a não utilizada.
- Achado de banco **nunca** é classificado como "confirmado" — sempre "suspeita", mesmo com grep limpo, porque pode haver dado histórico ou consumo fora do repo (relatório externo, export, integração).
- **Nunca editar `migrations.js`, gerar `ALTER TABLE`/`DROP COLUMN`, nem propor rodar qualquer migration** — isso é sempre manual e sempre exige decisão explícita do usuário, coluna por coluna. O papel desta skill aqui é só apontar o que parece órfão.
- Reportar separadamente de código: "Tabela/coluna `X` não referenciada em nenhuma query encontrada — confirmar manualmente antes de qualquer alteração de schema."

---

# Revisão de nomenclatura (inglês)

Ver seção "English-Only Codebase" do `/AGENT.md`: código novo deve usar nomes em inglês; código legado em português é dívida técnica aceita, não é para ser reescrito em massa sem pedido explícito.

Nesta skill:

- Verificar apenas os arquivos **dentro do escopo revisado** (diff atual, ou caminho indicado pelo usuário).
- Reportar identificador em português (função, variável, classe, tipo, arquivo, tabela/coluna nova) **apenas se for código novo/recente** (parte do diff) — não sinalizar código legado intocado só por estar em português.
- Se o usuário pedir explicitamente uma auditoria de nomenclatura de um módulo inteiro (não só o diff), aí sim listar todos os identificadores em português daquele módulo como achados de nomenclatura — mas isso é sempre suspeita/sugestão, nunca renomeado automaticamente (renomear em massa pode quebrar contrato frontend/backend).

---

# Formato do relatório

Agrupar por categoria, ordenado por confiança (confirmado antes de suspeita). Para cada achado:

```md
### [categoria] arquivo:linha
**O quê:** descrição curta do resíduo.
**Evidência:** trecho relevante ou resultado do grep que confirma (ex.: "0 outras referências no repo").
**Confiança:** confirmado | suspeita
**Recomendação:** remover / unificar com X / atualizar comentário
```

Ao final, um resumo:

```md
## Resumo
- N achados confirmados
- N achados suspeitos (peça revisão manual)
- Nenhuma alteração foi feita — aguardando aprovação
```

---

# Aprovação e aplicação

Depois do relatório, perguntar explicitamente:

```txt
Quais achados quer que eu aplique?

1. Todos os confirmados
2. Selecionar individualmente
3. Nenhum agora (só o relatório)
```

Só editar arquivos depois de aprovação explícita, e só os itens aprovados — nunca aplicar em massa itens marcados como "suspeita" sem confirmação item a item.

Depois de aplicar, rodar lint/typecheck do escopo afetado (ver `/AGENT.md` — `npm run lint`, `npm run typecheck`, ou os equivalentes com `--prefix frontend`/`--prefix backend`) para garantir que a remoção não quebrou nada.

Esta skill não faz commit nem push — isso é papel da skill `finalizar`.

---

# Proibições

- Não editar nada antes da aprovação explícita do usuário.
- Não marcar código legado em português como morto, nem como "nomenclatura errada", só por estar em português.
- Não tocar em `.env`, CI/CD, lockfiles.
- Não editar `backend/src/db/migrations.js`, nem gerar/rodar `ALTER TABLE`, `DROP COLUMN` ou qualquer migration.
- Não fazer commit/push.
- Não remover código só porque "parece" não-idiomático — o critério é resíduo/duplicação/lixo, não estilo pessoal.
- Não renomear identificadores em massa sem pedido explícito do usuário (risco de quebrar contrato frontend/backend).

---

# Quando parar e pedir intervenção

- Achado com alto impacto (ex.: remover algo usado em rota pública ou fluxo multi-tenant) mesmo que grep não mostre uso — perguntar antes.
- Dúvida se uma "duplicação" é na verdade uma variação intencional (ex.: validação diferente por role) — reportar como suspeita, não como confirmado.
