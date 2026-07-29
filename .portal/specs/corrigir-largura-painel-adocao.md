# Corrigir largura do painel de adoção (coluna fantasma)

## Contexto

O painel de adoção interno (`Adoção`, modo grade) tinha uma coluna lateral
operacional (`Aguardando triagem`, `Visitas agendadas`, `Destaque
automático`) que foi removida a pedido do usuário em sessão anterior. O
JSX e o CSS específico dos cards dessa coluna foram removidos, mas o
container de layout (`.adoption-board-layout`) que reservava espaço para
essa coluna não foi totalmente corrigido.

## Problema

A grade de cards de animais (`.adoption-grid-modern`) não ocupa a largura
horizontal total da área de conteúdo. Sobra uma faixa de espaço vazio à
direita, do tamanho aproximado da antiga coluna lateral (296px).

## Causa identificada (análise prévia, sem código alterado ainda)

Existem dois blocos que definem `.adoption-board-layout` em
`src/styles.css`:

- Um bloco (por volta da linha 22850) já foi corrigido para
  `grid-template-columns: minmax(0, 1fr)` (uma coluna só).
- Um segundo bloco, mais específico/posterior no arquivo (por volta da
  linha 23412), ainda define
  `grid-template-columns: minmax(0, 1fr) 296px;` — reservando a largura
  da coluna lateral que não existe mais no JSX.

Esse segundo bloco é resíduo da limpeza anterior: as classes específicas
dos cards da coluna (`.adoption-rail`, `.adoption-rail-card`, etc.) foram
removidas, mas esse `grid-template-columns` duplicado, que não tem
`adoption-rail` no nome, passou despercebido na varredura por nome de
classe.

Pode existir um terceiro ponto de ajuste em alguma media query (havia uma
ocorrência de `.adoption-board-layout` também por volta da linha 23524)
que precisa da mesma correção, a confirmar durante a implementação.

## Comportamento esperado

- O grid de cards de animais deve ocupar 100% da largura disponível da
  área de conteúdo (mesmo comportamento de antes da coluna lateral
  existir).
- Nenhuma faixa de espaço vazio reservado deve sobrar à direita.
- O comportamento deve valer tanto no modo grade quanto no modo lista
  (confirmar se o modo lista usa o mesmo `.adoption-board-layout` ou tem
  layout próprio).
- Não deve haver regressão visual em outras áreas que compartilhem classes
  com `.adoption-board-layout` (confirmar se essa classe é exclusiva da
  tela de Adoção).

## Fora de escopo

- Qualquer mudança no card do animal em si (já ajustado em sessão
  anterior: foto grande, nome sobreposto, badge de interessados, X de
  excluir, botões de editar/concluir).
- Reintroduzir a coluna lateral removida.
- Mudanças de backend, banco de dados ou infraestrutura.
