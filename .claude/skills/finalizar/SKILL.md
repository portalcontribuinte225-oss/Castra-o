---
name: finalizar
description: Finaliza uma implementação já realizada, conferindo as alterações do repositório, executando validações, criando commit e dando push direto em `main`. Este projeto não usa branch `staging` nem Pull Request — o fluxo é direto em `main`. Essa skill deve ser executada normalmente após a skill `implementar`, mas também pode ser chamada diretamente pelo usuário.
---

# Objetivo

Garantir que toda alteração seja revisada, validada e commitada com uma mensagem clara antes de ir direto para `main` — sem introduzir secrets, migrations não autorizadas ou regressões óbvias.

Este projeto **não tem branch `staging`** e **não usa Pull Request**. O fluxo de trabalho é commit + push direto em `main`.

---

# Comunicação durante a execução

O usuário não quer ver código, diffs nem explicações passo a passo enquanto a skill trabalha.

- Ao começar, responda só `codando...` (ou equivalente curto).
- Durante a revisão/validação: trabalhe em silêncio, sem narrar cada arquivo lido ou comando rodado.
- O resumo do passo 3 ("Revisar alterações antes do commit") deve ser apresentado, mas curto — lista de arquivos e o objetivo em 1 linha, nunca o diff colado no chat.
- Ao final (passo 10), use o formato compacto da seção "Resultado esperado" — sem código/diff, terminando com "o que fazer agora?".
- Minimize o número de chamadas de ferramenta (git status/diff/log, Read, Bash): agrupe o que der, evite repetir a mesma consulta. O painel de atividade de ferramentas da interface do Claude Code (que mostra cada Read/Edit/Bash com preview) é renderizado automaticamente e não pode ser suprimido por esta skill — só o texto de resposta e a quantidade de chamadas estão sob controle.

---

# Fluxo Geral

```txt
conferir estado do repositório
→ conferir plano relacionado (se existir)
→ revisar alterações
→ regra para arquivos sensíveis
→ regra para migrations
→ rodar checks do projeto
→ staged apenas dos arquivos relevantes
→ commit
→ push direto em main
```

---

# 1. Conferir estado atual do repositório

Executar:

```bash
git status
git branch --show-current
git diff
git diff --staged
```

Identificar:

* arquivos modificados
* arquivos staged
* arquivos untracked
* conflitos
* alterações pendentes
* arquivos sensíveis
* migrations
* artefatos de build
* arquivos temporários

Se não houver alterações para commitar, informar o usuário e parar.

Confirmar que a branch atual é `main` (é a única branch de trabalho deste projeto). Se por algum motivo a branch atual não for `main`, informar o usuário antes de prosseguir — não assumir automaticamente o que fazer.

---

# 2. Conferir plano relacionado

Se existir um plano em:

```txt
.portal/plans/
```

ou caminho equivalente informado pelo usuário, ler o plano antes de finalizar.

Verificar se as alterações realizadas aderem ao plano.

O commit deve mencionar o plano relacionado quando existir (ex.: no corpo da mensagem de commit).

---

# 3. Revisar alterações antes do commit

Executar uma revisão técnica das alterações.

Verificar:

* aderência ao plano
* aderência aos arquivos `AGENT.md`
* código morto
* console.log esquecidos
* TODO/FIXME temporários
* imports não utilizados
* arquivos não utilizados
* possíveis regressões
* alterações acidentais
* arquivos sensíveis
* mudanças em lockfiles
* mudanças em migrations

Executar:

```bash
git diff
git diff --staged
git status
```

Produzir um resumo técnico contendo:

* arquivos alterados
* objetivo das alterações
* riscos
* pontos que merecem revisão humana

Apresentar esse resumo ao usuário antes de commitar/dar push.

---

# 4. Regra para arquivos sensíveis

Parar e pedir intervenção se houver alterações ou arquivos novos contendo:

```txt
.env
.env.*
*.pem
*.key
*.pfx
*.p12
certificates/
secrets/
credentials/
private-key
service-account
```

Nunca commitar certificados, chaves privadas, senhas, tokens ou secrets.

---

# 5. Regra para migrations

Nunca executar migrations sem autorização explícita do usuário.

Se houver alterações em:

```txt
drizzle/
migrations/
prisma/migrations/
db/migrations/
supabase/migrations/
```

A skill deve:

1. Identificar a migration.
2. Informar o usuário.
3. Não executar nenhum comando de migration sem confirmação explícita.

Também não deve rodar comandos como:

```bash
drizzle-kit push
drizzle-kit migrate
prisma migrate
knex migrate
```

sem autorização explícita.

---

# 6. Rodar checks do projeto

Identificar o gerenciador de pacotes:

* pnpm-lock.yaml → pnpm
* yarn.lock → yarn
* package-lock.json → npm
* bun.lockb ou bun.lock → bun

Ler `package.json`.

Rodar os checks disponíveis, respeitando scripts existentes:

```bash
lint
test
build
typecheck
```

Exemplos:

```bash
pnpm lint
pnpm test
pnpm build
```

ou equivalentes conforme gerenciador.

Se um check não existir, não inventar comando — registrar isso no resumo final.

Se algum check falhar:

* informar o erro
* não criar commit
* parar o fluxo

---

# 7. Fazer stage apenas dos arquivos relevantes

Não usar:

```bash
git add .
```

A skill deve analisar os arquivos alterados e adicionar apenas os arquivos relevantes.

Usar:

```bash
git add <arquivo-1> <arquivo-2>
```

Depois conferir:

```bash
git status
git diff --staged
```

Se houver dúvida se um arquivo deve entrar no commit, deixar fora e informar o usuário.

---

# 8. Criar commit

Criar commit seguindo Conventional Commits.

Exemplos:

```txt
feat: add async pdf generation flow
fix: prevent external requests during pdf rendering
refactor: move pdf generation to worker
chore: add pdf job infrastructure
```

A mensagem deve refletir as alterações reais.

Antes do commit, garantir que:

* staged files são apenas os relevantes
* checks passaram ou foram declaradamente inexistentes
* nenhum arquivo sensível está staged

---

# 9. Push direto em main

Executar:

```bash
git push origin main
```

Nunca utilizar:

```bash
git push --force
git push -f
```

sem autorização explícita do usuário.

---

# 10. Resultado esperado

Sem código, sem diff. Curto:

```md
finalizei.

- commit: <hash curto> — <mensagem em 1 linha>
- checks: typecheck ok, build ok (ou: o que falhou)
- push: feito, main sincronizado com origin/main
- [só se houver] riscos/observações em 1 linha

o que fazer agora?
```

---

# Regras absolutas

* Sempre commitar e dar push direto em `main` — não há `staging` nem PR neste projeto.
* Nunca usar `git add .`.
* Nunca commitar secrets.
* Nunca commitar certificados.
* Nunca executar migrations sem confirmação explícita.
* Nunca usar force push sem autorização explícita.
* Nunca usar `git reset --hard` sem autorização explícita.
* Nunca descartar alterações do usuário.
* Nunca resolver conflitos automaticamente se houver risco de perda de código.
* Não esconder falhas de lint, test ou build.

---

# Quando parar e pedir intervenção

Parar se:

* não houver alterações
* a branch atual não for `main`
* houver conflito de merge/push (ex.: `origin/main` avançou e o push é rejeitado)
* lint/test/build/typecheck falhar
* houver arquivo sensível
* houver migration que exigiria execução
* não for possível identificar o gerenciador de pacotes
* houver dúvida sobre arquivo que deve ou não ser commitado
