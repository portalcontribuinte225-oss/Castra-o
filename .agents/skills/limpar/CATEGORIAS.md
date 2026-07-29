# Dead Code & Duplication Catalog — AI-Generated Codebase

Cada categoria abaixo é um code smell recorrente quando múltiplas iterações de IA passam pelo mesmo arquivo sem visão do repositório inteiro.

---

## 1. Code Duplication — Functions/Methods

Duas funções executando a mesma lógica, geralmente porque a IA criou uma nova em vez de localizar e reaproveitar a existente.

**Sinal:** nomes similares (`formatDate` / `formatarData` / `getFormattedDate`), ou lógica idêntica com nomes diferentes.

```ts
// Ruim: code duplication
function formatPhone(v: string) { ... }
function formatPhoneNumber(v: string) { ... } // mesma lógica, criada depois
```

**Verificar:** executar symbol search por ambos os nomes; unificar no símbolo mais referenciado, remover o outro.

---

## 2. Code Duplication — Styles

Comum em `styles.css`/CSS modules quando a IA cria uma classe nova em vez de reaproveitar uma existente com o mesmo visual.

**Sinal:** duas classes com as mesmas propriedades (ou quase), ou o mesmo componente com estilo definido em dois lugares (inline + classe, ou duas classes concorrentes no mesmo elemento).

```css
/* Ruim: style duplication */
.card-tutor  { padding: 16px; border-radius: 8px; background: #fff; }
.tutor-card-v2 { padding: 16px; border-radius: 8px; background: #fff; } /* duplicata */
```

**Verificar:** confirmar qual classe está referenciada no JSX antes de remover.

---

## 3. Version Coexistence (v1/v2 Overlap)

A IA cria uma nova versão de uma function/componente/rota e deixa a versão anterior no arquivo — às vezes comentada, às vezes sem uso, às vezes ainda chamada por engano.

**Sinais:**
- `handleSubmit` e `handleSubmitNew`/`handleSubmitV2` no mesmo arquivo
- Componente `AnimalCard` e `AnimalCardNew` coexistindo
- Bloco inteiro comentado com `// versão antiga, manter por enquanto`
- JSX com `{false && <OldVersion />}` (never renders)

**Verificar:** executar monorepo-wide symbol search para confirmar qual versão é de fato chamada em produção antes de propor remoção. Categoria de alto risco para false positive — validar com cuidado.

---

## 4. Dead Code

Functions, componentes, tipos, imports ou variáveis sem nenhuma referência no repositório.

```ts
import { unusedHelper } from './utils'; // zero references no arquivo
```

**Verificar:** executar symbol search pelo nome exportado em todo o monorepo (`frontend/` e `backend/`) — dynamic import, uso em teste ou consumo por outro pacote invalida o achado.

Ver "Sem Código Morto" no `/AGENT.md`.

---

## 5. Stale Comments / Outdated Annotations

Comentários descrevendo comportamento que não existe mais, ou documentando uma decisão já revertida.

```ts
// TODO: remover quando v2 estiver pronta (v2 está em produção há meses)
// Antigo: usava localStorage, agora usa cookie — (código abaixo não corresponde mais)
```

**Sinal forte:** comentário referencia variável, fluxo ou prop que não existe no bloco de código logo abaixo.

---

## 6. Obsolete Props / Legacy Interface Fields

Interfaces/tipos carregando campos de uma versão anterior do componente, ou props passadas adiante sem uso no destino.

```ts
interface AnimalCardProps {
  animal: Animal;
  legacyMode?: boolean; // não lido em nenhum lugar do componente
}
```

**Verificar:** confirmar se o campo é lido no corpo do componente/função antes de marcar como obsolete.

---

## 7. Debug Artifacts

```ts
console.log('aqui', data);
debugger;
const MOCK_USER = { ... }; // usado só durante desenvolvimento
```

Ver "Sem Código Temporário" no `/AGENT.md`. Exceção: structured logging intencional (não é debug esquecido).

---

## 8. Inconsistent Patterns

O mesmo tipo de problema (validação de formulário, HTTP call, date formatting) implementado de formas diferentes em arquivos próximos — sinal de que a IA não reaproveitou o padrão já estabelecido no projeto.

Ver "Reutilize Padrões Existentes" no `/AGENT.md`.

**Não confundir com legado intencional** (tela antiga que ainda não foi migrada) — só reportar quando as duas implementações forem recentes/concorrentes.

---

## 9. Orphaned Routes / Endpoints (Backend)

Rota registrada em `backend/src/routes` sem nenhuma chamada correspondente em client conhecido.

**Sinal:** `router.get('/legacy-report', ...)` sem nenhum `fetch`/`axios` para essa URL no frontend ou em outro serviço.

**Verificar:**
- Symbol search pelo path da rota no frontend inteiro (`src/`), incluindo variações com template string e base URL
- Confirmar que não é rota pública consumida por integração externa (webhook, terceiro) — nesse caso, reportar como `suspected`, nunca `confirmed`

---

## 10. Duplicate Service / Repository (Backend)

Duas functions de acesso a dado ou regra de negócio executando a mesma query/validação, uma geralmente mais nova e não totalmente adotada.

```js
// Ruim: duplicate service functions
async function getUserByEmail(email) { ... }
async function findUserByEmailAddress(email) { ... } // mesma query, adicionada depois
```

**Verificar:** qual é chamada pelas rotas atuais antes de recomendar merge.

---

## 11. Orphaned Schema (Database)

Coluna ou tabela definida em `backend/src/db/migrations.js` sem nenhuma referência em routes, services ou frontend (nem lida, nem escrita, nem retornada em API response).

Tratamento conservador obrigatório — ver seção "Database Audit" no `SKILL.md`. Confidence level nunca `confirmed`. Nunca editar `migrations.js` nem propor `ALTER`/`DROP`. Apenas reportar para decisão manual do usuário.

---

## 12. Naming Convention Violation (Non-English Identifier)

Identifier (função, variável, tipo, arquivo, tabela/coluna) em português dentro de **código novo ou recém-alterado** (dentro do scope revisado), violando a seção "English-Only Codebase" do `/AGENT.md`.

```ts
// Ruim, se for código novo:
function buscarContribuinte() { ... }
```

Não reportar identifiers em português que já existiam antes do scope revisado — são technical debt aceita. Só os que aparecem como parte da mudança atual, a menos que o usuário solicite naming convention audit de um módulo inteiro.

---

## 13. Incomplete Removal Masked with Specificity Override

Quando uma remoção anterior não apagou **todas** as ocorrências da classe/regra envolvida, e a fonte remanescente foi "resolvida" empilhando `!important` ou seletor mais específico em vez de remover a referência da fonte original.

```css
/* Ruim: incomplete removal mascarada com !important */
.componente-a-classe-x {
  border: 0 !important; /* specificity override — patch por cima */
}

.workspace-heading .toolbar,
.componente-a-classe-x,   /* deveria ter sido removida daqui */
.componente-b,
.componente-c {
  border: 1px solid var(--ui-border); /* ainda aplica a borda que devia sumir */
}
```

**Sinais:**
- Regra com `!important` cujo comentário menciona "sobrepor" ou "vencer" outra regra em vez de simplesmente não haver conflito
- Mesma classe em múltiplos combined selectors espalhados pelo arquivo, alguns dos quais deveriam ter parado de incluí-la após refatoração
- Comentário `/* sobrepõe X, fora de escopo */` apontando para regra que pertence ao mesmo módulo sendo auditado

**Verificar:** symbol search pelo nome da classe no arquivo inteiro. Se ela aparece em combined selector compartilhado com classes de outros componentes que **continuam precisando** do estilo — a correção é remover apenas aquele nome do seletor, preservando o resto para os outros consumidores.

Esta categoria não é `suspected` quando confirmada — se a classe removida ainda aparece em combined selector e a solução aplicada foi specificity override, reportar como `confirmed`.

---

## 14. Misplaced Code / Wrong Layer

Lógica implementada em uma camada que quebra a separation of concerns do projeto — não está duplicada nem morta, mas está "escondida" onde ninguém vai reaproveitar, ou viola a layered architecture estabelecida (routes → services → repository).

**Sinais:**
- Business logic diretamente em `routes` em vez de `services`
- Utility function genérica (`formatCurrency`, `parseDate`) definida dentro de um componente específico em vez de `utils/`
- Database query executada diretamente na rota, sem passar pelo service layer
- Estilo específico de um módulo (`ag-*`) dentro de bloco genérico/compartilhado de `styles.css`, ou vice-versa

**Verificar:** comparar com o padrão dominante do projeto (outras rotas delegam para `services/`, esta não). Se destoa sem motivo aparente, é achado. Classificar como `suspected` quando mover implica alterar múltiplos arquivos que importam aquele símbolo — o risco de mover é maior que só remover.

---

## 15. Unnecessary Abstraction

Camada de indireção genérica (factory, wrapper, adapter, config object) criada para um caso de uso único — ninguém mais consome aquela abstração, mas ela adiciona complexidade cognitiva ao código.

```ts
// Ruim: abstração sem segundo consumidor
class AnimalServiceFactory {
  static create() { return new AnimalService(); } // chamada em exatamente 1 lugar
}
```

**Verificar:** symbol search pela abstração — se tiver apenas 1 referência no repo inteiro e não houver plano documentado de expansão, é unnecessary abstraction.

---

## 16. Forgotten Feature Flag

Flag criada para rollout gradual cuja feature já está 100% em produção — o `if (flag)` continua no código indefinidamente.

```ts
if (FEATURE_FLAGS.newAnimalForm) { // flag sempre true há meses
  return <NewAnimalForm />;
}
return <OldAnimalForm />; // dead code — nunca renderiza
```

**Verificar:** symbol search pelo nome da flag para localizar onde é definida/atribuída. Se o valor for sempre `true` (ou sempre `false`), o branch morto e a flag configuram dead code removível.

---

## 17. Unused Dependencies

Pacote presente em `package.json` sem nenhum `import`/`require` correspondente no codebase — adicionado para resolver algo pontual, a abordagem mudou, a dependência ficou.

**Verificar:** symbol search pelo nome do pacote em `src/` e `backend/src/`. Confirmar que não é dependência de build/config (ex.: plugin de bundler referenciado só em `vite.config.js`) antes de marcar como unused.

**Classificar sempre como `suspected`** — algumas dependências são peer deps ou são invocadas via CLI/scripts sem import explícito no código fonte.

---

## 18. Concealed Rather Than Removed

A IA **oculta** o código que deveria ter sido deletado em vez de removê-lo — resultado comum em refatorações e substituições onde a IA "garante" que o comportamento antigo não aparece mais sem de fato limpar o arquivo. O código permanece no bundle/codebase, infla o tamanho, confunde leitura e raramente é limpo depois.

**Sinais por camada:**

**CSS/JSX — visual:**
```css
/* Ruim: elemento deveria ter sido removido do JSX */
.old-panel { display: none; }        /* ocultação visual */
.legacy-form { visibility: hidden; } /* ocupa espaço, não renderiza */
.deprecated-card { opacity: 0; pointer-events: none; } /* idem */
```

**JSX/TSX — lógica de renderização:**
```tsx
// Ruim: componente nunca renderiza — deveria ter sido removido
{false && <OldAnimalForm />}
{null && <LegacyReport />}
{0 && <DeprecatedPanel />}
```

**JavaScript/TypeScript — lógica:**
```ts
// Ruim: bloco nunca executa — deveria ter sido deletado
if (false) {
  runLegacyFlow();
}

// Ruim: função retorna antes de qualquer lógica — deveria ter sido removida
function OldComponent() {
  return null; // componente inteiro é dead code
}
```

**Comentários como substituto de deleção:**
```ts
// Ruim: código comentado em vez de deletado
// function oldHandler(e) {
//   submitLegacyForm(e);
// }
```

**Flags de desativação sem plano de reativação:**
```ts
// Ruim: flag criada para "desativar" em vez de remover
const FEATURE_ENABLED = false; // nunca será true novamente
if (FEATURE_ENABLED) { ... }   // dead code protegido por flag

// Ruim: config com entrada desativada sem uso futuro previsto
{ id: 'legacy-report', enabled: false, ... }
```

**Supressão de erros para manter código morto compilando:**
```ts
// @ts-ignore   ← adicionado para calar erro de tipo em código que devia sair
// eslint-disable-next-line  ← idem para lint
```

**Verificar:** para cada ocorrência, confirmar com symbol search que o bloco/elemento não é referenciado nem ativado em nenhum outro lugar. Se o valor da flag/condição for sempre falso e não houver plano documentado de reativação, é concealed dead code — reportar como `confirmed` e recomendar deleção, não apenas "ativar depois".

**Confidence level:** `confirmed` quando a condição é literalmente `false`/`null`/`0` ou a flag tem valor fixo. `suspected` quando a flag vem de config externa ou env var (pode ser `true` em outro ambiente).
