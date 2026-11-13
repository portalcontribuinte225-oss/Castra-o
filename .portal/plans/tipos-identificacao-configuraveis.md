# Plano de Implementação: Tipos de identificação configuráveis

## Origem

- Arquivo de especificação: `.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md` (fase 2 do roadmap)
- Data do planejamento: `2026-11-12`
- Classificação: `fullstack`

Motivo da classificação: a maior parte da mudança é frontend (cadastro no painel, seletor no formulário público, combinação de etapas), com dois toques pequenos no backend (defaults de fábrica para municípios novos e fallback de leitura da nova chave de configuração). **Não há alteração de schema nem migration**: a configuração é uma linha JSONB na tabela `config`, e o tipo escolhido é gravado em colunas JSONB que já existem (`requests.workflow_data` e `requests.animals`).

---

## Resumo

Cria o cadastro configurável de **tipos de identificação** (chave `castragestao:identification-types`, por município, no mesmo padrão de espécies e portes). Cada tipo tem nome, ativo/inativo e os toggles de etapa `stepTutor`, `stepAgenda` e `stepDocuments`. De fábrica existem "Animal com Tutor" (ativo) e "Animal sem Tutor" (inativo; ver "Perguntas em aberto").

No formulário público, o campo "Tipo de Procedimento" (Castração / Microchipagem / Ambos) é substituído pelo campo "Tipo de identificação", no mesmo lugar e com o mesmo componente. A escolha entra como segundo item de `configs` em `getVisibleSteps` (função da fase 1) e aplica a regra de combinação: uma etapa só aparece se o tipo de solicitação **e** o tipo de identificação permitirem. O id do tipo escolhido é gravado na solicitação e em cada animal.

### Pontos que diferem do texto do spec (conferidos no código em 2026-11-12)

1. **Migrations rodam sozinhas no boot**: `backend/src/server.js` chama `runMigrations()` antes de `listen`. Qualquer edição de `backend/src/db/migrations.js` é executada em produção no deploy. Este plano não toca esse arquivo. A "migração dos registros existentes" do spec vira leitura com default ("sem campo = Animal com Tutor"), sem reescrever dados.
2. **Uma chave de config nova não nasce sozinha.** O loader do frontend (bloco `configLoaders` em `App.tsx`) só marca a chave como carregada quando o GET não devolve `null`; sem linha no banco, a primeira criação feita no painel não seria persistida pelo efeito de auto-persistência. Por isso `GET /api/config/castragestao:identification-types` passa a devolver os tipos de fábrica quando o município não tem linha, e o auto-persist grava a linha real no primeiro login de um usuário do município. Municípios novos recebem a chave em `municipalityDefaults.js`.
3. **O backend exige CPF válido em toda solicitação** (`backend/src/routes/requests.js`, `POST /`): um tipo sem etapa Tutor não consegue enviar. Por isso "Animal sem Tutor" nasce inativo.
4. **O controle da etapa Documentos** (pendência deixada pela fase 1) passa a ficar no tipo de identificação. O tipo de solicitação continua com 2 toggles (Tutor e Agenda) e `stepDocuments: true` forçado ao salvar.

---

## Escopo

### Dentro do escopo

- Chave de config `castragestao:identification-types`: defaults de fábrica no backend, usados na criação de município e como fallback de leitura quando não há linha.
- Aba "Tipo de Identificação" em Configurar Ambiente: lista, filtro ativo/inativo, modal de criar/editar (nome, ativo, 3 toggles de etapa, resumo de etapas, validação de nome).
- Seletor "Tipo de identificação" no formulário público, no lugar do campo "Tipo de Procedimento"; combinação com o tipo de solicitação via `getVisibleSteps`.
- Gravação do id escolhido em `workflowData.identificationTypeId` e em `animals[].identificationTypeId` (apenas fluxo público).
- Textos de ajuda de combinação e resumo "Etapas desta solicitação: ..." nos dois modais (tipo de solicitação e tipo de identificação).
- Remoção do campo "Tipo de Procedimento" e dos seus restos (ver "O que será removido").
- Testes unitários (vitest) dos módulos puros novos e da função `summarizeVisibleSteps`.

### Fora do escopo

- Raças, canais/etapa "Quer acompanhar?", senha e login do tutor, tela de entrada e "Animal já cadastrado", remoção da chave de validação (fases 3 a 7).
- Backend aceitar solicitação **sem CPF** (necessário para ativar "Animal sem Tutor"): registrar no spec e atribuir a uma fase (recomendação: fase 4).
- Exibir o tipo de identificação no painel de solicitações, relatórios, filtros ou PDFs. Nenhum código lê o campo gravado nesta fase.
- Criar automaticamente tipos de solicitação "Castração", "Microchipagem" e "Castração e Microchipagem" nos municípios.
- Backfill de registros existentes (nenhuma linha de `requests`, `animals` ou `config` é reescrita por SQL).
- Restringir `PUT /api/config/:key` por role (ver "Riscos"; tratar na revisão da fase 5).
- Fluxo interno (`internalSimple`, "Nova solicitação" do balcão): sem seletor, sem gravação do tipo, etapas fixas como hoje.
- Exclusão de tipos (só ativar/desativar, como nos demais cadastros), descrição por tipo e ordenação manual.
- Qualquer alteração em `backend/src/db/migrations.js`, `.env`, CI/CD ou deploy.

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md` (único AGENT.md do projeto: não existem `frontend/AGENT.md` nem `backend/AGENT.md`). Observação: o AGENT.md raiz descreve um backend em Drizzle/TypeScript, mas o backend real é JavaScript com SQL cru (`pg`); seguir os padrões existentes. Este plano não cria nenhuma operação nova de banco.
- `.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md`
- `.portal/plans/funcao-unica-etapas-visiveis.md` (fase 1, já implementada no commit `e84c4d4`)
- `src/App.tsx` (números de linha abaixo são do momento do planejamento e vão deslocar): `environmentConfigTabs` (~186-192); loaders e auto-persist de config (~424-500); estados do App (~308-311); escopo por município (~794-805); `ActiveView` (~816-824, props ~1059-1093); `LoginView` e portal público (~2226-2329, `NewRequest` público ~2473-2493); `NewRequest` (props ~3330-3350, estado ~3369-3414, `formSteps` ~3442, validações ~3539-3588, `submitInternal`/`submitAccepted` ~3767-3900, card "Tipo e identificação" ~4112-4180); `buildDeclarationPdfHtml` (~4421-4468); `ConfigView` (props ~6857-6886, `createRequestType` ~7183, `patchRequestType` ~7313, `createSpecies`/`openSpeciesModal` ~7401-7422, criação de município ~7571-7604, aba de tipos ~8541-8569, modal de tipo ~9685-9785, `SimpleConfigList` ~9941); PDF do prontuário (~11629)
- `src/domain.ts` (`CONFIG_KEYS`, `initial*`, `getItemMunicipalityId`, `filterByMunicipalityScope`), `src/components/ui.tsx`, `src/utils.ts` (`normalizeText`), `src/api.ts`, `src/types.ts`
- `src/features/request-steps/request-steps.ts` e `request-steps.test.ts`
- `src/styles.css` (apenas as regras `.request-type-steps-*`, ~8347-8391)
- `backend/src/server.js`, `backend/src/db/migrations.js`, `backend/src/routes/config.js`, `backend/src/routes/requests.js` (`POST /`), `backend/src/routes/animals.js` (trechos), `backend/src/middleware/auth.js`, `backend/src/tenant.js`, `backend/src/municipalityDefaults.js`, `backend/src/scripts/repairDefaults.js` e `addDefaultPermissionGroup.js` (precedente de retrofit manual), `backend/package.json`

---

## Impacto por área

### Frontend

**`src/domain.ts`**

- `CONFIG_KEYS.identificationTypes = "castragestao:identification-types"` (entra sozinho em `CONFIG_KEYS_LIST`).
- `export const initialIdentificationTypes: AnyRecord[] = [];` junto de `initialRequestTypes`.

**`src/features/request-steps/request-steps.ts`**: acrescentar

```ts
export function summarizeVisibleSteps(configs: VisibleStepsInput["configs"]): string;
// getVisibleSteps({ internal: false, skipTutor: false, configs }) -> rótulos unidos por ", "
```

**`src/features/identification-types/identification-types.ts`** (novo; lógica pura, sem React, sem importar `App.tsx`):

```ts
import { normalizeText } from "../../utils";
import type { StepToggles } from "../request-steps/request-steps";

export interface IdentificationType extends StepToggles {
  id: string;
  name: string;
  active?: boolean;
  municipalityId?: string;
}

export function getActiveIdentificationTypes(items: IdentificationType[] | null | undefined): IdentificationType[];
export function resolveSelectedIdentificationType(activeTypes: IdentificationType[], selectedId: string): IdentificationType | null;
export function hasDuplicateIdentificationTypeName(items: IdentificationType[], name: string, ignoreId?: string): boolean;
```

- `getActiveIdentificationTypes`: entrada que não é array vira `[]`; mantém só `active !== false` com `name.trim()` não vazio; preserva a ordem da config.
- `resolveSelectedIdentificationType`: devolve o tipo cujo `id === selectedId` dentro de `activeTypes`; se não houver (id vazio, inexistente ou inativo), o primeiro de `activeTypes`; lista vazia devolve `null`.
- `hasDuplicateIdentificationTypeName`: compara com `normalizeText` (sem acento, sem caixa, com trim), ignora o item de `ignoreId`; nome vazio devolve `false` (a obrigatoriedade é validada à parte).
- As chaves `stepTutor`, `stepAgenda` e `stepDocuments` são dados persistidos: **não renomear**.

**`src/features/identification-types/identification-types-config.tsx`** (novo; componente do painel, na faixa de 150-250 linhas):

```tsx
interface IdentificationTypesConfigProps {
  items: IdentificationType[];                            // lista do escopo atual
  setItems: (updater: (current: IdentificationType[]) => IdentificationType[]) => void;
  municipalityScopeId: string;                            // configMunicipalityScopeId do ConfigView
  matchesItem: (item: AnyRecord, id: string) => boolean;  // matchesScopedConfigItem do ConfigView
}
export function IdentificationTypesConfig(props: IdentificationTypesConfigProps): JSX.Element;
```

- Reutiliza `ConfigSectionHeader`, `ConfigStatusFilter`, `EmptyState`, `ModalHeader`, `ConfigActiveToggle` e `Field` de `src/components/ui.tsx`, e as classes já existentes (`config-panel wide`, `config-editor-grid`, `config-list-row`, `config-list-index`, `config-list-main`, `schedule-status`, `modal-backdrop`, `config-modal compact config-environment-modal`, `form-actions`, `request-type-steps-section`, `request-type-steps-label`, `request-type-steps-toggles`, `request-type-step-toggle`, `request-type-step-toggle-text`). **Sem CSS novo**: o resumo usa `<span className="request-type-step-toggle-text"><small>...</small></span>`, que já tem o estilo muted.
- Estado local: filtro de status (`"active"` por padrão), modal aberto, item em edição, formulário.
- Cabeçalho: título "Tipos de identificação", botão "Criar tipo". Vazio: `EmptyState` com título "Nenhum tipo configurado" e texto "Crie os tipos de identificação que o tutor poderá escolher. Cada tipo define quais etapas aparecem no cadastro."
- Linha da lista: índice, nome, subtítulo `Etapas: ${summarizeVisibleSteps([item])}` e chip Ativo/Inativo; clicar abre o modal de edição.
- Modal: título "Criar tipo de identificação" / "Editar tipo de identificação"; `ConfigActiveToggle`; seção "Etapas do cadastro" com 3 toggles ("Dados do tutor", "Agenda", "Documentos e termo"), cada um com a ajuda "Esta etapa só aparece se o tipo de solicitação também permitir."; resumo `Etapas desta solicitação: ${summarizeVisibleSteps([formState])}`; campo Nome.
- Salvar: nome obrigatório (trim) e único no escopo (`hasDuplicateIdentificationTypeName` sobre os itens do escopo, ignorando o item em edição); mensagem de erro no campo, no padrão `Field invalid`. Criar: `{ id: \`identification_${Date.now()}\`, name: name.trim(), active, municipalityId: municipalityScopeId, stepTutor, stepAgenda, stepDocuments }`. Editar: `current.map((item) => (matchesItem(item, editingId) ? { ...item, ...patch } : item))`, preservando o `id`.
- Sem botão de excluir.

**`src/App.tsx`** (fiação; espelhar o que existe para `species`, e conferir que `CONFIG_KEYS.identificationTypes` aparece o mesmo número de vezes que `CONFIG_KEYS.species`, hoje 5):

- Imports: `initialIdentificationTypes` (de `./domain`), `IdentificationTypesConfig`, e `getActiveIdentificationTypes`/`resolveSelectedIdentificationType`/`summarizeVisibleSteps` onde forem usados.
- `environmentConfigTabs` (~186): `{ id: "identification", label: "Tipo de Identificação" }` logo após `requests`. O sidebar lista a aba sozinho. **Não** mexer em `currentConfigItems` (~8371): está definido e não é usado.
- Estado do App (~308-311): `const [identificationTypes, setIdentificationTypes] = useState([]);`
- Loader global (~440-443): `setIdentificationTypes(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.identificationTypes], municipality)));`
- Loader municipal (~471-477): `[CONFIG_KEYS.identificationTypes, setIdentificationTypes],`
- Auto-persist (~494-500): um `useEffect` idêntico aos vizinhos para `CONFIG_KEYS.identificationTypes`.
- Escopo (~799-802): `const scopedIdentificationTypes = filterByMunicipalityScope(identificationTypes, scopedMunicipalityId);`
- `<ActiveView>` (~1071-1078): `identificationTypes={scopedIdentificationTypes}` e `setIdentificationTypes={setIdentificationTypes}` (as demais views ignoram props que não usam).
- `<LoginView>` (~753-770): `identificationTypes={identificationTypes}`.
- `LoginView` (assinatura ~2226): `identificationTypes = []`; estado `publicServiceIdentificationTypes` (~2239-2242); incluir no efeito de sincronização (~2311-2317) e nas dependências; carregar por município no efeito (~2319-2329): `api.getConfig(CONFIG_KEYS.identificationTypes, selectedMunicipalityId).then((value) => { if (Array.isArray(value)) setPublicServiceIdentificationTypes(value); }).catch(() => {});`; passar `identificationTypes={publicServiceIdentificationTypes}` ao `<NewRequest>` público (~2473). O `<NewRequest>` interno (~4808) **não** recebe a prop.
- `ConfigView`: props `identificationTypes = initialIdentificationTypes` e `setIdentificationTypes` (~6857-6886); render da aba após o bloco `requests` (~8569): `{configArea === "environment" && configTab === "identification" && <IdentificationTypesConfig items={identificationTypes} setItems={setIdentificationTypes} municipalityScopeId={configMunicipalityScopeId} matchesItem={matchesScopedConfigItem} />}`; bloco de criação de município (~7580-7604): `setIdentificationTypes?.((current) => mergeScopedConfigItems(current, scopeConfigItems(createdConfigs[CONFIG_KEYS.identificationTypes], createdMunicipalityScope), created.id));`
- **Modal de tipo de solicitação** (~9729-9757): trocar as duas ajudas "Desativar oculta esta etapa no cadastro público." por "Esta etapa só aparece se o tipo de identificação também permitir." e acrescentar o resumo `Etapas desta solicitação: ${summarizeVisibleSteps([{ ...newRequestType, stepDocuments: true }])}` (Documentos é sempre permitido por este cadastro). Manter o `stepDocuments: true` forçado em `createRequestType` (~7204) e no submit do modal (~9692).

**`NewRequest` em `src/App.tsx`**:

- Prop nova `identificationTypes = initialIdentificationTypes`; `requestData` ganha `identificationTypeId: ""`.
- Derivação (antes de `formSteps`, ~3441):

```ts
const activeIdentificationTypes = publicFlow ? getActiveIdentificationTypes(identificationTypes) : [];
const selectedIdentificationType = resolveSelectedIdentificationType(activeIdentificationTypes, requestData.identificationTypeId);
const formSteps = getVisibleSteps({ internal: internalSimple, skipTutor: skipTutorStep, configs: [selectedRequestType, selectedIdentificationType] });
```

- Card "Tipo e identificação" (~4117-4141), no primeiro animal: `const showIdentificationPicker = index === 0 && activeIdentificationTypes.length > 1;` (a lista só é preenchida em `publicFlow`). O título vira "Tipo e identificação" quando `showTypeSelector || showIdentificationPicker`. No lugar do `CompactChoiceField` "Tipo de Procedimento", dentro do mesmo wrapper `animal-choice-grid species-row` (agora condicional):

```tsx
<CompactChoiceField
  label="Tipo de identificação"
  value={selectedIdentificationType?.id}
  options={activeIdentificationTypes.map((type) => ({ value: type.id, label: type.name }))}
  onChange={(id) => updateRequestField("identificationTypeId", id)}
/>
```

- Com 1 tipo ativo não há seletor e o tipo é aplicado implicitamente; com 0 não há restrição (`null` é ignorado por `getVisibleSteps`).
- `submitAccepted` (~3829): quando `selectedIdentificationType` existir, gravar `identificationTypeId` em `workflowData` e em cada item de `animals` (no `animals.map` do payload). `submitInternal` não muda.
- `getRequestValidationIssues`, `getStepIssues` e `navigateToStep` não mudam: dependem de `hasStep(...)`/`formSteps`, que já refletem a combinação. O seletor fica na etapa Animal (sempre a primeira no fluxo público), então a troca de tipo nunca deixa `formStep` apontando para uma etapa que sumiu.

Estados de loading/error/empty: a lista do painel segue o padrão de `EmptyState`; o seletor do formulário simplesmente não aparece sem 2 tipos ativos.

### Backend

**`backend/src/services/identification-type-defaults.js`** (novo; módulo puro, sem imports):

```js
export const IDENTIFICATION_TYPES_CONFIG_KEY = "castragestao:identification-types";

export function buildDefaultIdentificationTypes() {
  return [
    { id: "animal_com_tutor", name: "Animal com Tutor", active: true, stepTutor: true, stepAgenda: true, stepDocuments: true },
    // Starts inactive: POST /requests still requires a valid CPF, which a request without the tutor step cannot provide.
    { id: "animal_sem_tutor", name: "Animal sem Tutor", active: false, stepTutor: false, stepAgenda: true, stepDocuments: true },
  ];
}
```

**`backend/src/municipalityDefaults.js`**: importar o módulo acima e acrescentar `[IDENTIFICATION_TYPES_CONFIG_KEY]: buildDefaultIdentificationTypes(),` ao objeto devolvido por `buildMunicipalityDefaultConfigs` (municípios novos já nascem com a chave via `upsertMunicipalityDefaultConfigs`).

**`backend/src/routes/config.js`** (`GET /:key`): constante `DEFAULT_CONFIG_VALUE_BUILDERS = { [IDENTIFICATION_TYPES_CONFIG_KEY]: buildDefaultIdentificationTypes }` junto das demais constantes do topo, com um comentário curto ("keys that fall back to factory defaults when the municipality has no row yet"). Depois do `SELECT`, trocar `if (!rows[0]) return res.json(null);` por:

```js
if (!rows[0]) {
  const buildDefault = DEFAULT_CONFIG_VALUE_BUILDERS[key];
  return res.json(buildDefault ? buildDefault() : null);
}
```

O desvio do `key === "ai"` acima não muda. `PUT` não muda. Nenhuma rota nova.

Não há infraestrutura de teste de backend (`backend/package.json` só tem `dev` e `start`; sem banco local). Validação por `node --check` e conferência manual descrita nos critérios de aceite.

### Banco de dados

**Sem alteração de schema e sem migration.** A chave nova é uma linha na tabela `config` (JSONB, por município), criada pelo próprio app: pelo auto-persist do frontend e, para municípios novos, por `upsertMunicipalityDefaultConfigs`. O tipo escolhido é gravado em `requests.workflow_data` e `requests.animals`, que já são JSONB livres (o backend os copia sem validar chaves). Nenhum SQL para rodar.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção. Como `runMigrations()` roda a cada boot, **não editar `migrations.js`** nesta fase.

### Infra/Deploy

Sem impacto esperado. Sem env vars, Render, build, jobs ou storage. Custo marginal: +1 `GET` por município no login de usuário global e +1 `PUT` de auto-persist por sessão municipal (padrão já existente para as outras chaves).

---

## Arquivos provavelmente afetados

- `backend/src/services/identification-type-defaults.js` (novo)
- `backend/src/municipalityDefaults.js`
- `backend/src/routes/config.js`
- `src/domain.ts`
- `src/features/request-steps/request-steps.ts`
- `src/features/request-steps/request-steps.test.ts`
- `src/features/identification-types/identification-types.ts` (novo)
- `src/features/identification-types/identification-types.test.ts` (novo)
- `src/features/identification-types/identification-types-config.tsx` (novo)
- `src/App.tsx` (fiação, `NewRequest`, `LoginView`, `ConfigView`, modal de tipo de solicitação, `buildDeclarationPdfHtml`)
- Após o commit, pelo `/finalizar`: `.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md`

Nenhuma alteração em `src/styles.css` está prevista.

---

## O que será removido

Cada item deve ser **deletado** — não comentado, não envolto em `if (false)`, não ocultado:

- O `CompactChoiceField` "Tipo de Procedimento" com as opções `["Castração", "Microchipagem", "Ambos"]` (`src/App.tsx` ~4140). Ele é substituído no lugar pelo seletor do tipo de identificação; o wrapper `animal-choice-grid species-row` continua em uso, então nenhuma regra de CSS fica órfã.
- `procedureType: ""` do estado inicial do animal (~3394) e do objeto criado em `addAnimal` (~3471).
- A linha `["Procedimento", "procedureType"]` de `animalFieldLabels` em `buildDeclarationPdfHtml` (~4445), que ficaria sempre "-".
- Os dois textos "Desativar oculta esta etapa no cadastro público." do modal de tipo de solicitação (~9741 e ~9753), trocados pelo texto de combinação.

**Mantido de propósito:** o fallback `animal.procedureType || animal.procedure || requestTypeLabel(req)` do PDF do prontuário (~11629), porque registros antigos ainda têm `procedureType` gravado. Nada de colunas, tabelas, rotas, tipos exportados ou CSS é removido.

> **Atenção para a skill `implementar`:** se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. Backend: criar `backend/src/services/identification-type-defaults.js`, registrar a chave em `municipalityDefaults.js` e acrescentar o fallback do `GET` em `routes/config.js`.
2. `src/domain.ts`: `CONFIG_KEYS.identificationTypes` e `initialIdentificationTypes`.
3. `request-steps.ts`: `summarizeVisibleSteps` + casos novos em `request-steps.test.ts`.
4. Criar `identification-types.ts` e `identification-types.test.ts` (nomes e textos de teste em inglês), conforme "Testes necessários".
5. Criar `identification-types-config.tsx` conforme a seção "Frontend".
6. `App.tsx`, fiação do dado: estado, loader global, loader municipal, auto-persist, escopo, props do `ActiveView`, `LoginView` (estado, sincronização, loader por município, prop do `NewRequest`), `ConfigView` (props, render da aba, criação de município) e a aba em `environmentConfigTabs`.
7. `NewRequest`: prop, `identificationTypeId` no `requestData`, derivação e `configs` do `getVisibleSteps`, seletor no lugar do campo antigo, título do card, gravação em `submitAccepted` e as remoções da lista acima.
8. Modal de tipo de solicitação: textos de combinação e resumo.
9. Checklist anti-duplicação (greps): `Tipo de Procedimento` em `src/App.tsx` retorna 0; `procedureType` retorna exatamente 1 (o fallback do prontuário); `Desativar oculta esta etapa` retorna 0; `CONFIG_KEYS.identificationTypes` aparece o mesmo número de vezes que `CONFIG_KEYS.species`; `identificationTypes` não foi passado ao `<NewRequest>` interno.
10. Rodar `npm run typecheck`, `npm test` e `npm run build` **uma vez**, ao final, e os `node --check` do backend (ver "Comandos de validação").
11. Sem verificação visual por padrão. Informar ao usuário o que conferir na tela (ver "Critérios de aceite").
12. Pelo `/finalizar`, depois do commit, atualizar o spec (ver "Observações para a skill `implementar`").

---

## Regras de negócio identificadas

- O tipo de identificação é configurável por município. De fábrica: "Animal com Tutor" (ativo) e "Animal sem Tutor" (inativo, Tutor desligado, Agenda e Documentos ligados).
- Cada tipo tem os toggles `stepTutor`, `stepAgenda` e `stepDocuments` (mesmas chaves dos tipos de solicitação).
- **Regra de combinação:** uma etapa aparece se o tipo de solicitação **e** o tipo de identificação permitirem; sem bloqueio nem validação de conflito. A etapa Animal sempre existe.
- O controle da etapa Documentos mora no tipo de identificação; o tipo de solicitação sempre a permite (`stepDocuments: true` forçado ao salvar). A pendência "dispensar a declaração para animal sem tutor" vira configuração do município; de fábrica o Documentos fica ligado, para não derrubar o termo por padrão.
- O seletor aparece só com 2 ou mais tipos ativos. Com 1 tipo ativo ele é aplicado implicitamente; sem tipos ativos não há restrição.
- Seleção padrão: o primeiro tipo ativo, na ordem da config. A escolha é por solicitação.
- Gravação (apenas fluxo público): `workflowData.identificationTypeId` e `animals[].identificationTypeId`. Registros sem o campo equivalem a "Animal com Tutor" (default por leitura; nada lê o campo nesta fase).
- Fluxo interno: etapas fixas (Tutor, Animal, Agenda); sem seletor e sem gravação.
- Tipos não são excluídos, só ativados ou desativados. Nome obrigatório e único por município (sem acento e sem caixa).
- "Animal sem Tutor" só deve ser ativado quando o backend aceitar solicitação sem CPF. Para ativar: Configurações > Configurar Ambiente > Tipo de Identificação > filtro "Inativos" > abrir o tipo > ligar "Ativo".
- "Castração / Microchipagem / Ambos" deixam de ser um campo do formulário e passam a ser tipos de solicitação que a prefeitura cadastra (o plano não os cria).

---

## Regras multi-tenant e segurança

- **Origem do tenant:** leitura pública já existente (`GET /api/config/:key?municipalityId=`) e escrita pelo município do JWT (`PUT`), sem rota nova. O fallback do `GET` devolve defaults estáticos apenas quando não existe linha **do município consultado**; nunca lê nem mistura dados de outro município.
- **Permissões:** a nova aba herda o item de permissão "Configurar Ambiente" (`environment`); nenhuma permissão nova e nenhuma mudança no whitelist de `permission_groups`.
- **Dados:** a configuração não contém dado pessoal. O id gravado na solicitação não é dado pessoal.
- **Preexistente, não corrigido aqui:** `PUT /api/config/:key` só exige autenticação; para estas chaves não há checagem de role (`config.js` restringe apenas `platform` e `ai`), então qualquer usuário autenticado, inclusive `tutor`, grava a config do próprio município. Isso afeta `castragestao:request-types`, espécies, portes, agenda e agora também os tipos de identificação. As contas de tutor com senha da fase 5 aumentam a exposição: incluir na revisão `/security-review` da fase 5. Não restringir só a nova chave agora, porque faria a edição de um analista com permissão de ambiente falhar em silêncio.
- **Relatórios/PDFs:** só a linha "Procedimento" da declaração deixa de existir; o prontuário mantém o fallback para registros antigos.

---

## Validações necessárias

- Modal do tipo de identificação: nome obrigatório (trim) e único no escopo do município (`normalizeText`); toggles booleanos.
- `getActiveIdentificationTypes` tolera `null`, `undefined` e valor que não seja array.
- `resolveSelectedIdentificationType` cai no primeiro ativo quando o id guardado não existe, está inativo ou está vazio.
- Nenhuma validação nova no envio da solicitação: o id gravado vem de `selectedIdentificationType`, derivado da config carregada (mesmo modelo de `requestTypeId`; o backend não o valida). Nenhum parâmetro, query string ou payload novo no backend.

---

## Testes necessários

### Frontend

Testes unitários (vitest, `npm test`):

`src/features/request-steps/request-steps.test.ts` (acrescentar):

- `summarizeVisibleSteps([])` devolve "Animal, Tutor, Agenda, Documentos".
- `summarizeVisibleSteps([{ stepTutor: false }])` devolve "Animal, Agenda, Documentos".
- Com dois configs, um escondendo Agenda e outro escondendo Documentos, o resumo omite as duas.

`src/features/identification-types/identification-types.test.ts` (novo):

- `getActiveIdentificationTypes`: `null`, `undefined` e não-array devolvem `[]`; remove `active: false`; remove nome vazio ou só com espaços; trata `active` ausente como ativo; preserva a ordem.
- `resolveSelectedIdentificationType`: devolve o tipo escolhido quando ativo; cai no primeiro ativo com id vazio, desconhecido ou inativo; devolve `null` com lista vazia.
- `hasDuplicateIdentificationTypeName`: ignora caixa, acento e espaços nas pontas; ignora o item de `ignoreId`; nome vazio devolve `false`.
- Integração com `getVisibleSteps`, usando o formato de fábrica de "Animal sem Tutor" (`stepTutor: false`, `stepAgenda: true`, `stepDocuments: true`): com tipo de solicitação permissivo sobra Animal, Agenda, Documentos; com tipo de solicitação `stepAgenda: false` sobra Animal, Documentos; com tipo de identificação `stepDocuments: false` e tipo de solicitação permissivo, Documentos não aparece.

Não há infraestrutura de teste de componente (sem testing-library): o painel, o seletor e a fiação em `App.tsx` são validados por typecheck, build e pela conferência manual dos critérios de aceite.

### Backend

Sem infraestrutura de teste de backend (preexistente). Validação: `node --check` nos três arquivos alterados e a conferência manual pós-deploy descrita nos critérios de aceite.

### E2E

Não aplicável.

---

## Comandos de validação sugeridos

O projeto usa scripts únicos na raiz; não há script de lint nem testes de backend. Rodar **uma vez**, ao final:

```bash
npm run typecheck
npm test
npm run build

node --check backend/src/services/identification-type-defaults.js
node --check backend/src/municipalityDefaults.js
node --check backend/src/routes/config.js
node -e "import('./backend/src/services/identification-type-defaults.js').then((m) => console.log(JSON.stringify(m.buildDefaultIdentificationTypes(), null, 2)))"
```

O último comando importa apenas o módulo puro (sem banco). Não subir o backend contra banco real e não executar scripts de `backend/src/scripts/`.

---

## Riscos e pontos de atenção

- **`App.tsx` monolítico (~12 mil linhas):** a fiação de uma chave nova tem cerca de 12 pontos pequenos. Esquecer um dos quatro contextos de carga (global, municipal, público, criação de município) faz os tipos sumirem naquele contexto. O checklist de grep (mesma contagem de `CONFIG_KEYS.species`) mitiga.
- **Ativar "Animal sem Tutor" (ou desligar "Dados do tutor" em qualquer tipo) antes de o backend aceitar solicitação sem CPF** faz o envio público falhar com a mensagem de CPF do backend. Pela leitura do código, isso já acontece hoje com um tipo de solicitação com `stepTutor: false` (não reproduzido em execução). Por isso o tipo de fábrica nasce inativo.
- **Remoção do campo "Tipo de Procedimento":** prefeituras que usavam "Microchipagem" e "Ambos" perdem essa captura até criarem tipos de solicitação equivalentes. Registros antigos continuam exibindo o valor gravado no prontuário.
- **`PUT /api/config/:key` aberto a qualquer autenticado:** preexistente; ver "Regras multi-tenant e segurança".
- **Usuários globais (master/suporte):** pelo código, o efeito de auto-persist não roda para eles, então edições de cadastro feitas nesse perfil não são gravadas pelo mesmo mecanismo. Os tipos de identificação herdam o comportamento dos outros cadastros (não verificado em execução).
- **Sem teste de backend e sem banco local:** a parte de backend é um default estático e um fallback de 3 linhas, mas só será exercitada de fato após o deploy.
- **Risco de afetar produção:** commit/push direto em `main`, sem `staging`. `runMigrations()` roda a cada boot e este plano não o altera.
- O working tree já tinha alterações não relacionadas no momento do planejamento (`.claude/skills/*`, `AGENT.md`, `.claude/skills/rodar/`, `.portal/plans/reorganizar-documentos-pdf.md` e `.portal/specs/` não versionados). Não devem entrar no commit desta fase.

---

## Perguntas em aberto

Decisões assumidas neste plano (as recomendações apresentadas ao aprovar). Se preferir a alternativa, avisar **antes** do `/implementar`.

1. **"Animal sem Tutor" nasce inativo** (decisão assumida), por causa do CPF obrigatório no backend. Alternativa: incluir já nesta fase o ajuste de `POST /api/requests` (CPF opcional quando a etapa Tutor não existe, decidido no servidor pela config do município). Recomendação: adiar para a fase 4, quando nasce o contato alternativo; o ajuste toca o endpoint público mais crítico e não há teste de backend nem banco local para validá-lo. A fase que assumir isso deve ser registrada no spec.
2. **Castração / Microchipagem / Ambos viram tipos de solicitação cadastráveis** (decisão assumida; pendência do spec), e o campo sai dos dois fluxos (público e balcão). O plano não cria esses tipos nos municípios.
3. **Fluxo interno (balcão) não mostra nem grava o tipo de identificação** (decisão assumida): as etapas são fixas e sempre incluem Tutor, o que equivale a "Animal com Tutor".
4. **Sem backfill de registros antigos** (decisão assumida): leitura com default. Se houver necessidade de linhas explícitas para relatório ou SQL, preparar um `UPDATE` para o usuário rodar; ele não é executado pelo plano.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- `npm run typecheck`, `npm test` e `npm run build` terminam sem erros novos, os testes novos passam e os `node --check` do backend passam.
- O checklist de greps da "Estratégia de implementação" (passo 9) confere.
- Nenhum arquivo de migration, `.env`, CSS ou script de banco foi alterado.
- Conferência manual (descrita ao usuário; sem verificação visual por padrão):
  - **Backend, após o deploy:** `GET /api/config/castragestao:identification-types?municipalityId=<id>` num município sem linha devolve os 2 tipos de fábrica; um município criado depois já nasce com a chave.
  - **Painel:** a aba "Tipo de Identificação" lista "Animal com Tutor" (ativo) e mostra "Animal sem Tutor" no filtro "Inativos"; criar, editar e ativar/desativar persistem após recarregar; nome vazio ou repetido é recusado; o resumo "Etapas desta solicitação" acompanha os toggles; os dois modais exibem o texto de combinação.
  - **Formulário público com 1 tipo ativo:** sem seletor, sem o campo "Tipo de Procedimento", stepper igual ao de hoje (Animal, Tutor, Agenda, Documentos).
  - **Formulário público com 2 ou mais tipos ativos:** o seletor "Tipo de identificação" aparece no card "Tipo e identificação", com o primeiro tipo pré-selecionado; escolher um tipo com Tutor desligado remove a etapa Tutor do stepper; a combinação com o tipo de solicitação respeita os dois lados.
  - **Solicitação enviada** traz `workflow_data.identificationTypeId` e `animals[].identificationTypeId` quando há tipo selecionado.
  - **Fluxo interno:** sem seletor, etapas Tutor, Animal, Agenda.
  - **PDFs:** a declaração não tem mais a linha "Procedimento"; o prontuário de um registro antigo continua exibindo o procedimento.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto. Os números de linha são do momento do planejamento e vão deslocar: localizar pelos trechos de código descritos.
- Não há migrations nesta fase; nada a executar contra banco. Não editar `backend/src/db/migrations.js`: ele roda a cada boot.
- Seguir `/AGENT.md` (código novo em inglês, um arquivo por responsabilidade, sem código morto). O backend real é JavaScript com SQL cru; este plano não cria operação nova de banco. Textos de interface em português. Não há valor finito novo que exija enum; a chave de config segue o objeto `CONFIG_KEYS`.
- Usar `import type` para interfaces (`isolatedModules: true`) e não renomear `stepTutor`, `stepAgenda`, `stepDocuments`.
- Manter a alteração focada: módulos novos + fiação mínima em `App.tsx`. Não refatorar o `ConfigView` além da prop, da aba e do bloco de criação de município; não tocar em `currentConfigItems`, no `stepDocuments: true` forçado do tipo de solicitação, em CSS ou no fluxo interno.
- Deletar tudo que está em "O que será removido" — não ocultar.
- Não incluir no commit os arquivos já alterados ou não versionados que não pertencem a esta fase (ver "Riscos"). `.portal/specs/` está fora do controle de versão; atualizar o arquivo local, e o usuário decide se o versiona.
- Sem verificação visual (navegador/CDP/screenshots) a menos que o usuário peça.
- **Pelo `/finalizar`, depois do commit, atualizar o spec** (`.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md`):
  - marcar a fase 2 como `[x]` com data e hash e preencher o link deste plano na tabela;
  - registrar as decisões fechadas: controle da etapa Documentos no tipo de identificação; "Animal sem Tutor" inativo de fábrica; Castração/Microchipagem/Ambos viram tipos de solicitação; fluxo interno sem tipo de identificação; sem backfill (leitura com default);
  - registrar que **falta atribuir a uma fase** o backend aceitar solicitação sem CPF (recomendação: fase 4), pré-requisito para ativar "Animal sem Tutor";
  - acrescentar à coluna "Revisão extra" da fase 5 o apontamento de `PUT /api/config/:key` sem checagem de role;
  - anotar para a fase 6 que `animals.microchip` é `NOT NULL UNIQUE` (`backend/src/db/migrations.js`), logo animais sem microchip não existem na tabela `animals`, o que afeta a lista "animais do tutor com busca por nome ou microchip";
  - corrigir a linha do texto de estado do código que fala do controle da etapa Documentos e do estado do animal (`procedureType` removido).
