# Plano de Implementação: Padrão de mensagens e acesso à solicitação por CPF

## Origem

- Arquivo de especificação: `escopo-padrao-mensagens.md`, com os ajustes combinados no planejamento: os avisos de documentos saem de todos os canais, então ficam **11 mensagens** (o escopo ainda fala em 13).
- Data do planejamento: `2026-11-23`
- Classificação: `fullstack` (contratos em `shared/`, backend e frontend; sem migration)

---

## Resumo

Deixar as mensagens iguais em SMS, e-mail e WhatsApp: os mesmos 11 títulos, na mesma ordem, e um template da Meta por mensagem, reconhecido só pelo seu nome. Os avisos de documentos deferidos e indeferidos deixam de existir em todos os canais. As telas "Acompanhar solicitação" (botão da home) e "Acessar minha solicitação" viram uma só, com o nome "Acompanhar solicitação". Ela passa a pedir só o CPF, deixa a pessoa escolher E-mail, WhatsApp ou SMS entre os canais com a mensagem de acesso ativa e lista as solicitações do CPF ligadas ao contato que recebeu o código, com a situação de cada uma, o requerimento e a criação da senha. O cadastro interno ganha um teste que prova o disparo de "Solicitação registrada".

---

## Escopo

### Dentro do escopo

- As 11 mensagens, com os mesmos títulos e a mesma ordem nos contratos de SMS, e-mail e WhatsApp, e os nomes dos templates da Meta:

| # | Título | Chave interna (SMS / e-mail / WhatsApp) | Template na Meta |
|---|---|---|---|
| 1 | Solicitação registrada | `request_registered` | `castracao_solicitacao_registrada` |
| 2 | Agendamento confirmado | `schedule_confirmed` | `castracao_agendamento_confirmado` |
| 3 | Agendamento alterado | `schedule_changed` | `castracao_agendamento_alterado` |
| 4 | Agendamento cancelado | `schedule_cancelled` | `castracao_agendamento_cancelado` |
| 5 | Não comparecimento | `no_show` | `castracao_nao_comparecimento` |
| 6 | Atendimento concluído | `completed` | `castracao_atendimento_concluido` |
| 7 | Solicitação indeferida | `request_rejected` | `castracao_solicitacao_indeferida` |
| 8 | Recuperação de senha | `password_reset` | `castracao_codigo_recuperacao_senha` |
| 9 | Confirmação de contato | `verify_phone` (SMS e WhatsApp) / `verify_email` (e-mail) | `castracao_codigo_confirmacao_contato` |
| 10 | Acesso à solicitação | `request_tracking` | `castracao_codigo_acesso_solicitacao` |
| 11 | Contato alterado | `contact_changed` | `castracao_contato_alterado` |

- Remoção dos avisos de documentos (`documents_approved` e `documents_rejected`) em todos os canais.
- Reconhecimento dos templates do WhatsApp só pelo nome da tabela (com `_v<n>` opcional no fim) ou pela configuração da engrenagem. Cada código tem template e interruptor próprios.
- "Acessar minha solicitação" só com CPF, com a escolha do canal entre E-mail, WhatsApp e SMS (só os que estão com a mensagem 10 ativa no município), envio só pelo canal escolhido, lista das solicitações e criação da senha.
- Uma tela só, decidida na implementação: o botão "Acompanhar solicitação" da home continua, com o mesmo nome, e abre a tela por CPF. Ela mostra, para cada solicitação, o que a tela atual de acompanhamento mostra (situação, tipo, datas, agendamento, local e documentos). Sai o fluxo antigo por protocolo + contato (front, rotas, serviço e testes). "Acessar minha solicitação" deixa de ser uma tela separada: o link do aviso e o "Criar minha senha" do fim do cadastro abrem a mesma tela.
- Textos do "Sim, quero" e do "Não precisa" na pergunta "Quer acompanhar esta solicitação?".
- Teste de rota do cadastro interno com acompanhamento aceito.
- Atualização de `docs/tutor-access.md`.

### Fora do escopo

- Criar, editar e apagar templates na Meta e no EmailJS: fica com o administrador (ver "Infra/Deploy").
- Link personalizado de acompanhamento nas mensagens (descartado no planejamento).
- Renomear a tabela `request_tracking_challenges`, o arquivo `backend/src/repositories/request-tracking.js` e a chave `request_tracking`. A chave guarda o ID do EmailJS e os interruptores dos municípios; trocar exigiria mexer em dados.
- Mudar os textos de SMS, e-mail e WhatsApp além dos de documentos, que saem.
- Uma lista das mensagens na tela do WhatsApp: ela continua mostrando os templates da Meta, com o título na coluna "Aviso" e na engrenagem.
- O guia `escopo-integracoes-notificacoes.md` (é para reaproveitar em outros sistemas).
- Registrar no histórico quando a mensagem está desligada no município, salvo resposta à pergunta 2.

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md`
- `escopo-padrao-mensagens.md`
- `shared/`: `sms-uses-contract.js`, `email-uses-contract.js`, `whatsapp-templates-contract.js`, `notification-contract.js`, `sms-messages-contract.js`, `auth-contract.js`, `request-access-contract.js`, `request-tracking-contract.js`
- `backend/src/services/notifications/`: `notification-events.js`, `notification-message.js`, `email-notice-text.js`, `dispatch-notification.js`, `whatsapp-template-parameters.js`
- `backend/src/services/`: `request-change-notifications.js`, `notify-request-registered.js`, `whatsapp-active-templates.js`, `email-templates.js`, `request-submission.js`, `sms-integration-settings.js` (trecho)
- `backend/src/services/auth/`: `auth-message-delivery.js`, `recovery-channels.js`, `recovery-handlers.js` e `profile-handlers.js` (trechos)
- `backend/src/services/request-access/*` e `backend/src/services/request-tracking/*`
- `backend/src/repositories/request-access.js` e `backend/src/repositories/request-tracking.js`
- `backend/src/routes/request-access.js`, `backend/src/routes/request-tracking.js` e `backend/src/routes/requests.js` (criação da solicitação)
- `backend/src/db/migrations.js` (tabela `request_tracking_challenges`)
- `src/features/request-access/*`, `src/features/request-tracking/tracked-request-view.tsx`, `src/features/request-requester/follow-up-question.tsx` e `requester-step.tsx`
- `src/App.tsx` e `src/api.ts` (trechos)
- `docs/tutor-access.md` (trechos)

**Diagnóstico do cadastro interno.** O balcão usa a mesma rota (`POST /requests`), a mesma pergunta (`RequesterStep`) e o mesmo disparo (`notifyRequestRegistered`) do formulário público. O e-mail de "Solicitação registrada" não sai quando:
- (a) o acompanhamento não foi aceito ou foi aceito sem e-mail;
- (b) a mensagem está desligada no município. Ela já começa desligada, e o canal responde `null` sem registrar nada no histórico. É a causa mais provável do teste em produção;
- (c) o contrato de e-mail está fora da vigência ou sem saldo, e o histórico mostra "não enviado".

O banco local está vazio, então o caso real não pôde ser conferido. Não há teste de rota do cadastro interno com acompanhamento aceito.

---

## Impacto por área

### Frontend

- **`src/features/request-access/`:**
  - `request-access.tsx`:
    - Sem o campo de protocolo. Texto inicial: "Informe o CPF do tutor. Enviamos um código para o contato informado na solicitação."
    - "Receber o código por" mostra só os canais devolvidos por `GET /request-access/channels`, com os rótulos E-mail, WhatsApp e SMS. Sem nenhum canal, mostra "No momento não é possível enviar o código. Procure o atendimento do município." e não mostra o envio.
    - Texto depois do envio: "Se o CPF tiver solicitação, enviamos um código de 6 dígitos por {canal} para o contato informado nela. Ele vale por 10 minutos."
    - Depois do código, cada solicitação vira um card com o que `tracked-request-view.tsx` mostra hoje (protocolo, situação, tipo, aberta em, última atualização, agendamento, local, endereço do local e documentos) e "Baixar requerimento" (`createRequirement(request)`, reaproveitando `RequirementDownload`). O card vai para `request-access/accessed-request-card.tsx`.
    - Abaixo da lista, como hoje: "Entrar", quando o CPF já tem conta, ou "Criar minha senha".
  - `access-types.ts`:
    - `AccessChannel` passa a usar os valores de `NotificationChannel` (`email`, `whatsapp`, `sms`).
    - `AccessStartBody` fica `{ municipalityId, cpf, channel }`.
    - `AccessView` fica `{ requests: AccessedRequest[]; account: { exists } }`.
  - `access-state.ts`: sai o `protocol`. O preenchimento automático é só `{ cpf }`. O canal inicial é o primeiro disponível. `EXPIRED` mantém o CPF e o canal.
  - `use-request-access.ts`: carrega os canais do município, e `send` e `open` passam a funcionar sem protocolo. A confirmação continua enviando `{ code, cpf }`.
- **`src/App.tsx`** (só os trechos):
  - Sai o import e o ramo de `RequestTracking`.
  - O botão "Acompanhar solicitação" de `publicHomeServices` passa a abrir `REQUEST_ACCESS_SERVICE`, com o mesmo nome. O cabeçalho do painel usa o nome do botão (sai o título "Acessar minha solicitação").
  - O `accessPrefill` vira `{ cpf }`. O link do aviso só abre a tela com o município escolhido.
  - `openRequestAccess` recebe só o CPF, e a `key` do `RequestAccess` não usa mais o protocolo.
- **`src/api.ts`:** saem `startRequestTracking`, `confirmRequestTracking`, `getTrackedRequest` e o import dos tipos do acompanhamento. Entra `requestAccess.channels(municipalityId)`.
- **`src/features/request-requester/follow-up-question.tsx`:**
  - "Sim, quero": "Se aceitar, você fica por dentro de tudo{ por canais}: confirmação ou mudança do agendamento e o resultado da sua solicitação."
  - "Não precisa": "Se preferir não receber avisos, é só consultar sua solicitação com seu CPF quando quiser."
- As telas de SMS, e-mail e WhatsApp leem os títulos dos contratos. A engrenagem do WhatsApp deixa de oferecer os avisos de documentos.
- Apagar `src/features/request-tracking/` inteiro, depois de levar o conteúdo do `tracked-request-view.tsx` para o card da solicitação.

### Backend

- **Contratos (`shared/`):**
  - `notification-contract.js`: saem `DOCUMENTS_APPROVED`, `DOCUMENTS_REJECTED` e `DocumentsOutcome`.
  - `sms-uses-contract.js` e `email-uses-contract.js`: os 11 usos da tabela, com os títulos novos. No e-mail saem `EmailVariable.DOCUMENTS_RESULT` e `documentVariables`.
  - `sms-messages-contract.js`: saem os dois textos de documentos.
  - `whatsapp-templates-contract.js`:
    - O `namePart` de cada uso passa a ser o da tabela (sem o prefixo `castracao_`).
    - Os três códigos ficam com `codigo_recuperacao_senha`, `codigo_confirmacao_contato` e `codigo_acesso_solicitacao`.
    - Os rótulos passam a ser os títulos da tabela, e saem os usos e campos de documentos.
    - `matchesUse` passa a comparar só o nome exato. O `_v<n>` continua sendo removido por `parseWhatsappTemplateName`.
    - A regra "precisa ser um template de utilidade" passa a valer para `contato_alterado`.
  - `request-access-contract.js`:
    - Recebe o padrão do código de 6 dígitos (`ACCESS_CODE_PATTERN`, vindo de `TRACKING_CODE_PATTERN`).
    - `AccessLinkParam.PROTOCOL` vira `AccessLinkParam.ACCESS` (o parâmetro continua sendo `acessar`).
    - `buildAccessPath` e `buildAccessUrl` deixam de receber o protocolo: o link fica `/?m=<slug>&acessar`.
    - `readAccessLink` devolve `{ slug }` quando o endereço tem `acessar`, com ou sem valor, então os links antigos continuam abrindo a tela.
- **Avisos:**
  - `notification-events.js`: `selectNotificationEvents` deixa de gerar avisos de documentos.
  - `notification-message.js`: saem os rótulos e o ramo de documentos.
  - `email-notice-text.js`: saem `documentsResults` e os textos de documentos.
  - `whatsapp-active-templates.js`: `templateLabel` passa a devolver o `label` do único uso.
- **Canais do código:**
  - Novo `backend/src/services/auth/code-channels.js`, com `listCodeChannels(municipalityId, purpose, deps)`. É a disponibilidade só do município, extraída de `getRecoveryOptions`:
    - e-mail: o template resolvido e a cota disponível;
    - WhatsApp: integração pronta, template ativo e aprovado e cota disponível;
    - SMS: `isSmsUseAvailable`.
  - É uma leitura que não consome cota nem chama o provedor. `recovery-channels.js` passa a usá-la e cruza o resultado com os contatos da conta. A recuperação de quem é da plataforma, sem município, continua só por e-mail, como hoje.
- **Envio do código (`auth-message-delivery.js`):**
  - `deliverRecoveryChannel` vira o envio pelo canal escolhido e passa a valer para `PASSWORD_RESET` e `REQUEST_TRACKING`. A conferência de expiração continua só na recuperação.
  - Sai o caminho `matched` do `REQUEST_TRACKING`, que usava a cadeia WhatsApp → SMS → e-mail.
- **Acesso por CPF:**
  - `routes/request-access.js`: novo `GET /channels?municipalityId=`, que devolve `{ channels }` com `Cache-Control: no-store`.
  - `access-input.js`:
    - `readAccessStartInput` lê `{ municipalityId, cpf, channel }`, com `channel` em `email`, `whatsapp` ou `sms`.
    - `accessDestination` usa o e-mail do tutor para `email` e o celular para `whatsapp` e `sms`.
    - Uma função explícita converte o canal escolhido no canal guardado com o código: `email` para e-mail e `whatsapp` para telefone, inclusive quando o código vai por SMS.
  - `access-handlers.js`:
    - **`start`:**
      - Limites pelo que foi digitado: CPF + IP, CPF por hora e CPF + canal a cada 60 s.
      - Recusa com 400 um canal que não está em `listCodeChannels` ("Escolha um canal disponível para receber o código.").
      - A solicitação de referência é a mais recente de procedimento do CPF no município que tenha o contato do tipo escolhido.
      - Envia em segundo plano, só pelo canal escolhido.
      - A resposta é igual exista o CPF ou não.
    - **`confirm`:** exige o CPF e o código. O resumo armazenado vincula o código ao CPF e ao contato que recebeu o envio.
    - **`view`:**
      - Devolve as solicitações de procedimento do mesmo CPF e município cujo contato do canal confere com o token, das mais recentes para as antigas, até 20, cada uma por `buildAccessView`. A projeção ganha `updated_at` e o resumo dos documentos (total, deferidos, a corrigir e em análise), levado de `tracking-view.js` para `access-view.js`.
      - Também devolve `account.exists` (alguma delas já tem tutor, ou o CPF já tem conta).
    - **`createPassword`:**
      - A conta nasce dos dados da solicitação de referência, como hoje.
      - Liga todas as solicitações listadas que ainda não têm tutor, com os animais delas.
      - Continua com o bloqueio por CPF e a auditoria.
  - `access-token.js`: guarda solicitação de referência, município, canal e resumos do CPF e do contato. Se o CPF ou o contato da referência mudar, é preciso solicitar um novo código.
  - `repositories/request-access.js`:
    - Sai `findAccessRequestByProtocol`.
    - Entra a busca das solicitações de procedimento por CPF no município ativo, das mais recentes para as antigas.
    - `linkAccessRequest` passa a ligar a lista.
  - `notify-request-registered.js`: `loadAccessLink` monta o link sem protocolo.
- **Remoção do acompanhamento:**
  - Saem `routes/request-tracking.js` (com o import e o `app.use` no `server.js`) e `services/request-tracking/*`.
  - Saem `findTrackableRequest` e `findTrackedRequest` de `repositories/request-tracking.js`. As funções do código ficam, e `isUuid` continua lá.
- **Cadastro interno:** sem mudança de código. Só o teste da seção "Testes necessários".

### Banco de dados

Sem impacto esperado no schema. Nenhuma migration.

- A coluna `request_tracking_challenges.channel` tem `CHECK (channel IN ('email', 'whatsapp'))` e continua guardando o **tipo do contato**: `whatsapp` quer dizer telefone, como hoje, mesmo quando o código vai por SMS. O canal real fica em `delivery`.
- As configurações salvas com as chaves de documentos (`documents_approved` e `documents_rejected`) ficam no banco, mas as funções de normalização dos contratos (`normalize...`) as ignoram ao ler. A próxima gravação do município já sai sem elas.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

- Nenhuma variável nova. O link continua usando `APP_PUBLIC_URL`.
- O publicado vai direto em `main`. Frontend e backend mudam o contrato do acesso juntos (mesmo build).
- **Fora do sistema, com o administrador:**
  - **Meta, antes de publicar:**
    - Criar os 11 templates da tabela.
    - Os códigos são de autenticação, com botão de copiar código.
    - O "Contato alterado" é de utilidade, com 1 variável (nome do tutor).
    - Conferir as variáveis de `castracao_nao_comparecimento` (hoje o corpo tem 5 e o esperado é 3) ou configurá-lo pela engrenagem.
  - **Meta, depois de publicar:**
    - Ativar os templates novos no município.
    - Apagar os antigos: `castracao_confirmacao_cadastro`, `castracao_confirmacao_agendamento`, `castracao_reagendamento`, `castracao_cancelamento`, `castracao_dados_tutor_alterados` e `castracao_documentos_analisados`.
  - **EmailJS:** os templates de documentos não são mais necessários. Agendamento cancelado continua sem ID.
  - **Produção:** na tela de e-mail, com o município selecionado, conferir se "Solicitação registrada" está ligada.

---

## Arquivos provavelmente afetados

- **`shared/`:**
  - `notification-contract.js`, `sms-uses-contract.js`, `email-uses-contract.js`, `whatsapp-templates-contract.js`, `sms-messages-contract.js` e `request-access-contract.js`;
  - `request-tracking-contract.js` (apagado).
- **`backend/src/services/notifications/`:** `notification-events.js`, `notification-message.js` e `email-notice-text.js`.
- **`backend/src/services/`:** `whatsapp-active-templates.js` e `notify-request-registered.js`.
- **`backend/src/services/auth/`:** `auth-message-delivery.js`, `recovery-channels.js` e `code-channels.js` (novo).
- **`backend/src/services/request-access/`:** `access-handlers.js`, `access-input.js` e `access-token.js`.
- **`backend/src/services/request-tracking/`:** apagado.
- **`backend/src/repositories/`:** `request-access.js` e `request-tracking.js`.
- **`backend/src/routes/`:** `request-access.js` e `request-tracking.js` (apagado).
- **`backend/src/server.js`**
- **`src/features/request-access/`:** `request-access.tsx`, `access-types.ts`, `access-state.ts` e `use-request-access.ts`.
- **`src/features/request-tracking/`:** apagado.
- **`src/features/request-requester/follow-up-question.tsx`**
- **`src/App.tsx`** (arquivo grande: só os trechos do acompanhamento, do card `tracking`, do `accessLink` e do `accessPrefill`, de `openRequestAccess` e do `RequestAccess`)
- **`src/api.ts`**
- **`docs/tutor-access.md`**
- **Testes:**
  - backend: `whatsapp-templates`, `sms-uses`, `sms-messages`, `email-templates`, `notification-contract`, `notification-events`, `notification-dispatch`, `notification-transports`, `document-reuse`, `request-access`, `recovery-options`, `request-registered-notice`, `request-routes` e `request-tracking` (apagado);
  - front: `request-access.test.tsx`, `access-state.test.ts`, `public-services-menu.test.tsx`, `requester-step.test.tsx`, `sms-settings.test.tsx`, `email-integration.test.tsx`, `whatsapp-integration.test.tsx`, `notification-results.test.ts`, `request-done-card.test.tsx` e os testes de `request-tracking` (apagados).

---

## O que será removido

- **Avisos de documentos, em todos os canais:**
  - `NotificationEvent.DOCUMENTS_APPROVED`, `NotificationEvent.DOCUMENTS_REJECTED` e `DocumentsOutcome` (`shared/notification-contract.js`);
  - `documentDecisionEvents` e `reviewableAttachments`, com os imports que só elas usam (`isComplaintPhotoId`, `DocumentReviewStatus`, `isExcludedDocument` e `PHOTO_DEFINITION`) em `notification-events.js`;
  - os rótulos e o ramo de documentos em `notification-message.js`;
  - `documentsResults`, os textos de documentos e o `documents_result` em `email-notice-text.js`;
  - `EmailVariable.DOCUMENTS_RESULT`, `documentVariables` e os dois usos em `email-uses-contract.js`;
  - os dois usos em `sms-uses-contract.js` e os dois textos em `sms-messages-contract.js`;
  - os dois usos, `documentFields` e `WHATSAPP_DOCUMENT_OUTCOMES_LABEL` em `whatsapp-templates-contract.js`, e o caso especial de `templateLabel` em `whatsapp-active-templates.js`;
  - a seção "Documentos deferidos e indeferidos" de `docs/tutor-access.md`.
- **Reconhecimento por nome antigo no WhatsApp:**
  - `templateAliases` inteiro (`nao_compareceu`, `documentos_*` e `dados_tutor_alterados`);
  - `nameSuffix` e o prefixo compartilhado `codigo_`;
  - `groupLabel` ("Códigos de acesso");
  - os `namePart` antigos (`confirmacao_agendamento`, `reagendamento`, `cancelamento`, `indeferimento` e `codigo`).
- **Tela "Acompanhar solicitação":**
  - `src/features/request-tracking/` inteiro: `request-tracking.tsx`, `tracked-request-view.tsx`, `tracking-contact.ts`, `tracking-state.ts`, `tracking-types.ts`, `use-request-tracking.ts` e os testes;
  - `backend/src/services/request-tracking/` inteiro: `tracking-handlers.js`, `tracking-input.js`, `tracking-token.js` e `tracking-view.js`;
  - `backend/src/routes/request-tracking.js`, com o import e o `app.use` no `server.js`;
  - `findTrackableRequest` e `findTrackedRequest` em `repositories/request-tracking.js`;
  - `startRequestTracking`, `confirmRequestTracking`, `getTrackedRequest` e o import dos tipos em `src/api.ts`;
  - o import de `RequestTracking` e o ramo `activePublicService === "tracking"` em `src/App.tsx`;
  - `backend/test/request-tracking.test.js`.
- **`shared/request-tracking-contract.js`:** `TRACKING_TOKEN_SECONDS` e `normalizeTrackingProtocol` deixam de ser usados. O padrão do código vai para `request-access-contract.js`.
- **Protocolo no acesso:**
  - o campo, o estado e a validação na tela;
  - `protocol` em `readAccessStartInput`;
  - `findAccessRequestByProtocol`;
  - o protocolo em `buildAccessPath`, `buildAccessUrl` e `readAccessLink`;
  - `accessPrefill.protocol` e `initialProtocol`.
- **Troca automática de canal no código de acesso:** o caminho `matched` do `REQUEST_TRACKING` em `deliverAuthMessage`.
- **`ContactKind`** como opção de canal na tela de acesso (`channelOptions`, `channelNames` e o tipo `AccessChannel` atual).

---

## Estratégia de implementação

1. **Contratos de mensagens (`shared/`):**
   - Os 11 usos, na ordem da tabela, nos contratos de SMS, e-mail e WhatsApp.
   - Sai tudo de documentos.
   - Os nomes da Meta e a comparação exata no WhatsApp.
   - A regra de utilidade em `contato_alterado`.
2. **Avisos:**
   - Saem os documentos de `notification-events`, `notification-message` e `email-notice-text`.
   - `templateLabel` fica simples.
   - Ajustar os testes de avisos e de documentos.
3. **Canais do código:**
   - Criar `code-channels.js` a partir de `getRecoveryOptions` e fazer a recuperação usá-lo (o teste `recovery-options` deve seguir passando).
   - Generalizar o envio por canal escolhido para `REQUEST_TRACKING` e remover o `matched`.
4. **Acesso por CPF (backend):**
   - Contrato do link e do padrão do código.
   - `access-input`, repositório, `start`, `view` e `createPassword`.
   - `GET /request-access/channels`.
   - `notify-request-registered` sem protocolo.
5. **Remoção do acompanhamento:** backend, `server.js`, repositório, `api.ts`, `App.tsx` e a pasta do front. Apagar `request-tracking-contract.js` depois de mover o padrão.
6. **Tela de acesso e textos (front):**
   - Tipos, estado, hook e componente.
   - Card da página inicial (rótulo pela pergunta 1).
   - "Criar minha senha" na tela final só com o CPF.
   - Os textos do "Sim, quero" e do "Não precisa".
7. **Cadastro interno:** o teste de rota descrito em "Testes necessários".
8. **Documentação:** `docs/tutor-access.md`:
   - a lista de usos (11);
   - os códigos por canal escolhido;
   - "Acessar minha solicitação" com CPF, os endpoints e o link sem protocolo;
   - a tela final;
   - sai o acompanhamento e a seção de documentos.
9. **Validação:** rodar os comandos de validação uma vez ao final e varrer o diff por token, ID de conta e telefone reais.

---

## Regras de negócio identificadas

- **11 mensagens, iguais nos três canais:**
  - os mesmos títulos e a mesma ordem;
  - avisos seguem assunto + resultado, e códigos seguem ação + objeto;
  - na Meta, o nome é `castracao_` + o título sem acento, e os códigos usam `castracao_codigo_`.
- **Templates do WhatsApp:**
  - cada template serve só à sua mensagem, pelo nome exato (com `_v<n>` opcional) ou pela engrenagem;
  - os três códigos são templates de autenticação com botão de copiar código, cada um com o próprio interruptor;
  - "Contato alterado" é de utilidade, com 1 variável.
- **Documentos:** a análise de documentos não avisa o tutor por nenhum canal.
- **"Acessar minha solicitação":**
  - pede só o CPF;
  - os canais oferecidos são os que estão com a mensagem 10 disponível no município:
    - e-mail: conta e template configurados, mensagem ligada e contrato em vigor;
    - WhatsApp: integração pronta, template ativo e aprovado e contrato em vigor;
    - SMS: integrado, contrato em vigor e mensagem ligada;
  - o código vai só pelo canal escolhido, sem troca automática;
  - o código vai para o contato da solicitação de procedimento mais recente do CPF que tenha o tipo de contato escolhido (e-mail do tutor, ou celular para WhatsApp e SMS);
  - depois do código, a tela lista as solicitações do CPF com o mesmo contato, até 20;
  - "Criar minha senha" cria a conta com os dados da solicitação de referência e liga as solicitações listadas que ainda não têm tutor. Só o contato que recebeu o código nasce confirmado, como hoje.
- **Link do aviso "Solicitação registrada":** `/?m=<slug>&acessar` abre a tela com o município. Os links antigos com protocolo continuam abrindo.
- **Textos:**
  - "Sim, quero": sem "análise dos documentos".
  - "Não precisa": consultar com o CPF.

---

## Regras multi-tenant e segurança

- **Município:**
  - `municipalityId` vem do corpo ou da query como UUID validado.
  - Toda consulta é filtrada por `municipality_id` e exige o município ativo (`m.active = TRUE`), como hoje.
  - A lista, a confirmação e a senha nunca saem do município do código.
- **O que as respostas revelam:**
  - Os canais oferecidos dependem só da configuração do município, e nada do CPF.
  - A resposta de `start` é a mesma exista o CPF ou não, e o envio roda depois da resposta.
- **Limites:** contados pelo que foi digitado (CPF + IP, CPF por hora e CPF + canal a cada 60 s). Os limites da confirmação ficam como estão.
- **CPF e token:**
  - O CPF nunca vai em mensagem nem em link.
  - O token guarda a solicitação de referência e os resumos do CPF e do contato.
  - A confirmação continua exigindo CPF + código em tempo constante.
- **Lista e senha:**
  - A lista usa a projeção de `buildAccessView`: sem histórico, observações, documentos ou dados internos.
  - Só entram solicitações do mesmo CPF, município e contato.
  - A senha mantém o `pg_advisory_xact_lock` por CPF e liga só solicitações sem tutor desse mesmo conjunto.
  - Auditoria: `REQUEST_ACCESS_GRANTED` e `TUTOR_ACCOUNT_CREATED` (com as solicitações ligadas).
- **Telas internas:** as permissões de SMS, e-mail e WhatsApp não mudam.

---

## Validações necessárias

- `POST /request-access/challenges`:
  - `municipalityId` UUID;
  - CPF válido (`readAccessCpf`);
  - `channel` em `email`, `whatsapp` ou `sms` e disponível no município. Senão, 400 com a mensagem de canal disponível.
- `POST /request-access/challenges/:id/confirm`: id UUID, código de 6 dígitos (`ACCESS_CODE_PATTERN`) e CPF válido.
- `GET /request-access/channels`: `municipalityId` UUID. Município inexistente ou inativo devolve `{ channels: [] }`.
- `GET /request-access/request` e `POST /request-access/password`: token como hoje.
- Front:
  - CPF com 11 dígitos;
  - canal entre os disponíveis;
  - código de 6 dígitos;
  - envio bloqueado enquanto os canais carregam ou quando não há canal.

---

## Testes necessários

### Frontend

- `request-access.test.tsx`:
  - a tela pede só o CPF;
  - mostra só os canais devolvidos pela API, com os rótulos E-mail, WhatsApp e SMS;
  - sem canal, mostra a mensagem do atendimento;
  - o envio manda `{ municipalityId, cpf, channel }`;
  - a lista mostra protocolo, situação e "Baixar requerimento" de cada solicitação;
  - mostra "Criar minha senha" ou "Entrar" conforme `account.exists`.
- `access-state.test.ts`: sem protocolo; o preenchimento automático é só do CPF; ao expirar, mantém o CPF e o canal.
- `public-services-menu.test.tsx`: o botão "Acompanhar solicitação" continua na home.
- `requester-step.test.tsx` (ou o teste da pergunta): os textos novos do "Sim, quero" e do "Não precisa".
- `sms-settings.test.tsx`, `email-integration.test.tsx` e `whatsapp-integration.test.tsx`: os títulos novos, sem documentos.
- `request-done-card.test.tsx` (se cobrir): "Criar minha senha" abre o acesso com o CPF.
- Apagar os testes de `src/features/request-tracking/`.

### Backend

- Um teste que compara os títulos de `smsUses`, `emailUses` e `whatsappUses` e exige a mesma lista, na mesma ordem: as 11 da tabela.
- `whatsapp-templates.test.js`:
  - cada nome da tabela é reconhecido só para o seu uso, e `_v2` também;
  - os nomes antigos não são reconhecidos pelo nome: `confirmacao_agendamento`, `reagendamento`, `cancelamento`, `indeferimento`, `nao_compareceu`, `documentos_conferidos`, `dados_tutor_alterados` e um `codigo_*` genérico;
  - ativar um código não ativa os outros dois;
  - `contato_alterado` fora de utilidade é recusado.
- `notification-events.test.js`: deferir ou indeferir documentos não gera aviso.
- `sms-messages`, `sms-uses`, `email-templates`, `notification-contract`, `notification-dispatch`, `notification-transports` e `document-reuse`: sem os casos de documentos.
- `request-access.test.js`:
  - **Canais:** o endpoint de canais devolve só os disponíveis; um canal indisponível recebe 400.
  - **Envio:** a resposta é igual com CPF inexistente; o código vai para a solicitação mais recente com o tipo de contato escolhido e só pelo canal escolhido (WhatsApp falhando não manda SMS); os limites são por CPF.
  - **Confirmação:** exige o CPF.
  - **Lista:** só o mesmo CPF, município e contato, até 20.
  - **Senha:** liga as solicitações listadas sem tutor e não liga as de outro contato.
- `recovery-options.test.js`: segue passando com `listCodeChannels`.
- `request-registered-notice.test.js`: o link sem protocolo; `readAccessLink` aceita o link antigo e o novo.
- `request-routes.test.js`: o cadastro feito por usuário da equipe, com acompanhamento aceito e e-mail, guarda `workflow_data.followUp` e chama o aviso "Solicitação registrada".
- Apagar `backend/test/request-tracking.test.js`.

### Conferência manual (tela)

- **SMS e e-mail:** as 11 mensagens, com os títulos e a ordem da tabela.
- **WhatsApp:** depois de sincronizar, a coluna "Aviso" mostra o título de cada template novo, e os três códigos ligam separados.
- **"Acessar minha solicitação":**
  - aparecem só os canais ativos;
  - o código chega pelo canal escolhido;
  - a lista mostra as solicitações;
  - criar a senha entra na área do tutor com elas.
- **Página inicial:** o botão "Acompanhar solicitação" abre a tela por CPF.
- **Link do aviso "Solicitação registrada":** abre a tela.
- **Produção, cadastro interno:** com "Solicitação registrada" ligada no e-mail do município e o contrato em vigor, um cadastro do balcão com e-mail no acompanhamento recebe o aviso e o histórico registra o envio.

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

- **Meta:**
  - Os nomes antigos deixam de ser reconhecidos, e as ativações feitas com eles param.
  - Os templates novos precisam existir antes de publicar e ser ativados depois. Um template antigo só continua funcionando se estiver configurado na engrenagem.
- **Documentos:** os interruptores e IDs salvos para documentos são ignorados. A equipe continua deferindo e indeferindo, sem aviso ao tutor.
- **CPF é fácil de conseguir:**
  - Alguém com uma lista pode disparar códigos, e cada SMS ou WhatsApp é cobrado.
  - Os limites por CPF e por IP seguram isso.
  - A resposta igual e os canais por município evitam revelar quem tem solicitação.
- **Lista e senha:** criar a senha passa a ligar várias solicitações à conta. Só entram as do mesmo CPF e do mesmo contato confirmado pelo código.
- **Canal guardado:** a coluna do código guarda `whatsapp` para telefone mesmo quando o envio é por SMS, para não precisar de migration. O canal real fica em `delivery`.
- **Nomes antigos que ficam:** `request_tracking_challenges`, `repositories/request-tracking.js` (com `isUuid`, usado por várias rotas) e a chave `request_tracking`.
- **Contrato front/back do acesso:** muda junto, no mesmo build. Uma tela aberta antes do deploy recebe erro ao enviar o protocolo e precisa recarregar.
- **Códigos em andamento:** após o deploy, quem iniciou o acesso antes dele precisa solicitar um novo código.
- **Produção:** o commit vai direto em `main`. Publicar só com autorização.
- **Migrations:** nenhuma prevista. Não alterar migrations antigas.

---

## Perguntas em aberto

Nenhuma pergunta em aberto identificada. Decidido no início da implementação:

1. **Tela e nome:** "Acompanhar solicitação" e "Acessar minha solicitação" viram uma tela só, com o nome "Acompanhar solicitação" no botão da home e no cabeçalho. A lista mostra só as solicitações do CPF ligadas ao contato que recebeu o código.
2. **Histórico quando a mensagem está desligada no município:** continua em silêncio, como hoje.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- As telas de SMS e e-mail mostram as 11 mensagens da tabela, na mesma ordem. O WhatsApp usa os mesmos títulos na coluna "Aviso" e na engrenagem, e um teste garante a mesma lista nos três contratos.
- Cada template da Meta é reconhecido só pela sua mensagem. Os nomes antigos não são reconhecidos pelo nome, e os três códigos são ligados e desligados separadamente.
- Deferir ou indeferir documentos não envia aviso por nenhum canal. Nenhuma tela mostra mensagem de documentos, e o "Sim, quero" não promete aviso de documentos.
- "Acessar minha solicitação":
  - pede só o CPF;
  - mostra só os canais com a mensagem 10 disponível;
  - envia o código só pelo canal escolhido;
  - responde igual exista o CPF ou não;
  - lista as solicitações do mesmo CPF e contato;
  - liga essas solicitações ao criar a senha.
- O botão "Acompanhar solicitação" da home abre a tela por CPF, que mostra a situação de cada solicitação. O fluxo antigo por protocolo + contato (tela, API e código) não existe mais, e "Acessar minha solicitação" não é mais uma tela separada.
- O link do aviso "Solicitação registrada" sai como `/?m=<slug>&acessar`, e os links antigos continuam abrindo a tela.
- Um teste prova que o cadastro interno com acompanhamento aceito dispara "Solicitação registrada".
- `docs/tutor-access.md` descreve o novo comportamento.
- Typecheck, testes e build passam sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Responder às perguntas em aberto com o usuário antes de começar.
- Não executar migrations sem confirmação explícita (nenhuma é prevista).
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito, só com valores falsos.
- Não editar `escopo-padrao-mensagens.md` nem `escopo-integracoes-notificacoes.md`.
