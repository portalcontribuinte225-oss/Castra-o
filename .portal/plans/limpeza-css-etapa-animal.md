# Plano de Implementação: Limpeza de código morto/duplicado/antigo da etapa "Animal"

## Origem

- Arquivo de especificação: nenhum — pedido direto do usuário na conversa, após auditoria de leitura (agente Explore, read-only) sobre `src/App.tsx` e `src/styles.css`
- Data do planejamento: 2026-07-24
- Classificação: `frontend-only`

## Resumo

Ao longo das últimas rodadas de redesign da etapa Animal (v2/v3/v4, escopadas a `.nr-shell--public`), o arquivo `src/styles.css` (~21.600 linhas) acumulou várias gerações de regras para as mesmas classes: uma "base" antiga (compartilhada com o modal interno do staff) e uma ou mais camadas escopadas ao público que a sobrescrevem. Isso deixou para trás: (a) classes que não existem mais no JSX (renomeadas em refatorações anteriores), (b) fragmentos de regras agrupadas por vírgula onde só parte do seletor ainda é alcançável, e (c) uma cadeia de ~6 gerações de regras para `.animal-form` competindo por `border`/`background`/`box-shadow` com empates de especificidade. Este plano remove o que está genuinamente morto e poda os fragmentos mortos dentro de regras compartilhadas, sem tocar no que ainda está em uso pelo modal interno do staff.

## Escopo

### Dentro do escopo

1. **Remoção total** de classes que não aparecem em nenhum `className` de `src/App.tsx`/`src/components/ui.tsx` (verificado por grep no arquivo inteiro):
   - `.health-card`, `.choice-card` (substituídas por `.form-sub-card`/`.health-grid`)
   - `.yes-no-field` (bare — distinta de `.yes-no-toggle-field`, que está viva)
   - `.compact-choice`, `.compact-choice-grid`, `.compact-choice-label` (renomeadas para `.compact-choice-field`/`.animal-choice-grid`)
   - `.segmented-label`
   - `.birth-weight-row`, `.breed-weight-row` (layout atual usa `.two-col`/`.two-column-fields`)
   - `.declaration-box`
   - `.nr-shell--embedded` (nenhum call-site de `NewRequest` produz essa classe hoje)
   - `.nr-shell--public .internal-chip-check` (escopo público nunca coexiste com `internalSimple`)
2. **Poda cirúrgica** de regras agrupadas por vírgula onde alguns seletores da lista estão mortos mas outros (`.animal-photo-upload-card`, `.public-schedule-picker`, `.doc-declaration`, `.doc-empty-note`, `.animal-choice-grid`, `.health-grid`, `.field-label`) continuam vivos — remover só o fragmento morto, preservando a regra para o resto.
3. **Duplicata parcial**: `.nr-shell .access-field[data-label]::before` (~L16700) redeclara `color`/`font-size`/`font-weight`/`text-transform` já definidos de forma idêntica (exceto 1px de letter-spacing irrelevante) por uma versão posterior (~L17176). Remover as propriedades repetidas de L16700, mantendo `content: attr(data-label)` (não redeclarado na versão posterior) e o seletor irmão `.access-modal .access-field[data-label]::before` (usado no modal de credenciamento, fora da etapa Animal).
4. **Regra do botão selecionado (azul antigo) genuinamente morta**: `.yes-no-field, .compact-choice-field button.selected` (~L6054) — o fragmento `.compact-choice-field button.selected` é 100% sombreado por uma regra `!important` posterior (~L8793) que é a que realmente define a cor hoje (inclusive para o staff). Remover essa regra de L6054 por inteiro (o fragmento `.yes-no-field` já está morto pelo item 1).
5. **Cadeia `.animal-form`** (border/background/box-shadow, ~6 gerações competindo): `.animal-form` bare (~L5300, junto com `.declaration-box` morta), `.nr-shell .animal-form` (~L16823), fragmento `.animal-form` dentro da lista com `.health-card`/`.choice-card` (~L17253), `.internal-request-modal .animal-form { padding:14px }` (~L12919). Todas nunca vencem a cascata hoje porque `.nr-shell .single-request-form .animal-form` (~L18108) e `.internal-request-modal .single-request-form .animal-form` (~L13419) são sempre mais específicas (o `.animal-form` está sempre aninhado em `.single-request-form` no JSX). **Antes de remover**: passo dedicado de verificação visual (tela do staff e do público lado a lado, incluindo hover/estados) para confirmar que a leitura estática está certa — essa cadeia tem empates de especificidade que já se provaram traiçoeiros nesta sessão (ex.: o bug de `overflow-x`/`overflow-y` descoberto na rodada anterior).
6. **`.nr-shell .anm-type-card` dentro da lista `.nr-shell .compact-choice button, .nr-shell .yes-no-field button, .nr-shell .anm-type-card`** (~L16868-16884, incluindo o par `.is-selected`) — único caso onde um fragmento tecnicamente vivo (`.anm-type-card` é renderizado de verdade) está mesmo assim 100% sombreado por `.nr-shell .anm-type-card`/`.nr-shell .anm-type-card.is-selected` posteriores (~L18085-18105, mesma especificidade, posição posterior). Remover só os fragmentos `.compact-choice button`/`.yes-no-field button` (mortos) e o fragmento `.anm-type-card`/`.anm-type-card.is-selected` desta lista específica (a versão que realmente vence continua em L18085-18105, intocada).

### Fora do escopo

- Qualquer regra ainda vigente para o **modal interno do staff** (`.internal-request-modal`), mesmo que use paleta antiga (azul `#2563eb`, cinza `#66758a`) — confirmado em uso real, não é lixo. Exemplos preservados: `.compact-choice-field button.selected` com `!important` (~L8793), `.nr-shell .anm-type-card`/`.compact-choice-field button`/`.yes-no-field button` (~L18085-18095), `.access-field[data-label]::before` cor `#66758a` (~L17176).
- Etapas Tutor/Agenda/Documentos do wizard — fora do pedido atual (é só a etapa Animal).
- Qualquer mudança de lógica, validação ou dado gravado — é limpeza de CSS/JS morto, não alteração de comportamento.
- Variáveis `--ui-border`/`--ui-action` usadas com fallback (~L16823, ~L16887-16900) — não fazem parte desta limpeza; o agente de investigação notou que existem blocos de tema (~L15898, 20344, 20871) que definem essas variáveis em outro escopo e não foram auditados a fundo; mexer neles é fora do escopo deste plano.

## Leitura de contexto

- `/AGENT.md` — fluxo direto em `main`, sem staging/PR
- `src/App.tsx` — componente `NewRequest` (~L2940-3960): confirmação de quais classes são renderizadas em `publicFlow` vs `internalSimple`/staff
- `src/components/ui.tsx` — `YesNoField`/`SegmentedButtons`/`YesNoToggleField`/`ToggleChoiceField`/`ToggleSwitch`/`CompactChoiceField`
- `src/styles.css` — todas as ocorrências de cada seletor listado acima (levantadas via grep no arquivo inteiro pelo agente de investigação)
- Relatório do agente Explore (investigação read-only desta conversa) — fonte principal dos achados e classificações acima

## Impacto por área

### Frontend

- `src/styles.css`: remoção/poda das regras listadas no escopo. Nenhuma classe nova, nenhum seletor novo — só remoção.
- `src/App.tsx` / `src/components/ui.tsx`: nenhuma mudança esperada (a investigação não achou props/imports/componentes JS mortos na etapa Animal — só CSS acumulado).
- Nenhum impacto em `formStep`, validação (`getRequestValidationIssues`), ou no contrato de dados do animal (`species`/`sex`/`breedType`/`size`/etc.).

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css`

## Estratégia de implementação

1. Remover as classes 100%-mortas do item 1 do escopo (grep de cada uma no arquivo inteiro antes e depois, para confirmar zero ocorrências remanescentes que importem).
2. Podar os fragmentos mortos dentro das regras agrupadas (item 2), preservando os seletores vivos na mesma regra.
3. Aplicar a duplicata parcial do item 3 (`access-field[data-label]::before`).
4. Remover a regra de botão selecionado azul morta do item 4.
5. Rodar `npm run typecheck` e `npm run build` (checkpoint intermediário).
6. Testar visualmente via Chrome headless: etapa Animal pública (pill selecionada, toggle, cards) e modal interno do staff (abrir "Nova solicitação"), comparando screenshots antes/depois — confirmar que NENHUMA cor/borda/sombra mudou visualmente em nenhum dos dois contextos.
7. Só então avançar para o item 5 (cadeia `.animal-form`) e item 6 (`.anm-type-card` na lista antiga): remover, rebuildar, e repetir a verificação visual do passo 6 focada especificamente em bordas/sombras dos cards (`.form-sub-card`, `.animal-form`, cards do staff) e nos botões `.anm-type-card` (tipo de solicitação) em ambos os fluxos.
8. Grep final de cada classe removida no arquivo inteiro, para garantir que não sobrou nenhuma referência órfã (CSS ou JSX).

## Regras de negócio identificadas

Nenhuma — é limpeza de CSS/JS morto, sem mudança de regra de negócio, validação ou dado.

## Regras multi-tenant e segurança

Sem impacto — mudança puramente de limpeza de front-end, não mexe em resolução de tenant/prefeitura nem em permissões.

## Validações necessárias

- Confirmar visualmente que a etapa Animal pública continua idêntica (cores, bordas, sombras, pills, toggles) antes e depois da limpeza.
- Confirmar visualmente que o modal interno do staff ("Nova solicitação") continua idêntico antes e depois — é o ponto de maior risco, já que várias regras removidas hoje "vencem" silenciosamente para o staff mesmo usando paleta antiga.
- Grep de cada classe removida no arquivo inteiro após a limpeza (checklist da skill `implementar`).

## Testes necessários

### Frontend

Sem testes automatizados novos (projeto não tem suíte frontend configurada).

### Backend

Sem impacto esperado.

### E2E

- Comparação visual (CDP/headless Chrome) antes/depois: etapa Animal pública (1 e 2+ animais) e modal interno do staff.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- **Risco principal**: a cadeia `.animal-form` (item 5) tem várias regras empatadas em especificidade; um erro de leitura da cascata pode causar regressão visual silenciosa (borda/sombra sumindo) — por isso o passo 7 isola essa remoção com verificação visual dedicada, separada do resto.
- Esta sessão já teve um caso real de leitura de cascata que parecia óbvia mas estava errada (overflow-x/overflow-y da rodada anterior) — reforça a necessidade do checkpoint visual antes de considerar a limpeza concluída, não só confiar na análise estática.
- Push para `origin/main` pode seguir bloqueado por permissão (403) como em rodadas anteriores desta sessão — se acontecer, os commits ficam pendentes de push até o usuário resolver o acesso.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — usuário já confirmou incluir a cadeia `.animal-form` no escopo, com o passo de verificação visual.

## Critérios de aceite do plano

- Todas as classes listadas no item 1 do escopo removidas, com grep confirmando zero ocorrências remanescentes que importem.
- Fragmentos mortos podados das regras agrupadas (item 2), sem afetar os seletores vivos na mesma regra.
- Duplicata do item 3 resolvida.
- Regra azul morta do item 4 removida.
- Cadeia `.animal-form` (item 5) e lista antiga do `.anm-type-card` (item 6) removidas somente após checkpoint visual confirmando zero diferença.
- `npm run typecheck` e `npm run build` passam sem erros novos.
- Nenhuma diferença visual perceptível na etapa Animal pública nem no modal interno do staff, antes vs. depois.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Seguir a ordem do "Estratégia de implementação" — não pular direto para a cadeia `.animal-form` sem antes fazer o checkpoint visual do passo 6.
- Reaproveitar o padrão já usado nesta sessão (headless Chrome via CDP, screenshots antes/depois) para a verificação visual.
- Não remover nada listado em "Fora do escopo" — são regras compartilhadas com o modal interno do staff, ainda em uso real.
- Não commitar/dar push — isso é responsabilidade da skill `finalizar`, só quando solicitado.
