# Plano de Implementação: Ajustar cabeçalho (chip redundante) e menu de Configurações (setinhas, Dados Gerais, Integrações)

## Origem

- Especificação: descrita em conversa (sem arquivo `.md` de origem), a partir de dois screenshots do cabeçalho do app (`topbar-context-chip`) e do pedido de reorganizar o menu de Configurações.
- Data do planejamento: `2026-07-27`
- Classificação: `frontend + backend`

## Resumo

Quatro ajustes independentes, mas todos na mesma região da UI (cabeçalho + menu lateral de Configurações):

1. **Cabeçalho**: o chip `.topbar-context-chip` (nome do município/"Bem-estar animal" + bolinha azul decorativa) some para usuários não-globais (gestor `admin_municipal`, normal `analista`/`servidor_publico`), por ser redundante com o nome do município já mostrado no brasão da sidebar. Continua aparecendo para `master`/`suporte`.
2. **Setinha só quando há submenu**: hoje o `ChevronRight` do nível 2 do menu de Configurações é renderizado para todo item, mesmo os que não têm filhos (Criar Usuários, Criar Setores, Permissões, Dados Gerais). Vai passar a aparecer só quando o item realmente tiver submenu.
3. **"Criar Municípios" → "Dados Gerais"**: renomeia o rótulo (mantendo o id interno `municipalities`) e abre a aba para qualquer usuário não-global editar os dados do **próprio** município (hoje é `globalOnly`, só `master`/`suporte` acessam). Campos de identidade/ativação do tenant (Estado, Município, Ativo/Inativo) continuam exclusivos de `master`/`suporte`; usuários municipais editam Contato, Email, Endereço, CEP e Brasão.
4. **Novo item "Integrações"**: WhatsApp (hoje aba de "Configurar Ambiente") e Inteligência Artificial (hoje item de nível 2 global-only) passam a ser submenus de um novo item de nível 2 "Integrações", replicando o padrão que "Configurar Ambiente" já usa para suas abas. Gates de acesso de cada um (WhatsApp por permissão customizada, IA por `isGlobalRole`) não mudam — só a posição no menu muda.

## Escopo

### Dentro do escopo

- Remover `.topbar-context-chip` do cabeçalho para usuários não-globais (`src/App.tsx:875-882`).
- Refatorar `configSidebarItems` para um modelo genérico com `tabs`, e generalizar a renderização do submenu (nível 2/3) para só mostrar `ChevronRight` quando o item tiver filhos visíveis.
- Criar `integrationsConfigTabs` (WhatsApp + IA) e o item de nível 2 `"integrations"` ("Integrações"); remover `whatsapp` de `environmentConfigTabs`.
- Mover os gates de renderização dos painéis de WhatsApp e IA de `configArea === "environment"` / `configArea === "ai_settings"` para `configArea === "integrations"` (+ `configTab`).
- Estender o `useEffect` de default de `configTab` em `ConfigView` para tratar `"integrations"` igual já trata `"environment"`.
- Renomear label `"Criar Municípios"` → `"Dados Gerais"` em `configSidebarItems`, `permissionConfigItems` e no título do painel; remover `globalOnly` desses dois pontos.
- Abrir `configArea === "municipalities"` para usuários não-globais; esconder botão "Cadastrar município" e filtro Ativos/Inativos/Todos para eles; não aplicar filtro de status sobre a lista (evitar que o próprio município "suma" se estiver inativo).
- No modal de edição de município, esconder/travar Estado, Município e o toggle Ativo para quem não é global; manter Contato, Email, Endereço, CEP e Brasão editáveis.
- Backend: `PATCH /municipalities/:id` passa a aceitar usuário não-global, restrito ao próprio `municipalityId` (nunca aceitar o id da URL sem comparar com `req.user`) e restrito ao subconjunto de campos contato/email/endereço/cep/brasão.

### Fora do escopo

- Mudar o gate de acesso da Inteligência Artificial (`isGlobalRole` apenas) — só sua posição no menu muda, não quem pode vê-la. Durante a investigação foi encontrado um helper `canManageAiSettings` (`src/App.tsx:1125-1127`, `isGlobalRole(role) || role === "admin_municipal"`) que parece ter sido criado para esse fim e nunca foi de fato conectado (código morto). Não vou usá-lo nem removê-lo nesta implementação — é um ajuste de escopo diferente, fica registrado aqui para decisão futura do usuário.
- Mudar o gate de acesso do WhatsApp (`allowedConfigItems`/`whatsapp_settings`) — só sua posição no menu muda.
- Backfill de grupos de permissão customizados já salvos para incluírem `municipalities` em `allowedConfigItems` — quem usa grupo de permissão customizado só verá "Dados Gerais" depois de o grupo ser editado para incluir esse item (comportamento padrão de qualquer item novo hoje, não é regressão).
- Redesign visual/CSS além do necessário — as classes reaproveitadas (`config-nav-item`, `config-nav-children`, `config-nav-child`) já são genéricas, não amarradas a "environment".
- Migrations ou alteração de schema (tabela `municipalities` já suporta os campos usados).

## Leitura de contexto

- `/AGENT.md` (regras globais; não há `frontend/AGENT.md`/`backend/AGENT.md` neste repositório — estrutura real é `src/` na raiz + `backend/`).
- `.portal/plans/afinar-sidebar-menu-scroll-fixo.md` — mapeamento da estrutura JSX da sidebar e alerta sobre múltiplas camadas de CSS concorrentes (não mexidas nesta implementação).
- `.portal/plans/ai-settings-por-municipio.md` — precedente direto para abrir uma área `globalOnly` para escopo municipal (usado como referência de padrão, não de código a reaproveitar diretamente, pois aqui o acesso é mais amplo: qualquer usuário não-global, não só `admin_municipal`).
- Investigação de código nesta sessão:
  - `src/App.tsx:150-187` — `menu`, `configSidebarItems`, `permissionMenuItems`, `permissionConfigItems`, `environmentConfigTabs`.
  - `src/App.tsx:699-704` — `visibleConfigSidebarItems`/`visibleEnvironmentTabs` (filtro por `globalOnly` e por `allowedConfigItems` de permissão customizada).
  - `src/App.tsx:736-836` — JSX da sidebar (`.brand`, nav nível 1/2/3, chevron em `813` renderizado sem condição de "tem filhos").
  - `src/App.tsx:870-921` — `<header className="topbar">`, incluindo `.topbar-context-chip` (`875-882`) e `.topbar-municipality-filter` (já restrito a `isGlobalRole`, não faz parte deste plano).
  - `src/App.tsx:960` e `6796`/`6901-6907` — prop `environmentTabs` e `useEffect` que define `configTab` padrão por `configArea` dentro de `ConfigView`.
  - `src/App.tsx:7372-7390` — `openMunicipalityModal` (preenche o form ao editar).
  - `src/App.tsx:7496-7507` — `patchMunicipality` (chama `api.updateMunicipality`).
  - `src/App.tsx:8259-8265` — `configAreaTitle` (título usado por Setores/Permissões/Usuários).
  - `src/App.tsx:8270-8296` — painel "Municípios" (lista + criação), hoje `isGlobalRole` only.
  - `src/App.tsx:8298-8368` — painel "IA externa para documentos", hoje `isGlobalRole` only.
  - `src/App.tsx:8764-...` — painel WhatsApp, hoje `configArea === "environment" && configTab === "whatsapp"`.
  - `src/App.tsx:8611` — checkboxes de `permissionConfigItems` no modal de grupo de permissão.
  - `src/App.tsx:9019-9166` — modal `configModal === "municipality"` (campos Estado/Município/Contato/Email/Endereço/CEP/Brasão/Ativo).
  - `src/App.tsx:1112-1127` — `userRoleLabel`, `canManageAiSettings` (não usado em lugar nenhum — código morto, ver seção "Fora do escopo").
  - `src/utils.ts:11-13` — `isGlobalRole(role) = ["master","suporte"].includes(normalizeText(role))`.
  - `src/components/ui.tsx:24-34` — `ConfigSectionHeader` (já trata `createLabel`/`onCreate` ausentes com graça, não precisa de ajuste).
  - `backend/src/routes/municipalities.js:177-217` — `PATCH /:id`, hoje `if (!isGlobalUser(req.user)) return res.status(403)`.
  - `backend/src/tenant.js:23-45,61-69,109-135` — hierarquia de roles (`GLOBAL_ROLES`, `MUNICIPALITY_ADMIN_ROLE`, níveis operacional/credenciado/público), `isGlobalUser`, `isMunicipalAdmin`, `pickMunicipalityId` (padrão de resolução de município a reaproveitar, não duplicar).

## Impacto por área

### Frontend

- **Modelo de dados do menu** (`src/App.tsx:150-187`): `environmentConfigTabs` perde o item `whatsapp`; novo array `integrationsConfigTabs = [{id:"whatsapp",...}, {id:"ai_settings",..., globalOnly:true}]`; `configSidebarItems` ganha `tabs: environmentConfigTabs` no item `environment`, `tabs: integrationsConfigTabs` num novo item `integrations` ("Integrações"), e o item `municipalities` perde `globalOnly` e vira label `"Dados Gerais"`. `permissionConfigItems` espelha a renomeação de `municipalities` e perde seu `globalOnly`.
- **Helper de visibilidade de abas**: novo helper de módulo (perto de `scopeConfigItems`) tipo `filterVisibleConfigTabs(tabs, currentUser, canUsePermissions, currentPermissionGroup)`, reaproveitando exatamente as duas regras já existentes (`globalOnly` vs `isGlobalRole`; `whatsapp` vs `allowedConfigItems.includes("whatsapp_settings")`), usado tanto para `environment` quanto para `integrations`.
- **JSX da sidebar** (`src/App.tsx:796-832`): trocar a checagem hardcoded `subitem.id === "environment"` por checagem genérica baseada em `subitem.tabs` + `filterVisibleConfigTabs`; o `ChevronRight` de nível 2 só renderiza quando essa lista filtrada tiver ao menos 1 item.
- **`ConfigView`** (`src/App.tsx:6772-6800, 6901-6907`): nova prop `integrationsTabs = integrationsConfigTabs` (espelhando `environmentTabs`); `useEffect` ganha um branch `configArea === "integrations"` com fallback `"whatsapp"`.
- **Gates de painel**: `configArea === "environment" && configTab === "whatsapp"` → `configArea === "integrations" && configTab === "whatsapp"`; `configArea === "ai_settings" && isGlobalRole(...)` → `configArea === "integrations" && configTab === "ai_settings" && isGlobalRole(...)`.
- **Painel "Dados Gerais"** (`src/App.tsx:8270-8296`): remove o gate `isGlobalRole`; para não-globais, `ConfigSectionHeader` sem `createLabel`/`onCreate` e sem `ConfigStatusFilter`; lista usa `municipalities` (prop já vem escopada ao próprio município via `scopedMunicipalities`, ver `src/App.tsx:720-722,943`) sem passar pelo filtro de status.
- **Modal de município** (`src/App.tsx:9019-9166`): para não-globais, Estado/Município viram texto informativo (não `<select>`) e o toggle Ativo some do formulário (permanece `true` implicitamente); Contato/Email/Endereço/CEP/Brasão continuam como estão.
- **Cabeçalho** (`src/App.tsx:875-882`): `.topbar-context-chip` só renderiza se `isGlobalRole(currentUser?.role)`; `.main-reader` permanece no DOM (evita reflow do restante do `topbar-actions`).
- Sem novos hooks de dados/query keys — reaproveita estado (`municipalities`, `aiSettings`, `whatsappSettings`) já carregado hoje.
- Sem testes automatizados de frontend pré-existentes para sidebar/Configurações; validação via Playwright nesta sessão.

### Backend

- **`backend/src/routes/municipalities.js`, `PATCH /:id`** (`177-217`): checagem de acesso passa de `isGlobalUser(req.user)` para `isGlobalUser(req.user) || pertence ao próprio município`, usando o mesmo padrão de `pickMunicipalityId` (`req.user?.municipalityId || req.user?.municipality_id`) comparado a `req.params.id`. Se não for global nem dono do município, `403`.
- Lista de campos aceitos (`["name","state","active","brasao","contact","email","address","cep"]`) passa a depender do papel: `isGlobalUser` mantém a lista completa; não-global fica restrito a `["brasao","contact","email","address","cep"]` — mesmo que o client envie `name`/`state`/`active`/`slug`, o backend ignora esses campos para esse perfil (defesa em profundidade, não confiar só no frontend esconder os campos).
- `GET /admin` (listagem completa) permanece `isGlobalUser` only — não faz parte deste plano (não-globais continuam usando a lista já escopada que vem de `GET /` no boot do app).
- Reaproveitar `isGlobalUser` de `backend/src/tenant.js` — não duplicar lógica de checagem de role.
- Log de auditoria (`logAudit`/`AUDIT_ACTIONS.MUNICIPALITY_UPDATE`) já existe e não precisa mudar — vai continuar registrando `req.user` de quem editou, agora incluindo usuários municipais.

### Banco de dados

`Sem impacto esperado` — todos os campos usados (`brasao`, `contact`, `email`, `address`, `cep`) já existem na tabela `municipalities`.

Atenção: migrations não devem ser executadas sem confirmação explícita do usuário, pois o ambiente atual pode estar apontando para produção. (Não previsto nenhuma migration nesta implementação.)

### Infra/Deploy

`Sem impacto esperado`.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `backend/src/routes/municipalities.js`
- `src/styles.css` (contingente — só se algum ajuste visual pontual for necessário durante a implementação; as classes reaproveitadas já são genéricas)

## Estratégia de implementação

1. `src/App.tsx`: reestruturar `environmentConfigTabs` (remover `whatsapp`), criar `integrationsConfigTabs`, atualizar `configSidebarItems` (adicionar `tabs` em `environment`/novo `integrations`; renomear `municipalities` para "Dados Gerais" sem `globalOnly`) e `permissionConfigItems` (mesma renomeação).
2. `src/App.tsx`: criar helper `filterVisibleConfigTabs` e usá-lo para computar `visibleEnvironmentTabs`/`visibleIntegrationsTabs` no componente `App`.
3. `src/App.tsx`: generalizar o JSX do submenu nível 2/3 (`796-832`) para usar `subitem.tabs` genericamente — chevron condicional, bloco de filhos condicional, sem mais checagem hardcoded de id.
4. `src/App.tsx`: passar `integrationsTabs={visibleIntegrationsTabs}` para `ConfigView`; no `useEffect` de `configTab`, adicionar branch para `"integrations"` com fallback `"whatsapp"`.
5. `src/App.tsx`: atualizar os gates de renderização dos painéis de WhatsApp e IA para `configArea === "integrations"`.
6. `src/App.tsx`: painel "Dados Gerais" — remover gate `isGlobalRole`, esconder criação/filtro de status para não-globais, título "Dados Gerais".
7. `src/App.tsx`: modal de município — esconder Estado/Município (texto informativo) e toggle Ativo para não-globais.
8. `src/App.tsx`: `.topbar-context-chip` condicional a `isGlobalRole`.
9. `backend/src/routes/municipalities.js`: ajustar `PATCH /:id` — autorização (global ou dono do município) e allowlist de campos por perfil.
10. Rodar grep de `globalOnly`, `ai_settings`, `"environment"` e `configAreaTitle` no arquivo inteiro para confirmar que nenhum outro ponto ficou checando o formato antigo.
11. `npm run typecheck` e `npm run build`.
12. Validar com Playwright: login como `master` (chip aparece, IA/WhatsApp em Integrações, Dados Gerais mostra lista completa com botão de criar) e como `admin_municipal`/`analista` (chip some, Dados Gerais mostra só o próprio município sem botão de criar, edição salva e persiste, tentativa de editar outro município via API direta recebe 403).

## Regras de negócio identificadas

- Cada município é um tenant independente; dados de identidade/ativação (nome, estado, ativo/inativo) só podem ser alterados por `master`/`suporte`.
- Usuários internos do município (qualquer papel não-global logado no painel administrativo) podem manter atualizados os dados de contato/marca do próprio município, sem depender de suporte da plataforma.
- WhatsApp e IA são integrações externas — agrupá-las sob "Integrações" é só reorganização de navegação, não muda quem pode configurá-las.

## Regras multi-tenant e segurança

- **Crítico**: `PATCH /municipalities/:id` nunca deve confiar no `municipalityId` vindo do client para usuário não-global — a comparação é sempre `req.user.municipalityId === req.params.id` (dado do token, resolvido pelo middleware `auth`), replicando o padrão já usado por `pickMunicipalityId`/`canManageUser` em `backend/src/tenant.js`.
- Allowlist de campos por perfil aplicada no backend (não só escondida no frontend) — um usuário não-global que chamar a API diretamente não consegue alterar `name`/`state`/`active`/`slug` do próprio município nem de nenhum outro.
- `GET /admin` (lista todos os municípios) continua fechado a `master`/`suporte`; não-globais continuam vendo só o próprio município via a listagem pública já usada hoje.
- Nenhuma mudança em como `apiKey`/segredos são expostos (WhatsApp/IA não são tocados em termos de dados sensíveis, só de posição no menu).

## Validações necessárias

- Usuário não-global só vê e edita o próprio município em "Dados Gerais"; tentativa de `PATCH` em outro `municipalityId` (via chamada direta à API) retorna `403`.
- Campos Estado/Município/Ativo não aparecem editáveis para não-globais; Contato/Email/Endereço/CEP/Brasão salvam e persistem.
- `master`/`suporte` mantêm o comportamento atual completo em "Dados Gerais" (lista, criar, editar todos os campos).
- Chevron de nível 2 não aparece mais em Criar Usuários/Criar Setores/Permissões/Dados Gerais; continua aparecendo em Configurar Ambiente e no novo Integrações.
- WhatsApp e IA renderizam corretamente dentro de "Integrações", com os mesmos gates de acesso de antes (permissão customizada para WhatsApp, `isGlobalRole` para IA).
- Chip do cabeçalho não aparece para não-globais; continua aparecendo para `master`/`suporte`.

## Testes necessários

### Frontend

- Nenhuma suíte automatizada pré-existente para sidebar/Configurações/topbar; validação via Playwright nesta sessão.

### Backend

- Nenhuma suíte automatizada pré-existente para `municipalities.js`; validação manual via chamadas HTTP (ou Playwright) nesta sessão: PATCH como `master` (qualquer município, todos os campos), PATCH como `admin_municipal`/`analista` no próprio município (só campos permitidos), PATCH como não-global em município de terceiro (`403`).

### E2E

- Login `master` → Configurações → confirmar chip no topbar, "Integrações" com WhatsApp+IA, "Dados Gerais" com lista completa e criação funcionando.
- Login `admin_municipal` (ou `analista`) → Configurações → confirmar chip ausente, "Dados Gerais" mostrando só o próprio município, edição de contato/endereço/brasão persistindo, sem campos de Estado/Município/Ativo.
- Conferir setinha (chevron) presente só em itens com submenu, nos dois logins.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Risco de vazamento cross-tenant se a comparação `req.user.municipalityId === req.params.id` for esquecida ou mal implementada no PATCH — é o ponto mais sensível deste plano, exige teste explícito de tentativa de edição cruzada.
- `src/styles.css` tem, em outras áreas da sidebar/topbar, múltiplas camadas de CSS concorrentes sem media query (documentado em `.portal/plans/afinar-sidebar-menu-scroll-fixo.md`); este plano não pretende tocar CSS, mas se algo parecer "não aplicar" visualmente durante a implementação, o motivo provável é uma camada posterior sobrepondo — grep antes de assumir bug de lógica.
- Grupos de permissão customizados existentes não vão mostrar "Dados Gerais" automaticamente até serem editados para incluir `municipalities` em `allowedConfigItems` — comportamento esperado, vale avisar o usuário após a implementação.
- Código morto identificado (`canManageAiSettings`, `src/App.tsx:1125-1127`) fica registrado mas não é tocado nesta implementação — está fora do escopo aprovado.
- Risco de produção: commit/push são feitos direto em `main`, sem `staging`, neste projeto.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — usuário aprovou o plano com a recomendação de campos restritos (Contato/Email/Endereço/CEP/Brasão editáveis para não-globais em "Dados Gerais"; Estado/Município/Ativo continuam exclusivos de `master`/`suporte`) e confirmou que o cabeçalho deve remover o `.topbar-context-chip` inteiro (não só a bolinha) para usuários não-globais.

## Critérios de aceite do plano

A implementação deve ser considerada pronta quando:

- O chip do cabeçalho não aparecer mais para usuários não-globais e continuar aparecendo para `master`/`suporte`.
- O chevron de nível 2 só aparecer em itens de Configurações que realmente têm submenu.
- "Dados Gerais" (ex-"Criar Municípios") estiver acessível a qualquer usuário não-global, mostrando e permitindo editar só os dados do próprio município, com Estado/Município/Ativo travados para esse perfil.
- O backend rejeitar com `403` qualquer tentativa de um usuário não-global editar um município que não é o seu, e ignorar campos fora da allowlist para esse perfil.
- WhatsApp e Inteligência Artificial aparecerem como submenus de "Integrações", mantendo exatamente os mesmos gates de acesso que tinham antes.
- Build e typecheck passarem sem erros novos.
- Validado visualmente em Playwright como `master` e como usuário municipal não-global.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não expandir o escopo para mudar o gate de acesso de IA (`canManageAiSettings`) ou de WhatsApp — só a posição no menu muda, conforme decidido explicitamente.
- Reaproveitar `isGlobalUser`/`pickMunicipalityId` já existentes em `backend/src/tenant.js` — não duplicar lógica de resolução de tenant.
- Reaproveitar o padrão já usado por `environment`/`environmentConfigTabs` para o novo `integrations`/`integrationsConfigTabs` — não inventar uma segunda forma de fazer menu com submenu.
- Manter o id interno `municipalities` (não renomear para inglês agora) para não quebrar grupos de permissão já salvos — só o label visível muda para "Dados Gerais".
- Priorizar o teste de segurança multi-tenant do PATCH (edição cruzada entre municípios) antes de considerar a implementação concluída.
- Validar com Playwright os dois perfis (`master` e usuário municipal não-global) e reportar screenshots antes/depois do cabeçalho e do menu de Configurações.
