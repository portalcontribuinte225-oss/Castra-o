# Plano de Implementação: Padronizar blocos brancos na etapa Animal do formulário de solicitação

## Origem

- Arquivo de especificação: Nenhum `FEATURE_FILE` fornecido. Entrada baseada em pedido direto do usuário, com screenshot da etapa "Tutor" (referência do padrão desejado) e da etapa "Animal" (estado atual, sem o padrão).
- Data do planejamento: 2026-07-21
- Classificação: `frontend-only`

## Resumo

A etapa "Tutor" do formulário de solicitação (`NewRequest`, `formStep === 0`) já separa suas seções em blocos brancos usando as classes `.form-sub-card` + `.form-sub-card-title` (Identificação, Endereço, Contato). A etapa "Animal" (`formStep === 1`) não usa esse padrão: dentro do contexto `.nr-shell` (compartilhado pelo fluxo público e pelo modal interno "Criar Solicitação" do admin), as classes que ela usa hoje — `.anm-type-picker` (Tipo de Solicitação) e `.health-card` (Saúde e cuidados) — são explicitamente neutralizadas por `.nr-shell .anm-type-picker` e `.nr-shell .health-card` (`padding:0; border:0; background:transparent`), então todo o conteúdo da etapa cai visualmente num único bloco contínuo, sem separação.

O objetivo é aplicar o mesmo padrão `.form-sub-card`/`.form-sub-card-title` (já existente, genérico, sem nenhuma sobrescrita conflitante em todo o `src/styles.css`) às três seções lógicas da etapa Animal, deixando as duas etapas visualmente consistentes.

## Escopo

### Dentro do escopo

- Envolver a seção "Tipo de Solicitação" (Ninhada/Animal de Rua) num `.form-sub-card`.
- Envolver os campos de identificação do animal (Espécie, Tipo de Procedimento, Raça, Sexo, Nome, Pelagem, Idade, Peso, e Microchip quando `internalSimple`) num `.form-sub-card` com título "Identificação do animal".
- Trocar o wrapper atual de "Saúde e cuidados" (`.health-card` + `<strong>`) por `.form-sub-card` + `.form-sub-card-title`.
- Validar visualmente nos dois contextos que reaproveitam `NewRequest`/`.nr-shell`: fluxo público (`nr-shell--public`) e modal interno de "Criar Solicitação" do admin (`internal-request-modal .nr-shell--internal`).
- Validar em desktop e nos três tamanhos mobile já usados nas rodadas anteriores (320/360/375px).

### Fora do escopo

- Qualquer alteração em `src/styles.css` — as classes necessárias já existem e não têm sobrescritas conflitantes.
- Alterar comportamento, validação, lógica de submit ou contratos de dados do formulário.
- Alterar a etapa Tutor, Agenda ou Documentos.
- Refatorar `.anm-type-picker`/`.health-card`/`.health-grid` fora do contexto desta troca de wrapper (essas classes continuam existindo e sendo usadas por outros formulários fora do `.nr-shell`, como formulários de adoção/outros — não mexer nelas).

## Leitura de contexto

- `/AGENT.md` (raiz) — já lido nesta conversa.
- `frontend/AGENT.md` — não existe neste repositório.
- `src/App.tsx` — inspecionado: etapa Tutor (`formStep === 0`, linhas ~3773-3848) e etapa Animal (`formStep === 1`, linhas ~3850-3964) do componente `NewRequest`.
- `src/styles.css` — inspecionado: `.form-sub-card`/`.form-sub-card-title` (linhas ~3242-3259, únicas ocorrências, sem escopo/sobrescrita), `.nr-shell .anm-type-picker` (linha ~18453), `.nr-shell .health-card` (linhas ~17314, ~18551, ~18563), `.nr-shell .health-card > strong` (linha ~17236).

## Impacto por área

### Frontend

- Componente `NewRequest` (`src/App.tsx`), etapa `formStep === 1`: reestruturação de JSX (adicionar 2 wrappers `.form-sub-card` novos, trocar o wrapper de "Saúde e cuidados").
- Sem novos componentes, hooks, query keys, chamadas de API ou formulários novos — é reorganização visual de markup existente.
- Sem impacto em `formStep === 0`, `2` ou `3`.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx` — componente `NewRequest`, etapa Animal (`formStep === 1`, por volta das linhas 3850-3964)

## Estratégia de implementação

1. Envolver o bloco `{configuredRequestTypes.length > 0 && (...)}` (Tipo de Solicitação) num `<div className="form-sub-card"><span className="form-sub-card-title">Tipo de solicitação</span>...</div>`, removendo o `<span className="anm-type-label">Tipo de solicitação</span>` interno (redundante com o novo título).
2. Envolver a sequência de campos de identificação do animal — `.animal-choice-grid` (Espécie/Tipo de Procedimento), `.animal-choice-grid` (Raça/Sexo), campo condicional de raça descrita, `.two-column-fields` (Nome/Pelagem), `.two-column-fields` (Idade/Peso) e `.internal-microchip-row` condicional — num único `<div className="form-sub-card"><span className="form-sub-card-title">Identificação do animal</span>...</div>`.
3. Trocar `<div className="health-card"><strong>Saúde e cuidados</strong><div className="health-grid">...</div></div>` por `<div className="form-sub-card"><span className="form-sub-card-title">Saúde e cuidados</span><div className="health-grid">...</div></div>`.
4. Manter `{internalSimple && inlineAnimalPhotoUpload}` e o botão "Remover animal N" fora dos `.form-sub-card`, na mesma posição atual (depois dos blocos, dentro do accordion `.animal-form`).
5. Rebuildar e verificar visualmente via Playwright:
   - Fluxo público, desktop: etapa Animal mostra 3 blocos brancos (Tipo de Solicitação, Identificação do animal, Saúde e cuidados) visualmente consistentes com a etapa Tutor.
   - Modal interno "Criar Solicitação" (admin), desktop: mesma verificação.
   - 320/360/375px: sem overflow horizontal, sem sobreposição, blocos empilhados corretamente.
6. Rodar `npm run typecheck` e `npm run build`.

## Regras de negócio identificadas

Nenhuma — mudança puramente visual/estrutural, sem alteração de regra de negócio.

## Regras multi-tenant e segurança

Sem impacto — não há alteração de dados, permissões, tenant ou contrato de API.

## Validações necessárias

- Garantir que nenhum campo perdeu seu `value`/`onChange`/validação (`showInvalid`, `is-invalid`) durante a reestruturação do JSX — só o wrapper visual muda, a lógica de cada campo permanece idêntica.
- Garantir que o accordion "Animal N" (expandir/colapsar) continua funcionando normalmente com os novos wrappers internos.

## Testes necessários

Sem framework automatizado configurado no projeto (mesma limitação já registrada nos planos anteriores). Validação manual/visual via Playwright:

### Frontend

- Etapa Animal renderiza 3 blocos brancos separados, com título em caixa alta, no fluxo público.
- Mesma verificação no modal interno do admin.
- Nenhuma quebra de layout em 320/360/375px.
- Accordion de animal continua expandindo/colapsando e todos os campos continuam editáveis.

### Backend

Não aplicável.

### E2E

Não aplicável — verificação manual via Playwright ad-hoc, como nas rodadas anteriores.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

Não há scripts de `lint`/`test` configurados neste projeto.

## Riscos e pontos de atenção

- `NewRequest`/`.nr-shell` é compartilhado entre o fluxo público e o modal interno de "Criar Solicitação" — a verificação precisa cobrir os dois contextos, não só o público.
- Risco geral baixo: reaproveita exatamente as mesmas classes (`.form-sub-card`/`.form-sub-card-title`) já usadas e validadas na etapa Tutor, nos mesmos dois contextos e nos mesmos tamanhos de tela.

## Perguntas em aberto

Nenhuma pergunta em aberto — título "Identificação do animal" para o segundo bloco foi aceito implicitamente na aprovação do plano.

## Critérios de aceite do plano

- A etapa Animal exibe 3 blocos brancos separados (Tipo de Solicitação, Identificação do animal, Saúde e cuidados), visualmente consistentes com os blocos da etapa Tutor.
- Nenhum campo perdeu funcionalidade (validação, valor, onChange) após a reestruturação.
- `npm run typecheck` e `npm run build` passam sem novos erros.
- Sem overflow horizontal ou sobreposição em 320/360/375px, no fluxo público e no modal interno.

## Observações para a skill implementar

- Usar este arquivo como fonte principal de contexto.
- Não são necessárias alterações em `src/styles.css`.
- Reaproveitar exatamente `.form-sub-card`/`.form-sub-card-title`, sem criar classes novas.
- Validar nos dois contextos (`nr-shell--public` e `internal-request-modal .nr-shell--internal`) antes de reportar como concluído.
- Manter alterações restritas à etapa Animal (`formStep === 1`) do componente `NewRequest`.
