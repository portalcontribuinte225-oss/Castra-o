# Plano de Implementação: Reskin visual + abertura de detalhe na tela Agenda (AgendaView)

## Origem

- Especificação: mockup HTML autônomo ("Agenda - Standalone.html") anexado pelo usuário na conversa, mais um print de refinamento do painel lateral (drawer de dia) anexado depois — nenhum arquivo `.md` em disco.
- Data do planejamento: 2026-07-26 (revisado no mesmo dia após feedback do usuário)
- Classificação: `frontend-only`

## Resumo

O usuário anexou um mockup completo de uma tela de agenda/calendário (visões mês/semana/dia/ano/lista, filtros, cards de estatística, painel lateral ao clicar num dia, criação rápida de agendamento). Investigação no código mostrou que **essa tela já existe e já funciona de verdade** em `src/features/agenda.tsx` (`AgendaView`, 827 linhas) — mesmas 5 visões, mesmos filtros, mesmas estatísticas, mesmo painel lateral. A maior parte do gap é visual: o `AgendaView` atual tem seu próprio design (216 regras `.ag-*` em `src/styles.css`), diferente do mockup.

Ao revisar o código real linha a linha, identifiquei que 3 elementos do mockup **não existem hoje nem como esqueleto morto**:

1. O selo de status (ex. "Confirmado") no mockup é um `<select>` interativo. No app real, `AgendaStatusBadge` (agenda.tsx:98-106) é um `<span>` fixo, sem interação.
2. O botão "Novo agendamento" / dica "Adicione o primeiro atendimento abaixo" no painel do dia — o `DayPanel` real (agenda.tsx:749-827) só lista, não tem nada pra adicionar.
3. Clicar num card/linha em qualquer visão já chama `setSelectedId(r.id)` (agenda.tsx, várias linhas), mas nada abre — é clique morto hoje, porque o modal de detalhe (`RequestPreviewModal`) só é montado dentro de `AdminDashboard`, amarrado a um estado local dele (`previewRequest`, App.tsx:4407) que a Agenda não enxerga.

Depois de discutir esses 3 pontos com o usuário, o escopo final ficou:

- **Item 1 e 3 entram no plano**, mas de forma unificada e mais segura do que copiar o mockup ao pé da letra: em vez de um `<select>` solto que trocaria o status direto (o que passaria por cima de regras de negócio reais — ex. confirmar comparecimento exige registrar microchip, cancelar exige motivo, ver `confirmAttendanceFromProcess`/`archiveWithTag` em App.tsx:4592-4614/4526-4536), o clique no card/linha/selo abre o **`RequestPreviewModal` já existente**, com as ações reais e validadas (confirmar agenda, reagendar, cancelar, confirmar comparecimento, atribuir). O selo continua visualmente parecido com o do mockup, mas como elemento clicável que abre o modal — não como dropdown de troca direta de status.
- **Item 2 fica de fora** — o usuário confirmou explicitamente que o botão "Novo agendamento"/criação rápida não precisa ser implementado. Ele **não será renderizado** (nem como botão decorativo sem ação), pra não deixar um elemento clicável morto na tela.

Também por pedido explícito do usuário: **toda regra CSS antiga do bloco `.ag-*` que for substituída pelo reskin deve ser removida, não sobreposta** — o código final deve ter uma única versão vigente de cada regra, sem resíduo da estilização anterior por baixo.

## Escopo

### Dentro do escopo

- Reestilizar a área de conteúdo do `AgendaView` (abaixo do cabeçalho superior do app, que já existe e não muda) para seguir a linguagem visual do mockup:
  - Bloco "Controle" (busca + filtro de tipo + filtro de status) na lateral esquerda.
  - Cards de estatística (Hoje / Semana / Realizados / Cancelados).
  - Cabeçalho da agenda: kicker "OPERAÇÃO DE AGENDA", título do período, navegação anterior/hoje/próximo, abas de visão (Mês/Semana/Dia/Ano/Lista). **Sem** o botão "Novo agendamento" do mockup (ver fora do escopo).
  - Legenda de status (Confirmado/Pendente/Realizado/Cancelado) + nota de capacidade.
  - Grade do calendário nas 5 visões: células de mês (número do dia, badge ocupado/total real — não fixo em "10", já que a capacidade real varia por dia —, chips de agendamento, barra de carga na base), linhas de semana/dia, mini-calendários do ano, linhas agrupadas por dia na lista.
  - **Painel lateral (drawer) do dia**, incluindo o refinamento do segundo print: cabeçalho com gradiente verde-menta suave, kicker do dia da semana + data em destaque, barra de progresso de capacidade, linhas de agendamento com iniciais em círculo colorido + nome + horário + animal/espécie/tipo + selo de status. **Sem** o botão "Novo agendamento"/"Adicione o primeiro atendimento abaixo" (ver fora do escopo) — o estado vazio do dia mostra só a mensagem de "nenhum agendamento", sem convite a criar um.
- Reaproveitar cores/paleta do mockup (teal/esmeralda para confirmado, âmbar para pendente, cinza para realizado, rosa/vermelho para cancelado).
- **Ao substituir uma regra `.ag-*` existente, remover a antiga — nunca empilhar uma regra nova por cima de uma antiga que ainda é alcançável.** Ao final, rodar grep de cada classe `.ag-*` alterada no `styles.css` inteiro pra confirmar que não sobrou nenhuma versão anterior ainda ativa.
- Ligar o clique em qualquer card/linha/selo de agendamento (em todas as 5 visões + drawer) para abrir o `RequestPreviewModal` já existente, com as ações reais (aprovar, reagendar, cancelar, confirmar comparecimento, atribuir) — reaproveitando a lógica de negócio que já existe em `AdminDashboard` (App.tsx:4508-4614), extraída para um hook compartilhado (ex. `src/features/request-actions.ts`) usado tanto por `AdminDashboard` quanto por `AgendaView`, evitando duplicar ~100 linhas de regra de negócio (inclusive os avisos de WhatsApp) em dois lugares.

### Fora do escopo

- Botão "Novo agendamento" / criação rápida de agendamento pelo painel do dia — **não implementado, não renderizado**, por decisão explícita do usuário.
- `<select>` de troca direta de status no selo — decisão deliberada de não implementar isso; a troca de status acontece pelas ações do `RequestPreviewModal`, não por um dropdown solto (ver justificativa no Resumo).
- Qualquer alteração no cabeçalho superior compartilhado do app (seletor de município, busca global, sino de notificação).
- Qualquer alteração em `ConfigView`'s editor de regras de agenda (tela separada de criação/edição de disponibilidade — sem relação com este mockup).
- Qualquer mudança de schema, endpoint ou rota de backend.

## Leitura de contexto

- `/AGENT.md` (regras globais — git flow/staging não se aplica, conforme convenção já estabelecida nas skills deste repositório).
- Investigação direta do código: `src/features/agenda.tsx` (estrutura completa de `AgendaView`, `MonthView`, `WeekView`, `DayView`, `YearView`, `ListView`, `DayPanel`, `AgendaStatusBadge`, `DayCard`), `src/styles.css` (bloco `.ag-*`, 216 regras), `src/App.tsx` (`AdminDashboard`, `previewRequest`/`RequestPreviewModal`, `approveRequest`/`archiveWithTag`/`rescheduleFromPreview`/`assignFromPreview`/`confirmAttendanceFromProcess`/`rejectRequestFromProcess`, App.tsx:4392-4774; `ActiveView` já passa `patchRequest`/`currentUser`/`teams` uniformemente para todas as telas, incluindo `AgendaView` — App.tsx:913-943).
- Mockup HTML anexado pelo usuário (protótipo autônomo com runtime próprio — não é código de produção, serve só como referência visual/estrutural).
- Print de refinamento do painel lateral do dia, anexado pelo usuário depois do mockup inicial.

## Impacto por área

### Frontend

- `src/features/agenda.tsx`:
  - Reskin visual completo (CSS/JSX) das 5 visões + sidebar + stats + drawer.
  - Remover o botão "Novo agendamento" do cabeçalho e o convite de criação vazio do drawer (não existem hoje — não adicionar).
  - Passar a destruturar `patchRequest`, `currentUser`, `teams` (já chegam como props via `ActiveView`, sem necessidade de mudar o call site em `App.tsx`).
  - Adicionar estado local `previewRequest`/`setPreviewRequest` e montar `RequestPreviewModal` (importado/reaproveitado), usando o hook compartilhado de ações.
  - Trocar todos os `setSelectedId(r.id)` existentes por uma função `openRequest(r)` que faz `setSelectedId(r.id)` + `setPreviewRequest(r)`.
- `src/App.tsx`:
  - Extrair `approveRequest`, `notAttendedRequest`, `archiveWithTag`, `rescheduleFromPreview`, `assignFromPreview`, `rejectRequestFromProcess`, `confirmAttendanceFromProcess` (hoje só dentro de `AdminDashboard`) para um hook compartilhado.
  - `AdminDashboard` passa a consumir esse hook em vez de definir as funções localmente — mesmo comportamento, só muda a origem.
- Novo arquivo (provável): `src/features/request-actions.ts` (ou nome equivalente em inglês, conforme convenção do projeto) com o hook `useRequestActions(...)`.
- `src/styles.css`: reescrever o bloco `.ag-*`, removendo (não sobrepondo) toda regra substituída.
- Sem novas query keys, sem chamadas de API novas — `patchRequest` já existe e já é usado por `AdminDashboard`.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/features/agenda.tsx`
- `src/styles.css` (bloco `.ag-*`)
- `src/App.tsx` (extração das funções de ação de `AdminDashboard`)
- Novo arquivo para o hook compartilhado de ações sobre um processo

## Estratégia de implementação

1. Ler `src/features/agenda.tsx`, o bloco `.ag-*` de `src/styles.css` e as funções de ação em `AdminDashboard` (App.tsx:4392-4774) por completo antes de editar.
2. Extrair as funções de ação para o hook compartilhado; atualizar `AdminDashboard` para consumi-lo (sem mudar comportamento).
3. Em `AgendaView`: adicionar `previewRequest`/`setPreviewRequest`, montar `RequestPreviewModal`, unificar os pontos de clique existentes em `openRequest(r)`.
4. Reestilizar em ordem: cabeçalho + abas de visão (sem o botão "Novo agendamento") → sidebar "Controle" + cards de estatística → grade de calendário (mês, semana, dia, ano, lista) → painel lateral do dia (sem o convite de criação), incorporando o refinamento do segundo print.
5. Para cada classe `.ag-*` alterada, remover a regra antiga em vez de adicionar uma nova por cima; ao final, grep de cada classe tocada no `styles.css` inteiro pra confirmar que não sobrou nada da versão anterior.
6. Validar visualmente via Playwright (screenshot) comparando com o mockup/print de referência, em cada visão e no drawer.
7. Validar o fluxo funcional: clicar num agendamento em cada visão abre o `RequestPreviewModal` certo; confirmar agenda/reagendar/cancelar/confirmar comparecimento a partir da Agenda funciona e reflete no calendário; o mesmo fluxo continua funcionando sem regressão dentro de `AdminDashboard`.
8. Rodar `npm run typecheck` e `npm run build`.
9. Testar responsividade (viewport estreito).

## Regras de negócio identificadas

- Troca de status de um processo **sempre** passa pelas ações validadas existentes (`approveRequest`, `rescheduleFromPreview`, `archiveWithTag`, `confirmAttendanceFromProcess`, etc.) — nunca por um `<select>` que altere `status` diretamente sem os dados/confirmações que essas ações já exigem (ex.: microchip ao confirmar comparecimento, motivo ao cancelar).

## Regras multi-tenant e segurança

Sem impacto direto — nenhuma alteração em autenticação, tenant ou permissões. `AgendaView` já recebe `requests`/`scheduleDays`/`patchRequest` devidamente escopados por município antes de chegar até ele; abrir o mesmo `RequestPreviewModal` que `AdminDashboard` já usa não muda essa origem de dados nem introduz um caminho novo de escrita — é a mesma função `patchRequest` de sempre.

## Validações necessárias

Nenhuma validação de formulário/input nova — o `RequestPreviewModal` reaproveitado já tem suas próprias validações existentes (ex. microchip ao confirmar comparecimento).

## Testes necessários

### Frontend

- Verificação visual manual/Playwright: 5 visões, painel lateral (com e sem agendamentos no dia), filtros aplicados, desktop e viewport estreito.
- Verificação funcional: abrir `RequestPreviewModal` a partir de cada visão da Agenda; executar cada ação (aprovar, reagendar, cancelar, confirmar comparecimento, atribuir) a partir da Agenda e confirmar que o calendário reflete a mudança; confirmar que `AdminDashboard` continua funcionando normalmente após a extração do hook compartilhado.

### Backend

Sem impacto — nenhum teste de backend necessário.

### E2E

- Fluxo completo: abrir Agenda → clicar num agendamento → confirmar comparecimento (com microchip) → verificar que o card correspondente atualiza de status na grade.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- A extração das funções de ação de `AdminDashboard` para um hook compartilhado toca um componente grande e crítico — validar cuidadosamente que nada mudou lá além da origem das funções (mesmos parâmetros, mesmo comportamento, mesmos toasts).
- Decisão deliberada de não copiar o `<select>` de status do mockup ao pé da letra, para não abrir um caminho de troca de status que ignore validações reais (microchip, motivo de cancelamento) — se o usuário quiser essa interação exata do mockup mesmo assim, isso precisaria de uma decisão explícita nova, já que hoje o modal reaproveitado é a via mais segura.
- Risco baixo de CSS: o bloco `.ag-*` já é isolado e usado só por esta tela — remover regras antigas e substituir por novas não deve vazar para outros componentes, desde que a verificação por grep (passo 5 da estratégia) seja seguida à risca.
- O mockup foi feito num runtime de protótipo próprio (bindings `{{ }}`, `sc-for`, `sc-if`) — não é copiável diretamente, serve só como referência visual/estrutural; cada trecho precisa ser reinterpretado para o JSX real e os dados reais já normalizados.
- Risco de regressão de responsividade: validar explicitamente em viewport estreito.

## Perguntas em aberto

Nenhuma pergunta bloqueante. Registrado como decisão consciente do usuário: o botão "Novo agendamento"/criação rápida fica de fora deste plano — pode virar um plano separado depois, se necessário.

## Critérios de aceite do plano

- As 5 visões da Agenda e o painel lateral do dia refletem visualmente o mockup (paleta, cards, espaçamento, badges de status), incluindo o refinamento do segundo print para o drawer, sem o botão "Novo agendamento".
- Clicar num agendamento em qualquer visão abre o `RequestPreviewModal` com as ações reais funcionando (aprovar, reagendar, cancelar, confirmar comparecimento, atribuir), refletindo no calendário.
- `AdminDashboard` continua funcionando exatamente como antes após a extração do hook compartilhado.
- Nenhuma regra CSS antiga do bloco `.ag-*` ficou ativa por baixo do novo visual (confirmado por grep).
- `npm run typecheck` e `npm run build` aprovados sem novos erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto, junto com o mockup HTML e o print do drawer já compartilhados na conversa.
- Não implementar o botão "Novo agendamento"/criação rápida de agendamento — está fora de escopo por pedido explícito do usuário.
- Não implementar um `<select>` de troca direta de status — usar o `RequestPreviewModal` existente para qualquer mudança de status.
- Ao alterar CSS, sempre remover a regra antiga substituída — nunca empilhar uma nova por cima. Confirmar com grep ao final.
- Não fazer commit/push sem solicitação explícita do usuário — isso é responsabilidade da skill `finalizar`.
- Manter as alterações restritas aos arquivos listados; não aproveitar para refatorar lógica de dados/estado não relacionada.
