# Plano de Implementação: Igualar altura dos filtros aos botões e remover cor fixa do botão Buscar (Relatórios)

## Origem

- Especificação: descrita em conversa, a partir de um screenshot da faixa de filtros da tela "Relatórios".
- Data do planejamento: `2026-07-28`
- Classificação: `frontend-only` — toda a mudança fica em `src/styles.css`, sem impacto em `src/features/reports.tsx` (JSX não precisa mudar).

## Resumo

Dois ajustes visuais na faixa de filtros da tela de Relatórios:
1. Os campos de filtro (Início, Fim, Tipo, Status, Taxas, Agenda) têm `min-height: 44px` (última declaração vencedora em `src/styles.css:20651`, dentro de um seletor combinado com `form input`/`form select`/`.ag-select`/etc.), enquanto os botões de ação (`Limpar`/`Buscar`/`Exportar`/`Prontuário`) têm `min-height: 40px`. Isso cria uma diferença de 4px perceptível na tela. Este plano iguala a altura dos filtros à altura dos botões, especificamente dentro do contexto de `.reports-filter-grid` (sem alterar a altura de inputs/selects em outras telas).
2. O botão "Buscar" usa a classe `.primary-action`, que tem cor de fundo sólida sempre visível (`background: var(--action-primary)`, última declaração vencedora em `src/styles.css:26134-26162`). Essa classe é compartilhada com **dezenas de outros botões primários do sistema inteiro** (criar usuário, criar setor, criar município, adotar animal, continuar no fluxo público de solicitação, etc.) — não é exclusiva de Relatórios. O usuário confirmou que quer a mudança **só no botão Buscar desta tela**, não em todos os botões primários do sistema. Por isso, a implementação cria uma variação visual adicional aplicada só ao contexto de `.reports-filter-actions`, sem alterar a regra compartilhada `.primary-action`.

## Escopo

### Dentro do escopo

- Igualar a altura (`min-height`) dos `<input>`/`<select>` dentro de `.reports-filter-grid` à altura dos botões de ação (`40px`), via uma regra CSS escopada a esse contexto.
- Remover a cor de fundo sólida do botão "Buscar" **apenas dentro de `.reports-filter-actions`** (tela de Relatórios), mantendo-o com aparência neutra/outline no estado normal e aplicando a cor de destaque apenas no `:hover`.
- Preservar o comportamento de `:focus-visible`/`:disabled` do botão (acessibilidade, estado desabilitado continuam claros visualmente).

### Fora do escopo

- Alterar `.primary-action` globalmente ou qualquer outro botão primário do sistema (criar usuário, adotar animal, fluxo público, etc.) — confirmado explicitamente pelo usuário que a mudança é só para o botão Buscar de Relatórios.
- Alterar a altura de inputs/selects em outras telas (Agenda, Configurações, Credenciamento, etc.) — só o contexto de `.reports-filter-grid`.
- Mudar o JSX de `src/features/reports.tsx` — a estrutura de classes já existente (`.field`, `.reports-filter-field`, `.reports-filter-actions`, `.primary-action`) é suficiente para aplicar os ajustes só via CSS com seletores escopados.
- Redesenhar o restante da tela de Relatórios (fora do escopo deste pedido pontual).

## Leitura de contexto

- `/AGENT.md` (regras globais). Fluxo real do repositório é commit direto em `main`, sem `staging`/PR.
- `src/features/reports.tsx:178-252` (JSX da faixa de filtros e botões de ação, já implementado no plano anterior `.portal/plans/reorganizar-tela-relatorios.md` — este plano só ajusta CSS por cima do que já existe).
- `src/styles.css:5364-5380` (bloco base de `.field input`/`.field select`, `min-height: 44px`).
- `src/styles.css:20638-20658` (geração mais recente que redefine `min-height: 44px` para `.field input`/`.field select` — a que vence hoje).
- `src/styles.css:26134-26162` (`.primary-action` — geração mais recente/vencedora, cor de fundo sólida sempre visível, compartilhada com dezenas de outros botões via seletor combinado).
- `src/styles.css:26182-...` (`.primary-action:hover:not(:disabled)` — estado de hover já existente, referência de cor a reaproveitar no estado normal do botão dentro de Relatórios, invertendo a lógica: cor só aparece no hover).
- `src/styles.css:4913-4937` (`.reports-filter-grid`, `.reports-filter-actions` — contexto onde os seletores escopados deste plano devem viver).

## Impacto por área

### Frontend

- `src/styles.css`:
  - Nova regra escopada `.reports-filter-grid input, .reports-filter-grid select { min-height: 40px; }` (ou equivalente mais específico o suficiente para vencer a cascata atual sem `!important`, dado que a regra concorrente em `20651` usa seletor combinado genérico `.field input, .field select`) — como os filtros de Relatórios usam `<label className="field reports-filter-field">`, o seletor `.reports-filter-grid .field input, .reports-filter-grid .field select` tem maior especificidade (dois níveis de classe) que `.field input`/`.field select` sozinhos, o que deve vencer sem precisar de `!important`. Confirmar isso durante a implementação — se a regra em `20651` usa `!important` (ela usa: ver linha correspondente), pode ser necessário `!important` também aqui, com comentário explicando que está sobrepondo uma regra compartilhada de fora do escopo (caso legítimo de exceção, conforme regra do `/AGENT.md`).
  - Nova regra escopada `.reports-filter-actions .primary-action { background: transparent; color: <cor de texto neutra>; border-color: <cor de borda neutra>; }` para remover a cor de fundo do botão Buscar só neste contexto, e `.reports-filter-actions .primary-action:hover:not(:disabled) { background: var(--action-primary); color: var(--action-primary-ink); }` para restaurar a cor no hover — reaproveitando as mesmas variáveis (`--action-primary`, `--action-primary-ink`) já usadas pela regra global, não valores novos hardcoded.
  - Confirmar visualmente (ou via grep de especificidade) que essas duas novas regras de fato vencem a cascata existente sem precisar duplicar em múltiplos pontos do arquivo — diferente de outras vezes neste projeto, aqui a estratégia não é remover/consolidar gerações antigas (que são compartilhadas com outras telas, fora de escopo), e sim adicionar regras mais específicas por cima, que é o caso legítimo de exceção já documentado na skill `implementar`.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css`

## Estratégia de implementação

1. Adicionar regra CSS escopada para igualar `min-height` dos inputs/selects dentro de `.reports-filter-grid` à altura dos botões (`40px`), testando se a especificidade natural (`.reports-filter-grid .field input`) já vence a regra concorrente ou se precisa de `!important` com comentário explicativo.
2. Adicionar regra CSS escopada para o botão Buscar dentro de `.reports-filter-actions`: remover `background`/ajustar `border`/`color` no estado normal, mantendo cor só no `:hover:not(:disabled)`, reaproveitando as variáveis de cor já existentes (`--action-primary`, `--action-primary-ink`, `--action-primary-border`).
3. Rodar `npm run build` para validar que o CSS compila sem erro.
4. Validar visualmente na tela: os 6 campos de filtro (Início/Fim/Tipo/Status/Taxas/Agenda) com a mesma altura dos 4 botões de ação; botão Buscar sem cor de fundo em repouso, com cor ao passar o mouse; nenhum outro botão primário do sistema (fora de Relatórios) afetado.

## Regras de negócio identificadas

Nenhuma regra de negócio nova — mudança puramente visual/CSS.

## Regras multi-tenant e segurança

Sem impacto — mudança de CSS não afeta isolamento de tenant nem dados.

## Validações necessárias

- Altura dos campos de filtro (Início, Fim, Tipo, Status, Taxas, Agenda) igual à altura dos botões (Limpar, Buscar, Exportar, Prontuário) na tela de Relatórios.
- Botão "Buscar" sem cor de fundo sólida em estado normal; cor aparece ao passar o mouse (hover); estado `:disabled` (se algum dia aplicável a este botão) continua visualmente distinto.
- Nenhum outro botão `.primary-action` do sistema (Configurações, Adoção, fluxo público, Credenciamento, etc.) teve a cor de fundo alterada.
- Nenhum outro `<input>`/`<select>` fora da tela de Relatórios teve a altura alterada.

## Testes necessários

### Frontend

Nenhuma suíte automatizada pré-existente para esta tela; validação manual visual dos cenários acima.

### Backend

Sem impacto.

### E2E

Não aplicável — mudança puramente visual, sem impacto funcional.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Risco principal: `.primary-action` é uma classe extremamente compartilhada (confirmado: dezenas de seletores combinados em `src/styles.css:26134-26146`). Qualquer edição na regra base afetaria o sistema inteiro — por isso a estratégia escolhida é aditiva (nova regra mais específica escopada a `.reports-filter-actions`), não uma edição da regra compartilhada.
- Se a regra concorrente de `min-height: 44px` (linha `20651`) usa `!important`, a nova regra escopada também pode precisar de `!important` para vencer — nesse caso, comentar explicitamente que está sobrepondo uma regra compartilhada fora de escopo (padrão já aceito pelo `/AGENT.md` para esse cenário específico).
- Risco de produção: commit/push direto em `main`, sem `staging`.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — usuário confirmou que a remoção de cor do botão Buscar deve ser restrita à tela de Relatórios, não aplicada a todos os botões primários do sistema.

## Critérios de aceite do plano

- Campos de filtro e botões de ação com a mesma altura na tela de Relatórios.
- Botão "Buscar" sem cor de fundo em repouso, com cor ao passar o mouse — só nesta tela.
- Nenhum outro botão primário do sistema afetado.
- Build passa sem erros novos.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não editar a regra compartilhada `.primary-action` (linha `26134-26162`) nem `.field input`/`.field select` (linha `20638-20658`) diretamente — criar regras novas, mais específicas, escopadas a `.reports-filter-grid`/`.reports-filter-actions`.
- Reaproveitar as variáveis de cor já existentes (`--action-primary`, `--action-primary-ink`, `--action-primary-border`) em vez de hardcodar cores novas.
- Este projeto não usa `staging`; seguir o fluxo real do repositório (commit direto em `main`, sem PR).
- Comunicação durante a execução: sem código/diff no chat — só "codando..." no início e um resumo curto no final (ver regra já aplicada nas skills `implementar`/`finalizar`/`limpar` deste projeto).
