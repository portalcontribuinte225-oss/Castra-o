---
name: implementar
description: Implementa uma feature a partir de um plano Markdown gerado pela skill planejar. Use quando o usuário fornecer/linkar um arquivo em `.portal/plans/*.md` e pedir para transformar o plano em mudanças de código, seguindo os AGENT.md do projeto, criando/atualizando testes e rodando validações.
---

# Implementar a partir de um plano

Você é responsável por implementar uma feature a partir de um plano Markdown previamente criado pela skill `planejar`.

Esta skill deve usar o plano como fonte principal de contexto e transformar o planejamento em mudanças de código pequenas, seguras e alinhadas com os padrões do projeto.

---

## Entrada esperada

O usuário pode fornecer ou linkar um arquivo de plano ou você pode ir direto na pasta `.porta/plans` e verificar o ultimo plano gerado e pergutar ao usuário se ele deseja usar aquele plano.

Exemplos:

```txt
/implementar PLAN_FILE=.portal/plans/emissao-alvara-farmacia.md
```

```txt
/implementar .portal/plans/exportacao-relatorio-contribuintes.md
```

```txt
Use a skill implementar com o plano .portal/plans/cadastro-contribuinte.md
```

---

## Branch

Este projeto não usa `staging` nem branch por feature — o trabalho é feito direto em `main`, sem criar branch nova. Não execute `git checkout -b` nem troque de branch antes de implementar.

O commit e o push (quando solicitados) ficam a cargo da skill `finalizar`, que também opera direto em `main`.

---

## Comunicação durante a execução

O usuário não quer ver código, diffs nem explicações passo a passo enquanto a implementação está em andamento.

- Ao começar, responda só `codando...` (ou equivalente curto). Nenhum outro texto.
- Durante a implementação: não narre decisões, não cole trechos de código, não explique o que está sendo lido/editado. Trabalhe em silêncio.
- Minimize o número de chamadas de ferramenta visíveis (Read/Edit/Bash/Grep): agrupe leituras relacionadas, evite reler o mesmo arquivo, prefira uma investigação ampla (grep bem direcionado) a várias pequenas. Cada tool call aparece no painel de atividade da interface (fora do controle desta skill) — o texto de resposta pode ficar em silêncio, mas o volume de chamadas ainda é visível, então menos chamadas = menos ruído reduzível.
- Nota: o painel de atividade de ferramentas (Read/Edit/Bash com preview de diff) é renderizado automaticamente pela interface do Claude Code e não pode ser suprimido por instrução de skill — só o texto de resposta e a quantidade/tamanho das chamadas estão sob nosso controle.
- Exceção: se travar numa decisão que só o usuário pode tomar (ambiguidade real do plano, escolha de produto, confirmação de ação destrutiva) — aí pare e pergunte, mas sem despejar código/diff na pergunta, só o necessário para a decisão.
- Ao terminar, use o formato da seção "Saída final esperada" abaixo — curto, sem código/diff, terminando com "o que fazer agora?".


## Regras obrigatórias

Antes de implementar:

1. Leia completamente o arquivo de plano fornecido pelo usuário.
2. Leia o `/AGENT.md` da raiz do projeto.
3. Identifique no plano se a implementação impacta:
   - frontend
   - backend
   - banco de dados
   - infra/deploy
   - testes
   - documentação
4. Se houver impacto no frontend, leia `frontend/AGENT.md`.
5. Se houver impacto no backend, leia `backend/AGENT.md`.
6. Siga a estratégia de implementação descrita no plano.
7. Não implemente escopo que esteja marcado como fora do escopo.
8. Não faça refactors não relacionados.
9. Não altere arquivos desnecessários.
10. Não execute migrations sem confirmação explícita do usuário.
11. Não execute comandos destrutivos.
12. Não altere `.env`, secrets, CI/CD ou configuração de deploy sem necessidade explícita.

---

## Hierarquia de contexto

Use a seguinte prioridade:

1. Instruções explícitas do usuário.
2. Plano em `.portal/plans/*.md`.
3. `/AGENT.md` da raiz.
4. `frontend/AGENT.md` quando aplicável.
5. `backend/AGENT.md` quando aplicável.
6. Padrões existentes no código.
7. Boas práticas gerais.

Se houver conflito entre o plano e os AGENT.md, prefira a regra mais segura e explique no resumo final.

---

## Objetivo da implementação

Implemente a feature de forma:

- segura
- pequena
- focada
- testável
- consistente com o projeto
- fácil de revisar
- compatível com frontend/backend existentes
- alinhada ao fluxo multi-prefeitura
- sempre escreva código testável

---

## Análise antes de codar

Antes de editar arquivos:

1. Leia o plano inteiro.
2. Leia os AGENT.md relevantes.
3. Inspecione arquivos e módulos mencionados no plano.
4. Procure implementações similares existentes.
5. Identifique contratos frontend/backend envolvidos.
6. Identifique testes existentes que podem ser reutilizados.
7. Confirme quais arquivos realmente precisam ser alterados.
8. Evite criar arquitetura paralela.

Não comece codando sem entender o padrão existente.

---

## Eliminar código antigo, duplicado e obsoleto

Esta skill não deve empilhar código novo sobre código antigo. O objetivo final é que, para o que foi alterado, exista **uma única versão vigente** — a nova — não a nova coexistindo com uma antiga escondida, morta ou ainda ativa por baixo.

Isso vale especialmente para CSS, mas também para funções, componentes, hooks, imports e lógica condicional.

### Regra central

Ao alterar um componente/estilo/função que já existe:

1. Procure **todas** as outras definições/ocorrências relacionadas antes de considerar a mudança concluída — não só o primeiro lugar que você editou.
2. Se encontrar uma versão antiga (de uma sessão/redesign/refatoração anterior) que ainda afeta o mesmo elemento: **atualize ou remova essa versão antiga diretamente**. Não escreva uma regra nova só para "vencer" a antiga por cima.
3. Usar `!important`, seletores mais específicos ou maior prioridade como forma de sobrepor uma regra antiga só é aceitável quando a regra antiga é genuinamente compartilhada com outros componentes que estão fora do escopo desta implementação e não podem ser tocados — e mesmo assim, deixe um comentário curto explicando o motivo (ex: `/* sobrepõe a regra X, compartilhada com Y, fora de escopo */`).
4. Se, depois da mudança, alguma função/bloco/regra ficou 100% inalcançável (dead code), **remova** — não deixe "por precaução". Código morto não é rede de segurança, é fonte de confusão para a próxima pessoa que mexer ali (inclusive você mesmo, numa sessão futura).

### Checklist específico para CSS

Antes de considerar uma restilização/redesign concluído:

- Rode uma busca (grep) pelo nome de **cada classe alterada** no arquivo de estilos inteiro — não só no trecho que você editou. Projetos que já passaram por redesigns anteriores costumam ter blocos escopados (`.modal-x .classe`, `.tela-y .classe`) com especificidade maior que a regra "base" que você acabou de mexer, e essas regras mais específicas vencem silenciosamente.
- Para cada ocorrência extra encontrada: confirme se ela ainda é alcançável (renderiza de fato) e, se sim, se ela está com a paleta/comportamento antigo. Se estiver, atualize ela — é provavelmente ela quem está realmente na tela, não a que você editou primeiro.
- Verifique visualmente estados além do padrão: `:hover`, `:focus`/`:focus-within`, `:disabled`, breakpoints mobile. Resíduos de estilo antigo adoram se esconder exatamente nesses estados (ex: um anel de foco azul de uma paleta antiga, escondido atrás da borda verde nova).
- Depois de identificar a regra que **realmente** vence a cascata (a de maior especificidade, ou a última em ordem de origem quando a especificidade empata), edite essa — não adicione mais uma camada por cima "só para garantir".

### Checklist específico para lógica/componentes

- Ao substituir uma função, hook, componente ou fluxo, procure por outras implementações parecidas/duplicadas no projeto antes de decidir se cria algo novo ou reaproveita.
- Remova imports, variáveis de estado, props e arquivos que ficaram sem uso após a mudança — não deixe para "uma limpeza depois".
- Não deixe branches condicionais, feature flags ou fallbacks para um comportamento antigo que não existe mais.

Não comece a próxima etapa (testes/validações) achando que terminou só porque a primeira edição "parece certa" — o critério de conclusão é confirmar que não sobrou nenhuma versão antiga/duplicada ainda ativa.

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


## Regras para frontend

Quando houver alteração no frontend:

- Lei `frontend/AGENT.md`
- Não faça `fetch` ou `axios` diretamente dentro de componentes.
- Crie ou reutilize hooks dedicados para requests.
- Use React Query para server state.
- Use `useQuery` para leitura.
- Use `useMutation` para criação/edição/remoção/ações.
- Use optimistic updates quando fizer sentido e for seguro.
- Use rollback em optimistic updates.
- Não use query keys hardcoded.
- Use query keys centralizadas por enum, objeto ou factory.
- Inclua filtros, paginação e IDs relevantes na query key.
- Use `enabled` para queries condicionais/cold path.
- Use Zod + React Hook Form para formulários relevantes.
- Botões de continuar/salvar/submit devem respeitar estado de validação e loading.
- Trate loading, error, empty, success e disabled states.
- Preserve acessibilidade.
- Reuse componentes, hooks e padrões existentes.

---

## Regras para backend

Quando houver alteração no backend:

- Lei `backend/AGENT.md`
- Use Drizzle para queries novas.
- Não use SQL raw sem necessidade clara.
- Toda query tenant-specific deve filtrar por prefeitura/tenant.
- Nunca confie em tenant vindo livremente do client.
- Preserve isolamento multi-tenant.
- Preserve permissões e autorização.
- Não vaze dados sensíveis em mensagens de erro.
- Evite N+1 queries.
- Evite carregar dados desnecessários.
- Use RLS quando necessário.
- Relatórios e PDFs devem ser pensados com performance e determinismo.
- Não execute migrations sem confirmação explícita do usuário.
- Nunca edite migrations antigas já aplicadas.
- Reuse services, repositories, validations e padrões existentes.

---

## Regras sobre banco de dados e migrations

Se a implementação exigir alteração de schema:

1. Identifique a necessidade.
2. Explique o motivo.
3. Pare antes de executar migration.
4. Peça confirmação explícita do usuário para qualquer comando de migration.

Atenção:

```txt
NUNCA executar migrations sem confirmação explícita do usuário.
O ambiente atual pode estar apontando para produção.
NUNCA executar comandos destrutivos no banco
NUNCA resetar bancos
```

Também peça confirmação antes de:

- aplicar alterações de schema
- truncar tabelas
- executar seeds em ambientes desconhecidos
- rodar scripts que escrevem no banco

Nunca assuma que o banco atual é local ou staging.

---

## Regras de git/deploy

Durante a implementação:

- Não faça commit sem o usuário pedir — commit/push são responsabilidade da skill `finalizar`, não desta.
- Não faça push sem o usuário pedir.
- Este projeto não usa `staging` nem PR — não crie branch nova nem abra Pull Request.
- Nunca use `git push --force`.
- Evite alterar arquivos de deploy/infra sem necessidade explícita.
- Não altere Render config sem necessidade explícita.
- Não altere CI/CD sem necessidade explícita.

---

## Estratégia de implementação

Siga a estratégia descrita no plano.

Se o plano não estiver detalhado o suficiente:

1. Faça a menor implementação segura.
2. Siga os padrões existentes.
3. Documente as suposições no resumo final.
4. Não extrapole escopo.

Ordem recomendada:

1. Atualizar/adicionar tipos e schemas necessários.
2. Implementar backend, se aplicável.
3. Implementar frontend, se aplicável.
4. Integrar contratos frontend/backend.
5. Adicionar ou atualizar testes.
6. Rodar validações.
7. Revisar arquivos alterados.
8. Produzir resumo final.

---

## Testes

Adicione ou atualize testes conforme o plano.

### Frontend

Considere testes para:

- formulários
- validação Zod/RHF
- hooks
- loading/error/empty states
- submit/mutation
- query invalidation
- permissões/guards
- interações importantes do usuário

### Backend

Considere testes para:

- regras de negócio
- validações
- endpoints
- permissões
- isolamento multi-tenant
- erros esperados
- relatórios/PDFs quando aplicável

### E2E

Considere Playwright para fluxos críticos como:

- login
- cadastro/edição
- emissão de relatório
- geração/download de PDF
- navegação protegida

Não remova testes existentes sem motivo claro.

---

## Validações

Ao final, tente rodar os comandos relevantes conforme o impacto da alteração.

Comandos gerais:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Frontend:

```bash
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run test
npm --prefix frontend run build
```

Backend:

```bash
npm --prefix backend run lint
npm --prefix backend run typecheck
npm --prefix backend run test
npm --prefix backend run build
```

Biome, quando aplicável:

```bash
npx biome check .
```

Se algum comando não existir, registre isso no resumo final.

Se algum comando falhar:

- explique a falha
- diga se parece preexistente ou introduzida pela implementação
- não esconda erros

---

## Documentação

Atualize documentação interna quando a implementação exigir:

- novas rotas
- novas env vars
- novas permissões
- novo fluxo de relatório/PDF
- novo job/worker
- mudança de contrato frontend/backend
- instruções de setup

Não crie documentação desnecessária.

---

## Anti-patterns desta skill

Evite:

- ignorar o plano
- implementar itens fora do escopo
- alterar arquivos sem relação
- fazer refactor oportunista
- criar padrões paralelos
- duplicar lógica existente
- empilhar CSS/lógica nova sobre a antiga em vez de atualizar ou remover a antiga
- resolver conflito de especificidade/prioridade com `!important` ou seletor mais específico sem antes investigar e tentar corrigir a regra antiga conflitante
- deixar código morto/inalcançável no arquivo achando que é "mais seguro" não mexer
- considerar uma restilização concluída sem ter buscado outras ocorrências das classes alteradas no arquivo inteiro
- usar `any` para calar TypeScript
- fazer fetch/axios direto no componente
- criar queryKey hardcoded
- criar formulário sem Zod/RHF quando há validação relevante
- executar migration sem confirmação
- alterar `.env`
- alterar CI/CD sem necessidade
- alterar Render config sem necessidade
- commitar/pushar sem solicitação
- mascarar erro de validação/build/test
- finalizar sem resumo claro

---

## Checklist antes de finalizar

Antes de concluir:

- [ ] O plano foi lido completamente.
- [ ] `/AGENT.md` foi lido.
- [ ] `frontend/AGENT.md` foi lido quando aplicável.
- [ ] `backend/AGENT.md` foi lido quando aplicável.
- [ ] A implementação ficou dentro do escopo.
- [ ] Arquivos desnecessários não foram alterados.
- [ ] Padrões existentes foram seguidos.
- [ ] Buscado (grep) cada classe/função/componente alterado no arquivo/projeto inteiro para confirmar que não sobrou versão antiga, duplicada ou de maior especificidade/prioridade ainda ativa por baixo da mudança.
- [ ] Nenhum código morto/inalcançável foi deixado "por precaução"; o que ficou obsoleto foi removido ou atualizado, não apenas sobreposto.
- [ ] Testes foram adicionados/atualizados quando aplicável.
- [ ] Lint/typecheck/test/build foram executados quando disponíveis.
- [ ] Nenhuma migration foi executada sem confirmação.
- [ ] Nenhum secret/env foi alterado indevidamente.
- [ ] Nenhum comando destrutivo foi executado.
- [ ] Riscos e limitações foram documentados.

---

## Saída final esperada

Sem código, sem diff. Curto — poucas linhas, não seções longas:

```md
finalizei.

- Arquivos: arquivo1, arquivo2
- Validações: typecheck ok, build ok (ou: o que falhou)
- [só se houver] riscos/suposições relevantes em 1 linha

o que fazer agora?
```

Se algo não pôde ser feito ou uma validação falhou, diga isso na mesma resposta, sem esconder — mas ainda sem código/diff, só a descrição do problema.
