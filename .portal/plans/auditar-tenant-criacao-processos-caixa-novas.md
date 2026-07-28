# Plano de Implementação: Auditar resolução de tenant em todas as rotas de criação de processo

## Origem

- Arquivo de especificação: `.portal/specs/auditar-tenant-criacao-processos-caixa-novas.md`
- Data do planejamento: `2026-07-28`
- Classificação: `backend-only`

## Resumo

Depois de corrigir o bug de "Troca de tutor" (`POST /animals/:id/transfer`) e
"Registrar óbito" (`POST /animals/:id/death`) — onde o `municipality_id` era
resolvido de forma frágil e silenciosa, deixando a solicitação criada mas
invisível na caixa de solicitações para usuários de prefeitura específica —
este plano audita **todas** as rotas que criam `requests`/`access_requests`
para confirmar que nenhuma outra rota tem o mesmo problema, e corrige o novo
caso já identificado em `POST /access-requests` (Credenciamento).

## Escopo

### Dentro do escopo

- Confirmar, via grep completo do backend, que não existe nenhuma outra rota
  de criação de `requests`/`access_requests` além das já mapeadas.
- Documentar, rota por rota, como o tenant é resolvido hoje e se há falha
  silenciosa possível.
- Corrigir `POST /access-requests` (`backend/src/routes/accessRequests.js`)
  para resolver `municipality_id` de forma confiável, abortando com erro
  claro quando não for possível resolver — mesmo padrão já aplicado em
  óbito/transferência.
- Confirmar que o status inicial de cada rota de criação bate com o filtro
  da aba "Novas" da caixa de solicitações (`status === 'NOVA' && !tags.includes('ATRIBUIDA')`,
  `src/App.tsx`, `filterTabs`).
- Revisar as duas correções já aplicadas (óbito/transferência) para garantir
  que ficaram completas e consistentes com o padrão adotado.

### Fora do escopo

- Reabrir a decisão de unificar `access_requests` dentro de `requests`
  (decisão já tomada: manter separado).
- Mudanças de UI/UX da caixa de solicitações além do necessário para
  confirmar o diagnóstico.
- Migrations de schema, a menos que a auditoria encontre necessidade real —
  nesse caso, reportar como pergunta em aberto, não decidir sozinho.

## Leitura de contexto

- `/AGENT.md` (regras globais — mesma ressalva já registrada em plano
  anterior: este arquivo descreve uma estrutura de monorepo com
  `frontend/AGENT.md`/`backend/AGENT.md`, Drizzle ORM e fluxo `staging` que
  não existem neste repo real; aplicados apenas os princípios de qualidade
  compatíveis).
- `.portal/specs/auditar-tenant-criacao-processos-caixa-novas.md` (spec de
  origem).
- `backend/src/tenant.js` (`pickMunicipalityId`, `requireMunicipality` —
  padrão de referência para resolução de tenant).
- `backend/src/routes/requests.js` (`POST /` — fluxo de referência já usa o
  padrão correto).
- `backend/src/routes/animals.js` (`POST /:id/death`, `POST /:id/transfer` —
  já corrigidos nesta sessão para usar `pickMunicipalityId`).
- `backend/src/routes/accessRequests.js` (`POST /` — resolve tenant direto
  do body, sem validação, sem abortar — bug ainda não corrigido).
- `src/App.tsx` (`AdminDashboard`, `filterTabs`, aba `id: "inbox"` — critério
  de exibição na caixa "Novas").

## Impacto por área

### Frontend

Sem impacto esperado. A investigação já confirmou (spec + sessão anterior)
que a lógica de filtragem da aba "Novas" no `AdminDashboard` está correta —
o problema é exclusivamente de gravação no backend.

### Backend

- **`backend/src/routes/accessRequests.js`, rota `POST /`** (linhas ~59-108):
  hoje resolve `municipality_id` via `body.municipality_id || body.municipalityId || null`,
  sem nenhuma validação, e é rota **pública** (sem middleware de auth). Se o
  frontend não enviar `municipalityId`, a linha é criada com `municipality_id = NULL`,
  ficando invisível na consulta `GET /access-requests` para qualquer usuário
  de prefeitura específica (mesmo filtro `WHERE municipality_id = $1` usado
  em `requests`).
  - Ajuste: usar `pickMunicipalityId(req)` (já exportado por
    `backend/src/tenant.js`) e abortar com `400` explícito caso não resolva,
    replicando o padrão já usado em `POST /animals/:id/death` e
    `POST /animals/:id/transfer`. Como a rota não tem `req.user` (pública),
    `pickMunicipalityId` já cai no branch `!req.user` e aceita
    `req.query?.municipalityId || req.body?.municipalityId || req.body?.municipality_id`
    — mesma fonte de dado já usada hoje, só que com validação explícita em
    vez de aceitar `null` silenciosamente.
- **`backend/src/routes/animals.js`** (`POST /:id/death`, `POST /:id/transfer`):
  sem impacto de código adicional — apenas confirmar em revisão que a
  correção já aplicada nesta sessão está completa (uso de
  `pickMunicipalityId`, abort com `ROLLBACK` + `400`).
- **`backend/src/routes/requests.js`** (`POST /`): sem impacto — é o padrão
  de referência, já correto.
- **`backend/src/routes/animals.js`** (`POST /consult`, `POST /lookup`) e
  **`backend/src/routes/requests.js`** (`POST /consult`): confirmar em
  revisão que são rotas de leitura pura e não inserem em `requests`
  (já confirmado por grep nesta etapa de planejamento — nenhuma delas tem
  `INSERT INTO requests` no corpo).

### Banco de dados

Sem impacto esperado. Nenhuma mudança de schema — o `municipality_id` já é
coluna existente em `requests` e `access_requests`; o ajuste é somente na
validação/resolução do valor antes do `INSERT`.

Atenção: migrations não devem ser executadas sem confirmação explícita do
usuário, pois o ambiente atual pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `backend/src/routes/accessRequests.js` (correção)
- `backend/src/routes/animals.js` (revisão/confirmação, sem mudança nova)
- `backend/src/routes/requests.js` (revisão/confirmação, sem mudança nova)
- `backend/src/tenant.js` (leitura, sem mudança esperada)

## Estratégia de implementação

1. Reconfirmar via grep (`INSERT INTO requests`, `INSERT INTO access_requests`)
   que não existe nenhuma quarta rota de criação além das já mapeadas.
2. Documentar tabela rota-a-rota (arquivo:linha, como resolve tenant, se
   falha silenciosamente, status inicial gravado) como parte do commit ou
   do resumo final — não precisa virar arquivo novo além deste plano.
3. Corrigir `POST /access-requests` (`backend/src/routes/accessRequests.js`):
   trocar a resolução manual de `municipality_id` por
   `pickMunicipalityId(req)`, importando de `../tenant.js`; abortar com
   `res.status(400).json({ error: "Municipio obrigatorio para esta operacao." })`
   quando não resolver, antes do `INSERT`.
4. Revisar `POST /animals/:id/death` e `POST /animals/:id/transfer` para
   confirmar que a correção já aplicada está consistente com o novo ajuste
   em `accessRequests.js` (mesma mensagem de erro, mesmo padrão de import).
5. Rodar `npm run typecheck` (frontend, garante que nada quebrou por
   tipagem cruzada) e `node --check` nos arquivos backend alterados.
6. Smoke test manual: criar um credenciamento via fluxo público sem
   `municipalityId` no payload (simulando o bug) e confirmar que a API
   retorna 400 em vez de criar registro invisível.

## Regras de negócio identificadas

- Toda solicitação criada deve pertencer a uma prefeitura resolvida de forma
  confiável — nunca `NULL` silencioso.
- O padrão de resolução de tenant já validado no fluxo de referência
  (`POST /requests`) deve ser reutilizado em qualquer rota nova ou existente
  que crie processo, em vez de lógica própria por rota.
- Falha ao resolver o tenant deve sempre abortar a criação com erro HTTP
  claro (400), nunca gravar dado incompleto.

## Regras multi-tenant e segurança

- `pickMunicipalityId` já trata os três casos (usuário de prefeitura,
  usuário global, sem usuário/rota pública) — reaproveitar essa função é a
  forma mais segura de evitar vazamento ou perda de isolamento entre
  prefeituras.
- Rotas públicas (como `POST /access-requests`) continuam aceitando
  `municipalityId` do body/query, que é o único dado disponível sem sessão
  — a mudança é validar, não trocar a fonte do dado.
- Nenhuma mudança de permissão/role é necessária.

## Validações necessárias

- `POST /access-requests`: `municipalityId` passa a ser obrigatório
  (validado via `pickMunicipalityId`), retornando 400 com mensagem clara
  quando ausente.
- Nenhuma outra validação de input muda.

## Testes necessários

### Frontend

Sem testes novos necessários — nenhuma mudança de comportamento visível na
UI além de a solicitação passar a aparecer corretamente.

### Backend

- `POST /access-requests` sem `municipalityId` no body/query retorna 400.
- `POST /access-requests` com `municipalityId` válido cria o registro
  normalmente (regressão do fluxo já funcional).
- `POST /animals/:id/death` e `POST /animals/:id/transfer` continuam
  criando corretamente com `municipality_id` preenchido (regressão da
  correção já aplicada).

### E2E

- Fluxo completo de Credenciamento público → aparece corretamente na tela
  "Credenciamentos" para o usuário da prefeitura correta.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

```bash
node --check backend/src/routes/accessRequests.js
node --check backend/src/routes/animals.js
node --check backend/src/routes/requests.js
```

Não há scripts de `lint`/`test` configurados no projeto (nem raiz, nem
backend) — não inventar comando, registrar isso no resumo final se
aplicável.

## Riscos e pontos de atenção

- `POST /access-requests` é rota pública usada pelo formulário de
  credenciamento na home pública — validar manualmente que o frontend já
  envia `municipalityId` nesse formulário antes de tornar o campo
  obrigatório no backend, para não quebrar o cadastro público existente.
- Este projeto não usa `staging` nem Pull Request — commit e push direto em
  `main`; validar bem antes de cada push.
- Nenhuma migration antiga deve ser editada.

## Perguntas em aberto

- Confirmar se o formulário público de Credenciamento
  (`PublicAccessRequestInline`/`PublicAccessRequestModal`) já envia
  `municipalityId` no payload hoje — se não enviar, a correção de backend
  sozinha pode quebrar o cadastro público (passar a retornar 400 sempre).
  Isso deve ser verificado durante a implementação, antes de tornar o campo
  obrigatório.

## Critérios de aceite do plano

A implementação deve ser considerada pronta quando:

- Todas as rotas de criação de `requests`/`access_requests` resolverem o
  tenant via `pickMunicipalityId` (ou equivalente já validado), sem nenhuma
  lógica própria e silenciosa remanescente.
- `POST /access-requests` sem tenant resolvível retornar 400 em vez de criar
  registro invisível.
- O fluxo público de Credenciamento continuar funcionando sem regressão.
- `npm run typecheck` e `npm run build` passarem sem novos erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto, junto da spec de origem
  em `.portal/specs/auditar-tenant-criacao-processos-caixa-novas.md`.
- Resolver a pergunta em aberto (payload atual do formulário público de
  Credenciamento) antes de tornar `municipalityId` obrigatório em
  `POST /access-requests` — se o frontend não enviar, ajustar o frontend
  também, não só o backend.
- Não executar migrations sem confirmação explícita do usuário.
- Manter alterações pequenas e focadas: esta é uma correção pontual de
  resolução de tenant, não um refactor amplo das rotas.
- Reaproveitar `pickMunicipalityId`/`requireMunicipality` de
  `backend/src/tenant.js` — não criar uma segunda implementação da mesma
  lógica.
