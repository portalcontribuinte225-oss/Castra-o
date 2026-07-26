# Plano de Implementação: Simplificar adição de critérios de análise documental (tópicos por linha)

## Origem

- Arquivo de especificação: `.portal/specs/criterios-analise-em-topicos.md`
- Data do planejamento: `2026-07-26`
- Classificação: `frontend-only`

## Resumo

No modal "Criar/editar tipo de documento" (seção "Critérios de análise"), cada uma das 3 colunas (Obrigatórios, Recusa, Revisão manual) hoje exige adicionar um critério por vez: digitar em um campo de uma linha, confirmar com Enter/clique no botão "+", ver o item virar um "chip" removível, e repetir para cada critério.

O usuário pediu para simplificar isso ao extremo: cada coluna passa a ser um único campo de texto multi-linha (um critério por linha, como tópicos soltos), sem botão de adicionar e sem confirmação por item. As alterações só são persistidas quando o botão "Salvar" do documento (submit do formulário inteiro) é clicado — não há sincronização incremental enquanto o modal está aberto.

Não há mudança de modelo de dados nem de backend: `requiredCriteria`, `rejectionCriteria` e `manualReviewCriteria` continuam sendo `string[]` no payload enviado (`buildDocumentPayload` já exige arrays), e o backend (`backend/src/routes/ai.js`) já separa critérios por linha/`;` e numera automaticamente ao montar o prompt da IA.

## Escopo

### Dentro do escopo

- Substituir a lista de chips + input de uma linha + botão "+" de cada coluna de critérios por um único `<textarea>` multi-linha, ocupando a coluna inteira.
- Pré-popular os 3 textareas com os critérios existentes (`array.join("\n")`) ao abrir um documento para edição.
- Converter cada textarea (texto multi-linha) em `string[]` somente no momento do submit do formulário (botão "Salvar" do documento), antes de chamar `createDocumentType`.
- Exportar a função `textToCriteriaList` de `src/domain.ts` (hoje privada) e reutilizá-la no frontend em vez de duplicar a lógica de split.
- Ajustar CSS da seção de critérios para o novo layout (sem chips, sem botão de adicionar).
- Atualizar o texto de dica acima das 3 colunas para refletir o novo comportamento.

### Fora do escopo

- Mudança de modelo de dados de critérios no backend (continua array de strings).
- Mudança no prompt/lógica de decisão da IA (`backend/src/routes/ai.js`).
- Redesenho de outras seções do modal (Identificação, Decisão automática).
- Validação de limite de tamanho/quantidade de critérios (mantém sem limite, como hoje).
- Deduplicação automática de critérios repetidos.

## Leitura de contexto

- `/AGENT.md` (regras globais do monorepo).
- Não existe `frontend/AGENT.md` nem `backend/AGENT.md` neste repositório (estrutura real é `src/` na raiz para o frontend + `backend/` para a API — diferente do template genérico do `/AGENT.md`, que assume `frontend/` e `backend/` como pastas irmãs).
- `.portal/specs/criterios-analise-em-topicos.md` (spec gerada a partir da conversa com o usuário).
- `src/App.tsx`: `DocumentCriteriaColumn` (linha ~6556), `openDocumentModal` (linha ~7142), `buildDocumentPayload` (linha ~7051), modal de documento e seus 3 `onAdd` (linha ~9420-9577).
- `src/domain.ts`: `textToCriteriaList` (linha ~136), `normalizeDocumentAnalysisRules`.
- `backend/src/routes/ai.js`: `toStringList` e `formatRuleList` (linhas ~83-94) — confirmam que o backend já tolera critérios separados por linha/`;` e já numera automaticamente para o prompt da IA.
- `src/styles.css`: regras `.document-criteria-*` (linhas ~7861-8010).

## Impacto por área

### Frontend

- **`src/App.tsx`**
  - `DocumentCriteriaColumn`: remover a lista de chips, o botão "+" e a lógica de `onAdd`/`onRemove`. Passa a receber `value` (texto multi-linha) e `onChange`, renderizando um único `<textarea>` que ocupa a coluna inteira. O contador no cabeçalho (`document-criteria-count`) passa a ser derivado ao vivo via `textToCriteriaList(value).length` (apenas para exibição, sem gravar em estado separado).
  - Reaproveitar os estados já existentes `newRequiredCriterion`, `newRejectionCriterion`, `newManualCriterion` (hoje usados como rascunho de item único) como o texto completo de cada coluna.
  - `openDocumentModal`: ao editar um documento existente, inicializar os 3 estados acima com `(rules.xCriteria || []).join("\n")` em vez de `""`. Ao criar um novo documento, continuar resetando para `""`.
  - `newDocument`/`emptyDocumentForm`: remover os campos `requiredCriteria`, `rejectionCriteria`, `manualReviewCriteria` desse estado — os 3 textareas passam a ser a única fonte de verdade enquanto o modal está aberto.
  - `onSubmit` do formulário do modal de documento: antes de chamar `createDocumentType`, montar o payload final incluindo `requiredCriteria: textToCriteriaList(newRequiredCriterion)`, `rejectionCriteria: textToCriteriaList(newRejectionCriterion)`, `manualReviewCriteria: textToCriteriaList(newManualCriterion)`. Resetar os 3 estados junto com `emptyDocumentForm` ao fechar/cancelar/salvar.
  - Texto de dica da seção ("Cada critério é um item independente...") deve refletir o novo fluxo (ex.: "Digite um critério por linha. As alterações são salvas junto com o botão Salvar deste documento.").
  - **Atenção:** já existe um rascunho não commitado no working tree (feito antes deste plano) que introduziu um textarea com botão "+" e uma função local `splitCriteriaLines` duplicando `textToCriteriaList`. Esse rascunho deve ser **substituído** pelo desenho deste plano (sem botão, sem chips, parse só no submit), não estendido.

- **`src/domain.ts`**
  - Exportar `textToCriteriaList` (hoje função privada, linha ~136) para reuso em `App.tsx`. Sem mudança de comportamento da função.

- Nenhum impacto em hooks de dados, React Query ou query keys — o formulário do documento já é estado local (`useState`), sem chamada de API própria (a persistência ocorre via `setDocumentTypes`/`setRequestTypes`, que já são propagados pelo componente pai).

### Backend

Sem impacto esperado. `backend/src/routes/ai.js` já trata `requiredCriteria`/`rejectionCriteria`/`manualReviewCriteria` como podendo ser array ou string bruta separada por linha/`;` (`toStringList`), e já numera os itens ao montar o prompt (`formatRuleList`). Nenhuma alteração de contrato é necessária.

### Banco de dados

Sem impacto esperado. O formato armazenado (`analysisRules.requiredCriteria` etc. como array de strings) não muda.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/domain.ts`
- `src/styles.css`

## Estratégia de implementação

1. Em `src/domain.ts`, exportar `textToCriteriaList`.
2. Em `src/App.tsx`, simplificar `DocumentCriteriaColumn` para receber `value`/`onChange`/`placeholder` e renderizar um único `<textarea>` com contador derivado via `textToCriteriaList`.
3. Remover `requiredCriteria`/`rejectionCriteria`/`manualReviewCriteria` de `emptyDocumentForm` e do tipo/uso de `newDocument`.
4. Atualizar `openDocumentModal` para popular `newRequiredCriterion`/`newRejectionCriterion`/`newManualCriterion` com `join("\n")` dos critérios existentes ao editar, e resetar para `""` ao criar novo.
5. Atualizar o JSX do modal de documento: renderizar as 3 colunas passando `value`/`onChange` diretamente para os estados de texto (sem `onAdd`/`onRemove`).
6. Atualizar o `onSubmit` do formulário para montar o payload final com os 3 arrays parseados via `textToCriteriaList` antes de chamar `createDocumentType`, e resetar os estados de texto junto com o restante do formulário (submit, cancelar e fechar).
7. Remover qualquer resquício do rascunho anterior (função local duplicada, botão "+", chips) que não faça parte deste desenho.
8. Ajustar `src/styles.css`: remover/reduzir `.document-criteria-list`, `.document-criteria-chip`, `.document-criteria-add` (botão), e garantir que o textarea ocupe a altura da coluna com boa leitura (line-height, padding, resize).
9. Testar manualmente no navegador: criar documento novo digitando várias linhas em cada coluna e salvar; editar documento existente e confirmar que os critérios aparecem pré-preenchidos um por linha; editar/remover uma linha e salvar; cancelar o modal sem salvar e reabrir para confirmar que não houve persistência indevida.
10. Rodar lint/typecheck/build do frontend.

## Regras de negócio identificadas

- Um critério = uma linha de texto não vazia dentro do textarea da coluna correspondente.
- Linhas vazias são ignoradas (mesmo comportamento de `textToCriteriaList`/`toStringList`: trim + filter).
- Não há limite de quantidade ou tamanho de critérios.
- Não há deduplicação automática.
- As alterações nos critérios só são persistidas ao clicar em "Salvar" do documento (não há salvamento parcial por coluna).

## Regras multi-tenant e segurança

- Sem impacto: o formulário de documento já opera sobre o escopo de município já resolvido pelo componente pai (`ConfigView`); nenhuma mudança neste plano altera resolução de tenant, permissões ou visibilidade cross-prefeitura.
- Nenhum dado sensível novo é introduzido; o conteúdo dos critérios já era texto livre configurado por administradores.

## Validações necessárias

- Nenhuma validação de formato adicional além do parse existente (trim + filtro de linhas vazias via `textToCriteriaList`).
- Garantir que o `onSubmit` não quebre se algum dos 3 textareas estiver vazio (deve resultar em array vazio, comportamento já suportado por `textToCriteriaList`/`buildDocumentPayload`).

## Testes necessários

### Frontend

- Verificação manual (não há suíte de testes automatizados de UI para este modal hoje, conforme padrão observado no restante do arquivo `App.tsx`).

### Backend

- Nenhum teste novo necessário (sem alteração de contrato ou comportamento).

### E2E

- Sem impacto esperado; não há suíte E2E identificada cobrindo este modal.

## Comandos de validação sugeridos

```bash
npm run lint
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Remover `requiredCriteria`/`rejectionCriteria`/`manualReviewCriteria` de `newDocument` pode quebrar algum outro trecho do arquivo que ainda leia `newDocument.requiredCriteria` diretamente (ex.: contagem, preview) — necessário revisar todos os usos antes de remover.
- O rascunho não commitado já existente no working tree (`splitCriteriaLines`, botão "+", chips) precisa ser substituído com cuidado para não deixar código morto (função duplicada, CSS órfão) para trás.
- Nenhum estilo de dark mode específico existe hoje para essa seção — validar visualmente nos dois temas se o projeto suportar tema escuro global.
- Ao editar um documento existente, se `rules.requiredCriteria` (ou as outras duas) não for array (dado legado/malformado), o `join("\n")` deve ser aplicado sobre um array vazio de fallback (mesmo padrão já usado em `openDocumentModal` hoje: `Array.isArray(...) ? ... : []`).
- Como as alterações só persistem no "Salvar" do documento, fechar o modal com "Cancelar" ou no "×" deve continuar descartando qualquer edição feita nos textareas (comportamento já esperado, mas deve ser confirmado no teste manual).

## Perguntas em aberto

Nenhuma pergunta em aberto identificada (aprovado pelo usuário na revisão 2 do plano).

## Critérios de aceite do plano

- Cada coluna de critérios é um único textarea multi-linha, sem botão "+", sem chips individuais.
- Editar um documento existente pré-popula os textareas com os critérios já cadastrados, um por linha.
- Critérios só são persistidos ao clicar em "Salvar" do documento.
- `textToCriteriaList` é exportada de `src/domain.ts` e reutilizada em `src/App.tsx`, sem lógica de split duplicada.
- Lint, typecheck e build do frontend passam sem novos erros.
- Testado manualmente no navegador (criar, editar, cancelar) conforme passo 9 da estratégia.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- O rascunho não commitado existente em `src/App.tsx`/`src/styles.css` (textarea com botão "+" e `splitCriteriaLines`) deve ser substituído pelo desenho deste plano, não estendido — conferir que nenhum resíduo (função duplicada, CSS de botão/chip órfão) permaneça.
- Não executar migrations (não há impacto de banco neste plano).
- Seguir `/AGENT.md`. Não existem `frontend/AGENT.md` nem `backend/AGENT.md` neste repositório.
- Manter alterações pequenas e focadas nos 3 arquivos listados.
- Ao final, seguir o fluxo de commit/push direto em `main` já usado neste projeto (sem branch `staging`, conforme padrão observado na skill `finalizar` e no histórico de commits), a menos que o usuário peça revisão antes.
