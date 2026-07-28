# Plano de Implementação: Reorganizar tela de Relatórios (busca, filtros, botões, filtro Mutirão)

## Origem

- Especificação: descrita em conversa, a partir de um screenshot da tela "Relatórios" e investigação de código (Agent Explore).
- Data do planejamento: `2026-07-28`
- Classificação: `frontend-only` — toda a mudança fica em `src/features/reports.tsx` e `src/styles.css`. As props necessárias (`globalSearch`, `scheduleDays`) já são passadas de `App.tsx` para todas as views (incluindo `ReportsView`) hoje; não é preciso alterar `App.tsx`.

## Resumo

A tela de Relatórios tem hoje um campo de busca textual local (`filters.search`) que é redundante com a busca global do topbar (`globalSearch`, já existente e já passada como prop a todas as telas, incluindo `ReportsView`, que simplesmente não a usa ainda). Este plano remove o campo local, reaproveita `globalSearch` para alimentar a mesma lógica de detecção de CPF/microchip que hoje habilita o botão "Prontuário" (mantendo essa funcionalidade sem campo próprio), remove o card "Nenhum filtro aplicado", reorganiza a faixa de filtros (filtros à esquerda, botões de ação à direita — corrigindo uma regra CSS `order: -1` que hoje força os botões para o início do flex, resíduo de uma geração de estilo anterior já superada por uma geração mais nova que resolve o alinhamento de outra forma), padroniza o tamanho dos 4 botões de ação mantendo a hierarquia visual, e adiciona um novo filtro "Mutirão" / "Agenda normal" cruzando cada solicitação com o `scheduleDay` correspondente (via `scheduleDays`, já recebida como prop e hoje não utilizada por esta tela).

## Escopo

### Dentro do escopo

- Remover o campo de busca solto (`reports-search-row`/`reports-search-wrap`/`reports-search-input`) da tela de Relatórios.
- Fazer o botão "Prontuário" e a lógica de detecção de CPF/microchip (`detectSearchType`, `canProntuario`, `handleProntuario`) usarem `globalSearch` (prop já recebida de `App.tsx` via `ActiveView`) em vez de `filters.search`.
- Manter o filtro de busca textual dentro da lógica de filtragem (`matchesSearch`), agora também usando `globalSearch` como fonte, para que a busca do topbar continue afetando os resultados da tela quando aplicável — a decidir na implementação se isso é automático (busca global sempre filtra) ou só entra ao clicar "Buscar" (ver Perguntas em aberto).
- Remover o card `EmptyState` "Nenhum filtro aplicado".
- Mover o bloco de botões de ação (`reports-filter-actions`) para a direita da faixa de filtros, via CSS — removendo a regra `order: -1` resíduo (`src/styles.css:25148`), já que uma regra mais recente no mesmo arquivo (`src/styles.css:26323-26334`) já resolve `justify-content: flex-end` corretamente sem precisar de `order`.
- Padronizar altura/padding dos 4 botões (`ghost-button`, `primary-action`, `secondary-action` ×2) especificamente dentro de `.reports-filter-actions`, sem alterar essas classes globalmente (evitar efeito colateral em outras telas que as usam).
- Adicionar filtro "Mutirão" / "Agenda normal" na faixa de filtros, cruzando `request` com `scheduleDays` (prop já recebida) via `scheduleDay.kind` (`"Mutirao"` vs `"Agenda"`, já usado em outras partes do sistema — ver `src/App.tsx:6787-6789`, `8082`, `8126-8319`).

### Fora do escopo

- Alterar `App.tsx` para passar novas props — `globalSearch` e `scheduleDays` já chegam em `ReportsView` hoje (via `ActiveView`, `src/App.tsx:1009-1052`), só não são usadas no componente ainda.
- Persistir/sincronizar `globalSearch` com URL ou localStorage — comportamento já existente (estado do componente raiz), não alterado aqui.
- Mudar o comportamento de `ConfigView`, que já usa `globalSearch` hoje (`src/App.tsx:4599, 4630-4631`) — não tocar nessa lógica existente.
- Redesenhar a tabela de resultados, os breakdowns (Status/Resultado/Tipos/Responsáveis/Taxas) ou a exportação em PDF (`generateReportsPdf`) — já implementados e funcionais, fora do escopo pedido.
- Remover classes `ghost-button`/`primary-action`/`secondary-action` globalmente — só ajustar tamanho/padding no contexto específico de `.reports-filter-actions`.

## Leitura de contexto

- `/AGENT.md` (regras globais). Fluxo real do repositório é commit direto em `main`, sem `staging`/PR (confirmado por planos anteriores já implementados e pela skill `finalizar`).
- Não há `frontend/AGENT.md`/`backend/AGENT.md` neste repositório.
- `src/features/reports.tsx` (arquivo completo lido, 438 linhas) — componente `ReportsView`, `detectSearchType`, `matchesSearch`, `filteredRequests`, botões de ação, `EmptyState`, `generateReportsPdf`.
- `src/App.tsx:771-779` (`ActiveView` map), `:802-805` (`pageHeadings.relatorios`, cabeçalho renderizado fora de `reports.tsx`), `:1009-1052` (props passadas a `ActiveView`, incluindo `globalSearch` e `scheduleDays` já hoje), `:310` (`globalSearch` state), `:984-992` (input de busca global no topbar), `:4599, 4630-4631` (uso de `globalSearch` em `ConfigView`, padrão de referência), `:6787-6789, 8082, 8126-8319` (`scheduleDay.kind`, valores `"Agenda"`/`"Mutirao"`).
- `src/domain.ts:22` (`workflowTagLabels.MUTIRAO`), `:324-326` (`requestHasTag`) — confirmado que a tag MUTIRAO na request não é atribuída automaticamente em nenhum ponto do código hoje; por isso a fonte escolhida para o novo filtro é `scheduleDay.kind`, não a tag.
- `src/styles.css:4845-4944` (bloco base de `.reports-search-row`, `.reports-filter-grid`, `.reports-filter-actions`), `:16363-16400` (segunda geração), `:25127-25151` (terceira geração, contém o `order: -1` resíduo), `:26323-26361` (quarta geração/mais recente, já resolve alinhamento à direita sem `order`).

## Impacto por área

### Frontend

- `src/features/reports.tsx`:
  - Assinatura de `ReportsView`: adicionar `globalSearch = ""` e `scheduleDays = []` aos parâmetros desestruturados (linha 61-68).
  - Remover o bloco JSX de `reports-search-row`/`reports-search-wrap` (linhas 165-183).
  - `detectSearchType`/`canProntuario`/`handleProntuario`/`appliedSearchType`: trocar a fonte de `filters.search` para `globalSearch`.
  - `matchesSearch`/`filteredRequests`: usar `globalSearch` (ou `appliedFilters` continuar guardando uma cópia dela no momento do "Buscar", a decidir — ver Perguntas em aberto) em vez de `appliedFilters.search`.
  - `emptyFilters`/`filters` state: remover o campo `search` (não é mais necessário como filtro local separado).
  - Remover o card `EmptyState` "Nenhum filtro aplicado" (linhas 258-262) — decidir o que renderizar no lugar quando não há `appliedFilters` (ver Perguntas em aberto: tela em branco, ou os breakdowns/tabela já aparecem vazios direto).
  - Reordenar/reagrupar o JSX da faixa de filtros: manter Início/Fim/Tipo/Status/Taxas à esquerda, adicionar novo filtro Mutirão/Agenda, mover `reports-filter-actions` para o fim visualmente à direita (via CSS, sem precisar mudar a ordem do JSX graças à correção do `order: -1`).
  - Adicionar novo estado de filtro `agendaKind` (ou nome similar) em `emptyFilters`/`filters`/`appliedFilters`, com um novo `<select>` (opções: Todos, Mutirão, Agenda normal).
  - Nova função auxiliar para resolver o `scheduleDay` de uma `request` (provavelmente casando por data — `getRequestDate(request)` já existe — com `scheduleDays`, análogo ao padrão já usado em `getDayInfo` de `src/features/agenda.tsx`) e checar `scheduleDay.kind`.
  - Novo `if` dentro do `.filter()` de `filteredRequests` (linha 78-92) para o filtro de Mutirão/Agenda.
  - Adicionar a nova opção ao PDF exportado (`generateReportsPdf`/`filterRows`, linha 378-384), para consistência com os demais filtros já listados ali.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/features/reports.tsx`
- `src/styles.css`

## Estratégia de implementação

1. Remover o bloco JSX do campo de busca local (`reports-search-row`).
2. Trocar a fonte de dados de `detectSearchType`/`canProntuario`/`handleProntuario`/filtro de busca de `filters.search` para a prop `globalSearch`.
3. Remover `search` de `emptyFilters`; simplificar `filters`/`appliedFilters` de acordo.
4. Remover o `EmptyState` "Nenhum filtro aplicado"; o bloco de breakdowns + tabela passa a renderizar sempre (não mais condicionado a `appliedFilters` truthy), exibindo vazio/zerado quando `appliedFilters` for `null`.
5. CSS: remover a linha `order: -1` de `.reports-filter-actions` em `src/styles.css:25148` (não remover o resto do bloco 25147-25151, que ainda define `margin-right`).
6. CSS: adicionar regra de tamanho/padding padronizado para os botões dentro de `.reports-filter-actions` (altura/padding iguais, preservando cor/peso por classe já existente).
7. Adicionar `scheduleDays` à assinatura de `ReportsView`; implementar função de resolução `scheduleDay` a partir da data da `request`.
8. Adicionar novo filtro Mutirão/Agenda: estado, `<select>` no JSX, lógica no `.filter()`, e entrada correspondente em `generateReportsPdf`.
9. Rodar `npm run typecheck` e `npm run build`.
10. Validar visualmente na tela: busca global filtra Relatórios corretamente, botão Prontuário funciona com CPF/microchip digitado na busca global, botões alinhados à direita com tamanho uniforme, filtro Mutirão/Agenda retorna resultados coerentes com o que está configurado em Configurações › Agenda.

## Regras de negócio identificadas

- A busca por CPF/microchip para gerar prontuário deve continuar funcionando mesmo sem campo de busca dedicado na tela de Relatórios — reaproveitando a busca global já existente no sistema.
- O filtro de Mutirão/Agenda reflete a configuração real do dia de agenda (`scheduleDay.kind`), não uma tag manual na solicitação, já que essa tag não é atribuída automaticamente em lugar nenhum do sistema hoje.

## Regras multi-tenant e segurança

- Nenhuma alteração de escopo de tenant — `requests` e `scheduleDays` já chegam para `ReportsView` pré-filtradas por município (via `scopedRequests`/`effectiveScopedScheduleDays` em `App.tsx`), esse plano não muda a origem desses dados.

## Validações necessárias

- Digitar um CPF válido na busca global (topbar) → botão "Prontuário" habilita e gera o prontuário corretamente, mesmo sem estar na tela de Relatórios especificamente ao digitar.
- Aplicar filtro "Mutirão" → só aparecem solicitações cujo dia de agenda tem `kind === "Mutirao"`.
- Aplicar filtro "Agenda normal" → só aparecem solicitações cujo dia de agenda tem `kind === "Agenda"` (ou equivalente/ausente de `"Mutirao"`).
- Solicitação sem `scheduleDay` correspondente (ex: "Nova", sem data marcada) não deve quebrar o filtro nem aparecer incorretamente classificada.
- Botões de ação visualmente alinhados à direita, mesma altura/padding entre os 4.
- Exportação em PDF continua funcionando e reflete os filtros aplicados, incluindo o novo filtro Mutirão/Agenda.

## Testes necessários

### Frontend

Nenhuma suíte automatizada pré-existente para esta tela; validação manual dos cenários acima.

### Backend

Sem impacto.

### E2E

- Fluxo: digitar CPF na busca global → navegar para Relatórios → clicar "Buscar" → aplicar filtro Mutirão → exportar PDF → conferir se todos os filtros aparecem corretamente no PDF gerado.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- `globalSearch` é estado do componente raiz (`App.tsx`), não persistido — se o usuário limpar a busca global antes de ir para Relatórios, o botão Prontuário fica sem valor (comportamento herdado do padrão já existente, usado da mesma forma por `ConfigView`, não é regressão nova).
- Resolver `scheduleDay` a partir de uma `request` exige alguma lógica de correspondência por data — precisa seguir exatamente o mesmo padrão já usado em `src/features/agenda.tsx` (`getDayInfo`/`requestDateStr`) para não introduzir uma segunda forma divergente de fazer o mesmo cruzamento (ver regra "Reutilize Padrões Existentes" do `/AGENT.md`).
- CSS: `.reports-filter-actions` aparece em pelo menos 4 gerações diferentes no arquivo (`styles.css:4932`, `16363+`, `25147`, `26323`) — remover só a linha `order: -1` da geração 3, sem tocar nas demais gerações, que continuam ativas e corretas.
- Risco de produção: commit/push direto em `main`, sem `staging`.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — usuário confirmou:

1. Sem `EmptyState`: os breakdowns (Status/Resultado/Tipos/Responsáveis/Taxas) e a tabela aparecem **sempre** renderizados, mesmo antes do primeiro clique em "Buscar" — zerados/vazios até que o usuário aplique um filtro. Ou seja, `appliedFilters` deixa de controlar a renderização condicional do bloco de resultados: o bloco de resultados (breakdowns + tabela) passa a ser sempre visível, calculado a partir de `filteredRequests`, que por sua vez usa `appliedFilters ?? emptyFilters` (ou equivalente) como critério — na prática, `filteredRequests` deve iterar sobre `normalizedReportRequests` filtrando pelos critérios ativos em `appliedFilters`, e se `appliedFilters` for `null`, tratar como "nenhum filtro" (retornar lista vazia, mantendo o comportamento atual de só mostrar dados após "Buscar" — só a mensagem de card foi removida, o comportamento de dados vazios antes do primeiro clique continua).
2. Busca global filtra a tela **só ao clicar "Buscar"**, não em tempo real — `appliedFilters` continua sendo a "foto" congelada no momento do clique; `globalSearch` só é lido para dentro de `appliedFilters`/lógica de filtro no momento de `applyFilters()`, exatamente como os demais campos (`start`, `end`, `type`, `status`, `fee`) já funcionam hoje.

## Critérios de aceite do plano

- Campo de busca local removido da tela de Relatórios.
- Botão "Prontuário" continua funcional, usando a busca global do topbar.
- Card "Nenhum filtro aplicado" removido.
- Botões de ação alinhados à direita da faixa de filtros, com tamanho/padding uniforme entre si.
- Novo filtro "Mutirão"/"Agenda normal" funcional, refletindo `scheduleDay.kind`.
- Build e typecheck passam sem erros novos.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Resolver as duas perguntas em aberto com o usuário antes de finalizar a implementação (ou fazer a escolha mais segura/reversível e documentar a suposição, conforme padrão desta skill quando o plano não é 100% detalhado).
- Reaproveitar o padrão de cruzamento `request` × `scheduleDay` já existente em `src/features/agenda.tsx`, não criar uma segunda lógica divergente.
- Ao remover o `order: -1` em `src/styles.css:25148`, confirmar visualmente que a geração mais recente (`:26323-26334`) de fato assume o alinhamento à direita sem precisar de ajuste adicional.
- Este projeto não usa `staging`; seguir o fluxo real do repositório (commit direto em `main`, sem PR).
- Validar manualmente os cenários descritos antes de considerar a implementação concluída.
