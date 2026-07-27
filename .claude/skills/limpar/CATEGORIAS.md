# Catálogo de resíduo de código gerado por IA

Cada categoria abaixo é um padrão comum quando várias iterações de IA passam pelo mesmo arquivo.

---

## 1. Função/método duplicado

Duas funções que fazem a mesma coisa, geralmente porque a IA criou uma nova em vez de encontrar/reaproveitar a existente.

Sinal: nomes parecidos (`formatDate` / `formatarData` / `getFormattedDate`), ou lógica idêntica com nomes diferentes.

```ts
// Ruim: duas funções fazendo a mesma coisa
function formatPhone(v: string) { ... }
function formatPhoneNumber(v: string) { ... } // adicionada depois, mesma lógica
```

Verificar: qual é usada onde, unificar na mais usada, remover a outra.

---

## 2. Estilização duplicada

Comum em `styles.css`/CSS modules quando a IA cria uma classe nova em vez de reutilizar uma existente com o mesmo visual.

Sinal: duas classes com as mesmas propriedades (ou quase), ou o mesmo componente com estilo definido em dois lugares (inline + classe, ou duas classes concorrentes aplicadas ao mesmo elemento).

```css
/* Ruim */
.card-tutor { padding: 16px; border-radius: 8px; background: #fff; }
.tutor-card-v2 { padding: 16px; border-radius: 8px; background: #fff; } /* duplicata */
```

Verificar: qual classe está realmente em uso no JSX antes de remover.

---

## 3. Sobreposição / versões convivendo (v1/v2)

A IA cria uma versão nova de uma função/componente/rota e deixa a antiga no arquivo, às vezes comentada, às vezes só sem uso, às vezes ainda chamada em outro lugar por engano.

Sinais:
- `handleSubmit` e `handleSubmitNew`/`handleSubmitV2` no mesmo arquivo
- componente `AnimalCard` e `AnimalCardNew`
- função inteira comentada `// versão antiga, manter por enquanto`
- dois blocos de JSX quase iguais, um dos quais nunca renderiza (`{false && <OldVersion />}`)

Isso é o padrão mais perigoso de reportar errado — confirmar com grep qual versão é de fato chamada em produção antes de recomendar remoção.

---

## 4. Código morto

Funções, componentes, tipos, imports, variáveis sem nenhuma referência no repositório.

```ts
import { unusedHelper } from './utils'; // nunca referenciado no arquivo
```

Rodar grep pelo nome exportado em todo o monorepo (`frontend/` e `backend/`) antes de confirmar — um export pode ser consumido por outro pacote.

Ver seção "Sem Código Morto" do `/AGENT.md`.

---

## 5. Comentários e anotações antigas

Comentários que descrevem um comportamento que já não existe, ou que documentam uma decisão já revertida.

```ts
// TODO: remover isso quando a v2 estiver pronta (a v2 já está em produção há meses)
// Antigo: usava localStorage, agora usa cookie -- (o código abaixo já não bate com o comentário)
```

Sinal forte: comentário menciona algo (variável, fluxo, prop) que não existe mais no bloco de código logo abaixo.

---

## 6. Heranças/props obsoletas

Interfaces/tipos que ainda carregam campos de uma versão anterior do componente, ou props passadas adiante sem uso no destino.

```ts
interface AnimalCardProps {
  animal: Animal;
  legacyMode?: boolean; // não lido em nenhum lugar do componente
}
```

Verificar se o campo é lido de fato no corpo do componente/função antes de marcar como obsoleto.

---

## 7. Código temporário de debug

```ts
console.log('aqui', data);
debugger;
const MOCK_USER = { ... }; // usado só durante desenvolvimento
```

Ver seção "Sem Código Temporário" do `/AGENT.md`. Exceção: logging estruturado intencional (não é "debug esquecido").

---

## 8. Múltiplos padrões para o mesmo problema

Quando o mesmo tipo de solução (ex.: validação de formulário, chamada HTTP, formatação de data) aparece implementada de duas formas diferentes em arquivos próximos, sinal de que a IA não reaproveitou o padrão já existente no projeto.

Ver seção "Reutilize Padrões Existentes" do `/AGENT.md`.

Não confundir com legado intencional (uma tela antiga em português que ainda não foi migrada) — isso é dívida técnica conhecida, não resíduo de IA. Só reportar quando as duas versões forem recentes/concorrentes.

---

## 9. Rota/endpoint morto (backend)

Rota registrada em `backend/src/routes` que não é chamada por nenhum client conhecido.

Sinal: `router.get('/legacy-report', ...)` sem nenhuma chamada correspondente no frontend (`fetch`/`axios` para essa URL) nem em outro serviço.

Verificar:
- grep pelo caminho da rota no frontend inteiro (`src/`), incluindo variações com template string/base URL.
- confirmar se não é uma rota pública usada por integração externa (webhook, terceiro) antes de marcar como morta — nesse caso, reportar como suspeita, não confirmada.

---

## 10. Serviço/repositório duplicado (backend)

Duas funções de acesso a dado ou regra de negócio fazendo a mesma consulta/mesma validação, uma delas geralmente mais nova e não totalmente adotada.

```js
// Ruim
async function getUserByEmail(email) { ... }
async function findUserByEmailAddress(email) { ... } // mesma query, adicionada depois
```

Verificar qual é chamada pelas rotas atuais antes de recomendar unificação.

---

## 11. Tabela/coluna de banco não utilizada

Coluna ou tabela definida em `backend/src/db/migrations.js` sem nenhuma referência em `backend/src/routes`, `backend/src/services` ou no frontend (nem lida, nem escrita, nem retornada em resposta de API).

Tratamento é sempre mais conservador que código: ver seção "Revisão de banco de dados" do `SKILL.md` — nunca classificar como "confirmado", nunca editar `migrations.js`, nunca propor `ALTER`/`DROP`. Só reportar o achado para decisão manual do usuário.

---

## 12. Nomenclatura fora do padrão (não inglês em código novo)

Identificador (função, variável, tipo, arquivo, nome de tabela/coluna) em português dentro de código **novo ou recém-alterado** (parte do escopo revisado), indo contra a seção "English-Only Codebase" do `/AGENT.md`.

```ts
// Ruim, se for código novo:
function buscarContribuinte() { ... }
```

Não reportar identificadores em português que já existiam antes do escopo revisado (legado aceito) — só os que aparecem como parte da mudança atual, a menos que o usuário peça auditoria explícita de nomenclatura de um módulo inteiro.

---

## 13. Remoção incompleta virou sobreposição (CSS/lógica "vencendo na marra")

Quando uma remoção anterior (de elemento, feature ou estilo) não apagou **todas** as ocorrências da classe/regra envolvida, e a fonte que sobrou foi resolvida empilhando prioridade (`!important`, seletor mais específico, regra duplicada mais abaixo no arquivo) em vez de tirar a referência da fonte antiga. O sintoma visual "some, mas volta com outra aparência" ou "borda que não sai mesmo removendo a classe" é o sinal mais comum disso.

```css
/* Ruim: a classe X foi removida do componente A, mas continua num seletor
   combinado compartilhado com B/C/D — resolvido com !important em vez de
   tirar X da lista */
.componente-a-classe-x {
  border: 0 !important; /* patch por cima */
}

.workspace-heading .toolbar,
.componente-a-classe-x,   /* deveria ter sido removida daqui */
.componente-b,
.componente-c {
  border: 1px solid var(--ui-border); /* ainda aplica a borda que devia sumir */
}
```

Sinais:
- Regra com `!important` cujo comentário explica que está "sobrepondo" ou "vencendo" outra regra, em vez de simplesmente não haver conflito.
- A mesma classe aparece em múltiplos seletores combinados (`.x, .y, .z { ... }`) espalhados pelo arquivo, alguns dos quais deveriam ter parado de incluir aquela classe após uma remoção/refatoração.
- Comentário tipo `/* sobrepõe X, fora de escopo */` apontando para uma regra que, na verdade, está dentro do mesmo módulo/escopo que acabou de ser alterado (não é de fato "fora de escopo" — é resíduo da própria mudança).

Verificar: `grep` o nome da classe no arquivo inteiro. Se ela aparece dentro de um seletor combinado compartilhado com classes de outros componentes que **continuam precisando** daquele estilo — a correção é remover só o nome da classe daquele seletor, preservando o resto da regra para quem ainda usa. Só manter `!important`/especificidade maior quando a regra concorrente pertence a um componente genuinamente fora do escopo da tarefa atual e não pode ser tocada — e mesmo assim, com comentário explicando por quê (ver seção "Eliminar código antigo, duplicado e obsoleto" da skill `implementar`).

Isso não é uma categoria "suspeita" — quando confirmado que a classe removida ainda aparece em outro seletor compartilhado e a solução aplicada foi prioridade/`!important`, reportar como confirmado, com a recomendação de remover a classe do seletor compartilhado (não de apagar a regra inteira).
