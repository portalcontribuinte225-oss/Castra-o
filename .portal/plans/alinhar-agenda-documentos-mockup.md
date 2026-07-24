# Plano de Implementação: Alinhar etapas "Agenda" e "Documentos" (fluxo público) ao mockup

## Origem

- Arquivo de especificação: mockup HTML colado nesta sessão (fonte real extraída, `STEP 3: AGENDA` e `STEP 4: DOCUMENTOS`, linhas ~391-454) + 2 screenshots do mockup renderizado enviados pelo usuário
- Data do planejamento: 2026-07-24
- Classificação: `frontend-only`

## Resumo

Diferente da etapa Tutor, a estrutura de Agenda e Documentos **já bate estruturalmente** com o mockup (mesmo layout de calendário 7 colunas, mesmo padrão de linha de documento com ícone+nome+status+anexar). O que falta é principalmente **paleta/cor residual de uma geração anterior** (azul/cinza frio) em pontos que as rodadas passadas não cobriram, mais 2 pequenos ajustes de rótulo/cor de estado. Os dois componentes (`PublicSchedulePicker`, `DocumentScannerUpload`) são **compartilhados com o modal do staff** — nenhuma mudança estrutural é necessária, só CSS escopado a `.nr-shell--public` (mesmo padrão já usado em todas as rodadas anteriores), então o staff não é afetado.

## Escopo

### Dentro do escopo

**Agenda:**
1. Pill do mês ("Julho 2026"): hoje é branco com borda creme + texto/ícone verde (`.nr-shell--public .sched-month-trigger`); o mockup usa fundo bege `#f1ede3` **sem borda** (mesmo padrão visual da trilha dos pills de Espécie/Sexo/Porte). Ajustar para bater exatamente.
2. Dropdown de meses (`.sched-month-dropdown`/`.sched-month-tab`, some quando só há 1 mês configurado — **funcionalidade real preservada**, mockup não tem equivalente por ser estático): hoje ainda usa paleta azul/cinza fria (`#e2e8f0`, branco) fora do hover/is-active, que já foram cobertos numa rodada anterior. Estender a paleta verde/creme para o container do dropdown também, por consistência (extrapolação, já que o mockup não mostra essa tela).
3. Dias do calendário sem vaga/passado: borda hoje é cinza fria `#e5e7eb` → creme `#e6ddc9` (mockup: `#ece5d6`); dias "Passado" usam cinza-azulado (`#94a3b8`/`#f8fafc`/`#e2e8f0`) → texto bege escuro `#b0a894`, fundo branco, borda creme.
4. Dias **com vaga** (`.has-vacancy`, não selecionado): hoje o fundo do card fica com um verde bem sutil (`rgba(31,138,95,0.08)`); no mockup o fundo continua **branco**, só a borda fica verde-clara (`#bfe0cf`) e o texto do horário/vagas fica verde forte e negrito. Ajustar para bater exatamente (fundo branco, não verde).
5. Legenda dos dias da semana (DOM/SEG/TER...): cor cinza fria (`var(--muted)`) → bege `#93887a`, tamanho/peso ajustado para 11px/700 (mockup).
6. Título do card: "Escolha data e horário" já bate com o mockup — nenhuma mudança de texto.

**Documentos:**
7. Título do card: "Documentos comprobatórios" → "Documentos e termo" (mockup). Esse bloco só renderiza no fluxo público (`!internalSimple`, e os únicos 2 pontos de montagem do componente são `publicFlow` ou `internalSimple` — nunca ambos falsos ao mesmo tempo), então dá pra trocar o texto direto, sem duplicar branch.
8. Botão de anexar (`.doc-attach-btn`, ícone de clipe): fundo branco → verde-claro `#eaf3ee` (mockup), mantendo ícone/borda verde já corretos.
9. Linha do documento (`.doc-row`) no estado padrão/vazio (aguardando arquivo): borda cinza fria `#e2e8f0` → creme `#e6ddc9`; texto secundário (`.doc-row-info small`, ex. "Aguardando arquivo") cor cinza fria `#64748b`/`#94a3b8` → bege `#93887a`. **Os estados reais de validação por IA** (`approved`/`rejected`/`checking`/`attached`, com suas cores verde/vermelho/azul/roxo) são **mantidos exatamente como estão** — são feedback funcional real que o mockup nem tenta representar (ele só mostra o estado vazio estático), então não fazem parte desta limpeza de paleta.

### Fora do escopo

- Qualquer mudança na lógica de disponibilidade de vagas, cálculo de mês/dia, ou no fluxo de validação de documento por IA (`validateDocumentWithAI`, `DocumentScannerUpload`, estados `checking`/`approved`/`rejected`/`attached`) — são funcionalidades reais que o mockup simplifica ou nem mostra; permanecem intactas.
- Estrutura de múltiplos documentos configuráveis por tipo de solicitação (`selectedTypeDocuments`) — o mockup mostra só 1 documento fixo de exemplo ("Comprovante de residência"); a lista real dinâmica continua como está.
- Modal interno do staff — `PublicSchedulePicker` é compartilhado, mas todas as mudanças são só CSS escopado a `.nr-shell--public`, então o staff não muda visualmente. `DocumentScannerUpload`/Documentos não renderiza no staff de qualquer forma (`!internalSimple`).
- Altura exata do `.doc-photo-zone` (mockup usa um componente de upload de imagem do próprio construtor do mockup, sem CSS bruto equivalente para extrair um valor confiável) — mantém a proporção atual (`aspect-ratio:16/7`), já que não há uma fonte confiável para copiar um valor exato.

## Leitura de contexto

- `/AGENT.md` — fluxo direto em `main`, sem staging/PR
- `src/App.tsx`:
  - `function PublicSchedulePicker` (~L1713-1820): componente compartilhado (staff + público) usado na etapa Agenda.
  - Bloco `formStep === 2` (~L4052-4070): renderiza `PublicSchedulePicker`.
  - Bloco `formStep === 3` / Documentos (~L4072-4122): guardado por `!internalSimple`, ou seja, só renderiza no fluxo público — pode ter o título trocado direto.
  - `function DocumentScannerUpload` (~L9439-9493): componente compartilhado, renderiza `.doc-row` com estados reais de validação por IA.
- Fonte do mockup (colada nesta sessão) — `STEP 3: AGENDA` (linhas ~391-422) e `STEP 4: DOCUMENTOS` (linhas ~426-453) do arquivo extraído: valores exatos de cor/espaçamento usados nas comparações acima.
- `src/styles.css`: `.sched-month-trigger`/`.sched-month-dropdown`/`.sched-month-tab`, `.calendar-day-button`/`.has-vacancy`/`:disabled`/`.calendar-weekdays span`, `.doc-attach-btn`/`.doc-row`/`.doc-row-info`/`.doc-photo-zone` — bases (cor antiga azul/cinza) e os poucos overrides `.nr-shell--public` já existentes de rodadas anteriores (cobrem parcialmente: `.doc-photo-zone`, `.doc-attach-btn` cor do ícone, `.sched-month-trigger`/`.sched-month-tab` hover/is-active, `.calendar-day-button.has-vacancy`/`.selected` texto).

## Impacto por área

### Frontend

- `src/App.tsx`: 1 troca de texto (título do card Documentos). Nenhuma mudança estrutural, nenhuma prop nova.
- `src/styles.css`: ajustes/adições de regras `.nr-shell--public` para os itens 1-5 (Agenda) e 8-9 (Documentos) listados no escopo — sempre checando primeiro se já existe uma regra pública para aquela classe (várias já existem parcialmente) e completando/corrigindo a mesma, não empilhando uma nova por cima.

### Backend / Banco de dados / Infra

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/styles.css`

## Estratégia de implementação

1. Ajustar `.nr-shell--public .sched-month-trigger` (fundo bege, sem borda) e completar a paleta do `.sched-month-dropdown`/`.sched-month-tab` container (fora do hover/is-active que já existem).
2. Ajustar `.calendar-day-button` (público): borda padrão creme, `:disabled` (passado) com texto bege e fundo branco, `.has-vacancy` com fundo branco (não mais verde-tintado) + borda verde-clara, `.calendar-weekdays span` com cor/peso do mockup.
3. Trocar o título "Documentos comprobatórios" → "Documentos e termo".
4. Ajustar `.nr-shell--public .doc-attach-btn` (fundo verde-claro) e `.doc-row`/`.doc-row-info small` no estado padrão (borda creme, texto bege) — sem tocar nos estados `approved`/`rejected`/`checking`/`attached`.
5. Grep de cada classe alterada no arquivo inteiro (checklist da skill `implementar`) para confirmar que não sobrou versão antiga/duplicada ativa por baixo — essas classes já têm histórico de overrides parciais de rodadas passadas.
6. Testar via CDP/headless Chrome: etapa Agenda (mês com poucas/muitas vagas, dia selecionado, dropdown de mês se houver mais de 1 mês configurado) e etapa Documentos (estado vazio, e pelo menos 1 estado real de validação — ex. anexar um arquivo de teste — para confirmar que as cores semânticas de aprovado/recusado continuam intactas).
7. `npm run typecheck` e `npm run build`.

## Regras de negócio identificadas

Nenhuma — é ajuste de paleta/cor residual e troca de 1 rótulo de texto, sem tocar em cálculo de vagas, validação por IA, ou estrutura de documentos configuráveis.

## Regras multi-tenant e segurança

Sem impacto.

## Validações necessárias

- Confirmar que a seleção de dia/mês na Agenda continua funcionando exatamente igual (clique, desabilitado quando sem vaga, contagem de vagas).
- Confirmar que os 4 estados reais de documento (`checking`/`approved`/`rejected`/`attached`) continuam com suas cores semânticas de sempre (verde/vermelho/azul/roxo) — só o estado vazio/padrão muda de paleta.
- Confirmar visualmente que o modal do staff (que reaproveita `PublicSchedulePicker`) não mudou, já que os ajustes são só `.nr-shell--public`.

## Testes necessários

### Frontend

Sem testes automatizados novos (projeto não tem suíte configurada).

### E2E

- CDP/headless Chrome: Agenda (seleção de dia com vaga, dia sem vaga, dia passado) e Documentos (estado vazio + upload de um arquivo de teste para ver um estado real de validação).

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- `.calendar-day-button.has-vacancy` remover o fundo verde-tintado é a mudança mais perceptível deste plano — vale conferir se não fica "sem destaque" o suficiente para os dias disponíveis (o mockup confia só na borda + texto verde para indicar isso, mas numa tela real com muitos dias grudados isso pode ficar mais sutil que o esperado). Se ficar fraco demais na prática, posso propor um meio-termo depois de ver o resultado.
- Push para `origin/main` segue bloqueado por permissão (403) nesta sessão — commits ficam pendentes até o usuário resolver o acesso.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Critérios de aceite do plano

- Pill do mês, dias do calendário (padrão/passado/com vaga) e legenda de dias da semana usando a paleta creme/verde do mockup, sem resíduo azul/cinza frio.
- Card "Documentos e termo" com botão de anexar verde-claro e linha de documento (estado vazio) na paleta creme.
- Estados reais de validação por IA (aprovado/recusado/em análise/anexado) preservados exatamente como estão.
- Modal do staff inalterado.
- `npm run typecheck` e `npm run build` passam sem erros novos.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Antes de criar uma regra nova, checar se já existe uma `.nr-shell--public` parcial para a mesma classe (várias já existem) e completar/corrigir essa, não empilhar por cima.
- Não tocar nos estados semânticos reais (`approved`/`rejected`/`checking`/`attached`) do Documentos, nem na lógica de vagas/mês da Agenda.
- Não commitar/dar push — isso é responsabilidade da skill `finalizar`, só quando solicitado.
