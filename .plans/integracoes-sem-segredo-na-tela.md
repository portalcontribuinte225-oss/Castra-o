# Plano de Implementação: integrações sem segredo na tela, contrato com liga/desliga e contagem

## Origem

- Arquivo de especificação: pedido no chat, sem `.md`, com prints das abas WhatsApp, E-mail e SMS. Decisões do usuário, na ordem em que vieram:
  1. Nenhum token ou key aparece na tela. Fica só um status **"Integrado / Não integrado"** ao lado do título de cada aba, para saber que a key foi encontrada no Render.
  2. WhatsApp: cada município escolhe sua key (opção "b"), numa **lista de seleção** que mostra só o nome. O WABA e o ID do número **continuam na tela**, não vão para o Render. A lista e o botão **"Salvar"** (antes "Salvar credenciais") ficam na mesma linha dos IDs.
  3. O **teste de envio** do WhatsApp e do SMS fica.
  4. Sai o "● Ativo/Inativo".
  5. SMS: saem o botão da plataforma (em "Todos os municípios") e o "Testar conexão / Consultar saldo", com os dados que ele mostra.
  6. Saem os botões de ativar/desativar de canal: quem decide é o contrato.
  7. No card do contrato, um **liga/desliga** substitui "Salvar cota" e "Encerrar contrato", e sai o "Zerar cota do mês".
  8. O card do contrato sobe para **logo acima dos templates**.
  9. Sai o **card de contagem**: o status e a contagem ("0/500") passam para dentro do card do contrato.
  10. O título da aba do WhatsApp passa a ser **"WhatsApp"** (hoje é "Canais de notificação por município").
  11. Código limpo: tudo o que perde o uso sai, inclusive textos e CSS.
- Data do planejamento: `2026-11-23`
- Classificação: `fullstack` (front, back e `shared/`). Não há mudança de estrutura no banco: os campos ficam no JSON da tabela `config`, então não há migration.

---

## Resumo

Na mudança anterior (`credenciais-no-ambiente`), os segredos foram para as variáveis do Render. A tela do master, porém, continuou recebendo os 8 primeiros caracteres de cada token ou key, e o e-mail recebia o Service ID e a Public Key inteiros.

Agora o servidor deixa de mandar qualquer parte desses valores, e cada aba mostra só se está integrada.

O único liga/desliga de canal passa a ser o do **contrato**. Ele vale para os três canais, fica no card "Contrato e cota" (que também mostra o status e a contagem) e substitui:
- o "Ativo" do WhatsApp;
- o liga/desliga do município no e-mail e no SMS;
- o liga/desliga da plataforma no SMS;
- "Salvar cota", "Encerrar contrato" e "Zerar cota do mês";
- o card de contagem.

Regra única de envio: **Integrado + contrato ligado e dentro das datas + saldo no mês + a mensagem ligada pelo município.**

---

## Escopo

### Dentro do escopo

- O servidor não devolve nenhuma parte de segredo e passa a devolver `integrated`. A equipe que não é master deixa de receber os IDs do WhatsApp.
- Selo "● Integrado / ● Não integrado" ao lado do título das três abas. O título do WhatsApp vira "WhatsApp".
- WhatsApp: uma linha com WABA, ID do número, key (lista de seleção) e "Salvar". Sai o "Ativo".
- E-mail: o card "Credenciais" sai inteiro.
- SMS: saem o começo do token, o teste de conexão e saldo e o botão da plataforma. Fica o card "Teste de envio".
- Card "Contrato e cota" novo: estado e contagem no topo; para o master, os campos e o liga/desliga. Fica logo acima dos templates. Saem o card de contagem e o card de contrato antigo.
- Estado do contrato num enum compartilhado entre front e back.
- O cálculo de "posso pedir telefone no acompanhamento" sai do repositório e vai para um serviço.
- Inventário completo do que sai: código, textos, CSS, testes e documentação.

### Fora do escopo

- Levar o WABA e o ID do número para o Render.
- Liga/desliga de cada mensagem: templates do WhatsApp, templates do e-mail e mensagens do SMS. Continuam como estão.
- Validações do contrato (limite inteiro positivo, datas válidas, fim depois do início) e a contagem do mês.
- O aviso de imagens sem `APP_PUBLIC_URL` no card de templates do e-mail.
- A regra do WhatsApp para pedir telefone no acompanhamento: continua sem olhar o contrato, como hoje.
- SQL de limpeza de dados antigos (ver "Banco de dados").
- `escopo-integracoes-notificacoes.md`, que é arquivo do usuário, fora do repositório.

---

## Leitura de contexto

- `/AGENT.md`
- `shared/secret-preview-contract.js`, `shared/server-credential-contract.js`, `shared/message-quota-contract.js`, `shared/sms-contract.js`
- Back:
  - serviços: `whatsapp-credentials.js`, `whatsapp.js`, `email-account.js`, `email-settings.js`, `email-templates.js` (`setEmailUseActive`), `sms-integration-settings.js`, `sms-uses.js`, `smsmais.js`, `message-quota.js`, `request-submission.js`, `notifications/dispatch-notification.js` (`tryWhatsapp`), `auth/auth-message-delivery.js` (`tryWhatsapp`), `auth/recovery-channels.js`;
  - rotas: `whatsapp.js` (`POST /test`), `sms.js`, `message-quota.js`, `config.js` (`publicConfigValue`, `prepareConfigValue`);
  - repositórios: `request-settings.js`, `sms-settings.js`.
- Front:
  - componentes: `server-secret-field.tsx`, `ui.tsx` (`PanelHeader` com `aside`, `ConfigField`, `CompactChoiceField`, `ConfigActiveToggle`, `configFieldStyle`), `input.tsx` (`fieldControlStyle`), `integration-card.tsx`;
  - pastas `src/features/whatsapp-integration/*`, `email/*`, `sms/*`, `message-contract/*`;
  - `src/features/request-follow-up/use-follow-up-policy.ts`, `src/domain.ts` (`initialWhatsappSettings`), `src/api.ts` (linhas 223-253);
  - `src/App.tsx`: linhas 5537, 5539 e 6134 (as três abas);
  - `src/styles.css`: linhas 3094-3190 (bloco "WhatsApp config") e os tokens `--color-ui-*` (linhas 10-17).
- `docs/tutor-access.md`: linhas 80, 82, 84, 88, 94 e 96.

---

## Impacto por área

### Frontend

1. **Componentes compartilhados:**
   - `src/components/integration-card.tsx`: `IntegrationStatusBadge({ integrated })`, só com classes Tailwind e os tokens que já existem:
     - "Integrado" com `tw:text-ui-accent`, "Não integrado" com `tw:text-ui-danger`;
     - o ponto é um `span` com `tw:size-2 tw:rounded-full tw:bg-current` e `aria-hidden`;
     - `role="status"`.
   - Ele vai no `aside` do `PanelHeader` das três abas. Conferir o layout de `.panel-header`: o selo precisa ficar colado ao título. Se o `aside` for empurrado para a direita, ajustar a regra que decide, sem criar regra por cima.
   - `src/components/ui.tsx`: `ConfigSelectField({ label, value, options, onChange, disabled })`, ao lado de `ConfigField`. Usa `label` com `configFieldStyle` e `<select>` nativo com `fieldControlStyle`; as opções são `{ value, label }[]`.
2. **Card do contrato** (`src/features/message-contract/`):
   - `message-contract-card.tsx` (novo, `MessageContractCard({ municipalityId, contract, master })`) substitui `message-contract-form.tsx` e `message-contract-status.tsx`. É um `IntegrationCard` "Contrato e cota":
     - **`actions` (topo, à direita):** o estado em uma palavra e a contagem `{used}/{plan}`. Os rótulos ficam num `Record<ContractState, string>` neste arquivo: Vigente, Desativado, Fora do período. Sem contrato (`live === null`) aparece "Sem contrato", sem contagem. Vigente na cor `ui-accent`, os demais em `ui-danger`, com Tailwind.
     - **Só para o master:** uma linha `integrationActionFieldStyle` com `integrationFieldsStyle` (limite mensal, início, fim) e um `ConfigActiveToggle`.
     - **Ligar** grava os campos e ativa; fica travado enquanto o limite não for um inteiro positivo.
     - **Desligar** grava o contrato guardado com `enabled: false`.
     - Com o contrato ligado, os três campos ficam travados.
     - A mensagem de salvar/erro usa `whatsapp-inline-status` (+ `ok`) decidido por um booleano do gancho, não por texto.
     - Para a equipe que não é master, só o título e o topo.
     - Carregando e erro: como hoje ("Carregando contrato e cota...", "Não foi possível carregar…", "Carregar novamente").
   - `use-message-contract.ts`:
     - devolve `{ settings, setSettings, ready, loadFailed, retry, saving, saveStatus, saveOk, live, setActive }`;
     - `setActive(true)` valida o limite e envia `{ plan, contractStart, contractEnd, enabled: true }`;
     - `setActive(false)` envia o `live` guardado com `enabled: false`;
     - mensagens "Contrato ativado." / "Contrato desativado." / "Não foi possível salvar: …";
     - a conferência do carregamento passa a ser "`state` é um `ContractState`".
   - `message-contract-types.ts`: `MessageQuotaStatus = { plan, used, contractStart, contractEnd, enabled, state }` e `MessageQuotaInput` com `enabled`.
3. **Abas** (o card do contrato aparece com município selecionado, para todos que veem a aba):
   - `whatsapp-integration-tab.tsx`:
     - título **"WhatsApp"**, com o selo quando houver município e as credenciais estiverem carregadas;
     - ordem: Credenciais (master) ou a nota "A conexão com o WhatsApp… é configurada pela administração da plataforma." (demais) → `MessageContractCard` → Templates da Meta.
   - `email-integration-tab.tsx`: o selo com `settings.integrated`; ordem: `MessageContractCard` → Templates.
   - `sms-settings.tsx`: o selo com `state.config.integrated`; ordem: Teste de envio (master) → `MessageContractCard` → Mensagens.
   - A prop `canEditContract` sai das três abas (era igual a `master`) e das três chamadas em `src/App.tsx` (linhas 5537, 5539 e 6134).
4. **WhatsApp:**
   - `whatsapp-credentials.tsx`, card "Credenciais" sem `actions`:
     - linha `integrationActionFieldStyle` com `integrationFieldsStyle` [WABA, ID do número, `ConfigSelectField` "Key do token"] e o botão **"Salvar"**;
     - as opções da lista são "Nenhuma" (`""`) mais `tokenVariables`. Se a key salva não existir mais no Render, ela entra na lista mesmo assim, e o selo mostra "Não integrado";
     - abaixo da linha: a mensagem de salvo e o aviso "Nenhuma variável `WHATSAPP_TOKEN_…` no servidor…" quando a lista vier vazia;
     - depois, "Teste de envio" como está.
   - `use-whatsapp-credentials.ts`:
     - recebe `master`;
     - a conferência do carregamento exige `integrated` booleano e, para o master, os IDs em texto;
     - `hasCredentials = integrated && phoneNumberId` e `canSync = integrated && wabaId`;
     - o comentário do topo é atualizado.
   - `src/domain.ts`: `initialWhatsappSettings = { integrated: false, phoneNumberId: "", wabaId: "", tokenVariable: "" }`.
5. **E-mail:**
   - `email-integration-types.ts`: `EmailSettings = { integrated, municipal, uses, identity }`.
   - `email-templates-table.tsx`: sem `serviceOn`; `on = row.active && row.configured`; travado só pelo template ausente.
6. **SMS:**
   - `sms-test-message.tsx` (novo, `SmsTestMessage`): `IntegrationCard` "Teste de envio" com o número, "Enviar teste" (travado sem `integrated`) e o resultado (`testText`, `sms-status`).
   - `sms-settings-controller.ts`:
     - sem a conta e sem o teste de conexão;
     - `setUseActive` barra ligar sem `integrated`;
     - `sendTest` barra sem `integrated` com "O SMS não está integrado.";
     - o comentário do topo é atualizado.
   - `use-sms-settings.ts`: devolve `retry`, `setUseActive`, `setTestPhone` e `sendTest`.
   - `sms-types.ts`: `SmsConfig = { integrated, municipalityName, uses }`; o estado sem `testing` e `connection`; a API sem `saveSmsAccount` e `testSmsConnection`.
   - `sms-uses-table.tsx`: a prop `integrated`; travado sem integração, com o motivo "O SMS precisa estar integrado para ligar as mensagens.".
7. **Acompanhamento:** `use-follow-up-policy.ts` mantém a lógica; só o comentário muda (não existe mais "canal da plataforma").
8. **`src/api.ts`:** ver "O que será removido".

### Backend

1. **Estado do contrato** (`shared/message-quota-contract.js`):
   - `ContractState = Object.freeze({ NONE: "none", OFF: "off", OUT_OF_PERIOD: "out_of_period", IN_FORCE: "in_force" })`;
   - `contractState(quota, today = messageQuotaDates().today)`: sem limite válido → `NONE`; `enabled === false` → `OFF`; antes do início ou depois do fim → `OUT_OF_PERIOD`; senão `IN_FORCE`. Contrato antigo sem `enabled` conta como ligado;
   - `isContractInForce(quota, today)` = `contractState(...) === IN_FORCE`;
   - `normalizeMessageQuotaInput` aceita `enabled` (booleano, padrão `true`) junto de `plan`, `contractStart` e `contractEnd`.
2. **`message-quota.js`:**
   - `evaluateMessageQuota` usa o estado. `OFF` dá "Contrato de {canal} desativado para o município."; as mensagens de sem contrato, de ainda não vigente, de expirado e de mês esgotado continuam.
   - `getQuotaStatus` devolve `{ plan, used, contractStart, contractEnd, enabled, state }`, ou `null` sem contrato.
   - `saveQuota` grava `enabled`, mantendo a contagem do mês.
   - O WhatsApp passa a respeitar o contrato desligado por esse mesmo caminho, incluindo a recuperação de senha (`quotaAvailable`).
3. **`routes/message-quota.js`:** ficam `GET /:channel` e `PUT /:channel`, que agora carrega `enabled`.
4. **WhatsApp:**
   - `whatsapp-credentials.js`:
     - `usesWhatsapp(config)` (o município escolheu uma key) e `isWhatsappReady(runtime)` (`cloud_api`, token e ID do número). Ficam aqui, e não em `whatsapp.js`, para não criar import circular.
     - `prepareWhatsappCredentials` guarda `{ provider: "cloud_api", phoneNumberId, wabaId, tokenVariable }` e continua validando a key escolhida.
     - `publicWhatsappConfig` responde:
       - visitante: `{ active: <pronto> }`;
       - equipe: `{ integrated }`;
       - master: `{ integrated, phoneNumberId, wabaId, tokenVariable, tokenVariables }`;
       - `integrated` = a key escolhida existe e é válida.
   - `whatsapp.js`: `getRuntimeConfig` sem `active`.
   - Pontos de envio:
     - `dispatch-notification.js`: `!usesWhatsapp(raw)` → `null`; sem estar pronto → `NOT_CONFIGURED`;
     - `auth-message-delivery.js`: `!usesWhatsapp(raw)` → `CHANNEL_DISABLED`; sem estar pronto → `NOT_CONFIGURED`;
     - `recovery-channels.js`: `isWhatsappReady(runtime)`;
     - `routes/whatsapp.js` (`POST /test`): sem o bloco do `active`.
   - `routes/config.js`: conferir que a resposta do salvamento passa por `publicConfigValue`. A auditoria (`configAuditChanges`) não muda.
5. **SMS:**
   - Novo `backend/src/services/sms-credential.js`, que sai de `sms-integration-settings.js` para evitar import circular com `sms-uses.js`: `readSmsCredential(env)` (com `environmentFor`) e `isSmsIntegrated(env)` (token de **produção** no Render).
   - `sms-integration-settings.js`:
     - `settingsView` responde `{ integrated, municipalityName, uses }`;
     - `getPublicSmsConfig` responde `{ active: integrated && status?.state === ContractState.IN_FORCE }`;
     - `sendSmsTestMessage` sem estar integrado devolve `NOT_CONFIGURED` com "O SMS não está integrado.";
     - `getSmsAvailability` e `sendSmsUse` sem estar integrado devolvem `CHANNEL_DISABLED` ("fora de uso");
     - as funções da conta e do teste de conexão saem (ver "O que será removido").
   - `sms-uses.js`: `setSmsUseActive` barra ligar sem integração ("O SMS ainda não está integrado.").
   - `routes/sms.js`: ficam `GET /availability`, `GET /settings`, `POST /test-message` e `PUT /uses/active`.
   - `shared/sms-contract.js`: ficam `SmsEnvironment`, `validateSmsToken`, `SMS_ACTIVE_USES_CONFIG_KEY` e as funções dos usos. `buildDefaultSmsConfig` e `normalizeSmsConfig` passam a montar só `{ integrated, municipalityName, uses }`.
6. **E-mail:**
   - `email-settings.js` responde `{ integrated: isEmailAccountConfigured(account), municipal, uses, identity }`.
   - `email-templates.js`: `setEmailUseActive` sem a checagem do serviço; o comentário é atualizado.
7. **Telefone no acompanhamento:**
   - `repositories/request-settings.js` devolve `{ requestTypes, documentTypes, neighborhoods, whatsapp, smsQuota }` (só o banco), sem a junção com a linha da plataforma.
   - Novo `backend/src/services/follow-up-phone.js`: `canReachByPhone(settings, env = process.env)` = `isWhatsappReady(getRuntimeConfig(settings.whatsapp, env)) || (isSmsIntegrated(env) && isContractInForce(settings.smsQuota))`.
   - `request-submission.js` (linhas 50 e 52) usa `canReachByPhone(settings)`.

### Banco de dados

Sem mudança de estrutura e sem migration. Dados que ficam sem leitor e não precisam de SQL (a produção foi zerada em 2026-11-23):
- `active` no JSON `whatsapp` de cada município, descartado no próximo salvamento;
- a linha `castragestao:sms` sem município;
- linhas antigas de limite com a chave `sms-validation`.

O `enabled` dos contratos continua em uso.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado. As variáveis do Render não mudam. Publicar só com autorização; se o envio for só ao GitHub, usar `[skip render]`.

---

## Arquivos provavelmente afetados

- **Shared:** `message-quota-contract.js`, `sms-contract.js`.
- **Back, serviços:** `whatsapp-credentials.js`, `whatsapp.js`, `email-account.js`, `email-settings.js`, `email-templates.js`, `sms-integration-settings.js`, `sms-uses.js`, `smsmais.js`, `message-quota.js`, `request-submission.js`, `notifications/dispatch-notification.js`, `auth/auth-message-delivery.js`, `auth/recovery-channels.js`.
- **Back, novos:** `services/sms-credential.js`, `services/follow-up-phone.js`.
- **Back, rotas:** `whatsapp.js`, `sms.js`, `message-quota.js` (e `config.js`, só se a resposta do salvamento precisar).
- **Back, repositório:** `request-settings.js`.
- **Front, componentes e núcleo:** `src/components/ui.tsx`, `src/components/integration-card.tsx`, `src/domain.ts`, `src/api.ts`, `src/App.tsx` (só as três chamadas das abas).
- **Front, WhatsApp:** `whatsapp-credentials.tsx`, `use-whatsapp-credentials.ts`, `whatsapp-integration-tab.tsx`.
- **Front, e-mail:** `email-integration-tab.tsx`, `email-integration-types.ts`, `email-templates-table.tsx`.
- **Front, SMS:** `sms-settings.tsx`, `sms-settings-controller.ts`, `use-sms-settings.ts`, `sms-types.ts`, `sms-uses-table.tsx`, `sms-test-message.tsx` _(novo)_.
- **Front, contrato:** `message-contract-card.tsx` _(novo)_, `use-message-contract.ts`, `message-contract-types.ts`.
- **Front, acompanhamento:** `use-follow-up-policy.ts` (só o comentário).
- **Estilo:** `src/styles.css`.
- **Docs:** `docs/tutor-access.md`.
- **Testes:** ver "Testes necessários".

---

## O que será removido

### Arquivos apagados

- `src/components/server-secret-field.tsx` (com `credentialIssueText`)
- `src/features/email/email-credentials.tsx`
- `src/features/sms/sms-credentials.tsx` (substituído por `sms-test-message.tsx`)
- `src/features/message-contract/message-service-toggle.tsx`
- `src/features/message-contract/message-contract-status.tsx` e `message-contract-form.tsx` (substituídos por `message-contract-card.tsx`)
- `shared/secret-preview-contract.js`
- `backend/src/repositories/sms-settings.js`

### Front: código

- **Contrato:**
  - `setEnabled`, `serviceStatus`, `confirmingEnd`, `setConfirmingEnd`, `endContractToday`, `localToday`, `resetUsed` e o antigo `save`;
  - a cor de sucesso decidida por texto (`includes("sucesso" | "zerada" | "encerrado")`);
  - `remaining` e `active` em `MessageQuotaStatus`;
  - a prop `canEditContract` nas três abas e em `App.tsx`.
- **WhatsApp:**
  - `toggleActive`, `isActive`, `savedTokenVariable` e `NO_TOKEN_VARIABLE`;
  - o uso de `CompactChoiceField`, `ConfigActiveToggle` e `ServerSecretField` nesta tela (os dois primeiros componentes ficam, porque outras telas usam);
  - `actions` do card;
  - a conferência de `hasAccessToken`;
  - `active` em `initialWhatsappSettings`.
- **E-mail:** `EmailAccountView`, `EmailCredentialIssue`, `account`, `configured` (vira `integrated`), a prop `serviceOn`, `SERVICE_OFF_REASON`, o import de `MessageServiceToggle` e de `EmailCredentials`.
- **SMS:**
  - `toggleActive`, `testConnection`, o `persist` da conta, `connectionResult`, `MISSING_TOKEN`, `allowedAccount` (só se ficar sem uso), `environmentLabel`, `displayDate` e `activationControl`;
  - os imports de `ConfigActiveToggle` e `MessageServiceToggle`;
  - `serviceOn`, `channelActive`, `PLATFORM_OFF_REASON` e `SERVICE_OFF_REASON` (substituídos pelo motivo único de integração);
  - nos tipos: `provider`, `active`, `hasToken`, `tokenPreview`, `environment`, `tokenIssue`, `SmsAccountInput`, `SmsConnectionResult`, `testing`, `connection`, e `saveSmsAccount` / `testSmsConnection` de `SmsSettingsApi`;
  - os imports de `SmsEnvironment`, `SmsProvider` e `CredentialIssue` no front.
- **`src/api.ts`:** `saveSmsAccount`, `testSmsConnection`, `setMessageService`, `resetMessageQuota` e o import de `SmsAccountInput`.

### Back e shared: código

- **Rotas:** `PUT /message-quota/:channel/enabled`, `POST /message-quota/:channel/reset`, `PUT /sms/account` e `POST /sms/test-connection`.
- **Contrato:**
  - `setServiceEnabled`, `isServiceEnabled` e `resetQuotaUsage`;
  - `SERVICE_SWITCH_CHANNELS`, `hasServiceSwitch`, `isServiceOn` (substituído por `contractState`) e `isServiceAvailable`;
  - `active` e `remaining` de `getQuotaStatus`;
  - os imports `resetQuotaUsage` e `setServiceEnabled` na rota.
- **SMS:**
  - `saveSmsAccount`, `parseInput`, `testSmsConnection`, `limitValidation` (e a chave de limite `sms-validation`), `safeAccount` e `sendingCredential(record, …)`;
  - `TEST_NOT_READY[CHANNEL_DISABLED]`;
  - os imports de `loadSmsAccount`, `storeSmsAccount`, `querySmsBalance`, `secretPreview` e `SmsProvider`;
  - `querySmsBalance` em `smsmais.js` (e o que só ela usa);
  - `SMS_CONFIG_KEY` e `SmsProvider` em `shared/sms-contract.js`, junto com os campos de prévia, ambiente e problema de `buildDefaultSmsConfig` / `normalizeSmsConfig` e os imports de `secretPreview` e `CredentialIssue`.
- **E-mail:** `publicEmailAccount`, o import de `secretPreview`, a lista `issues` de `readEmailAccount` e a checagem `isServiceEnabled` em `email-templates.js` (com o import).
- **WhatsApp:**
  - `active` em `prepareWhatsappCredentials`, `publicWhatsappConfig` e `getRuntimeConfig`;
  - `hasAccessToken`, `tokenPreview` e `tokenIssue` na resposta;
  - o import de `secretPreview`;
  - `raw.active` em `dispatch-notification.js`, `auth-message-delivery.js` e `recovery-channels.js`;
  - o bloco `rawConfig.active === false` em `routes/whatsapp.js`.
- **Telefone no acompanhamento:** `phoneEnabled` em `request-settings.js`, a junção `OR (c.municipality_id IS NULL AND c.key = $3)`, e os imports de `SMS_CONFIG_KEY` e `isServiceAvailable`.

### Textos que somem

- **Prévia de segredo:**
  - "Não configurado";
  - "Falta {variável} nas variáveis do servidor.";
  - "{variável} está em formato inválido nas variáveis do servidor.";
  - "Vem da variável {variável} do servidor. Para trocar, altere no Render.".
- **WhatsApp:**
  - o título "Canais de notificação por município" (vira "WhatsApp");
  - "Variável do token" (vira "Key do token"), "Token de acesso", "Salvar credenciais" (vira "Salvar");
  - "Escolha e salve a variável do token antes de ativar o WhatsApp.", "Ativando...", "Desativando...", "WhatsApp ativado com sucesso.", "WhatsApp desativado com sucesso.";
  - no back: "Escolha uma variável do token disponível no servidor antes de ativar o WhatsApp." e "WhatsApp desativado para o município".
- **E-mail:**
  - "ID do serviço (Service ID)", "Chave pública (Public Key)", "Endereço público do sistema", "Usado para o brasão e o logo do órgão aparecerem nos e-mails.", "Chave privada (Private Key)";
  - "A conta é trocada nas variáveis do servidor (Render): …";
  - "Requer “Allow EmailJS API for non-browser applications” e “Use Private Key” ligados no EmailJS (Account > Security).";
  - "O serviço de e-mail está desativado para este município." (tela e back).
- **SMS:**
  - "Token de API SMSMais", "Ativar o SMS exige um token de produção, validado pelo servidor.", " Ambiente: …", "Token de homologação: não envia SMS nem ativa o canal.";
  - "Testar conexão / Consultar saldo", "Consultando...", "Conexão validada. Ambiente: …", "Homologação: esta credencial não habilita o SMS.", "Créditos: … Equivalente em SMS: …", "Consulta em … O teste não ativa o SMS.", "Produção" / "Homologação" / "Não verificado", "Ainda não realizada";
  - "Ativo na plataforma" / "Inativo na plataforma", "O SMS da plataforma está inativo. Para ativá-lo, selecione “Todos os municípios”.";
  - "O SMS precisa estar ativo na plataforma para ligar as mensagens." (vira "O SMS precisa estar integrado para ligar as mensagens."), "O serviço de SMS está desativado para este município.";
  - "Cadastre o token em SMS_TOKEN nas variáveis do servidor" (as três variações), "SMS ativado." / "SMS desativado.", "Não foi possível salvar. Verifique o token e as condições de ativação e tente novamente.", "Não foi possível validar a conexão. Confira o token e tente novamente.", "Não foi possível consultar a conexão e o saldo. Tente novamente.";
  - no back:
    - "Configuração de SMS inválida.", "Cadastre um token de API válido em SMS_TOKEN nas variáveis do servidor para ativar o SMS.", "Token de homologação não pode ativar o SMS.", "Não foi possível validar o token de SMS.";
    - "Cadastre o token em SMS_TOKEN nas variáveis do servidor para testar.", "Muitas consultas. Aguarde alguns minutos.", "Ative o SMS antes de enviar um teste.";
    - "Cadastre um token de produção válido em SMS_TOKEN… antes de enviar um teste." (vira "O SMS não está integrado.");
    - "O SMS ainda não está ativo na plataforma." (vira "O SMS ainda não está integrado.").
- **Contrato:**
  - "Status da integração indisponível", "Ativo" / "Inativo", "mensagens este mês", "Contrato vigente/encerrado até …", "Cota indisponível", "Cota não configurada";
  - "Ativo no município" / "Inativo no município", "Salvar cota", "Encerrar contrato", "Encerrar contrato hoje (…)?", "Confirmar", "Cancelar", "Zerar cota do mês";
  - "Encerrar bloqueia novos envios imediatamente. Zerar reinicia a contagem deste mês.";
  - "Contrato encerrado hoje.", "Serviço ativado." / "Serviço desativado.", "Não foi possível alterar o serviço", "Cota do mês zerada.", "Erro ao zerar cota", "Cota salva com sucesso." (vira "Contrato ativado." / "Contrato desativado.");
  - no back: "Informe se o serviço deve ficar ativo.", "Cadastre o contrato antes de ligar ou desligar o serviço.", "Serviço de {canal} desativado para o município." (vira "Contrato de {canal} desativado para o município.").

### CSS (`src/styles.css`)

- Linhas 3097-3136: `.whatsapp-dot`, `.whatsapp-dot--on`, `.whatsapp-dot--off`, `.whatsapp-statusbar-state`, `.whatsapp-statusbar-sep`, `.whatsapp-statusbar-text strong`, `.whatsapp-status-ok` e `.whatsapp-status-err`. O único usuário delas era o card de contagem.
- Ficam, porque continuam em uso:
  - `.whatsapp-inline-status` e `.ok` (mensagens de salvo do WhatsApp e do contrato);
  - `.whatsapp-section-heading` (divisória "Teste de envio" no WhatsApp);
  - `.whatsapp-note`;
  - `.whatsapp-section-label` (modal de template);
  - `.sms-status` / `.confirmed` (resultados de teste e `App.tsx`);
  - `.compact-choice-field`.

### Documentação

- `docs/tutor-access.md`:
  - **linhas 80, 82 e 88:** sai a descrição da conta da plataforma (`castragestao:sms`, `PUT /sms/account`, `POST /sms/test-connection`), da prévia (`tokenPreview`, `tokenIssue`) e da validação por saldo;
  - **linha 84:** ligar um uso exige só a integração;
  - **linha 94:** contrato com liga/desliga, sem "zerar o mês" e sem `/reset`, com a contagem dentro do card do contrato;
  - **linha 96:** sai o interruptor em Credenciais (`/enabled`).
- Comentário de `loadFollowUpPolicy` em `use-follow-up-policy.ts`.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. **`shared/`:** `ContractState` e `contractState` em `message-quota-contract.js`, tirando o liga/desliga antigo; simplificar `sms-contract.js`; apagar `secret-preview-contract.js`.
2. **Back, contrato:** `message-quota.js` e a rota (sem `/enabled` e `/reset`).
3. **Back, WhatsApp:** helpers, salvamento, respostas, `getRuntimeConfig`, os 4 pontos de envio e o teste.
4. **Back, SMS:** `sms-credential.js`; `sms-integration-settings.js`, `sms-uses.js`, `smsmais.js` e a rota; apagar o repositório.
5. **Back, e-mail:** `email-account.js`, `email-settings.js` e `email-templates.js`.
6. **Back, telefone no acompanhamento:** `request-settings.js`, `follow-up-phone.js` e `request-submission.js`.
7. **Front, componentes:** `IntegrationStatusBadge` e `ConfigSelectField`.
8. **Front, contrato:** `message-contract-card.tsx`, gancho e tipos; apagar o card de contagem, o formulário antigo e o liga/desliga do serviço.
9. **Front, WhatsApp:** título, credenciais em linha, gancho, ordem da aba e `domain.ts`.
10. **Front, e-mail:** apagar o card de credenciais; aba, tipos e tabela.
11. **Front, SMS:** `sms-test-message.tsx`; aba, controller, gancho, tipos e tabela; apagar `sms-credentials.tsx`.
12. **Front, núcleo:** `src/api.ts`, `App.tsx` (sem `canEditContract`) e o comentário de `use-follow-up-policy.ts`.
13. **CSS:** apagar as linhas 3097-3136 de `styles.css`, conferindo antes por `grep` que nenhum outro arquivo usa essas classes.
14. **Testes e `docs/tutor-access.md`.**
15. **Varredura final com `grep`** no projeto inteiro: `tokenPreview`, `privateKeyPreview`, `secretPreview`, `hasAccessToken`, `isServiceOn`, `isServiceEnabled`, `hasServiceSwitch`, `isServiceAvailable`, `setServiceEnabled`, `resetQuotaUsage`, `resetMessageQuota`, `setMessageService`, `saveSmsAccount`, `testSmsConnection`, `querySmsBalance`, `SMS_CONFIG_KEY`, `castragestao:sms`, `SmsProvider`, `toggleActive`, `ServerSecretField`, `EmailCredentials`, `SmsCredentials`, `MessageServiceToggle`, `MessageContractStatus`, `MessageContractForm`, `canEditContract`, `serviceOn`, `channelActive`, `whatsapp-dot`, `whatsapp-statusbar`, `whatsapp-status-`, `Zerar`, `Encerrar contrato`, `Salvar cota`, `Salvar credenciais`, `Canais de notificação por município`. Nenhum resultado pode sobrar fora do histórico do git e deste plano.
16. **Validação da raiz**, uma vez no fim.

---

## Regras de negócio identificadas

- Nenhuma parte de um token ou key sai do servidor, para nenhum usuário.
- "Integrado" significa:
  - WhatsApp: a key escolhida pelo município existe e é válida no Render;
  - e-mail: as três variáveis do EmailJS existem e são válidas;
  - SMS: há um token de **produção** no Render. Homologação conta como "Não integrado".
- Um canal envia quando está Integrado, o contrato está ligado e dentro das datas, há saldo no mês e a mensagem está ligada. O único liga/desliga de canal é o do contrato.
- Estado do contrato:
  - Vigente: ligado e dentro das datas;
  - Desativado: desligado;
  - Fora do período: ligado, mas antes do início ou depois do fim;
  - Sem contrato.
  - Contrato antigo sem o campo conta como ligado.
- Card do contrato:
  - só o master edita;
  - ligar grava limite e datas e ativa;
  - desligar para os envios na hora e guarda limite e datas;
  - com o contrato ligado, os campos ficam travados;
  - a equipe com a permissão do canal vê só o estado e a contagem.
- WhatsApp com "Nenhuma" key fica fora de uso, sem registro no histórico. Com key, mas sem ID do número, fica "não configurado", como hoje.
- Ligar uma mensagem do SMS exige integração; no e-mail, exige a conta integrada e o template, como hoje. Ligar uma mensagem não depende do contrato; enviar depende.
- O teste de envio (WhatsApp e SMS) continua só do master, sem gastar contrato.

---

## Regras multi-tenant e segurança

- O município continua resolvido por `backend/src/tenant.js`. As permissões das rotas que ficam não mudam: `PUT /message-quota/:channel` continua só do master; `GET` continua com a permissão do canal.
- O WhatsApp de cada município lê só a variável que ele escolheu, sempre com o prefixo `WHATSAPP_TOKEN_` (`readWhatsappToken`, sem mudança).
- Menos dados saem do servidor: a equipe não recebe mais os IDs do WhatsApp, e o master não recebe nenhuma parte de segredo.
- Teste novo: nenhuma resposta de configuração contém o valor falso do token nem o começo dele.
- Sem impacto em relatórios ou PDFs.

---

## Validações necessárias

- Contrato: `normalizeMessageQuotaInput` com `enabled` booleano. As validações de limite e datas continuam.
- WhatsApp: IDs só com dígitos e key existente no servidor, como hoje. `active` deixa de ser aceito (é ignorado, como qualquer campo desconhecido).
- SMS: ligar uma mensagem exige integração.

---

## Testes necessários

### Frontend

- `message-contract.test.tsx`, reescrito para `MessageContractCard`:
  - topo com estado e `used/plan` para os 4 estados e "Sem contrato";
  - o master vê os campos e o liga/desliga; a equipe não;
  - ligar grava os campos e fica travado sem limite válido;
  - campos travados com o contrato ligado;
  - desligar mantém os campos.
- `whatsapp-integration.test.tsx`:
  - título "WhatsApp" com o selo;
  - linha WABA / ID / key / "Salvar";
  - sem "Ativo" e sem token;
  - a equipe carrega só `integrated`;
  - a key salva ausente do Render aparece na lista;
  - ordem dos cards.
- `email-integration.test.tsx`: sem card de credenciais; selo; tabela sem `serviceOn`; ordem.
- `sms-settings.test.tsx`: card "Teste de envio"; sem teste de conexão e sem botão da plataforma; selo; mensagens travadas sem integração; ordem.
- `follow-up.test.tsx`: ajustar o que depender do comentário ou da regra.
- `src/components/config-ui.test.tsx`: `ConfigSelectField` (rótulo, opções, `onChange`) e `IntegrationStatusBadge`.

### Backend

- `message-quota.test.js` e `message-quota-routes.test.js`:
  - `contractState` nos 4 estados, incluindo contrato sem `enabled`;
  - salvar grava `enabled`;
  - contrato desligado bloqueia os três canais;
  - as rotas `/enabled` e `/reset` respondem 404.
- `whatsapp-credentials.test.js`:
  - as respostas de visitante, equipe e master, sem prévia;
  - salvar sem `active`;
  - `usesWhatsapp` e `isWhatsappReady`.
- `notification-contract.test.js` e `auth-routes.test.js`: WhatsApp sem key fica fora de uso; com key e sem ID do número, `NOT_CONFIGURED`.
- `recovery-options.test.js`: WhatsApp oferecido sem `active`, respeitando o contrato.
- `config-security.test.js`: as respostas de `/config` do WhatsApp sem prévia e sem IDs para a equipe.
- `sms-settings.test.js`, `sms-routes.test.js` e `sms-uses.test.js`:
  - integração pelo token de produção;
  - rotas removidas respondem 404;
  - sem prévia;
  - ligar uma mensagem sem integração falha;
  - teste de envio sem integração.
- `smsmais.test.js`: sai a parte do saldo.
- `email-account.test.js` e `email-routes.test.js`: `integrated`, sem `serviceId`, `publicKey` nem prévia; ligar uma mensagem sem conferir o serviço.
- `request-submission.test.js` e um teste novo de `follow-up-phone.js`: telefone pedido com WhatsApp pronto, ou com SMS integrado e contrato vigente; não pedido com o contrato desligado.
- `sms-credential.js`: produção é integrado, homologação e ausente não são.

### Conferência manual (tela)

- **Master, WhatsApp** com Içara (depois de recriada):
  - título "WhatsApp ● Integrado";
  - Credenciais em uma linha;
  - "Contrato e cota" com "Vigente 0/500" antes dos templates;
  - escolher "Nenhuma" e salvar mostra "● Não integrado".
- **Contrato:**
  - desligar mostra "Desativado" e libera os campos;
  - editar e ligar trava os campos de novo;
  - uma data de fim no passado mostra "Fora do período".
- **E-mail:** sem card de credenciais; contrato antes dos templates.
- **SMS:**
  - "Todos os municípios": selo, "Teste de envio" e mensagens travadas sem município, sem botão da plataforma nem teste de conexão;
  - com município: o contrato também aparece.
- **Usuário da equipe com permissão:** vê o selo e o contrato só com o estado e a contagem, sem IDs nem botões.

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

- **SMS sem o botão geral:** envia quando está integrado, com contrato ligado e vigente e a mensagem ligada. Na produção nada muda até haver contrato. O envio real do SMS ainda não foi conferido (pendência antiga).
- **WhatsApp e o contrato:** passa a respeitar o liga/desliga do contrato. No banco local, um WhatsApp com `active:false` e com key escolhida passa a ser usado.
- **Mudar limite ou datas** exige desligar o contrato por um instante. Nesse intervalo, nenhuma mensagem do canal sai para o município.
- **Muitos pontos de envio mudam de regra** (avisos, código de acesso, recuperação de senha, telefone no acompanhamento, mensagens do SMS). Cada um tem teste.
- **Imports circulares** evitados com os helpers do WhatsApp em `whatsapp-credentials.js` e o `sms-credential.js` novo.
- **Camadas:** o cálculo do telefone sai do repositório (AGENT.md: repositório só lida com banco).
- **CSS:** só sai o bloco do card de contagem. O selo e o estado do contrato usam Tailwind e os tokens `ui-accent` / `ui-danger`. Conferir o `.panel-header` para o selo ficar junto do título.
- **Tamanho:** são cerca de 40 arquivos. Sugestão para o `/finalizar`: commits separados para back, front e documentação. Publicar só com autorização.

---

## Perguntas em aberto

Nenhuma. O título da aba do WhatsApp vira "WhatsApp" (resposta do usuário).

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- nenhuma resposta da API e nenhuma tela trazem qualquer parte de token ou key, para nenhum usuário;
- as três abas mostram "● Integrado / ● Não integrado" ao lado do título, e a aba do WhatsApp se chama "WhatsApp";
- o WhatsApp tem WABA, ID do número, a key numa lista de seleção e "Salvar" na mesma linha, com o teste de envio abaixo e sem "Ativo";
- o e-mail não tem card de credenciais, e o SMS tem o card "Teste de envio", sem teste de conexão nem botão da plataforma;
- não existe mais card de contagem. O card "Contrato e cota" mostra o estado e a contagem no topo, tem os campos e o liga/desliga só para o master, fica logo acima dos templates nas três abas e não tem "Salvar cota", "Encerrar contrato" nem "Zerar cota do mês";
- os canais enviam só quando estão Integrados, com o contrato ligado e vigente, saldo e a mensagem ligada;
- tudo da seção "O que será removido" (código, textos, CSS e docs) não existe mais, e a varredura final com `grep` não encontra sobras;
- typecheck, testes (front e back) e build passam sem erros novos;
- `docs/tutor-access.md` descreve a regra nova.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
