# Plano de Implementação: Reescrever geração do PDF do prontuário (eliminar animal fantasma da normalizeRequest)

## Origem

- Arquivo de especificação: conversa com o usuário (2 screenshots — PDF gerado com bug + tela real "Consultar prontuário" como referência de layout), sem `.md` de feature associado
- Data do planejamento: 2026-07-29
- Classificação: `frontend-only`

---

## Resumo

O botão "Baixar prontuário PDF" gera um documento com quase todos os campos como "Não informado"/"Animal sem nome", mesmo quando a tela "Consultar prontuário" mostra os dados corretos (tutor, contato, situação, histórico completo) para o mesmo animal.

Causa raiz confirmada: `generateProntuarioPdf(request = {}, fullHistory)` chama `normalizeRequest(request)` mesmo quando `request` é `{}` (caso mais comum, usado pela tela de consulta pública). `normalizeRequest` ([domain.ts:411-451](../../src/domain.ts#L411-L451)) **sintetiza um animal fantasma** quando `request.animals` está vazio: `{ name: "Animal não informado", species: "Não informado", size: "Não informado", sex: "Não informado", ... }` ([domain.ts:420-433](../../src/domain.ts#L420-L433)).

Como consequência, em `generateProntuarioPdf`:
```
const animals = Array.isArray(req.animals) ? req.animals : [];
const animal = animals[0] || histAnimal;
```
`req.animals` **nunca** é vazio (sempre tem o objeto fantasma sintetizado), então `animal` nunca cai no fallback `histAnimal` (que teria os dados reais vindos de `fullHistory.animal`). O mesmo padrão de "duas fontes paralelas" (`req.*` vs `hist*`) contamina tutor, endereço e outros campos.

A solução é reescrever a função inteira com uma fonte de dados única e explícita por cenário de chamada, eliminando a dependência da `normalizeRequest` para os campos de animal/tutor neste fluxo, e replicando fielmente o layout visto na tela real (2º screenshot do usuário).

---

## Escopo

### Dentro do escopo

- Reescrever `generateProntuarioPdf` ([App.tsx:10970-11229](../../src/App.tsx#L10970-L11229)) do zero — não remendar por cima da versão atual.
- Definir fonte de dados única e explícita por cenário:
  - Consulta pública sem request específica (`generateProntuarioPdf({}, record)`, chamado em 3140/10173): ler animal/tutor/history **exclusivamente** de `fullHistory`, sem sintetizar nada via `normalizeRequest`.
  - Modal de detalhes de uma solicitação específica (`generateProntuarioPdf(req, history)`, chamado em 3261): priorizar os dados da própria `request`, usando `fullHistory` como enriquecimento do histórico completo (não o contrário).
- Página 1: cabeçalho (foto/ícone + nome + espécie·sexo·porte + microchip + município) + 3 cards de resumo (Tutor atual, Contato, Situação) + grid de 6 tiles (Microchip, Espécie/sexo/porte, Próxima agenda, Último procedimento, Municípios, Eventos) — replicando o layout do 2º screenshot (tela real).
- Página 2: Dados clínicos + Histórico completo do animal (timeline), mantendo a paginação já aprovada anteriormente.
- Testar a lógica de extração de dados isoladamente (fora do navegador) com objetos de exemplo simulando os cenários de chamada, antes de considerar concluído.

### Fora do escopo

- Alterar `normalizeRequest` em si — usada em dezenas de outros lugares do app; a mudança é parar de depender dela para animal/tutor neste fluxo específico, não alterar seu comportamento global.
- Alterar o backend/endpoint `/animals/consult` ([backend/src/routes/animals.js:381](../../backend/src/routes/animals.js#L381)).
- Alterar a tela "Consultar prontuário" (`AnimalRecordPanel`) — usada só como referência visual.
- Verificação visual do PDF renderizado nesta sessão (o usuário não pediu; validação será por leitura de código + teste isolado da lógica de dados + typecheck/build).

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md`
- `src/App.tsx` — `generateProntuarioPdf` (linhas 10970-11229), `AnimalRecordPanel` (linhas ~10058-10287, referência de layout), 3 call-sites (linhas 3140, 3261, 10173)
- `src/domain.ts` — `normalizeRequest` (linhas 411-451), causa raiz confirmada
- `backend/src/routes/animals.js` — endpoint `/animals/consult` (linha 381), formato real de `{ animal, tutor, history }` retornado
- Conversa com o usuário (2 screenshots: PDF bugado no Acrobat + tela real "Consultar prontuário")
- Teste isolado (fora do app) confirmando que a lógica de leitura de campos funciona corretamente com dados de exemplo — o bug está na fonte dos dados (`req.animals` sempre populado por `normalizeRequest`), não na lógica de fallback em si

---

## Impacto por área

### Frontend

- **`generateProntuarioPdf`** ([App.tsx:10970-11229](../../src/App.tsx#L10970-L11229)): reescrita completa.
  - Nova lógica de resolução de animal/tutor/history: ler de `fullHistory` como fonte primária quando `request` está vazio; ler de `request` como fonte primária quando ela tem dados reais (`request.animals?.length`), com `fullHistory` complementando o histórico.
  - Página 1 e 2 recriadas para espelhar exatamente os campos/agrupamentos da tela `AnimalRecordPanel`.
  - Reaproveitar as funções de desenho de baixo nível já existentes (`drawProntuarioHeader`, `drawProntuarioSectionTitle`, `drawProntuarioFields`, `drawProntuarioSummaryCards`, `drawProntuarioTimeline`, `drawProntuarioPhotoBox`) — não são a causa do bug, continuam válidas.
- **3 call-sites** ([App.tsx:3140](../../src/App.tsx#L3140), [3261](../../src/App.tsx#L3261), [10173](../../src/App.tsx#L10173)): confirmar que continuam funcionando com a nova lógica interna; ajustar a chamada apenas se a assinatura da função mudar (decisão a confirmar durante a implementação, mantendo o menor diff possível).
- Sem novos componentes React, hooks, query keys ou formulários — mudança isolada à função de geração de PDF (lógica pura, sem estado de UI).
- Testes: sem suíte automatizada configurada para este fluxo; validação via teste isolado de extração de dados (script standalone) + typecheck/build.

### Backend

Sem impacto esperado — o endpoint `/animals/consult` já retorna a estrutura correta (`{ animal, tutor, history }`); o bug é inteiramente client-side.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

---

## Arquivos provavelmente afetados

- `src/App.tsx` — `generateProntuarioPdf` e, se necessário, ajuste mínimo nos 3 call-sites

---

## O que será removido

- A implementação atual de `generateProntuarioPdf` ([App.tsx:10970-11229](../../src/App.tsx#L10970-L11229)) — deletada por completo e substituída pela nova versão. Não haverá duas versões coexistindo.
- Toda leitura de campos via `req.tutor`, `req.cpf`, `req.phone`, `req.email`, `histTutor.name` com ordem de fallback invertida em relação à tela — eliminada, substituída por fonte única e explícita por cenário.
- Nenhuma função de desenho de baixo nível é removida (`drawProntuarioHeader`, `drawProntuarioSectionTitle`, `drawProntuarioFields`, `drawProntuarioSummaryCards`, `drawProntuarioTimeline`, `drawProntuarioPhotoBox`) — continuam sendo a base de renderização, não são a causa do bug.
- Se, durante a implementação, `drawProntuarioSummaryCards` não servir mais à nova estrutura de dados, deve ser removida e recriada — nunca deixada ao lado de uma nova versão paralela.

Se alguma dessas funções de desenho ficar inalcançável após a reescrita, remover — não deixar "por precaução".

> **Atenção para a skill `implementar`:** a função antiga deve ser **deletada e substituída**, não comentada, não envolta em `if (false)`, não mantida ao lado com um nome diferente "só por garantia".

---

## Estratégia de implementação

1. Reler `generateProntuarioPdf` por completo e mapear cada campo usado hoje (animal, tutor, endereço, histórico, status, protocolo) e sua fonte atual (`req.*` vs `hist*`).
2. Definir a nova função com resolução de dados em um único bloco no topo: detectar se `request` tem dados reais (`request?.animals?.length > 0` ou `request?.tutor`) — se sim, usar como fonte primária; senão, usar `fullHistory` como fonte primária. Nunca passar `request` (mesmo vazio) por `normalizeRequest` só para extrair animal/tutor.
3. Recriar a página 1 replicando o layout do 2º screenshot: cabeçalho + 3 cards de resumo + grid de 6 tiles — reaproveitando `drawProntuarioSummaryCards`/`drawProntuarioFields` já existentes, ajustando os dados de entrada para a nova fonte única.
4. Recriar a página 2 (Dados clínicos + Histórico completo) com a mesma fonte de dados única, sem duplicar a lógica de resolução do topo.
5. Rodar grep por `generateProntuarioPdf(` no arquivo inteiro para confirmar os 3 call-sites e testar cada cenário mentalmente (ou via script isolado) contra a nova lógica.
6. Testar a lógica de extração de dados com um script standalone (fora do navegador), simulando os 3 cenários de chamada, para confirmar que nenhum "fantasma" aparece mais nos campos de animal/tutor.
7. `npm run typecheck` e `npm run build`.
8. Sem verificação visual do PDF renderizado, conforme preferência já estabelecida nesta conversa.

---

## Regras de negócio identificadas

- O PDF do prontuário deve refletir fielmente os mesmos dados e agrupamentos visuais apresentados na tela "Consultar prontuário" (`AnimalRecordPanel`).
- Quando a consulta é feita sem uma solicitação específica em mãos (fluxo mais comum — consulta por microchip), os dados devem vir do histórico agregado do animal (`fullHistory`), nunca de um objeto de solicitação vazio sintetizado.
- Quando a geração parte de uma solicitação específica (modal de detalhes), os dados dessa solicitação têm prioridade, complementados pelo histórico completo do animal quando disponível.

---

## Regras multi-tenant e segurança

- Sem alteração de escopo de tenant/prefeitura — a função já recebe dados pré-filtrados pelo backend (`/animals/consult` já aplica `ensureAuthorized`).
- Sem impacto em permissões/autorização.
- Sem exposição de dados sensíveis adicionais — os mesmos campos já exibidos na tela.

---

## Validações necessárias

- Confirmar, via teste isolado (script standalone com dados de exemplo), que os 3 cenários de chamada (`generateProntuarioPdf({}, record)`, `generateProntuarioPdf(req, history)`, `generateProntuarioPdf({}, fullHistory)`) resolvem corretamente animal/tutor/history sem cair no objeto fantasma.
- Confirmar que nenhum campo aparece como "Não informado" quando o dado real existe em `fullHistory`.

---

## Testes necessários

### Frontend

- Sem suíte automatizada configurada para este fluxo. Validação via script standalone (Node, fora do navegador) simulando os 3 cenários de chamada com dados de exemplo.

### Backend

- Sem impacto esperado.

### E2E

- Não aplicável — sem infraestrutura de Playwright configurada para este fluxo específico.

---

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

---

## Riscos e pontos de atenção

- Médio: 3 call-sites com contextos de dados diferentes — reescrever com cuidado para não quebrar nenhum dos 3 cenários (consulta pública, modal de detalhes, tela do tutor).
- Sem verificação visual do PDF renderizado nesta sessão (conforme preferência já indicada pelo usuário) — validação limitada a leitura de código, teste isolado de dados e typecheck/build. Recomendo que o usuário baixe o PDF manualmente após a implementação para confirmar visualmente.
- Risco de afetar produção: commit/push são feitos direto em `main`, sem `staging`.

---

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- `generateProntuarioPdf` não depende mais de `normalizeRequest` para resolver animal/tutor quando `request` está vazio.
- Teste isolado confirma que os 3 cenários de chamada resolvem os dados reais corretamente (sem "Não informado" quando o dado existe).
- Página 1 e 2 do PDF replicam o layout e agrupamento de dados da tela "Consultar prontuário".
- `npm run typecheck` e `npm run build` passam sem erros.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não há migrations neste projeto para este fluxo — nada a executar.
- Deletar a implementação atual de `generateProntuarioPdf` por completo — não comentar, não ocultar, não manter versão paralela.
- Testar a lógica de extração de dados isoladamente antes de considerar concluído (sem depender de verificação visual do PDF).
- Manter a alteração focada na função e, se necessário, ajustes mínimos nos 3 call-sites.
