# Plano de Implementação: {Nome da Feature}

## Origem

- Arquivo de especificação: `{FEATURE_FILE}`
- Data do planejamento: `{DATA_ATUAL}`
- Classificação: `frontend-only | backend-only | fullstack | backend + database | frontend + backend + database | infra/deploy | documentação`

---

## Resumo

Explique em poucas frases o que será implementado e por quê.

---

## Escopo

### Dentro do escopo

- Item 1

### Fora do escopo

- Item 1

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md`
- `{FEATURE_FILE}`
- outros arquivos relevantes encontrados no projeto

---

## Impacto por área

### Frontend

Descreva alterações necessárias. Inclua: telas, componentes, hooks, forms, validações, estados de loading/error/empty, testes.

_Se não houver impacto: `Sem impacto esperado`_

### Backend

Descreva alterações necessárias. Inclua: rotas/endpoints, services, repositories, validações, permissões, regras multi-tenant, relatórios/PDFs, testes.

_Se não houver impacto: `Sem impacto esperado`_

### Banco de dados

Descreva alterações de schema. Inclua: tabelas, colunas, índices, migrations necessárias, riscos.

_Se não houver impacto: `Sem impacto esperado`_

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Descreva impactos. Inclua: env vars, Render, build, jobs, workers, storage, filas, timeouts.

_Se não houver impacto: `Sem impacto esperado`_

---

## Arquivos provavelmente afetados

- `src/features/...`
- `src/App.tsx` _(arquivo grande: citar só os trechos afetados)_
- `backend/src/routes/...`
- `backend/src/services/...`
- `backend/src/repositories/...`
- `shared/...`

---

## O que será removido

Liste explicitamente tudo que deve ser **deletado** nesta implementação — não ocultado, não comentado, não desativado por flag.

Inclua:

- funções/métodos substituídos pela nova implementação
- componentes trocados por versões novas
- rotas/endpoints substituídos ou extintos
- estilos CSS do elemento/componente removido
- tipos/interfaces que deixarão de existir
- colunas/tabelas descontinuadas _(requer migration manual — não executar automaticamente)_
- feature flags de rollout a remover após go-live
- imports que ficarão órfãos

_Se não houver nada a remover: `Nenhuma remoção prevista nesta implementação.`_

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

Passo a passo para a skill `implementar`:

1. Passo 1
2. Passo 2
3. Passo 3

---

## Regras de negócio identificadas

Liste as regras extraídas do `.md` da feature.

---

## Regras multi-tenant e segurança

- Origem confiável do tenant/prefeitura
- Permissões necessárias
- Prevenção de vazamento entre prefeituras
- Validações backend
- Impacto em relatórios/PDFs

---

## Validações necessárias

Liste validações de input, formulário, schemas, params, query strings e payloads.

---

## Testes necessários

### Frontend

- teste 1

### Backend

- teste 1

### Conferência manual (tela)

- o que o usuário deve conferir

---

## Comandos de validação sugeridos

```bash
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

---

## Riscos e pontos de atenção

- risco de vazamento multi-tenant
- risco de timeout em PDF
- risco de quebrar contrato frontend/backend
- risco de alterar migrations antigas
- risco de afetar produção _(commit/push direto em `main`, sem `staging`)_

---

## Perguntas em aberto

Liste dúvidas que precisam de confirmação antes ou durante a implementação.

_Se não houver: `Nenhuma pergunta em aberto identificada.`_

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- critério 1
- critério 2

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
