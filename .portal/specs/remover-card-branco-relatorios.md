# Remover card branco desnecessário no painel de Relatórios

## Contexto

Na tela interna de Relatórios, o bloco que envolve os 5 resumos (Status,
Resultado, Tipos de solicitação, Responsáveis, Taxas) e a tabela de
resultados está dentro de um `<div className="panel wide">`
(`src/features/reports.tsx:258`). Esse elemento tem fundo branco, borda e
sombra próprios (herdados da regra genérica `.panel` em
`src/styles.css:5085-5093`), criando uma moldura de "card" visualmente
desnecessária, já que a página em si já tem um fundo neutro
(`rgb(248,250,252)`) e o conteúdo (resumos + tabela) já é suficientemente
delimitado por si só.

Investigação prévia confirmou (via inspeção de computed style real, não só
leitura do CSS-fonte) que a faixa de filtros acima (`.page-toolbar
.reports-controls`) **já é transparente** — não tem fundo/borda próprios.
A impressão visual de "duas divs card" vinha do contraste entre os inputs
brancos nativos do navegador (lado a lado) e o único card real por baixo
(`.panel.wide`). Portanto, só existe uma div de card a remover, não duas.

## Problema

O card branco do `.panel.wide` em Relatórios não agrega valor visual — o
usuário quer removê-lo, deixando o resumo e a tabela soltos diretamente
sobre o fundo da página, sem moldura.

## Risco identificado

A classe `.panel.wide` **não é exclusiva de Relatórios**. Ela também é
usada em `src/App.tsx:3204` (bloco "Minhas solicitações" do
Dashboard/Solicitações). Uma alteração direta na regra genérica `.panel`
ou num seletor `.panel.wide` sem escopo quebraria visualmente essa outra
tela, que está fora do pedido do usuário.

## Comportamento esperado

- O bloco de resumo + tabela em Relatórios deve perder fundo branco, borda
  e sombra — ficando visualmente solto sobre o fundo da página.
- Nenhuma outra tela que usa `.panel`/`.panel.wide` (ex: Dashboard/
  Solicitações) pode ser afetada.
- O espaçamento interno (padding) do conteúdo deve ser preservado o
  suficiente para não colar o texto nas bordas da tela.

## Fora de escopo

- Qualquer mudança na faixa de filtros (`.page-toolbar.reports-controls`)
  — já confirmado que ela não tem card visual a remover.
- Qualquer mudança em outras telas que usam `.panel`/`.panel.wide`.
- Mudanças de dados, filtros, exportação de PDF ou lógica de negócio do
  relatório.
