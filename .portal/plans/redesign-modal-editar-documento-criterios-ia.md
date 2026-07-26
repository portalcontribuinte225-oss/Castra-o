# Plano de Implementação: Redesign do modal "Editar documento" (critérios de análise por IA)

## Origem

- Arquivo de especificação: mockup HTML colado pelo usuário na conversa (protótipo standalone com runtime próprio — não é um `.md` em disco).
- Data do planejamento: 2026-07-26
- Classificação: `frontend-only`
- Supera parcialmente o plano anterior `.portal/plans/reorganizar-modal-analise-documental-ia.md` (que gerou a implementação atual): aquele plano exigia explicitamente "manter a regra de um critério por linha" via textarea. O novo mockup pede uma evolução deliberada disso — critérios como chips individuais removíveis, agrupados em 3 colunas coloridas — que é o que este plano implementa.

## Resumo

Trocar o layout atual do modal (sidebar + conteúdo, critérios digitados como texto livre "um por linha" em textareas) pela estrutura do novo mockup: cabeçalho com status (bolinha colorida + Ativo/Inativo + nome do documento), e 3 seções empilhadas em largura total:

1. **Identificação** — Nome + Documento esperado (grid 2 colunas).
2. **Critérios de análise** — 3 colunas coloridas (verde/vermelho/âmbar) para Obrigatórios, Recusa e Revisão manual, cada uma com contador, lista de chips removíveis e um campo de adicionar (Enter ou botão "+").
3. **Decisão automática** — slider de confiança mínima (0–100%, com barra de progresso) + 2 toggles com descrição (Aprovação automática, Revisar recusa).

Aproveita a troca para terminar a migração pendente do estado interno do formulário (`modelHint`/`aiCriteria`/`rejectionRules`/`manualReviewRules` → nomes estruturados alinhados com `analysisRules`), e para os critérios passarem a ser arrays reais no estado do formulário em vez de string com quebras de linha.

## Escopo

### Dentro do escopo

- Reescrever o JSX do modal "document" dentro de `ConfigView` (`src/App.tsx`, atualmente linhas ~9181–9297).
- Criar um subcomponente local para a coluna de critérios (chip list + contador + input de adicionar), reaproveitado nas 3 variantes de cor.
- Criar um bloco/subcomponente local para o slider de confiança mínima (0–100%, passos de 1%) com barra de progresso.
- Atualizar `emptyDocumentForm`, `openDocumentModal` e `buildDocumentPayload` (todas dentro de `ConfigView`) para:
  - manter `requiredCriteria`/`rejectionCriteria`/`manualReviewCriteria` como arrays no estado do formulário (sem o round-trip de `.join("\n")` / split por linha);
  - representar `minimumConfidence` como inteiro percentual (0–100) na UI, convertendo para fração 0–1 apenas ao montar o payload salvo;
  - renomear os campos internos do formulário para nomes estruturados (`expectedDocument` em vez de `modelHint`, etc.), completando a limpeza já sinalizada em `.portal/plans/readequar-analise-documental-ia-estruturada.md`.
- Reescrever as classes CSS `.document-modal-*` / `.document-criteria-*` em `src/styles.css` (bloco base ~7633–7765 e a media query mobile ~22048–22067).
- Manter `ConfigActiveToggle` (`src/components/ui.tsx`) para os toggles — só muda o layout ao redor (rótulo + descrição), preservando o padrão visual já usado no restante do `ConfigView`.

### Fora do escopo

- Alterar backend (`backend/src/routes/ai.js`), prompt da IA ou schema de validação.
- Alterar o formato final persistido de `analysisRules` (continua array de strings, já é assim hoje).
- Alterar regras de privacidade/LGPD já implementadas na sanitização da resposta da IA.
- Criar endpoint novo ou alterar banco/migrations.
- Alterar qualquer outro modal do `ConfigView`.
- Mexer no fluxo de prontuário/procedimento (assunto de outro plano em aberto, `redirecionar-procedimento-prontuario-para-solicitacoes.md`).

## Leitura de contexto

- `/AGENT.md` — lido em rodadas anteriores desta sessão.
- `frontend/AGENT.md` / `backend/AGENT.md` — não existem neste repositório (estrutura real: frontend na raiz `src/`, backend em `backend/`).
- `src/App.tsx` — modal atual do documento (`ConfigView`, linhas ~9181–9297), `emptyDocumentForm` (~6773), `openDocumentModal` (~6970), `buildDocumentPayload` (~6981).
- `src/components/ui.tsx` — `ConfigActiveToggle`, `Field`, `ModalHeader`, `ConfigSectionHeader` (componentes reutilizáveis já usados no modal atual).
- `src/domain.ts` — `normalizeDocumentType`, `normalizeDocumentAnalysisRules`, `DEFAULT_DOCUMENT_MINIMUM_CONFIDENCE` (já normalizam `analysisRules` para arrays independentemente do formato de entrada).
- `backend/src/routes/ai.js` — confirma que `analysisRules.requiredCriteria`/`rejectionCriteria`/`manualReviewCriteria` já são consumidos como arrays.
- `.portal/plans/reorganizar-modal-analise-documental-ia.md` — plano anterior que gerou o layout atual (ver "Origem" acima).
- `.portal/plans/readequar-analise-documental-ia-estruturada.md` — plano da migração de campos legados para `analysisRules`, ainda com resíduo pendente no estado do formulário deste modal.
- Mockup HTML fornecido pelo usuário na conversa — layout-alvo completo (estados, chips, slider, toggles).

## Impacto por área

### Frontend

- **Layout**: sidebar (`aside.document-modal-sidebar`) + painel de critérios lado a lado dá lugar a 3 seções empilhadas em largura total.
- **Componentes novos (locais, não vão para `components/ui.tsx`)**:
  - Coluna de critérios com chip list (contador + lista removível + input de adicionar), parametrizada por cor/variante — reaproveitada 3x.
  - Slider de confiança mínima com barra de progresso e leitura percentual.
- **Estado (`newDocument` em `ConfigView`)**: `requiredCriteria`/`rejectionCriteria`/`manualReviewCriteria` passam de string (com `\n`) para array; `minimumConfidence` passa a ser inteiro 0–100 na UI (mantém fração 0–1 só no payload salvo); renomeação de `modelHint`→`expectedDocument` e afins no estado interno.
- **Funções afetadas em `ConfigView`**: `emptyDocumentForm`, `openDocumentModal`, `buildDocumentPayload`. Sem mudança em `createDocumentType`/`patchDocumentType`/`normalizeDocumentType` (continuam recebendo o mesmo formato de payload que já aceitam hoje).
- **CSS**: reescrita das classes `.document-modal-*`/`.document-criteria-*` (base + mobile) em `src/styles.css`.
- **Toggles**: continuam usando `ConfigActiveToggle` — sem novo componente de toggle.
- **Estados de loading/error/empty**: nenhuma chamada assíncrona nova; o único "estado vazio" novo é uma coluna de critérios sem nenhum item adicionado, que deve renderizar a lista vazia sem quebrar o layout.
- **Testes**: sem suíte automatizada de frontend configurada no projeto atualmente.

### Backend

Sem impacto esperado. `analysisRules` já é persistido e consumido como array de strings hoje (`backend/src/routes/ai.js`).

### Banco de dados

Sem impacto esperado.

Atenção: migrations não devem ser executadas sem confirmação explícita do usuário, pois o ambiente atual pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx` (modal "document" dentro de `ConfigView`, e `emptyDocumentForm`/`openDocumentModal`/`buildDocumentPayload`)
- `src/styles.css` (`.document-modal-*`/`.document-criteria-*`, base e media query mobile)

## Estratégia de implementação

1. Criar o subcomponente local de coluna de critérios (chip list + contador + adicionar por Enter/botão), parametrizado por variante de cor (verde/vermelho/âmbar) e por label.
2. Criar o bloco/subcomponente local do slider de confiança mínima (input `range` 0–100, passos de 1, com barra de progresso e leitura percentual sobreposta).
3. Atualizar `emptyDocumentForm`: arrays vazios para os 3 critérios, `minimumConfidence` inteiro (`Math.round(DEFAULT_DOCUMENT_MINIMUM_CONFIDENCE * 100)`), renomear campos legados para os nomes estruturados.
4. Atualizar `openDocumentModal`: carregar `rules.requiredCriteria`/`rejectionCriteria`/`manualReviewCriteria` diretamente como arrays (sem `.join("\n")`), converter `minimumConfidence` de fração para inteiro percentual ao popular o formulário.
5. Atualizar `buildDocumentPayload`: converter `minimumConfidence` de inteiro percentual de volta para fração 0–1, repassar os arrays de critérios direto (sem string intermediária).
6. Reescrever o JSX do modal (linhas ~9181–9297) na nova estrutura de 3 seções, usando os subcomponentes criados nos passos 1–2 e mantendo `ModalHeader`/`ConfigActiveToggle` existentes.
7. Reescrever o CSS `.document-modal-*`/`.document-criteria-*` (bloco base e a media query mobile) para o novo layout — grid de 3 colunas coloridas em desktop, empilhado em mobile.
8. Verificação visual no navegador: criar documento novo; editar documento existente (confirmando que critérios já salvos aparecem corretamente como chips); adicionar/remover chips nas 3 colunas; mover o slider; alternar os 2 toggles de decisão automática e os 2 do cabeçalho (obrigatório/opcional, ativo/inativo); salvar e reabrir para confirmar persistência; testar em viewport mobile.
9. `npm run typecheck` e `npm run build`.

## Regras de negócio identificadas

- Um documento tem: nome, descrição do documento esperado, se é obrigatório ou opcional, se está ativo ou inativo.
- Critérios de análise por IA organizados em 3 categorias independentes: obrigatórios (o que precisa estar presente para aprovar), recusa (motivos que levam à recusa), revisão manual (situações em que a IA não deve decidir sozinha).
- Cada critério é um item individual, adicionável e removível (chip), não mais texto livre em bloco.
- Decisão automática: confiança mínima (0–100%) abaixo da qual o documento vai para revisão manual; toggle de aprovação automática; toggle de recusa automática (quando desligado, recusas viram revisão manual — regra que já existe hoje no backend, `ai.js`).

## Regras multi-tenant e segurança

- O modal já opera dentro do escopo do município selecionado (`configMunicipalityScopeId`) — sem mudança nesse mecanismo.
- Nenhuma alteração em autenticação, autorização ou nas regras de sanitização de dados pessoais na resposta da IA (`sanitizeText` em `backend/src/routes/ai.js`, fora do escopo).

## Validações necessárias

- Nome do documento: obrigatório (mantém validação/comportamento atual, se existir).
- Confiança mínima: sempre entre 0 e 100 (garantido pelo próprio `range` do slider, sem necessidade de validação adicional).
- Critérios: item vazio (string em branco) não deve ser adicionado como chip — mesma regra de trim/filtro já usada em `textToCriteriaList`/`normalizeDocumentAnalysisRules`.

## Testes necessários

### Frontend

Sem testes automatizados novos (projeto não tem suíte configurada).

### Backend

Sem impacto, sem testes novos.

### E2E

- Verificação visual manual: criar documento novo do zero.
- Editar documento existente com critérios já salvos (confirmar que aparecem corretamente como chips, inclusive documentos criados antes desta mudança).
- Adicionar e remover chips nas 3 colunas (Obrigatórios/Recusa/Revisão manual), incluindo via Enter e via botão "+".
- Mover o slider de confiança mínima e confirmar que o valor persiste corretamente (convertido de volta para fração 0–1).
- Alternar os 4 toggles (Obrigatório/Opcional, Ativo/Inativo, Aprovação automática, Recusar automaticamente) e confirmar persistência.
- Testar em viewport mobile (empilhamento das seções e das 3 colunas de critérios).

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Nenhum risco de perda de dados: a normalização (`normalizeDocumentType`/`normalizeDocumentAnalysisRules`) já converte string→array hoje, então documentos criados antes desta mudança continuam sendo lidos corretamente pelos novos chips.
- Risco de regressão visual em mobile se a media query não for atualizada junto com o bloco base do CSS.
- Risco de misturar no commit mudanças não relacionadas já pendentes em `src/App.tsx`/`src/styles.css` (arquivos grandes, já com outras alterações em andamento na sessão) — revisar `git diff`/stage seletivo ao finalizar.
- Risco operacional: push para `origin/main` pode estar bloqueado por permissão (já observado nesta sessão) — commits podem ficar pendentes até o usuário resolver o acesso.
- Nenhum risco de vazamento multi-tenant, migration ou produção além do já mapeado — é uma mudança de UI isolada.

## Perguntas em aberto

As 3 perguntas abaixo foram levantadas na apresentação do plano; adoto um padrão razoável para não bloquear a implementação, mas ficam abertas para o usuário revisar/corrigir a qualquer momento:

1. **Comportamento ao salvar** — o mockup mantém o modal aberto após salvar, mostrando "Alterações salvas" por alguns segundos. Padrão adotado: manter o comportamento atual do app (fecha o modal ao salvar), por consistência com todos os outros modais do `ConfigView`.
2. **Toggle "Obrigatório/Opcional"** — o mockup usa um rótulo estático "Opcional". Padrão adotado: manter o texto dinâmico atual ("Obrigatório"/"Opcional" alternando conforme o estado), já usado em outros modais do `ConfigView`.
3. **Granularidade do slider de confiança** — padrão adotado: passos de 1% (inteiro), como no mockup.

## Critérios de aceite do plano

- O modal fica visualmente organizado em 3 seções empilhadas (Identificação, Critérios de análise, Decisão automática), com cabeçalho mostrando status.
- Critérios de análise (obrigatórios/recusa/revisão manual) são editados como chips individuais removíveis, com contador por coluna.
- Confiança mínima é editada via slider percentual (0–100%) com leitura visual clara.
- Documentos criados antes desta mudança continuam sendo carregados e editados corretamente (sem perda de critérios já salvos).
- `npm run typecheck` e `npm run build` passam sem erros novos.
- Nenhuma mudança em backend, banco de dados, env vars ou fluxo não relacionado a este modal.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto, junto com o mockup HTML original (já compartilhado na conversa que originou este plano).
- Não executar migrations.
- Não alterar `.env`.
- Não adicionar dependências novas (o slider e os chips podem ser feitos com HTML/CSS puro + estado local, sem biblioteca externa).
- Seguir `/AGENT.md` (English-only para identificadores novos, sem strings mágicas, sem código morto).
- Manter alterações restritas ao modal de documento — não tocar em outros modais do `ConfigView` nem em código não relacionado já pendente nos mesmos arquivos.
- Ao finalizar, revisar `git diff` para garantir que só as mudanças deste plano entrem no que for commitado (arquivos grandes com outras alterações em andamento na sessão).
- Não fazer commit/push sem autorização explícita do usuário — isso é responsabilidade da skill `finalizar`, só quando solicitado.
