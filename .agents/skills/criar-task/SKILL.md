---
name: criar-task
description: Cria uma task tÃ©cnica estruturada a partir de uma descriÃ§Ã£o livre fornecida pelo usuÃ¡rio.
---

## DescriÃ§Ã£o

Cria uma task tÃ©cnica estruturada a partir de uma descriÃ§Ã£o livre fornecida pelo usuÃ¡rio.

A task gerada deve seguir um formato rico e detalhado, semelhante a uma especificaÃ§Ã£o de entrada para planejamento tÃ©cnico. Ela deve ser adequada para ser usada depois pela skill `planejar`.

A skill nÃ£o implementa cÃ³digo, nÃ£o cria plano de execuÃ§Ã£o e nÃ£o altera arquivos. Ela apenas transforma uma descriÃ§Ã£o informal em uma task tÃ©cnica clara, contextualizada e acionÃ¡vel, criando um arquivo no formato `{titulo}.md` em `.portal/tasks`.

---

# Quando usar

Use esta skill quando o usuÃ¡rio fornecer uma descriÃ§Ã£o de:

* problema tÃ©cnico
* melhoria
* refactor
* migraÃ§Ã£o
* bug
* dÃ­vida tÃ©cnica
* decisÃ£o arquitetural
* mudanÃ§a de padrÃ£o
* melhoria de seguranÃ§a
* melhoria de performance

Exemplo de entrada:

```txt
Hoje existem diversas strings mÃ¡gicas no cÃ³digo, o que quebra confianÃ§a e aumenta chance de erro. Precisamos padronizar o uso de enum nos lugares que fazem sentido.
```

---

# Objetivo

Gerar uma task em Markdown contendo contexto suficiente para que a skill `planejar` consiga criar um plano de implementaÃ§Ã£o seguro, pequeno e revisÃ¡vel.

A task deve explicar:

* o problema
* o contexto atual
* o objetivo
* a decisÃ£o tÃ©cnica desejada, quando houver
* o escopo
* o que estÃ¡ fora de escopo
* requisitos por camada
* regras de seguranÃ§a
* impacto multi-tenant
* requisitos de migraÃ§Ã£o
* requisitos de testes
* possÃ­veis arquivos afetados
* critÃ©rios de aceite
* perguntas para planejamento
* instruÃ§Ãµes para a skill `planejar`

---

# Fluxo obrigatÃ³rio

## 1. Ler instruÃ§Ãµes do projeto

Antes de criar a task, ler obrigatoriamente:

```txt
/AGENT.md
/frontend/AGENT.md
/backend/AGENT.md
```

Se algum arquivo nÃ£o existir:

* continuar com os arquivos disponÃ­veis
* mencionar na seÃ§Ã£o final quais arquivos foram considerados
* nÃ£o inventar regras ausentes

---

## 2. Interpretar a descriÃ§Ã£o do usuÃ¡rio

A skill deve identificar:

* problema principal
* motivaÃ§Ã£o
* impacto tÃ©cnico
* Ã¡rea afetada
* se envolve frontend
* se envolve backend
* se envolve banco de dados
* se envolve infraestrutura
* se envolve seguranÃ§a
* se envolve performance
* se envolve multi-tenant
* se envolve migraÃ§Ã£o
* se envolve testes
* se existe decisÃ£o tÃ©cnica jÃ¡ sugerida pelo usuÃ¡rio

---

## 3. Inspecionar o projeto quando necessÃ¡rio

Quando a descriÃ§Ã£o mencionar arquivos, mÃ³dulos, pÃ¡ginas, endpoints, tabelas, funÃ§Ãµes ou fluxos existentes, a skill deve inspecionar o projeto antes de gerar a task.

Exemplos:

* â€œo editor atualâ€
* â€œa geraÃ§Ã£o de PDFâ€
* â€œo fluxo de protocoloâ€
* â€œas strings mÃ¡gicas no backendâ€
* “a validação documental por IA”
* â€œo mÃ³dulo de documentosâ€

A task nÃ£o deve inventar caminhos de arquivos sem verificar.

Se nÃ£o for possÃ­vel verificar os arquivos:

* nÃ£o inventar caminhos
* escrever que os arquivos devem ser identificados durante o planejamento

---

# Formato obrigatÃ³rio da task gerada

A saÃ­da deve ser um arquivo Markdown com a seguinte estrutura.

Nem todas as seÃ§Ãµes precisam ter grande conteÃºdo, mas a estrutura deve ser preservada quando fizer sentido.

---

# Template da task

```md
# Task: <TÃ­tulo da task>

## Contexto

<Explique o contexto atual do problema. Descreva o sistema, mÃ³dulo, fluxo ou padrÃ£o afetado. Quando houver arquivos conhecidos e verificados, liste-os.>

## Problema

<Explique claramente o problema atual, por que ele Ã© ruim, quais riscos ele cria e qual dÃ­vida tÃ©cnica ele representa.>

## Objetivo

<Explique o objetivo da task sem transformar isso em plano de implementaÃ§Ã£o detalhado.>

## DecisÃ£o TÃ©cnica Desejada

<Descreva a direÃ§Ã£o tÃ©cnica desejada, quando existir. Se o usuÃ¡rio nÃ£o forneceu uma decisÃ£o tÃ©cnica clara, escrever que a decisÃ£o deve ser avaliada durante o planejamento.>

## Escopo Funcional

### Dentro do escopo

- <Item de escopo>
- <Item de escopo>

### Fora do escopo inicial

- <Item fora de escopo>
- <Item fora de escopo>

## Requisitos de Frontend

<Preencher quando houver impacto no frontend. Caso nÃ£o haja impacto conhecido, escrever â€œSem impacto frontend identificado inicialmente.â€>

## Requisitos de Backend

<Preencher quando houver impacto no backend. Caso nÃ£o haja impacto conhecido, escrever â€œSem impacto backend identificado inicialmente.â€>

## Requisitos de Banco de Dados

<Preencher quando houver impacto no banco. Caso nÃ£o haja impacto conhecido, escrever â€œSem alteraÃ§Ã£o de banco identificada inicialmente.â€>

## Requisitos de SeguranÃ§a e Multi-Tenant

<Descrever cuidados de seguranÃ§a, permissÃ£o, tenant isolation, dados sensÃ­veis, validaÃ§Ã£o e riscos de vazamento entre prefeituras.>

## Requisitos de MigraÃ§Ã£o ou Compatibilidade

<Descrever como preservar compatibilidade com cÃ³digo, dados, contratos ou fluxos existentes. Se nÃ£o houver migraÃ§Ã£o identificada, informar isso.>

## Requisitos de Testes

### Frontend

- <Teste esperado ou â€œNÃ£o aplicÃ¡vel inicialmente.â€>

### Backend

- <Teste esperado ou â€œNÃ£o aplicÃ¡vel inicialmente.â€>

### E2E

- <Teste esperado ou â€œNÃ£o aplicÃ¡vel inicialmente.â€>

## Arquivos Provavelmente Afetados

### Frontend

- <Arquivo, mÃ³dulo ou â€œA identificar durante o planejamento.â€>

### Backend

- <Arquivo, mÃ³dulo ou â€œA identificar durante o planejamento.â€>

### Banco de Dados

- <Arquivo, migration, schema ou â€œA identificar durante o planejamento.â€>

## CritÃ©rios de Aceite

- <CritÃ©rio objetivo>
- <CritÃ©rio objetivo>
- <CritÃ©rio objetivo>

## Perguntas Para o Planejamento

- <Pergunta relevante>
- <Pergunta relevante>

## InstruÃ§Ãµes Para a Skill Planejar

- Use este arquivo como especificaÃ§Ã£o de entrada.
- Leia `/AGENTS.md`, `/frontend/AGENTS.md` e `/backend/AGENTS.md`.
- Inspecione os arquivos citados antes de escrever o plano.
- Classifique a implementaÃ§Ã£o como `frontend`, `backend`, `database`, `infra` ou combinaÃ§Ã£o deles.
- NÃ£o implemente cÃ³digo durante o planejamento.
- NÃ£o instale dependÃªncias durante o planejamento.
- NÃ£o execute migrations.
- Gere um plano em `.portal/plans/` com etapas pequenas, revisÃ¡veis e seguras para produÃ§Ã£o (este projeto nÃ£o usa branch `staging` â€” commit/push sÃ£o feitos direto em `main`).
```

---

# Regras de escrita

* Escrever a task em portuguÃªs.
* Ser tÃ©cnico, claro e objetivo.
* NÃ£o exagerar o escopo.
* NÃ£o transformar a task em plano.
* NÃ£o criar etapas de implementaÃ§Ã£o detalhadas.
* NÃ£o inventar arquivos.
* NÃ£o inventar decisÃµes tÃ©cnicas nÃ£o dadas pelo usuÃ¡rio.
* NÃ£o assumir que uma mudanÃ§a Ã© apenas frontend ou apenas backend sem evidÃªncia.
* Quando houver dÃºvida, registrar em â€œPerguntas Para o Planejamentoâ€.
* Manter a task rica o suficiente para guiar a skill `planejar`.

---

# Regras de nomenclatura

A task pode ser escrita em portuguÃªs, mas deve respeitar o padrÃ£o do projeto:

* cÃ³digo novo deve ser em inglÃªs
* arquivos novos devem ser em inglÃªs
* nomes tÃ©cnicos devem seguir inglÃªs quando forem nomes de cÃ³digo
* portuguÃªs existente no projeto deve ser tratado como legado

Se a task envolver criaÃ§Ã£o ou renomeaÃ§Ã£o de cÃ³digo, mencionar que a implementaÃ§Ã£o deve seguir nomenclatura em inglÃªs.

---

# CritÃ©rios para um bom tÃ­tulo

O tÃ­tulo deve ser:

* curto
* especÃ­fico
* tÃ©cnico
* orientado ao problema
* sem exagero de escopo

Bons exemplos:

```txt
Padronizar valores de domÃ­nio com enums
```

```txt
Migrar editor de documentos para Tiptap
```

```txt
Isolar geraÃ§Ã£o de PDFs em jobs assÃ­ncronos
```

```txt
Criar fluxo auditável de validação documental por IA
```

Exemplos ruins:

```txt
Arrumar cÃ³digo
```

```txt
Melhorar tudo
```

```txt
Refatorar sistema inteiro
```

---

# Regras para escopo

A skill deve separar explicitamente:

## Dentro do escopo

Aquilo que precisa ser considerado para resolver o problema.

## Fora do escopo inicial

Aquilo que poderia ser relacionado, mas nÃ£o deve entrar na primeira entrega.

Isso evita que a skill `planejar` gere planos grandes demais.

---

# Regras para arquivos afetados

A seÃ§Ã£o â€œArquivos Provavelmente Afetadosâ€ deve seguir estas regras:

* listar arquivos apenas quando eles forem informados pelo usuÃ¡rio ou verificados no projeto
* nÃ£o inventar caminhos
* se houver incerteza, usar â€œA identificar durante o planejamentoâ€
* separar por frontend, backend e banco de dados

---

# Regras para critÃ©rios de aceite

CritÃ©rios de aceite devem ser verificÃ¡veis.

Bons exemplos:

```txt
- Valores de status conhecidos usam enum ou constante tipada centralizada.
- NÃ£o existem novas strings mÃ¡gicas para domÃ­nios finitos nos arquivos alterados.
- Frontend e backend continuam compatÃ­veis.
```

Exemplos ruins:

```txt
- CÃ³digo melhorado.
- Sistema mais bonito.
- Tudo funcionando.
```

---

# Exemplo

Entrada:

```txt
Hoje existem diversas strings mÃ¡gicas no cÃ³digo, o que quebra confianÃ§a e aumenta chance de erro. Precisamos padronizar o uso de enum nos lugares que fazem sentido.
```

SaÃ­da esperada:

````md
# Task: Padronizar valores de domÃ­nio com enums

## Contexto

O sistema possui frontend e backend em um monorepo multi-tenant para mÃºltiplas prefeituras. Existem valores de domÃ­nio representados diretamente como strings literais em diferentes pontos do cÃ³digo, como status, labels, validaÃ§Ãµes, tipos de documento, permissÃµes e estados de fluxo.

Esse padrÃ£o torna o cÃ³digo mais frÃ¡gil e dificulta a manutenÃ§Ã£o, especialmente quando o mesmo valor precisa ser usado em mÃºltiplas camadas ou mÃ³dulos.

## Problema

Strings mÃ¡gicas espalhadas pelo cÃ³digo reduzem a seguranÃ§a de tipagem, dificultam refactors e aumentam o risco de bugs causados por erros de digitaÃ§Ã£o ou inconsistÃªncias entre frontend e backend.

Exemplo ruim:

```ts
const isExpired = bankSlip.status === 'expired';
````

Exemplo desejado:

```ts
const isExpired = bankSlip.status === PaymentStatus.EXPIRED;
```

## Objetivo

Padronizar o uso de enums ou constantes de domÃ­nio tipadas para valores finitos e conhecidos, reduzindo strings mÃ¡gicas nos pontos onde isso fizer sentido.

## DecisÃ£o TÃ©cnica Desejada

Preferir enums para valores finitos e estÃ¡veis, como status, roles, labels, tipos, permissÃµes e estados de processamento.

Quando enum nÃ£o for a melhor opÃ§Ã£o, avaliar constantes tipadas centralizadas, desde que eliminem strings literais espalhadas pelo cÃ³digo.

## Escopo Funcional

### Dentro do escopo

* Identificar strings mÃ¡gicas usadas como valores de domÃ­nio.
* Centralizar valores finitos em enums ou constantes tipadas.
* Atualizar comparaÃ§Ãµes e validaÃ§Ãµes afetadas.
* Preservar compatibilidade entre frontend e backend.
* Evitar refactors desnecessÃ¡rios em cÃ³digo nÃ£o relacionado.

### Fora do escopo inicial

* Renomear todos os valores legados do sistema.
* Alterar comportamento funcional.
* Alterar contratos pÃºblicos sem necessidade.
* Criar migraÃ§Ãµes de banco sem confirmaÃ§Ã£o explÃ­cita.
* Refatorar mÃ³dulos inteiros apenas por estilo.

## Requisitos de Frontend

* Substituir strings mÃ¡gicas por enums ou constantes tipadas quando representarem domÃ­nio finito.
* Evitar duplicar enums jÃ¡ existentes no backend ou em mÃ³dulos compartilhados.
* Preservar comportamento visual e funcional existente.

## Requisitos de Backend

* Substituir strings mÃ¡gicas por enums ou constantes tipadas quando representarem domÃ­nio finito.
* Garantir que validaÃ§Ãµes e regras de negÃ³cio usem a fonte centralizada.
* Evitar quebrar contratos de API existentes.

## Requisitos de Banco de Dados

Sem alteraÃ§Ã£o de banco identificada inicialmente.

Se durante o planejamento for identificada necessidade de enum no banco, migration ou alteraÃ§Ã£o de schema, isso deve ser tratado separadamente e nenhuma migration deve ser executada sem confirmaÃ§Ã£o explÃ­cita.

## Requisitos de SeguranÃ§a e Multi-Tenant

* Garantir que alteraÃ§Ãµes em roles, permissÃµes, status ou validaÃ§Ãµes nÃ£o quebrem isolamento entre tenants.
* NÃ£o alterar regras de autorizaÃ§Ã£o sem necessidade explÃ­cita.
* Verificar fluxos sensÃ­veis antes de substituir valores relacionados a permissÃµes.

## Requisitos de MigraÃ§Ã£o ou Compatibilidade

* Preservar valores serializados jÃ¡ existentes.
* Evitar alterar payloads de API sem necessidade.
* Manter compatibilidade com dados persistidos em banco.
* Tratar portuguÃªs existente como legado e usar inglÃªs para novos identificadores de cÃ³digo.

## Requisitos de Testes

### Frontend

* Testar fluxos impactados por status, labels ou validaÃ§Ãµes alteradas.

### Backend

* Testar regras de negÃ³cio e validaÃ§Ãµes impactadas.

### E2E

* Avaliar necessidade conforme os fluxos afetados forem identificados.

## Arquivos Provavelmente Afetados

### Frontend

* A identificar durante o planejamento.

### Backend

* A identificar durante o planejamento.

### Banco de Dados

* A identificar durante o planejamento, se necessÃ¡rio.

## CritÃ©rios de Aceite

* Valores de domÃ­nio finitos nos arquivos alterados usam enum ou constante tipada centralizada.
* NÃ£o sÃ£o adicionadas novas strings mÃ¡gicas para status, roles, labels, tipos ou permissÃµes.
* Comportamento existente Ã© preservado.
* Frontend e backend continuam compatÃ­veis.
* Nomenclatura nova de cÃ³digo estÃ¡ em inglÃªs.
* Testes/checks relevantes passam.

## Perguntas Para o Planejamento

* JÃ¡ existem enums ou constantes de domÃ­nio reutilizÃ¡veis no projeto?
* Existe pacote shared para tipos entre frontend e backend?
* Quais domÃ­nios devem ser priorizados primeiro?
* Algum valor estÃ¡ persistido no banco e exige compatibilidade especial?
* Algum contrato de API depende diretamente dessas strings?

## InstruÃ§Ãµes Para a Skill Planejar

* Use este arquivo como especificaÃ§Ã£o de entrada.
* Leia `/AGENTS.md`, `/frontend/AGENTS.md` e `/backend/AGENTS.md`.
* Inspecione os arquivos citados antes de escrever o plano.
* Classifique a implementaÃ§Ã£o como `frontend + backend`, salvo se a investigaÃ§Ã£o mostrar outro escopo.
* NÃ£o implemente cÃ³digo durante o planejamento.
* NÃ£o instale dependÃªncias durante o planejamento.
* NÃ£o execute migrations.
* Gere um plano em `.portal/plans/` com etapas pequenas, revisÃ¡veis e seguras para produÃ§Ã£o (este projeto nÃ£o usa branch `staging` â€” commit/push sÃ£o feitos direto em `main`).

```

---

# RestriÃ§Ãµes absolutas

A skill `criar-task` nÃ£o deve:

- implementar cÃ³digo
- alterar arquivos do projeto
- criar branch
- criar commit
- abrir PR
- executar migrations
- instalar dependÃªncias
- rodar comandos destrutivos
- transformar a task em plano de implementaÃ§Ã£o
- inventar arquivos ou mÃ³dulos
```
