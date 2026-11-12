# Plano de Implementação: Filtros multi-seleção na tela de Solicitações

## Origem

- Arquivo de especificação: conversa com o usuário (screenshot da tela "Solicitações" + proposta de drawer de filtros com multi-seleção por **tipo de solicitação**, **usuário (responsável)** e **status**), sem `.md` de feature associado
- Data do planejamento: `2026-11-12`
- Classificação: `frontend-only`

Motivo da classificação: `GET /api/requests` já devolve a lista completa do tenant ([requests.js:118-130](../../backend/src/routes/requests.js#L118-L130)), a tela já filtra no cliente, e `assignedUserId` já é gravado em `workflow_data` pelo `PATCH /api/requests/:id` ([requests.js:325-336](../../backend/src/routes/requests.js#L325-L336)). Não há endpoint, schema nem migration a criar.

---

## Resumo

A tela tem hoje 7 chips de etapa + "Hoje" (8 controles), todos filtrando só por etapa do fluxo, sem nenhum filtro por tipo ou responsável. A implementação:

1. Troca os 7 chips por **5 chips** (Novas, Em análise, Agendadas, Encerradas, Todas) que são **atalhos (presets)** de um único estado de filtros.
2. Mantém o botão **Hoje** e adiciona um botão **Filtros** (com contador) que abre um **drawer lateral** com três grupos multi-seleção: **Etapa**, **Tipo**, **Responsável**.
3. Combina os filtros com **OU dentro do grupo e E entre grupos**.
4. Mostra os filtros ativos como **pílulas removíveis** abaixo da barra, com "Limpar filtros".
5. Calcula **contadores facetados** (cada chip/opção considera os demais filtros ativos).
6. Ganha estados vazios sensíveis a filtro.

Toda a lógica nasce em um módulo novo e testável (`src/features/request-filters/`), em inglês, e `AdminDashboard` (dentro do `App.tsx` de ~12 mil linhas) só consome esse módulo — o código inline de filtro/abas é deletado.

Riscos principais: camadas de CSS com `!important` no fim do `styles.css` (exigem verificação visual real), regra especial dos cartões de credenciamento, e a adição do `vitest` como devDependency.

---

## Escopo

### Dentro do escopo

- Estado único de filtros `{ stages, types, assignees, todayOnly }` com função pura de filtragem e de contagem.
- 5 chips como presets de etapa + botão "Hoje" (comportamento atual preservado) + botão "Filtros" com contador.
- Drawer lateral com 3 grupos multi-seleção (Etapa, Tipo, Responsável), aplicação imediata, busca interna no grupo Responsável.
- Opção "Sem responsável" no grupo Responsável.
- Barra de filtros ativos (pílulas removíveis por grupo + "Limpar filtros").
- Contadores facetados nos chips, no botão Hoje e nas opções do drawer.
- Estados vazios sensíveis a filtro, com ação "Limpar filtros".
- Testes unitários das funções puras e do reducer (vitest — ver "Decisões assumidas").
- CSS novo, co-localizado, apenas para o corpo do drawer e a barra de pílulas.

### Fora do escopo

- Filtros por espécie, porte, município, intervalo de datas arbitrário.
- Persistência dos filtros entre visitas (`localStorage`/URL) — o estado inicial continua sendo "Novas".
- Fazer a busca global ignorar a etapa selecionada.
- Corrigir o rótulo de `DENUNCIA` em `requestTypeLabel` (hoje aparece cru na coluna Tipo; o filtro mostrará o mesmo texto da coluna).
- Migrar as strings de status/tag (`"NOVA"`, `"ATRIBUIDA"`…) para enums no projeto inteiro (pertence à reescrita — ver `.portal/specs/reescrita-completa-sistema.md`).
- Extrair o drawer da agenda para um componente compartilhado.
- Qualquer alteração em backend, banco, infra, `.topbar` (cabeçalho do admin — nunca mexer) ou nos cartões da lista (`triage-card`).
- Remover/alterar a função `notAttendedRequest` ou qualquer outro código não relacionado de `AdminDashboard`.

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md` — não existem `/frontend/AGENT.md` nem `/backend/AGENT.md` neste repositório (o raiz os cita, mas só ele existe)
- `src/App.tsx` — `AdminDashboard` (~4579-4867), `matchesRequestSearch` (~10514), mapa `ActiveView` (~811-819), escopo por município (`scopedRequests`/`scopedTeams`, ~791-804; props em ~1055-1093), `MunicipalitySelectorChip` (~3028)
- `src/domain.ts` — `normalizeRequest`, `normalizeRequestStatus`, `requestTypeLabel`, `requestHasTag`, `isRequestOnScheduleDate`, `isSameScheduleDate`, `formatScheduleDate`, `statusLabels`, `RequestType`
- `src/features/request-actions.ts` — `assignFromPreview`/`assumeFromPreview` (gravam `assignedUserId`, `responsible`, tag `ATRIBUIDA`), `useRequestActions`
- `src/features/agenda.tsx` — drawer `ag-drawer*` (~757-767)
- `src/components/ui.tsx` — `EmptyState` (aceita `action`/`onAction`)
- `src/utils.ts` — `normalizeText`; `src/types.ts` (`AnyRecord`)
- `src/styles.css` — regras de `.request-nav` / `.request-filter-tabs` / `.request-today-segment` (repetidas em ~10 blocos; camada final com `!important` em ~24300-24409), `.ag-drawer*` (10564-10640, cada classe definida uma única vez), variáveis `--ink-*`, `--selected-bg`, `--selected-ink`, `--ui-border`
- `backend/src/routes/requests.js` — `GET /` e `PATCH /:id`
- `package.json`, `tsconfig.json` (`strict: false`, `isolatedModules: true`), `vite.config.ts`
- `.portal/plans/reorganizar-etapas-tipo-solicitacao.md` (convenções de planos anteriores) e `.portal/specs/reescrita-completa-sistema.md` (direção da reescrita: módulos por domínio, inglês, sem sobreposição de CSS)
- Consulta **somente leitura** ao Postgres local (contagens por `request_type` e por presença de `assignedUserId`/`responsible`) — nada gravado; resultado resumido em "Regras de negócio"

---

## Impacto por área

### Frontend

#### 1. Módulo novo `src/features/request-filters/`

Arquivos (nomes em inglês, kebab-case; cada um ≤ ~250 linhas — se `request-filters.ts` passar disso, dividir em `request-filters.ts` + `request-filter-options.ts`):

| Arquivo | Responsabilidade |
|---|---|
| `request-stage.ts` | `enum RequestStage`, rótulos, `getRequestStage()`, presets dos chips |
| `request-filters.ts` | tipo `RequestListFilters`, default, predicados, `filterRequestItems`, `buildRequestFacetCounts`, `buildTypeOptions`, `buildAssigneeOptions`, `buildActiveFilterPills` |
| `use-request-filters.ts` | `requestFiltersReducer` (puro, exportado) + hook `useRequestFilters()` (fino, `useReducer`) |
| `request-filters-toolbar.tsx` | `<nav className="request-nav">` com chips + Hoje + botão Filtros |
| `request-filters-drawer.tsx` | drawer lateral + grupos de checkbox (grupo Responsável com busca) |
| `active-filters-bar.tsx` | pílulas removíveis + "Limpar filtros" |
| `request-filters.css` | só o corpo/rodapé do drawer e a barra de pílulas |
| `*.test.ts` | testes (vitest) de `request-filters.ts` e do reducer |

#### 2. Etapas derivadas (`request-stage.ts`)

`RequestStage` (enum, valores estáveis em inglês) e a regra de derivação, que **replica exatamente** o `filterTabs` atual ([App.tsx:4649-4694](../../src/App.tsx#L4649-L4694)) sobre o request já normalizado:

| Etapa | Rótulo | Regra |
|---|---|---|
| `INBOX` | Novas | `status === "NOVA"` e **sem** tag `ATRIBUIDA` |
| `ANALYSIS` | Em análise | `status === "NOVA"` e **com** tag `ATRIBUIDA` |
| `SCHEDULED` | Agendadas | `status === "AGENDADA"` e **sem** tag `REAGENDADA` |
| `RESCHEDULED` | Reagendadas | `status === "AGENDADA"` e **com** tag `REAGENDADA` |
| `DONE` | Realizadas | `status === "REALIZADA"` |
| `CANCELED` | Canceladas | `status === "CANCELADA"` |

Usar `requestHasTag` de `domain.ts`. Os literais de status/tag ficam **apenas** neste arquivo, como constantes nomeadas locais (AGENT.md: sem strings mágicas espalhadas).

Presets dos chips (ordem de exibição):

| Chip | Etapas |
|---|---|
| Novas | `[INBOX]` |
| Em análise | `[ANALYSIS]` |
| Agendadas | `[SCHEDULED, RESCHEDULED]` |
| Encerradas | `[DONE, CANCELED]` |
| Todas | `[]` (sem filtro de etapa) |

Um chip está "selecionado" quando `!todayOnly` **e** o conjunto `stages` é igual (ignorando ordem) ao do preset.

#### 3. Estado e predicados (`request-filters.ts`)

```ts
interface RequestListFilters {
  stages: RequestStage[];   // [] = qualquer etapa
  types: string[];          // rótulos de requestTypeLabel(); [] = qualquer
  assignees: string[];      // assignedUserId ou UNASSIGNED_ASSIGNEE_KEY; [] = qualquer
  todayOnly: boolean;
}
// estado inicial: { stages: [INBOX], types: [], assignees: [], todayOnly: false }  (igual ao "Novas" de hoje)
```

Os itens da lista são de **dois tipos**: requests normalizados e adaptadores de credenciamento (`__source: "access_request"`, `visibleAccessRequests` em [App.tsx:4630-4647](../../src/App.tsx#L4630-L4647): sem `assignedUserId`, sem `type`, `tags: []`). Predicados (item `i`, filtros `f`):

- `stageMatch(i, stages)`: se `i` é credenciamento → `stages.includes(INBOX) && stage(i) === INBOX`; senão → `stages.length === 0 || stages.includes(stage(i))`.
- `typeMatch(i, types)`: `types.length === 0 || (!isAccess(i) && types.includes(requestTypeLabel(i)))`.
- `assigneeMatch(i, assignees)`: `assignees.length === 0 || (!isAccess(i) && assignees.includes(i.assignedUserId || UNASSIGNED_ASSIGNEE_KEY))`.
- `todayMatch(i, todayOnly)`: `!todayOnly || (!isAccess(i) && isRequestOnScheduleDate(i, today))`.
- Item visível = `stageMatch && typeMatch && assigneeMatch && todayMatch`.

`today` (string `DD/MM/YYYY`, de `formatScheduleDate(new Date())`) é **injetado** como parâmetro — as funções puras não chamam `Date`.

Resultado: credenciamento só aparece quando "Novas" está explicitamente marcada e não há filtro de Tipo, Responsável nem Hoje — idêntico ao comportamento de hoje (aparecem só na aba "Novas"; nunca em "Todas" nem em "Hoje").

#### 4. Contagens facetadas (`buildRequestFacetCounts`)

- **Chip / opção de Etapa**: itens que satisfazem `typeMatch` e `assigneeMatch` dentro das etapas do chip/opção. **Ignora** `todayOnly` e a seleção atual de `stages` (mantém os números dos chips estáveis, como hoje).
- **Botão Hoje**: itens não-credenciamento agendados para hoje que satisfazem `typeMatch` e `assigneeMatch`, ignorando etapa.
- **Opção de Tipo**: itens que satisfazem `stageMatch`, `assigneeMatch`, `todayMatch` e têm aquele tipo (ignora `types`).
- **Opção de Responsável**: itens que satisfazem `stageMatch`, `typeMatch`, `todayMatch` e têm aquele responsável (ignora `assignees`).
- **Rodapé do drawer** ("Ver N solicitações"): `N = activeRequests.length`.

#### 5. Opções e pílulas (`buildTypeOptions`, `buildAssigneeOptions`, `buildActiveFilterPills`)

- **Universo das opções**: vem da lista **normalizada, antes da busca global** (opções não somem enquanto o usuário digita na busca) **unida** aos valores atualmente selecionados (um valor selecionado que sumiu dos dados continua visível e removível). Os **contadores** vêm da lista **depois** da busca (batem com o que a lista mostra).
- **Tipo**: valores distintos de `requestTypeLabel(request)` (agrupa `Castracao`/`castracao`/`Castração` em uma opção e mostra o mesmo texto da coluna "Tipo"); ordenar por rótulo (`localeCompare("pt-BR")`). Credenciamento não entra.
- **Responsável**: chave = `assignedUserId`. Rótulo = nome em `teams.users` (**todos**, inclusive inativos, pois podem ter solicitações) → fallback `request.responsible` → fallback "Responsável não identificado". Opção especial **"Sem responsável"** (chave `UNASSIGNED_ASSIGNEE_KEY`), sempre a primeira, exibida se existir ao menos um item sem responsável (ou se estiver selecionada). `teams.users` pode ser `undefined` → tratar como `[]`.
- **Pílulas** (uma por grupo, não por valor): `Etapa: …`, `Tipo: …`, `Responsável: …`; mais de 2 valores → 2 primeiros + `+N`. A pílula de **Etapa** só existe quando `stages.length > 0` **e** (`todayOnly` ou nenhum preset de chip é igual a `stages`) — se um chip já representa a seleção, não duplicar. O "✕" limpa só aquele grupo.
- **Contador do botão Filtros** = número de pílulas.

#### 6. Reducer e hook (`use-request-filters.ts`)

Estado do reducer: `{ filters: RequestListFilters; stagesBeforeToday: RequestStage[] | null }`. Ações:

- `selectChip(stages)` → `stages` do preset, `todayOnly = false`, `stagesBeforeToday = null` (igual a hoje: clicar num chip desliga "Hoje").
- `toggleToday`:
  - **liga**: `stagesBeforeToday = stages`, `stages = []`, `todayOnly = true` (igual a hoje: "Hoje" ignora a etapa);
  - **desliga**: `todayOnly = false`; `stages` = os atuais se não vazios (o usuário escolheu etapa no drawer enquanto Hoje estava ligado), senão `stagesBeforeToday ?? []` (volta ao chip anterior, como hoje); `stagesBeforeToday = null`.
- `toggleStage(stage)`, `toggleType(value)`, `toggleAssignee(value)` → alterna pertencimento; **mantém** `todayOnly` (permite "Hoje + Agendadas", E entre grupos).
- `clearDimension("stages" | "types" | "assignees")`.
- `clearAll` → `{ stages: [], types: [], assignees: [], todayOnly: false }` (equivale a "Todas"; **não** volta para "Novas").

O hook expõe `filters` e callbacks estáveis; o reducer é exportado e testado isoladamente (sem React Testing Library).

#### 7. Integração em `AdminDashboard` ([App.tsx:4579+](../../src/App.tsx#L4579))

- Substituir os `useState` de `requestFilter` e `todayOnly` ([4596](../../src/App.tsx#L4596), [4598](../../src/App.tsx#L4598)) por `useRequestFilters()`; manter um `useState` local para `filtersDrawerOpen`.
- Separar `visibleRequests` em dois `useMemo`: `normalizedRequests` (só `normalizeRequest`) e `visibleRequests` (aplica `matchesRequestSearch`). `visibleAccessRequests` e `today` permanecem.
- `listItems = [...visibleRequests, ...visibleAccessRequests]` (ordem preservada: hoje "Novas" lista requests e depois credenciamentos). `activeRequests = filterRequestItems(listItems, filters, { today })`; contagens/opções em `useMemo`.
- Trocar o `<nav className="request-nav">` ([4717-4737](../../src/App.tsx#L4717-L4737)) por `<RequestFiltersToolbar … />`, **mantendo** o wrapper `div.page-toolbar.request-page-controls` e o `div.page-actions` (botão "Criar Solicitação") como estão.
- Renderizar `<ActiveFiltersBar … />` entre o toolbar e `.triage-card-grid`, e `<RequestFiltersDrawer … />` junto aos modais.
- Estado vazio ([4740](../../src/App.tsx#L4740)):
  - visão representável só por chip/Hoje (sem tipo, responsável nem conjunto de etapas customizado): manter os textos atuais (`"Nenhuma solicitação nesta etapa"` / `"Quando houver registros, eles aparecerão aqui."`; e, para Hoje isolado, `"Nenhuma agenda para hoje"` / `"Solicitações sem agendamento para hoje não entram neste recorte."`);
  - qualquer outro caso: título `"Nenhuma solicitação encontrada"`, texto `"Nenhuma solicitação corresponde aos filtros selecionados."`, `action="Limpar filtros"` → `clearAll`.
- Os cartões (`triage-card`), `openCard`, `RequestPreviewModal` e `NewRequest` **não mudam**.

#### 8. UI

- **Toolbar** (reaproveita as classes existentes para herdar o visual já consolidado no fim do `styles.css`):
  ```tsx
  <nav className="request-nav" aria-label="Filtros de solicitações">
    <div className="request-filter-tabs">{/* 5 botões de chip, <span>contagem</span> */}</div>
    <div className="request-today-segment">
      {/* botão Hoje (CalendarDays, aria-pressed) + botão Filtros (SlidersHorizontal, aria-haspopup="dialog",
          aria-expanded, classe "selected" quando houver pílulas, <span>contador</span> só se > 0) */}
    </div>
  </nav>
  ```
  O ícone `SlidersHorizontal` existe no `lucide-react` instalado (`filter` e `list-filter` também).
- **Drawer**: reaproveitar a casca `ag-drawer-overlay`, `ag-drawer`, `ag-drawer-head`, `ag-drawer-head-info`, `ag-drawer-kicker`, `ag-drawer-date` (título), `ag-drawer-close` ([styles.css:10564-10640](../../src/styles.css#L10564-L10640); largura `min(420px, 100vw)` → tela cheia no mobile). Corpo: `request-filters-body` (rolável) com três grupos (Etapa — 6 opções na ordem do fluxo; Tipo; Responsável — com campo de busca quando houver mais de ~6 opções). Opção = `<label><input type="checkbox"> rótulo <small>contagem</small></label>`; opção com contagem 0 e não selecionada fica esmaecida mas selecionável. Rodapé: **Limpar** (`clearAll`) e botão primário **"Ver N solicitações"** (fecha o drawer; singular para N = 1). Aplicação **imediata** (sem botão "Aplicar").
- **Acessibilidade mínima**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; fecha por botão, clique no overlay e `Esc` (listener em `useEffect` somente enquanto aberto); foco inicial no botão de fechar e retorno do foco ao botão Filtros ao fechar. Focus trap completo: fora do escopo.
- **Barra de filtros ativos**: só renderiza se houver pílulas; cada pílula é um `<button>` com "✕" (`aria-label` "Remover filtro …"); ao lado, "Limpar filtros".

#### 9. CSS

- `request-filters.css` (novo), importado por `request-filters-drawer.tsx` e `active-filters-bar.tsx`. Classes com prefixo próprio: `request-filters-body`, `request-filters-group`, `request-filters-group-title`, `request-filters-search`, `request-filters-option` (+ `.is-empty`), `request-filters-footer`, `request-filters-bar`, `request-filter-pill`, `request-filters-clear`. Usar as variáveis existentes (`--ink-50/100/500/700/900`, `--selected-bg`, `--selected-ink`, `--ui-border`) com fallback. **Não** crescer o `styles.css`.
- A ordem de import garante que o CSS novo vem depois do `styles.css` (importado em [App.tsx:55](../../src/App.tsx#L55)); com nomes de classe únicos não há disputa de cascata.
- O `styles.css` tem regras globais/`!important` que podem distorcer `input[type=checkbox]`, o campo de busca e botões dentro do drawer. Se a verificação visual mostrar distorção, confirmar a regra vencedora com `CSS.getMatchedStylesForNode` via CDP (memória `feedback-css-styles-debug`) e corrigir com seletor específico; só usar `!important` se a regra concorrente também usar e isso for confirmado.
- Bug conhecido do projeto: SVG do `lucide-react` pode colapsar para ~1px dentro de flex; se o ícone do botão Filtros sumir, dar `width`/`height` explícitos ao `svg` em CSS.
- Não editar `.topbar`. O overlay do drawer cobre o topbar apenas enquanto aberto.

#### 10. Estados de loading/error/empty

- Sem loading/erro novos (os dados já vêm do estado do `App`). Empty states conforme o item 7. Opção selecionada que sumiu dos dados continua visível e removível (nunca "filtro fantasma" invisível).

### Backend

Sem impacto esperado.

- `GET /api/requests` já retorna a lista completa do tenant (`WHERE municipality_id = $1`, ou tudo para usuário global) — os filtros operam sobre essa lista no cliente, como as abas de hoje.
- `assignedUserId` já é persistido (`workflowKeys` no `PATCH`).
- Nenhuma rota, validação ou permissão nova.

### Banco de dados

Sem impacto esperado.

- Nenhuma tabela, coluna, índice ou migration.
- Dados verificados no Postgres local (somente leitura, agregados): `request_type` ∈ {`ninhada`, `animal_rua`, `ANIMAL_OBITO`, `TROCA_TUTOR`, `DENUNCIA`}; **todas as 14 solicitações com responsável têm `assignedUserId`** (nenhuma só com o nome).
- Para conferir produção (somente leitura, **a ser executado pelo usuário**) ver "Riscos".

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

- Sem env vars, Render, jobs ou storage.
- Observação operacional: `npm run build` derruba o backend local se ele estiver servindo `dist/` — depois do build, conferir `curl localhost:3002/health` e reiniciar se necessário.

---

## Arquivos provavelmente afetados

- `src/App.tsx` — somente `AdminDashboard` (estados, derivações, `<nav>`, estado vazio, imports)
- `src/features/request-filters/request-stage.ts` _(novo)_
- `src/features/request-filters/request-filters.ts` _(novo)_
- `src/features/request-filters/use-request-filters.ts` _(novo)_
- `src/features/request-filters/request-filters-toolbar.tsx` _(novo)_
- `src/features/request-filters/request-filters-drawer.tsx` _(novo)_
- `src/features/request-filters/active-filters-bar.tsx` _(novo)_
- `src/features/request-filters/request-filters.css` _(novo)_
- `src/features/request-filters/request-filters.test.ts` e `use-request-filters.test.ts` _(novos)_
- `package.json` e `package-lock.json` — somente para o `vitest` (ver "Decisões assumidas")
- Backend, banco, infra: nenhum

---

## O que será removido

Tudo abaixo deve ser **deletado**, não comentado nem ocultado. Localizar por identificador (os números de linha podem deslocar):

- Em `AdminDashboard` ([App.tsx:4596-4598](../../src/App.tsx#L4596-L4598), [4695-4697](../../src/App.tsx#L4695-L4697)): os estados `requestFilter` e `todayOnly` (viram o hook), `todayRequests`, `activeTab` e `activeRequests` antigos (reescritos sobre `filterRequestItems`).
- O array `filterTabs` inteiro ([App.tsx:4649-4694](../../src/App.tsx#L4649-L4694)) — a derivação passa para `getRequestStage`.
- O JSX do `<nav className="request-nav">` ([App.tsx:4717-4737](../../src/App.tsx#L4717-L4737)): os 7 chips mapeados e o botão "Hoje" inline.
- O atributo `data-tab` do botão de chip — nenhum CSS ou JS o consome (verificado: única ocorrência é o próprio JSX).
- Os chips de topo "Reagendadas", "Realizadas" e "Canceladas" (continuam existindo como opções do grupo Etapa no drawer).
- Os textos de estado vazio antigos que forem substituídos (item 7 de "Frontend").
- Imports que ficarem órfãos em `App.tsx` (ex.: `CalendarDays` e `isRequestOnScheduleDate`, **se** não tiverem outro uso — conferir com `grep` antes de remover).
- CSS: nenhuma remoção prevista, porque os chips continuam usando `request-filter-tabs`/`request-today-segment`. Se algum seletor ficar realmente órfão, **excluir a regra** (e, se o nome estiver em seletor combinado compartilhado, tirar só o nome da lista) — nunca sobrepor com `!important` ou regra nova.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

Passo a passo para a skill `implementar` (o plano já traz as decisões e os trechos lidos — não reler `AdminDashboard`/`domain.ts` por inteiro; ir aos trechos citados):

1. **Dependência de teste.** Confirmar `engines` do `vitest@^2.1` (`^18 || >=20`; AGENT.md fixa Node `22.17.0`) e instalar como devDependency; adicionar `"test": "vitest run"` em `package.json`. Não alterar `vite.config.ts` (o padrão do vitest — ambiente `node`, glob `*.test.ts` — basta; `domain.ts` e `utils.ts` só importam tipos e um ao outro, então são importáveis em node). Se o usuário vetar a dependência, pular os passos de teste e usar a checklist manual de "Testes necessários".
2. Criar `request-stage.ts` (enum, rótulos, `getRequestStage`, presets de chip).
3. Criar `request-filters.ts` (tipos, default, predicados, `filterRequestItems`, `buildRequestFacetCounts`, opções, pílulas). Funções puras, sem `Date`, sem React.
4. Criar `use-request-filters.ts` (reducer exportado + hook).
5. Escrever os testes de `request-filters.ts` e do reducer; rodar `npm test` até passar.
6. Criar `request-filters-toolbar.tsx`, `request-filters-drawer.tsx`, `active-filters-bar.tsx` e `request-filters.css`.
7. Ligar em `AdminDashboard` e **deletar** tudo de "O que será removido"; conferir imports órfãos com `grep`.
8. `npm run typecheck` e `npm run build` (depois do build, checar `/health` do backend local).
9. Verificação visual (recomendada, pois o `styles.css` tem camadas de `!important`): Chrome headless com `--remote-debugging-port` e `--user-data-dir` **único** em pasta do scratchpad, login com o usuário admin local de desenvolvimento (não registrar credenciais em arquivo), conferir desktop (~1680×830) e mobile (~390 px): toolbar, drawer (abertura, grupos, busca, rodapé), pílulas, estado vazio, "Hoje". **Nunca** encerrar o Chrome por nome de imagem (`taskkill /IM chrome.exe`); encerrar só os processos daquele perfil via PowerShell filtrando `CommandLine` pelo nome único do perfil. Se o usuário preferir validar no navegador por conta própria, pular e entregar instruções de teste manual.

---

## Regras de negócio identificadas

1. **Combinação**: OU dentro de um grupo; E entre grupos (`Etapa` E `Tipo` E `Responsável` E `Hoje`). Grupo vazio = sem restrição.
2. **Etapas** são derivadas de `status` + tags (tabela do item 2 de "Frontend"); o drawer lista as 6 individualmente.
3. **Chips são atalhos**: Novas, Em análise, Agendadas (= Agendadas + Reagendadas), Encerradas (= Realizadas + Canceladas), Todas (= sem filtro de etapa). Estado inicial da tela: "Novas" (igual a hoje).
4. **Hoje**: clicar liga `todayOnly` e limpa a etapa (mostra tudo que tem agenda hoje, em qualquer etapa, como hoje); clicar num chip desliga Hoje; desligar Hoje restaura a etapa anterior (se o usuário não tiver escolhido outra no drawer). No drawer, Hoje pode ser combinado com etapa.
5. **Credenciamento** (`__source: "access_request"`): só aparece com "Novas" explicitamente marcada e sem filtro de Tipo/Responsável/Hoje; nunca em "Todas".
6. **Responsável**: filtra por `assignedUserId` (não pelo texto `responsible`); "Sem responsável" = sem `assignedUserId`. No banco local, 100% dos itens com responsável têm o id.
7. **Tipo**: agrupa pelo rótulo exibido (`requestTypeLabel`); legados (`Castracao`/`castracao`/`Castração`) viram uma opção.
8. **Contadores**: facetados conforme o item 4 de "Frontend"; chips e botão Hoje ignoram `todayOnly`/etapa atual; opções de Tipo/Responsável batem com a lista visível.
9. **Busca global** continua sendo E sobre os filtros (aplicada antes, em `visibleRequests`); o universo das opções ignora a busca.
10. **Limpar** (`clearAll`) = remover tudo (visão "Todas"); não volta para "Novas".
11. Sem persistência: recarregar a página volta para "Novas".

---

## Regras multi-tenant e segurança

- Origem confiável do tenant: o backend já escopa `GET /api/requests` por `municipality_id` (ou lista tudo para usuário global), e `App.tsx` ainda aplica `scopedRequests`/`scopedTeams` por município selecionado ([App.tsx:791-804](../../src/App.tsx#L791-L804)). Os filtros operam **somente** sobre as props `requests` e `teams` já escopadas.
- Prevenção de vazamento entre prefeituras: opções de Tipo e Responsável são derivadas dessas mesmas props — nunca de listas globais; usar `teams.users` recebido por prop (já escopado), não buscar usuários por conta própria.
- Nenhum dado sai do cliente: sem chamadas novas, sem query string/URL com IDs de usuário, sem `localStorage` (evita guardar IDs de usuários no navegador).
- Dados confidenciais: `normalizeRequest` já mascara tutor/CPF de solicitações confidenciais; os filtros não exibem tutor nem CPF.
- Permissões: nenhuma nova; a tela já é restrita pela view `admin`.
- Impacto em relatórios/PDFs: nenhum.

---

## Validações necessárias

- Valores de `stages` só do enum `RequestStage`; `types`/`assignees` só de opções geradas pelos dados (o estado é interno, sem input externo).
- `teams.users` e `requests` podem vir `undefined`/não-array → tratar como `[]` (padrão já usado na tela).
- Opção selecionada que não existe mais nos dados continua visível (drawer + pílula) e removível.
- `today` injetado como `DD/MM/YYYY` no mesmo formato de `formatScheduleDate`/`isRequestOnScheduleDate`.
- Chave `UNASSIGNED_ASSIGNEE_KEY` não pode colidir com IDs reais (usar valor reservado, ex.: `"__unassigned__"`).

---

## Testes necessários

### Frontend

Testes unitários (vitest, ambiente `node`) em `request-filters.test.ts` e `use-request-filters.test.ts` (reducer):

- `getRequestStage`: as 6 combinações de `status` × tag (`ATRIBUIDA`, `REAGENDADA`).
- OU dentro do grupo e E entre grupos; grupo vazio = sem restrição.
- Presets: "Agendadas" inclui reagendadas; "Encerradas" inclui realizadas + canceladas; "Todas" = sem filtro de etapa.
- Credenciamento: matriz de inclusão/exclusão (Novas marcada ou não; com Tipo, Responsável ou Hoje ativos; "Todas").
- Hoje: independe da etapa quando `stages = []`; combina em E com `stages` não vazio; ignora credenciamento.
- Contadores: chip ignora `todayOnly` e a própria etapa; Tipo/Responsável respeitam etapa + demais filtros; Hoje respeita Tipo/Responsável.
- Opções de Tipo: legados agrupados em um rótulo; ordenação; valor selecionado ausente dos dados é mantido.
- Opções de Responsável: rótulo via `teams.users` (inclusive inativo), fallback `responsible`, fallback "Responsável não identificado"; "Sem responsável" primeiro e só quando existir/estiver selecionado; `users` indefinido.
- Pílulas: seleção igual a preset (sem Hoje) → sem pílula de Etapa; conjunto customizado ou Hoje + etapa → com pílula; truncamento `+N`; contador = nº de pílulas.
- Reducer: `selectChip`; `toggleToday` liga/desliga com restauração (`[INBOX]` → Hoje → volta `[INBOX]`; com etapa escolhida durante Hoje → mantém a escolhida); `toggle*` alterna; `clearDimension`; `clearAll` não restaura "Novas".

Se o `vitest` for vetado: validar manualmente cada item acima na tela e registrar no relatório final.

### Backend

- Sem impacto esperado.

### E2E

- Não há Playwright/infra E2E neste projeto. Checklist manual (via Chrome headless/CDP ou navegador do usuário): fluxo dos critérios de aceite em desktop e mobile.

---

## Comandos de validação sugeridos

O projeto usa scripts únicos na raiz (sem `frontend/`/`backend/` como subpacotes de lint/test; **não existe script de lint**):

```bash
npm install -D vitest@^2.1     # somente após confirmar engines compatíveis com Node 22.17.0
npm test                       # "test": "vitest run" (script a adicionar)
npm run typecheck
npm run build                  # derruba o backend local se ele estiver servindo dist/ — conferir /health depois
```

---

## Riscos e pontos de atenção

- **Cascata do `styles.css`** (~26 mil linhas, camadas de `!important` no fim): reaproveitar as classes existentes dos chips evita disputa, mas o drawer/checkboxes/busca precisam de verificação visual real.
- **Acoplamento entre features**: o drawer reaproveita classes `ag-*` (módulo da agenda). Mudar o CSS da agenda afeta este drawer. Mitigação: documentar; a reescrita pode extrair um `Drawer` compartilhado.
- **Mudança sutil de comportamento**: chips "Agendadas" e "Encerradas" agrupam etapas (sem mudança numérica hoje, pois Reagendadas = 0); "Limpar" leva a "Todas", não a "Novas"; desligar "Hoje" restaura a etapa anterior apenas se nenhuma outra tiver sido escolhida.
- **Dados legados em produção**: linhas com nome do responsável mas **sem** `assignedUserId` cairiam em "Sem responsável" (no banco local não existe nenhuma). Consulta somente leitura para o usuário rodar em produção:
  ```sql
  SELECT count(*) FROM requests
  WHERE COALESCE(workflow_data->>'assignedUserId','') = ''
    AND (COALESCE(workflow_data->>'responsible','') <> '' OR COALESCE(responsible_unit,'') <> '');
  ```
  Se retornar > 0, decidir antes do merge: cair em "Sem responsável" (padrão do plano) ou resolver pelo nome contra `teams.users`.
- **Rótulo `DENUNCIA` cru** na coluna Tipo (e, portanto, no filtro) — preexistente, fora do escopo.
- **Desempenho**: contagens recalculadas a cada mudança de filtro/busca; `useMemo` em tudo. A lista não é paginada (dezenas/centenas de itens); se crescer para milhares, avaliar filtro no servidor em tarefa futura.
- **Nova devDependency (`vitest`)** altera `package.json` e `package-lock.json` — manter o diff do lockfile restrito ao vitest e transitivos.
- **`npm run build` derruba o backend local** (serve `dist/` sem tratamento de erro) — reiniciar e conferir `/health`.
- **`AdminDashboard` mora num arquivo de ~12 mil linhas** que será quebrado na reescrita — manter o diff em `App.tsx` mínimo (só estados/derivações/JSX de filtro) e o módulo novo auto-contido, para migrar sem retrabalho.
- **Risco de afetar produção**: commit/push direto em `main`, sem `staging` (fluxo atual do projeto; a spec de reescrita informa que o projeto ainda não está em produção).

---

## Perguntas em aberto

Nenhuma pergunta bloqueante. **Decisões assumidas por padrão na aprovação do plano** (todas reversíveis; o usuário pode corrigir antes ou durante `/implementar`):

1. Chip "Agendadas" inclui "Reagendadas".
2. "Todas" permanece como 5º chip (com multi-select, "nenhuma etapa marcada" precisa de representação visível, e hoje ver tudo é 1 clique). Removê-lo é trivial.
3. Adicionar `vitest` (2.1.x) como devDependency para testar as funções puras.
4. Sem persistência de filtros na v1.
5. Drawer lateral (não popover), com aplicação imediata e rodapé "Ver N solicitações".
6. Escopo dos filtros limitado a Etapa, Tipo e Responsável (espécie, período e município ficam de fora).

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- Ao abrir a tela, "Novas" está selecionado e a lista é idêntica à de hoje (inclusive credenciamentos pendentes).
- A barra tem 5 chips (Novas, Em análise, Agendadas, Encerradas, Todas), o botão "Hoje" e o botão "Filtros"; não existem mais chips de topo "Reagendadas", "Realizadas" e "Canceladas".
- O botão "Filtros" abre o drawer (e ele fecha por botão, clique no overlay e `Esc`) com os grupos Etapa, Tipo e Responsável, todos multi-seleção, com aplicação imediata.
- Selecionar vários valores no mesmo grupo faz OU; combinar grupos faz E (ex.: Tipo = Ninhada **ou** Animal de rua **e** Responsável = X).
- "Sem responsável" lista exatamente os itens sem `assignedUserId`.
- Contadores de chips, de Hoje e das opções batem com o que a lista mostra ao aplicar a opção, conforme as regras de contagem.
- Pílulas aparecem só para o que o chip selecionado não representa; "✕" remove o grupo; "Limpar filtros" leva a "Todas"; o botão Filtros mostra o nº de pílulas e fica com estado `selected` quando houver.
- "Hoje" mantém o comportamento atual (ignora a etapa; desligar restaura a anterior) e combina com Etapa pelo drawer.
- Credenciamentos seguem a regra (só com "Novas" marcada e sem Tipo/Responsável/Hoje).
- Estados vazios corretos (textos atuais para chip/Hoje isolados; texto de filtro + "Limpar filtros" nos demais).
- Nada de código removido ficou comentado, oculto ou órfão (`filterTabs`, `data-tab`, imports); nenhuma regra de CSS nova usa `!important` sem justificativa confirmada.
- `.topbar` e os cartões da lista permanecem inalterados; layout correto em desktop e mobile.
- `npm run typecheck` e `npm run build` passam sem erros novos; `npm test` passa (se o vitest foi adotado); backend local responde em `/health` ao final.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto; não reler arquivos inteiros — os trechos relevantes e as decisões já estão aqui.
- Não executar migrations (não há nenhuma neste plano); nenhuma alteração em backend/banco/`.env`/CI/CD.
- Seguir `/AGENT.md` (não há `frontend/AGENT.md` nem `backend/AGENT.md`): código novo em inglês, sem strings mágicas, arquivos pequenos com responsabilidade única, sem casts perigosos, sem `console.log`/TODO.
- Manter alterações pequenas e focadas: em `App.tsx` mexer só em `AdminDashboard` (filtros, `<nav>`, estado vazio, imports órfãos).
- Deletar tudo que está em "O que será removido" — não ocultar, não comentar, não sobrepor com `!important`.
- Não registrar credenciais, tokens ou dados pessoais em arquivos, commits ou relatórios.
- Atualizar/criar os testes conforme "Testes necessários"; ao final, relatar o resultado real de `typecheck`, `build` e `test`, e declarar explicitamente o que **não** foi verificado.
