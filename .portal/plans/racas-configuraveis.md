# Plano de Implementação: Raças configuráveis, vinculadas ao tipo de solicitação

## Origem

- Arquivo de especificação: `.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md` (fase 3 do roadmap)
- Data do planejamento: `2026-11-12`
- Classificação: `fullstack`

Motivo da classificação: a maior parte da mudança é frontend (cadastro no painel e select no formulário), com um ajuste mínimo no backend (fallback de leitura da nova chave de configuração em `backend/src/routes/config.js`). **Não há alteração de schema nem migration**: a configuração é uma linha JSONB na tabela `config`, e a raça escolhida continua sendo gravada em `breedDescription`, dentro do JSONB `requests.animals`, que já existe.

---

## Resumo

Cria o cadastro configurável de **raças** (chave `castragestao:breeds`, por município, no mesmo padrão de espécies, portes e tipos de identificação). Cada raça tem `name`, `speciesId`, `requestTypeIds[]` e `active`.

No formulário de solicitação (público e balcão), quando o animal tem "Raça = Definida", o campo de texto livre dá lugar a um **select** com as raças ativas ligadas ao tipo de solicitação escolhido **e** à espécie do animal. "Indefinida" continua sem campo. O nome da raça escolhida vai em `breedDescription`, o campo que já existe, então PDFs e telas continuam funcionando sem alteração. Quando não há raça configurada para o tipo e a espécie escolhidos, o formulário mantém o campo de texto atual.

### Pontos que moldaram o desenho (conferidos no código em 2026-11-12)

1. **Não existe configuração de raça hoje.** O animal tem só `breedType` ("Indefinida" | "Definida", obrigatório) e `breedDescription` (texto livre). Telas e PDFs leem `breedDescription`. Guardar o **nome** da raça nesse campo mantém tudo funcionando, sem tocar em PDF nem no backend.
2. **Logo após o deploy nenhum município terá raças cadastradas.** O formulário não pode ficar sem campo de raça, por isso o texto livre permanece como estado válido (por dado) quando não há raça para o tipo e a espécie.
3. **O problema do loader da fase 2 se repete.** O loader do frontend só marca uma chave como carregada quando o GET não devolve `null`; sem linha no banco, a primeira criação no painel não seria gravada pelo auto-persist. O `GET /api/config/castragestao:breeds` passa a devolver `[]` quando não há linha, no mesmo mapa `DEFAULT_CONFIG_VALUE_BUILDERS` criado na fase 2.
4. **O vínculo é por id.** O animal guarda o **nome** da espécie e o formulário guarda o **nome** do tipo de solicitação, mas ambos os cadastros têm `id` estável (os cadastros não têm exclusão, só ativar/desativar). A raça aponta para a espécie por `speciesId` e para os tipos por `requestTypeIds`, o que sobrevive a renomeações.
5. **Observação para a fase 6:** a coluna `animals.breed` do cadastro (backend) nunca é preenchida pelo formulário, que usa `breedDescription`. O "Animal já cadastrado" precisará mapear isso.

---

## Escopo

### Dentro do escopo

- Chave de config `castragestao:breeds` e o fallback `[]` no `GET /api/config/:key`.
- Aba "Raças" em Configurar Ambiente (após "Espécies"): lista, filtro ativo/inativo, modal de criar/editar com espécie, tipos de solicitação e ativo; cadastro em lote (uma raça por linha) ao criar.
- Select de raças no formulário (público e balcão) e fallback para o texto livre atual.
- Limpar `breedDescription` quando a espécie ou o tipo de solicitação mudam de fato.
- Testes unitários (vitest) da lógica pura.

### Fora do escopo

- Catálogo de raças de fábrica: a prefeitura cadastra as suas.
- Busca ou paginação na lista de raças do painel.
- Vínculo pelo lado do tipo de solicitação (escolher raças dentro do modal do tipo) e herança automática de raças por tipos criados depois.
- Tornar obrigatória a escolha da raça quando "Definida" (continua opcional, como a descrição é hoje).
- Gravar `breedId` ou mapear `breedDescription` para `animals.breed` do cadastro (fase 6).
- Alterar PDFs, prontuário, declaração, relatórios ou dashboard.
- Alterar o campo `breedType` e a sua validação.
- Restringir `PUT /api/config/:key` por role (já registrado no spec para a revisão da fase 5).
- Qualquer alteração em `backend/src/db/migrations.js`, `.env`, CI/CD ou deploy.

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md` (único AGENT.md do projeto: não existem `frontend/AGENT.md` nem `backend/AGENT.md`). O backend real é JavaScript com SQL cru; este plano não cria nenhuma operação nova de banco.
- `.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md`
- `.portal/plans/tipos-identificacao-configuraveis.md` (fase 2, implementada no commit `5ee05b5`; é o padrão a espelhar) e `.portal/plans/funcao-unica-etapas-visiveis.md`
- `src/App.tsx` (números de linha abaixo são do momento do planejamento, depois do commit `5ee05b5`, e vão deslocar): `environmentConfigTabs` (~186-194); estados do App (~312-317); loaders e auto-persist de config (~449, ~482, ~505); escopo por município (~812); `<LoginView>` no App (~776); props do `ActiveView` (~1089-1090); `LoginView` (~2238, estado ~2255, sincronização ~2330, loader por município ~2343, `NewRequest` público ~2506); `NewRequest` (props ~3347-3365, `updateAnimal` ~3525, `updateRequestField` ~3535, render por animal ~4136-4195 com o card de tipo de solicitação ~4170-4184 e a linha Espécie/Sexo/Raça ~4186-4195); `AdminDashboard` (~4584-4600) e o `NewRequest` do modal interno (~4831-4848); `ConfigView` (~6880-6890), criação de município (~7625) e render da aba de tipos de identificação (~8602); PDFs que leem `breedDescription` (~3222, ~3335, ~4470, ~11660, ~11841)
- `src/domain.ts` (`CONFIG_KEYS`, `initial*`, `getItemMunicipalityId`, `filterByMunicipalityScope`), `src/components/ui.tsx`, `src/utils.ts` (`normalizeText`), `src/api.ts`
- `src/features/identification-types/` (padrão de módulo puro, testes e componente de config)
- `src/styles.css` (apenas os seletores: `.field select` global e com escopo `.nr-shell`, `.modal-backdrop`, `.config-modal.compact`; `.document-button-field`, `.document-button-grid`, `.document-pill`)
- `backend/src/routes/config.js`, `backend/src/db/migrations.js` (colunas `animals.breed`), `backend/src/routes/animals.js` (trechos)

---

## Impacto por área

### Frontend

**`src/domain.ts`**

- `CONFIG_KEYS.breeds = "castragestao:breeds"` (entra sozinho em `CONFIG_KEYS_LIST`).
- `export const initialBreeds: AnyRecord[] = [];` junto de `initialRequestTypes`.

**`src/features/breeds/breeds.ts`** (novo; lógica pura, sem React, sem importar `App.tsx`; mesmo estilo de `identification-types.ts`):

```ts
import { normalizeText } from "../../utils";

export interface Breed {
  id: string;
  name: string;
  speciesId: string;
  requestTypeIds: string[];
  active?: boolean;
  municipalityId?: string;
}

type BreedLike = Partial<Breed>;

export interface BreedOptionsFilter {
  requestTypeId?: string;
  speciesId?: string;
}

export function getBreedOptions<T extends BreedLike>(breeds: T[] | null | undefined, filter: BreedOptionsFilter): T[];
export function findSpeciesIdByName(speciesOptions: Array<{ id?: string; name?: string; active?: boolean }> | null | undefined, speciesName: string): string | undefined;
export function parseBreedNames(text: string): string[];
export function getDuplicateBreedNames(items: BreedLike[], names: string[], speciesId: string, ignoreId?: string): string[];
```

- `getBreedOptions`: entrada que não é array devolve `[]`; sem `requestTypeId` ou sem `speciesId` no filtro devolve `[]`. Mantém só raças com `active !== false`, `name.trim()` não vazio, `speciesId` igual ao do filtro e `requestTypeIds` (array) contendo o `requestTypeId`. Devolve uma **cópia ordenada alfabeticamente** por nome (`localeCompare` com `"pt-BR"` e `sensitivity: "base"`); não altera a entrada. Os genéricos (como em `identification-types.ts`) permitem passar `AnyRecord`.
- `findSpeciesIdByName`: devolve o `id` do primeiro item com `active !== false` e `name` exatamente igual a `speciesName`; `undefined` se não houver (lista vazia, `null`, nome vazio).
- `parseBreedNames`: separa por quebra de linha (`\r?\n`), aplica `trim`, descarta vazios e remove duplicatas comparando com `normalizeText`, mantendo a primeira ocorrência e a ordem.
- `getDuplicateBreedNames`: devolve, na ordem de entrada, os nomes que já existem em `items` **na mesma espécie** (`normalizeText` sem acento e sem caixa), ignorando o item de `ignoreId`. Raça de outra espécie com o mesmo nome não é duplicata.
- As chaves são dado persistido: **não renomear** `speciesId` nem `requestTypeIds`.

**`src/features/breeds/breeds-config.tsx`** e **`src/features/breeds/breed-form-modal.tsx`** (novos; o modal fica separado para manter cada arquivo na faixa de 150-250 linhas):

```tsx
interface BreedsConfigProps {
  items: AnyRecord[];                 // raças do escopo atual
  setItems: (updater: (current: AnyRecord[]) => AnyRecord[]) => void;
  municipalityScopeId: string;        // configMunicipalityScopeId do ConfigView
  speciesOptions: AnyRecord[];        // espécies recebidas pelo ConfigView
  requestTypes: AnyRecord[];          // tipos de solicitação recebidos pelo ConfigView
}
export function BreedsConfig(props: BreedsConfigProps): JSX.Element;
```

- Dentro do componente, `speciesOptions` e `requestTypes` passam por `filterByMunicipalityScope(..., municipalityScopeId)` e ficam só os ativos (`active !== false`, com nome).
- Reutiliza `ConfigSectionHeader`, `ConfigStatusFilter`, `EmptyState`, `ModalHeader`, `ConfigActiveToggle` e `Field` de `src/components/ui.tsx` e as classes já existentes (`config-panel wide`, `config-editor-grid`, `config-list-row`, `config-list-index`, `config-list-main`, `schedule-status`, `modal-backdrop`, `config-modal compact config-environment-modal`, `form-actions`, `field-error-message`). **Sem CSS novo.**
- Estado local: filtro de status (`"active"` por padrão), modal aberto, item em edição, formulário, `submitAttempted`.
- Cabeçalho: título "Raças", botão "Criar raça". Vazio: `EmptyState` com título "Nenhuma raça cadastrada" e texto "Cadastre as raças que o tutor poderá escolher. Cada raça é ligada a uma espécie e a um ou mais tipos de solicitação. Sem raças para o tipo e a espécie escolhidos, o formulário mantém o campo de texto."
- Lista: ordenada por nome da espécie e depois por nome da raça (derivado no render; não altera a ordem persistida). Linha com índice, nome, subtítulo `${nome da espécie} · ${n} tipo(s) de solicitação` (se a espécie não for encontrada, "Espécie não encontrada") e chip Ativo/Inativo; clicar abre o modal de edição. `key` = `${municipalityId}:${id}`.
- Modal (`breed-form-modal.tsx`, apresentacional):
  - Título "Criar raças" / "Editar raça"; `ConfigActiveToggle`.
  - **Espécie:** `<label className="field"><span>Espécie</span><select>` com "Selecione" e as espécies ativas (mesmo padrão do select de município no modal de agenda).
  - **Tipos de solicitação:** botões de alternância reaproveitando `document-button-field`, `document-button-grid` e `document-pill`/`document-pill selected` (rótulo "Tipos de solicitação"). Ao **criar**, todos os tipos ativos vêm pré-marcados. Ao editar, vem o que está gravado (salvar preserva vínculos com tipos hoje inativos que não aparecem na grade).
  - **Nome:** ao criar, `<textarea>` "Raças (uma por linha)", dentro de `label.field`; ao editar, `Field` "Nome".
- Validação (mensagens no padrão `field-error-message`, só depois de uma tentativa de salvar): nome obrigatório ("Informe ao menos uma raça." ao criar / "Informe o nome da raça." ao editar); espécie obrigatória ("Selecione a espécie."); ao menos um tipo ("Selecione ao menos um tipo de solicitação."); duplicata na mesma espécie ("Já cadastrada(s) para esta espécie: A, B.", usando `getDuplicateBreedNames`).
- Salvar: ao criar, uma raça por nome de `parseBreedNames`: `{ id: \`breed_${Date.now()}_${index}\`, name, speciesId, requestTypeIds, active, municipalityId: municipalityScopeId }` (o sufixo `index` evita colisão de id no lote). Ao editar: `current.map((item) => (mesmo id e mesmo município do item em edição ? { ...item, name, speciesId, requestTypeIds, active } : item))`. Sem botão de excluir.

**`src/App.tsx`** (fiação; espelhar `identificationTypes`, e conferir que o número de **linhas** com `CONFIG_KEYS.breeds` em `App.tsx` é igual ao de `CONFIG_KEYS.species`, hoje 5):

- Imports: `initialBreeds` (de `./domain`), `BreedsConfig`, e `getBreedOptions`/`findSpeciesIdByName` de `features/breeds/breeds`.
- `environmentConfigTabs` (~186): `{ id: "breeds", label: "Raças" }` logo após `species`. O sidebar lista a aba sozinho. **Não** mexer em `currentConfigItems` (definido e não usado).
- Estado do App (~316): `const [breeds, setBreeds] = useState([]);`
- Loader global (~449): `setBreeds(configEntries.flatMap(({ municipality, values }) => scopeConfigItems(values[CONFIG_KEYS.breeds], municipality)));`
- Loader municipal (~482): `[CONFIG_KEYS.breeds, setBreeds],`
- Auto-persist (~505): um `useEffect` idêntico aos vizinhos para `CONFIG_KEYS.breeds`.
- Escopo (~812): `const scopedBreeds = filterByMunicipalityScope(breeds, scopedMunicipalityId);`
- `<ActiveView>` (~1089): `breeds={scopedBreeds}` e `setBreeds={setBreeds}`.
- `<LoginView>` no App (~776): `breeds={breeds}`.
- `LoginView` (~2238): assinatura `breeds = []`; estado `publicServiceBreeds` (~2255); incluir no efeito de sincronização (~2330) e nas dependências; carregar por município (~2343): `api.getConfig(CONFIG_KEYS.breeds, selectedMunicipalityId).then((value) => { if (Array.isArray(value)) setPublicServiceBreeds(value); }).catch(() => {});`; passar `breeds={publicServiceBreeds}` ao `<NewRequest>` público (~2506).
- `AdminDashboard` (~4584): prop `breeds = initialBreeds` e `breeds={breeds}` no `<NewRequest>` do modal interno (~4831).
- `ConfigView` (~6880): props `breeds = initialBreeds` e `setBreeds`; render da aba após o bloco de espécies: `{configArea === "environment" && configTab === "breeds" && <BreedsConfig items={breeds} setItems={setBreeds} municipalityScopeId={configMunicipalityScopeId} speciesOptions={speciesOptions} requestTypes={requestTypes} />}`; bloco de criação de município (~7625): `setBreeds?.((current) => mergeScopedConfigItems(current, scopeConfigItems(createdConfigs[CONFIG_KEYS.breeds], createdMunicipalityScope), created.id));`

**`NewRequest` em `src/App.tsx`**:

- Prop nova `breeds = initialBreeds`.
- Dentro do `animals.map` do render (junto de `showTypeSelector`, ~4136-4139), calcular por animal:

```ts
const breedOptions = getBreedOptions(breeds, {
  requestTypeId: selectedRequestType?.id,
  speciesId: findSpeciesIdByName(speciesOptions, animal.species),
});
```

- Bloco "Definida" (~4191-4195): quando `breedOptions.length > 0`, renderizar

```tsx
<label className="field">
  <span>Raça</span>
  <select value={animal.breedDescription} onChange={(e) => updateAnimal(index, "breedDescription", e.target.value)}>
    <option value="">Selecione a raça</option>
    {breedOptions.map((breed) => <option key={breed.id} value={breed.name}>{breed.name}</option>)}
  </select>
</label>
```

  e, caso contrário (sem opções para o tipo e a espécie, inclusive espécie ainda não escolhida), manter o `<div className="access-field" data-label="Raça">` com o input de texto atual, sem alteração.
- **Limpeza da raça:** trocar **de fato** a espécie do animal (valor diferente do atual) ou o tipo de solicitação (valor diferente do atual) zera `breedDescription` (do animal, ou de todos os animais, respectivamente). Implementar como funções pequenas (por exemplo `selectSpecies(index, value)` e `selectRequestType(name)`) usadas no `onChange` de Espécie (~4187) e no `onClick` dos cartões de tipo (~4176). Reclicar no valor já selecionado não limpa nada.
- `breedType`, `getRequestValidationIssues`, `getStepIssues`, `submitInternal`, `submitAccepted` e os PDFs **não mudam**: a raça continua indo em `breedDescription`.

Estados de loading/error/empty: o painel segue o padrão de `EmptyState` e de mensagens de validação no modal; o formulário não tem estado novo (sem opções, mostra o texto livre).

### Backend

**`backend/src/routes/config.js`** (único arquivo): constante local da chave (`const BREEDS_CONFIG_KEY = "castragestao:breeds";`) junto do mapa existente e uma entrada nova em `DEFAULT_CONFIG_VALUE_BUILDERS`:

```js
const DEFAULT_CONFIG_VALUE_BUILDERS = {
  [IDENTIFICATION_TYPES_CONFIG_KEY]: buildDefaultIdentificationTypes,
  [BREEDS_CONFIG_KEY]: () => [],
};
```

O `GET /:key` já devolve `buildDefault()` quando não há linha (fase 2); `PUT` não muda; nenhuma rota nova. Não há necessidade de tocar em `municipalityDefaults.js` (um `[]` explícito não acrescenta nada ao fallback).

Não há infraestrutura de teste de backend (`backend/package.json` só tem `dev` e `start`; sem banco local). Validação por `node --check` e conferência manual descrita nos critérios de aceite.

### Banco de dados

**Sem alteração de schema e sem migration.** A chave nova é uma linha na tabela `config` (JSONB, por município), criada pelo próprio app (auto-persist do frontend). A raça escolhida vai em `requests.animals[].breedDescription`, JSONB que já existe. Nenhum SQL para rodar.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção. `runMigrations()` roda a cada boot: **não editar `backend/src/db/migrations.js`** nesta fase.

### Infra/Deploy

Sem impacto esperado. Sem env vars, Render, build, jobs ou storage. Custo marginal: +1 `GET` por município no login de usuário global e +1 `PUT` de auto-persist por sessão municipal (padrão já existente para as outras chaves).

---

## Arquivos provavelmente afetados

- `backend/src/routes/config.js`
- `src/domain.ts`
- `src/features/breeds/breeds.ts` (novo)
- `src/features/breeds/breeds.test.ts` (novo)
- `src/features/breeds/breeds-config.tsx` (novo)
- `src/features/breeds/breed-form-modal.tsx` (novo)
- `src/App.tsx` (fiação, `NewRequest`, `LoginView`, `AdminDashboard`, `ConfigView`)
- Após o commit, pelo `/finalizar`: `.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md`

Nenhuma alteração em `src/styles.css` está prevista.

---

## O que será removido

**Nenhuma remoção prevista nesta implementação.**

O input "Descreva a raça (Ex: Poodle, Siamês)" **permanece** como o comportamento válido para município sem raças cadastradas para o tipo e a espécie escolhidos. É uma condição de **dado** (existem ou não opções), não uma ocultação nem uma flag desativada de comportamento antigo: o estado "sem raças configuradas" é o estado de todo município logo após o deploy.

---

## Estratégia de implementação

1. Backend: em `backend/src/routes/config.js`, a constante `BREEDS_CONFIG_KEY` e a entrada `() => []` no `DEFAULT_CONFIG_VALUE_BUILDERS`.
2. `src/domain.ts`: `CONFIG_KEYS.breeds` e `initialBreeds`.
3. Criar `src/features/breeds/breeds.ts` e `breeds.test.ts` (nomes e textos de teste em inglês), conforme "Testes necessários".
4. Criar `breeds-config.tsx` e `breed-form-modal.tsx` conforme a seção "Frontend".
5. `App.tsx`, fiação do dado: estado, loader global, loader municipal, auto-persist, escopo, props do `ActiveView`, `<LoginView>` (prop, estado, sincronização, loader por município, prop do `NewRequest` público), `AdminDashboard` (prop até o `NewRequest` interno), `ConfigView` (props, render da aba, criação de município) e a aba em `environmentConfigTabs`.
6. `NewRequest`: prop `breeds`, opções por animal, select ou texto livre, e as funções que limpam `breedDescription` ao trocar espécie ou tipo.
7. Checklist anti-duplicação (greps): o número de linhas com `CONFIG_KEYS.breeds` em `src/App.tsx` é igual ao de `CONFIG_KEYS.species` (hoje 5); `breeds` chega aos **dois** `<NewRequest>` (público e interno); o input "Descreva a raça" continua uma única vez; `breedDescription` continua sendo o único campo gravado para a raça (nenhum `breedId`).
8. Rodar `npm run typecheck`, `npm test` e `npm run build` **uma vez**, ao final, e `node --check backend/src/routes/config.js`.
9. Sem verificação visual por padrão. Informar ao usuário o que conferir na tela (ver "Critérios de aceite").
10. Pelo `/finalizar`, depois do commit, atualizar o spec (ver "Observações para a skill `implementar`").

---

## Regras de negócio identificadas

- Uma raça pertence a **exatamente uma espécie** (`speciesId`) e a **um ou mais tipos de solicitação** (`requestTypeIds`). Ela só aparece para o tipo e a espécie a que está ligada.
- O select aparece apenas quando "Raça = Definida" e existe ao menos uma raça ativa para o par (tipo de solicitação, espécie do animal). Caso contrário, vale o campo de texto livre atual (inclusive com a espécie ainda não escolhida ou sem tipo de solicitação selecionado).
- As opções do select são as raças ativas, em ordem alfabética.
- O valor gravado é o **nome** da raça em `breedDescription`. A escolha continua opcional, como a descrição é hoje; `breedType` continua obrigatório com os valores "Indefinida" e "Definida".
- Trocar de fato a espécie ou o tipo de solicitação limpa a raça informada, para nunca enviar uma raça fora da lista vigente.
- Nome único por espécie dentro do município, ignorando acento e caixa. Raças de espécies diferentes podem repetir o nome.
- Raças não são excluídas, só ativadas ou desativadas (padrão dos demais cadastros). Registros antigos preservam o nome gravado.
- Ao criar, todos os tipos de solicitação ativos vêm pré-marcados. Um tipo criado depois não herda nenhuma raça: o admin precisa editar as raças para ligá-lo.
- O cadastro em lote (uma raça por linha) vale só para criar; editar altera uma raça.
- A regra vale nos dois fluxos (público e balcão). Não há catálogo de fábrica.

---

## Regras multi-tenant e segurança

- **Origem do tenant:** leitura pública já existente (`GET /api/config/:key?municipalityId=`) e escrita pelo município do JWT (`PUT`), sem rota nova. O fallback do `GET` devolve `[]` estático apenas quando não existe linha **do município consultado**; nunca lê nem mistura dados de outro município.
- **Permissões:** a nova aba herda o item de permissão "Configurar Ambiente" (`environment`); nenhuma permissão nova e nenhuma mudança no whitelist de `permission_groups`.
- **Dados:** a configuração não contém dado pessoal. A raça gravada na solicitação não é dado pessoal.
- **Preexistente, não corrigido aqui:** `PUT /api/config/:key` só exige autenticação; para estas chaves não há checagem de role (`config.js` restringe apenas `platform` e `ai`), então qualquer usuário autenticado, inclusive `tutor`, grava a config do próprio município. A chave nova compartilha a mesma exposição. O apontamento já está registrado no spec para a revisão `/security-review` da fase 5.
- **Relatórios/PDFs:** sem alteração; continuam lendo `breedDescription`.

---

## Validações necessárias

- Modal de raça: nome obrigatório (por linha, no lote), espécie obrigatória, ao menos um tipo de solicitação, sem duplicata na mesma espécie (`normalizeText`).
- `getBreedOptions` tolera `null`, `undefined`, valor que não seja array, raça sem `requestTypeIds` e filtro incompleto (devolve `[]`).
- `findSpeciesIdByName` tolera lista ausente e nome vazio.
- Nenhuma validação nova no envio da solicitação (a raça continua opcional) e nenhum parâmetro, query string ou payload novo no backend.

---

## Testes necessários

### Frontend

Testes unitários (vitest, `npm test`) em `src/features/breeds/breeds.test.ts`:

- `getBreedOptions`: `null` e `undefined` devolvem `[]`; sem `requestTypeId` ou sem `speciesId` no filtro devolve `[]`; filtra por espécie; filtra por tipo de solicitação; remove `active: false` e nome vazio ou só com espaços; ignora raça sem `requestTypeIds`; trata `active` ausente como ativo; ordena em ordem alfabética sem distinguir caixa e acento (por exemplo "Poodle" antes de "Yorkshire", "Álamo" junto do "A"); não altera o array de entrada.
- `findSpeciesIdByName`: devolve o id da espécie ativa de nome igual; ignora espécie inativa; `undefined` para nome desconhecido, vazio ou lista `null`.
- `parseBreedNames`: aplica `trim`, descarta linhas vazias, trata `\r\n`, remove duplicatas ignorando caixa e acento mantendo a primeira ocorrência e a ordem; texto vazio devolve `[]`.
- `getDuplicateBreedNames`: detecta nome repetido na mesma espécie ignorando caixa e acento e espaços nas pontas; não conta raça de outra espécie; ignora o item de `ignoreId`; devolve os nomes em conflito na ordem de entrada; sem conflito devolve `[]`.

Não há infraestrutura de teste de componente (sem testing-library): o painel, o select e a fiação em `App.tsx` são validados por typecheck, build e pela conferência manual dos critérios de aceite.

### Backend

Sem infraestrutura de teste de backend (preexistente). Validação: `node --check backend/src/routes/config.js` e a conferência manual pós-deploy descrita nos critérios de aceite.

### E2E

Não aplicável.

---

## Comandos de validação sugeridos

O projeto usa scripts únicos na raiz; não há script de lint nem testes de backend. Rodar **uma vez**, ao final:

```bash
npm run typecheck
npm test
npm run build

node --check backend/src/routes/config.js
```

Não subir o backend contra banco real e não executar scripts de `backend/src/scripts/`.

---

## Riscos e pontos de atenção

- **Manutenção do vínculo explícito:** um tipo de solicitação criado depois não herda nenhuma raça e cai no texto livre até o admin editar as raças. Aceitável porque tipos novos são raros. Se incomodar, a evolução é ligar pelo lado do tipo ou tratar "sem vínculo" como "todos os tipos" (fora desta fase).
- **Lista longa sem busca:** a lista do painel é ordenada por espécie e nome, mas não tem busca nem paginação. Com dezenas de raças o uso ainda é viável; se crescer, vira melhoria futura.
- **Aparência do select:** ele usa `label.field`, que tem estilo global (inclusive `.nr-shell .field select`), mas pode destoar dos inputs `access-field` do formulário. Conferir na tela, no estado "Definida", nos fluxos público e balcão. Se destoar, o ajuste é uma regra de CSS (não prevista neste plano).
- **Usuário global (master/suporte) no modal interno:** vê listas agregadas de municípios, o mesmo limite dos demais cadastros nesse modal. Pelo código, o efeito de auto-persist também não roda para usuários globais (herança dos outros cadastros, não verificada em execução).
- **`PUT /api/config/:key` aberto a qualquer autenticado:** preexistente; ver "Regras multi-tenant e segurança".
- **Sem teste de backend e sem banco local:** a parte de backend é um fallback de uma linha, mas só será exercitada de fato após o deploy.
- **Risco de afetar produção:** commit/push direto em `main`, sem `staging`. `runMigrations()` roda a cada boot e este plano não o altera.
- O working tree já tinha alterações não relacionadas no momento do planejamento (`.claude/skills/*`, `AGENT.md`, `.claude/skills/rodar/`, `.portal/plans/reorganizar-documentos-pdf.md` e `.portal/specs/` não versionados). Não devem entrar no commit desta fase.

---

## Perguntas em aberto

Decisões assumidas neste plano (as recomendações apresentadas ao aprovar). Se preferir a alternativa, avisar **antes** do `/implementar`.

1. **Uma espécie por raça** (decisão assumida; era a suposição do spec "separar também por espécie"). Alternativa: uma raça poder valer para mais de uma espécie.
2. **Sem raças para o tipo e a espécie escolhidos, o formulário mantém o campo de texto livre** (decisão assumida). Alternativa: bloquear "Definida", o que deixaria o formulário sem opção em todo município até as raças serem cadastradas. Não recomendada.
3. **Cadastro em lote (uma raça por linha) incluído** (decisão assumida), como a única conveniência além do spec; sem ela, cadastrar dezenas de raças é muito trabalhoso. **Não há catálogo de raças de fábrica.** Se quiser cortar o lote, é só pedir a redução de escopo: ele fica isolado em `parseBreedNames` e no modal.
4. **O nome da raça vai em `breedDescription`, sem `breedId`, e a escolha continua opcional** (decisão assumida). Nenhum código lê um id de raça nesta fase.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- `npm run typecheck`, `npm test` e `npm run build` terminam sem erros novos, os testes novos passam e `node --check` do backend passa.
- O checklist de greps da "Estratégia de implementação" (passo 7) confere.
- Nenhum arquivo de migration, `.env`, CSS ou script de banco foi alterado.
- Conferência manual (descrita ao usuário; sem verificação visual por padrão):
  - **Backend, após o deploy:** `GET /api/config/castragestao:breeds?municipalityId=<id>` num município sem linha devolve `[]`.
  - **Painel:** a aba "Raças" aparece em Configurar Ambiente, após "Espécies". Criar com várias linhas cria uma raça por linha, com os tipos ativos pré-marcados. Nome vazio, espécie ausente, nenhum tipo marcado e nome repetido na mesma espécie são recusados com mensagem. Editar e ativar/desativar persistem após recarregar. A lista aparece ordenada por espécie e nome.
  - **Formulário sem raças configuradas** (estado logo após o deploy): "Definida" continua mostrando o campo de texto, exatamente como hoje.
  - **Formulário com raças ligadas ao tipo e à espécie:** "Definida" mostra o select com as raças em ordem alfabética; escolher grava o nome em `breedDescription`; a declaração e o prontuário mostram o nome. Espécie sem raças ligadas ou tipo sem raças ligadas volta ao texto livre.
  - **Troca:** mudar a espécie do animal ou o tipo de solicitação limpa a raça escolhida; reclicar na opção já selecionada não limpa.
  - **Fluxo interno (balcão):** o mesmo comportamento do público.
  - **Aparência:** o select de raças combina com os campos vizinhos nos fluxos público e balcão.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto. Os números de linha são do momento do planejamento e vão deslocar: localizar pelos trechos de código descritos.
- Não há migrations nesta fase; nada a executar contra banco. Não editar `backend/src/db/migrations.js`: ele roda a cada boot.
- Seguir `/AGENT.md` (código novo em inglês, um arquivo por responsabilidade, sem código morto). O backend real é JavaScript com SQL cru; este plano não cria operação nova de banco. Textos de interface em português. Não há valor finito novo que exija enum; a chave de config segue o objeto `CONFIG_KEYS`.
- Usar `import type` para interfaces (`isolatedModules: true`) e os genéricos de `getBreedOptions` para aceitar `AnyRecord` sem `as unknown as`.
- Manter a alteração focada: módulos novos + fiação mínima em `App.tsx`. Não refatorar o `ConfigView` além das props, da aba e do bloco de criação de município; não tocar em `currentConfigItems`, nos PDFs, em `breedType` nem em CSS.
- Não deixar a lógica de limpeza da raça espalhada: concentrar em duas funções pequenas dentro de `NewRequest`.
- Não incluir no commit os arquivos já alterados ou não versionados que não pertencem a esta fase (ver "Riscos"). `.portal/specs/` está fora do controle de versão; atualizar o arquivo local, e o usuário decide se o versiona.
- Sem verificação visual (navegador/CDP/screenshots) a menos que o usuário peça.
- **Pelo `/finalizar`, depois do commit, atualizar o spec** (`.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md`):
  - marcar a fase 3 como `[x]` com data e hash e preencher o link deste plano na tabela;
  - registrar as decisões fechadas: uma espécie por raça; texto livre quando não há raça para o tipo e a espécie; vínculo explícito com todos os tipos ativos pré-marcados ao criar e sem herança para tipos criados depois; cadastro em lote; nome da raça em `breedDescription` sem `breedId`; sem catálogo de fábrica; sem busca na lista;
  - anotar para a fase 6 que `animals.breed` (cadastro de animais, backend) nunca é preenchido pelo formulário, que grava `breedDescription` dentro de `requests.animals`; ao criar ou vincular o animal do cadastro, mapear `breedDescription` para `breed`;
  - atualizar a linha do texto de estado do código que fala de raça ("conferir se já existe alguma configuração de raça antes de criar a nova"), que passa a existir como `castragestao:breeds`.
