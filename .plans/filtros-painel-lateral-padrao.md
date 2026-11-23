# Plano de Implementação: Filtros e painéis laterais no padrão de Processos + cabeçalho da tabela de Bairros

## Origem

- Arquivo de especificação: escopo alinhado na conversa (sem `.md` de feature)
- Data do planejamento: `2026-11-23`
- Classificação: `frontend-only` — os filtros atuam sobre os dados que o app já carregou do município; nada muda em servidor, banco ou isolamento entre municípios.

---

## Resumo

Criar um painel lateral único à direita e usá-lo em Filtros (Processos, Relatórios e Agenda) e em Notificações. Em todas as telas, o botão do painel de filtros passa a ser **"Ativar"**: ele aplica o que foi marcado e fecha o painel. Relatórios perde os botões "Hoje" e "Buscar". A Agenda troca as duas caixas de seleção pelo modelo de Processos. Na tabela de Bairros do Dashboard, os títulos deixam de ser pílulas e as colunas ganham o alinhamento combinado.

---

## Escopo

### Dentro do escopo

- Painel lateral comum (fundo escurecido, painel à direita, cabeçalho, conteúdo com rolagem, rodapé opcional).
- Painel de filtros genérico (painel lateral + grupos de caixas de marcar + "Limpar" / "Ativar").
- **Ativar aplica e fecha em Processos, Relatórios e Agenda.** O painel edita um rascunho. Fechar pelo X, pelo fundo ou pelo Esc descarta o rascunho. "Limpar" limpa só o rascunho, que só vale depois de "Ativar".
- As contagens dentro do painel refletem o rascunho, como Relatórios já faz.
- Processos: mantém o botão "Hoje", que continua valendo na hora por ficar fora do painel.
- Relatórios: sem "Hoje", sem "Buscar"; "Filtros" à direita; "Exportar" e "Prontuário" à esquerda.
- Notificações: a lista abre no painel lateral.
- Agenda: filtros "Tipo de atendimento" e "Status" no painel, com **mais de uma opção marcável** e contagem; botão "Filtros" com contador; etiquetas removíveis.
- Bairros: títulos como texto simples, que ainda ordena ao clicar, **no mesmo estilo dos títulos da tabela de Relatórios** (pequeno, cinza, caixa alta). "Bairro" fica à esquerda e as demais colunas centralizadas, nos títulos e nos dados.

### Fora do escopo

- Painel do dia da Agenda (`DayPanel`, classes `ag-drawer*`): continua como está.
- `.topbar` do admin: não mexer.
- Backend, banco, contratos em `shared/`.
- Testes visuais: ficam com o usuário.

---

## Leitura de contexto

- `/AGENT.md`
- `src/features/request-filters/request-filters-drawer.tsx`, `request-filters-toolbar.tsx`, `active-filters-bar.tsx`, `use-request-filters.ts`, `request-filters.ts`, `request-stage.ts`
- `src/App.tsx` (trechos 3029–3030, 3096–3150 e 3206–3220 — lista de Processos)
- `src/features/reports/reports-view.tsx`, `report-filters.ts`, `operational-report.test.tsx`
- `src/features/agenda/agenda-view.tsx` (linhas 141–200, 270, 296–340), `agenda-view.test.tsx`
- `src/features/staff-notifications/staff-notification-bell.tsx`, `staff-notifications.test.tsx`
- `src/features/dashboard/neighborhood-table.tsx`
- `src/components/button.tsx`, `config-dialog.tsx`, `modal-focus.ts`
- `src/styles.css` (`.reports-table` ~3182, `.ag-filter-stack` ~4255 e ~5056, `.dash-table` ~11408)
- `shared/request-contract.js` (`RequestStatus`)

---

## Impacto por área

### Frontend

**1. Painel lateral comum** — novo `src/components/side-panel.tsx`
- Leva a estrutura que hoje está escrita dentro de `RequestFiltersDrawer`: fundo `tw:fixed tw:inset-0 tw:z-[210]` com desfoque, `aside` à direita com `tw:z-[211] tw:max-w-[420px]` e `role="dialog"`, `aria-modal`, `aria-labelledby`.
- Props: `title`, `label` (linha pequena acima do título), `closeLabel`, `onClose`, `returnFocus?`, `footer?`, `children`.
- Foco e Esc: usa `useModalFocus(ref, true, returnFocus)` com `data-managed-dialog`, como o painel atual. O Esc já é tratado lá.

**2. Painel de filtros genérico** — novo `src/features/request-filters/filters-drawer.tsx`
- `FiltersDrawer`: painel lateral com `label` (nome da seção), título "Filtros" e rodapé com "Limpar" (`clearDisabled`, `onClear`) e **"Ativar"** (`onApply`, `applyDisabled`), mantendo o estilo atual do botão principal.
- `FilterGroup` é movido de `request-filters-drawer.tsx` para cá sem mudança de comportamento: busca com 7 ou mais opções, contagem e opção esmaecida quando a contagem é zero.
- `RequestFiltersDrawer` passa a montar `FiltersDrawer` com os grupos Etapa, Tipo e Responsável mais os filtros adicionais. Perde a prop `resultCount`.

**3. Botões de filtro** — `request-filters-toolbar.tsx`
- O "Hoje" vira opcional: `today?: { active: boolean; count: number; onToggle: () => void }`. Sem `today`, aparece só "Filtros".
- `aria-label` continua `Filtros de {seção}`.

**4. Barra de filtros ativos** — `active-filters-bar.tsx`
- Troca a prop `filters` por `canClear: boolean`, e cada tela decide quando mostrar "Limpar filtros". Total e etiquetas continuam iguais.

**5. Processos** — `use-request-filters.ts` e `App.tsx`
- Nova ação `APPLY` no `requestFiltersReducer` (`{ type: APPLY; filters }`), exposta como `actions.apply(filters)`.
- `toggleStage`, `toggleType` e `toggleAssignee` saem do objeto `actions` do hook. A edição passa a acontecer no rascunho via `requestFiltersReducer`, como em Relatórios.
- No `App.tsx`, `filtersDrawerOpen` dá lugar a `filtersDraft: RequestListFilters | null` (`null` = painel fechado), seguindo o padrão de `reports-view.tsx`.
- Ao abrir, `filtersDraft = requestFilters`.
- A prévia usa `buildRequestFilterResults` com o rascunho e só é calculada com o painel aberto. As contagens e as opções do painel vêm dela.
- "Ativar" chama `actions.apply(filtersDraft)` e fecha. "Limpar" aplica `CLEAR_ALL` ao rascunho. Fechar descarta.
- "Hoje", a remoção de etiquetas e o "Limpar filtros" fora do painel continuam valendo na hora.
- `canClear = !isRequestFiltersEmpty(requestFilters)`.

**6. Relatórios** — `reports-view.tsx`, `report-filters.ts`
- Linha de cima: à esquerda "Exportar" e "Prontuário"; à direita `RequestFiltersToolbar` sem `today`.
- Ao abrir o painel: `setDraft({ ...(applied || initialPreview), search })`, para que a busca do topo entre no "Ativar".
- Dica do "Exportar" sem filtro aplicado: "Ative os filtros primeiro".
- Tela vazia sem filtro: "Selecione os filtros e clique em Ativar."
- `canClear = !isRequestFiltersEmpty(activeQuery.filters) || pills.length > 0`, que é o mesmo critério de hoje.

**7. Notificações** — `staff-notification-bell.tsx`
- `StaffNotificationPanel` passa a usar o painel lateral: título "Notificações", total de não lidas na linha pequena do cabeçalho (mesmo lugar onde Filtros mostra o nome da seção), `closeLabel="Fechar notificações"`, `returnFocus` vindo do sino.
- Lista, "Carregar mais", erro com "Atualizar notificações" e "Carregando notificações..." ficam iguais.
- Continua sendo aberto em portal no `document.body`.

**8. Agenda** — novos `src/features/agenda/agenda-filters.ts` e `agenda-filters-drawer.tsx`; `agenda-view.tsx`
- `agenda-filters.ts` contém:
  - `AgendaFilterDimension` (TYPES, STATUSES);
  - `AgendaFilters { types: string[]; statuses: string[] }` e `initialAgendaFilters`;
  - opções de status a partir de `RequestStatus` (NEW → "Nova", SCHEDULED → "Agendada", COMPLETED → "Realizada", CANCELLED → "Cancelada");
  - `filterAgendaRequests`;
  - contagem por opção considerando a seleção da outra dimensão, com a mesma lógica de `buildRequestFacetCounts`;
  - etiquetas "Tipo de atendimento: …" e "Status: …";
  - limpar uma dimensão.
- Reutilizar `summarizeLabels` (exportar de `request-filters.ts`) e `toggleValue` (exportar de `use-request-filters.ts`) em vez de duplicar.
- `agenda-filters-drawer.tsx`: `FiltersDrawer` com seção "Agenda" e dois `FilterGroup`, "Tipo de atendimento" (opções de `allTypes`) e "Status".
- `agenda-view.tsx`:
  - estado `filters` (aplicado) e `draft` (`null` = fechado);
  - `filtered` passa a usar `filterAgendaRequests`;
  - `RequestFiltersToolbar` sem `today` e com seção "Agenda", na ponta direita da linha do cabeçalho, depois dos botões de visualização;
  - `ActiveFiltersBar` abaixo do cabeçalho, só quando houver filtro ativo, com `canClear = pills.length > 0`;
  - mês, ano, setas e visualizações não mudam.

**9. Bairros** — `neighborhood-table.tsx` e `styles.css`
- O título vira `<button type="button">` nativo sem cara de botão: sem borda, fundo nem preenchimento, `inline-flex` com espaço para a seta, foco visível com os mesmos tokens do `Button`.
- Ele herda fonte, cor e caixa alta do `th` (`.reports-table th`). Lembrete: o preflight zera `text-transform` em `button`.
- `title`, `aria-sort` e a seta continuam.
- CSS em `.dash-table`:
  - `th, td` passam a `text-align: center`;
  - a primeira coluna (`:is(th, td):first-child`) fica `text-align: left`;
  - `.dash-table .is-numeric` fica só com `font-variant-numeric: tabular-nums`.
- O cabeçalho fixo ao rolar (`.dash-table thead th`) continua.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

---

## Arquivos provavelmente afetados

- `src/components/side-panel.tsx` _(novo)_
- `src/features/request-filters/filters-drawer.tsx` _(novo)_
- `src/features/request-filters/request-filters-drawer.tsx`
- `src/features/request-filters/request-filters-toolbar.tsx`
- `src/features/request-filters/active-filters-bar.tsx`
- `src/features/request-filters/use-request-filters.ts`
- `src/features/request-filters/request-filters.ts` _(só exportar `summarizeLabels`)_
- `src/App.tsx` _(arquivo grande: só o trecho da lista de Processos — ~3029–3030, ~3117–3150, ~3206–3220)_
- `src/features/reports/reports-view.tsx`
- `src/features/reports/report-filters.ts`
- `src/features/staff-notifications/staff-notification-bell.tsx`
- `src/features/agenda/agenda-filters.ts` _(novo)_
- `src/features/agenda/agenda-filters-drawer.tsx` _(novo)_
- `src/features/agenda/agenda-view.tsx`
- `src/features/dashboard/neighborhood-table.tsx`
- `src/styles.css`
- Testes: `request-filter-controls.test.tsx`, `use-request-filters.test.ts`, `operational-report.test.tsx`, `agenda-view.test.tsx`, `agenda-filters.test.ts` _(novo)_, `staff-notifications.test.tsx`, teste da tabela de Bairros _(em `dashboard-tabs.test.tsx` ou novo)_

---

## O que será removido

- **`RequestFiltersDrawer`:** fundo, `aside`, cabeçalho e rodapé escritos dentro do componente, que passam a vir de `SidePanel`/`FiltersDrawer`; a prop `resultCount`; o texto `Ver {formatRequestCount(resultCount)}`; o import de `formatRequestCount` nesse arquivo; a prop `resultCount` em todos os chamadores (App, Relatórios e o teste).
- **`ActiveFiltersBar`:** a prop `filters` e o uso de `isRequestFiltersEmpty` dentro dela.
- **`useRequestFilters`:** `toggleStage`, `toggleType` e `toggleAssignee` do objeto `actions`.
- **`App.tsx`:** o estado `filtersDrawerOpen` / `setFiltersDrawerOpen`.
- **Relatórios:**
  - o botão "Buscar" e o import de `Search`;
  - as props `todayOnly`, `todayCount` e `onToggleToday` passadas ao toolbar, junto com o `TOGGLE_TODAY` usado ali;
  - a linha `"Agendadas para"` em `report-filters.ts:210`, que não acontece mais porque Relatórios não tem como ligar o "Hoje";
  - os textos "clique em Buscar" e "Faça uma busca primeiro".
- **Notificações:** o uso de `ConfigDialogBackdrop`, `Card` e `ModalHeader` em `staff-notification-bell.tsx`, e os imports que ficarem sem uso.
- **Agenda:**
  - os dois `<select>` (Tipo de atendimento e Status operacional) e o `ag-filter-stack` em volta deles;
  - os estados `filterType` e `filterStatus`;
  - a sequência de `if` com status escrito à mão (`"cancelada"`, `"agendada"`, `"realizada"`, `"analise"`, `"CANCELADA"`, …);
  - os estilos `.ag-filter-stack`, `.ag-filter-stack .ag-select` e `.ag-select--borderless`, e `.ag-filter-stack` no seletor do ajuste para celular (~5056). Antes, confirmar por grep que não há outro uso.
- **Bairros:**
  - o `Button` em formato de pílula no `th` e o import de `Button`;
  - o campo `numeric` de `ColumnSpec` e a classe `is-numeric` no `th` do cabeçalho (nas células de dados ela continua, para os números com largura igual);
  - `text-align: right` em `.dash-table .is-numeric`.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. Criar `SidePanel` com a estrutura que hoje está dentro de `RequestFiltersDrawer`.
2. Criar `FiltersDrawer` com "Limpar"/"Ativar", mover `FilterGroup` para ele e refazer `RequestFiltersDrawer` em cima dos dois, sem `resultCount`.
3. Tornar o "Hoje" opcional em `RequestFiltersToolbar` e trocar `filters` por `canClear` em `ActiveFiltersBar`.
4. Processos: ação `APPLY` no reducer, `actions.apply`, retirada dos três toggles do hook e, no `App.tsx`, rascunho, prévia, "Ativar" e "Limpar" no rascunho.
5. Relatórios: tirar "Hoje" e "Buscar", reorganizar a linha de cima, levar a busca do topo para o rascunho ao abrir, ajustar os textos e remover "Agendadas para".
6. Notificações: passar `StaffNotificationPanel` para `SidePanel`.
7. Agenda: criar `agenda-filters.ts` e `agenda-filters-drawer.tsx`, trocar os `<select>` pelo toolbar, painel e barra, e remover os estilos antigos.
8. Bairros: título como botão de texto, remover `numeric`/`Button` e ajustar `.dash-table`.
9. Atualizar e criar os testes da seção abaixo.
10. Rodar typecheck, testes e build uma vez ao final.

---

## Regras de negócio identificadas

- O painel de filtros só muda a lista ao clicar em **"Ativar"**, que aplica e fecha. Isso vale para Processos, Relatórios e Agenda.
- Fechar o painel sem "Ativar" descarta o que foi marcado.
- "Limpar", dentro do painel, limpa o rascunho e só vale depois de "Ativar".
- O botão principal do painel é só "Ativar", sem número. O total aparece na barra de filtros ativos.
- O "Hoje" existe só em Processos e vale na hora.
- Em Relatórios, a busca do topo entra no relatório quando o usuário clica em "Ativar".
- Na Agenda, dá para marcar mais de um tipo de atendimento e mais de um status. A lista mostra quem atende a algum tipo marcado E a algum status marcado. Se nada estiver marcado numa dimensão, ela não filtra.
- Na tabela de Bairros, a ordenação continua no clique do título.

---

## Regras multi-tenant e segurança

- Sem mudança: os filtros só recortam dados já carregados e escopados por município no servidor.
- Nenhuma permissão nova, nenhuma rota nova.
- O relatório exportado continua usando os mesmos dados. Só sai a linha "Agendadas para", que não acontece mais.

---

## Validações necessárias

- Relatórios: manter `applyDisabled` com período inválido (`hasInvalidReportPeriod`).
- "Limpar" desabilitado quando o rascunho está vazio (Processos e Agenda) ou sem filtros adicionais (Relatórios), como hoje.

---

## Testes necessários

### Frontend

- `request-filter-controls.test.tsx`:
  - toolbar sem `today` não mostra "Hoje";
  - com `today`, "Hoje" aparece pressionado e com a contagem;
  - o painel mostra "Ativar" e não mostra "Ver … solicitações";
  - "Limpar" fica desabilitado com o rascunho vazio.
- `use-request-filters.test.ts`: `APPLY` troca o conjunto inteiro de filtros, incluindo `todayOnly`.
- `operational-report.test.tsx`:
  - sem "Buscar" e sem "Hoje";
  - o botão do painel é "Ativar";
  - "Filtros de relatórios" continua;
  - "Agendadas para" sai dos detalhes do relatório (ajustar o caso com `todayOnly: true`).
- `agenda-filters.test.ts` _(novo)_:
  - filtragem com vários tipos e status;
  - dimensão vazia não filtra;
  - contagens por opção considerando a outra dimensão;
  - etiquetas com resumo;
  - limpar uma dimensão.
- `agenda-view.test.tsx`: no lugar dos `<select>` de tipo e status, o botão "Filtros" com `aria-haspopup="dialog"` dentro de "Filtros de agenda". Mês e Ano continuam como `<select>`.
- `staff-notifications.test.tsx`:
  - continua com `role="dialog"`, total de não lidas, itens e "Carregar mais";
  - passa a ter `aria-modal`, o título "Notificações" ligado por `aria-labelledby` e o botão "Fechar notificações".
- Tabela de Bairros: os títulos são botões com o nome da coluna; a coluna ordenada tem `aria-sort` e a seta.

### Backend

- Sem impacto.

### Conferência manual (tela) — feita pelo usuário

- Processos: marcar no painel não muda a lista; "Ativar" aplica e fecha; fechar pelo X, pelo fundo ou pelo Esc descarta; "Hoje" e as etiquetas valem na hora.
- Relatórios: "Exportar" e "Prontuário" à esquerda, "Filtros" à direita; sem "Hoje" e sem "Buscar"; a busca do topo vale ao clicar em "Ativar".
- Notificações: painel à direita, por cima do cabeçalho; o foco volta ao sino ao fechar.
- Agenda: "Filtros" à direita na linha do cabeçalho; dá para marcar vários itens; etiquetas abaixo do cabeçalho; no celular a linha quebra sem estourar.
- Bairros: títulos sem pílula e em caixa alta; "Bairro" à esquerda; o resto centralizado e alinhado com os dados; a ordenação funciona; o cabeçalho fica fixo ao rolar.

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

- **Processos muda de comportamento:** os filtros do painel deixam de valer na hora e passam a valer só no "Ativar".
- **Relatórios:** mudar a busca do topo depois de ativar não atualiza o relatório até abrir o painel e clicar em "Ativar" de novo. O "Prontuário" continua lendo a busca direto.
- **Notificações:** conferir se o z-index 210/211 do painel fica acima do cabeçalho e de outras janelas abertas. Sem mexer no `.topbar`.
- **Agenda:** passar de uma escolha para várias muda o uso atual. O cabeçalho já tem muitos controles, então conferir a quebra de linha no celular.
- **Bairros:** o `button` precisa herdar fonte, cor e caixa alta. O cabeçalho fixo não pode perder o fundo.
- **Relatórios:** o campo `today` do `ReportQuery` continua, porque a função compartilhada `buildRequestFilterResults` precisa dele.
- Fluxo de publicação: commit e push direto em `main`, sem `staging`.

---

## Perguntas em aberto

Respondidas pelo usuário:

1. "Ativar" aplica os filtros e fecha o painel em todas as telas (Agenda, Relatórios e Processos).
2. A Agenda passa a aceitar mais de uma opção por filtro.
3. Os títulos da tabela de Bairros seguem o estilo da tabela de Relatórios.

Nenhuma outra pergunta em aberto identificada.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- Processos, Relatórios e Agenda usam o mesmo painel lateral de filtros, com "Limpar" e "Ativar". "Ativar" aplica e fecha; fechar sem ativar descarta.
- Nenhum painel mostra "Ver X solicitações" e nenhuma tela tem botão "Buscar" para filtros.
- Relatórios não tem "Hoje", e "Filtros" fica à direita. Processos continua com "Hoje".
- Notificações abre no painel lateral à direita.
- A Agenda filtra por tipo de atendimento e status, com várias opções, contagem, contador no botão e etiquetas removíveis. Os `<select>` antigos e seus estilos não existem mais.
- A tabela de Bairros tem títulos de texto (sem pílula), "Bairro" à esquerda, o resto centralizado e a ordenação funcionando.
- Tudo listado em "O que será removido" foi deletado.
- Typecheck, testes e build sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
- Não há `@testing-library` no projeto: os testes são de HTML estático (`renderToStaticMarkup`) e de funções puras. Por isso a lógica de rascunho e filtragem fica em funções e reducer testáveis.
- Reutilizar `Button`, `CloseButton`, `useModalFocus` e as variáveis de tipografia existentes. Sem classe CSS própria por feature e sem `!important`.
- Testes visuais ficam com o usuário: validar só com typecheck, testes e build.
