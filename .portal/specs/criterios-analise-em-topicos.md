# Pedido: Adicionar critérios de análise documental em tópicos (multi-linha)

## Origem

Conversa com o usuário, a partir de um screenshot do modal "Criar/editar tipo de documento", seção "Critérios de análise" (3 colunas: Obrigatórios, Recusa, Revisão manual).

## Situação atual

Cada coluna de critérios tem:

- uma lista de chips com os critérios já cadastrados (removíveis via "×")
- um campo de texto de uma linha + botão "+" para adicionar **um item por vez** (Enter ou clique)

## Problema relatado

> "podemos altera a adição de criterios de item para tópcos direto na area, um por vez não é pratico. caso precise ser numerado ou em letras a organização apra IA entender podemos fazer, mas se for possivel em tópcos seria o melhor cenário?"

Cadastrar vários critérios exige repetir o ciclo "digitar → Enter/clicar → digitar de novo" para cada item, o que é lento quando há várias regras para cadastrar (ex: colar uma lista já pronta de critérios).

## Comportamento desejado

- Permitir digitar/colar **vários critérios de uma vez**, um por linha (formato de tópicos), na mesma área de cada coluna.
- Cada linha não vazia deve virar um item independente na lista (mesmo comportamento de armazenamento atual: array de strings por coluna).
- Não é necessário numerar ou usar letras manualmente — isso é apenas um fallback aceitável caso bullets não sejam viáveis, mas o cenário preferido é tópicos simples.

## Contexto técnico já levantado

- `requiredCriteria`, `rejectionCriteria`, `manualReviewCriteria` já são `string[]` no estado do formulário (`newDocument`) e no schema (`src/domain.ts`).
- O backend (`backend/src/routes/ai.js`, funções `toStringList` e `formatRuleList`) já separa strings por quebra de linha/`;` e **numera automaticamente** cada critério ao montar o prompt para a IA. Ou seja, o formato "tópicos soltos" no frontend já é compatível com o que a IA recebe (lista numerada), sem exigir mudança no backend.
- `src/domain.ts` já tem uma função interna equivalente (`textToCriteriaList`) que faz o mesmo split por linha/`;` — hoje não exportada, usada para normalizar dados vindos de fora (ex: migração de campos antigos).

## Fora do escopo (nesta solicitação)

- Mudar o modelo de dados de critérios (continua array de strings).
- Mudar o prompt/lógica de decisão da IA no backend.
- Redesenhar as outras seções do modal (Identificação, Decisão automática).
