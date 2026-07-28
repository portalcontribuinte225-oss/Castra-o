# Especificação: Unificar criação de processos para os 6 tipos de registro

## Problema

A área interna (funcionário da prefeitura) tem 6 ações que deveriam gerar processo na
caixa de solicitações:

1. Consultar prontuário
2. Solicitar procedimento
3. Trocar tutor
4. Registrar óbito
5. Credenciamento
6. Denunciar

Apenas **"Solicitar procedimento" funciona corretamente** hoje: cria processo na caixa
de solicitações e tem uma UI de análise/conclusão adequada. Os outros 5 deveriam seguir
o MESMO FLUXO de criação de processo que "Solicitar procedimento" segue, porém cada um
com uma versão simplificada de análise, com campos de análise e conclusão específicos
de acordo com cada tipo de registro (ex: análise de óbito tem campos diferentes de
análise de credenciamento).

Objetivo desta spec: consolidar os achados de uma auditoria já realizada no código e as
decisões de escopo já tomadas com o usuário, para servir de entrada ao planejamento
formal (skill `planejar`).

## Decisões já tomadas com o usuário

- **Credenciamento**: mantém a tabela/tela separada (`access_requests` /
  `AccessRequestsView`) como está — NÃO migrar para dentro de `requests`. A caixa de
  solicitações deve apenas agregar/listar visualmente os itens de `access_requests`
  junto dos demais, sem unificar o armazenamento.
- **Escopo**: este plano cobre os 5 tipos pendentes de uma vez (não em fases separadas):
  Consultar prontuário (ajuste correlato), Trocar tutor, Registrar óbito, Credenciamento
  (agregação visual apenas) e Denunciar (implementação nova).

## Achados da auditoria (estado atual)

### Fluxo de referência: Solicitar procedimento

- Entrada pública: `PublicCastrationForm` → `NewRequest` (`src/App.tsx`, wizard
  Animal → Tutor → Agenda → Documentos).
- Entrada interna: botão "Criar Solicitação" no `AdminDashboard` abre `NewRequest` com
  prop `internalSimple` (pula para o formulário, grava `origin: "INTERNA"`).
- Submissão chama `createRequest(payload)` → `api.createRequest` → `POST /requests`
  (`backend/src/routes/requests.js:174-309`), que grava em `requests` com
  `status: 'NOVA'`, gera protocolo/chave de validação, grava `animal_records` quando
  há `animal_id`.
- Análise/conclusão: `AdminDashboard` lista por `status`; ao abrir um card, usa
  `RequestPreviewModal` (`src/App.tsx:4766+`), único modal de análise para todo
  `request`, com abas e ações desenhadas especificamente para o ciclo de procedimento
  cirúrgico (NOVA → AGENDADA → REALIZADA), via `useRequestActions`
  (`src/features/request-actions.ts`) → `PATCH /requests/:id`.

### Consultar prontuário

- `ValidationKeyConsultation` (`src/App.tsx:1413-1430`) — é consulta de leitura
  (`api.consultAnimalByMicrochip`, `api.consultRequestsByCredentials`). Corretamente
  NÃO cria processo. O problema real está nas ações disparadas a partir do prontuário
  (ver duplicação de modais de procedimento abaixo).

### Trocar tutor

- `ValidationKeyConsultation.submitServiceTransfer` (`src/App.tsx:1518-1537`) →
  `api.createAnimalTransferRequest` → `POST /animals/:id/transfer`
  (`backend/src/routes/animals.js:752-873`). Grava corretamente em `requests` com
  `request_type: 'TROCA_TUTOR'` e em `animal_records`.
- Existe uma segunda rota órfã equivalente baseada em `requestId`
  (`backend/src/routes/animals.js:546-644`, `POST /animals/requests/:requestId/transfer`),
  sem call site ativo no frontend atual.
- Problema real: ao abrir na caixa de solicitações, cai no `RequestPreviewModal`
  genérico — sem seção para exibir `target_tutor_*`, sem ação de efetivar a troca
  (não há endpoint que marque o tutor antigo como inativo e o novo como ativo em
  `animal_tutors`).

### Registrar óbito

- `ValidationKeyConsultation.submitServiceDeath` (`src/App.tsx:1539-1558`) →
  `api.createAnimalDeathRequest` → `POST /animals/:id/death`
  (`backend/src/routes/animals.js:646-750`). Grava corretamente em `requests` com
  `request_type: 'ANIMAL_OBITO'`, `death_date`, `death_cause`.
- Segunda rota órfã equivalente baseada em `requestId`
  (`backend/src/routes/animals.js:451-544`, `POST /animals/requests/:requestId/death`),
  sem call site ativo.
- Problema real: mesmo modal genérico sem seção para `death_date`/`death_cause`, sem
  ação que efetive o óbito (nenhuma atualização de `animals.status`, que permanece
  `'ATIVO'`).

### Credenciamento

- `PublicAccessRequestInline`/`PublicAccessRequestModal` → `createAccessRequest` →
  `POST /access-requests` (`backend/src/routes/accessRequests.js:59-108`), grava em
  tabela separada `access_requests` (status `PENDENTE/APROVADO/RECUSADO`).
- Já tem análise funcional própria: `AccessRequestsView`
  (`src/features/accessRequests.tsx`) + `PATCH /access-requests/:id/review`
  (`backend/src/routes/accessRequests.js:110-199`), incluindo criação automática de
  usuário na aprovação.
- Decisão: manter como está; caixa de solicitações passa a agregar visualmente esses
  itens (ver seção "Impacto" abaixo).

### Denunciar

- `PublicReportPanel` (`src/App.tsx:2848-2882`) é formulário estático sem
  `onSubmit`/estado/chamada de API. Não existe rota nem tabela de denúncias.
- É funcionalidade inexistente — precisa ser implementada do zero seguindo o padrão de
  `POST /requests`.

## Duplicação e código obsoleto identificados

1. **Dois modais de procedimento reduzido, duplicados e concorrentes com o wizard
   correto**:
   - `ValidationKeyConsultation.submitServiceProcedure` + `svcProcForm`
     (`src/App.tsx:1476-1516`).
   - `AnimalRecordPanel.submitProcedure` + `procedureForm`/`procedureOpen`/
     `procedureAnimalMode`/`procedureOtherMicrochip`/`procedureOtherAnimal`/
     `procedureNewAnimal` (`src/App.tsx:9813-9900+`).
   - Ambos pulam as etapas Agenda/Documentos do wizard `NewRequest`. Já existe um
     plano anterior não concluído para eliminar essa duplicação:
     `.portal/plans/redirecionar-procedimento-prontuario-para-solicitacoes.md`.
2. **Rotas backend órfãs** (sem call site no frontend atual):
   - `POST /animals/requests/:requestId/death` (`backend/src/routes/animals.js:451-544`)
   - `POST /animals/requests/:requestId/transfer` (`backend/src/routes/animals.js:546-644`)
   - Wrappers correspondentes em `src/api.ts` (`createRequestDeathAction`,
     `createRequestTransferAction`).
3. **`RequestPreviewModal` sobrecarregado**: cada rodada de polimento recente reforça
   o acoplamento ao ciclo de procedimento cirúrgico, dificultando reaproveitamento.
4. **Nomenclatura inconsistente**: prefixo `svc` vs. sem prefixo para conceitos
   equivalentes; `request_type` sem enum central (mistura screaming-snake-case de
   domínio com valores livres configuráveis); dois vocabulários de status
   (`requests.status` vs. `access_requests.status`) sem relação entre si.
5. `PublicReportPanel` não é duplicação — é esqueleto incompleto a implementar.

## O que já existe e é reaproveitável

- `workflow_data` (JSONB em `requests`) já é usado de forma heterogênea por
  `request_type` (procedimento, óbito, transferência) — mecanismo já validado para
  dados de análise flexíveis por tipo.
- Colunas fixas já existentes para os casos mais estáveis: `death_date`, `death_cause`,
  `target_tutor_name/email/cpf/phone/address/neighborhood/city/state/cep`
  (`backend/src/db/migrations.js:222-232`).
- `animal_records` (histórico do animal, `record_type` livre + `data JSONB`) é padrão
  de referência para "log de evento tipado com payload flexível".
- `access_requests` demonstra que o time já sabe construir análise dedicada por tipo
  quando não tenta forçar o modal genérico — é o precedente para a UI de análise por
  tipo dentro de `RequestPreviewModal`.
- `requestTypeLabel`/`normalizeRequest` (`src/domain.ts:371-385`) já centralizam rótulo
  por tipo — embrião de um resolver de tipo, hoje só resolve texto de exibição.

**Conclusão**: falta apenas a camada de apresentação/ação condicional por
`request_type` no modal de análise — o armazenamento já é adequado.

## Escopo desta spec (para o plano)

### Dentro do escopo

- Consolidar as rotas duplicadas de óbito e transferência de tutor (manter a variante
  `animalId`-based, remover a `requestId`-based e seus wrappers órfãos).
- Concluir a migração já iniciada e planejada: eliminar os 2 modais de procedimento
  reduzido, redirecionando sempre para o wizard `NewRequest`
  (retomando `.portal/plans/redirecionar-procedimento-prontuario-para-solicitacoes.md`).
- Introduzir um "resolver de seção de análise" por `request_type` dentro do
  `RequestPreviewModal`, com campos de análise e conclusão específicos para:
  - Óbito (`death_date`, `death_cause`, ação de efetivar óbito → atualizar
    `animals.status`).
  - Troca de tutor (exibir `target_tutor_*`, ação de efetivar troca → atualizar
    `animal_tutors`).
  - Credenciamento (na agregação visual da caixa — ver abaixo).
- Implementar Denúncia do zero: formulário (`PublicReportPanel`) funcional,
  `request_type` novo, rota de criação seguindo o padrão de `POST /requests`, seção de
  análise própria no modal.
- Fazer a caixa de solicitações (`AdminDashboard`) agregar visualmente itens de
  `access_requests` junto dos itens de `requests`, sem migrar dados — ao abrir um item
  de credenciamento a partir da caixa agregada, deve abrir a tela/modal de análise já
  existente (`AccessRequestsView`/modal de credenciamento), não o `RequestPreviewModal`.
- Definir um enum central para os tipos de `request_type` usados no código novo
  (mantendo compatibilidade com valores legados já persistidos no banco).

### Fora do escopo

- Migrar `access_requests` para dentro de `requests` (decisão do usuário: manter
  separado).
- Qualquer alteração em `Consultar prontuário` além do efeito colateral de remover os
  modais de procedimento duplicados que pendem dele.
- Retrabalho de nomenclatura em massa de código legado em português (só código novo
  deve seguir convenção em inglês).
- Alterar `.env`, CI/CD, infraestrutura de deploy.

## Perguntas técnicas em aberto para o plano

- Qual a melhor forma de "agregar visualmente" `access_requests` na mesma lista do
  `AdminDashboard`: união client-side de duas queries, ou endpoint de agregação no
  backend?
- Ação de "efetivar troca de tutor" e "efetivar óbito" devem ser automáticas ao
  aprovar o processo, ou passos manuais adicionais dentro do modal de análise?
- Nome e valores do enum central de `request_type` (inglês, código novo) e como
  conviver com os valores legados em português já gravados no banco.
