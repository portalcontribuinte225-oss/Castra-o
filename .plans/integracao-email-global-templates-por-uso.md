# Plano de Implementação: E-mail global (conta EmailJS única) com um template por uso, interruptor por município e opção de mais de um canal

## Origem

- Arquivo de especificação: nenhum arquivo único. Base: a conversa de 2026-11-15, o código do `main` (commit `ce2c672`) e os planos `.plans/aba-email-canais.md` (a aba E-mail dele é **substituída** por este plano), `.plans/reforma-integracao-whatsapp.md` e `.plans/whatsapp-templates-reconhecimento-automatico.md` (padrões reaproveitados) e `.plans/acompanhamento-canais-notificacoes-fase-4.md` (a regra "WhatsApp prioritário, sem envio duplo" dele é **substituída**, para os avisos da solicitação, pela política deste plano).
- Data do planejamento: `2026-11-15`
- Classificação: `frontend + backend` (sem migration; tudo fica na tabela `config`, em JSON). Não há variável de ambiente nova.

---

## Resumo

Hoje a aba E-mail mostra só o status das variáveis de ambiente `EMAILJS_*` (somente leitura) e guarda, por município, um template único para os avisos e campos de template de acesso digitados à mão, sem interruptor e sem teste. Os avisos da solicitação saem por WhatsApp primeiro e o e-mail só entra se o WhatsApp falhar.

Passa a funcionar assim:

- **Uma conta EmailJS global.** Service ID, Public Key, Private Key (cifrada) e o endereço público do sistema são salvos pela tela e editados **somente pelo usuário master**.
- **10 usos**, cada um com um **ID de template global**, também editado só pelo master: 5 avisos da solicitação (agendamento confirmado, alterado e cancelado, documentos conferidos, atendimento concluído) e 5 mensagens de acesso (senha inicial, recuperação de senha, confirmação de e-mail, acompanhamento de solicitação, contato alterado). A confirmação de telefone não vai por e-mail.
- **Cada município só liga ou desliga** cada uso (administrador municipal, suporte e master).
- **Opção do município "enviar o mesmo aviso por mais de um canal"** (desligada por padrão). Desligada, os avisos da solicitação saem **só por e-mail**; ligada, saem por e-mail e também por WhatsApp, cada canal de forma independente. Onde o solicitante escolhe o canal (recuperação de senha, acompanhamento por código), vale a escolha dele e a opção não interfere.
- **Identidade do município no e-mail.** O envio passa a mandar nome, brasão e contato do município como variáveis. O brasão sai por uma rota pública nova, porque hoje ele é base64 no banco e os clientes de e-mail não o exibem.
- **Credenciais só pela tela.** O código deixa de ler `EMAILJS_*`.
- **Sem envio de teste.** A validação é feita em produção.

Motivo: os modelos de e-mail são iguais para todos os municípios; só nome, brasão e contato mudam. Os templates são criados no EmailJS, sem código; o sistema só envia o ID e as variáveis. O e-mail é o meio padrão das notificações (é o contato obrigatório do acompanhamento), e o WhatsApp é um segundo caminho que o município liga se quiser. A tela segue a aba WhatsApp (credenciais com a chave visível pelo começo e removível, lista de templates com interruptor, trava até haver template).

### Decisões do usuário (2026-11-15)

1. Só o **master** edita credenciais e IDs de template. O suporte vê a tela do município, sem credenciais nem IDs, e pode ligar ou desligar usos.
2. O Render ainda não tem chaves de e-mail e o sistema só roda local: as credenciais entram **só pela tela**, sem fallback para `EMAILJS_*`.
3. A recuperação de senha por e-mail vem **ligada por padrão**.
4. Município sem brasão: `municipality_brasao_url` vai **vazio** (sem imagem padrão).
5. O endereço público do sistema é um **campo na tela do master** (sem variável de ambiente).
6. Os 3 avisos de agendamento mandam data, horário e local como **variáveis separadas**.
7. A prévia da chave privada tem **8 caracteres**, o mesmo padrão do WhatsApp (um padrão só entre as integrações).
8. **Sem envio de teste.**
9. Não há clientes nem produção: sem SQL de transição. O banco local não tem linhas antigas de e-mail (conferido em 2026-11-15).
10. Em alguns casos o solicitante escolhe o método de recebimento; nos **avisos automáticos o município decide** se o mesmo aviso sai por mais de um canal. Com a opção **desligada: só e-mail**. Ligada: e-mail e WhatsApp.

---

## Escopo

### Dentro do escopo

- Papel **master** distinguido do global: `MASTER_ROLE`, `isMasterUser` em `backend/src/tenant.js`, middleware `requireMaster` e `isMasterRole` no frontend.
- Contrato compartilhado dos 10 usos, das chaves de configuração e dos normalizadores.
- Armazenamento global (`municipality_id` nulo) e por município na tabela `config`, com lock e auditoria.
- Credenciais cifradas, endereço público, IDs globais de template e interruptores por município.
- **Opção `multiChannel` do município** (campo novo em `castragestao:notifications`), interruptor na aba E-mail e regra nova de envio dos 5 avisos da solicitação.
- Variáveis `municipality_*` e `schedule_*` no envio; rota pública do brasão.
- Rotas `/api/email/*`, nova tela da aba E-mail e remoção do modelo antigo.
- Padrão único de segredo salvo entre WhatsApp e e-mail (prévia de 8 caracteres e campo mascarado com "Remover").
- Atualização de `docs/tutor-access.md` e dos arquivos `.env.example`.

### Fora do escopo

- Envio de teste de e-mail.
- Os fluxos em que o solicitante escolhe o canal: recuperação de senha, acompanhamento por código e confirmações de e-mail e de telefone. Não mudam.
- O envio da senha inicial e do aviso de contato alterado, que seguem como hoje e ficam fora da opção `multiChannel` (ver "Perguntas em aberto").
- SMS como canal de aviso (`smsEnabled` continua constante, desligado).
- Sincronizar templates do EmailJS (não foi verificado se existe API de listagem; o ID é digitado).
- Credenciais por município, novos eventos (lembrete, indeferida, aviso interno) e templates diferentes por município.
- Renomear as classes CSS `whatsapp-*` reaproveitadas, ou unificar `repositories/whatsapp-templates.js` com o repositório novo de e-mail.
- Alterar o `.env` real do usuário (as linhas `EMAILJS_*` dele ficam sem uso e ele as apaga se quiser).
- A listagem pública `GET /api/municipalities`, que já devolve as linhas inteiras (inclusive o brasão em base64) e a mensagem do erro interno. É anterior a este plano e não será alterada.

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md`, `.claude/skills/planejar/SKILL.md` e `TEMPLATE_planejar.md`
- Planos: `aba-email-canais.md`, `acompanhamento-canais-notificacoes-fase-4.md`, `whatsapp-templates-reconhecimento-automatico.md`
- Backend: `server.js`, `tenant.js`, `middleware/auth.js`, `routes/config.js`, `routes/whatsapp.js`, `routes/whatsapp-templates.js`, `routes/municipalities.js`, `routes/requests.js` (entrega da senha inicial), `services/email.js`, `services/whatsapp.js`, `services/whatsapp-credentials.js`, `services/whatsapp-active-templates.js`, `services/config-secret-cipher.js`, `services/audit.js`, `services/notifications/dispatch-notification.js`, `notification-message.js`, `whatsapp-template-parameters.js`, `services/request-change-notifications.js`, `services/request-tracking/tracking-handlers.js`, `services/auth/auth-message-delivery.js`, `recovery-channels.js`, `repositories/channel-config.js`, `request-settings.js`, `whatsapp-templates.js`, `auth-limits.js`, `db/migrations.js` (tabela `config`)
- Contratos: `shared/email-contract.js`, `notification-contract.js`, `auth-contract.js`, `whatsapp-templates-contract.js`
- Frontend: `src/features/email/*`, `notifications/*`, `request-follow-up/follow-up-step.tsx`, `tutor-access/auth-delivery-settings.tsx`, `use-auth-delivery-settings.ts`, `enrollment-notice.tsx`, `password-recovery-form.tsx`, `whatsapp-integration/*` (aba, credenciais, tabela, hooks), `src/components/ui.tsx`, `src/api.ts`, `src/utils.ts`, `src/domain.ts` e os trechos de `src/App.tsx` que montam a aba E-mail
- Testes de backend que citam e-mail: `auth-delivery`, `channel-config`, `config-security`, `notification-contract`, `notification-dispatch`, `notification-transports`, `recovery-options`, `fixtures/auth-http.js`
- `docs/tutor-access.md`, `backend/.env.example`, `.env.example`

Fatos verificados que sustentam o plano:

- A tabela `config` já aceita linha global: o índice único `config_key_municipality_idx` usa `COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid)` e os upserts atuais usam esse mesmo `ON CONFLICT`. Não precisa de migration. `readWhatsappConfigValue` compara `municipality_id=$2`, que nunca casa com nulo, por isso o e-mail ganha um repositório próprio.
- `requireGlobal` libera master **e suporte**. Não existe verificação só de master, por isso entra `requireMaster`.
- Hoje o envio lê `EMAILJS_SERVICE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY` e `EMAILJS_TEMPLATE_ID` direto de `process.env` em `services/email.js`, `auth-message-delivery.js` e `recovery-channels.js`.
- `GET /api/municipalities` é público e devolve `SELECT *`, inclusive o brasão em base64. A rota pública do brasão não amplia a exposição.
- **Quem escolhe o canal hoje.** O solicitante escolhe na recuperação de senha (tela "Escolha o contato", com as opções que o município tem disponíveis) e no acompanhamento por código (o contato que ele digita). Os avisos da solicitação são automáticos: no formulário o solicitante só diz se quer acompanhar e informa e-mail (obrigatório) e telefone (opcional), e a tela diz que a prefeitura usa os canais disponíveis. A senha inicial também é automática: aparece na tela uma única vez ao concluir o cadastro e é enviada aos contatos do acompanhamento, sem modal de escolha.
- **Regra atual dos avisos** (`dispatch-notification.js`): WhatsApp primeiro e e-mail só se o WhatsApp não enviar, sem envio duplo. Não existe hoje nenhuma opção de mais de um canal.
- `castragestao:notifications` é lido pelo formulário público de acompanhamento (`use-follow-up-policy.ts` usa `emailEnabled`) e pode ser gravado por administrador municipal ou global.
- O único segredo com prévia hoje é o token do WhatsApp (`TOKEN_PREVIEW_LENGTH = 8`).
- `encryptSecretStrict` exige `CONFIG_ENCRYPTION_KEY` válida; sem ela falha com status 503.

---

## Impacto por área

### Frontend

- **Aba E-mail** (`src/features/email/`), substituindo `email-settings.tsx`:
  - **Master:** vê o bloco **Credenciais** (ID do serviço e chave pública lado a lado, chave privada com campo mascarado, "Remover chave" com confirmação e "Salvar credenciais", e o campo "Endereço público do sistema") e a **tabela de templates** (Mensagem, ID do template, Variáveis, Ativo) com "Salvar templates".
  - **Administrador municipal e suporte:** não veem credenciais nem IDs. Veem a linha "Identificação nos e-mails" (nome, departamento e situação do brasão: cadastrado, não cadastrado ou endereço público não configurado) e a tabela com as colunas Mensagem, Template ("Configurado" ou "Sem template") e Ativo; a coluna Variáveis não aparece para eles.
  - **Sem município selecionado (master):** a coluna Ativo e a opção de mais de um canal ficam ocultas, com a nota "Selecione um município para ligar ou desligar as mensagens". As credenciais e os IDs continuam editáveis.
  - Uma só tabela com os 10 usos, sem subtítulos de grupo. Interruptor trava (`OFF*`) enquanto não houver template configurado.
  - Ao expandir "ver ▾" a linha mostra as variáveis do uso (a lista vem do contrato compartilhado).
  - Uma linha de ajuda sob a chave privada: requer "Allow EmailJS API for non-browser applications" ligado no EmailJS (Account > Security).
  - Estados de carregando, erro com "Carregar novamente" e somente leitura, como na aba WhatsApp.
- **Opção de mais de um canal** (bloco do município, acima da tabela): interruptor "Enviar o mesmo aviso por mais de um canal", que grava na hora como os outros interruptores. Texto de apoio: "Desligado: os avisos da solicitação saem só por e-mail. Ligado: saem por e-mail e também por WhatsApp, quando o WhatsApp do município está ativo e o solicitante informou telefone." Novo `src/features/notifications/multi-channel-switch.tsx`; o hook `use-notification-settings.ts` é **mantido e adaptado** (passa a tratar `multiChannel`; saem `emailTemplateId` e `notificationChannelPatch`). Lê e grava pela rota de configuração existente (`castragestao:notifications`).
- **Nota na aba WhatsApp** (`whatsapp-templates-panel.tsx`): uma linha dizendo que os avisos da solicitação só saem por WhatsApp quando "Enviar o mesmo aviso por mais de um canal" estiver ligado na aba E-mail, para não parecer que o WhatsApp parou de funcionar.
- **Campo de segredo salvo compartilhado:** extrair de `whatsapp-credentials.tsx` o campo mascarado (início visível, máscara, "Remover", confirmação) para `src/components/saved-secret-field.tsx`, usado pelo WhatsApp e pelo e-mail. O comportamento do WhatsApp não muda.
- **Chamadas novas em `src/api.ts`:** `getEmailSettings`, `saveEmailAccount`, `saveEmailTemplates`, `setEmailUseActive`. Sai `getEmailIntegrationStatus`.
- **`src/App.tsx`** (arquivo grande: tocar só o import perto da linha 180 e a montagem da aba E-mail perto da linha 7733, que passa a receber se o usuário é master). `src/utils.ts` ganha `isMasterRole`.
- Sem CSS novo: reaproveitar `Field`, `PanelHeader`, `ConfigActiveToggle`, `primary-action`, `ghost-button`, `danger-action` e as classes de tabela e interruptor da aba WhatsApp.

### Backend

- **Papéis:** `MASTER_ROLE` e `isMasterUser` em `tenant.js`; `requireMaster` em `middleware/auth.js`.
- **Contrato (`shared/`):**
  - `email-uses-contract.js` (novo): os 10 usos com chave, tipo (aviso ou acesso), rótulo, variáveis e padrão ligado (só `password_reset`). As chaves reaproveitam `NotificationEvent` e `AuthPurpose`, sem strings novas. `verify_phone` fica de fora.
  - `email-contract.js`: chaves `email_account` e `email_templates` (globais) e `email_active_uses` (por município), normalizadores e validadores.
  - `notification-contract.js`: `castragestao:notifications` ganha `multiChannel` (booleano, padrão `false`) na construção, normalização e validação; saem `emailTemplateId` e `mergeNotificationConfig`.
- **Armazenamento:** `repositories/email-config.js` (novo), leitura e escrita de linha global ou municipal, com lock advisory e auditoria na mesma transação (mesmo padrão de `whatsapp-templates.js`).
- **Segredo:** `services/secret-preview.js` (novo) com o tamanho único da prévia (8) e a função da prévia, usado por `whatsapp-credentials.js` e pelo e-mail.
- **Serviços novos:**
  - `email-account.js`: valida, cifra a chave privada com `encryptSecretStrict` (com mensagem de erro própria de e-mail), guarda a prévia e a lê no momento do envio, sem cache e sem leitura de `process.env`.
  - `email-templates.js`: lista para a tela (IDs só para o master), salva IDs globais, liga e desliga por município e expõe `resolveEmailTemplate(municipalityId, use)`.
  - `email-identity.js` com `repositories/municipality-identity.js`: monta as variáveis `municipality_*`.
- **Rota pública do brasão:** `routes/municipality-brasao.js` em `GET /api/public/municipalities/:id/brasao`.
- **Rotas `/api/email` (`routes/email.js`):**
  - `GET /settings`: master vê tudo (conta e IDs); os demais veem a visão do município.
  - `PUT /account` e `PUT /templates`: `requireMaster`.
  - `PUT /templates/active`: `requireMunicipalAdmin`, município por `pickMunicipalityId`.
- **Envio dos avisos da solicitação** (`dispatch-notification.js`): passa a tentar o **e-mail primeiro** (`resolveEmailTemplate` + variáveis do município e de agendamento) e, **só com `multiChannel` ligado**, tenta também o WhatsApp, de forma independente. Desligado, o WhatsApp não envia aviso da solicitação. Solicitações antigas (sem `followUp`) seguem como hoje: só WhatsApp, só agendamento confirmado e alterado. `notifyRequestChanges` continua passando a configuração do município (agora com `multiChannel`) e registrando um resultado por canal no histórico.
- **Envio das mensagens de acesso:** `auth-message-delivery.js` e `recovery-channels.js` usam `resolveEmailTemplate` e anexam as variáveis do município. A lógica de canais de cada mensagem não muda. A recuperação de senha de equipe global (sem município) usa o ID global de `password_reset`, sem interruptor.
- **`services/email.js`:** usa a conta salva.
- **Auditoria:** ações novas `EMAIL_ACCOUNT_UPDATE`, `EMAIL_TEMPLATES_UPDATE` e `EMAIL_USE_UPDATE` em `services/audit.js`, sem valores de segredo. A gravação de `multiChannel` já cai na auditoria de configuração existente (`CONFIG_UPDATE`).
- **`routes/config.js`:** sai o tratamento do modelo antigo (ver "O que será removido"). `prepareConfigValue` passa a normalizar `castragestao:notifications` com `normalizeNotificationConfig`, porque hoje a normalização vem do merge que será removido.

### Banco de dados

Sem alteração de schema. Linhas novas ou alteradas na tabela `config`:

- `email_account` (global, `municipality_id` nulo): `{ serviceId, publicKey, privateKey (cifrada), privateKeyPreview, publicUrl }`.
- `email_templates` (global): `{ templates: { <uso>: "<id>" } }`.
- `email_active_uses` (por município): `{ active: { <uso>: true|false } }`. Guarda também o `false` explícito, porque `password_reset` vem ligado por padrão.
- `castragestao:notifications` (por município, já existente): ganha `multiChannel`.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção. Este plano não cria migration.

### Infra/Deploy

- Nenhuma variável de ambiente nova. Nada a mudar no Render por conta deste plano.
- `CONFIG_ENCRYPTION_KEY` válida precisa existir em cada ambiente antes de salvar a chave privada (já é exigida pelo WhatsApp). No Render, uma chave nova, nunca a local.
- Depois do deploy, o master entra na tela e salva a conta, o endereço público e os IDs de template.
- Os arquivos `.env.example` e `backend/.env.example` perdem os blocos `EMAILJS_*`. O `.env` real não é alterado.
- O push em `main` dispara deploy no Render. Como não há migration nem variável nova, o risco é só de comportamento.

---

## Arquivos provavelmente afetados

**Novos**

- `shared/email-uses-contract.js`
- `backend/src/routes/email.js`, `backend/src/routes/municipality-brasao.js`
- `backend/src/repositories/email-config.js`, `backend/src/repositories/municipality-identity.js`
- `backend/src/services/email-account.js`, `email-templates.js`, `email-identity.js`, `secret-preview.js`
- `src/components/saved-secret-field.tsx`
- `src/features/notifications/multi-channel-switch.tsx`
- `src/features/email/email-integration-tab.tsx`, `email-credentials.tsx`, `email-templates-table.tsx`, `email-integration-types.ts` e os hooks `use-email-settings.ts` e `use-email-account.ts`
- Testes: `backend/test/email-account.test.js`, `email-templates.test.js`, `email-routes.test.js`, `municipality-brasao.test.js`, `email-identity.test.js` e `src/features/email/email-integration.test.tsx`

**Alterados**

- `shared/email-contract.js`, `shared/notification-contract.js`, `shared/auth-contract.js`
- `backend/src/server.js`, `tenant.js`, `middleware/auth.js`, `routes/config.js`
- `backend/src/services/email.js`, `audit.js`, `whatsapp-credentials.js`, `notifications/dispatch-notification.js`, `auth/auth-message-delivery.js`, `auth/recovery-channels.js`
- `src/api.ts`, `src/utils.ts`, `src/App.tsx` (só imports e montagem da aba), `src/features/notifications/use-notification-settings.ts`, `src/features/whatsapp-integration/whatsapp-credentials.tsx` e `whatsapp-templates-panel.tsx`
- `docs/tutor-access.md` (linhas sobre `castragestao:auth-delivery` e `EMAILJS_TEMPLATE_ID`), `.env.example`, `backend/.env.example`
- Testes existentes listados em "Testes necessários"

---

## O que será removido

Cada item deve ser **deletado do arquivo**, não comentado nem ocultado.

- **Configuração antiga de entrega de acesso** (`castragestao:auth-delivery`):
  - `shared/auth-contract.js`: `AUTH_DELIVERY_CONFIG_KEY`, `buildDefaultAuthDeliveryConfig`, `normalizeAuthDeliveryConfig`, `mergeAuthDeliveryConfig`, `validateAuthDeliveryConfig`.
  - `backend/src/services/auth/auth-message-delivery.js`: `loadAuthDeliveryConfig` e o uso de `config.emailTemplates`.
  - `backend/src/services/auth/recovery-channels.js`: o carregamento dessa configuração e a leitura de `deps.env.EMAILJS_*`.
  - `backend/src/routes/config.js`: a chave nos conjuntos `SENSITIVE_CONFIG_KEYS` e `MUNICIPAL_ADMIN_WRITE_CONFIG_KEYS`, no construtor de padrões, na validação do PUT e em `publicConfigValue`.
- **Merge por canal:**
  - `backend/src/repositories/channel-config.js` (arquivo inteiro).
  - Em `routes/config.js`: `isChannelConfigKey`, `lockChannelConfig`, `mergeChannelConfig` e o ramo de transação deles.
- **Template de e-mail na configuração de notificações:** em `shared/notification-contract.js`, o campo `emailTemplateId` (padrão, normalização e validação) e `mergeNotificationConfig`. **Ficam:** `castragestao:notifications`, `emailEnabled`, o parâmetro `config` de `dispatchNotification`, o `loadSettings` de `request-change-notifications.js` e o campo `notifications` de `loadRequestSettings`, porque agora carregam `multiChannel`.
- **Leitura de variáveis `EMAILJS_*` no código:**
  - `services/email.js`: `env` em `createEmailSender` e `getEmailIntegrationStatus`.
  - Dependências `env` de `getRecoveryOptions` e `deliverAuthMessage`.
  - Blocos `EMAILJS_*` e o comentário "EmailJS movido para backend/.env" em `.env.example` e `backend/.env.example`.
- **Regra antiga "WhatsApp primeiro, e-mail como reserva"** nos avisos da solicitação, em `dispatch-notification.js`, e o texto "O e-mail permanece habilitado e recebe o aviso quando o WhatsApp não puder enviar".
- **Status antigo do EmailJS:**
  - A rota `GET /config/email/status` e `normalizeEmailStatus` em `shared/email-contract.js`.
  - `getEmailIntegrationStatus` em `src/api.ts`.
- **Telas antigas** (`src/features/`):
  - `email/email-settings.tsx`, `email/use-email-status.ts`, `email/email-settings.test.tsx`.
  - `notifications/notification-settings.tsx` (substituído por `multi-channel-switch.tsx`; `notification-results.*` fica, é de outro assunto).
  - `tutor-access/auth-delivery-settings.tsx` e `tutor-access/use-auth-delivery-settings.ts`.
- **Duplicação do padrão de segredo:** a constante local `TOKEN_PREVIEW_LENGTH` em `whatsapp-credentials.js` (passa a vir de `secret-preview.js`) e o markup do campo de token em `whatsapp-credentials.tsx` (passa a usar `saved-secret-field.tsx`).
- **Testes:** `backend/test/channel-config.test.js` (arquivo inteiro) e os trechos de e-mail antigos nos testes citados em "Testes necessários", reescritos para a nova resolução.
- **Textos antigos de documentação:** as menções a `castragestao:auth-delivery`, `emailTemplates` e `EMAILJS_TEMPLATE_ID` em `docs/tutor-access.md`.

> **Atenção para a skill `implementar`:** nada acima deve ser comentado, envolto em `if (false)` ou escondido com flag. Se a remoção gerar erro de compilação, corrigir o erro, sem `@ts-ignore`.

Dados que **não** são apagados: linhas antigas de `castragestao:auth-delivery` e o campo `emailTemplateId` que existirem em algum banco. Não há nenhuma no banco local e o sistema ainda não tem produção.

---

## Estratégia de implementação

1. **Papel master.** `MASTER_ROLE` e `isMasterUser` em `tenant.js`, `requireMaster` em `middleware/auth.js`, `isMasterRole` em `src/utils.ts`. Testes do middleware.
2. **Contrato.** `email-uses-contract.js` (10 usos, variáveis, padrão ligado), `email-contract.js` (chaves, normalizadores, validadores) e `notification-contract.js` (`multiChannel` no lugar de `emailTemplateId`). Remover as peças antigas de `auth-contract.js`.
3. **Armazenamento e auditoria.** `repositories/email-config.js` e as três ações em `audit.js`.
4. **Padrão de segredo.** `services/secret-preview.js`; `whatsapp-credentials.js` passa a usá-lo. Em seguida `saved-secret-field.tsx`; `whatsapp-credentials.tsx` passa a usá-lo. Os testes do WhatsApp têm de continuar verdes sem alteração.
5. **Credenciais.** `services/email-account.js`: validação, cifra, prévia, `getEmailRuntimeConfig` lendo só a configuração salva.
6. **Templates.** `services/email-templates.js`: lista por papel, salvar IDs, ligar e desligar, `resolveEmailTemplate`.
7. **Identidade e brasão.** `municipality-identity.js`, `email-identity.js` e `routes/municipality-brasao.js`.
8. **Envio.** `email.js` com a conta salva. `dispatch-notification.js` com a regra nova (e-mail e, com `multiChannel`, também WhatsApp), `auth-message-delivery.js` e `recovery-channels.js` com `resolveEmailTemplate`, e todos com as variáveis do município e de agendamento. Remover os pontos de leitura de `EMAILJS_*` e a configuração antiga.
9. **Rotas.** `routes/email.js`, montagem em `server.js` das rotas `/api/email` e `/api/public/municipalities`, e limpeza de `routes/config.js` (inclusive a normalização de `castragestao:notifications` no `prepareConfigValue` e a validação de `multiChannel`).
10. **Frontend.** `api.ts`, hooks, `email-credentials.tsx`, `email-templates-table.tsx`, `multi-channel-switch.tsx`, `email-integration-tab.tsx`, a nota na aba WhatsApp, ligação em `App.tsx` e remoção das telas antigas.
11. **Documentação e exemplos.** `docs/tutor-access.md`, `.env.example` e `backend/.env.example`.
12. **Testes e validação.** Escrever e ajustar os testes e rodar os comandos de validação uma vez ao final.

Dividir em entregas menores é decisão do usuário. Se pedido, o corte mais natural é deixar o passo 7 e as variáveis `municipality_*` do passo 8 para depois; o resto funciona sozinho.

---

## Regras de negócio identificadas

- **Usos:** 10, sem `verify_phone`. Avisos: `schedule_confirmed`, `schedule_changed`, `schedule_cancelled`, `documents_reviewed`, `completed`. Acesso: `initial_password`, `password_reset`, `verify_email`, `request_tracking`, `contact_changed`.
- **Quem edita o quê:** conta e IDs de template, só o master. Liga e desliga usos e a opção de mais de um canal: administrador municipal, suporte e master, sempre no município da operação.
- **"Configurado"** = o uso tem ID global **e** a conta tem Service ID e Public Key. A chave privada é opcional, como hoje (o `accessToken` só é enviado se existir).
- **Ligar** um uso exige "configurado" (senão 400). Desligar é sempre permitido. Se o master apagar um ID, o interruptor guardado continua guardado, mas o uso passa a "Sem template" e não envia; se o ID voltar, volta a valer.
- **Estado efetivo de um uso:** `(valor guardado, se houver; senão o padrão do uso) E configurado`. Só `password_reset` tem padrão ligado.
- **Fluxos em que o solicitante escolhe o canal** (um canal só, o escolhido; não mudam e não dependem de `multiChannel`): recuperação de senha (tela "Escolha o contato", com as opções disponíveis no município), acompanhamento por código (o contato que ele digita) e confirmações de e-mail e de telefone (o canal do contato confirmado).
- **Avisos da solicitação (5 eventos), política do município `multiChannel`** (por município, padrão desligado):
  - **Desligada:** só e-mail. O WhatsApp não envia aviso da solicitação.
  - **Ligada:** e-mail e WhatsApp. Cada canal é independente: a falha de um não impede o outro, e cada resultado vira uma entrada no histórico da solicitação.
  - Um canal só é tentado se estiver disponível. E-mail: uso ligado e configurado, com o e-mail do acompanhamento. WhatsApp: canal ativo no município, template do aviso ligado e aprovado, telefone válido do acompanhamento e cota disponível.
  - Solicitante que escolheu não acompanhar (`followUp.enabled === false`): nenhum aviso, como hoje.
  - Solicitações antigas (sem `followUp`): continuam só WhatsApp e só para agendamento confirmado e alterado, como hoje.
  - O e-mail é o canal base: é obrigatório no acompanhamento. O telefone é opcional e só entra nos avisos quando a opção está ligada (continua servindo ao acompanhamento por código e à senha inicial).
- **Senha inicial e contato alterado:** seguem como hoje (um canal só: WhatsApp primeiro quando houver telefone e WhatsApp disponível, e-mail como reserva) e ficam fora de `multiChannel`, até a pergunta em aberto ser respondida.
- **Recuperação de senha de equipe global** (usuário sem município): usa o ID global de `password_reset` e a conta salva, sem interruptor. Se faltar qualquer um, o e-mail fica indisponível. Sem fallback para o ambiente.
- **Variáveis de todos os usos:** `to_email` (definida pelo envio), `to_name`, `municipality_name`, `municipality_brasao_url`, `department_name`, `municipality_contact`, `municipality_email`, `municipality_address`. Sem município (equipe global) as `municipality_*` e `department_name` vão vazias.
- **Variáveis dos 5 avisos:** `protocol`, `event`, `subject`, `message`. Os 3 de agendamento também: `schedule_date`, `schedule_time`, `schedule_location_name`, `schedule_address` (via a lista segura de `resolveWhatsappField`).
- **Variáveis de acesso:** `password_reset`, `verify_email` e `request_tracking`: `code`, `codigo_recuperacao`, `validade`, `validity_minutes`, `purpose`. `initial_password`: `temporary_password`, `purpose`. `contact_changed`: `message`, `purpose`. Os nomes em português atuais **não são renomeados**, para não quebrar templates já criados.
- **Assunto:** nos avisos pode usar `{{subject}}`. Nas mensagens de acesso o sistema não envia assunto; ele é escrito no próprio template.
- **Brasão:** `municipality_brasao_url` = `<endereço público>/api/public/municipalities/<id>/brasao?v=<atualização>` quando o município tem brasão e o endereço público está configurado; senão vazio.

---

## Regras multi-tenant e segurança

- **Origem do tenant:** nas rotas municipais (`PUT /templates/active`, `GET /settings`), o município vem de `pickMunicipalityId(req)`: usuário não global fica preso ao próprio município e qualquer `municipalityId` do corpo ou da query é ignorado. As rotas globais (`PUT /account`, `PUT /templates`) ignoram `municipalityId`.
- **Permissões:** `requireMaster` para escrever conta e IDs; `requireMunicipalAdmin` para o resto. Suporte nunca recebe chaves nem IDs. O backend decide o que devolver por papel; esconder campos na tela não basta.
- **Opção `multiChannel`:** gravada pela rota de configuração existente, que já restringe a escrita a administrador municipal ou global e ao município da operação. É um booleano sem dado sensível; pode ser lido junto com o restante de `castragestao:notifications`.
- **Segredos:** a chave privada é cifrada (`encryptSecretStrict`, `CONFIG_ENCRYPTION_KEY`) e nunca volta inteira; a leitura devolve só `hasPrivateKey` e a prévia de 8 caracteres. Nada de segredo em auditoria, log ou mensagem de erro; erros inesperados devolvem mensagem genérica. As respostas levam `Cache-Control: no-store`.
- **Auditoria:** toda escrita registra a ação e os campos alterados, sem valores de segredo. As ações globais ficam com `municipality_id` nulo, então o administrador municipal não as vê em `/api/audit`.
- **Rota pública do brasão:** UUID validado antes de qualquer consulta; só data URL de imagem raster (`png`, `jpeg`, `webp`, `gif`) em base64; **SVG recusado** (script na própria origem); teto de tamanho decodificado; `X-Content-Type-Options: nosniff`; `ETag` e `Cache-Control`; 404 para qualquer caso inválido, sem diferenciar o motivo. Devolve só o brasão, que já é público em `GET /api/municipalities`.
- **Endereço público:** salvo apenas como origem (`https://host[:porta]`, sem caminho, consulta nem credenciais). Nunca vem do cabeçalho `Host` da requisição.
- **Dados do município nas variáveis:** são texto editável pelo administrador municipal. Têm tamanho limitado e os templates devem usar `{{ }}` (escapado), nunca `{{{ }}}`.
- **Relatórios e PDFs:** sem impacto.

---

## Validações necessárias

- **Conta (`PUT /account`):** `serviceId` com `^[A-Za-z0-9_-]{1,200}$`; `publicKey` e `privateKey` com 1 a 200 caracteres, sem espaço nem controle (após `trim`); `privateKey` vazia mantém a atual; `clearPrivateKey: true` remove; `publicUrl` por `new URL`, `https:` (ou `http:` só para `localhost` e `127.0.0.1`), sem credenciais, guardada como `origin`, vazia limpa. Sem `CONFIG_ENCRYPTION_KEY` válida, salvar a chave privada responde 503 com mensagem própria de e-mail.
- **IDs de template (`PUT /templates`):** só chaves dos 10 usos; valor `^[A-Za-z0-9_-]{1,200}$` ou vazio para limpar; demais campos ignorados.
- **Interruptor (`PUT /templates/active`):** `use` entre os 10 usos e `active` booleano; ligar sem "configurado" responde 400 com mensagem clara.
- **`multiChannel`:** booleano; qualquer outro tipo é recusado (400) em `PUT /config/castragestao:notifications`.
- **Rota do brasão:** UUID por regex, `data:image/(png|jpeg|webp|gif);base64,` e teto de tamanho; qualquer falha, 404.
- **Variáveis do município:** strings com `trim` e tamanho máximo (nome e departamento 200, contato e e-mail 200, endereço 300).

---

## Testes necessários

### Frontend

- `email-integration.test.tsx`:
  - O bloco de credenciais aparece só para master (nunca para suporte ou administrador municipal).
  - A chave privada vem mascarada com o começo visível e "Remover chave" pede confirmação.
  - A tabela tem 10 linhas sem subtítulos; o interruptor trava sem template; sem município a coluna Ativo e a opção de mais de um canal somem.
  - A visão municipal mostra "Configurado" ou "Sem template", sem IDs.
  - O interruptor de mais de um canal reflete o valor salvo e grava ao alternar.
  - O estado de erro oferece "Carregar novamente".
- A aba WhatsApp mostra a nota sobre os avisos; `whatsapp-integration.test.tsx` continua verde depois da extração do campo de segredo.

### Backend

- **Papéis e rotas (`email-routes.test.js`):**
  - Administrador municipal e suporte recebem 403 em `PUT /account` e `PUT /templates`.
  - A resposta de `GET /settings` não traz IDs para quem não é master e nunca devolve a chave privada inteira.
  - Um `municipalityId` forjado é ignorado para quem não é global.
  - Ligar sem "configurado" dá 400.
  - A auditoria não contém segredo e as ações globais têm município nulo.
- **Conta e templates (`email-account.test.js`, `email-templates.test.js`):**
  - Cifra e prévia de 8 caracteres.
  - Sem `process.env.EMAILJS_*`: com as variáveis definidas e nada salvo, o envio retorna "não configurado" (prova de que o ambiente é ignorado).
  - `password_reset` efetivo ligado sem linha salva; `false` explícito vence o padrão; os demais usos começam desligados.
  - "Configurado" exige ID e conta; apagar o ID desliga o efeito sem perder o interruptor.
  - Linha global com `municipality_id` nulo lida e gravada sem colidir com linhas de município.
- **Identidade e brasão (`email-identity.test.js`, `municipality-brasao.test.js`):**
  - Variáveis do município certo, vazias para equipe global e sem vazamento entre municípios.
  - Sem brasão ou sem endereço público, `municipality_brasao_url` vazia.
  - A rota recusa SVG, id inválido e arquivo acima do teto, e responde `nosniff`, `ETag` e tipo correto para imagens válidas.
- **Avisos da solicitação (`notification-dispatch.test.js`, reescrito):**
  - Opção desligada: só e-mail, mesmo com WhatsApp ativo e telefone informado.
  - Opção ligada: e-mail e WhatsApp, nessa ordem, com um resultado por canal.
  - A falha de um canal não impede o outro.
  - Sem telefone, ou com o template de WhatsApp desligado, só e-mail.
  - Com o uso de e-mail desligado e a opção ligada, só WhatsApp.
  - Solicitação antiga (sem `followUp`): só WhatsApp, como hoje; `followUp` desligado: nenhum envio.
- **Configuração (`notification-contract.test.js`, `config-security.test.js`):** `multiChannel` aceita só booleano, vem desligado por padrão e é normalizado; escrita só por administrador municipal ou global, presa ao município da operação; sem `emailTemplateId`; `ALLOWED_LOCKS` sem `channel-config`.
- **Demais envios (reescritos):** `notification-transports`, `auth-delivery`, `recovery-options` e `fixtures/auth-http.js` sem as variáveis de e-mail. Cobrir os nomes de variáveis antigos preservados, as variáveis de agendamento nos 3 avisos, a lógica de canais da senha inicial e do contato alterado inalterada, e o caminho de recuperação de equipe global.
- Remover `channel-config.test.js`.

### Conferência manual (tela)

- Como master, sem município: salvar Service ID, Public Key, chave privada e endereço público; ver a chave com o começo visível; remover a chave com confirmação.
- Salvar os 10 IDs; escolher um município e ligar e desligar usos; confirmar que `OFF*` trava sem ID.
- Ligar e desligar "Enviar o mesmo aviso por mais de um canal" e conferir, no histórico de uma solicitação, que o aviso sai só por e-mail (desligado) ou por e-mail e WhatsApp (ligado).
- Como administrador municipal e como suporte: sem credenciais e sem IDs na tela.
- No EmailJS: ativar "Allow EmailJS API for non-browser applications", usar `{{to_email}}` no campo "To Email" e `{{ }}` nas variáveis. Não foi verificado se o EmailJS aceita bloco condicional para ocultar a imagem quando o município não tem brasão; se não aceitar, o município sem brasão mostra imagem quebrada.
- O brasão só carrega em e-mail real quando o sistema está publicado e o endereço público aponta para ele; `localhost` não funciona em cliente de e-mail.
- Sem envio de teste: o primeiro envio real acontece pelos fluxos de uso (recuperação de senha, mudança de status).

---

## Comandos de validação sugeridos

```bash
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

Sem inspeção visual no navegador, salvo pedido.

---

## Riscos e pontos de atenção

- **Mudança de comportamento dos avisos:** hoje o WhatsApp é o canal prioritário; com a opção desligada ele deixa de enviar avisos da solicitação. Municípios que usam WhatsApp para avisos precisam ligar a opção. Não há clientes ainda; a nota na aba WhatsApp evita a impressão de que o canal quebrou.
- **Envio duplo (opção ligada):** o mesmo aviso sai duas vezes, consome cota do WhatsApp e gera duas entradas no histórico da solicitação. É escolha explícita do município.
- **Sem envio de teste:** um erro de configuração (ID errado, chave inválida, EmailJS bloqueando chamadas de servidor) só aparece no primeiro uso real. Aceito pelo usuário.
- **Prévia de 8 caracteres:** a chave privada do EmailJS é curta (cerca de 20 caracteres), então a prévia revela boa parte dela. Aceito para manter um padrão único entre integrações; só o master vê a tela.
- **Credenciais só pela tela:** sem `EMAILJS_*` no código, o ambiente local também precisa ser configurado pela tela depois do deploy, e as variáveis do `.env` local ficam sem efeito.
- **Conta única:** um ponto único de falha e de cota para todos os municípios.
- **Rota pública do brasão:** SVG, tamanho e cache tratados na rota. Não amplia a exposição atual.
- **Brasão e `localhost`:** não dá para validar o brasão em e-mail real fora de produção.
- **Extrações que tocam o WhatsApp** (`secret-preview.js` e `saved-secret-field.tsx`): risco de regressão, coberto pelos testes existentes do WhatsApp, que não podem mudar.
- **Remoções em `routes/config.js` e nos testes:** superfície grande, mas remoção pura. `prepareConfigValue` passa a normalizar a configuração de notificações.
- **Nomes de variáveis:** precisam bater exatamente com os do template do EmailJS; a tela mostra a lista por uso.
- **Deploy:** push direto em `main` (sem `staging`) dispara o deploy no Render. Sem migration e sem variável nova, o risco é só de comportamento: depois do deploy nada envia e-mail até o master salvar a conta e os IDs.

---

## Perguntas em aberto

1. **Senha inicial e contato alterado.** O usuário perguntou se a senha inicial tem um modal para o solicitante escolher como recebê-la. Não tem: ao concluir o cadastro ela aparece na tela uma única vez e é enviada automaticamente aos contatos do acompanhamento (WhatsApp primeiro quando houver telefone e WhatsApp disponível, e-mail como reserva, um canal só). O modal de escolha existe na **recuperação de senha** ("Escolha o contato"), que já usa a escolha do solicitante e não muda. Este plano mantém a senha inicial e o contato alterado **como hoje** e fora de `multiChannel`. Confirmar com o usuário, ou escolher:
   - (a) incluí-los em `multiChannel` (a senha inicial iria por dois caminhos; não recomendado por duplicar um segredo);
   - (b) alinhá-los ao "e-mail padrão" (trocar a ordem em `auth-message-delivery.js`, e-mail primeiro e WhatsApp como reserva);
   - (c) criar um modal de escolha ao concluir o cadastro (funcionalidade nova, fora deste plano).

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- Só o master edita a conta e os IDs; suporte e administrador municipal não recebem chaves nem IDs, nem pela tela nem pela API.
- A chave privada fica cifrada, nunca volta inteira e mostra só o começo (8 caracteres), com "Remover chave" confirmado.
- A tabela única dos 10 usos funciona: interruptor por município, travado sem template, `password_reset` ligado por padrão.
- Os avisos da solicitação saem só por e-mail com a opção desligada e por e-mail e WhatsApp, de forma independente, com a opção ligada; o histórico registra um resultado por canal.
- A recuperação de senha, o acompanhamento por código e as confirmações de contato continuam com o canal escolhido pelo solicitante.
- O envio usa só a conta salva (as variáveis `EMAILJS_*` do ambiente não influenciam) e anexa nome, brasão e contato do município; avisos de agendamento levam data, horário e local separados.
- A rota pública do brasão serve só imagem raster válida e responde 404 nos demais casos.
- Nenhum resquício do modelo antigo: `AUTH_DELIVERY_CONFIG_KEY`, `channel-config.js`, `emailTemplateId`, `GET /config/email/status`, telas antigas, a regra "WhatsApp primeiro" nos avisos e a leitura de `EMAILJS_*`.
- A aba WhatsApp se comporta como antes, com a nota nova sobre os avisos.
- Typecheck, testes de frontend e de backend e build passam sem erros novos; `docs/tutor-access.md` e os `.env.example` refletem o modelo novo.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita. Este plano não cria nenhuma.
- Seguir `/AGENT.md`: código novo em inglês, arquivos pequenos de responsabilidade única, nenhum `console.log`, sem código morto.
- Não alterar `.env`; só os `.env.example`.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Senha inicial e contato alterado: manter o comportamento atual até o usuário responder a pergunta em aberto.
- Atualizar os testes conforme descrito e rodar os comandos de validação uma vez ao final.
- Não commitar nem dar push sem o `/finalizar`.
