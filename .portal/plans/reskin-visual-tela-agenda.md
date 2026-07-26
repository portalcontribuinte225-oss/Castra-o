# Plano de Implementação: Reskin visual da tela Agenda (AgendaView)

## Origem

- Especificação: mockup HTML autônomo ("Agenda - Standalone.html") anexado pelo usuário na conversa, mais um print de refinamento do painel lateral (drawer de dia) anexado depois — nenhum arquivo `.md` em disco.
- Data do planejamento: 2026-07-26
- Classificação: `frontend-only`

## Resumo

O usuário anexou um mockup completo de uma tela de agenda/calendário (visões mês/semana/dia/ano/lista, filtros, cards de estatística, painel lateral ao clicar num dia, criação rápida de agendamento). Investigação no código mostrou que **essa tela já existe e já funciona de verdade** em `src/features/agenda.tsx` (`AgendaView`, 827 linhas) — mesmas 5 visões, mesmos filtros, mesmas estatísticas, mesmo painel lateral. O gap real não é de funcionalidade, é de **visual**: o `AgendaView` atual tem seu próprio design (216 regras `.ag-*` em `src/styles.css`), diferente do mockup.

O usuário confirmou explicitamente que o objetivo é **só o visual** (paleta, cards, espaçamento do mockup), não a criação de funcionalidade nova. Também confirmou, via um segundo print, que o refinamento do **painel lateral do dia** (drawer) mostrado nesse print deve entrar no escopo do reskin.

Este plano é deliberadamente restrito a CSS/JSX de apresentação — nenhum dado, estado, rota de API ou regra de negócio muda.

## Escopo

### Dentro do escopo

- Reestilizar a área de conteúdo do `AgendaView` (abaixo do cabeçalho superior do app, que já existe e não muda) para seguir a linguagem visual do mockup:
  - Bloco "Controle" (busca + filtro de tipo + filtro de status) na lateral esquerda.
  - Cards de estatística (Hoje / Semana / Realizados / Cancelados).
  - Cabeçalho da agenda: kicker "OPERAÇÃO DE AGENDA", título do período, botão "Novo agendamento", navegação anterior/hoje/próximo, abas de visão (Mês/Semana/Dia/Ano/Lista).
  - Legenda de status (Confirmado/Pendente/Realizado/Cancelado) + nota de capacidade.
  - Grade do calendário nas 5 visões: células de mês (número do dia, badge X/10, chips de agendamento, barra de carga na base), linhas de semana/dia, mini-calendários do ano, linhas agrupadas por dia na lista.
  - **Painel lateral (drawer) do dia**, incluindo o refinamento do segundo print: cabeçalho com gradiente verde-menta suave, kicker do dia da semana + data em destaque, barra de progresso de capacidade com "X/10 vagas", linhas de agendamento com iniciais em círculo colorido + nome + horário + animal/espécie/tipo + selo de status (ex. "Confirmado") com indicador de dropdown, estado vazio ("Nenhum agendamento neste dia" / "Adicione o primeiro atendimento abaixo").
- Reaproveitar cores/paleta do mockup (tons de teal/esmeralda para confirmado, âmbar para pendente, cinza para realizado, rosa/vermelho para cancelado) mantendo consistência com o restante do app onde já fizer sentido.

### Fora do escopo

- Qualquer mudança de dado, estado, endpoint ou regra de negócio.
- Conectar o clique num agendamento/dia a um modal de detalhes do processo (`RequestPreviewModal`) — hoje o clique já atualiza `selectedId` mas nada abre visualmente; esse gap **é conhecido e foi identificado**, mas fica fora deste plano por decisão explícita do usuário (só visual por agora). Fica registrado aqui para um plano futuro.
- Criação rápida de agendamento pelo painel do dia (o botão "Novo agendamento"/"Adicione o primeiro atendimento abaixo" pode existir visualmente, mas não precisa disparar nenhuma ação real neste plano — ou, se for trivial mantê-lo desabilitado/sem ação visível confusa, ajustar apenas a aparência).
- Qualquer alteração no cabeçalho superior compartilhado do app (seletor de município, busca global, sino de notificação) — já existe e é usado por todas as telas admin, não é exclusivo da Agenda.
- Qualquer alteração em `ConfigView`'s editor de regras de agenda (tela separada, usada para criar/editar as regras de disponibilidade — não tem relação visual com este mockup).

## Leitura de contexto

- `/AGENT.md` (regras globais — git flow/staging não se aplica, conforme convenção já estabelecida nas skills deste repositório).
- Investigação direta do código: `src/features/agenda.tsx` (estrutura completa de `AgendaView`, `MonthView`, `WeekView`, `DayView`, `YearView`, `ListView`, `DayPanel`), `src/styles.css` (bloco `.ag-*`, 216 regras).
- Mockup HTML anexado pelo usuário (protótipo autônomo com runtime próprio — não é código de produção, serve só como referência visual).
- Print de refinamento do painel lateral do dia, anexado pelo usuário depois do mockup inicial.

## Impacto por área

### Frontend

- `src/features/agenda.tsx`: ajustar classes/estrutura JSX onde necessário para acomodar o novo visual (ex.: reorganizar markup de células, cards, badges, drawer) — sem tocar em nenhuma lógica de estado, filtro, cálculo de ocupação ou navegação de data, que já funcionam corretamente hoje.
- `src/styles.css`: reescrever/estender o bloco `.ag-*` para refletir a paleta, espaçamento, tipografia e componentes visuais do mockup (cards, badges, drawer, grade de calendário).
- Sem novos hooks, sem novas query keys, sem chamadas de API novas.
- Testes visuais: nenhum teste automatizado de snapshot existe hoje para esta tela; validação será visual (Playwright + screenshot) nas 5 visões, no drawer, e em pelo menos um breakpoint mobile/estreito, para garantir que o reskin não quebra responsividade.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/features/agenda.tsx`
- `src/styles.css` (bloco `.ag-*`)

## Estratégia de implementação

1. Ler `src/features/agenda.tsx` e o bloco `.ag-*` de `src/styles.css` por completo antes de editar, para entender toda estrutura JSX/CSS atual e não deixar regra antiga conflitante por baixo do reskin (conforme convenção do projeto de não empilhar CSS novo sobre o antigo).
2. Reestilizar em ordem: cabeçalho da agenda + abas de visão → sidebar "Controle" + cards de estatística → grade de calendário (mês, depois semana/dia/ano/lista) → painel lateral do dia (drawer), incorporando o refinamento do segundo print.
3. Após cada bloco, validar visualmente via Playwright (screenshot) comparando com o mockup/print de referência.
4. Rodar `npm run typecheck` e `npm run build` ao final.
5. Testar responsividade (viewport estreito) e os 4 estados de status (confirmado/pendente/realizado/cancelado) em pelo menos uma célula/linha de cada visão.
6. Buscar (grep) cada classe `.ag-*` alterada no arquivo de estilos inteiro para confirmar que não sobrou nenhuma regra antiga/duplicada ainda ativa por baixo do novo visual.

## Regras de negócio identificadas

Nenhuma — este plano não altera regra de negócio, apenas apresentação.

## Regras multi-tenant e segurança

Sem impacto — nenhuma alteração em autenticação, tenant, permissões ou dados. O `AgendaView` já recebe `requests`/`scheduleDays` devidamente escopados por município antes de chegar até ele; o reskin não muda essa origem de dados.

## Validações necessárias

Nenhuma validação de formulário/input nova — não há campos novos.

## Testes necessários

### Frontend

- Verificação visual manual/Playwright: 5 visões (mês/semana/dia/ano/lista), painel lateral (com e sem agendamentos no dia), filtros aplicados, em desktop e em viewport estreito.

### Backend

Sem impacto — nenhum teste de backend necessário.

### E2E

- Navegar entre as 5 visões e confirmar que o novo visual não quebra nenhuma interação existente (clique em dia, filtro, busca, navegação de período) — o comportamento deve continuar idêntico ao de hoje, só a aparência muda.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Risco baixo: o bloco `.ag-*` já é isolado e usado só por esta tela (confirmado via grep), então o reskin não deve vazar para outros componentes.
- Atenção: como o mockup foi feito num runtime de protótipo próprio (bindings tipo `{{ }}`, `sc-for`, `sc-if`), ele não é copiável diretamente — serve só como referência visual/estrutural, cada trecho precisa ser reinterpretado para o JSX real de `agenda.tsx` e para os dados reais já normalizados (`requests`, `scheduleDays`, etc.).
- Risco de regressão de responsividade: o mockup foi pensado para desktop; validar explicitamente o comportamento em telas estreitas, já que o app real precisa suportar isso.

## Perguntas em aberto

Nenhuma pergunta bloqueante. Registrado como decisão consciente do usuário: o gap funcional (clique não abre modal de detalhes) é conhecido e foi deixado fora deste plano de propósito — pode virar um plano separado depois.

## Critérios de aceite do plano

- As 5 visões da Agenda e o painel lateral do dia refletem visualmente o mockup (paleta, cards, espaçamento, badges de status), incluindo o refinamento do segundo print para o drawer.
- Nenhum comportamento/dado existente foi alterado — filtros, navegação de período, cálculo de ocupação e clique em dia continuam funcionando exatamente como antes.
- `npm run typecheck` e `npm run build` aprovados sem novos erros.
- Nenhuma regra CSS antiga/duplicada do bloco `.ag-*` ficou ativa por baixo do novo visual.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto, junto com o mockup HTML e o print do drawer já compartilhados na conversa.
- Não implementar o gap funcional (clique → modal) nem criação rápida de agendamento com efeito real — é explicitamente fora de escopo.
- Não fazer commit/push sem solicitação explícita do usuário — isso é responsabilidade da skill `finalizar`.
- Manter as alterações restritas a `src/features/agenda.tsx` e ao bloco `.ag-*` de `src/styles.css`; não aproveitar para refatorar lógica de dados/estado dessa tela.
