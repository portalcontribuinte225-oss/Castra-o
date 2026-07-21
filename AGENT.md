# AGENTS.md

## Contexto do Projeto

Este repositório é um monorepo contendo aplicações frontend, backend e recursos compartilhados para um sistema multi-prefeitura.

A estabilidade do ambiente de staging e produção é prioridade.

Este AGENT.md atua como guardião operacional do projeto, responsável por preservar:

- segurança de deploy
- estabilidade de staging
- integridade do git flow
- previsibilidade de releases
- qualidade de código
- código testável
- segurança multi-tenant
- consistência do monorepo

Sempre priorize segurança, previsibilidade e mudanças pequenas/focadas.

## Ambiente de Runtime

- Versão padrão do Node.js do projeto: `v22.17.0`.
- Versão padrão do npm associada: `10.9.2`.
- Não instale, atualize ou sugira bibliotecas cuja faixa `engines.node` exija uma versão maior que `22.17.0`.
- Antes de adicionar dependências, verifique `package.json`, lockfile e metadados do pacote para confirmar compatibilidade com Node `22.17.0`.
- Se uma dependência necessária exigir Node maior que `22.17.0`, interrompa a implementação e reporte o bloqueio com alternativa compatível.

## Hierarquia de AGENT.md

Este repositório possui AGENT.md específicos por domínio.

Sempre leia e respeite os AGENT.md relevantes antes de implementar alterações.

### Regras Globais

Este arquivo (`/AGENTS.md`) contém regras globais de:

- git flow
- pull requests
- deploy
- CI/CD
- monorepo safety
- release safety
- staging/production protection

### Regras Específicas

Para alterações específicas, leia também:

- `/backend/AGENT.md`
  - regras de backend
  - multi-tenant
  - Drizzle ORM
  - relatórios
  - PDFs
  - performance backend
  - nunca altere o arquivo .env em nenhum repositorio

- `/frontend/AGENT.md`
  - React
  - React Query
  - hooks
  - forms
  - query keys
  - UX
  - frontend performance
  - nunca altere o arquivo .env em nenhum repositorio

## Invariantes Backend Globais

Ao alterar backend, além das regras específicas em `/backend/AGENT.md`, trate como obrigatório:

- Erros inesperados devem passar pelo error handler central (`sendError` ou `next(error)`), nunca por `res.status(500).json({ message: 'Erro interno.' })` ou variações estáticas.
- Novas operações de banco devem usar Drizzle (`db.select`, `db.insert`, `db.update`, `db.delete` ou `drizzleFromClient(client)` em transações). SQL raw existente é legado/exceção histórica e não deve ser usado como referência para novas funcionalidades.
- SQL raw novo só é aceitável quando Drizzle não resolver razoavelmente o caso, com parâmetros, isolamento por tenant e justificativa clara.

## Prioridade de Regras

A prioridade deve seguir:

1. `/AGENT.md` (regras globais)
2. AGENT.md específico do domínio afetado
3. padrões já existentes no código

Exemplo:

- alteração no frontend:
  - ler `/AGENT.md`
  - ler `/frontend/AGENT.md`

- alteração no backend:
  - ler `/AGENT.md`
  - ler `/backend/AGENT.md`

- alteração fullstack:
  - ler todos os AGENT.md relevantes

---

## Enums e Constantes de Domínio

### Evite strings mágicas

Não espalhe valores de domínio pelo código utilizando strings literais.

Sempre que um valor pertencer a um conjunto finito e conhecido de opções, utilize uma definição centralizada e tipada.

Exemplos comuns:

* status
* papéis de usuário (roles)
* tipos de documento
* tipos de evento
* tipos de notificação
* provedores de integração
* categorias
* workflows
* permissões
* estados de processamento

Bom:

```ts
export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  EXPIRED = 'expired',
}

const isExpired = bankSlip.status === PaymentStatus.EXPIRED;
```

Ruim:

```ts
const isExpired = bankSlip.status === 'expired';
```

---

### Centralize valores de domínio

Todo valor de domínio deve possuir uma única fonte de verdade.

Evite redefinir os mesmos valores em múltiplos arquivos.

Ruim:

```ts
// arquivo A
const ACTIVE_STATUS = 'active';

// arquivo B
const USER_ACTIVE = 'active';
```

Bom:

```ts
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
```

---

### Reutilize definições entre frontend e backend

Sempre que possível, reutilize a mesma definição de domínio entre:

* frontend
* backend
* DTOs
* validações
* schemas
* integrações

Evite duplicar conceitos em múltiplos lugares.

---

### Prefira enums para domínios finitos

Quando o conjunto de valores for conhecido e estável, prefira `enum`.

Exemplos:

```ts
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  OPERATOR = 'operator',
}
```

```ts
export enum ImportJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
```

---

### Exceções

Não crie enums para:

* valores utilizados apenas uma vez
* conteúdo digitado pelo usuário
* textos livres
* valores dinâmicos
* dados sem conjunto de opções conhecido
* constantes temporárias ou locais

Evite criar enums desnecessários.

---

### Objetivo

O objetivo desta regra é:

* eliminar strings mágicas
* aumentar segurança de tipagem
* facilitar refactors
* centralizar conhecimento de domínio
* reduzir erros de digitação
* melhorar legibilidade
* melhorar manutenção de longo prazo

Sempre que surgir a dúvida entre usar uma string literal espalhada pelo código ou uma definição centralizada de domínio, prefira a definição centralizada.


# Objetivos do Agente

Ao implementar, alterar ou revisar código neste repositório:

1. Nunca comprometer produção desnecessariamente.
2. Preservar estabilidade de staging.
3. Evitar mudanças amplas sem necessidade.
4. Minimizar risco de bugs silenciosos.
5. Respeitar o fluxo de branches e PRs do projeto.
6. Garantir que frontend e backend continuem compatíveis.
7. Validar tipagem, lint e formatação antes de concluir alterações.
8. Evitar alterações perigosas em deploy, infra ou CI/CD.

---

# Git Flow e Regras de Branch

## 1. Nunca commitar diretamente em produção (main)

A branch `main` representa produção.

Nunca faça commit direto em `main`.

Nunca faça push direto em `main`.

Se o usuário solicitar explicitamente:

- pare
- peça confirmação novamente
- explique claramente o risco

Exemplo:

```txt
WARNING:
You are about to commit directly to production (main).
This may immediately impact production environments.
Please confirm explicitly if you want to continue.
```

## 2. Toda nova feature deve partir de staging

Novas features devem:

1. usar `staging` como base
2. criar uma branch própria
3. abrir PR apontando para `staging`

Fluxo esperado:

```txt
staging
  -> feature/nova-feature
  -> PR -> staging
```

Nunca implemente features diretamente em:

- main
- production
- release branch sem instrução explícita

## 3. Convenção de branches

Prefira:

```txt
feature/
fix/
hotfix/
refactor/
chore/
```

Exemplos:

```txt
feature/create-report-export
fix/pdf-timeout
refactor/taxpayer-hooks
chore/update-eslint-config
```

## 4. Nunca usar force push

Nunca execute:

```bash
git push --force
```

Exceto se o usuário solicitar explicitamente e confirmar o risco.

## 5. Commits devem ser pequenos e focados

Evite:

- refactors desnecessários
- alterar dezenas de arquivos sem motivo
- misturar correções não relacionadas
- mudanças oportunistas

Prefira mudanças pequenas, auditáveis e previsíveis.

---

# Pull Requests

## 1. Toda feature deve abrir PR para staging

Após finalizar uma feature:

- abrir Pull Request
- target branch: `staging`

## 2. Toda PR precisa de descrição

A PR deve conter:

- o que foi alterado
- motivo da alteração
- impacto esperado
- possíveis riscos
- validações executadas

Exemplo esperado:

```md
## O que foi feito

- Adicionado endpoint de geração de relatório
- Criado hook de frontend para exportação
- Adicionados testes de integração

## Motivo

Permitir exportação de relatórios financeiros por prefeitura.

## Validações

- lint
- typecheck
- testes
- build frontend
- build backend
```

## 3. Evitar PRs gigantes

PRs muito grandes aumentam risco de:

- bugs silenciosos
- regressões
- conflitos
- rollback difícil

Prefira PRs menores quando possível.

---

# Segurança Operacional

## 1. Nunca alterar `.env` sem necessidade explícita

Nunca:

- modificar `.env`
- remover variáveis
- renomear env vars
- alterar secrets

Sem solicitação explícita.

## 2. Nunca commitar secrets

Nunca commite:

- tokens
- API keys
- credenciais
- arquivos privados
- certificados
- secrets
- `.pem`
- `.key`

## 3. Nunca alterar CI/CD sem necessidade explícita

Não modifique sem necessidade explícita:

- GitHub Actions
- pipelines
- Render configuration
- Dockerfiles
- workflows
- deploy scripts
- release scripts

## 4. Nunca alterar migrations antigas

Nunca edite migrations antigas já executadas.

Sempre prefira:

- criar nova migration
- preservar histórico

---

# Monorepo Safety

## 1. Verificar impacto cross-package

Antes de alterar:

- shared packages
- utils compartilhadas
- types compartilhados
- configs globais

Verifique impacto em:

- frontend
- backend
- scripts
- build
- testes

## 2. Evitar quebrar compatibilidade

Mudanças compartilhadas devem preservar compatibilidade sempre que possível.

Evite breaking changes desnecessárias.

## 3. Evitar alterar arquivos desnecessários

Não modifique:

- arquivos não relacionados
- lockfiles sem necessidade
- configs sem necessidade
- arquivos formatados incidentalmente

Evite ruído em PRs.

---

# Dependências

## 1. Não atualizar dependências sem necessidade

Nunca atualize dependências sem motivo claro.

Evite:

- upgrades oportunistas
- atualizar múltiplos pacotes sem relação
- alterar versões apenas "porque sim"

## 2. Não modificar lockfiles sem necessidade

Não altere:

- package-lock.json
- pnpm-lock.yaml
- yarn.lock

Sem necessidade real.

---

# Qualidade de Código

## 1. Sempre rodar lint/format/typecheck

Ao finalizar qualquer feature ou alteração relevante:

Execute as validações do projeto.

Exemplos:

```bash
npm run lint
npm run typecheck
npm run build
```

Quando existir frontend/backend separados:

```bash
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build

npm --prefix backend run lint
npm --prefix backend run typecheck
npm --prefix backend run build
```

## 2. Linter/formatter do projeto

Este repo usa ESLint como linter (backend e frontend). Se houver formatter configurado no futuro, mantenha a execucao documentada nos scripts do repo.

## 3. Nunca ignorar erros de tipagem

Não finalize alterações deixando:

- TypeScript errors
- lint errors
- build errors

Exceto quando o problema for preexistente e isso estiver claramente documentado.

---

# Segurança Multi-Tenant

Este projeto atende múltiplas prefeituras.

Qualquer alteração relacionada a:

- autenticação
- tenant
- prefeitura
- permissões
- relatórios
- PDFs
- exports

Requer validação extra.

Nunca assuma que uma mudança pequena é segura em ambiente multi-tenant.

---

# Deploy e Infraestrutura

## 1. Produção roda no Render

O projeto utiliza Render.

Tenha cuidado com alterações que possam aumentar:

- uso de CPU
- uso de memória
- tempo de request
- cold starts
- bloqueios síncronos
- consumo excessivo de rede

## 2. Evitar requests longas e bloqueantes

Evite operações síncronas pesadas em requests HTTP.

Principalmente:

- geração de PDF
- relatórios grandes
- processamento massivo
- uploads pesados

Prefira jobs/background processing quando aplicável.

## Git
- **Base branch:** `staging`
- Nao fazer reset destrutivo.
- Branches criadas a partir de `staging`, PRs apontam para `staging`
- Branch naming: `feat/feature-{slug}` ou `fix/feature-{slug}`
- Conventional commits em ingles
- Flow: `feature/* → PR → staging → Deploy staging → master → Deploy producao`

## Leitura rapida recomendada para agentes

1. `README.md`
2. `contexto/documentacao/README.md`
3. `backend/app.ts`
4. `backend/db/`
5. `frontend/src/App.tsx`

## 3. Não alterar comportamento de deploy sem necessidade

Não modifique:

- start commands
- health checks
- build commands
- ports
- environment assumptions

Sem necessidade explícita.

# Single Responsibility Principle

Todo arquivo deve ter uma única responsabilidade.

Um arquivo não deve conter simultaneamente:

* configuração de runtime
* inicialização do banco de dados
* orquestração de transações
* contexto de tenant
* contexto de segurança
* lógica de negócio
* funções utilitárias
* código de infraestrutura
* declarações de tipos

Se um arquivo começar a acumular múltiplas responsabilidades:

**divida-o.**

---

# Arquivos God (God Files) São Proibidos

Evite arquivos que:

* excedam um tamanho razoável
* misturem responsabilidades não relacionadas
* exijam a compreensão de centenas de linhas para pequenas alterações
* contenham infraestrutura e lógica de negócio juntas

Exemplo de padrão proibido:

```txt
db.ts
- criação do pool
- inicialização do Drizzle
- configuração de RLS
- wrappers de transação
- contexto de tenant
- declarações de tipos
- exports
```

Preferível:

```txt
db/
  pool.ts
  drizzle.ts
  transaction.ts
  tenant-context.ts
  types.ts
  index.ts
```

---

# Diretrizes de Tamanho de Arquivos

Recomendado:

* até 150 linhas: ideal
* 150–250 linhas: aceitável
* 250–400 linhas: requer revisão
* acima de 400 linhas: deve ser justificado

Arquivos gerados automaticamente estão isentos.

---

# Separação de Camadas

## Controllers

* recebem requisições
* validam entradas
* chamam serviços
* retornam respostas

## Services

* orquestram casos de uso
* contêm regras de negócio

## Repositories

* apenas acesso ao banco de dados

## Workers

* processamento assíncrono

## Adapters

* integrações externas

## Types

* apenas contratos e definições de tipos

Nunca misture camadas desnecessariamente.

---

# Infraestrutura Explícita

A infraestrutura deve ser explícita.

Nunca crie abstrações que alterem comportamento silenciosamente.

Exemplos:

Ruim:

```txt
Instanciar Drizzle diretamente em codigo de aplicacao.
Wrapper de banco que ignora RLS sem nome explicito.
Pool/cliente alternativo sem documentar como o contexto de tenant e aplicado.
```

Bom:

```txt
db exportado por backend/db/index.ts
adminDb exportado por backend/db/index.ts
RlsAwarePool documentado em backend/db/README.md
withTenantContext()
```

O comportamento deve ser óbvio pelo nome.

No backend, o entrypoint oficial de banco e `backend/db/index.ts`. O `db` exportado por esse arquivo aplica o contexto de RLS do tenant resolvido na request. Nao substitua por `drizzle(process.env.DATABASE_URL!)`, `drizzle(pool)` ou pools avulsos em codigo de aplicacao.

---

# Testabilidade

Infraestruturas críticas devem ser testáveis de forma isolada.

Inclui:

* contexto de tenant
* RLS
* geração de PDF
* importações financeiras
* filas
* workers
* armazenamento
* permissões
* certificados

Se um código não pode ser testado sem inicializar toda a aplicação, provavelmente está excessivamente acoplado.

---

# Regras de Nomenclatura

Use nomes específicos.

Evite:

```txt
utils.ts
helpers.ts
common.ts
manager.ts
runtime.ts
service.ts
```

Prefira:

```txt
tenant-context.ts
pdf-renderer.ts
financial-import-loader.ts
storage-signed-url.ts
```

Os nomes devem explicar claramente a responsabilidade.

---

# Regras de Qualidade de Código

## Sem Mágica

Evite:

* efeitos colaterais ocultos
* comportamentos implícitos
* abstrações surpreendentes
* alterações silenciosas de segurança

O código deve ser compreensível apenas pela leitura.

---

## Sem Casts Perigosos

Evite:

```ts
as unknown as
```

a menos que não exista alternativa viável.

Quando necessário:

* mantenha o escopo pequeno
* documente o motivo

---

## Sem Código Morto

Remova:

* funções não utilizadas
* tipos não utilizados
* imports não utilizados
* abstrações obsoletas

Não deixe código morto no projeto.

---

## Sem Código Temporário

Antes de finalizar, remova:

```txt
TODO
FIXME
gambiarras temporárias
código de debug
console.log
```

salvo quando explicitamente solicitado.

---

## Reutilize Padrões Existentes

Antes de criar algo novo:

1. Analise os módulos existentes
2. Analise os padrões existentes
3. Reutilize a arquitetura existente

Evite introduzir um segundo padrão para resolver o mesmo problema.

---

# Segurança Multi-Tenant

Este é um sistema multi-tenant.

Qualquer alteração envolvendo:

* autenticação
* autorização
* contexto de tenant
* relatórios
* exportações
* PDFs
* importações financeiras
* armazenamento

deve receber atenção redobrada.

Nunca assuma que uma alteração é segura para múltiplos tenants.

O isolamento entre tenants tem prioridade sobre conveniência.

---

# Regras de Performance

Evite operações síncronas pesadas dentro de requisições HTTP.

Especialmente:

* geração de PDF
* relatórios grandes
* importações financeiras
* processamento de imagens
* exportações de grande volume

Prefira:

* filas
* workers
* jobs em background

---

# Regras para Geração de PDF

A geração de PDFs deve ser assíncrona.

Arquitetura recomendada:

```txt
API
→ Job
→ Queue
→ Worker
→ Storage
→ URL de Download
```

Nunca gere PDFs grandes diretamente dentro de requisições HTTP.

Utilize:

* processamento baseado em workers
* armazenamento de objetos
* rastreamento de status

---

# Regras para Importações Financeiras

Grandes importações devem ser:

* auditáveis
* versionadas
* reconciliáveis

Arquitetura recomendada:

```txt
storage
→ staging
→ validação
→ reconciliação
→ promoção
```

Nunca carregue grandes volumes de dados utilizando inserts linha a linha através da ORM.

Prefira:

* COPY
* streaming
* processamento em lotes (chunked processing)

---

# Dependências

Não atualize dependências sem um motivo válido.

Não modifique lockfiles sem necessidade.

Não introduza novas dependências quando as ferramentas já existentes no projeto resolverem o problema.

---

# Validação Antes da Conclusão

Antes de considerar o trabalho concluído:

* lint aprovado
* typecheck aprovado
* build aprovado
* testes aprovados quando aplicável
* nenhum novo erro de TypeScript
* nenhum novo erro de lint
* nenhum segredo exposto
* nenhum arquivo não relacionado modificado
* nenhuma alteração perigosa de infraestrutura
* nenhuma migration antiga modificada
* nenhum commit direto em staging ou main
* nomenclatura seguindo convenções em inglês
* arquitetura seguindo separação de responsabilidades
* responsabilidades dos arquivos permanecem claras

---

# Regra de Decisão

Quando houver dúvida, escolha a opção que seja:

1. mais segura
2. menor
3. mais fácil de revisar
4. mais fácil de testar
5. mais fácil de reverter
6. mais fácil de manter
7. mais explícita
8. menos acoplada

Nunca introduza complexidade sem um benefício mensurável.

---

# English-Only Codebase

Todo código novo deve ser escrito em inglês.

Isso inclui:

* nomes de arquivos
* nomes de diretórios
* nomes de funções
* nomes de classes
* nomes de interfaces
* nomes de tipos
* nomes de variáveis
* nomes de constantes
* nomes de enums
* nomes de tabelas
* nomes de colunas
* nomes de migrations
* nomes de testes
* nomes de componentes
* nomes de hooks
* comentários técnicos
* documentação técnica criada durante a implementação

O projeto ainda pode conter código legado em português.

Considere qualquer nomenclatura em português como legado.

Ao implementar novas funcionalidades:

* não introduza novos identificadores em português
* não copie padrões de nomenclatura em português para código novo
* utilize nomes consistentes com o restante da arquitetura em inglês

Ao modificar código legado:

* mantenha compatibilidade com o comportamento existente
* não realize grandes refatorações de nomenclatura sem solicitação explícita
* prefira migrar gradualmente para inglês quando houver autorização do usuário

Exemplos:

Ruim:

```txt
buscarContribuinte()
gerarRelatorio()
prefeitura.service.ts
usuario.repository.ts
```

Bom:

```txt
findTaxpayer()
generateReport()
city-hall.service.ts
user.repository.ts
```

A consistência da linguagem é um requisito arquitetural do projeto.

Todo código novo deve ser escrito exclusivamente em inglês.



---

# Checklist Antes de Finalizar

Antes de concluir qualquer alteração:

- [ ] Nenhuma alteração foi feita diretamente em `main`
- [ ] A branch correta foi utilizada
- [ ] A feature parte de `staging`
- [ ] Alterações desnecessárias foram evitadas
- [ ] Nenhum secret foi exposto
- [ ] Nenhuma config crítica foi alterada sem necessidade
- [ ] Nenhuma migration antiga foi editada
- [ ] Frontend e backend continuam compatíveis
- [ ] Lint foi executado
- [ ] Typecheck foi executado
- [ ] Build foi executado
- [ ] Formatter foi executado quando aplicável (se configurado)
- [ ] Não existem erros novos de tipagem
- [ ] Não existem erros novos de lint
- [ ] A PR possui descrição adequada

---

# Quando Tiver Dúvida

Se houver dúvida, prefira a opção que:

1. Seja mais segura para produção.
2. Gere menos risco para staging.
3. Seja mais fácil de revisar.
4. Seja mais fácil de reverter.
5. Evite impacto cross-tenant.
6. Preserve estabilidade do monorepo.
7. Minimize alterações desnecessárias.

Nunca introduza mudanças arriscadas sem necessidade clara.
