# Plano de Implementação: Rodapé sobrepondo o banner + scroll interno no formulário público

## Origem

- Arquivo de especificação: sem `.md` externo — pedido direto do usuário no chat, com screenshot mostrando o rodapé cobrindo a parte inferior do banner/hero na tela "Solicitar procedimento"
- Data do planejamento: 2026-07-28
- Classificação: `frontend-only`
- Investigação preliminar: feita por agente de exploração dedicado nesta conversa (read-only), que confirmou a causa raiz antes deste plano ser escrito

## Resumo

Quando um serviço público está aberto (ex.: "Solicitar procedimento"), o layout é um grid de 2 colunas (`.public-service-workspace`): a coluna esquerda (`.public-service-rail`, contendo o hero compacto) é `position: sticky` com altura calculada como `calc(98vh - var(--public-header-height) - 16px)`. Esse cálculo desconta a altura do header fixo do topo (`--public-header-height`), mas **nunca desconta a altura do rodapé fixo** (`.public-home-footer`, `position: fixed; bottom: 0`, altura via `--public-footer-height`, já declarada mas não usada nesse cálculo). Resultado: em telas onde `98vh` se aproxima do fundo real da viewport, o rodapé fixo (58px de altura no desktop) cobre a parte inferior do banner.

Além disso, a coluna direita (`.public-service-panel`, o formulário do serviço) não tem scroll interno próprio (`overflow: visible`, sem `max-height`) — ela cresce livremente e depende do scroll da página inteira. Isso significa que, quando as etapas do cadastro (`NewRequest`) têm mais conteúdo do que cabe na tela, quem rola é a página toda, não uma área contida — o que é inconsistente com o rail sendo `sticky` ao lado.

Este plano corrige o cálculo de altura do rail/hero para considerar o rodapé como limite real, e dá scroll interno à coluna do formulário quando necessário, mantendo o rail fixo ao lado durante esse scroll.

## Escopo

### Dentro do escopo

- Corrigir o cálculo de altura de `.public-service-rail` (`src/styles.css:21509-21518`) para descontar também `--public-footer-height`, não só `--public-header-height`, evitando a sobreposição do rodapé fixo sobre o banner.
- Aplicar a mesma correção ao bloco irmão `.public-service-panel--success` (`src/styles.css:21819-21824`), que usa o mesmo padrão `98vh - header` sem descontar o footer (tela de sucesso do formulário).
- Dar scroll interno à coluna direita (`.public-service-panel`, `src/styles.css:21565-21577`): trocar `overflow: visible`/`max-height: none` por um teto de altura (mesmo cálculo do rail, ou equivalente) com `overflow-y: auto`, para que o formulário role dentro do seu próprio espaço quando o conteúdo das etapas (`NewRequest`) for maior que a área disponível.
- Verificar e ajustar, se necessário, qualquer elemento filho do `.public-service-panel` que dependa de `overflow: visible` para funcionar corretamente (dropdowns, calendário de agendamento `.public-schedule-picker`, popovers) — a mudança de `overflow: visible` para `overflow-y: auto` pode cortar esses elementos se eles estourarem os limites do container; precisa de checagem específica antes de finalizar.
- Confirmar que o breakpoint mobile/tablet (`max-width: 980px`, onde o rail já vira `position: static; height: auto`) continua funcionando sem alteração — o bug é essencialmente desktop (≥981px), então esse breakpoint não deve precisar de mudança, só validação de que nada quebrou.

### Fora do escopo

- Qualquer mudança visual no conteúdo do hero (`PetWelcomeArt`/`.public-hero--compact`) além do que for estritamente necessário para o cálculo de altura funcionar — a posição/proporção da imagem já foi ajustada e revertida ao original nesta mesma sessão; não deve ser tocada de novo.
- Qualquer mudança no rodapé (`.public-home-footer`) em si — permanece `position: fixed`, mesma altura, mesmo conteúdo.
- Qualquer mudança de layout fora do fluxo de serviço público (`.public-service-workspace`) — não afeta a home pública sem serviço aberto, nem telas internas/admin.
- Qualquer mudança de lógica/validação do formulário `NewRequest` — é ajuste de contêiner/scroll, não de comportamento de formulário.
- O trabalho pendente de outra sessão paralela em `src/App.tsx`/`src/styles.css` (identificado ao longo desta sessão) — não tocar.

## Leitura de contexto

- `/AGENT.md` (raiz) — mesmo contexto de planos anteriores nesta sessão: template genérico staging/PR; prática real do projeto é commit direto em `main`.
- `frontend/AGENT.md` / `backend/AGENT.md` — não existem neste repo.
- Investigação do agente de exploração (confirmada com nova leitura direta nesta sessão, números de linha atualizados para o estado atual do arquivo):
  - `src/styles.css:615-624` (`.login-page`): declara `--public-header-height: 76px` e `--public-footer-height: 58px`; usa a segunda só em `padding-bottom: calc(var(--public-footer-height) + 10px)` do próprio `.login-page` — nenhuma outra regra do rail/panel referencia essa variável hoje.
  - `src/styles.css:627-644` (`.public-home-footer`): `position: fixed; bottom: 0; min-height: var(--public-footer-height, 58px)`. Único bloco de layout; um segundo bloco (identificado pelo agente, ~24426 na leitura anterior, a reconfirmar) só sobrescreve cor/borda com `!important`, não compete no cálculo de altura.
  - `src/styles.css:21499-21518` (`.public-service-workspace` / `.public-service-rail`): o bloco central do bug — `height`/`max-height: calc(98vh - var(--public-header-height) - 16px)`, sem termo de `--public-footer-height`.
  - `src/styles.css:21520-21563` (`.public-hero--compact` e filhos): herda o teto do rail via `max-height: 100%`; não precisa de mudança própria, só o pai (`.public-service-rail`) precisa ser corrigido.
  - `src/styles.css:21565-21577` (`.public-service-panel`): `height: auto; max-height: none; overflow: visible` — sem scroll próprio, é o segundo alvo deste plano.
  - `src/styles.css:21819-21824` (`.public-service-panel--success`, dentro de `@media (min-width: 981px)`): mesmo padrão `min-height: calc(98vh - var(--public-header-height) - 16px)`, mesmo bug, precisa do mesmo fix.
  - `src/styles.css` (breakpoint `max-width: 980px`, região identificada pelo agente): `.public-service-rail` vira `position: static; height: auto; max-height: none`, e `.public-hero--compact` vira `height: auto; min-height: 280px; max-height: none` — aqui o bug já não ocorre porque o rail sai do modo sticky/altura calculada. Confirmar que a correção do bloco desktop não interfere neste breakpoint (são seletores/media queries distintos, risco baixo).
  - `src/App.tsx` (~2398-2569 na leitura do agente, a reconfirmar): JSX de `<main className="login-page">` contendo `.public-service-workspace` (rail + panel) e `<footer className="public-home-footer">` como irmãos — footer é tirado do fluxo pelo `position: fixed`, então sua posição no JSX não importa para o bug, só o CSS.
- Confirmado nesta sessão (grep direto): não há duplicação de CSS competindo para nenhuma dessas classes — cada seletor tem só um bloco definidor real; os demais são media queries coerentes ou overrides de cor sem `!important` conflitante em altura/posição. O bug é de fórmula ausente, não de cascata.

## Impacto por área

### Frontend

- **`src/styles.css`**:
  - `.public-service-rail` (~21509-21518): trocar `98vh - var(--public-header-height) - 16px` por um cálculo que também desconte `var(--public-footer-height)` (ex.: `calc(100vh - var(--public-header-height) - var(--public-footer-height) - <margem>)`), tanto em `height` quanto `max-height`.
  - `.public-service-panel--success` (~21819-21824): mesma correção de fórmula.
  - `.public-service-panel` (~21565-21577): adicionar teto de altura (mesmo cálculo do rail) e trocar `overflow: visible` por `overflow-y: auto` (mantendo `overflow-x` sem restringir indevidamente, se necessário usar `overflow-x: visible; overflow-y: auto` em vez do shorthand, para não cortar elementos horizontais indevidamente).
  - Revisar filhos do `.public-service-panel` que dependam de estourar os limites do container (calendário `.public-schedule-picker`, dropdowns, dialogs internos) — ajustar `z-index`/posicionamento se algo for cortado incorretamente pelo novo `overflow-y: auto`.
- Sem impacto em hooks de rede, React Query, formulários — é ajuste de contêiner/CSS, sem mudança de lógica.
- Sem mudança de JSX prevista — o bug e a correção são inteiramente de CSS.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css` — blocos `.public-service-rail`, `.public-service-panel`, `.public-service-panel--success` (região ~21499-21824, números a reconfirmar no momento da implementação).

## Estratégia de implementação

1. Reconfirmar com grep as linhas atuais de todos os blocos listados (o arquivo desloca com frequência por edições paralelas de outra sessão nesta mesma conversa).
2. Corrigir `.public-service-rail`: trocar o cálculo de altura para descontar tanto `--public-header-height` quanto `--public-footer-height`, preservando a margem de 16px (ou recalibrando se necessário após teste visual).
3. Aplicar a mesma correção de fórmula em `.public-service-panel--success`.
4. Adicionar `max-height`/`overflow-y: auto` a `.public-service-panel`, usando o mesmo cálculo de teto do rail (para os dois ficarem visualmente alinhados em altura).
5. Revisar filhos do panel que possam depender de `overflow: visible` do pai (calendário de agendamento, dropdowns/popovers do formulário) — testar visualmente ou pela leitura do CSS se algo ficaria cortado, e ajustar pontualmente se necessário (sem reescrever esses componentes, só garantir que não quebram).
6. Confirmar que o breakpoint `max-width: 980px` (rail em modo estático) continua sem alteração de comportamento.
7. Rodar grep de `.public-service-rail`, `.public-service-panel`, `98vh` no arquivo inteiro para confirmar que não sobrou nenhum cálculo antigo (`98vh` sem desconto de footer) ainda alcançável.
8. Rodar `typecheck` e `build`; validar visualmente (ou pela leitura do resultado) que o rodapé não cobre mais o banner, e que o formulário rola internamente quando o conteúdo é maior que o espaço disponível, mantendo o rail visível ao lado.

## Regras de negócio identificadas

Nenhuma regra de negócio nova — é correção de layout/scroll, sem alterar dado ou comportamento funcional do formulário.

## Regras multi-tenant e segurança

Sem impacto — não há dado de tenant/permissão envolvido, é correção de contêiner CSS de uma tela pública já existente.

## Validações necessárias

- Confirmar que o rodapé (`.public-home-footer`) não cobre mais nenhuma parte do banner (`.public-hero--compact`) em nenhuma altura de viewport testável.
- Confirmar que o formulário (`.public-service-panel`) ganha scroll interno quando o conteúdo das etapas (`NewRequest`) excede o espaço disponível, sem depender do scroll da página inteira.
- Confirmar que o rail (banner) permanece visível/fixo ao lado durante o scroll do formulário (comportamento `sticky` preservado).
- Confirmar que nenhum elemento interno do formulário (calendário de agendamento, dropdowns, popovers) fica cortado pelo novo `overflow-y: auto`.
- Confirmar que o breakpoint mobile (≤980px) continua funcionando sem regressão.
- Confirmar visualmente a tela de sucesso do formulário (`.public-service-panel--success`) também sem sobreposição do rodapé.

## Testes necessários

### Frontend

Não há suíte de testes de componente identificada para este layout; validação será manual/visual + `typecheck`/`build`, como já é o padrão desta sessão.

### Backend

Sem impacto esperado.

### E2E

Não aplicável.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
npm run lint
```

## Riscos e pontos de atenção

- O ajuste de `overflow-y: auto` no `.public-service-panel` é o ponto de maior risco — precisa de verificação cuidadosa de filhos que dependam de `overflow: visible` do pai (calendários, dropdowns, popovers) para não cortar esses elementos visualmente.
- `--public-footer-height` já existe como variável, mas nunca foi usada nesse cálculo — confirmar que ela está corretamente acessível (herdada) no escopo de `.public-service-rail`/`.public-service-panel` (ambos são descendentes de `.login-page`, onde a variável é declarada, então a herança deve funcionar sem mudança adicional).
- Trabalho de outra sessão paralela pode estar mexendo no mesmo arquivo (`src/styles.css`) simultaneamente — usar a mesma técnica de isolamento (stash/patch parcial) já usada nesta sessão antes de qualquer commit via skill `finalizar`.
- Push é direto em `main`, sem `staging` — qualquer regressão visual nesta tela pública (usada por todos os fluxos de serviço: cadastro, credenciamento, denúncia, consulta) é imediatamente visível em produção.
- Revisar também `.public-service-panel--success`, que tem o mesmo bug de fórmula — fácil de esquecer por ser um bloco secundário (tela de sucesso), mas está no mesmo escopo do problema relatado.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — a investigação prévia já resolveu as dúvidas técnicas principais (causa raiz confirmada, ausência de duplicação CSS competindo, variável de altura do footer já disponível).

## Critérios de aceite do plano

- O rodapé fixo não cobre mais nenhuma parte do banner/hero em nenhuma tela de serviço público (desktop, ≥981px).
- O formulário (`NewRequest`, dentro de `.public-service-panel`) rola internamente quando o conteúdo excede o espaço disponível, com o banner permanecendo visível ao lado (`sticky`).
- Nenhum elemento interno do formulário fica cortado incorretamente pelo novo scroll.
- A tela de sucesso do formulário (`.public-service-panel--success`) também não tem sobreposição do rodapé.
- Comportamento mobile (≤980px) permanece sem regressão.
- `typecheck` e `build` passam sem novos erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não executar migrations (não aplicável).
- Reconfirmar linhas atuais com grep antes de editar — o arquivo desloca com frequência nesta sessão por trabalho paralelo de outra sessão.
- Isolar as próprias edições de qualquer trabalho não commitado de outra sessão presente no mesmo arquivo (mesma técnica de stash/patch parcial já usada nesta sessão), antes de qualquer commit via skill `finalizar`.
- Testar/validar visualmente o scroll do formulário e a ausência de sobreposição do rodapé antes de considerar concluído — este plano nasceu de um bug visual, então a validação visual é o critério de aceite mais importante, não só typecheck/build.
- Não tocar na posição/proporção da imagem do hero compacto (`.hero-art`) — já foi ajustada e revertida ao original nesta sessão; qualquer necessidade de mexer nela de novo deve ser perguntada ao usuário antes.
- Seguir a regra de comunicação silenciosa da skill `implementar`.
