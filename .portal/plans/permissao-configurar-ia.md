# Plano de Implementação: Item de permissão "Configurar IA"

## Origem

- Especificação: descrita em conversa, a partir de mapeamento do sistema de permissões (Agent Explore) que identificou que a tela "IA externa para documentos" não tem item de permissão dedicado — é controlada por gate de role fixo (`canManageAiSettings`), diferente das outras 6 áreas de Configurações, que já usam `permission_groups`/`allowedConfigItems`.
- Data do planejamento: `2026-07-27`
- Classificação: `fullstack` (backend `backend/src/routes/config.js` + frontend `src/App.tsx`, sem impacto de schema — a tabela `config` já é JSONB).

## Resumo

Cria o item de permissão granular **"Configurar IA"**. Hoje o acesso à aba "Inteligência Artificial" (dentro de Configurações > Integrações) é hardcoded para `master`, `suporte` e `admin_municipal` via `canManageAiSettings`, sem passar pelo sistema de grupos de permissão — ou seja, um admin municipal não pode delegar essa configuração a outro usuário do seu município. Este plano integra a IA ao mesmo padrão já usado por Configurar Ambiente, Dados Gerais, Criar Usuários, Criar Setores, Permissões e Aba WhatsApp: item em `VALID_CONFIG_ITEMS` (backend) + `permissionConfigItems` (frontend) + gate por `allowedConfigItems` do grupo do usuário, com fallback preservado para quem ainda não usa grupo customizado.

## Escopo

### Dentro do escopo

- Adicionar `"ai_settings"` a `VALID_CONFIG_ITEMS` no backend.
- Adicionar `{ id: "ai_settings", label: "Configurar IA" }` a `permissionConfigItems` no frontend (aparece automaticamente como checkbox no modal de criar/editar grupo).
- Trocar o gate da aba de IA na sidebar (`filterVisibleConfigTabs`) e no painel de conteúdo (linha do `configArea === "integrations" && configTab === "ai_settings"`) para checar `allowedConfigItems` quando o usuário tiver grupo de permissão customizado (`canUsePermissions`), preservando `canManageAiSettings` como fallback para quem não usa grupo.
- Migração automática: grupos de permissão já existentes que hoje permitem `admin_municipal` (isto é, cujo `allowedMenuItems` inclui `"config"`) recebem `"ai_settings"` em `allowedConfigItems` automaticamente, para não quebrar acesso já concedido.

### Fora do escopo

- Qualquer mudança na lógica interna da tela de IA (validação de chave, criptografia, contador de uso) — já implementadas em sessões anteriores, não fazem parte deste plano.
- Criação de novos itens de permissão além de `ai_settings` (ex.: granularidade dentro da própria tela de IA, tipo "só ver status" vs "editar chave") — fora de escopo, não solicitado.
- Alteração do item "Dados Gerais" (`municipalities`) — já está no padrão correto, não precisa de mudança.
- Migração para `staging`/PR — este projeto não usa branch `staging`; fluxo é commit direto em `main`.

## Leitura de contexto

- `/AGENT.md` (regras globais). Nota: descreve fluxo `staging → PR → main` que não reflete a prática real deste repositório (commit direto em `main`, confirmado pelos planos já implementados e pela skill `finalizar`) — seguidas as regras universais (não editar migrations antigas, lint/typecheck/build antes de concluir, mudanças pequenas), ignorado o fluxo de branch inaplicável.
- Não há `frontend/AGENT.md`/`backend/AGENT.md` neste repositório.
- `backend/src/routes/config.js:40-62` (`validatePermissionGroups`, `VALID_MENU_ITEMS`, `VALID_CONFIG_ITEMS`).
- `backend/src/routes/config.js:30-32` (`MUNICIPAL_ADMIN_WRITE_CONFIG_KEYS`, gate de escrita da key `"ai"` — não é o escopo deste plano, mas é o gate irmão a não confundir).
- `src/App.tsx:151-212` (`ConfigTabItem`, `menu`, `environmentConfigTabs`, `integrationsConfigTabs`, `configSidebarItems`, `permissionMenuItems`, `permissionConfigItems`, `filterVisibleConfigTabs`).
- `src/App.tsx:728-744` (`currentPermissionGroup`, `canUsePermissions`, `visibleMenu`, `visibleEnvironmentTabs`, `visibleIntegrationsTabs`, `visibleConfigSidebarItems`).
- `src/App.tsx:1208-1210` (`canManageAiSettings`).
- `src/App.tsx:8396` (gate do painel de conteúdo da tela de IA).
- `src/App.tsx:8710-8739` (modal de criar/editar grupo de permissão — checklist de `permissionMenuItems`/`permissionConfigItems`).

## Impacto por área

### Frontend

- `src/App.tsx:196-203`: adicionar `{ id: "ai_settings", label: "Configurar IA" }` a `permissionConfigItems`. O checkbox aparece automaticamente no modal (`:8728`), sem alterar esse JSX.
- `src/App.tsx:205-212` (`filterVisibleConfigTabs`): estender a condição da aba `ai_settings` para seguir o mesmo padrão já usado pela aba `whatsapp` (linha 209): quando `canUsePermissions` é `true`, exigir `currentPermissionGroup?.allowedConfigItems?.includes("ai_settings")`; quando `canUsePermissions` é `false` (usuário sem grupo atribuído, ou role global), manter o fallback `canManageAiSettings(currentUser?.role)` como está hoje (linha 208) — não remover essa checagem, só torná-la condicional a `!canUsePermissions`.
- `src/App.tsx:8396`: replicar a mesma lógica condicional no gate do painel de conteúdo (hoje só `canManageAiSettings`), para manter a dupla proteção (sidebar oculta a aba + painel não renderiza o conteúdo mesmo se a URL/estado for forçado).
- Nenhum novo componente, hook ou query key — reaproveita 100% a estrutura já existente de `permission_groups`.

### Backend

- `backend/src/routes/config.js:45-47`: adicionar `"ai_settings"` a `VALID_CONFIG_ITEMS`.
- Nenhuma rota nova — a validação de `permission_groups` (`PUT /config/permission_groups`) já aceita o novo item assim que estiver na lista.
- Migração automática dos grupos existentes: ao subir a mudança, rodar uma atualização pontual (via rota já existente `PUT /config/permission_groups`, chamada uma vez com o payload corrigido, ou script único) que adiciona `"ai_settings"` a `allowedConfigItems` de todo grupo cujo `allowedMenuItems` já inclua `"config"`. Não é uma migration de schema — é uma atualização de dado dentro do JSONB já existente na key `permission_groups`. Precisa rodar por município (a key é escopada por `municipality_id`, ver padrão de `MUNICIPAL_ADMIN_WRITE_CONFIG_KEYS`).

### Banco de dados

Sem alteração de schema. A key `permission_groups` já é JSONB (`backend/src/db/migrations.js`) — o novo item cabe dentro do array `allowedConfigItems` já existente em cada grupo.

Atenção: migrations não devem ser executadas sem confirmação explícita do usuário, pois o ambiente atual pode estar apontando para produção. Este plano não requer migration de schema, mas a migração automática de dados (grupos existentes) descrita acima escreve em produção e deve ser feita com cautela — rodar primeiro um `SELECT`/leitura para listar os grupos afetados antes de qualquer `PUT`.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `backend/src/routes/config.js`
- `src/App.tsx`

## Estratégia de implementação

1. Backend: adicionar `"ai_settings"` a `VALID_CONFIG_ITEMS` (`config.js:45-47`).
2. Frontend: adicionar `{ id: "ai_settings", label: "Configurar IA" }` a `permissionConfigItems` (`App.tsx:196-203`).
3. Frontend: em `filterVisibleConfigTabs` (`App.tsx:205-212`), ajustar a condição do item `ai_settings` para: `canUsePermissions ? currentPermissionGroup?.allowedConfigItems?.includes("ai_settings") : canManageAiSettings(currentUser?.role)`.
4. Frontend: replicar a mesma condição no gate do painel (`App.tsx:8396`).
5. Rodar grep por `canManageAiSettings`/`aiSettingsOnly` no projeto inteiro para confirmar que não sobrou nenhum outro ponto checando só o gate antigo.
6. Migração de dados: para cada município com grupos de permissão já existentes (`GET /config/permission_groups` por município), identificar grupos com `"config"` em `allowedMenuItems` e sem `"ai_settings"` em `allowedConfigItems`; atualizar via `PUT /config/permission_groups` incluindo o novo item. Confirmar com o usuário antes de rodar em produção (ver seção de banco de dados).
7. Validar manualmente: (a) usuário com grupo customizado sem `ai_settings` marcado não vê a aba; (b) após marcar o checkbox no grupo, a aba aparece; (c) `admin_municipal` sem grupo atribuído (usando o fallback) continua vendo a aba normalmente; (d) `master`/`suporte` continuam vendo a aba sem depender de grupo.
8. `npm run typecheck` e `npm run build`.

## Regras de negócio identificadas

- Cada item de Configurações deve ser controlável granularmente por grupo de permissão — a IA era a única exceção com gate de role fixo, e este plano corrige isso.
- Usuários sem grupo de permissão customizado atribuído (ou roles globais) continuam usando o comportamento atual baseado em role — o novo item de permissão é aditivo, não remove o fallback existente.
- Grupos de permissão já concedidos a `admin_municipal` não devem perder acesso à IA silenciosamente após esta mudança — daí a migração automática de dados.

## Regras multi-tenant e segurança

- A migração de dados (item 6 da estratégia) deve rodar por `municipality_id`, nunca globalmente — cada município tem sua própria linha de `permission_groups`, seguindo o padrão já usado por todas as outras configs escopadas.
- Nenhuma mudança na resolução de tenant (`pickMunicipalityId`) é necessária — este plano só adiciona um valor a uma lista de validação e ajusta lógica de exibição no frontend.
- Não expor `allowedConfigItems`/grupos de outros municípios — a leitura de `permission_groups` já é escopada por município via mecanismo existente, sem alteração aqui.

## Validações necessárias

- `PUT /config/permission_groups` com `allowedConfigItems: ["ai_settings"]` é aceito (backend).
- `PUT /config/permission_groups` com um item inválido continua sendo rejeitado com 400 (garante que a lista de validação não ficou "aberta" por engano).
- Frontend: grupo sem `ai_settings` → aba de IA não aparece na sidebar nem é acessível diretamente.
- Frontend: grupo com `ai_settings` → aba aparece e o conteúdo renderiza normalmente.
- Frontend: `admin_municipal` sem grupo atribuído → aba continua visível (fallback preservado).
- Frontend: `master`/`suporte` → aba continua visível independente de grupo.

## Testes necessários

### Frontend

- Nenhuma suíte automatizada pré-existente para esta tela; validação manual dos 4 cenários acima.

### Backend

- Nenhuma suíte automatizada pré-existente para `config.js`; validação manual via chamada HTTP de `PUT /config/permission_groups` com e sem `ai_settings`.

### E2E

- Login como `admin_municipal` com grupo customizado sem `ai_settings` → confirmar que a aba de IA não aparece.
- Editar o grupo marcando "Configurar IA" → relogar/recarregar → confirmar que a aba aparece.
- Repetir o mesmo fluxo para um usuário com role `admin_municipal` sem grupo atribuído → confirmar que nunca perdeu acesso (fallback).

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Risco principal: grupos de permissão já existentes não têm `ai_settings` marcado — sem a migração de dados (item 6), qualquer `admin_municipal` usando um grupo customizado perderia acesso à IA no momento do deploy. Migração automática mitiga isso, mas precisa ser executada com cuidado em produção (listar antes de escrever).
- Duas listas mantidas manualmente em arquivos separados (`VALID_CONFIG_ITEMS` no backend, `permissionConfigItems` no frontend) — não há mecanismo que impeça divergência futura; isso já era uma limitação pré-existente do projeto, não introduzida por este plano.
- Risco de produção: commit/push direto em `main`, sem `staging`.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — usuário confirmou: (1) migração automática de acesso para grupos já existentes; (2) nome do item "Configurar IA".

## Critérios de aceite do plano

- Existe um item de permissão `ai_settings` ("Configurar IA") disponível no modal de criar/editar grupo.
- A aba "Inteligência Artificial" passa a respeitar `allowedConfigItems` do grupo do usuário quando aplicável, mantendo o fallback de role fixo para quem não usa grupo customizado.
- Grupos de permissão já existentes com acesso a Configurações (`admin_municipal`) não perdem acesso à IA após o deploy.
- Build e typecheck passam sem erros novos.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Preservar `canManageAiSettings` como fallback — não removê-la, só torná-la condicional a `!canUsePermissions`.
- Seguir exatamente o padrão já usado pelo item `whatsapp_settings` em `filterVisibleConfigTabs` (`App.tsx:209`) como referência de implementação — não criar um padrão novo.
- A migração de dados de grupos existentes (item 6 da estratégia) deve ser confirmada explicitamente com o usuário antes de rodar contra produção — listar os grupos afetados primeiro.
- Este projeto não usa `staging`; seguir o fluxo real do repositório (commit direto em `main`, sem PR).
- Validar manualmente os cenários descritos antes de considerar a implementação concluída.
