# Plano de Implementação: Painel do gestor com gráficos

## Origem

- Arquivo de especificação: conversa de 2026-11-17 (análise do dashboard e proposta aprovada no chat)
- Data do planejamento: `2026-11-17`
- Classificação: `frontend-only` (cálculos no navegador sobre os dados que o painel já recebe; única novidade é a dependência `recharts` + `react-is`)

---

## Resumo

O `src/features/dashboard.tsx` (1.028 linhas, 6 abas) repete os mesmos ~20 números em várias abas com nomes diferentes e tem cálculos errados (ausências fixas em zero, comparecimento que conta indeferidas, "conclusão" que soma canceladas, bairros "com demanda" que contam só realizadas, meses fora de ordem). Ele vira a pasta `src/features/dashboard/` com 6 abas de temas distintos — **Visão geral, Fila, Agenda e horários, Bairros, Equipe, Animais e adoção** — onde cada número aparece em um lugar só, com gráficos de linha, colunas, barras e rosca (Recharts), calendário e matriz de calor (grade CSS) e cards. Sem colunas empilhadas.

---

## Escopo

### Dentro do escopo

- Nova tela do painel com as 6 abas abaixo e o filtro de período (30 dias, 90 dias, 12 meses, Tudo).
- Correção de todos os cálculos listados em "Regras de negócio".
- Tabela de bairros com todos os bairros cadastrados, inclusive os nunca atendidos.
- Horários: ocupação e faltas por horário da agenda, ocupação por dia da semana e por local, matriz de entrada das solicitações.
- Remoção do arquivo antigo e de todas as regras `.opdash-*` do `styles.css`.

### Fora do escopo

- Mapa com pontos das solicitações (coordenadas nem sempre existem; decidido deixar fora).
- Qualquer mudança no backend, no banco ou em relatórios/PDFs.
- Migração para Tailwind + shadcn/ui (plano próprio); o Recharts foi escolhido por ser a base dos gráficos do shadcn.
- Clique no bairro filtrando o painel inteiro.

---

## Leitura de contexto

- `/AGENT.md`
- `src/features/dashboard.tsx` (inteiro)
- `src/App.tsx` (import na linha 153, `ActiveView` nas linhas 807–815, props na linha 1040+, `mergeScheduleDaysWithRules` na linha 10500)
- `src/domain.ts` (`normalizeRequest` linha 393, `normalizeRequestStatus` linha 292, `normalizeScheduleSlots` linha 182, `countRequestAnimals`/`countUsedVacancies` linhas 553–562, `scheduleSlotTime` linha 473)
- `src/analytics.ts` (`countBy`, `countByMany`, `topItems`, `parseAnyDate`, `getRequestUserName`, `getRequestClosedByName`, `getRequestTypeNames`)
- `src/features/neighborhoods/neighborhoods.ts` (`neighborhoodKey`, `neighborhoodNames`, `findNeighborhoodName`)
- `src/features/neighborhoods/neighborhood-report.ts` (`tutorNeighborhoodOf`, `animalNeighborhoodsOf`, `NO_NEIGHBORHOOD_LABEL`)
- `shared/request-contract.js` (`RequestStatus`, `RequestOrigin`)
- `shared/notification-contract.js` (`NO_SHOW_CANCEL_REASON`, `REJECTED_CANCEL_REASON`)
- `backend/src/db/migrations.js` (`schedule_days` com `slots`, `weekday`, `location_name`; `requests` com `schedule_location_name`)

---

## Impacto por área

### Frontend

**Abas e conteúdo (cada número em um lugar só):**

| Aba | Elemento | Tipo |
|---|---|---|
| Visão geral | Cards: Solicitações ▲▼, Fila ativa, Realizadas ▲▼, Comparecimento ▲▼, Tempo médio até realizar ▲▼, Adoções ▲▼ | Cards |
| | Entradas × realizadas no tempo | Linha (2 linhas) |
| | Situação atual (novas, agendadas, realizadas, canceladas) | Rosca |
| | Alertas: sem responsável, 7+ dias, 15+ dias, cadastro incompleto | Lista com cor |
| Fila | Idade da fila (0–2, 3–6, 7–14, 15+ dias) | Colunas |
| | Recebidas → agendadas → realizadas | Funil (barras horizontais decrescentes) |
| | Motivos de cancelamento (indeferida, não compareceu, outros) | Rosca |
| | Tempo médio até realizar no tempo | Linha |
| Agenda e horários | Cards: vagas ofertadas, ocupação %, faltas %, próximo dia com vaga | Cards |
| | Ocupação de cada data da agenda | Calendário de calor |
| | Ocupação por horário | Barras horizontais com % |
| | Faltas por horário | Colunas (%) |
| | Ocupação por dia da semana | Colunas (%) |
| | Entrada das solicitações: dia da semana × faixa de 2 horas | Matriz de calor |
| | Ocupação por local (só se houver mais de um local) | Barras horizontais |
| Bairros | Cards: cadastrados, com atendimento, nunca atendidos, cobertura % | Cards |
| | Tabela de bairros (ordenável) | Tabela |
| | Bairro × tipo de solicitação | Matriz de calor |
| Equipe | Atribuídos × encerrados por responsável | Barras lado a lado (agrupadas, não empilhadas) |
| | Fila por setor | Barras horizontais |
| | Concentração de carga | Card |
| Animais e adoção | Espécie, sexo | 2 roscas |
| | Porte | Colunas |
| | Origem (formulário público × cadastro interno) | Rosca |
| | Adoções no tempo + disponíveis, adotados, interesses | Linha + cards |

**Tabela de bairros — colunas:** Bairro | Solicitadas | Animais atendidos | Na fila | Realizadas | Canceladas | % concluído (com mini barra) | Tipo mais pedido | Último atendimento (ou selo "Nunca atendido"). Ordena por qualquer coluna ao clicar no cabeçalho; padrão: Solicitadas, decrescente.

**Estados:** cada gráfico mostra "Sem dados no período." quando vazio; a aba Bairros explica quando não há bairros cadastrados (apontando Configurar Ambiente → Bairros).

**Cores:** do app (`var(--blue)`, `var(--teal)` etc.), seguindo a skill `dataviz` para paleta, legenda e tooltip. Calendário de calor: verde a partir de 80%, amarelo de 50% a 79%, vermelho abaixo de 50%, com o % no tooltip.

**Tipografia:** variáveis `--type-*` existentes. Reaproveitar `.panel`, `.panel-header`, `.page-toolbar`, `.status-badge` e o estilo de tabela já existente; classes novas só para o que não existe (grade do painel, calendário e matriz de calor, card com seta), sem `!important`.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto em env, Render ou comandos. O bundle do front cresce (~100 kB gzip com o Recharts).

---

## Arquivos provavelmente afetados

Novos (`src/features/dashboard/`, cada arquivo até ~250 linhas):

- `dashboard-view.tsx` — tela: abas, filtro de período, repassa os dados filtrados
- `dashboard-period.ts` — enums `DashboardTab` e `DashboardPeriod`, início do período, período anterior, agrupamento (dia/semana/mês)
- `time-series.ts` — séries no tempo em ordem de calendário, com zero nos buracos
- `queue-metrics.ts` — situação, idade da fila, funil, motivos de cancelamento, tempo até realizar, alertas
- `schedule-metrics.ts` — ocupação por data, horário, dia da semana e local; faltas por horário; matriz de entrada
- `neighborhood-metrics.ts` — linhas da tabela, cobertura, matriz bairro × tipo
- `team-metrics.ts` — atribuídos × encerrados, fila por setor, concentração
- `animal-metrics.ts` — espécie, sexo, porte, origem, adoção
- `charts/` — `line-chart.tsx`, `donut-chart.tsx`, `bar-chart.tsx` (vertical/horizontal/agrupado), `funnel-chart.tsx`, `calendar-heat.tsx`, `heat-matrix.tsx`, `kpi-card.tsx`
- `tabs/` — `overview-tab.tsx`, `queue-tab.tsx`, `schedule-tab.tsx`, `neighborhoods-tab.tsx`, `team-tab.tsx`, `animals-tab.tsx`
- `neighborhood-table.tsx`
- `*.test.ts` das funções de cálculo

Alterados:

- `src/App.tsx` _(só o import da linha 153; `neighborhoods={scopedNeighborhoods}` já chega ao `ActiveView`)_
- `src/styles.css` _(remover `.opdash-*`, adicionar as poucas regras novas)_
- `package.json` e `package-lock.json` _(`recharts` ^3 e `react-is` ^18)_

Apagado:

- `src/features/dashboard.tsx`

---

## O que será removido

- `src/features/dashboard.tsx` inteiro, com os componentes `KpiCard`, `Panel`, `Ranking`, `Trend`, `Funnel`, `MiniMetric`, `ProgressLine`, `SignalList`, `DecisionList`, `ScheduleList`.
- Cálculos errados ou repetidos: `absent = 0` fixo; `approved`/`waitingProcedure`/`castration.approved`/`castration.waiting` (o mesmo filtro com quatro nomes); `approvalRate` ("Deferimento"); `conclusionRate` que soma canceladas; `operational.bottlenecks`; "Taxa de execução"; `staleQueue` (duplicata de `waiting7`); `operationSignals`, `processSignals`, `productivitySignals`, `statisticsSignals`, `managementSignals`, `territorialSignals`, `decisionAnalysis`; `castration` (com `attendanceRate` sempre 100%); `territorial`; `buildMonthlySeries`/`buildAdoptionSeries` (ordem da lista).
- Não usados: imports `escapeHtml` e `requestHasTag`; `mutirons`, `rejected`, `averageAdoptionDays`, `adoption.total`.
- Cards de usuários (Usuários, Ativos, Inativos, Setores) e rankings "Usuários por setor/cargo".
- Ids de aba em português (`gestao`, `operacao`, `processos`, `produtividade`, `territorio`, `estatisticas`).
- Todas as regras `.opdash-*` do `src/styles.css` (537 ocorrências; blocos em torno das linhas 10195–11570, 15332–15346, 18812–19245, 20014–20091, 21020, 22639, 22909–22952, 23070–23169, 23269–23586, 23701–23811, 23859–23862, 24236, 24375–24405, 24451–24452), inclusive duplicadas e `!important`. Remover só seletores `.opdash`; regras vizinhas que não são do painel (ex.: `.stat-card`, linha 10230) ficam se forem usadas em outro lugar e saem se só o painel as usava.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. Instalar `recharts` (^3, `engines.node >=18`, peer React 18) e `react-is` (^18) com `npm install`; conferir que o lockfile mudou só por eles.
2. Criar `dashboard-period.ts` (enums, período atual e anterior, agrupamento) e `time-series.ts`. Usar `RequestStatus`, `RequestOrigin`, `NO_SHOW_CANCEL_REASON` e `REJECTED_CANCEL_REASON` do `shared/`, sem strings de status no código.
3. Escrever as funções de cálculo puras (fila, agenda, bairros, equipe, animais) reutilizando `analytics.ts`, `countRequestAnimals`, `normalizeScheduleSlots`, `neighborhoodKey`, `neighborhoodNames`, `findNeighborhoodName`, `animalNeighborhoodsOf`, `tutorNeighborhoodOf`; testes junto.
4. Ler a skill `dataviz` e criar os componentes de `charts/`, o card com seta e a tabela ordenável.
5. Montar as 6 abas em `tabs/` e o `dashboard-view.tsx`.
6. Trocar o import em `src/App.tsx:153`.
7. Apagar `src/features/dashboard.tsx` e as regras `.opdash-*`; escrever as regras novas.
8. Rodar typecheck, testes (front e back) e build uma vez, ao final; conferir `curl localhost:3002/health` depois do build.

---

## Regras de negócio identificadas

- **Fila** = novas + agendadas, **sem filtro de período** (o que está aberto hoje conta, entre quando entrar). O período vale para o que aconteceu: entradas, realizações, faltas, adoções.
- **Faltas** = canceladas com `cancelReason` igual a `NO_SHOW_CANCEL_REASON`.
- **Indeferidas** = canceladas com `cancelReason` igual a `REJECTED_CANCEL_REASON`; demais canceladas = "outros".
- **Comparecimento** = realizadas ÷ (realizadas + faltas).
- **Funil:** Recebidas (todas do período) → Agendadas (agendadas + realizadas + faltas) → Realizadas.
- **Tempo até realizar:** só realizadas; da criação até a data da agenda da solicitação, ou até a última atualização quando não houver agenda.
- **Seta ▲▼:** compara com o período anterior do mesmo tamanho; não aparece nos cards de situação atual (Fila ativa) nem em "Tudo".
- **Séries no tempo:** ordem de calendário, zero nos intervalos sem dado; 30 dias por dia, 90 dias por semana, 12 meses e Tudo por mês.
- **Idade da fila:** dias desde a criação, faixas 0–2, 3–6, 7–14, 15+.
- **Alertas:** sem responsável (sem `assignedUserId` e sem `responsible`), 7+ dias, 15+ dias, cadastro incompleto (sem telefone, CPF, endereço, bairro ou CEP).
- **Ocupação da agenda:** animais agendados (`countRequestAnimals`) ÷ vagas; casamento solicitação × dia pela data da agenda (como `countUsedVacancies`).
- **Ocupação por horário:** animais com `scheduleSlotTime` igual ao horário ÷ soma das vagas desse horário nos dias do período; sem horário → "Sem horário".
- **Faltas por horário:** faltas ÷ agendados (realizadas + faltas) naquele horário.
- **Ocupação por dia da semana e por local:** mesma conta agrupada por dia da semana do dia da agenda e por `scheduleLocationName`; o gráfico por local só aparece com mais de um local.
- **Entrada das solicitações:** matriz 7 dias da semana × 12 faixas de 2 horas, pela data e hora de criação.
- **Bairro de uma solicitação:** os bairros dos animais (`animalNeighborhoodsOf`); se nenhum animal tiver bairro, o do tutor (`tutorNeighborhoodOf`); se nenhum, "Não informado". Uma solicitação com animais em dois bairros conta uma vez em cada.
- **Nome do bairro:** comparado por `neighborhoodKey`; mostra o nome cadastrado quando casa (`findNeighborhoodName`); nomes que não estão cadastrados também entram, com o nome como foi salvo.
- **Tabela de bairros:** contém todos os bairros cadastrados ativos, mesmo com zero. Colunas seguem o período, contando **solicitações**; "Animais atendidos" conta os animais das solicitações realizadas daquele bairro. "Último atendimento" e "Nunca atendido" olham todo o histórico.
- **Cobertura** = bairros cadastrados ativos com ao menos uma realização (no histórico todo) ÷ bairros cadastrados ativos.
- **Matriz bairro × tipo:** linhas = bairros com ao menos uma solicitação no período, em ordem decrescente; colunas = tipos de solicitação presentes (`getRequestTypeNames`).
- **Equipe:** atribuídos por `getRequestUserName`; encerrados por `getRequestClosedByName`; fila por setor conta só o que está aberto; concentração = % da fila com o responsável que mais tem.
- **Animais:** espécie, sexo e porte contam animais das solicitações do período; origem conta solicitações por `RequestOrigin`.
- **Adoção:** adoções no tempo pela data de adoção dos animais adotados; disponíveis, adotados e interesses como hoje.

---

## Regras multi-tenant e segurança

- O painel recebe `requests`, `scheduleDays`, `neighborhoods`, `teams` e `adoptionAnimals` já escopados pelo município no `App.tsx` (`scopedRequests`, `scopedNeighborhoods` etc.); nada muda nessa origem.
- Sem backend novo, sem exportação, sem PDF: nenhum caminho novo de vazamento entre prefeituras.
- Nada de dado pessoal (nome, CPF, telefone) nos gráficos; a tabela mostra só bairros e contagens.

---

## Validações necessárias

- Datas inválidas ou ausentes são ignoradas nas séries (não quebram o gráfico).
- Divisões por zero devolvem 0% (ou "—" na tabela).
- Horários vindos de `slots` normalizados com `normalizeScheduleSlots`.

---

## Testes necessários

### Frontend (vitest, só valores falsos)

- `dashboard-period`: período anterior do mesmo tamanho; agrupamento por dia/semana/mês; "Tudo" sem período anterior.
- `time-series`: ordem de calendário e zero nos buracos, com a lista de entrada fora de ordem.
- `queue-metrics`: faltas pelo motivo; comparecimento; funil; motivos de cancelamento; idade da fila; fila ignora o período.
- `schedule-metrics`: ocupação contando animais; ocupação e faltas por horário; "Sem horário"; dia da semana; matriz de entrada.
- `neighborhood-metrics`: "Centro"/"centro" viram um só; fallback para o bairro do tutor; cadastrados com zero aparecem; último atendimento fora do período; cobertura; solicitação com animais em dois bairros.
- `team-metrics` e `animal-metrics`: contagens básicas.

### Backend

- Sem mudança; rodar a suíte para garantir que nada quebrou.

### Conferência manual (tela)

- Nenhum número repetido entre as abas.
- Faltas diferentes de zero quando há cancelamentos por "Não compareceu".
- Bairros cadastrados sem atendimento aparecem como "Nunca atendido".
- Linhas do tempo em ordem de calendário em cada período.
- Calendário de calor com as cores certas e o % no tooltip.
- Nenhum gráfico com colunas empilhadas.

---

## Comandos de validação sugeridos

```bash
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

---

## Riscos e pontos de atenção

- Bundle cresce ~100 kB gzip com o Recharts.
- Regras `.opdash-*` espalhadas por muitos blocos do CSS: remover só os seletores do painel sem levar regras vizinhas.
- Os números mudam (comparecimento, conclusão, bairros estavam errados); o gestor pode estranhar no começo.
- Solicitações antigas sem horário ou sem bairro do animal caem em "Sem horário" ou no bairro do tutor.
- Cálculos no navegador sobre todas as solicitações carregadas: usar `useMemo` por aba.
- Build pode derrubar o back servindo o `dist` (ENOENT): conferir `/health` depois.
- Commit e push direto em `main`, sem `staging`.

---

## Perguntas em aberto

- Bairros: contar solicitações ou animais? Assumida a recomendação (solicitações, com a coluna "Animais atendidos"); ajustar se o usuário preferir outra coisa.

---

## Critérios de aceite

- As 6 abas existem com o conteúdo da tabela de "Impacto por área" e nenhum número aparece em duas abas.
- Nenhum gráfico de colunas empilhadas.
- Faltas, comparecimento, funil e motivos de cancelamento seguem as regras acima.
- Tabela de bairros mostra todos os cadastrados, ordena por coluna e marca "Nunca atendido".
- Séries no tempo em ordem de calendário.
- `src/features/dashboard.tsx` e todas as regras `.opdash-*` removidos; nenhum arquivo novo acima de ~250 linhas.
- Typecheck, testes (front e back) e build sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
