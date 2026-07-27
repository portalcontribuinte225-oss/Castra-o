# Plano de Implementação: Configuração de IA por município (isolamento de custo/tenant)

## Origem

- Especificação: descrita em conversa (sem arquivo `.md` de origem), a partir do pedido de liberar "Inteligência Artificial" para o usuário gestor municipal (`admin_municipal`).
- Data do planejamento: `2026-07-26`
- Classificação: `frontend + backend` (config/permissões multi-tenant)

## Resumo

Hoje a configuração de IA (`config.key = "ai"`, provider/apiKey/model usados para validar documentos automaticamente) é tratada como um recurso único e global da plataforma: só `master`/`suporte` podem editá-la, e o backend (`resolveAiSettings` em `backend/src/routes/ai.js`) sempre lê a linha global (`municipality_id IS NULL`), caindo para a variável de ambiente `ANTHROPIC_API_KEY`/etc. quando não há chave salva no banco.

Cada município é um cliente separado da plataforma — o modelo correto é cada um configurar (e pagar) sua própria chave de IA, não compartilhar a chave/custo da plataforma. Esta implementação:

1. Libera `admin_municipal` para ver e editar a config de IA — restrita automaticamente ao próprio município (a infraestrutura de `pickMunicipalityId` já garante isso para usuários não-globais).
2. Faz o backend resolver a config de IA **pelo município da solicitação**, não mais pela linha global fixa.
3. Remove o fallback silencioso para a variável de ambiente quando a solicitação é de um município específico sem chave própria — nesse caso, a validação por IA simplesmente não roda (cai para conferência manual, caminho que já existe no app).
4. A variável de ambiente/linha global continua existindo só para uso de `master`/`suporte` (ex.: testes internos da plataforma), não para atender nenhum município real.

## Escopo

### Dentro do escopo

- `backend/src/routes/config.js`: permitir que `admin_municipal` escreva a chave `ai` (restrito ao próprio município via `req.user.municipalityId`, já resolvido automaticamente por `pickMunicipalityId`).
- `backend/src/routes/ai.js`: `POST /validate` passa a receber/resolver `municipalityId` da requisição; `resolveAiSettings` passa a consultar a linha do município informado (sem fallback para variável de ambiente quando há município); mantém o fallback de env var apenas quando não há município (uso interno de `master`/`suporte`).
- `src/App.tsx`:
  - Sidebar: item "Inteligência Artificial" visível para `admin_municipal` além de `master`/`suporte`.
  - Gate de renderização do painel de IA dentro de `ConfigView`.
  - Carregamento de `aiSettings` (hoje único `useEffect` sem escopo, disparado no boot do app) passa a ser resolvido por município: usuário logado não-global usa `currentUser.municipalityId`; fluxo público (cidadão enviando documento) usa `selectedMunicipalityId`; usuário global mantém o comportamento atual (linha global/`municipalityId` filtrado).
  - `validateDocumentWithAI`/chamada a `api.validateDocument` passam a enviar `municipalityId` no payload, para o backend resolver a chave correta.

### Fora do escopo

- Migração/backfill de dados existentes (não há linha por município hoje; cada município começa sem config própria, até configurar).
- Mudança de UI da tela de IA além do necessário para refletir o novo escopo (sem redesign visual).
- Cobrança/faturamento por uso de IA (fora do escopo desta implementação, é só sobre isolamento de configuração).

## Leitura de contexto

- `/AGENT.md` (regras globais, seção multi-tenant e regras de IA/PDF pedindo atenção redobrada).
- Investigação de código:
  - `backend/src/tenant.js`: já expõe `isMunicipalAdmin()`, `pickMunicipalityId()`, `MUNICIPALITY_ADMIN_ROLE` — reaproveitar, não duplicar.
  - `backend/src/routes/config.js:25` (`GLOBAL_WRITE_ONLY_CONFIG_KEYS`), `:89-124` (GET/PUT `/:key`).
  - `backend/src/routes/ai.js:14-51` (`POST /validate`, `resolveAiSettings`).
  - `src/App.tsx:270` (`aiSettings` state), `:460-468` (fetch global no boot, sem checar usuário/município), `:700` (filtro `configSidebarItems` por `globalOnly`), `:6537` (prop em `ConfigView`), `:8030` (gate de render do painel), `:10100-10133` (`validateDocumentWithAI`, chama `api.validateDocument`).
  - Confirmado via `GET /api/config/ai` local: `hasApiKey:false` mesmo com `active:true` — a chave real usada hoje vem só da env var do servidor.

## Impacto por área

### Frontend

- Novo helper local em `src/App.tsx` (perto de `canManagePublicAnimalFlows`): `canManageAiSettings(role)` = `isGlobalRole(role) || role === "admin_municipal"`.
- Filtro do menu de configurações passa a tratar `ai_settings` como exceção (não mais `globalOnly` genérico).
- `aiSettings` deixa de ser um único `useEffect` fixo — passa a depender do contexto de município relevante (usuário logado vs. fluxo público).
- Payload de `validateDocument` ganha `municipalityId`.

### Backend

- `config.js`: exceção para `admin_municipal` na chave `ai` (mantendo `municipalities`/`platform` como realmente globais).
- `ai.js`: `resolveAiSettings` ganha parâmetro de município; query passa a ser condicional (`municipality_id = $1` quando informado, senão `IS NULL`); env var só entra como fallback no caminho sem município.
- Isolamento multi-tenant: cadaário só escreve/lê a própria linha (não há como um `admin_municipal` ler/escrever a linha de outro município, pela mesma garantia que já protege `documentTypes`/`requestTypes` hoje).

### Banco de dados

Sem alteração de schema — a tabela `config` já suporta `municipality_id` por linha (mesmo mecanismo de `documentTypes` etc.). `Sem impacto esperado` em migrations.

### Infra/Deploy

`Sem impacto esperado` — variável de ambiente existente continua sendo usada, só passa a ser fallback restrito ao caminho sem município.

## Arquivos provavelmente afetados

- `backend/src/routes/config.js`
- `backend/src/routes/ai.js`
- `src/App.tsx`

## Estratégia de implementação

1. Backend `config.js`: ajustar a checagem de escrita da chave `ai` para permitir `isGlobalUser(req.user) || isMunicipalAdmin(req.user)`, com comentário explicando a mudança de "global only" para "admin municipal ou global".
2. Backend `ai.js`: adicionar resolução de `municipalityId` em `POST /validate` (do `req.user` quando autenticado não-global, do `req.body.municipalityId` quando anônimo/público, ausente quando usuário global sem especificar); atualizar `resolveAiSettings(requestSettings, municipalityId)` para consultar a linha certa e não cair pra env var quando há município.
3. Frontend: helper `canManageAiSettings`; atualizar filtro da sidebar e gate de `ConfigView`.
4. Frontend: tornar o carregamento de `aiSettings` sensível ao município (usuário logado / fluxo público), reaproveitando o padrão já usado por `documentTypes`/`requestTypes` (`api.getConfig(key, municipalityId)`).
5. Frontend: incluir `municipalityId` no payload de `api.validateDocument`.
6. Rodar grep em `isGlobalRole`/`globalOnly`/`ai_settings`/`resolveAiSettings` no projeto inteiro para confirmar que não sobrou nenhum outro ponto checando só role global para IA.
7. Validar com Playwright: (a) `admin_municipal` vê e salva sua própria config de IA; (b) `master`/`suporte` continuam com o comportamento anterior; (c) um município sem chave própria não usa a env var da plataforma (cai para conferência manual sem erro no console).
8. `npm run typecheck` e `npm run build`.

## Regras de negócio identificadas

- Cada município é um cliente independente da plataforma — configuração e custo de IA não devem ser compartilhados entre municípios nem financiados silenciosamente pela chave da plataforma.
- `admin_municipal` só pode gerenciar recursos do próprio município (regra já vigente para outros recursos, estendida aqui para `ai`).

## Regras multi-tenant e segurança

- Escrita de `ai` por `admin_municipal` deve ficar restrita ao próprio município — usar exclusivamente `req.user.municipalityId` (nunca aceitar `municipalityId` vindo do client para usuário não-global, mesma regra já aplicada em `pickMunicipalityId`).
- `POST /validate` no fluxo público (sem autenticação) precisa aceitar `municipalityId` do body, mas isso só seleciona QUAL linha de config pública é lida (mesmo padrão de `documentTypes` etc. já público) — não escreve nada, então não há risco de um cliente anônimo alterar configuração de outro município.
- Não expor `apiKey` de nenhum município para o frontend (mesma máscara `hasApiKey` já usada hoje).

## Validações necessárias

- `admin_municipal` salva a própria config de IA → some `hasApiKey:false`/aparece `true` após salvar → reabre e persiste.
- `admin_municipal` de um município não enxerga/edita a config de outro (não há UI para isso, mas confirmar que o backend rejeitaria mesmo que tentassem via API direta).
- `master`/`suporte` continuam editando a config global normalmente.
- Documento de um município sem config própria de IA cai para conferência manual sem erro 500 nem exceção no console.

## Testes necessários

### Frontend

- Nenhuma suíte automatizada pré-existente para esta tela; validação via Playwright nesta sessão.

### Backend

- Nenhuma suíte automatizada pré-existente para `config.js`/`ai.js`; validação manual via chamadas HTTP/Playwright nesta sessão.

### E2E

- Login como `admin_municipal` → Configurações → Inteligência Artificial → salvar chave → reabrir → confirmar persistência.
- Login como `master` → confirmar que a tela de IA global continua funcionando como antes.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Mudança de comportamento real: hoje TODOS os municípios se beneficiam silenciosamente da chave de ambiente da plataforma; depois desta mudança, só quem configurar a própria chave terá validação automática por IA — os demais passam a cair para conferência manual. Isso é a mudança pretendida (isolamento por cliente), mas é uma mudança de comportamento em produção, não só de permissão.
- `admin_municipal` recém-criado para um município sem config própria vai ver a tela de IA vazia/inativa — comportamento esperado, mas vale documentar/avisar visualmente (não obrigatório nesta implementação).
- Risco de regressão: qualquer lugar que hoje dependa implicitamente de `aiSettings` ser sempre "a config global" precisa ser conferido (grep obrigatório antes de finalizar).
- Risco de produção: commit/push direto em `main`, sem `staging`.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — usuário confirmou o modelo "cada município é um cliente, sem fallback para a chave/custo compartilhado da plataforma".

## Critérios de aceite do plano

- `admin_municipal` consegue ver, configurar e salvar sua própria config de IA, isolada por município.
- `master`/`suporte` mantêm o comportamento atual para a config global.
- Validação por IA de um município sem chave própria degrada para conferência manual, sem usar a chave/env var da plataforma.
- Build e typecheck passam sem erros novos.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Reaproveitar `isMunicipalAdmin`/`pickMunicipalityId` já existentes em `backend/src/tenant.js` — não duplicar lógica de resolução de tenant.
- Seguir o padrão já usado por `documentTypes`/`requestTypes` para carregar config escopada por município no frontend.
- Validar com Playwright os três cenários descritos (admin municipal salva e persiste; master continua funcionando; município sem chave própria degrada sem erro).
