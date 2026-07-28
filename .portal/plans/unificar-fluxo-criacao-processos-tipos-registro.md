# Plano de Implementação: Unificar fluxo de criação de processos para os 6 tipos de registro

## Origem

- Arquivo de especificação: `.portal/specs/unificar-fluxo-criacao-processos-tipos-registro.md`
- Data do planejamento: `2026-07-28`
- Classificação: `frontend + backend + database`

## Resumo

A área interna tem 6 ações que deveriam gerar processo na caixa de solicitações:
Consultar prontuário, Solicitar procedimento, Trocar tutor, Registrar óbito,
Credenciamento e Denunciar. Apenas "Solicitar procedimento" funciona corretamente hoje
(cria processo em `requests` e tem UI de análise adequada). Este plano unifica os
outros 5 no mesmo pipeline de criação de processo, com uma seção de análise e
conclusão específica para cada tipo dentro do modal de análise já existente
(`RequestPreviewModal`), sem forçar um formulário genérico.

Decisões de produto já tomadas com o usuário:

- **Credenciamento continua em tabela separada** (`access_requests`) — não será
  migrado para `requests`. A caixa de solicitações apenas agrega visualmente.
- **Efetivação automática**: ao aprovar/concluir uma solicitação de Óbito ou Troca de
  Tutor, o backend já efetiva a mudança real (`animals.status`, `animal_tutors`) na
  mesma operação — sem passo manual extra.
- **Denúncia permite identificação opcional** (pode ser anônima).

## Escopo

### Dentro do escopo

- Enum central de `request_type` em `src/domain.ts` (estilo `statuses`/
  `normalizeRequestStatus`), cobrindo os tipos existentes mais `DENUNCIA`.
- Remoção das 2 rotas backend órfãs de óbito/transferência baseadas em `requestId`
  (sem call site no frontend) e os wrappers correspondentes em `src/api.ts`.
- Conclusão da migração já iniciada e abandonada: eliminar os 2 modais de
  procedimento duplicados (`svcProcForm` e `procedureForm`/`procedureOpen`),
  redirecionando sempre para o wizard `NewRequest`.
- Seção de análise por tipo dentro do `RequestPreviewModal`, começando por Óbito e
  Troca de Tutor, com ação de efetivação automática ao aprovar:
  - Óbito: exibir `death_date`/`death_cause`; ao aprovar, `UPDATE animals SET
    status = 'OBITO'`.
  - Troca de tutor: exibir `target_tutor_*`; ao aprovar, desativar tutor atual
    (`active = FALSE, ended_at = NOW()`) e inserir o novo tutor ativo em
    `animal_tutors`.
- Implementação nova de Denúncia: formulário funcional (`PublicReportPanel`),
  identificação opcional, novo `request_type: DENUNCIA`, seção de análise própria.
- Agregação visual client-side de `access_requests` na caixa de solicitações
  (`AdminDashboard`), sem migração de dados — abrindo a tela/modal de análise já
  existente (`AccessRequestsView`/`CrReviewModal`) para itens de credenciamento.

### Fora do escopo

- Migrar `access_requests` para dentro de `requests`.
- Qualquer alteração em "Consultar prontuário" além de remover os modais de
  procedimento duplicados que pendem dele.
- Retrabalho de nomenclatura em massa de código legado em português.
- Alterações em `.env`, CI/CD ou infraestrutura de deploy.

## Leitura de contexto

- `/AGENT.md` (regras globais — nota: este arquivo descreve um monorepo genérico com
  `frontend/AGENT.md`/`backend/AGENT.md`, Drizzle ORM e fluxo `staging → main` que
  **não existem/não se aplicam neste repo real**; o projeto usa SQL raw via `pg` e
  commit direto em `main`. Aplicamos apenas os princípios de qualidade compatíveis:
  evitar strings mágicas, enums centralizados, arquivos menores, sem código morto,
  English-only para código novo, nunca editar migrations antigas).
- `.portal/specs/unificar-fluxo-criacao-processos-tipos-registro.md` (spec de origem,
  consolidando a auditoria de código já realizada).
- `src/App.tsx` (RequestPreviewModal linhas 4766-5607, AdminDashboard linhas
  4506-4760, ValidationKeyConsultation, AnimalRecordPanel, PublicReportPanel linhas
  2848-2882).
- `src/domain.ts` (padrão de enum: `statuses`/`statusLabels`/`normalizeRequestStatus`
  linhas 3-15, 307-315; `requestTypeLabel` linhas 371-385; `workflowTagLabels`
  linhas 17-26).
- `src/features/request-actions.ts` (hook `useRequestActions`, linhas 1-210).
- `src/features/accessRequests.tsx` (`AccessRequestsView`, `CrReviewModal` linhas
  227-310).
- `src/api.ts` (wrappers de API, incluindo os órfãos `createRequestDeathAction`/
  `createRequestTransferAction`, linhas 50-51).
- `backend/src/routes/requests.js` (rota de referência `POST /requests`, linhas
  174-309).
- `backend/src/routes/animals.js` (rotas de óbito/transferência ativas e órfãs).
- `backend/src/routes/accessRequests.js` (fluxo de credenciamento, referência de UI
  de análise dedicada por tipo).
- `backend/src/routes/adoptions.js` (padrão de troca de tutor ativo, linhas 105-124).
- `backend/src/db/migrations.js` (padrão incremental de migration, últimos blocos
  linhas 349-451; schema `animal_tutors` linhas 135-153; schema `animals` linhas
  118-133).

## Impacto por área

### Frontend

- **`src/domain.ts`**: adicionar `requestTypes` (array canônico) + `requestTypeLabels`
  + `normalizeRequestType()`, seguindo exatamente o padrão de `statuses`/
  `normalizeRequestStatus`. Manter `requestTypeLabel()` funcionando com valores
  legados (mapeamento de compatibilidade, não substituição imediata).
- **`RequestPreviewModal`** (`src/App.tsx:4766-5607`): extrair a aba central hoje fixa
  ("Procedimento e saúde") para um resolver `{ [requestType]: SectionComponent }`.
  Criar `DeathAnalysisSection` e `TutorTransferAnalysisSection` como novos
  componentes (arquivo novo dedicado, ex. `src/features/request-analysis-sections.tsx`,
  para não inchar ainda mais `App.tsx`). Manter cabeçalho, aba de anexos e footer de
  atribuição/histórico como estão (já são genéricos).
- **`useRequestActions`** (`src/features/request-actions.ts`): adicionar
  `approveDeathRequest` e `approveTutorTransferRequest`, seguindo o padrão das ações
  existentes (`approveRequest` linhas 63-71, `confirmAttendanceFromProcess` linhas
  163-193) — cada uma chama um novo endpoint de efetivação (ver Backend) e atualiza o
  estado local via `showToast`/`setPreviewRequest`.
- **Limpeza de duplicação de procedimento**: remover
  `submitServiceProcedure`/`svcProcForm` (`src/App.tsx:1476-1516`) e
  `submitProcedure`/`procedureForm`/`procedureOpen`/`procedureAnimalMode`/
  `procedureOtherMicrochip`/`procedureOtherAnimal`/`procedureNewAnimal`
  (`src/App.tsx:9813-9900+`), redirecionando via `onRequestProcedure`/`goToStart()`
  (callback já parcialmente conectado em `src/App.tsx:1385`, `1445-1448`) para o
  wizard `NewRequest`. Remover CSS órfão exclusivo desses modais (checar
  compartilhamento de classes `.pac-*`/`.svc-*` com Transfer/Death antes de remover,
  conforme já mapeado em `.portal/plans/redirecionar-procedimento-prontuario-para-solicitacoes.md`).
- **Denúncia**: implementar estado local + `onSubmit` real em `PublicReportPanel`
  (`src/App.tsx:2848-2882`), campos nome/contato opcionais, chamando nova função
  `createReport(payload)` (mesmo padrão de `createRequest`, `src/App.tsx:578-623`).
  Adicionar seção de análise própria no `RequestPreviewModal` (categoria, nota de
  resolução).
- **Agregação visual da caixa**: em `AdminDashboard` (`src/App.tsx:4506-4760`),
  mesclar client-side `requests` + `accessRequests` (ambos já carregados no
  componente raiz, `src/App.tsx:294`/`306`) numa lista de exibição unificada,
  preservando os filtros por aba existentes; ao abrir um item oriundo de
  `access_requests`, abrir `CrReviewModal` em vez de `RequestPreviewModal`.
- Estados de loading/error/empty: reaproveitar os já existentes em `AdminDashboard`
  (não introduzir um segundo padrão).
- Testes frontend: cobrir a lógica de resolver de seção por tipo e a agregação
  client-side (ver seção Testes).

### Backend

- **`backend/src/routes/animals.js`**: remover rotas órfãs `POST
  /requests/:requestId/death` (linhas 451-544) e `POST /requests/:requestId/transfer`
  (linhas 546-644). Adicionar lógica de efetivação automática nas rotas de
  aprovação:
  - Óbito: ao aprovar o request (`PATCH /requests/:id` com transição para status
    final, ou endpoint dedicado `POST /animals/:id/death/approve`), fazer `UPDATE
    animals SET status = 'OBITO' WHERE id = $1 AND municipality_id = $2` dentro da
    mesma transação.
  - Troca de tutor: ao aprovar, replicar o padrão de `backend/src/routes/adoptions.js:105-124`
    (`UPDATE animal_tutors SET active = FALSE, ended_at = NOW() WHERE animal_id = $1
    AND active = TRUE`, seguido de `INSERT` do novo tutor ativo com os dados
    `target_tutor_*` já persistidos no request), sempre filtrando por
    `municipality_id`.
- **`src/api.ts`**: remover wrappers órfãos `createRequestDeathAction`/
  `createRequestTransferAction` (linhas 50-51); adicionar `createReport`.
- **Denúncia**: reaproveitar `POST /requests` com `request_type: 'DENUNCIA'` (mesmo
  padrão de referência, evitando nova tabela/rota dedicada) — ver decisão em Banco de
  Dados.
- Permissões: nenhuma mudança de papel/role identificada; ações de efetivação devem
  respeitar a mesma checagem de permissão já usada em `PATCH /requests/:id`.
- Regras multi-tenant: todo novo `UPDATE`/`INSERT` deve incluir `municipality_id` do
  contexto autenticado, nunca aceitar de payload do cliente.
- Testes backend: cobrir os novos endpoints/lógica de efetivação e a remoção das
  rotas órfãs (garantir que não há regressão nos fluxos ativos).

### Banco de dados

- Nenhuma migration é estritamente necessária para Óbito/Troca de Tutor (colunas já
  existem: `death_date`, `death_cause`, `target_tutor_*`).
- Para Denúncia, reaproveitar `requests` (`request_type: 'DENUNCIA'`) evita nova
  tabela — os campos específicos (categoria, local, descrição, contato opcional)
  cabem em `workflow_data` (JSONB), seguindo o mesmo padrão já usado por óbito/
  transferência. **Não é necessária migration de schema**, apenas o novo valor de
  `request_type` (dado, não schema).
- Se durante a implementação for constatado que `request_type` precisa de uma
  `CHECK constraint` nova (hoje não existe, é `TEXT` livre) para incluir `DENUNCIA`
  formalmente, isso deve ser uma migration nova incremental, apensada ao final de
  `backend/src/db/migrations.js`, nunca editando os blocos existentes (ex.: bloco de
  refatoração de status em `migrations.js:349-380` não deve ser tocado).

Atenção: migrations não devem ser executadas sem confirmação explícita do usuário,
pois o ambiente atual pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/domain.ts`
- `src/App.tsx` (RequestPreviewModal, AdminDashboard, ValidationKeyConsultation,
  AnimalRecordPanel, PublicReportPanel)
- `src/features/request-actions.ts`
- `src/features/request-analysis-sections.tsx` (novo)
- `src/features/accessRequests.tsx` (ajuste pontual para expor abertura a partir da
  lista agregada, se necessário)
- `src/api.ts`
- `backend/src/routes/requests.js`
- `backend/src/routes/animals.js`
- `backend/src/db/migrations.js` (somente se `CHECK constraint` de `request_type` for
  necessária)

## Estratégia de implementação

1. Criar enum central `requestTypes`/`normalizeRequestType()` em `src/domain.ts`,
   sem quebrar `requestTypeLabel()` existente.
2. Remover rotas órfãs (`backend/src/routes/animals.js:451-544`, `546-644`) e
   wrappers correspondentes (`src/api.ts:50-51`). Rodar smoke test dos fluxos ativos
   de óbito/transferência para confirmar zero regressão.
3. Concluir a limpeza de duplicação de procedimento: remover os 2 modais reduzidos,
   redirecionar para `NewRequest`, remover CSS órfão associado.
4. Implementar as ações de efetivação no backend (óbito e troca de tutor),
   respeitando transação + `municipality_id`.
5. Implementar o resolver de seção de análise por tipo no `RequestPreviewModal`,
   extraindo `DeathAnalysisSection`/`TutorTransferAnalysisSection` para arquivo novo;
   conectar `useRequestActions` às novas ações de efetivação.
6. Implementar Denúncia: `onSubmit` real em `PublicReportPanel`, `createReport`,
   `request_type: 'DENUNCIA'`, seção de análise no modal.
7. Implementar agregação visual client-side de `access_requests` no
   `AdminDashboard`, abrindo `CrReviewModal` para itens desse tipo.
8. Rodar lint/typecheck/build e testes; validar manualmente os 6 fluxos na UI.

## Regras de negócio identificadas

- "Solicitar procedimento" é o fluxo de referência: todo novo tipo deve criar
  processo via o mesmo pipeline de `POST /requests`.
- Consultar prontuário é consulta pura — não deve criar processo.
- Credenciamento mantém armazenamento e tela próprios; só a visualização agregada na
  caixa muda.
- Aprovar Óbito efetiva `animals.status = 'OBITO'` automaticamente.
- Aprovar Troca de Tutor efetiva a troca em `animal_tutors` automaticamente
  (desativa o antigo, ativa o novo).
- Denúncia pode ser enviada sem identificação do denunciante.

## Regras multi-tenant e segurança

- Toda nova consulta/update deve filtrar por `municipality_id` do contexto
  autenticado (nunca aceito do payload do cliente), replicando o padrão já usado nas
  rotas ativas de óbito/transferência.
- As novas ações de efetivação (óbito, troca de tutor) tocam dados sensíveis do
  animal/tutor — exigem a mesma checagem de permissão já aplicada a
  `PATCH /requests/:id`.
- Nenhum impacto em relatórios/PDFs identificado neste escopo.
- Isolamento entre prefeituras tem prioridade sobre conveniência — qualquer dúvida
  durante a implementação deve favorecer a opção mais restritiva.

## Validações necessárias

- Formulário de Denúncia: descrição/local obrigatórios; nome/contato opcionais mas,
  se preenchidos, validados no mesmo padrão de outros formulários públicos do
  projeto.
- Ações de efetivação: validar que o request pertence à `municipality_id` do
  usuário autenticado antes de qualquer `UPDATE`.
- Enum `request_type`: validar no backend que o valor recebido pertence ao conjunto
  canônico (ou é um valor legado já mapeado), rejeitando valores desconhecidos.

## Testes necessários

### Frontend

- Resolver de seção por `request_type` no `RequestPreviewModal` renderiza a seção
  correta para cada tipo (procedimento, óbito, troca de tutor, denúncia).
- Formulário de Denúncia envia com e sem identificação preenchida.
- Agregação client-side da caixa de solicitações inclui itens de `access_requests`
  e roteia para o modal correto ao abrir.

### Backend

- `POST /requests` com `request_type: 'DENUNCIA'` cria processo corretamente.
- Aprovação de Óbito atualiza `animals.status` dentro da mesma transação, isolado por
  `municipality_id`.
- Aprovação de Troca de Tutor desativa o tutor antigo e ativa o novo, isolado por
  `municipality_id`.
- Rotas removidas (`/requests/:requestId/death`, `/requests/:requestId/transfer`)
  retornam 404 após remoção, sem quebrar nenhum outro teste existente.

### E2E

- Fluxo completo de Óbito: criar solicitação → aparecer na caixa → analisar → aprovar
  → animal marcado como óbito.
- Fluxo completo de Troca de Tutor: criar solicitação → aparecer na caixa → analisar
  → aprovar → novo tutor ativo.
- Fluxo completo de Denúncia: enviar anônima → aparecer na caixa → analisar →
  concluir.
- Credenciamento continua acessível a partir da caixa agregada, abrindo a tela de
  análise correta.

## Comandos de validação sugeridos

```bash
npm run lint
npm run typecheck
npm run build

npm --prefix backend run lint
npm --prefix backend run build
```

(Confirmar no `package.json` de cada pacote se existem scripts de `test`/`typecheck`
dedicados antes de assumir os nomes exatos — o projeto não segue o layout genérico
`frontend/`+`backend/` com scripts padronizados descrito no `AGENT.md` template.)

## Riscos e pontos de atenção

- `src/App.tsx` tem mais de 12 mil linhas — cada etapa deste plano deve ser um commit
  pequeno e isolado, para não agravar o problema de "God file" já identificado na
  auditoria.
- Ações de efetivação automática tocam dados sensíveis (`animals`, `animal_tutors`)
  — risco de vazamento cross-tenant se `municipality_id` não for aplicado
  corretamente em cada novo `UPDATE`/`INSERT`.
- Risco de quebrar contrato frontend/backend ao remover as rotas órfãs — mitigado
  pela confirmação já feita de que não há call site ativo.
- Risco de alterar migrations antigas por engano — qualquer mudança de schema deve
  ser um bloco novo apensado ao final de `migrations.js`.
- Este projeto não usa branch `staging` nem Pull Request — o fluxo real é commit
  direto em `main` (diferente do texto genérico do `AGENT.md`). Isso aumenta o risco
  de impacto imediato em produção; validar cuidadosamente antes de cada push.
- Risco de regressão visual/UX no `RequestPreviewModal` ao extrair a aba central para
  um resolver por tipo — testar manualmente o fluxo de procedimento (referência) para
  garantir que nada quebrou.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Critérios de aceite do plano

A implementação deve ser considerada pronta quando:

- Os 5 tipos pendentes (Consultar prontuário permanece como consulta pura, Trocar
  tutor, Registrar óbito, Credenciamento, Denunciar) estiverem visíveis e analisáveis
  a partir da caixa de solicitações, cada um com sua seção de análise/conclusão
  específica.
- Os 2 modais duplicados de procedimento tiverem sido removidos, com o fluxo
  passando integralmente pelo wizard `NewRequest`.
- As 2 rotas backend órfãs tiverem sido removidas sem regressão nos fluxos ativos.
- Aprovar Óbito atualizar `animals.status` e aprovar Troca de Tutor atualizar
  `animal_tutors`, ambos automaticamente e isolados por `municipality_id`.
- Denúncia for uma funcionalidade real, ponta a ponta (formulário → processo →
  análise → conclusão).
- Credenciamento continuar funcionando como hoje, agora visível também na lista
  agregada da caixa de solicitações.
- Lint, typecheck e build passarem sem novos erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto, junto da spec de origem em
  `.portal/specs/unificar-fluxo-criacao-processos-tipos-registro.md`.
- Não executar migrations sem confirmação explícita do usuário.
- Seguir os princípios de qualidade do `/AGENT.md` compatíveis com a arquitetura real
  do projeto (SQL raw via `pg`, sem Drizzle, sem `staging`, commit direto em `main`)
  — ignorar as partes do `AGENT.md` que descrevem uma estrutura de monorepo que não
  existe neste repo.
- Manter alterações pequenas e focadas; preferir múltiplos commits pequenos seguindo
  a ordem da "Estratégia de implementação" a um único commit grande.
- Extrair as novas seções de análise por tipo para um arquivo dedicado
  (`src/features/request-analysis-sections.tsx`), evitando crescer ainda mais
  `src/App.tsx`.
- Ao remover código duplicado/órfão, confirmar novamente via grep antes de apagar
  (o mapeamento deste plano reflete o estado do código em 2026-07-28).
- Atualizar testes conforme descrito na seção "Testes necessários".
