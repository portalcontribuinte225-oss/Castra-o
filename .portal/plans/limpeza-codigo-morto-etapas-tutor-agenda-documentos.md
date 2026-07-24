# Plano de Implementação: Limpeza de código morto/duplicado/obsoleto — etapas Tutor, Agenda, Documentos (e infraestrutura compartilhada `FormSection`)

## Origem

- Arquivo de especificação: nenhum — pedido direto do usuário ("crie um plano para eliminar estilizações, funções, regras, UI, dados, campos, estilizações específicas que não são mais usadas, obsoletas, duplicadas, anotações, e manter só o que realmente usa para as etapas de cadastro Animal, Tutor, Agenda, Documentos").
- Investigação: auditoria via subagente Explore + verificação manual individual de cada achado (grep cruzado App.tsx/styles.css, leitura de contexto ao redor de cada regra citada) antes de incluir no plano.
- Data do planejamento: 2026-07-24
- Classificação: `frontend-only`

## Resumo

Este é o quarto round de limpeza/alinhamento desta sessão. O primeiro round (`limpeza-css-etapa-animal.md`, commit `03dd92d`) cobriu só a etapa Animal. Este plano cobre o que ficou de fora: JSX inalcançável e CSS morto/sombreado/duplicado nas etapas Tutor, Agenda e Documentos, mais um problema de infraestrutura compartilhada (`FormSection`) que afeta as 4 etapas por igual. Também inclui recoloração de resíduo de paleta antiga (azul/cinza frio de uma geração anterior do design) que os rounds de alinhamento ao mockup (`alinhar-etapa-tutor-mockup.md`, `alinhar-agenda-documentos-mockup.md`) não pegaram.

Todos os achados abaixo foram verificados individualmente (não só reportados pelo subagente de auditoria) via grep direto no arquivo e leitura do contexto ao redor, confirmando que cada regra/bloco realmente está morto ou sombreado antes de entrar no escopo.

## Escopo

### Dentro do escopo

**Tutor:**
1. Remover bloco JSX morto no ramo staff/não-público do Tutor (`src/App.tsx:3848-3860`): botão "Enviar código de verificação", verify-row (input + botão Confirmar) e parágrafo de status, todos guardados por `!internalSimple`. Confirmado: os únicos 2 call-sites de `NewRequest` em todo o projeto (`src/App.tsx:2674` com `publicFlow` e `src/App.tsx:4624` com `compact`+`internalSimple`) nunca combinam `publicFlow=false` com `internalSimple=false` — logo esse bloco é hoje 100% inalcançável. As funções/estado subjacentes (`sendSmsCode`, `confirmSmsCode`, `smsCode`, `smsConfirmed`, `smsInput`, `smsStatus`) continuam vivos via o ramo público (`src/App.tsx:3739-3754`) e NÃO devem ser tocados.
2. Depois de (1), `.sms-send-btn` fica sem nenhum uso no JSX (era usado só na linha removida) — remover a regra base (`src/styles.css:2856-2858`), o fragmento em `src/styles.css:15554` (mantendo `.sms-verify-row .ghost-button` do mesmo grupo) e o fragmento nos grupos `src/styles.css:16704`/`16714` (mantendo `.anm-add-btn`/`.nr-topbar-continue`, que continuam vivos nesses mesmos grupos).
3. Remover a combinação `.checkbox-row.invalid` (nunca aplicada — confirmado que `checkbox-row` nunca recebe classe `invalid` em nenhum dos 4 usos no JSX, incluindo o `cadunico-checkbox` do Tutor) dos 2 seletores agrupados em `src/styles.css:5247` e `src/styles.css:5263`, mantendo os demais seletores dos grupos (`.field.invalid`, `.compact-choice-field.invalid`, `.invalid-block`).
4. Recolorir para a paleta v4 (verde/creme): `.sms-status`/`.sms-status.confirmed` (`src/styles.css:2758-2768`, hoje usa tokens genéricos `var(--muted)`/`var(--green)`) e `.cep-status` (`src/styles.css:3392-3397`, hoje azul `#1479b8`) — ambos ativos e visíveis no fluxo público hoje, só ficaram fora dos rounds anteriores.

**Agenda:**
5. Remover o fragmento `.public-schedule-picker` dos seletores agrupados `src/styles.css:12803-12809` e `src/styles.css:12833-12835` (`.internal-request-modal .public-schedule-picker`). Confirmado: `.internal-request-modal` (`src/App.tsx:4615`) envolve o mesmo elemento `.nr-shell.nr-shell--internal` no modal do staff, e a regra mais tardia `.nr-shell .public-schedule-picker` (`src/styles.css:17696`, a mesma que motivou o fix de hoje no card da Agenda) tem especificidade igual e vence por ordem — essas duas regras nunca chegam a aparecer. Mantém-se intacto `.animal-photo-upload-card` desses mesmos grupos (não verificado neste round — território da etapa Animal já fechada).
6. Remover resíduo inofensivo `.sched-month-trigger:hover { border-color:#93c5fd }` (`src/styles.css`, bloco base ~L2922-2946) — já sombreado pelo `border:none` do override público existente, sem efeito visual, só ruído de leitura para quem mexer ali depois.

**Documentos:**
7. Recolorir `.doc-photo-placeholder`, `.doc-photo-placeholder svg`, `.doc-photo-placeholder span`, `.doc-photo-placeholder small` (`src/styles.css:5327-5356`) — hoje cinza-frio (`#94a3b8`/`#cbd5e1`/`#64748b`/`#e2e8f0`), visível assim que a etapa carrega (estado padrão sem foto anexada), nunca migrado para a paleta creme/bege v4.
8. Recolorir `.doc-photo-zone:hover` (`src/styles.css:5317-5319`, azul `#3b82f6`) e `.doc-attach-btn:hover` (`src/styles.css:5498-5501`, azul) para o verde de destaque já usado no resto do fluxo público.
9. Recolorir `.doc-row-msg` (`src/styles.css:5469`, cinza-frio itálico — mensagem de status tipo "Arquivo anexado. Aguardando validação.").

**Cross-cutting (infraestrutura `FormSection`, usada pelas 4 etapas):**
10. O título passado via prop `<FormSection title="...">` (usado nas 4 etapas: "Tutor", "Dados do animal", "Agenda", "Documentos e termo") nunca aparece em nenhum fluxo (staff ou público) — confirmado que `.nr-shell .single-request-form .form-section-header { display:none }` (`src/styles.css:16894-16896`) já garante isso sozinho, para ambos os modos (`--public` e `--internal`, pois `.nr-shell` é a classe base comum). Isso torna mortas: a regra duplicada `src/styles.css:17594-17596` (mesmo `display:none`, escopo redundante já coberto por 16894), as sub-regras `src/styles.css:16498-16514` (border/padding/cor do h3/cor do svg de um elemento que nunca é exibido) e o bloco mobile inteiro `src/styles.css:15501-15513` (box-model de um cabeçalho invisível). Vai consolidar em uma única regra de ocultação (mantendo `16894`, que cobre os dois modos) e remover as sub-regras comprovadamente inertes. **Não muda nenhum comportamento visual** (o header já está invisível hoje) nem o prop `title=` do JSX — é só limpeza de CSS morto.
11. Corrigir comentário desatualizado em `src/styles.css:21055-21060` que ainda cita a classe `.nr-shell--embedded`, já removida no round anterior (commit `03dd92d`).

### Fora do escopo

- `.animal-photo-upload-card` nos mesmos grupos do item 5 — precisa checagem visual dedicada no modal "Nova solicitação" do staff antes de qualquer remoção; é território da etapa Animal, já fechada em round anterior.
- `.mutirao-day`/`.calendar-empty-month` (laranja `#fb923c`/tracejado, Agenda) — pode ser destaque semântico proposital (evento de mutirão distinto de disponibilidade normal), não está claramente obsoleto.
- Redundância estrutural `internalCompact === internalSimple` sempre que há render real (`src/App.tsx:2948-2950`, já que os 2 únicos call-sites de `NewRequest` sempre casam os props dessa forma) — não é código morto (ainda executa e aplica classes CSS normalmente), é só uma observação de que a distinção entre os dois props não tem efeito prático hoje. Mudar isso seria refactor de props/arquitetura, não limpeza de código morto — fora do pedido.
- Qualquer mudança de comportamento/lógica de negócio: cálculo de vagas/mês, validação de documento por IA, fluxo de envio (`submit()`), geocodificação usada no payload de envio.
- Geolocalização morta no Tutor (`useCurrentLocation`, `src/App.tsx:3332-3351`, nunca chamada; `.map-selected-place`, `src/styles.css:6348-6353`, nunca renderiza) — **decisão pendente do usuário**: remover definitivamente ou manter para religar depois com um botão "usar minha localização". Nenhuma ação será tomada sobre este item até confirmação explícita.

## Leitura de contexto

- `/AGENT.md` — lido. Nota: a seção de git flow deste arquivo descreve um fluxo `staging` + PR que **não corresponde à prática real do projeto** (confirmado nas skills `implementar`/`finalizar` e em todos os rounds já executados nesta sessão: trabalho direto em `main`, sem staging, sem PR). Seguindo o padrão já estabelecido nos planos anteriores desta sessão, este plano segue a prática real (commit direto em `main` via skill `finalizar`), não a descrita no AGENT.md genérico.
- `src/App.tsx`: função `NewRequest` (L2945-4172), `PublicSchedulePicker` (L1713-1820), `DocumentScannerUpload` (L9445+), `FormSection` (`src/components/ui.tsx:187-197`).
- `src/styles.css`: todas as linhas citadas acima, cada uma verificada manualmente (não só relatada por subagente) via grep completo da classe/seletor no arquivo inteiro, para confirmar ausência de outras ocorrências vivas antes de propor remoção.
- Plano anterior `limpeza-css-etapa-animal.md` (commit `03dd92d`) — usado como referência de padrão/metodologia (grep de cada classe alterada no arquivo inteiro, checklist de estados `:hover`/`:disabled`/mobile).

## Impacto por área

### Frontend

- `src/App.tsx`: remoção de ~13 linhas de JSX morto (bloco SMS do ramo staff do Tutor, item 1). Nenhuma mudança de tipo, prop nova, ou lógica de negócio.
- `src/styles.css`: remoção de fragmentos/regras mortas (itens 2, 3, 5, 6, 10, 11) e recoloração de paleta antiga em regras já ativas (itens 4, 7, 8, 9) — sempre editando a regra vigente diretamente, nunca empilhando override novo por cima.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/styles.css`

## Estratégia de implementação

1. Tutor: remover o bloco JSX morto (`App.tsx:3848-3860`); rodar `npm run typecheck` logo em seguida para confirmar que nenhuma variável ficou sem uso após a remoção.
2. Tutor: remover `.sms-send-btn` (regra base + 2 fragmentos agrupados), confirmando via grep que não sobra nenhuma ocorrência.
3. Tutor: remover fragmento `.checkbox-row.invalid` dos 2 grupos, mantendo os seletores irmãos.
4. Tutor: recolorir `.sms-status`/`.sms-status.confirmed`/`.cep-status` para a paleta v4, escopado a `.nr-shell--public` (seguindo o mesmo padrão de todos os rounds anteriores — não alterar a base, adicionar override público).
5. Agenda: remover fragmento `.public-schedule-picker` dos 2 grupos `.internal-request-modal`, mantendo `.animal-photo-upload-card` intacto.
6. Agenda: remover `.sched-month-trigger:hover { border-color:#93c5fd }` da regra base.
7. Documentos: recolorir `.doc-photo-placeholder` (+ svg/span/small), `.doc-photo-zone:hover`, `.doc-attach-btn:hover`, `.doc-row-msg` — override escopado a `.nr-shell--public`.
8. Cross-cutting: consolidar `display:none` do `form-section-header` em uma única regra (manter `16894`, remover `17594`), remover sub-regras inertes (`16498-16514`, `15501-15513`).
9. Corrigir comentário desatualizado em `21055-21060` (remover menção a `.nr-shell--embedded`).
10. Rodar grep de cada classe tocada no arquivo inteiro (checklist da skill `implementar`) para confirmar que não sobrou versão antiga/duplicada ainda ativa.
11. `npm run typecheck` e `npm run build`.
12. Verificação visual via Chrome headless/CDP: as 4 etapas do fluxo público (Tutor com fluxo de SMS real ponta a ponta, Agenda com dia selecionado, Documentos com estado vazio) **e** o modal "Nova solicitação" do staff (etapa Agenda, para confirmar que a remoção do item 5 não afeta o card do calendário ali).

## Regras de negócio identificadas

Nenhuma nova — este plano não altera regras de negócio, só remove código inalcançável e recolore CSS residual.

## Regras multi-tenant e segurança

Sem impacto — mudanças são CSS/JSX de apresentação, sem tocar em autenticação, tenant, ou dados sensíveis.

## Validações necessárias

- Confirmar que o fluxo de SMS real (público) continua funcionando ponta a ponta após a remoção do bloco duplicado do ramo staff (que não afeta o ramo público, mas vale reconfirmar).
- Confirmar visualmente que o modal do staff ("Nova solicitação" → etapa Agenda) continua exibindo o card do calendário corretamente após a remoção do item 5.
- Confirmar que nenhum título de `FormSection` ficou visível inesperadamente após a consolidação do item 10 (deve continuar invisível, como já está hoje, em ambos os modos).

## Testes necessários

### Frontend

Sem testes automatizados novos (projeto não tem suíte configurada).

### E2E

- CDP/headless Chrome: Tutor (fluxo de SMS real: enviar código → confirmar), Agenda (seleção de dia, e o modal do staff também), Documentos (estado vazio).

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Push para `origin/main` segue bloqueado por permissão (403) nesta sessão — commits ficam pendentes até o usuário resolver o acesso.
- Itens 5 e 10 tocam regras compartilhadas com `.nr-shell--internal`/`.internal-request-modal` (modal do staff) — exigem checagem visual dedicada do modal antes de considerar o round fechado, não só do fluxo público.
- Item de geolocalização (Tutor) fica pendente de decisão do usuário — não será removido nem alterado até confirmação explícita.

## Perguntas em aberto

- Geolocalização morta no Tutor (`useCurrentLocation`, `.map-selected-place`): remover definitivamente ou manter/religar com um botão de "usar minha localização"? Nenhuma ação será tomada sobre isso durante a implementação deste plano até o usuário decidir.

## Critérios de aceite do plano

- Todos os itens 1-11 implementados sem alterar nenhum comportamento visual/funcional real (só remoção de morto + recoloração de residual).
- Fluxo de SMS real (público) continua funcionando ponta a ponta.
- Modal "Nova solicitação" do staff continua exibindo corretamente o card da Agenda após o item 5.
- `npm run typecheck` e `npm run build` passam sem erros novos.
- Item de geolocalização não tocado (aguarda decisão do usuário, tratado fora deste plano ou em round seguinte).

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não remover/alterar nada relacionado à geolocalização (`useCurrentLocation`, `.map-selected-place`, `requestData.latitude/longitude`, `locationStatus`) — item pendente de decisão do usuário, fora do escopo aprovado.
- Antes de remover qualquer fragmento de seletor agrupado (itens 2, 3, 5), confirmar via grep que os seletores irmãos do mesmo grupo continuam vivos e não devem ser tocados.
- Fazer checagem visual do modal "Nova solicitação" do staff (não só do fluxo público) para os itens 5 e 10, já que tocam regras compartilhadas com `.nr-shell--internal`.
- Não commitar/dar push — isso é responsabilidade da skill `finalizar`, só quando solicitado.
