# Plano de Implementação: WhatsApp — templates reconhecidos automaticamente, com interruptor

## Origem

- Arquivo de especificação: nenhum arquivo único. Base: a conversa de 2026-11-15, o plano anterior `.plans/reforma-integracao-whatsapp.md` (já implementado nos commits `f54ae23` e `c60ec1c`) e o código do `main`.
- Data do planejamento: `2026-11-15`
- Classificação: `frontend + backend` (sem migration; tudo fica na tabela `config`, em JSON)

---

## Resumo

O modelo atual (vínculo evento → template com mapeamento de variáveis, editor, texto fixo e prévia) é **substituído** por: o sistema reconhece cada template da Meta pelo nome e pela estrutura das variáveis, e o usuário só liga ou desliga. Cada aviso usa um template por vez. Os templates de acesso (senha, códigos) entram na mesma lista. Não há tela de configuração de variáveis.

Motivo: o usuário não quer configurar nada ao criar um template na Meta. A convenção de nome e de ordem das variáveis leva a informação "para qual aviso" e "o que é cada `{{n}}`" para dentro do próprio template.

Tela, de cima para baixo: barra de status, credenciais, teste de envio (com a lista de variáveis ao lado do número), templates da Meta, contrato e cota (no fim).

---

## Escopo

### Dentro do escopo

- Contrato shared novo (usos, reconhecimento, templates ativos) e parser da Meta com fatos estruturais.
- Serviço de templates ativos e serviço único de envio de template.
- Dispatch de avisos, envio de acesso, recuperação de senha e rota de teste passando a usar esses serviços.
- Rotas `GET /templates`, `POST /templates/sync`, `PUT /templates/active`.
- Unificação dos templates de acesso no mesmo armazenamento (remove `whatsappTemplates` de `auth-contract`).
- Tela: tabela com interruptor, lista de variáveis, sincronização ao abrir, extração da aba do `App.tsx` para a feature, layout novo.
- Remoção de tudo que o desenho antigo deixa sem uso; testes; atualização do plano anterior e do spec.

### Fora do escopo

- Variáveis com nome (`{{nome_tutor}}`): o envio com `parameter_name` não foi confirmado; fica para depois.
- Tela de mapeamento manual ou "Definir uso".
- Webhook da Meta (`message_template_status_update`).
- Aviso novo, dado novo ou canal novo (exigem código próprio).
- Decisão sobre cortar a senha inicial por WhatsApp: segue como está.
- Subir a versão do Graph de v21 para v25 (só se o teste real pedir).
- Chave de criptografia, reinício do backend e credenciais do ambiente local (pendências operacionais, não de código).

---

## Leitura de contexto

- `/AGENT.md` (único AGENT.md do projeto).
- `.plans/reforma-integracao-whatsapp.md` e `.plans/integracao-whatsapp-vinculos-templates.md`.
- `shared/whatsapp-binding-contract.js`, `notification-contract.js`, `auth-contract.js`.
- `backend/src/services/{whatsapp,whatsapp-bindings,whatsapp-catalog,whatsapp-graph-templates,whatsapp-credentials}.js`, `notifications/{dispatch-notification,whatsapp-template-parameters,notification-message}.js`, `auth/{auth-message-delivery,recovery-channels}.js`.
- `backend/src/routes/{whatsapp,whatsapp-templates,config}.js`, `repositories/whatsapp-templates.js`.
- `src/features/whatsapp-integration/*`, `src/features/tutor-access/auth-delivery-settings.tsx`, `src/features/email/*`, `src/components/ui.tsx`, `src/api.ts`, `src/domain.ts`, bloco da aba WhatsApp e seu estado em `src/App.tsx`.
- Conferência de leitura na Meta real (2026-11-15): token com as permissões certas, número conectado, 4 templates lidos; a API aceita o campo `parameter_format` nas versões v21 e v25 e os 4 templates são `POSITIONAL`.

---

## Impacto por área

### Frontend

- Tabela de templates (`Template | Status | Aviso | Ativo`): interruptor, cadeado quando não pode ligar (não aprovado ou fora do padrão), "⚠ Fora do padrão" com o motivo numa linha. Sem detalhes expansíveis, sem editor.
- Coluna "Aviso": ao passar o mouse mostra a ordem das variáveis daquele aviso (vem do contrato shared).
- Lista "Variáveis": painel só de consulta (parece um select, não seleciona nada), ao lado do número do teste de envio. Só os nomes dos 11 campos, sem exemplos.
- Hook: carrega a lista, liga/desliga, sincroniza. Sincroniza ao abrir se a última sincronização tem mais de 10 minutos, desde que haja credenciais; ignora em silêncio o erro de credenciais ausentes e o 429.
- Extrair a aba WhatsApp do `App.tsx` (JSX, estado e handlers de credenciais, teste, cota e status) para `src/features/whatsapp-integration/`, **sem mudar o comportamento**. `Field`, `ConfigActiveToggle` e `PanelHeader` já são exportados de `src/components/ui.tsx`.
- `AuthDeliverySettings` e `useAuthDeliverySettings` passam a ser só e-mail (sem prop `channel` para WhatsApp nem `catalogTemplates`).
- Estados: carregando, erro com nova tentativa, vazio ("Sincronize para listar os templates"), sem município, somente leitura.

### Backend

- **Contrato shared** `whatsapp-templates-contract.js` (substitui `whatsapp-binding-contract.js`):
  - mantém `WhatsappTemplateField` e `whatsappFieldLabels`;
  - define os usos (ver "Regras de negócio") e a função única de reconhecimento;
  - normaliza o armazenamento de ativos: `{ active: { <uso>: { name, language } } }`.
- **Parser da Meta:** pede `parameter_format`; guarda fatos estruturais do template (formato dos parâmetros, quantidade de variáveis distintas e se são sequenciais, tipo de cabeçalho, botões e se têm variável, componentes extras, categoria); corrige a contagem de `{{n}}` repetido (conta o maior índice, não as ocorrências). O catálogo no formato antigo é ignorado na leitura e refeito na próxima sincronização.
- **Serviço de templates ativos:** lista os templates com o estado calculado no servidor (usos reconhecidos, motivo, ativo, pode ligar), liga/desliga, garante um template por uso, mostra como bloqueado o ativo que sumiu da Meta ou mudou de estrutura.
- **Serviço único de envio:** `resolver` (ativo? reconhecido? aprovado?) e `enviar` (Cloud API + registro do erro da Meta no cache). A cota continua sendo consumida pelo chamador, entre as duas etapas, para preservar a ordem atual.
- **Chamadores:** `dispatch-notification`, `auth-message-delivery`, `recovery-channels` e `routes/whatsapp.js` (`/test`) passam a usar o serviço único; `templateIsUsable` e as checagens soltas saem.
- **Parâmetros:** `buildBodyComponents` recebe a lista de campos do uso (sem mapeamento livre nem texto fixo).
- **Rotas:** `GET /api/whatsapp/templates`, `POST /api/whatsapp/templates/sync`, `PUT /api/whatsapp/templates/active` (corpo `{ name, language, active }`), todas com `auth` + `requireMunicipalAdmin` e município por `pickMunicipalityId`. Auditoria com ação nova (`WHATSAPP_TEMPLATE_UPDATE`, no lugar de `WHATSAPP_BINDING_UPDATE`).
- **Auth:** `shared/auth-contract.js` perde `whatsappTemplates` (default, normalize, merge e validate).

### Banco de dados

Sem impacto esperado: nenhuma migration. Nova chave `whatsapp_active_templates` por município na tabela `config`. A chave `whatsapp_bindings` e o `whatsappTemplates` de acesso ficam órfãos no JSON e são ignorados. A feature é nova e não há dado de produção a migrar; se houver, a limpeza é um SQL manual que será entregue ao usuário, sem executar.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado. Nenhuma variável nova. A sincronização ao abrir chama a Meta no máximo uma vez a cada 10 minutos por abertura de tela, mais o limite de 30 segundos por município que já existe no servidor.

---

## Arquivos provavelmente afetados

- **Shared:** `shared/whatsapp-templates-contract.js` (novo, substitui `whatsapp-binding-contract.js`), `shared/auth-contract.js`.
- **Backend novos:** `services/whatsapp-active-templates.js`, `services/whatsapp-template-sender.js`.
- **Backend alterados:** `services/whatsapp-graph-templates.js`, `services/whatsapp-catalog.js`, `services/notifications/whatsapp-template-parameters.js`, `services/notifications/dispatch-notification.js`, `services/auth/auth-message-delivery.js`, `services/auth/recovery-channels.js`, `routes/whatsapp-templates.js`, `routes/whatsapp.js`, `services/audit.js`.
- **Front novos:** `whatsapp-integration-tab.tsx`, `whatsapp-credentials.tsx`, `use-whatsapp-credentials.ts`, `whatsapp-quota.tsx`, `use-whatsapp-quota.ts`, `whatsapp-templates-table.tsx`, `whatsapp-variables-list.tsx` (todos em `src/features/whatsapp-integration/`).
- **Front alterados:** `use-whatsapp-templates.ts`, `whatsapp-integration-types.ts`, `whatsapp-template-display.ts`, `whatsapp-templates-panel.tsx` (ou absorvido pela aba), `src/features/tutor-access/{auth-delivery-settings.tsx,use-auth-delivery-settings.ts}`, `src/features/email/email-settings.tsx`, `src/api.ts`, `src/App.tsx`, `src/styles.css`.
- **Testes:** `backend/test/{whatsapp-templates,whatsapp-credentials}.test.js` (novos, dividem o atual `whatsapp-bindings.test.js`), `whatsapp-catalog`, `notification-dispatch`, `auth-delivery`, `recovery-options`, `channel-config`, `config-security`, `notification-transports`; `src/features/whatsapp-integration/whatsapp-integration.test.tsx` (reescrito) e `src/features/email/email-settings.test.tsx`.
- **Docs:** `.plans/reforma-integracao-whatsapp.md` (marcar como substituído por este plano), `.plans/integracao-whatsapp-vinculos-templates.md` (reescrever sem a tabela de fases e com o novo modelo).

---

## O que será removido

Deletar, não ocultar:

- **Front:** `whatsapp-bindings-grid.tsx`, `whatsapp-binding-editor.tsx` e `whatsapp-catalog-grid.tsx`; `describeBinding`, `bindableTemplates` e `renderTemplatePreview`; o canal WhatsApp e a prop `catalogTemplates` de `AuthDeliverySettings` (e `AuthTemplateChannel`/`authChannelPatch` do WhatsApp); `getWhatsappCatalog`, `syncWhatsappCatalog`, `getWhatsappBindings`, `saveWhatsappBinding`, `removeWhatsappBinding` de `api.ts`; o JSX da aba e o estado de credenciais, teste e cota no `App.tsx` (movidos, não duplicados); o CSS do editor, do mapeamento, da prévia e do que ficar sem uso no layout de duas colunas.
- **Shared:** `whatsapp-binding-contract.js`, `WhatsappMappingKind`, o texto fixo, `normalizeWhatsappBinding(s)`, `validateWhatsappBindingInput`, `buildDefaultWhatsappBindings`, `whatsappFieldExamples`, `whatsappEventLabels`; `whatsappTemplates` em `auth-contract.js`.
- **Backend:** `services/whatsapp-bindings.js`; rotas `/bindings*` e `/catalog*`; do catálogo, os campos `bodyText`, `supported`, `unsupportedReason` e `variableCount`; `loadAccessTemplate` e `findCatalogTemplateByName`; `templateIsUsable` e as checagens duplicadas; `WHATSAPP_BINDINGS_CONFIG_KEY`; `AUDIT_ACTIONS.WHATSAPP_BINDING_UPDATE` e `WHATSAPP_CATALOG_SYNC` se renomeadas.
- **Fora do código, só com OK do usuário:** as 4 variáveis `WHATSAPP_*` do `.env.example`.
- **Não tocar:** o `.env` e a linha `Token=` que o usuário colocou nele.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`. O `styles.css` tem regras duplicadas em vários pontos: procurar **todas** as ocorrências de cada classe removida antes de dar a remoção por concluída; não rodar `scripts/purge-css.mjs`.

---

## Estratégia de implementação

1. **Contrato shared:** usos (aviso e acesso) com chave, rótulo, parte do nome e estrutura esperada; reconhecimento; normalização dos ativos; função `pode ser usado` (reconhecido e aprovado). Testes puros.
2. **Parser e catálogo:** campos estruturais, `parameter_format`, contagem corrigida; leitura que descarta o formato antigo. Testes com respostas simuladas (inclui os 4 templates reais, o de autenticação e casos de borda).
3. **Serviços de backend:** templates ativos, envio único; migrar `dispatch-notification`, `auth-message-delivery`, `recovery-channels` e `/test`; rotas novas; auditoria. Remover `whatsapp-bindings.js` e as rotas antigas.
4. **Auth:** remover `whatsappTemplates` do contrato e das leituras; ajustar `AuthDeliverySettings` para e-mail.
5. **Front, dados:** hook com sincronização ao abrir; `api.ts`.
6. **Front, tela:** tabela, lista de variáveis, aba extraída do `App.tsx` (credenciais, teste com a lista de variáveis, templates, contrato e cota por último); CSS.
7. **Limpeza:** tudo de "O que será removido"; renomear ações de auditoria; atualizar plano anterior e spec.
8. **Validação:** `typecheck`, `vitest`, `node --test`, `build` (uma vez ao final). Com autorização do usuário, uma leitura na Meta real para conferir o reconhecimento. Sem verificação visual, salvo pedido.
9. **Entrega:** um commit (o contrato shared muda junto com o front), mensagem em inglês no padrão Conventional Commits.

---

## Regras de negócio identificadas

- Um **uso** é um aviso do sistema (chave = valor de `NotificationEvent`) ou uma finalidade de acesso (chave = valor de `AuthPurpose`). Cada uso tem no máximo um template ativo por município.
- **Nome:** `castracao_<parte>` com sufixo opcional `_v<número>`. Partes:
  - `confirmacao_agendamento` (confirmado), `reagendamento` (alterado), `cancelamento` (cancelado);
  - `documentos_conferidos`, `atendimento_concluido`;
  - `codigo` (um mesmo template serve recuperação de senha, confirmação de telefone e acompanhamento);
  - `contato_alterado`, `senha_inicial`.
- **Variáveis numeradas, ordem fixa por aviso:**
  - confirmado e alterado: nome do tutor, data, horário, local;
  - cancelado: nome do tutor, data, horário;
  - documentos conferidos e concluído: protocolo, mensagem do aviso.
- **Acesso:**
  - códigos: categoria autenticação, corpo com 1 variável e botão de código (copiar);
  - contato alterado: 1 variável (nome);
  - senha inicial: 2 variáveis (nome e senha temporária).
- **Estrutura aceita:** parâmetros numerados (`POSITIONAL`), variáveis sequenciais, cabeçalho ausente ou de texto sem variável, botões só de resposta rápida, telefone ou link sem variável (no acesso por código, o botão de código). Qualquer outra estrutura aparece como "Fora do padrão" com o motivo.
- **Ligar** exige template reconhecido e aprovado. **Desligar** só remove da lista de ativos (não há "vínculo guardado"). Ligar uma versão nova desliga a anterior do mesmo uso.
- **Padrão desligado:** sem template ativo para o uso, o envio dá `NOT_CONFIGURED` e o aviso segue por e-mail, como hoje. Não há mais template padrão "ativo" por omissão.
- **No envio:** bloqueia (`TEMPLATE_UNAVAILABLE`, antes de consumir cota) quando o ativo não está aprovado, saiu da Meta ou mudou de estrutura. Erros de template da Meta continuam sendo guardados no cache até a próxima sincronização.
- A lista de variáveis disponíveis são os 11 campos de hoje (nome do tutor, protocolo, data, horário, local, endereço, link do endereço, nome do animal, espécie, município, mensagem do aviso). CPF, telefone e contatos não existem como variável, de propósito.
- Resultado esperado na conta real: os 3 `castracao_*` reconhecidos (com cadeado até aprovarem) e `3p_direct_integration_test_template` como "Fora do padrão: o nome não indica um aviso do sistema".

---

## Regras multi-tenant e segurança

- Município sempre por `pickMunicipalityId(req)`, nunca do corpo; consultas `pg` parametrizadas e escopadas por `municipality_id`; catálogo e ativos são por município.
- Permissão: `auth` + `requireMunicipalAdmin` em todas as rotas novas; globais só com município informado, como nas rotas atuais.
- Ligar/desligar e sincronizar são auditados, sem segredo no registro.
- Erros ao cliente são mensagens genéricas em português, sem resposta bruta da Meta, token ou stack.
- A unificação dos templates de acesso mexe em recuperação de senha, confirmação de telefone e acompanhamento: manter o comportamento de segurança existente (não oferecer o canal sem template ativo, não enviar código expirado, não vazar destino) e cobrir com testes.
- O token continua só nas credenciais cifradas por município. Nenhum script ou teste deve imprimir o token.

---

## Validações necessárias

- `PUT /templates/active`: `name` e `language` strings limitadas, `active` booleano; template precisa existir no catálogo do município; para ligar, reconhecido e aprovado.
- Reconhecimento: nome (regex fechada), formato dos parâmetros, variáveis sequenciais, cabeçalho, botões, componentes.
- Sincronização: credenciais completas (token e WABA); resposta da Meta validada (tipos e tamanho); limite de frequência mantido.
- Armazenamento de ativos: só chaves de uso conhecidas; nome e idioma limitados.

---

## Testes necessários

### Frontend

- Tabela: aprovado ligável, em análise com cadeado, fora do padrão com motivo, ativo bloqueado (pausado/removido), vazio, carregando, erro com nova tentativa, sem município, somente leitura.
- Lista de variáveis: mostra os 11 nomes e não seleciona nada.
- Hook: sincroniza ao abrir só quando passou de 10 minutos e há credenciais; ignora erro de credenciais ausentes e 429.
- Aba: ordem das seções (credenciais, teste com variáveis, templates, contrato e cota por último) e comportamento de credenciais, teste e cota preservado.
- `AuthDeliverySettings` só e-mail; `email-settings` atualizado.

### Backend

- Reconhecimento: cada aviso e cada uso de acesso, versões `_v2`, nomes fora do padrão, variáveis nomeadas, cabeçalho com mídia, botão com variável, `{{1}}` repetido, template de autenticação com botão de código.
- Ativos: ligar exige aprovado e reconhecido; ligar a versão nova desliga a anterior; desligar remove; ativo ausente da Meta fica bloqueado; isolamento entre municípios.
- Envio: sem ativo → `NOT_CONFIGURED`; não aprovado ou mudou → `TEMPLATE_UNAVAILABLE` antes da cota; erro de template da Meta atualiza o cache sem vazar resposta; parâmetros na ordem do aviso (4/4/3/2/2).
- Dispatch, acesso, recuperação (canal WhatsApp só com template ativo) e `/test` usando o serviço único.
- Rotas: autenticação e papéis, municípios forjados, sincronização com `fetch` simulado, limite de frequência, auditoria.
- `auth-contract` sem `whatsappTemplates`; `config-security` e `channel-config` atualizados.

### E2E

Não há suíte E2E. Conferência manual do usuário: sincronizar, ver os 4 templates, ligar o de confirmação quando aprovado, "Enviar teste" para o próprio número.

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

- **Recuperação de senha e login:** unificar os templates de acesso é a parte mais sensível; exige testes de regressão nos fluxos de recuperação e de confirmação de telefone.
- **Sem editor:** um template fora do padrão não pode ser usado; a saída é criar uma versão compatível na Meta (o nome de um template não muda depois de criado).
- **Convenção de nome acoplada ao projeto:** o prefixo `castracao_` vale para todos os municípios.
- **Ativo que some ou muda:** fica ligado e bloqueado, com aviso na tela, até o usuário desligar ou corrigir na Meta.
- **Sincronizar ao abrir:** uma chamada à Meta por abertura (no máximo a cada 10 minutos).
- **Extração da aba do `App.tsx`:** mover estado e handlers sem mudar mensagens nem validações; conferir cada referência removida por busca.
- **Envio real nunca exercitado:** os 3 `castracao_*` estão em análise na Meta; o primeiro envio real só acontece depois da aprovação.
- **Estrutura de autenticação:** aceita só o botão de código (copiar); formatos de autoverificação ficam como "Fora do padrão".
- **Produção:** o push vai direto para `main`, sem `staging`.

---

## Perguntas em aberto

Decisões assumidas ao aprovar este plano (o usuário pode reabrir):

1. Unificar os templates de acesso no mesmo armazenamento: **sim**.
2. Começar com tudo desligado: **sim**.
3. Ordem das variáveis ao passar o mouse na coluna "Aviso": **sim**.
4. Extrair a aba do `App.tsx`: **sim**.
5. Senha inicial por WhatsApp: **manter como está**.
6. Lista "Variáveis" como painel que parece um select: **sim**.
7. Subir o Graph de v21 para v25: **não**.

Pendências operacionais fora deste plano: chave de criptografia válida e reinício do backend local; credenciais da conta real no município de teste; aprovação dos templates na Meta.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- Criar um template na Meta, sincronizar e vê-lo reconhecido (ou "Fora do padrão" com o motivo) funciona sem tocar no código.
- O usuário liga e desliga sem configurar variáveis; só um template por aviso fica ativo.
- Sem template ativo, o aviso segue por e-mail; template não aprovado, removido ou alterado é bloqueado antes de consumir cota.
- Os templates de acesso aparecem na mesma lista e recuperação, confirmação de telefone e acompanhamento só oferecem WhatsApp com template ativo.
- A tela segue a ordem: credenciais, teste de envio com a lista de variáveis, templates, contrato e cota.
- Não sobra código, rota, chave de config, campo de catálogo, CSS ou teste do modelo antigo (vínculo, mapeamento, editor, prévia, `whatsappTemplates` de acesso).
- A aba WhatsApp deixa de ter estado próprio no `App.tsx`.
- `typecheck`, testes e build passam sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto; seguir `/AGENT.md`.
- Não executar migrations nem SQL sem confirmação explícita; não alterar `.env` (nem a linha `Token=`) nem a configuração do Render.
- O `.env.example` só com OK explícito do usuário.
- Não imprimir o token em nenhum comando, teste ou log. A leitura na Meta real só com autorização do usuário no momento.
- Manter o comportamento atual de credenciais, teste de envio e cota ao extrair a aba.
- Deletar tudo que está em "O que será removido"; atualizar testes conforme descrito; um commit só.
- Não enviar mensagem real sem pedido explícito e sem o número informado pelo usuário.
