# Plano de Implementação: credenciais do SMS, do EmailJS e do WhatsApp no Render

## Origem

- Arquivo de especificação: conversa de 2026-11-22 (análise de segurança das credenciais das integrações)
- Data do planejamento: `2026-11-22` (revisado contra o código e ajustado no mesmo dia)
- Classificação: `fullstack` + `infra/deploy` (variáveis no Render) + limpeza de dados aplicada à mão

---

## Resumo

Hoje o admin (master) cadastra na tela o token do SMSMais, a conta do EmailJS, o endereço público e o token do WhatsApp de cada município. O banco guarda os segredos cifrados. O risco que sobra: quem entrar na conta do admin pode **trocar** essas contas por contas próprias. Daí em diante, os códigos de senha e de recuperação passam pela conta dessa pessoa, e os links dos e-mails oficiais podem apontar para um site falso.

Com este plano, os segredos e o endereço público passam a vir de variáveis de ambiente do Render e saem do banco. Na tela, ficam só para leitura.

No WhatsApp, cada município escolhe na tela **qual** variável `WHATSAPP_TOKEN_...` do Render usa. A tela mostra só os nomes, nunca os valores. Ficam na tela, editáveis: os IDs do WhatsApp (WABA ID e Phone Number ID), a escolha da variável, os interruptores, os templates, os contratos e os testes. Nada disso permite fazer as mensagens passarem por uma conta de fora, porque só os tokens cadastrados no Render podem ser usados.

---

## Escopo

### Dentro do escopo

- SMS: token do SMSMais lido de `SMS_TOKEN`.
- E-mail: conta do EmailJS lida de `EMAILJS_SERVICE_ID`, `EMAILJS_PUBLIC_KEY` e `EMAILJS_PRIVATE_KEY`. A chave privada passa a ser obrigatória.
- Endereço público (brasão, logo do órgão e link do aviso "Solicitação registrada") lido de `APP_PUBLIC_URL`.
- WhatsApp:
  - tokens nas variáveis `WHATSAPP_TOKEN_<NOME>`, uma por conta da Meta;
  - cada município escolhe a sua na tela;
  - vários municípios podem usar a mesma.
- Telas de Credenciais do SMS, do e-mail e do WhatsApp sem campos de segredo, mostrando a situação de cada variável.
- O começo do token do WhatsApp passa a aparecer só para o admin (hoje aparece para qualquer usuário interno).
- Arquivo SQL de limpeza dos segredos antigos no banco, aplicado à mão depois do deploy.
- Atualizar `docs/tutor-access.md` e `escopo-integracoes-notificacoes.md`.

### Fora do escopo (sugestões para outros planos)

- Chave de IA: continua na tela, e hoje o gestor também consegue trocá-la.
- Remover a reserva `VITE_ADMIN_EMAIL`/`VITE_ADMIN_PASSWORD` do back.
- Erro preexistente: `POST /whatsapp/test` e `GET /config/:key` devolvem `err.message` em erro 500, contra a regra do `AGENT.md` de não vazar detalhes internos.
- Verificação em duas etapas no login do admin.
- `DEFAULT_MUNICIPALITY_ADMIN_PASSWORD`: recomendação de não definir no Render, sem mudança de código.

---

## Variáveis de ambiente

| Variável | Conteúdo | Validação |
|---|---|---|
| `APP_PUBLIC_URL` | Origem do domínio: `https://castracao.aethersoftware.com.br` | `normalizePublicUrl`: https; `http` só para `localhost`/`127.0.0.1`; sem usuário, senha ou caminho |
| `SMS_TOKEN` | Token de produção do SMSMais, sem "Bearer" | `validateSmsToken`; `sbx_` = homologação, nunca liga nem envia |
| `EMAILJS_SERVICE_ID` | Service ID | `EMAIL_ID_PATTERN` |
| `EMAILJS_PUBLIC_KEY` | Public Key | `KEY_PATTERN` (mesma regra de hoje) |
| `EMAILJS_PRIVATE_KEY` | Private Key, **obrigatória** | `KEY_PATTERN` |
| `WHATSAPP_TOKEN_<NOME>` | Token permanente de usuário do sistema de uma conta da Meta. Ex.: `WHATSAPP_TOKEN_ICARA` (usada por Içara), `WHATSAPP_TOKEN_NOVA_VENEZA` (outra conta). O nome depois do prefixo é livre | Nome: `^WHATSAPP_TOKEN_[A-Z0-9_]{1,80}$`. Valor: não vazio, sem espaços nem caracteres de controle, até 1000 caracteres (limite atual) |

- **Variável ausente ou inválida:** o canal conta como não configurado.
  - SMS, e-mail e endereço: aviso no log uma vez por processo, com o nome da variável e nunca o valor.
  - WhatsApp: só gera aviso a variável escolhida por um município que sumiu do ambiente ou tem valor inválido. Município sem variável escolhida é normal (não usa WhatsApp).
- **Leitura:** as variáveis são lidas a cada uso, com o ambiente injetável nos testes (`env = process.env`). Trocar um valor no Render vale quando o serviço reinicia.

---

## Leitura de contexto

- `/AGENT.md`
- `escopo-integracoes-notificacoes.md`
- `docs/tutor-access.md`
- `backend/src/env.js` (carrega o `.env` da raiz)
- `backend/src/services/config-secret-cipher.js`
- E-mail: `backend/src/services/email-account.js`, `email-settings.js`, `email-templates.js`, `email.js`, `email-identity.js`, `notify-request-registered.js`, `backend/src/routes/email.js`
- SMS: `backend/src/services/sms-integration-settings.js`, `backend/src/repositories/sms-settings.js`, `backend/src/services/sms-uses.js`, `backend/src/routes/sms.js`
- WhatsApp: `backend/src/services/whatsapp.js`, `whatsapp-credentials.js`, `whatsapp-catalog.js`, `backend/src/routes/whatsapp.js`, `whatsapp-templates.js`, `backend/src/routes/config.js` (GET/PUT, `publicConfigValue`/`prepareConfigValue` e auditoria), `backend/src/services/auth/auth-message-delivery.js`, `auth/recovery-channels.js`, `notifications/dispatch-notification.js`
- `backend/src/db/sql/20261115-remove-validation-keys.sql` (modelo de SQL aplicado à mão)
- Front: `src/components/saved-secret-field.tsx`, `src/components/ui.tsx` (`ConfigField`, `CompactChoiceField`), `src/features/email/*`, `src/features/sms/*`, `src/features/whatsapp-integration/*`, `src/domain.ts`, `src/api.ts`
- Produção, pela lista pública de municípios (2026-11-22): um município ativo, **Içara**, com identificador interno `criciuma`. O identificador não aparece em nenhuma tela, e por isso o nome da variável não sai mais dele.

---

## Impacto por área

### Backend

**E-mail**
- `email-account.js` lê e valida as quatro variáveis (`readEmailAccount(env = process.env)`).
  - `isEmailAccountConfigured` passa a exigir Service ID, Public Key e chave privada válidos.
  - A leitura para a tela (só admin) devolve `serviceId`, `publicKey`, `publicUrl`, o começo da chave privada (`secretPreview`) e a lista de variáveis com problema (`issues: [{ variable, problem: "missing" | "invalid" }]`).
- Quem usa a conta passa a ler dela, sem consulta ao banco: `email-settings.js`, `email-templates.js`, `email.js` (sempre envia o `accessToken`), `email-identity.js` e `notify-request-registered.js` (endereço do link e das imagens).
- `routes/email.js`: remover `PUT /email/account`. `GET /email/settings` e as rotas de templates continuam.

**SMS**
- `sms-integration-settings.js`:
  - O token vem de `SMS_TOKEN`. O ambiente sai do prefixo.
  - O banco (`castragestao:sms`) guarda só `provider`, `active` e `revision`.
  - **Ligar** exige token de produção válido e aceito pelo SMSMais na consulta de saldo, com o limite de tentativas atual. Desligar não consulta nada.
  - Sem comparação com o token já validado: trocar o token no Render vale quando o serviço reinicia, sem reativar.
  - Envio, disponibilidade e recuperação de senha: canal ligado + `SMS_TOKEN` válido de produção.
  - **A leitura pública** (`getPublicSmsConfig`) passa a exigir também o token válido. Hoje "ligado" garantia token validado; com a variável fora do banco, isso precisa ser conferido na leitura.
- `testSmsConnection` usa só o token do servidor. Os textos que pediam para "salvar o token" passam a apontar a variável `SMS_TOKEN`.
- `routes/sms.js`: `PUT /sms/account` aceita só `{ active }` e recusa qualquer outra chave. `POST /sms/test-connection` não recebe token.
- `repositories/sms-settings.js`: grava só o interruptor. O histórico registra `{ key, active }`.
- Leitura do admin: `{ active, hasToken, tokenPreview, environment, tokenIssue: null | "missing" | "invalid" }`. Os demais continuam vendo só se o canal está ligado e as mensagens.

**WhatsApp**
- `whatsapp-credentials.js`:
  - A gravação aceita `phoneNumberId`, `wabaId` (só dígitos, como hoje), `tokenVariable` e `active`. Sai o token, a cifragem e `clearAccessToken`.
  - `tokenVariable` pode ser vazio ("nenhuma") ou um nome que case com `^WHATSAPP_TOKEN_[A-Z0-9_]{1,80}$` **e** exista no ambiente com valor válido no momento de salvar.
  - Qualquer outro nome é recusado: "Escolha uma das variáveis do WhatsApp cadastradas no servidor."
  - Escolher "nenhuma" desliga o canal. Isso substitui a regra atual em que remover o token desligava o canal.
  - **Ligar** exige uma variável escolhida e válida.
  - Nova função `listWhatsappTokenVariables(env = process.env)`: os nomes que casam com o padrão e têm valor válido, em ordem alfabética. Nunca devolve valores.
- `whatsapp.js`:
  - `getRuntimeConfig(config, env = process.env)` lê o token da variável gravada em `tokenVariable`.
  - **Confere de novo o prefixo**: um nome fora do padrão, mesmo gravado direto no banco, não lê nada.
  - É o único ponto que entrega o token. Assim ficam cobertos, sem mudar a lógica deles: o teste (`routes/whatsapp.js`), a sincronização de templates (`routes/whatsapp-templates.js`), os códigos (`auth-message-delivery.js`), as opções de recuperação (`recovery-channels.js`) e os avisos (`dispatch-notification.js`, nos dois caminhos).
  - Sai a decifragem. `getMunicipalityWhatsappConfig` não muda.
- Leitura (`publicWhatsappConfig`, chamada pelo `GET /config/whatsapp`):
  - Visitante: `{ active }`, só verdadeiro com o canal ligado **e** a variável escolhida disponível.
  - Usuário interno: `{ active, provider, phoneNumberId, wabaId, hasAccessToken }`. O `hasAccessToken` continua para todos os internos, porque a aba de quem não é admin usa esse campo para mostrar se o canal está ativo.
  - Admin: também `tokenVariable` (a escolhida), `tokenVariables` (os nomes disponíveis), `tokenPreview` (começo do token escolhido) e `tokenIssue` (`null | "unset" | "missing" | "invalid"`).
  - Isso vale também quando o município ainda não tem configuração salva (hoje o GET devolve o valor padrão), para o admin poder escolher a variável.
- `routes/config.js`:
  - `publicConfigValue` recebe o tipo de usuário (admin ou interno).
  - A auditoria do `whatsapp` passa a registrar o nome anterior e o novo de `tokenVariable` quando muda, nunca valores.
  - `MASTER_WRITE_CONFIG_KEYS` continua.
- Textos:
  - `whatsapp-catalog.js`: "Escolha a variável do token e informe o ID da conta do WhatsApp Business antes de sincronizar."
  - `routes/whatsapp.js`: "Escolha a variável do token e informe o ID do número antes de testar."

**Cifragem**
- `config-secret-cipher.js`: remover `isSecretEncryptionAvailable` e `decryptSecretStrict`, que ficam sem uso.
- `encryptSecretStrict`, `encryptSecret`, `decryptSecret` e `isEncryptedSecret` continuam, para a chave de IA.
- A mensagem de erro passa a ser genérica ("O armazenamento seguro está indisponível."), sem citar o SMS.

**Shared**
- `shared/sms-contract.js`: `normalizeSmsConfig` perde `secureStorageAvailable`, `tokenValid` e `lastValidatedAt` e ganha `tokenIssue`.
- `shared/email-contract.js`: remover `EMAIL_ACCOUNT_CONFIG_KEY`.
- `audit.js`: remover `EMAIL_ACCOUNT_UPDATE`.

### Frontend

- **Componente compartilhado:** `src/components/saved-secret-field.tsx` só é usado pelas três telas de Credenciais e fica sem uso. É apagado e substituído por `src/components/server-secret-field.tsx`, só de leitura e usado pelas três telas:
  - rótulo e nome da variável;
  - o começo do segredo, com o resto mascarado (mesma máscara de hoje);
  - ou o aviso de variável ausente ou inválida.
  - Usa `ConfigField` em `readOnly`, sem classe nova.
- **E-mail:**
  - `email-credentials.tsx` mostra Service ID, Public Key e endereço público em texto, mais a chave privada no campo só de leitura e as variáveis com problema. Nota: "A conta é trocada nas variáveis do Render."
  - `email-integration-tab.tsx` deixa de usar `useEmailAccount`, e `use-email-account.ts` é apagado.
  - `email-integration-types.ts`: `EmailAccountView` com `privateKeyPreview` e `issues`, e sai `EmailAccountInput`.
- **SMS:**
  - `sms-credentials.tsx`: campo só de leitura do `SMS_TOKEN` e o ambiente. Mantém o interruptor, "Testar conexão / Consultar saldo" e o envio de teste.
  - `sms-settings-controller.ts`: saem `token`, `setToken`, `saveToken`, `removeToken`, `confirmingRemoval`, `setConfirmingRemoval`, `tokenIssue` (validação do token digitado) e `SECURE_STORAGE_UNAVAILABLE`. O teste de conexão não envia token.
  - `sms-types.ts`: saem `tokenValid`, `lastValidatedAt`, `secureStorageAvailable`, `token` e `clearToken` de `SmsAccountInput`, e entra `tokenIssue`.
- **WhatsApp:**
  - `whatsapp-credentials.tsx`: WABA ID, Phone Number ID e **"Variável do token"**, todos com "Salvar".
    - A escolha usa o `CompactChoiceField` que o app já tem: um chip por nome da lista e um chip "Nenhuma".
    - Embaixo, o campo só de leitura com o começo do token escolhido, ou um aviso: "Escolha a variável do token", "`WHATSAPP_TOKEN_X` não existe mais no servidor", "`WHATSAPP_TOKEN_X` está em formato inválido" ou, sem nenhuma variável no servidor, "Crie uma variável `WHATSAPP_TOKEN_...` no Render".
  - `use-whatsapp-credentials.ts`: saem `accessToken`, `removeToken` e `confirmingRemoval`.
    - Entra `tokenVariable` no estado e em "Salvar", que envia só o que mudou (IDs e variável). O controle de alteração (`idsChanged`) passa a considerar a variável.
    - O interruptor grava na hora e, sem variável, mostra o aviso.
    - `hasCredentials`, `isActive` e `canSync` continuam derivados de `hasAccessToken`.
  - `src/domain.ts`: `initialWhatsappSettings` troca `accessToken` por `tokenVariable: ""`.
- **`src/api.ts`:** sai `saveEmailAccount`. `saveSmsAccount` passa a enviar só `{ active }`, e o teste de conexão deixa de enviar token.

### Banco de dados

- Sem mudança de esquema. `tokenVariable` é um campo novo dentro do JSON da configuração `whatsapp` de cada município.
- Novo arquivo `backend/src/db/sql/20261122-credenciais-no-ambiente.sql`, no modelo de `20261115-remove-validation-keys.sql`. É aplicado à mão, nunca no início do servidor, e **só depois do deploy** do código novo:
  ```sql
  -- Explicit application only; never run through the legacy boot migration file.
  -- Apply AFTER the code that reads the SMS, EmailJS and WhatsApp credentials from the environment is deployed.
  BEGIN;
  UPDATE config SET value = value - 'token' - 'tokenPreview' - 'verification'
    WHERE key = 'castragestao:sms' AND municipality_id IS NULL;
  DELETE FROM config WHERE key = 'email_account';
  UPDATE config SET value = value - 'accessToken' - 'tokenPreview'
    WHERE key = 'whatsapp';
  COMMIT;
  ```
- `config.value` é `JSONB`, então o operador `-` funciona.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

- **Variáveis no Render (cadastradas pelo usuário em 2026-11-22):** `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_PUBLIC_URL`, `CONFIG_ENCRYPTION_KEY` (agora só para a chave de IA), `DATABASE_URL`, `EMAILJS_PRIVATE_KEY`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`, `JWT_SECRET`, `SMS_TOKEN` e `WHATSAPP_TOKEN_ICARA` (renomeada de `WHATSAPP_TOKEN_AETHER` pelo usuário).
- **Não criar:** `WHATSAPP_TOKEN` (sem sufixo, fora do padrão), `WHATSAPP_WABA_ID`, `WHATSAPP_PHONE_NUMBER_ID` e `DEFAULT_MUNICIPALITY_ADMIN_PASSWORD`.
- **Prefeitura com conta própria na Meta:** criar mais uma `WHATSAPP_TOKEN_<NOME>` e escolhê-la na tela daquele município.
- **Ordem obrigatória:**
  1. Variáveis no Render (feito). O código atual não lê nenhuma delas.
  2. Push em `main`, que publica.
  3. Na tela do WhatsApp de cada município, escolher a variável. Hoje é só Içara → `WHATSAPP_TOKEN_ICARA`. Até essa escolha, o WhatsApp do município não envia. Conferir as telas de Credenciais do SMS e do e-mail.
  4. Aplicar o SQL de limpeza.
- **No EmailJS:** ativar "Use Private Key". **Na Meta:** usar token permanente de usuário do sistema.
- **Local:**
  - O `.env` da raiz tem `SMS_TOKEN` e `EMAILJS_*`.
  - Faltam `APP_PUBLIC_URL` (por exemplo `http://localhost:3002`) e uma `WHATSAPP_TOKEN_<NOME>` para testar.
  - A linha `WHATSAPP_TOKEN` local fica sem uso, por estar fora do padrão.
  - O `.env` só muda com ordem do usuário.
- **Recomendado:** verificação em duas etapas no Render.

---

## Arquivos provavelmente afetados

- `backend/src/services/email-account.js`, `email-settings.js`, `email-templates.js`, `email.js`, `email-identity.js`, `notify-request-registered.js`
- `backend/src/services/sms-integration-settings.js`, `backend/src/repositories/sms-settings.js`
- `backend/src/services/whatsapp.js`, `whatsapp-credentials.js`, `whatsapp-catalog.js`
- `backend/src/routes/email.js`, `sms.js`, `whatsapp.js`, `config.js`
- `backend/src/services/audit.js`, `config-secret-cipher.js`
- `backend/src/db/sql/20261122-credenciais-no-ambiente.sql` (novo)
- `shared/sms-contract.js`, `shared/email-contract.js`
- `src/components/server-secret-field.tsx` (novo) e `src/components/saved-secret-field.tsx` (apagado)
- `src/features/email/email-credentials.tsx`, `email-integration-tab.tsx`, `email-integration-types.ts`, `email-integration.test.tsx`, `use-email-account.ts` (apagado)
- `src/features/sms/sms-credentials.tsx`, `sms-settings-controller.ts`, `sms-types.ts`, `sms-settings.test.tsx`
- `src/features/whatsapp-integration/whatsapp-credentials.tsx`, `use-whatsapp-credentials.ts`, `whatsapp-integration.test.tsx`
- `src/domain.ts`, `src/api.ts`
- Testes do back: `email-account`, `email-identity`, `email-routes`, `email-templates`, `request-registered-notice`, `recovery-options`, `request-submission`, `sms-routes`, `sms-settings`, `sms-uses`, `auth-delivery`, `config-security`, `notification-dispatch`, `notification-transports`, `request-access`, `whatsapp-catalog`, `whatsapp-credentials`
- `docs/tutor-access.md`, `escopo-integracoes-notificacoes.md`

---

## O que será removido

- **E-mail:**
  - rota `PUT /email/account`
  - `saveEmailAccount`, `prepareEmailAccount`, `loadEmailAccount` (leitura do banco) e `getEmailRuntimeConfig` na forma atual
  - `EMAIL_ACCOUNT_CONFIG_KEY` e `AUDIT_ACTIONS.EMAIL_ACCOUNT_UPDATE`
  - `src/features/email/use-email-account.ts`, `EmailAccountInput` e `api.saveEmailAccount`
  - os campos editáveis, "Salvar credenciais" e "Remover chave" da tela
- **SMS:**
  - token no corpo de `PUT /sms/account` e de `POST /sms/test-connection`, e `clearToken`
  - cifragem e decifragem do token
  - `validatedCredential` na forma atual, `verification` e a impressão digital `authenticatedDigest("sms-credential", ...)`
  - `secureStorageAvailable`, `tokenValid` e `lastValidatedAt` no contrato, nos tipos e na tela
  - no front: `token`, `setToken`, `saveToken`, `removeToken`, `confirmingRemoval`, `setConfirmingRemoval`, a validação do token digitado e `SECURE_STORAGE_UNAVAILABLE`
  - a linha "Última validação" e o aviso de armazenamento seguro indisponível
- **WhatsApp:**
  - `accessToken`, `tokenPreview` (gravado) e `clearAccessToken` na gravação
  - a cifragem em `whatsapp-credentials.js` e a decifragem em `whatsapp.js`
  - a regra "remover o token desliga o canal", substituída por "escolher nenhuma desliga"
  - no front: o campo do token, "Remover token", `removeToken`, `confirmingRemoval` e `accessToken` em `use-whatsapp-credentials.ts` e em `initialWhatsappSettings`
- **Componente:** `src/components/saved-secret-field.tsx`, substituído pelo campo só de leitura.
- **Cifragem:** `isSecretEncryptionAvailable` e `decryptSecretStrict`.
- **Banco** (pelo SQL aplicado à mão): `token`, `tokenPreview` e `verification` em `castragestao:sms`; a linha `email_account`; `accessToken` e `tokenPreview` em cada `whatsapp`.
- Imports que ficarem órfãos.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. **E-mail no back:** reescrever `email-account.js` para ler e validar as variáveis e trocar quem lia do banco. Remover a rota de gravação, a chave de config e a ação de auditoria.
2. **SMS no back:** token de `SMS_TOKEN`, banco só com o interruptor, ligar com consulta de saldo e leitura pública exigindo token válido. Ajustar rota, repositório e `shared/sms-contract.js`.
3. **WhatsApp no back:**
   - padrão de nome e `listWhatsappTokenVariables`;
   - `getRuntimeConfig` lendo a variável escolhida e conferindo o prefixo;
   - a gravação aceita IDs, `tokenVariable` (validada contra o ambiente) e interruptor, e ligar exige variável;
   - a leitura separa o que vai ao visitante, ao usuário interno e ao admin;
   - auditoria da troca de nome e textos de token ausente.
4. **Cifragem:** remover as funções sem uso e deixar a mensagem genérica.
5. **Front:**
   - criar o campo só de leitura e apagar `saved-secret-field.tsx`;
   - ajustar as três telas de Credenciais (no WhatsApp, a escolha da variável com `CompactChoiceField`), os hooks e controladores, `src/domain.ts` e `src/api.ts`;
   - apagar `use-email-account.ts`.
6. **SQL:** criar `backend/src/db/sql/20261122-credenciais-no-ambiente.sql`, sem aplicar.
7. **Testes:** atualizar os listados, com valores falsos.
8. **Documentação:**
   - `docs/tutor-access.md`: endereço público, conta do SMS, token cifrado, teste de conexão, recuperação por SMS, credenciais do WhatsApp, quem faz o quê e a nota de deploy da `CONFIG_ENCRYPTION_KEY`.
   - `escopo-integracoes-notificacoes.md`: tabela da seção 1, passo a passo dos três canais e critérios de aceite.
9. Validar uma vez ao final.

---

## Regras de negócio identificadas

- SMS, EmailJS e endereço público: um conjunto da plataforma, vindo do ambiente.
- WhatsApp:
  - um token por conta da Meta, em `WHATSAPP_TOKEN_<NOME>`;
  - cada município escolhe na tela qual usa, e vários podem usar o mesmo;
  - prefeitura com conta própria tem a sua variável.
- IDs do WhatsApp, escolha da variável, interruptores, templates, vínculos, contratos e testes continuam na tela.
- Ligar o SMS exige token de produção aceito pelo SMSMais. Token de homologação nunca liga nem envia.
- Ligar o WhatsApp exige uma variável escolhida e válida. Escolher "nenhuma" desliga o canal.
- O e-mail só conta como configurado com Service ID, Public Key e chave privada válidos.
- Sem endereço público, o aviso "Solicitação registrada" sai sem link e os e-mails saem sem brasão e logo, como hoje.
- Um canal sem token disponível não aparece na recuperação de senha nem é oferecido ao visitante.

---

## Regras multi-tenant e segurança

- O token do WhatsApp de um município sai só da variável gravada na configuração **dele**, lida pelo `municipalityId` da requisição ou do registro. Na hora do envio, nada que vem do corpo escolhe a variável.
- Só nomes com o prefixo `WHATSAPP_TOKEN_` podem ser escolhidos e lidos. Nem a tela nem um valor gravado no banco alcançam outras variáveis (`JWT_SECRET`, `DATABASE_URL` etc.).
- Quem entrar na conta do admin só consegue alternar entre tokens já cadastrados no Render. Não consegue fazer as mensagens passarem por uma conta própria. A troca fica no histórico.
- Nenhum segredo vai ao front. Só o admin recebe os nomes das variáveis e o começo dos tokens e da chave privada (8 caracteres).
- Logs e erros citam o nome da variável, nunca o valor.
- Testes e commits só com valores falsos. Varrer o diff por token, ID de conta e telefone antes de commitar.

---

## Validações necessárias

- Variáveis: conforme a tabela "Variáveis de ambiente".
- `PUT /sms/account`: corpo só com `active` booleano. Qualquer outra chave, incluindo `token` e `clearToken`, é recusada.
- `POST /sms/test-connection`: não aceita token no corpo.
- `PUT /config/whatsapp`: só `phoneNumberId`, `wabaId` (só dígitos), `tokenVariable` (vazio, ou nome no padrão que exista no ambiente com valor válido) e `active`. Ligar sem variável válida é recusado.

---

## Testes necessários

### Frontend

- Campo só de leitura: mostra o começo do segredo mascarado, o aviso de variável ausente e o de formato inválido.
- E-mail: Credenciais sem campos editáveis nem botões de salvar e remover; variáveis com problema listadas.
- SMS: começo do token e ambiente, ou a variável que falta. Interruptor, teste de conexão e envio de teste continuam. Sem campo de token.
- WhatsApp:
  - IDs editáveis;
  - chips com os nomes das variáveis e "Nenhuma";
  - começo do token escolhido;
  - avisos de variável não escolhida, sumida, inválida e de nenhuma variável no servidor;
  - interruptor sem variável avisa;
  - a aba de quem não é admin continua mostrando se o canal está ativo.

### Backend

- **E-mail:**
  - variáveis válidas = configurado;
  - cada variável ausente ou inválida = não configurado e listada;
  - `http` fora do localhost recusado;
  - sem chave privada = não configurado;
  - envio sempre com `accessToken`;
  - `PUT /email/account` responde 404;
  - identidade e aviso "Solicitação registrada" usam `APP_PUBLIC_URL`.
- **SMS:**
  - liga com token de produção aceito;
  - recusa ligar sem token, com token inválido ou `sbx_`;
  - teste de conexão com o token do servidor;
  - troca de `SMS_TOKEN` com o canal ligado continua enviando;
  - leitura pública falsa sem token;
  - `PUT /sms/account` recusa `token` e `clearToken`.
- **WhatsApp:**
  - nome válido e existente é aceito;
  - `JWT_SECRET`, `DATABASE_URL`, `WHATSAPP_TOKEN` sem sufixo, nome em minúsculas e variável inexistente são recusados;
  - `getRuntimeConfig` com `tokenVariable` fora do padrão gravado no banco não lê nada;
  - dois municípios com a mesma variável enviam com o mesmo token;
  - cada envio (avisos, códigos, recuperação, teste, sincronização) usa a variável do próprio município;
  - variável apagada do ambiente = não configurado, fora da recuperação e `active` falso para o visitante;
  - "nenhuma" desliga o canal, e ligar sem variável é recusado;
  - `accessToken` no corpo é ignorado e não gravado;
  - usuário interno vê `hasAccessToken`, sem nomes nem prévia; admin vê a lista, a escolhida e a prévia;
  - a lista nunca traz valores;
  - a auditoria registra a troca de nome.
- **Cifragem:** a chave de IA continua cifrando e decifrando.

### Conferência manual (tela)

- Com o `.env` local preenchido (só com ordem do usuário), abrir Configurações → Integrações → E-mail, SMS e WhatsApp como admin: Credenciais só de leitura, com o começo dos segredos e o nome das variáveis.
- No WhatsApp de um município: escolher a variável, ver o começo do token, ligar o canal e enviar um teste. Escolher "Nenhuma" e ver o canal desligar.
- Enviar um teste de SMS e um de e-mail.

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

- **Afetar produção:** o push em `main` publica no Render. As variáveis já estão lá. Depois do deploy, o WhatsApp de cada município fica sem variável escolhida até o admin escolher na tela (hoje só Içara → `WHATSAPP_TOKEN_ICARA`). Até isso, códigos e avisos por WhatsApp não saem.
- **SQL antes do deploy:** se o SQL rodar antes do deploy, o código antigo perde as credenciais e para de enviar. Ele vem só depois.
- **Apagar ou renomear uma variável `WHATSAPP_TOKEN_...` no Render:** o WhatsApp de todos os municípios que a usam para. A tela de cada um mostra o aviso.
- **Contrato front/back:** as leituras do SMS, do e-mail e do WhatsApp mudam juntas. Front e back sobem no mesmo deploy.
- **Acesso ao Render:** quem tem acesso ao Render controla todas as contas. Ativar a verificação em duas etapas lá.
- Nenhuma migration antiga é alterada.

---

## Perguntas em aberto

Nenhuma pergunta em aberto identificada. Decisões de 2026-11-22:
- A variável do token do WhatsApp é escolhida na tela de cada município, entre as `WHATSAPP_TOKEN_*` do Render, e vários municípios podem usar a mesma.
  - Isso substitui o nome montado pelo identificador do município, descartado porque o identificador interno não aparece em tela e pode ser diferente do nome (Içara tem o identificador `criciuma`).
  - Substitui também a ideia de token da plataforma com reserva automática.
- O sistema usa o domínio `https://castracao.aethersoftware.com.br`, em `APP_PUBLIC_URL`.
- A chave privada do EmailJS é obrigatória.
- `escopo-integracoes-notificacoes.md` também é atualizado.
- Ligar o SMS valida o token uma vez, e trocar o token no Render não exige reativar.
- Sem aviso por e-mail quando os IDs ou a variável do WhatsApp mudam: a troca só alterna entre tokens do Render e fica no histórico.

---

## Critérios de aceite

- Token do SMS, conta do EmailJS, endereço público e tokens do WhatsApp vêm só das variáveis de ambiente. Nenhum segredo é gravado no banco nem editável na tela.
- No WhatsApp, a tela escolhe só entre as variáveis `WHATSAPP_TOKEN_...` existentes, e nenhum caminho lê variável fora desse padrão.
- As telas de Credenciais mostram a situação de cada variável. Só o admin vê os nomes das variáveis e o começo dos segredos.
- Variável ausente ou inválida deixa o canal como não configurado, com aviso claro na tela e no log, sem expor o valor.
- Cada município usa só o token da variável escolhida na configuração dele.
- O SMS liga só com token de produção aceito, e o WhatsApp só com uma variável válida escolhida.
- O e-mail exige a chave privada e sempre a envia.
- Avisos, códigos, recuperação de senha, testes, sincronização, contratos e interruptores continuam funcionando.
- O SQL de limpeza existe e não é aplicado automaticamente.
- Typecheck, testes do front e do back e build sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations nem o SQL de limpeza sem confirmação explícita.
- Não alterar o `.env` sem ordem do usuário.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito, sempre com valores falsos.
