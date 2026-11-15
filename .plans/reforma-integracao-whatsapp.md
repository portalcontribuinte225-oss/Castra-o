# Plano de Implementação: Reforma da integração do WhatsApp (vínculos de template + sincronização com a Meta)

## Origem

- Arquivo de especificação: `.plans/integracao-whatsapp-vinculos-templates.md` (decisões fechadas e estado atual) e `registro_configuracoes_meta_sistema_castracao.md` (configuração real na Meta).
- Data do planejamento: `2026-11-15`
- Classificação: `fullstack` (sem migration: tudo fica na tabela `config`, em JSON)

---

## Resumo

Hoje a tela de integração pede nomes de template digitados à mão (8 campos), chips de variáveis e credenciais, e nada confere com o que existe na Meta. O envio falha com os templates já cadastrados: a confirmação manda 2 parâmetros e o template tem 4; o reagendamento manda 2 e o template tem 4; não existe evento de cancelamento; o campo `phone` envia `-` em silêncio; a data da variável não é convertida para `dd/mm/aaaa`.

A reforma troca isso por:

- **Vínculos por município:** cada evento aponta para um template aprovado e para o mapeamento `{{n}}` → campo conhecido (ou texto fixo).
- **Catálogo vindo da Meta:** sincronizado por botão, somente leitura. A Meta é a fonte da verdade; ninguém cadastra template à mão.
- **Validação ao vincular e no envio:** nunca existe erro silencioso e template pausado/reprovado não é enviado.
- **Tela nova** no lugar dos 8 campos e dos chips.

Critérios do usuário: funcionar corretamente, não arriscar banimento da conta, ser prático.

---

## Escopo

### Dentro do escopo

- Contrato compartilhado de vínculos (campos disponíveis, padrões da Meta, validação).
- Evento novo `SCHEDULE_CANCELLED`.
- Envio de notificações e `/api/whatsapp/test` passando a usar vínculos.
- ID da conta WABA por município; token cifrado; leitura pública de `whatsapp` reduzida.
- Sincronização do catálogo (`message_templates`), cache por município e bloqueio no envio.
- Endpoints `/api/whatsapp/catalog`, `/catalog/sync` e `/bindings` (admin municipal, com auditoria).
- Nomes dos templates de acesso escolhidos a partir do catálogo (sem mapeamento).
- Tela nova em `src/features/whatsapp-integration/`.
- Limpeza das chaves, caminhos, campos e CSS antigos; atualização dos testes.

### Fora do escopo

- Webhook `message_template_status_update` (exige endpoint público e verificação de assinatura).
- Criar ou editar template na Meta a partir do sistema.
- Cabeçalho com variável/mídia, botão com variável e parâmetros nomeados (marcados como "formato não suportado").
- Lembrete de véspera e outros eventos novos (exigem código próprio depois).
- Cortar o envio de senha inicial por WhatsApp (decisão separada; fica como está).
- Mudanças de cota/contrato (a barra de status, a cota e o teste de envio permanecem).
- Migrations ou limpeza de dados antigos no banco.

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md` (único AGENT.md do projeto)
- `.plans/integracao-whatsapp-vinculos-templates.md`
- `registro_configuracoes_meta_sistema_castracao.md`
- `backend/src/services/whatsapp.js`, `whatsappQuota.js`
- `backend/src/services/notifications/` (`dispatch-notification`, `notification-events`, `notification-message`, `delivery-result`)
- `backend/src/services/auth/auth-message-delivery.js`
- `backend/src/services/config-secret-cipher.js`, `sms-integration-settings.js`
- `backend/src/routes/whatsapp.js`, `routes/config.js`
- `backend/src/repositories/request-settings.js`, `channel-config.js`
- `shared/notification-contract.js`, `shared/auth-contract.js`
- `src/App.tsx` (bloco da aba WhatsApp e seu estado), `src/domain.ts`, `src/api.ts`
- `src/features/notifications/*`, `src/features/tutor-access/auth-delivery-settings.tsx`, `src/features/request-follow-up/use-follow-up-policy.ts`
- testes de backend e frontend que citam WhatsApp

---

## Impacto por área

### Frontend

- Nova feature `src/features/whatsapp-integration/`:
  - hook de dados (credenciais mascaradas, catálogo, vínculos, sincronizar, salvar/remover vínculo) usando `src/api.ts`;
  - bloco de credenciais enxuto (token, ID da conta WABA, ID do número, ativo);
  - grid de vínculos + editor (evento, template aprovado, mapeamento por posição com campo ou texto fixo, prévia do corpo com dados de exemplo);
  - grid do catálogo somente leitura (nome, idioma, status, categoria, qualidade, variáveis, "formato não suportado") com botão "Sincronizar" e data da última sincronização;
  - estados de loading, erro, vazio ("Sincronize para listar os templates") e desabilitado (sem credenciais).
- `src/App.tsx`: no bloco da aba WhatsApp, trocar a seção de credenciais antiga e os dois componentes de nomes de template pela feature nova; remover o estado e o salvamento de `confirmationTemplate`, `templateVariables` e `languageCode`. Barra de status, cota e teste de envio ficam como estão. Edições pontuais, sem refatorar o arquivo.
- `src/features/notifications/*`: a aba WhatsApp deixa de existir em `NotificationSettings` (fica só e-mail); `notificationChannelPatch` perde o ramo WhatsApp.
- `src/features/tutor-access/auth-delivery-settings.tsx`: nomes dos templates de acesso viram seleção a partir do catálogo.
- `src/domain.ts`: remover `WHATSAPP_TEMPLATE_VARS` e os campos antigos de `initialWhatsappSettings`.
- `src/styles.css`: remover o CSS órfão das classes removidas.
- Testes de frontend atualizados e novos (padrão `renderToStaticMarkup` de `email-settings.test.tsx`).

### Backend

- Contrato novo `shared/whatsapp-binding-contract.js`: enum de campos (`tutor_name`, `protocol`, `schedule_date`, `schedule_time`, `schedule_location_name`, `schedule_address`, `schedule_address_url`, `animal_name`, `species`, `city`, `notification_message`; **sem `phone`**), vínculos padrão da Meta, `normalize` e `validate`.
- `shared/notification-contract.js`: evento `SCHEDULE_CANCELLED`; remover `whatsappTemplates` de defaults, normalize, validate e merge; novo `DeliveryCode` para template indisponível.
- `notification-events.js`: `AGENDADA → CANCELADA` gera `SCHEDULE_CANCELLED` (só no fluxo de acompanhamento; `NOVA → CANCELADA` não gera).
- `notification-message.js`: rótulo do novo evento; extrair o formatador de data `YYYY-MM-DD → dd/mm/aaaa` para reuso.
- Serviço de parâmetros: resolve campo a campo; valor ausente usa o texto humano de fallback já existente; posição sem campo nem texto fixo é erro de vínculo (nunca `-`).
- `whatsapp.js`: `getRuntimeConfig` perde template/variáveis/idioma e os fallbacks de ambiente; `sendCloudApiTemplate` recebe o vínculo; erros de template da Meta (template inexistente, parâmetros divergentes, pausado, desativado) marcam o cache do catálogo como desatualizado. **Confirmar os códigos na documentação oficial da Meta antes de codar.**
- `dispatch-notification.js`: busca o vínculo do evento; sem vínculo → `NOT_CONFIGURED` (cai no e-mail como hoje); template não aprovado no cache → bloqueia e registra o motivo; fluxo legado de `schedule_changed` usa o vínculo de reagendamento.
- `auth-message-delivery.js`: checar status do template de acesso no catálogo antes de enviar.
- Repositório e serviço do catálogo/vínculos (queries `pg` parametrizadas, escopo por `municipality_id`):
  - `POST /api/whatsapp/catalog/sync`: `GET /{WABA}/message_templates` com `fields`, paginação limitada e timeout; limite de frequência por município; normaliza e grava o cache.
  - `GET /api/whatsapp/catalog`.
  - `GET /api/whatsapp/bindings`, `PUT /api/whatsapp/bindings/:event`, `DELETE /api/whatsapp/bindings/:event`.
  - Validação ao vincular: catálogo sincronizado, template existente e **aprovado**, idioma igual ao do catálogo, formato suportado, quantidade do mapeamento = variáveis do template, cada posição com campo do enum ou texto fixo (1 a 200 caracteres).
  - Todos com `auth`, `requireMunicipalAdmin` e município por `pickMunicipalityId`; mudanças e sincronização registradas em auditoria.
- `routes/config.js`: ID da conta WABA na chave `whatsapp`; token cifrado com `config-secret-cipher` (leitura aceita o valor antigo em texto puro; cifra na próxima gravação); `GET /api/config/whatsapp` sem login devolve só `{ active }`. As chaves de catálogo e vínculos **não** entram nas listas genéricas de leitura/escrita.
- `routes/whatsapp.js`: `/test` usa o vínculo de confirmação com dados fictícios.

### Banco de dados

Sem impacto esperado (sem migration). Novas linhas na tabela `config` por município (chaves de catálogo e vínculos), criadas pelo código. Chaves antigas permanecem no JSON e são ignoradas.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

- Chamadas de saída para `graph.facebook.com` (sincronização), com timeout e limite de frequência, dentro de request de admin (poucas páginas; sem job).
- `CONFIG_ENCRYPTION_KEY` passa a ser exigida para salvar o token do WhatsApp (resposta 503 sem ela, como no SMS). **Não alterar `.env` nem configuração do Render; o usuário confirma o ambiente.**
- Remoção dos fallbacks de ambiente `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_CONFIRMATION`, `WHATSAPP_TEMPLATE_LANG` só depois da confirmação da pergunta 1 abaixo.

---

## Arquivos provavelmente afetados

- Novos: `shared/whatsapp-binding-contract.js`; repositório e serviço de catálogo/vínculos em `backend/src/repositories/` e `backend/src/services/`; `backend/test/whatsapp-bindings.test.js`, `backend/test/whatsapp-catalog.test.js`; `src/features/whatsapp-integration/*`.
- Backend: `shared/notification-contract.js`, `backend/src/services/whatsapp.js`, `backend/src/services/notifications/{dispatch-notification,notification-events,notification-message}.js`, `backend/src/services/auth/auth-message-delivery.js`, `backend/src/routes/{whatsapp,config}.js`, `backend/src/repositories/request-settings.js`.
- Frontend: `src/App.tsx` (bloco da aba WhatsApp), `src/domain.ts`, `src/api.ts`, `src/styles.css`, `src/features/notifications/*`, `src/features/tutor-access/auth-delivery-settings.tsx`.
- Testes existentes a atualizar: `backend/test/{notification-dispatch,notification-events,notification-contract,config-security,channel-config,auth-delivery,whatsapp-quota}.test.js`, `src/features/email/email-settings.test.tsx`, `src/features/request-follow-up/follow-up.test.tsx`.

---

## O que será removido

Deve ser **deletado**, não ocultado:

- Campos `confirmationTemplate`, `templateVariables` e `languageCode` da chave `whatsapp`: em `getRuntimeConfig`, `DEFAULT_CONFIRMATION_VARIABLES`, `initialWhatsappSettings`, estado e salvamento em `App.tsx` e nos campos da tela.
- `WHATSAPP_TEMPLATE_VARS` e o `resolveTemplateVariable` antigo (incluindo `phone`).
- `whatsappTemplates` do contrato de notificações (defaults, normalize, validate, merge), seus testes e os 3 campos de nome da aba WhatsApp em `NotificationSettings` e o ramo WhatsApp de `notificationChannelPatch`.
- O ramo `confirmation || legacy ? runtime.templateName : config.whatsappTemplates[event]` e a lista fixa `["protocol", "notification_message"]` em `dispatch-notification.js`.
- Os chips de variáveis e o campo de nome do template de confirmação da tela antiga.
- Fallbacks de ambiente do WhatsApp (sujeito à pergunta 1).
- CSS das classes que ficarem sem uso (verificar por busca em `src/**/*.{ts,tsx}`; **não rodar `scripts/purge-css.mjs`**, que está desatualizado).
- Imports e tipos que ficarem órfãos.
- Dados antigos no banco **não** são apagados (exigiria SQL manual, a ser entregue ao usuário só se ele pedir).

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

Ordem sugerida, com commits independentes. O usuário decide se faz tudo de uma vez ou divide.

1. Confirmar na documentação oficial da Meta: endpoint e campos de `message_templates`, valores de status e códigos de erro de template. Ajustar o plano se algo divergir.
2. Criar `shared/whatsapp-binding-contract.js` e o evento `SCHEDULE_CANCELLED`; extrair o formatador de data; criar o serviço de parâmetros. Testes de contrato e de parâmetros.
3. Fazer `dispatch-notification.js`, o fluxo legado e `/whatsapp/test` usarem vínculos, com os padrões da Meta quando não houver vínculo salvo para confirmação, reagendamento e cancelamento. Testes de dispatch e de eventos.
4. Credenciais: ID da conta WABA, token cifrado, leitura pública reduzida, remoção dos fallbacks de ambiente. Testes de segurança de config.
5. Catálogo: serviço de sincronização, cache por município, endpoints de catálogo e vínculos com validação e auditoria, bloqueio no envio e invalidação por erro da Meta, checagem de status nos templates de acesso. Testes com `fetch` simulado.
6. Frontend: hook, componentes, integração no bloco da aba em `App.tsx`, seleção de templates de acesso, ajustes em `notifications/*`, `domain.ts` e `api.ts`. Testes.
7. Limpeza: tudo de "O que será removido", CSS órfão, testes antigos.
8. Rodar typecheck, testes e build uma vez ao final.

---

## Regras de negócio identificadas

- Eventos com vínculo: confirmação de agendamento, reagendamento, cancelamento (novo), documentos conferidos e concluído.
- Padrões da Meta (ordem das variáveis): `castracao_confirmacao_agendamento` (nome, data, hora, local); `castracao_reagendamento` (nome, nova data, novo horário, local); `castracao_cancelamento` (nome, data cancelada, horário cancelado). Documentos conferidos e concluído não têm template na Meta e ficam sem vínculo até o usuário escolher; sem vínculo, a notificação cai no e-mail.
- Os vínculos começam com os padrões, sem converter nomes antigos digitados à mão.
- Só template **aprovado** pode ser vinculado; qualquer outro status bloqueia o envio e registra o motivo (proteção da qualidade do número).
- A Meta é a fonte da verdade: template novo só aparece após sincronizar e só é usado depois de vinculado a um evento. Evento novo exige código.
- Variável sem campo correspondente: o vínculo não salva sem campo ou texto fixo; nunca se envia `-`.
- Valor ausente no envio usa o texto humano de fallback já existente (ex.: "hora a confirmar").
- Credenciais (token, WABA, número) são por município; catálogo e vínculos também.
- Templates de acesso: formato fixo; só o **nome** é editável, sem mapeamento.
- Cancelamento só notifica em `AGENDADA → CANCELADA`, e só no fluxo de acompanhamento.

---

## Regras multi-tenant e segurança

- Município sempre por `pickMunicipalityId(req)`; nunca confiar em `municipalityId` do corpo. Queries `pg` parametrizadas e escopadas por `municipality_id`.
- Permissão: `auth` + `requireMunicipalAdmin` em todos os endpoints novos; usuário global só com município selecionado, como nas rotas atuais.
- Token cifrado (AES-256-GCM); nunca devolvido em resposta, log ou erro (a API devolve só `hasAccessToken`). Sem chave de criptografia, salvar o token falha com 503.
- `GET /api/config/whatsapp` sem login devolve só `{ active }` (o formulário público de acompanhamento só lê `active`).
- Fim do fallback de token/número do ambiente: um município sem credencial própria não envia mais pela conta global.
- Mensagens de erro genéricas ao cliente; nada de resposta bruta da Meta, token ou stack.
- Catálogo de um município nunca é lido nem validado por outro.
- Sincronização com limite de frequência por município e timeout para não abusar da API da Meta.
- Auditoria de alterações de vínculos e de sincronizações, sem valores de segredo.
- Sem impacto em relatórios ou PDFs.

---

## Validações necessárias

- Vínculo: evento do enum; template existente no catálogo do município; status aprovado; idioma igual ao do catálogo; formato suportado; mapeamento com a mesma quantidade de variáveis; cada posição com campo do enum ou texto fixo (1 a 200 caracteres, sem controle).
- Credenciais: ID da conta e do número numéricos, com tamanho limitado; token de tamanho limitado.
- Sincronização: município com credenciais completas; limite de frequência; resposta da Meta validada (campos esperados, tipos, tamanho do catálogo).
- Params e payloads de `/bindings/:event` validados contra o enum de eventos.
- Telefone do teste: validação existente (`isValidPhone`).

---

## Testes necessários

### Frontend

- Grid de vínculos: vazio, preenchido, template não aprovado, formato não suportado.
- Editor de vínculo: validação de posição sem campo, prévia do corpo.
- Grid do catálogo: estados de status e botão "Sincronizar" (loading, erro, vazio).
- Seleção dos templates de acesso a partir do catálogo.
- Aba de notificações só com e-mail e `notificationChannelPatch` sem WhatsApp.
- Política de acompanhamento continua lendo `active`.

### Backend

- Contrato: validação de vínculo e padrões da Meta.
- Parâmetros: data ISO vira `dd/mm/aaaa`; ausência usa o fallback; nunca sai `-`; quantidade bate.
- Dispatch: confirmação (4), reagendamento (4) e cancelamento (3) parâmetros; sem vínculo → `NOT_CONFIGURED`; template pausado/reprovado bloqueia; isolamento entre municípios.
- Eventos: `AGENDADA → CANCELADA` dispara; `NOVA → CANCELADA` não.
- Catálogo: sincronização com `fetch` simulado (paginação, erro, timeout, limite de frequência); validação ao vincular; invalidação do cache por erro de template.
- Config/segurança: token cifrado e nunca devolvido; leitura sem login só com `active`; 503 sem chave; só admin municipal; chaves de catálogo/vínculos inacessíveis pela rota genérica.
- Templates de acesso: status checado no catálogo antes do envio.

### E2E

- Não há suíte E2E. Conferência manual pelo usuário: sincronizar, vincular os 3 templates padrão, enviar teste, agendar/reagendar/cancelar uma solicitação com acompanhamento ligado.

---

## Comandos de validação sugeridos

```bash
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

Não há lint configurado.

---

## Riscos e pontos de atenção

- Documentação oficial da Meta não confirmada (endpoint, status, códigos de erro): validar antes de codar.
- Verificação empresarial pendente e templates "Em análise": o texto aprovado pode mudar; o sync absorve, mas conferir os padrões quando aprovarem.
- Template de autenticação bloqueado pela Meta: recuperação, confirmação de telefone e acompanhamento por WhatsApp seguem sem sair; o fallback é e-mail.
- Token: apareceu em capturas de tela e é temporário; trocar por token de usuário do sistema antes do uso real. Cifrar exige `CONFIG_ENCRYPTION_KEY` no ambiente.
- Município sem vínculo passa a cair no e-mail; nomes antigos digitados à mão não são convertidos.
- Remover fallbacks de ambiente pode quebrar um ambiente que dependa deles (ver pergunta 1).
- `src/App.tsx` tem cerca de 11 mil linhas: edições pontuais e verificação por busca de cada estado removido.
- Risco de quebrar contrato frontend/backend (config e notificações): atualizar os dois lados e os testes juntos.
- Limite atual da conta: 250 conversas iniciadas pela empresa em 24h até a verificação; o teste de envio consome cota.
- Risco de afetar produção _(commit/push direto em `main`, sem `staging`)_.

---

## Perguntas em aberto

1. **Fallbacks de ambiente:** `WHATSAPP_TOKEN` ou `WHATSAPP_PHONE_NUMBER_ID` estão configurados no Render? Se estiverem, confirmar antes de remover o fallback; senão, remover.
2. **Criptografia do token:** confirmar que `CONFIG_ENCRYPTION_KEY` existe no ambiente (sem ela, salvar o token passa a falhar com 503).
3. **Senha inicial por WhatsApp:** decisão separada sobre cortar ou não; esta reforma não mexe nesse fluxo.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- Confirmação, reagendamento e cancelamento são enviados com a quantidade e a ordem corretas de parâmetros, com data em `dd/mm/aaaa`, e nunca com `-`.
- Cada município tem credenciais, catálogo e vínculos próprios, sem acesso cruzado.
- O catálogo sincroniza com a Meta e mostra nome, idioma, status, categoria, qualidade e formato suportado.
- Só é possível vincular template aprovado e com a quantidade certa de variáveis; template pausado, desativado ou reprovado bloqueia o envio e registra o motivo.
- O token fica cifrado e nunca aparece em resposta ou log; `GET /api/config/whatsapp` sem login devolve só `active`.
- A tela antiga (8 campos de nome e chips) não existe mais, e o CSS e o código órfãos foram removidos.
- Eventos sem vínculo caem no e-mail como antes.
- Typecheck, testes e build passam sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
- Não alterar `.env` nem a configuração do Render.
