# Plano de Implementação: SMS no modelo de usos (conta por município, textos fixos, interruptor por uso)

## Origem

- Arquivo de especificação: nenhum arquivo único. Base: a conversa de 2026-11-15, o código do `main` (commit `1e1441b`) e os planos `.plans/integracao-email-global-templates-por-uso.md` (modelo de usos e interruptores reaproveitado; o `multiChannel` dele é **substituído** por este plano), `.plans/ajustes-login-recuperacao-senha.md` (SMS só na recuperação de senha; este plano reabre os demais usos) e `.plans/acompanhamento-canais-notificacoes-fase-4.md` (prioridade entre canais, já substituída pelo plano do e-mail).
- Data do planejamento: `2026-11-15`
- Classificação: `frontend + backend` (sem migration; tudo fica na tabela `config`, em JSON). Não há variável de ambiente nova.

---

## Resumo

Hoje o SMS serve só ao código de recuperação de senha do tutor, com texto fixo no código e token por município. Os avisos de andamento, a confirmação de telefone e o acompanhamento por telefone não usam SMS: telefone significa WhatsApp. O formulário "Acompanhamento" só pede telefone quando o WhatsApp do município está ativo.

Passa a funcionar assim:

- **9 usos de SMS**, com um interruptor por uso e município: os 5 avisos da solicitação (agendamento confirmado, alterado e cancelado, documentos conferidos, atendimento concluído) e 4 mensagens de acesso (recuperação de senha, confirmação de telefone, acompanhamento de solicitação, contato alterado). A senha inicial não vai por SMS.
- **Textos fixos no código**, montados por um construtor puro em `shared/`: sem acento, no máximo 160 caracteres (testados no pior caso) e começando pelo nome do município. O backend usa o construtor para enviar e a tela usa para mostrar o exemplo de cada mensagem.
- **Conta por município**, como hoje: o token continua de cada prefeitura, cifrado, com "Ativar SMS" exigindo token de produção validado por consulta de saldo. O token passa a mostrar só o começo (8 caracteres), no mesmo campo de segredo do WhatsApp e do e-mail.
- **Uso ativo é usado.** Não há interruptor geral de "mais de um canal". Nos avisos, e-mail, WhatsApp e SMS são tentados de forma independente, cada um quando está ativo e com o uso ligado. O `multiChannel` entregue com o e-mail sai.
- **Telefone nos códigos:** confirmação de telefone e acompanhamento por telefone tentam o WhatsApp e, se ele não enviar, o SMS. A recuperação de senha segue com o solicitante escolhendo entre os canais disponíveis.
- **Formulário "Acompanhamento"** pede telefone quando o WhatsApp **ou** o SMS está ativo.
- **Uma tela só para o SMS** (a aba que já existe), agora com as credenciais e a tabela de usos. WhatsApp e SMS são integrações separadas, cada uma na sua aba, sem controle compartilhado.

Motivo: dar ao SMS o mesmo modelo do e-mail (usos, interruptor por município, identidade do município no texto) sem mexer no que o torna seguro e barato de operar: a conta e o saldo de cada prefeitura continuam isolados.

### Decisões do usuário (2026-11-15)

1. Conta de SMS **por município**.
2. Os **9 usos** propostos, sem a senha inicial.
3. Textos **fixos** no código (sem editor).
4. SMS e WhatsApp são **integrações separadas**: uma tela só para o SMS, como a que já existe.
5. **Se o uso está ativo, é usado**, no mesmo padrão dos demais canais.
6. Prévia do token com o **mesmo padrão das outras integrações** (8 caracteres, campo de segredo compartilhado).

Interpretações confirmadas ao aprovar o plano:

- **(a)** O `multiChannel` da aba E-mail sai, porque era um controle compartilhado entre canais. O WhatsApp passa a valer pelos interruptores de uso dele, como o e-mail e o SMS. Como tudo começa desligado, o padrão continua sendo "nada é enviado até alguém ligar".
- **(b)** Para códigos por telefone (confirmação e acompanhamento), com WhatsApp e SMS ativos, vale WhatsApp primeiro e SMS se o WhatsApp não enviar. Nos avisos, cada canal ativo envia por conta própria.

---

## Escopo

### Dentro do escopo

- Contratos compartilhados dos 9 usos, dos interruptores e dos textos fixos.
- Envio de SMS por uso (provedor generalizado para qualquer texto, mantendo a validação estrita da resposta).
- Interruptores por uso e município, com rota própria, auditoria e regra de ligar só com o canal ativo.
- Prévia de 8 caracteres do token e campo de segredo compartilhado na aba SMS.
- SMS como canal independente nos avisos da solicitação; WhatsApp e e-mail passam a seguir a mesma regra de "tentado só quando em uso".
- Cadeia de telefone (WhatsApp, depois SMS) na confirmação de telefone, no acompanhamento por telefone e no contato alterado.
- Telefone no formulário "Acompanhamento" quando WhatsApp **ou** SMS está ativo, no frontend e no backend (`phoneEnabled`).
- Remoção do `multiChannel` e da chave `castragestao:notifications`, com o que ficar sem uso.
- Tabela de usos na aba SMS, com o exemplo de cada texto e o interruptor.
- Extração da lógica comum de interruptores por uso e do repositório de `config` do e-mail para reuso no SMS.
- Atualização de `docs/tutor-access.md`.

### Fora do escopo

- Senha inicial por SMS.
- Editor de textos de SMS pelo master (os textos são fixos).
- Conta global do SMS, limite mensal por município e qualquer cota de SMS (o saldo de cada conta é o limite).
- Envio de teste real: continua só a consulta de saldo.
- Webhook de entrega, relatório de status, agendamento e múltiplos provedores.
- SMS para a equipe: a recuperação de senha de equipe continua só por e-mail.
- Mudanças no WhatsApp além de remover o `multiChannel` e a nota sobre ele.
- Verificar com o provedor real o eco do texto e as regras de remetente das operadoras (fora do código, ver "Riscos").

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md`, `.claude/skills/planejar/SKILL.md` e `TEMPLATE_planejar.md`
- Planos: `integracao-email-global-templates-por-uso.md`, `ajustes-login-recuperacao-senha.md`, `aba-email-canais.md`, `acompanhamento-canais-notificacoes-fase-4.md`
- Backend: `services/smsmais.js`, `sms-integration-settings.js`, `repositories/sms-settings.js`, `routes/sms.js`, `routes/config.js`, `services/notifications/dispatch-notification.js`, `request-change-notifications.js`, `services/auth/auth-message-delivery.js`, `recovery-channels.js`, `auth-contacts.js`, `profile-handlers.js`, `services/request-tracking/tracking-handlers.js`, `tracking-input.js`, `services/request-submission.js`, `repositories/request-settings.js`, `repositories/email-config.js`, `services/whatsappQuota.js`
- Contratos: `shared/sms-contract.js`, `notification-contract.js`, `email-contract.js`, `email-uses-contract.js`, `auth-contract.js`
- Frontend: `src/features/sms/*` (controller, tipos, hook e tela), `request-follow-up/*` (política, passo e validação), `email/email-integration-tab.tsx`, `notifications/*`, `whatsapp-integration/whatsapp-templates-panel.tsx`, `src/components/saved-secret-field.tsx`
- Testes: `sms-settings`, `sms-routes`, `smsmais`, `notification-dispatch`, `notification-contract`, `auth-delivery`, `recovery-options`, `request-change-notifications`, `request-routes`, `request-submission`, `config-security`, `follow-up.test.tsx`, `sms-settings.test.tsx`

Fatos verificados que sustentam o plano:

- O token fica no registro `castragestao:sms` de cada município (cifrado, com `revision` e a impressão da verificação). Ativar exige token de produção validado por consulta de saldo; token de homologação (`sbx_`) não ativa nem envia. O contrato de SMS hoje proíbe expor qualquer pedaço do token.
- O único envio é o código de recuperação, com texto fixo dentro de `smsmais.js`. O adaptador exige no máximo 160 caracteres e só aceita a resposta do provedor se o texto devolvido for idêntico ao enviado, o `externalId` for o id da mensagem (um UUID) e o destino conferir.
- `recoveryContacts` entrega telefone só para tutor. `deliverAuthMessage` usa o telefone só pelo WhatsApp fora da recuperação. `tracking-input.js` trata telefone como canal WhatsApp.
- O formulário só mostra o campo de telefone quando `whatsapp.active` é verdadeiro (`use-follow-up-policy.ts`), e `normalizeFollowUp` só aceita o telefone com a opção `whatsappEnabled`, alimentada por `request-settings.js`.
- O SMS não tem cota (cada município gasta o próprio saldo). O WhatsApp tem cota mensal por município.
- Depois da entrega do e-mail, `castragestao:notifications` guarda só `emailEnabled` e `smsEnabled` (constantes) e `multiChannel`. É lida pelo formulário público (`emailEnabled`) e por `loadRequestSettings`, que a entrega ao `dispatchNotification`.
- O frontend do SMS usa um controlador privado por contexto montado (`sms-settings-controller.ts`) que descarta respostas atrasadas; o plano estende esse controlador em vez de reescrevê-lo.

---

## Impacto por área

### Frontend

- **Aba SMS** (`src/features/sms/`): continua uma tela só, em duas seções.
  - **Credenciais:** campo de token com `SavedSecretField` (começo de 8 caracteres, máscara, "Remover token" com confirmação), "Ativar SMS", "Testar conexão / Consultar saldo" (só saldo, como hoje) e os avisos de homologação e de armazenamento seguro indisponível.
  - **Mensagens:** uma tabela com os 9 usos (Mensagem, Exemplo do texto, Ativo). O exemplo vem do construtor compartilhado, com o nome do município. O interruptor grava na hora e fica travado enquanto o canal não estiver ativo.
  - O controlador ganha `tokenPreview`, a lista de usos e `setUseActive`, mantendo os guardas contra resposta atrasada e a ação única em andamento.
- **Remover** o `MultiChannelSwitch` da aba E-mail, o hook `use-notification-settings.ts` e a nota na aba WhatsApp.
- **Formulário "Acompanhamento":** `use-follow-up-policy.ts` lê as configurações públicas de `whatsapp` e de SMS e libera o telefone quando qualquer uma está ativa; deixa de ler `castragestao:notifications`. `follow-up.ts` e `follow-up-step.tsx` seguem com `phoneEnabled`, e a opção compartilhada passa de `whatsappEnabled` para `phoneEnabled`.
- **`src/api.ts`:** `setSmsUseActive`; tipos do SMS com `tokenPreview` e `uses`.
- Sem CSS novo: reaproveitar as classes de tabela, interruptor e campo já usadas pelas abas WhatsApp e E-mail.

### Backend

- **Contratos (`shared/`):**
  - `sms-uses-contract.js` (novo): os 9 usos (chaves de `NotificationEvent` e `AuthPurpose`, sem strings novas), tipo, rótulo e padrão ligado (só `password_reset`).
  - `sms-messages-contract.js` (novo): construtor puro dos textos, com a transliteração para ASCII, o limite de 160 caracteres e o corte do nome do município e do local, e o exemplo de cada uso.
  - `sms-contract.js`: chave `sms_active_uses`, normalizador e leitura dos interruptores, `tokenPreview` no DTO. A lógica de interruptor por uso é extraída de `email-contract.js` para uma função compartilhada, usada por e-mail e SMS.
  - `notification-contract.js`: sai `castragestao:notifications` inteira; a opção `whatsappEnabled` de `validateFollowUp` e `normalizeFollowUp` vira `phoneEnabled`.
- **Provedor** (`smsmais.js`): o envio de código vira envio de qualquer texto (`sendSmsMessage`), com id de mensagem (o id do desafio nos códigos, um UUID novo nos avisos) e a mesma validação estrita da resposta.
- **Serviços:**
  - `sms-integration-settings.js`: grava `tokenPreview` ao salvar um token novo e devolve o nome do município para o exemplo; `sendSmsRecoveryCode` é trocado por `sendSmsUse` (valida canal ativo, credencial de produção válida e uso ligado, e envia).
  - `sms-uses.js` (novo): lista de usos, ligar e desligar, `isSmsUseAvailable` (leitura, sem chamar o provedor).
  - O repositório `email-config.js` é extraído para um nome neutro (`config-values.js`) e reaproveitado pelos usos de SMS.
- **Rotas:**
  - `PUT /api/sms/uses/active` (`requireMunicipalAdmin`, município por `pickMunicipalityId`).
  - `GET /config/castragestao:sms`: o administrador recebe a configuração segura com `tokenPreview` e os usos; o visitante recebe só `{ active }`, como o WhatsApp (`publicSmsConfig`). A chave sai de `SENSITIVE_CONFIG_KEYS`; a escrita continua restrita ao administrador municipal ou global.
  - Nova ação de auditoria `SMS_USE_UPDATE`, sem texto de mensagem nem telefone.
- **Envio dos avisos** (`dispatch-notification.js`): e-mail, WhatsApp e SMS são tentados de forma independente. Só entra no resultado, e portanto no histórico da solicitação, o canal **em uso** para aquele aviso; canal desligado, ou sem template ou uso ligado para o aviso, não é tentado e não deixa entrada. Falhas de um canal em uso (telefone ausente, saldo, template indisponível, provedor) continuam registradas. Solicitações antigas seguem só com WhatsApp. O parâmetro `config` sai.
- **Envio de acesso** (`auth-message-delivery.js`): a cadeia de telefone (WhatsApp, depois SMS) vale para confirmação de telefone, acompanhamento e contato alterado, sem fallback para e-mail onde ele não existe hoje. A recuperação de senha por SMS passa a conferir o uso `password_reset`.
- **Disponibilidade na recuperação** (`recovery-channels.js`): SMS disponível = canal ativo, credencial de produção válida e uso `password_reset` ligado.
- **Telefone no acompanhamento:** `request-settings.js` devolve `phoneEnabled` (WhatsApp ou SMS ativo) e `request-submission.js` o repassa; `tracking-handlers.js` entrega o telefone à cadeia de telefone, e não só ao WhatsApp.
- **`routes/config.js`:** sai o tratamento de `castragestao:notifications`.
- **`request-change-notifications.js`:** sai o `loadSettings` e sua mensagem de falha, e `routes/requests.js` deixa de o passar.

### Banco de dados

Sem alteração de schema. Linhas na tabela `config`:

- `castragestao:sms` (por município, já existente): ganha `tokenPreview`. Registros sem prévia continuam funcionando e mostram a máscara de tamanho desconhecido.
- `sms_active_uses` (por município, novo): `{ active: { <uso>: true|false } }`, guardando também o `false` explícito, porque a recuperação de senha vem ligada por padrão.
- `castragestao:notifications`: deixa de ser lida ou gravada; linhas existentes ficam órfãs e não são apagadas.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção. Este plano não cria migration.

### Infra/Deploy

- Nenhuma variável de ambiente nova e nada a mudar no Render por conta deste plano.
- `CONFIG_ENCRYPTION_KEY` válida continua necessária para salvar o token de SMS.
- O push em `main` dispara deploy no Render; sem migration nem variável nova, o risco é só de comportamento.

---

## Arquivos provavelmente afetados

**Novos**

- `shared/sms-uses-contract.js`, `shared/sms-messages-contract.js`
- `backend/src/services/sms-uses.js`
- `backend/src/repositories/config-values.js` (extraído de `email-config.js`)
- Testes: `backend/test/sms-messages.test.js`, `backend/test/sms-uses.test.js`

**Alterados**

- `shared/sms-contract.js`, `shared/email-contract.js`, `shared/notification-contract.js`
- `backend/src/services/smsmais.js`, `sms-integration-settings.js`, `email-account.js`, `email-templates.js`, `audit.js`
- `backend/src/services/notifications/dispatch-notification.js`, `request-change-notifications.js`, `request-submission.js`
- `backend/src/services/auth/auth-message-delivery.js`, `recovery-channels.js`
- `backend/src/services/request-tracking/tracking-handlers.js` e, se necessário, `tracking-input.js`
- `backend/src/repositories/request-settings.js`, `backend/src/routes/sms.js`, `config.js`, `requests.js`
- `src/api.ts`, `src/features/sms/*`, `src/features/email/email-integration-tab.tsx`
- `src/features/request-follow-up/use-follow-up-policy.ts`, `follow-up.ts`
- `src/features/whatsapp-integration/whatsapp-templates-panel.tsx`
- `docs/tutor-access.md`
- Testes existentes listados em "Testes necessários"

---

## O que será removido

Cada item deve ser **deletado do arquivo**, não comentado nem ocultado.

- **Entregue com o e-mail (`1e1441b`):**
  - `multiChannel` e `smsEnabled`, e a chave `castragestao:notifications` inteira: `NOTIFICATIONS_CONFIG_KEY`, `buildDefaultNotificationConfig`, `normalizeNotificationConfig` e `validateNotificationConfig` em `shared/notification-contract.js`; o tratamento dela em `routes/config.js` (construtor de padrões, chaves de escrita, validação do PUT, `publicConfigValue` e `prepareConfigValue`).
  - O parâmetro `config` de `dispatchNotification`, o `loadSettings` de `request-change-notifications.js` com a mensagem "Configuração de envio indisponível.", o argumento `loadSettings` em `routes/requests.js` e o campo `notifications` (com seu import) de `loadRequestSettings`.
  - `src/features/notifications/multi-channel-switch.tsx` e `use-notification-settings.ts`, o uso do interruptor em `email-integration-tab.tsx` e a nota em `whatsapp-templates-panel.tsx`.
  - Em `use-follow-up-policy.ts`, a leitura de `castragestao:notifications` e a checagem de `emailEnabled`.
  - A entrada de histórico "não enviado" que o e-mail grava quando o uso está desligado: o canal desligado deixa de ser tentado.
- **SMS:**
  - `sendSmsRecoveryCode` em `sms-integration-settings.js` e o texto fixo do código dentro de `smsmais.js` (vira `sendSmsUse`, `sendSmsMessage` e o construtor compartilhado).
  - O comentário de `shared/sms-contract.js` que proíbe qualquer pedaço do token; o contrato passa a expor `tokenPreview`.
  - Em `src/features/sms/sms-settings.tsx`, o campo de token sem prévia e o formulário de botão único, trocados pelo campo compartilhado.
- **Opção `whatsappEnabled`** de `validateFollowUp` e `normalizeFollowUp`, renomeada para `phoneEnabled`.
- **Testes e documentação** desses trechos, inclusive as menções a `multiChannel` em `docs/tutor-access.md`, se houver.

> **Atenção para a skill `implementar`:** nada acima deve ser comentado, envolto em `if (false)` ou escondido com flag. Se a remoção gerar erro de compilação, corrigir o erro, sem `@ts-ignore`.

Dados que **não** são apagados: linhas antigas de `castragestao:notifications` e os registros `castragestao:sms` existentes. Não há clientes nem produção ainda.

---

## Estratégia de implementação

1. **Contratos.** `sms-uses-contract.js` (9 usos, padrão ligado) e `sms-messages-contract.js` (textos, transliteração, limite, exemplos). Extrair de `email-contract.js` a lógica de interruptor por uso e reutilizar em `sms-contract.js`. Trocar `whatsappEnabled` por `phoneEnabled` em `notification-contract.js`.
2. **Repositório de `config`.** Extrair `email-config.js` para `config-values.js` e ajustar o e-mail para o novo nome, sem mudar comportamento. Os testes do e-mail têm de continuar verdes.
3. **Provedor.** Generalizar `smsmais.js` para qualquer texto (`sendSmsMessage`), com id de mensagem e a mesma validação estrita da resposta.
4. **Usos e token.** `sms-uses.js` (listar, ligar e desligar, `isSmsUseAvailable`), `tokenPreview` em `sms-integration-settings.js`, `sendSmsUse` no lugar de `sendSmsRecoveryCode`, ação de auditoria `SMS_USE_UPDATE`.
5. **Rotas.** `PUT /api/sms/uses/active`; no `GET /config/castragestao:sms`, a visão do administrador com prévia e usos e a visão pública `{ active }`.
6. **Envio.** SMS como canal em `dispatchNotification` com a regra de "tentado só quando em uso" (incluindo o e-mail), cadeia de telefone em `auth-message-delivery.js`, disponibilidade em `recovery-channels.js`, telefone em `tracking-handlers.js`.
7. **Telefone no acompanhamento.** `phoneEnabled` em `request-settings.js`, `request-submission.js`, `follow-up.ts` e `use-follow-up-policy.ts`.
8. **Remoção do `multiChannel`.** `castragestao:notifications`, `loadSettings` e o que ficar sem uso, no backend e no frontend.
9. **Tela.** Controlador, tipos e componentes da aba SMS (credenciais com `SavedSecretField` e tabela de usos); remover o interruptor, o hook e a nota antigos; `api.ts`.
10. **Documentação e testes.** `docs/tutor-access.md` e os testes da seção abaixo; rodar os comandos de validação uma vez ao final.

Dividir em entregas menores é decisão do usuário. Se pedido, o corte natural é: o fluxo do solicitante e o formulário de telefone, depois os avisos por SMS, e por último a tela nova.

---

## Regras de negócio identificadas

- **Canal SMS ativo:** "Ativar SMS" ligado e token de produção validado, como hoje. Quem configura: administrador municipal ou global.
- **Usos:** os 9 de SMS, com interruptor por município. Padrão: só `password_reset` ligado. Ligar um uso exige o canal ativo (senão 400); desligar é sempre permitido. Desativar o canal preserva os interruptores guardados, que voltam a valer ao reativar.
- **Avisos da solicitação:** e-mail, WhatsApp e SMS são tentados de forma independente. Um canal é tentado quando está ativo e o uso está ligado (e-mail: uso ligado e configurado; WhatsApp: canal ativo e template ativo para o aviso; SMS: canal ativo e uso ligado) e há contato (e-mail ou telefone informado no acompanhamento). A falha de um canal não impede os outros. O histórico recebe uma entrada por canal tentado.
- **Solicitante que recusou o acompanhamento** não recebe aviso; **solicitações antigas** (sem `followUp`) seguem só por WhatsApp, só agenda confirmada e alterada.
- **Recuperação de senha:** o solicitante escolhe entre os canais disponíveis. SMS disponível = canal ativo, credencial de produção válida, uso `password_reset` ligado e telefone no perfil do tutor. A equipe continua só por e-mail.
- **Confirmação de telefone e acompanhamento por telefone:** um canal só por envio. Tenta o WhatsApp e, se ele não enviar, o SMS, sempre para o telefone informado. Sem fallback para e-mail.
- **Contato alterado:** cadeia de telefone (WhatsApp, depois SMS) e e-mail como reserva, como hoje.
- **Senha inicial:** sem SMS; segue como hoje.
- **Textos:** fixos, em ASCII (sem acento), no máximo 160 caracteres, começando pelo nome do município (cortado). O local e o nome são cortados para o texto caber. O código só aparece nos usos de código. Exemplos (a redação final sai dos testes de tamanho):
  - `Criciuma: seu codigo e 123456. Valido por 10 minutos. Nao compartilhe.`
  - `Criciuma: castracao agendada em 20/11/2026 as 09:00, Unidade Veterinaria Municipal. Protocolo 123/2026.`
  - `Criciuma: o agendamento de 20/11/2026 as 09:00 foi cancelado. Protocolo 123/2026.`
- **Telefone no formulário:** pedido quando o WhatsApp **ou** o SMS está ativo; o backend aceita o telefone na mesma condição.
- **Token:** nunca volta inteiro; o administrador vê só o começo (8 caracteres). Remover o token desativa o canal, como hoje.
- **Custo e saldo:** sem cota própria. Saldo insuficiente no provedor vira o código `INSUFFICIENT_BALANCE`.
- **Sem teste de envio:** só a consulta de saldo.

---

## Regras multi-tenant e segurança

- **Origem do tenant:** nas rotas de SMS o município vem de `pickMunicipalityId(req)`: o administrador municipal fica preso ao próprio município e qualquer `municipalityId` do corpo ou da query é ignorado. Global escolhe o município e ele precisa ser válido e ativo.
- **Permissões:** `requireMunicipalAdmin` para ligar e desligar usos e para a configuração; o visitante lê só `{ active }`. Nenhum dado da conta (saldo, ambiente, prévia) vai ao público.
- **Segredo:** token cifrado com `encryptSecretStrict`, sem fallback para texto puro; a prévia de 8 caracteres só vai ao administrador; nada de token em auditoria, log ou erro. O token de homologação continua sem ativar nem enviar.
- **Auditoria:** a gravação do token e do canal continua em `CONFIG_UPDATE`; a de usos usa `SMS_USE_UPDATE`. Nenhum registro leva texto de mensagem, telefone ou token.
- **Privacidade:** o telefone vem só do que o solicitante informou (acompanhamento ou perfil), nunca de outro contato. Os textos não levam CPF nem dados do animal.
- **Isolamento de custo:** cada município envia pela própria conta; um município não consome o saldo de outro.
- **Rota pública `{ active }`:** não amplia a exposição além do que o WhatsApp já expõe.
- **Relatórios e PDFs:** sem impacto.

---

## Validações necessárias

- **Uso (`PUT /api/sms/uses/active`):** `use` entre os 9 usos e `active` booleano; ligar sem o canal ativo responde 400; município inválido responde 400 e município inexistente ou inativo responde o erro já usado pelo SMS.
- **Token:** as regras atuais (`validateSmsToken`, tamanho máximo, sem `Bearer`); a prévia é derivada do token digitado e gravada ao salvar.
- **Telefone nos envios:** `normalizeSmsPhone` (número brasileiro); telefone inválido gera `INVALID_RECIPIENT` sem chamar o provedor.
- **Texto:** só ASCII, no máximo 160 caracteres; texto acima do limite não é enviado (falha de preparo), e o teste de tamanho prova que o pior caso cabe.
- **Resposta do provedor:** a validação estrita atual (texto devolvido idêntico, `externalId` igual ao id da mensagem, destino conferido, sem simulado, retido ou sandbox).
- **Formulário:** o telefone só é aceito quando `phoneEnabled`; formato como hoje.

---

## Testes necessários

### Frontend

- `sms-settings.test.tsx` (atualizado): campo de token com o começo de 8 caracteres e remoção confirmada, sem o token inteiro em lugar nenhum; tabela com os 9 usos, exemplo do texto e interruptor; interruptor travado com o canal inativo; carregamento, erro, sem permissão e sem município; o controlador continua descartando respostas atrasadas.
- `follow-up.test.tsx` (atualizado): `loadFollowUpPolicy` libera o telefone com WhatsApp **ou** SMS ativo, e não lê mais `castragestao:notifications`.
- `email-integration.test.tsx`: sem o interruptor de mais de um canal. `whatsapp-integration.test.tsx`: sem a nota.

### Backend

- **Textos (`sms-messages.test.js`, novo):** ASCII, no máximo 160 caracteres no pior caso (nome do município e local longos), prefixo do município, código só nos usos de código, transliteração de acentos e de caracteres fora do básico.
- **Usos (`sms-uses.test.js`, novo):** padrão (só `password_reset`), `false` explícito vence o padrão, ligar exige canal ativo, interruptor por município sem vazar para outro, auditoria sem segredo, `isSmsUseAvailable` sem chamada ao provedor.
- **Provedor (`smsmais.test.js`):** envio de texto genérico com id próprio, validação estrita mantida, sandbox e texto acima do limite nunca chamam o provedor.
- **Configuração e rotas (`sms-settings.test.js`, `sms-routes.test.js`, `config-security.test.js`):** prévia de 8 caracteres e nunca o token inteiro; `PUT /api/sms/uses/active` só para administrador municipal ou global, município forjado ignorado; o visitante lê só `{ active }`; a chave `castragestao:notifications` não é mais servida.
- **Avisos (`notification-dispatch.test.js`, reescrito):** os três canais independentes; canal ou uso desligado não é tentado nem deixa entrada; a falha de um não impede os outros; sem telefone só e-mail; legado inalterado.
- **Acesso (`auth-delivery.test.js`, `recovery-options.test.js`, `request-tracking.test.js`):** cadeia WhatsApp, depois SMS, na confirmação de telefone, no acompanhamento por telefone e no contato alterado; nunca fallback para e-mail onde não existe; SMS na recuperação só com o uso ligado; o código vai só ao telefone informado.
- **Formulário e submissão (`request-submission.test.js`, `notification-contract.test.js`):** `phoneEnabled` com WhatsApp ou SMS ativo; telefone recusado sem nenhum dos dois.
- **Remoções (`request-change-notifications.test.js`, `request-routes.test.js`):** sem `loadSettings`, sem a leitura de configurações e sem o teste da falha de configuração.

### Conferência manual (tela)

- Aba SMS como administrador municipal: salvar um token (começo visível), ativar, ligar e desligar usos, ver o exemplo de cada texto.
- Formulário público de um município só com SMS: o campo de telefone aparece.
- Os envios reais só se conferem em produção, com token de produção e crédito: recuperação de senha por SMS e um aviso de agenda.

---

## Comandos de validação sugeridos

```bash
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

Sem inspeção visual no navegador, salvo pedido. Os testes não podem enviar SMS de verdade: o transporte é sempre injetado.

---

## Riscos e pontos de atenção

- **Eco do texto pelo provedor:** o código só aceita a resposta se o texto devolvido for idêntico ao enviado. Isso só foi validado com o texto do código; com os textos maiores dos avisos, qualquer alteração do provedor faria o envio ser recusado. Conferir com um token real antes de ligar os avisos.
- **Custo:** cada SMS consome crédito do município; com os três canais ligados, o mesmo aviso sai três vezes.
- **Operadoras e remetente:** as regras de remetente de SMS no Brasil podem bloquear mensagens. Não foi verificado.
- **Mexe no que foi entregue com o e-mail:** o `multiChannel`, a chave `castragestao:notifications` e as entradas de histórico do e-mail desligado. Sem clientes, o impacto é baixo.
- **Histórico:** com a regra de "tentado só quando em uso", um uso esquecido desligado não deixa nenhuma entrada; o diagnóstico fica na tela de usos.
- **Remoção de chave pública:** `GET /config/castragestao:notifications` deixa de existir; só o formulário interno a usava.
- **Cadeia de telefone:** WhatsApp primeiro pode gastar cota de WhatsApp antes do SMS; o município que prefere SMS desliga o uso do WhatsApp.
- **Tamanho do módulo SMS:** o controlador e a tela são cobertos por testes próprios; a reestruturação precisa mantê-los verdes ou atualizá-los com motivo claro.
- **Deploy:** push direto em `main` (sem `staging`) dispara o deploy no Render. Sem migration e sem variável nova, o risco é só de comportamento.

---

## Perguntas em aberto

Nenhuma pergunta em aberto identificada. As interpretações (a) e (b), em "Decisões do usuário", foram confirmadas ao aprovar o plano. Ficam como conferências fora do código: o eco do texto pelo provedor e as regras de remetente das operadoras, com token e crédito reais.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- A aba SMS é uma tela só, com credenciais (token mostrado pelo começo, 8 caracteres, nunca inteiro) e a tabela dos 9 usos com exemplo do texto e interruptor por município.
- Ligar um uso exige o canal ativo; só a recuperação de senha vem ligada por padrão; o interruptor de um município não afeta outro.
- Os textos de SMS são fixos, sem acento, no máximo 160 caracteres no pior caso, e começam pelo nome do município.
- Os avisos saem por e-mail, WhatsApp e SMS de forma independente, cada um quando em uso; canal ou uso desligado não é tentado nem deixa entrada no histórico; a falha de um não impede os outros.
- Confirmação de telefone e acompanhamento por telefone usam WhatsApp e, se ele não enviar, SMS; a recuperação de senha segue com o solicitante escolhendo entre os canais disponíveis; a senha inicial não usa SMS.
- O formulário "Acompanhamento" pede telefone quando o WhatsApp ou o SMS está ativo, e o backend aceita o telefone na mesma condição.
- Nenhum resquício do modelo antigo: `multiChannel`, `castragestao:notifications`, `smsEnabled`, `loadSettings`, `sendSmsRecoveryCode`, o interruptor da aba E-mail e a nota da aba WhatsApp.
- O token de SMS e os telefones não aparecem em resposta pública, log, auditoria ou mensagem de erro.
- Typecheck, testes de frontend e de backend e build passam sem erros novos; `docs/tutor-access.md` reflete o modelo novo.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita. Este plano não cria nenhuma.
- Seguir `/AGENT.md`: código novo em inglês, arquivos pequenos de responsabilidade única, nenhum `console.log`, sem código morto.
- Não alterar `.env`. Testes só com valores falsos (tokens e telefones de exemplo); nunca enviar SMS de verdade, o transporte é injetado.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Ao extrair `email-config.js` e a lógica de interruptor por uso, o comportamento e os testes do e-mail não podem mudar.
- Atualizar os testes conforme descrito e rodar os comandos de validação uma vez ao final.
- Não commitar nem dar push sem o `/finalizar`.
