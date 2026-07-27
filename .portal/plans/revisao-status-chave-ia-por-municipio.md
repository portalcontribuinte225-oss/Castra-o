# Plano de Implementação: Revisão de status, validação real, criptografia e uso da chave de IA externa

## Origem

- Especificação: descrita em conversa, a partir de investigação de código (Agent Explore) sobre a tela "IA externa para documentos" (Configurações > Integrações), motivada por um screenshot mostrando o campo "Token / chave API" com bolinhas mesmo aparentemente sem chave ativa.
- Data do planejamento: `2026-07-27`
- Classificação: `fullstack` (frontend `src/App.tsx`/`src/domain.ts` + backend `backend/src/routes/ai.js`/`config.js`, persistência reaproveitando o JSONB já existente na tabela `config`, sem nova tabela).

## Resumo

O plano anterior `.portal/plans/ai-settings-por-municipio.md` (isolamento de config de IA por município, com `municipality_id` real e mascaramento de `apiKey`) já foi implementado e confirmado em produção — este plano não repete esse escopo, apenas parte dele como base já funcional.

Uma investigação de código identificou 5 lacunas na tela de config de IA:

1. O toggle "Ativa/Inativa" é um booleano manual, sem qualquer teste real contra a API do provedor — é possível marcar "Ativa" sem nenhuma chave válida configurada.
2. O `<input type="password">` da chave não tem `autoComplete="off"`, permitindo que o navegador faça autofill e mostre bolinhas mesmo quando não há chave salva no banco (causa provável do bug relatado pelo usuário).
3. A chave de API é armazenada em texto plano dentro do JSONB da tabela `config`.
4. Não existe nenhum tracking de uso da IA (nº de chamadas, última chamada) por município.
5. Alterações na config de IA não geram registro em `audit_logs`, diferente de outras configs sensíveis do sistema.

Este plano cobre a correção dos 5 pontos.

## Escopo

### Dentro do escopo

- Validação real e bloqueante da chave ao salvar (chamada de teste contra o provedor selecionado; se falhar, nada é persistido).
- Exibição de status da chave na tela ("Chave válida — testada em DD/MM HH:mm" / "Chave inválida" / "Não testada").
- Correção do autofill do navegador no campo de senha (`autoComplete`).
- Criptografia simétrica (AES-256-GCM) da `apiKey` armazenada na tabela `config` para a key `"ai"`.
- Backfill não-destrutivo: linhas legadas em texto plano continuam funcionando na leitura e são cifradas na próxima escrita (sem migration em massa).
- Contador simples de uso por município (`callCount`, `lastUsedAt`), sem cálculo de custo/tokens.
- Auditoria (`audit_logs`) das alterações na config de IA, sem nunca logar o valor da chave.

### Fora do escopo

- Cálculo de custo em R$/USD ou contagem de tokens (decidido explicitamente como fora do escopo pelo usuário).
- Criptografia de outras chaves além de `ai.apiKey` (ex.: `whatsapp.accessToken`) — não solicitado.
- Correção do bug de digitação em `src/api.ts:75` (`` `\config\${key}` `` em vez de `` `/config/${key}` ``) — identificado durante a investigação, mas não faz parte do pedido original; deixar registrado como observação, não como item do plano.
- Redesign visual da tela além do necessário para exibir os novos status.
- Botão dedicado "Testar chave" separado do "Salvar configuração" (usuário confirmou que o teste ocorre no próprio save).
- Migração para `staging`/PR — este projeto não usa branch `staging`; fluxo é commit direto em `main` (confirmado pela skill `finalizar` e pelos planos anteriores já executados neste repositório, que sobrepõe o fluxo genérico de `staging` descrito no `/AGENT.md` raiz).

## Leitura de contexto

- `/AGENT.md` (regras globais). Nota: este arquivo descreve um fluxo `staging → PR → main` genérico que não reflete a prática real deste repositório (confirmada via `.portal/plans/*` já implementados e via skill `finalizar`, que documenta commit direto em `main` sem `staging`). Seguidas as regras que são universais (não commitar `.env`, não editar migrations antigas, não força-push, lint/typecheck/build antes de concluir, mudanças pequenas e auditáveis), ignorado o fluxo de branch que não se aplica.
- Não há `frontend/AGENT.md` nem `backend/AGENT.md` neste repositório (estrutura real é `src/` para frontend e `backend/src/` para backend, sem AGENT.md próprios).
- `.portal/plans/ai-settings-por-municipio.md` (plano já implementado — base de isolamento por município).
- `backend/src/routes/config.js` — rotas `GET/PUT /config/:key`, `SENSITIVE_CONFIG_KEYS`, `GLOBAL_ONLY_CONFIG_KEYS`, `MUNICIPAL_ADMIN_WRITE_CONFIG_KEYS`, `publicConfigValue`, `prepareConfigValue` (linhas 1-202 lidas por completo).
- `backend/src/routes/ai.js` — `POST /validate`, `resolveAiSettings`, `validateWithGemini`/`validateWithOpenAI`/`validateWithAnthropic`, `providerEnvKeys` (arquivo lido por completo, 397 linhas).
- `backend/src/db/migrations.js:105-116` (schema da tabela `config`, sem `pgcrypto`), `:280-282` (índice composto `key + municipality_id`).
- `backend/src/tenant.js` (helpers `isGlobalUser`, `isMunicipalAdmin`, `pickMunicipalityId` — reaproveitar, não duplicar).
- `src/App.tsx:484-505` (carregamento de `aiSettings` por município), `:7036-7075` (`saveAiCredentials`, estado derivado de provider/model), `:8387-8457` (JSX completo da tela "IA externa para documentos").
- `src/domain.ts:71-86` (`aiProviderOptions`, `initialAiSettings`).
- `src/api.ts:72-77` (`getConfig`/`setConfig`).
- `.env.example` (padrão de documentação de env vars de fallback/plataforma).

## Impacto por área

### Frontend

- `src/domain.ts`: `initialAiSettings` ganha os campos `keyValid: null`, `lastValidatedAt: ""`, `callCount: 0`, `lastUsedAt: ""`.
- `src/App.tsx`:
  - Input da chave (linha ~8438-8443): adicionar `autoComplete="off"` (ou `"new-password"`, a decidir na implementação testando comportamento real dos principais navegadores).
  - `saveAiCredentials` (linha ~7053-7075): tratar resposta de erro 400 do backend (chave inválida) exibindo mensagem específica em `aiSaveStatus`; não atualizar `aiSettings.active` para `true` localmente se o backend rejeitar.
  - Novo bloco de status visual ao lado do `ConfigActiveToggle`: exibir `keyValid`/`lastValidatedAt` formatada (ex. "Chave válida — testada em DD/MM HH:mm").
  - Novo bloco de uso: exibir `callCount`/`lastUsedAt` quando `callCount > 0` (ex. "X validações realizadas — última em DD/MM/AAAA"), abaixo do card de regras ou do botão salvar.
  - Estados de loading: `aiSaveStatus` já existe e cobre "Salvando configuração..." — estender para refletir "Testando chave..." durante a chamada de validação (mesma variável, texto diferente).
- Nenhum novo hook, componente de rota ou query key — a tela já usa `api.getConfig`/`api.setConfig` genéricos.

### Backend

- `backend/src/routes/ai.js`:
  - Extrair um helper reaproveitando `validateWithGemini`/`validateWithOpenAI`/`validateWithAnthropic` para uma chamada de teste mínima (sem arquivo, prompt curto) — usado tanto pelo teste de chave quanto, potencialmente, no futuro.
  - Novo endpoint `POST /ai/test-key` (ou lógica inline chamada a partir de `config.js` antes de persistir — a avaliar durante implementação qual fica mais simples sem duplicar validação de permissão). Autenticado, restrito a `isGlobalUser`/`isMunicipalAdmin` (mesma regra de quem já pode escrever a key `"ai"`).
  - `resolveAiSettings`/incremento de uso: no fluco de sucesso de `POST /validate`, incrementar `callCount` e atualizar `lastUsedAt` na linha de `config` do município via `UPDATE` atômico (não round-trip leitura+escrita via rota genérica, para evitar condição de corrida sob uso concorrente).
- `backend/src/routes/config.js`:
  - `PUT /:key` para `key === "ai"`: quando `value.active === true` (ou quando a chave foi alterada), chamar o teste de chave antes do `INSERT ... ON CONFLICT`. Se falhar, responder `400` com mensagem clara e **não persistir nada** (confirmado com o usuário: bloquear o save inteiro).
  - `prepareConfigValue`: persistir `keyValid`, `lastValidatedAt` no JSON de `value` junto de `apiKey`/`provider`/`model`.
  - Nova lista (ex. `AUDITED_CONFIG_KEYS`, separada de `SENSITIVE_CONFIG_KEYS` porque esta última também controla exigência de autenticação para leitura, o que não deve mudar para `"ai"`) incluindo `"ai"`, disparando `logAudit` com `changes: { key, municipalityId, provider, model, keyChanged: boolean }` — nunca incluir `apiKey` em claro no log.
  - Aplicar `encryptSecret`/`decryptSecret` (novo módulo) ao `apiKey` da key `"ai"` em `prepareConfigValue` (antes de gravar) e em `publicConfigValue`/`resolveAiSettings` (ao ler para uso interno — nunca decifrado sai para o frontend, que já recebe só `hasApiKey`).
- Novo módulo `backend/src/services/config-secret-cipher.js`: `encryptSecret(plainText)`/`decryptSecret(cipherPayload)` usando `crypto` nativo do Node (AES-256-GCM), chave mestra de `process.env.CONFIG_ENCRYPTION_KEY` (32 bytes, base64). Detecção de payload legado (texto plano, sem o formato/prefixo esperado do cifrado) para permitir leitura de dados antigos sem quebrar.
- `backend/src/services/audit.js`: confirmar se `AUDIT_ACTIONS.CONFIG_UPDATE` já cobre esse caso (já usado por outras keys) — reaproveitar, não criar nova action a menos que necessário.

### Banco de dados

Sem alteração de schema (sem nova coluna, sem nova tabela). A tabela `config` já é JSONB (`backend/src/db/migrations.js:112-116`) — os novos campos (`keyValid`, `lastValidatedAt`, `callCount`, `lastUsedAt`, chave cifrada) cabem dentro do `value` existente.

Atenção: migrations não devem ser executadas sem confirmação explícita do usuário, pois o ambiente atual pode estar apontando para produção. Como não há alteração de schema neste plano, não há migration nova a rodar — mas o backfill de criptografia (decriptar-com-fallback na leitura, cifrar na próxima escrita) precisa ser testado cuidadosamente antes de ir para produção, já que mexe na interpretação de dados já existentes.

### Infra/Deploy

- Nova variável de ambiente **obrigatória** em produção: `CONFIG_ENCRYPTION_KEY` (32 bytes, base64), usada pelo backend para cifrar/decifrar `apiKey`. Sem ela configurada no Render, a leitura/escrita da config de IA quebra.
- Documentar em `.env.example` (sem alterar `.env` real, conforme regra do `/AGENT.md`).
- Esta é uma dependência operacional que precisa ser resolvida pelo usuário/infra antes do deploy — fora do alcance de alteração automática de `.env`/infra por este agente.

## Arquivos provavelmente afetados

- `backend/src/routes/ai.js`
- `backend/src/routes/config.js`
- `backend/src/services/config-secret-cipher.js` (novo)
- `backend/src/services/audit.js` (revisão, possivelmente sem alteração se `CONFIG_UPDATE` já servir)
- `src/App.tsx`
- `src/domain.ts`
- `.env.example`

## Estratégia de implementação

1. Backend: criar `backend/src/services/config-secret-cipher.js` com `encryptSecret`/`decryptSecret` (AES-256-GCM, `CONFIG_ENCRYPTION_KEY`), incluindo detecção de payload legado em texto plano.
2. Backend `ai.js`: extrair helper de teste de chave reaproveitando as funções `validateWith*` existentes com payload mínimo; expor via função exportável (não necessariamente uma rota HTTP nova, se `config.js` puder chamá-la diretamente via import).
3. Backend `config.js`: no `PUT /:key` para `"ai"`, antes do `INSERT`, se `value.active === true`, chamar o teste de chave; se falhar, `400` sem persistir; se passar, gravar `keyValid: true`, `lastValidatedAt: now()` junto do resto.
4. Backend `config.js`: aplicar `encryptSecret` em `prepareConfigValue` (grava cifrado) e `decryptSecret` em `resolveAiSettings`/leitura interna (nunca no `publicConfigValue`, que já mascara para `""`).
5. Backend `config.js`: adicionar `"ai"` à lista que dispara `logAudit`, com `changes` só com metadados (nunca a chave).
6. Backend `ai.js`: no fluxo de sucesso de `POST /validate`, `UPDATE` atômico incrementando `callCount`/`lastUsedAt` na linha de `config` do município.
7. Frontend `domain.ts`: estender `initialAiSettings`.
8. Frontend `App.tsx`: `autoComplete="off"` no input da chave; tratamento de erro 400 em `saveAiCredentials`; badge de status da chave; bloco de contagem de uso.
9. Atualizar `.env.example` documentando `CONFIG_ENCRYPTION_KEY`.
10. Rodar validações (lint/typecheck/build) na raiz e em `backend/` conforme scripts disponíveis em cada `package.json`.
11. Testar manualmente: salvar chave válida (deve marcar ativa e mostrar status), salvar chave inválida (deve bloquear e mostrar erro, sem persistir), reabrir tela após salvar (chave cifrada deve ser lida corretamente), usar o fluxo de validação de documento algumas vezes e confirmar que o contador incrementa.

## Regras de negócio identificadas

- Cada município só pode ativar a IA com uma chave própria e validada — não é mais possível marcar "Ativa" sem uma chave que o provedor aceite.
- A chave de API nunca deve ser exposta ao frontend em nenhuma circunstância (nem cifrada, nem em claro) — mantém-se o padrão já existente de `hasApiKey` boolean.
- Alterações na config de IA (troca de provider/model/chave) devem ficar auditáveis por município, sem nunca persistir o valor da chave em `audit_logs`.

## Regras multi-tenant e segurança

- O teste de chave e a atualização de `keyValid`/`lastValidatedAt`/`callCount`/`lastUsedAt` seguem a mesma resolução de `municipality_id` já usada por `resolveAiSettings`/`prepareConfigValue` — nenhuma alteração na origem confiável do tenant.
- A chave de criptografia (`CONFIG_ENCRYPTION_KEY`) é única por ambiente de servidor, não por município — isso é aceitável porque o isolamento entre municípios já é garantido pela linha (`key, municipality_id`) no banco, e a criptografia protege contra leitura direta do banco, não substitui o isolamento de tenant.
- Nunca aceitar `municipalityId` do body para usuários não-globais nesses novos endpoints/lógicas — reaproveitar exatamente `pickMunicipalityId`/`isMunicipalAdmin` já existentes, sem introduzir uma segunda forma de resolver tenant.
- O audit log de `"ai"` não deve, em nenhuma hipótese, incluir `apiKey` (nem cifrada) no campo `changes`.

## Validações necessárias

- Salvar com chave válida → `active: true`, `keyValid: true`, `lastValidatedAt` preenchido, persiste após reload.
- Salvar com chave inválida → erro 400 claro no frontend, nada é persistido (config anterior permanece intacta).
- Salvar sem preencher chave nova (mantendo a já salva) → não deve exigir novo teste redundante se `apiKey` não mudou e `active` já era `true` (a decidir na implementação: só testar quando a chave for alterada ou quando `active` mudar de `false` para `true`, para não gerar custo desnecessário a cada save de provider/model apenas).
- Reabrir a tela após salvar com sucesso → chave cifrada é lida e decifrada corretamente para uso em `POST /validate` (o frontend nunca vê o valor decifrado).
- Linha legada (chave em texto plano, salva antes desta mudança) → continua funcionando na leitura; após qualquer novo save, passa a ser cifrada.
- `admin_municipal` de um município não afeta contador/status de outro município.
- Chamadas reais a `POST /ai/validate` incrementam `callCount` do município correto.

## Testes necessários

### Frontend

- Nenhuma suíte automatizada pré-existente para esta tela; validação manual/Playwright nesta sessão (confirmar autofill não preenche o campo em aba anônima; confirmar mensagens de erro/sucesso).

### Backend

- Nenhuma suíte automatizada pré-existente para `config.js`/`ai.js`; validação manual via chamadas HTTP (chave válida, chave inválida, leitura de linha legada em texto plano, incremento de contador).

### E2E

- Login como `admin_municipal` → Configurações → IA externa → salvar chave inválida → ver erro, nada persistido.
- Mesmo fluxo com chave válida → ver status "Chave válida", reabrir e confirmar persistência.
- Enviar um documento pelo fluxo público/tutor com IA ativa → confirmar que `callCount` incrementa na tela de configuração.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build

npm --prefix backend run lint
npm --prefix backend run typecheck
npm --prefix backend run build
```

(Confirmar quais desses scripts existem de fato em cada `package.json` antes de rodar — ajustar conforme disponibilidade real.)

## Riscos e pontos de atenção

- Cada "Salvar configuração" com `active: true` ou chave alterada dispara uma chamada real e paga ao provedor de IA — mitigar não testando quando nada relevante mudou (ver "Validações necessárias").
- Backfill de criptografia mal implementado pode tornar ilegíveis chaves já configuradas por municípios em produção — mitigado pela estratégia de decriptar-com-fallback (nunca falha ao ler dado legado), mas precisa de teste cuidadoso antes do deploy final.
- `CONFIG_ENCRYPTION_KEY` ausente em produção quebra a config de IA inteira (leitura e escrita) — é uma dependência operacional externa que precisa ser resolvida antes do deploy; comunicar isso claramente e não assumir que já está configurada.
- Risco de custo real: chamadas de teste consomem cota da API do provedor (usuário já confirmou que é aceitável).
- Risco de produção: commit/push direto em `main`, sem `staging` — reforça necessidade de testar bem antes de finalizar.
- Identificado mas fora do escopo: bug de digitação em `src/api.ts:75` (`` `\config\${key}` ``) — não corrigir neste plano, apenas registrar.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — usuário confirmou: (1) bloquear o save inteiro se a validação da chave falhar; (2) aceitar o custo de uma chamada real de teste ao provedor a cada save relevante; (3) tracking de uso só como contagem simples, sem custo/tokens; (4) criptografia da chave no banco.

## Critérios de aceite do plano

- Não é mais possível marcar a IA como "Ativa" sem uma chave testada e aceita pelo provedor selecionado.
- A tela exibe status real da chave (válida/inválida/não testada) com data do último teste.
- O campo de senha não é mais preenchido por autofill do navegador quando não há chave salva.
- A chave de API é armazenada cifrada no banco; dados legados em texto plano continuam legíveis até a próxima escrita.
- A tela exibe contagem de chamadas de IA realizadas e data da última, por município.
- Alterações na config de IA passam a gerar registro em `audit_logs`, sem nunca expor a chave.
- Build e typecheck passam sem erros novos.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Reaproveitar `isMunicipalAdmin`/`pickMunicipalityId`/`isGlobalUser` já existentes em `backend/src/tenant.js` — não duplicar lógica de resolução de tenant.
- Reaproveitar `validateWithGemini`/`validateWithOpenAI`/`validateWithAnthropic` já existentes em `ai.js` para o teste de chave — não duplicar chamadas HTTP aos provedores.
- Reaproveitar o padrão de contador já usado por `whatsapp_quota` (`config.js:189-196`) como referência de estilo para `callCount`/`lastUsedAt`, mesmo sem reaproveitar a mesma key.
- Não alterar `.env` real — apenas documentar a nova variável em `.env.example`.
- Não corrigir o bug de `src/api.ts:75` neste plano (fora do escopo combinado).
- Este projeto não usa `staging`; seguir o fluxo real do repositório (commit direto em `main`, sem PR), conforme já praticado nos planos anteriores.
- Validar manualmente os cenários descritos (chave válida, chave inválida, dado legado, incremento de contador) antes de considerar a implementação concluída.
