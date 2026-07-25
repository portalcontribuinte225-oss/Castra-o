# Plano de Implementação: Alinhar a tela pública "Prontuário" ao padrão visual v4

## Origem

- Arquivo de especificação: nenhum — pedido direto do usuário a partir de um screenshot da tela atual ("Serviços do prontuário"), sem mockup HTML de referência desta vez.
- Data do planejamento: 2026-07-24
- Classificação: `frontend-only`

## Resumo

A tela pública "Prontuário" (`ValidationKeyConsultation`, `src/App.tsx:1151-1711`) nunca recebeu nenhuma das 5 rodadas de alinhamento visual v4 já feitas nesta sessão (Home pública, Animal, Tutor, Agenda, Documentos). Ela ainda usa integralmente a paleta antiga fria (azul `#2563eb`, indigo `#4f46e5`, âmbar `#d97706`, vermelho `#dc2626`, fundo `#f6f8fb`, texto `#0f172a`/`#6b7280`). Diferente das rodadas anteriores, não há mockup HTML — o trabalho é extrapolar por analogia o padrão já validado (mesmo método usado na tela de login), com 3 decisões de design já confirmadas com o usuário via perguntas diretas.

## Escopo

### Dentro do escopo

1. **Landing de serviços** (`.cons-shell`/`.cons-topbar`/`.cons-hero`/`.cons-service-cards`): fundo `#f4f1ea`, `.cons-title` em `#2b2420`, `.cons-subtitle` em `#93887a`, `.cons-service-card` no padrão `.form-sub-card` (branco, borda `#e6ddc9`, raio 18px, hover verde `#bfe0cf` em vez de azul `#93c5fd`). Topbar mantida enxuta (só recolorir brasão/botão home existentes — **decisão confirmada**: não adicionar nome do município nem menu de navegação).
2. **Ícones dos 4 cards de serviço** (`.cons-svc-icon.blue/indigo/amber/red`, também reaproveitado nos modais via `colorMap`): **decisão confirmada** — verde `#1f8a5f` (bg `#eaf3ee`) para os 3 serviços normais (Prontuário, Solicitar procedimento, Troca de tutor); terracota `#b5482f` (bg `#f5e6df`) só para "Registrar óbito" (ação destrutiva), substituindo o vermelho puro `#dc2626`/`#fef2f2`.
3. **4 modais de serviço** (`.svc-modal`, `.svc-modal-header`, `.svc-field`, `.svc-grid-2/3/4`, `.svc-mode-btn`, `.svc-found-tag`, `.svc-lookup-row`): card e inputs no padrão `.access-field` (mesma treatment de bordas/foco usada no fluxo de Solicitações), escopado via `.svc-modal` (classe exclusiva desta tela, sem risco de vazamento). **Nota importante para a implementação**: os botões `.primary-action` do rodapé dos modais (`.svc-modal-footer`) **já renderizam escuros hoje**, porque a variável global `--ui-action` foi redefinida para `#020817` em `:root` (`src/styles.css:20667-20671`, "Company portal neutral-primary correction") — **não criar uma nova regra de cor para esses botões**, isso duplicaria/conflitaria com um comportamento que já existe e já bate com a decisão confirmada (botão escuro). Só ajustar raio/padding/tipografia se necessário para consistência visual, nunca a cor de fundo.
4. **`AnimalRecordPanel`** (`src/App.tsx:8932+`, uso exclusivo desta tela): `.animal-record-header`, `.animal-record-summary`, `.animal-record-grid`, `.animal-status-chip` recoloridos ao padrão v4. Os 3 modais de ação internos (`.animal-action-modal`, classe composta exclusiva — `.workflow-modal` bare continua intocado por ser compartilhado com modais do staff) alinhados ao mesmo padrão do item 3.
5. **`TutorDashboard` — resultados da consulta** (`src/App.tsx:2696+`, renderizado aqui em modo `compact`): recolorir via o escopo já existente `.consultation-results` (`src/styles.css:14316+`, dezenas de overrides já presentes ali para `.panel`/`.request-card`/`.status-badge`/`.ghost-button` — só atualizar os valores de cor existentes nesse escopo para a paleta v4, sem tocar nas regras base compartilhadas com o admin).
6. **Adoções vinculadas** (`.consultation-adoptions`, `.consult-adoption-card`, `.consult-adoption-photo`, `.consult-adoption-info`): recolorir para o padrão de card branco/borda creme v4.

### Fora do escopo

- Remoção da função `consult()` (`src/App.tsx:1181-1235`) — aparenta não ter nenhum call-site (`onSubmit={consult}` não aparece em lugar nenhum do arquivo), mas isso é código morto, não estilização; fica para uma rodada de limpeza separada (padrão já estabelecido nesta sessão: rodadas de "alinhar visual" e "limpar código morto" são sempre separadas).
- Qualquer mudança de lógica/regra de negócio: consulta por microchip/CPF/chave de validação, criação de solicitação/troca de tutor/óbito, geração de PDF do prontuário.
- `.workflow-modal` bare (compartilhado com modais de setor/permissão/usuário do staff) — só a variante composta `.animal-action-modal` é tocada.
- `.panel`/`.request-card`/`.ghost-button`/`StatusBadge` base (compartilhados com o admin) — só os overrides já escopados em `.consultation-results` são atualizados.
- Variável global `--ui-action` (`src/styles.css:20667`) — não será alterada; o plano só reconhece e reaproveita seu efeito atual (botão escuro), não modifica seu valor nem escopo.

## Leitura de contexto

- `/AGENT.md` — lido em rodada anterior desta sessão; nota já registrada de que a seção de git flow (staging/PR) não corresponde à prática real do projeto (commit direto em `main`, confirmado pelas skills `implementar`/`finalizar` e por todas as rodadas já executadas).
- `src/App.tsx`: `ValidationKeyConsultation` (L1151-1711, componente completo lido), `TutorDashboard` (L2696-2814+, lido), `AnimalRecordPanel` (L8932-9180+, lido), chamada única de `ValidationKeyConsultation` em L2650, chamada única de `NewRequest`'s `.nr-topbar-continue` (L4121-4152, padrão de botão de navegação reaproveitado como referência).
- `src/styles.css`: `.cons-*`/`.svc-*` (L13679-14150), `.consultation-results` (L14316+, escopo já existente), `.workflow-modal`/`.animal-action-modal` (usos verificados via grep, 4 ocorrências bare no staff vs 3 compostas exclusivas aqui), `--ui-action` (L15713, 20147, 20667 — a redefinição em `:root` de L20667 é a que efetivamente vence hoje para o botão `.nr-topbar-continue`/`.primary-action`).
- Padrões v4 já validados em rodadas anteriores (Home, Tutor, Agenda, Documentos, login): `#f4f1ea` fundo, `#e6ddc9` borda, `#2b2420`/`#93887a` texto, `#1f8a5f`/`#156b48` verde, `#eaf3ee`/`#bfe0cf` verde claro/borda.

## Impacto por área

### Frontend

- `src/App.tsx`: possivelmente pequenos ajustes de classe/estrutura JSX (ex.: se algum wrapper novo for necessário para escopar um card), sem mudança de lógica, props ou estado.
- `src/styles.css`: adição/atualização de regras `.cons-*`, `.svc-*`, `.animal-record-*`, `.animal-action-modal`, `.consultation-results *`, `.consultation-adoptions`/`.consult-adoption-*` — sempre checando primeiro se já existe uma regra escopada equivalente antes de empilhar uma nova.

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

1. Landing (`.cons-shell`/topbar/hero): fundo, título/subtítulo, ajuste do botão home se necessário.
2. `.cons-service-card`/`.cons-svc-icon`: recolorir para padrão `.form-sub-card` + paleta verde/terracota confirmada.
3. Modais de serviço (`.svc-*`): card, inputs (`.access-field`-like), grids, radio buttons (`.svc-mode-btn`), tag de resultado (`.svc-found-tag`) — sem tocar em `.primary-action` (já correto via `--ui-action`).
4. `AnimalRecordPanel`: header/summary/grid + os 3 `.animal-action-modal`.
5. `TutorDashboard`: atualizar cores dentro do escopo `.consultation-results` já existente.
6. `.consultation-adoptions`/`.consult-adoption-card`.
7. Grep de cada classe alterada no arquivo inteiro (checklist da skill `implementar`) para confirmar que não sobrou versão antiga/duplicada ainda ativa por baixo — atenção especial a `.workflow-modal` (não confundir a variante bare com `.animal-action-modal`) e a `.panel`/`.request-card` (não editar a base, só o escopo `.consultation-results`).
8. `npm run typecheck` e `npm run build`.
9. Verificação visual via Chrome headless/CDP: landing de serviços, cada um dos 4 modais (identificação + ação), resultado de consulta bem-sucedida (com solicitações e/ou adoções vinculadas, se houver dados de teste), e conferir que o admin/staff (`.panel`/`.request-card`/`.workflow-modal` fora do escopo `.consultation-results`) não mudou.

## Regras de negócio identificadas

Nenhuma — é ajuste de paleta/estrutura visual, sem tocar em regras de consulta/identificação/criação de solicitação.

## Regras multi-tenant e segurança

Sem impacto — mudanças são CSS/JSX de apresentação; nenhuma alteração em autenticação, tenant, ou dados sensíveis.

## Validações necessárias

- Confirmar que os 4 fluxos de identificação + ação dos modais de serviço continuam funcionando exatamente igual (identificar por CPF/chave/microchip, depois confirmar procedimento/troca/óbito).
- Confirmar que o resultado da consulta (prontuário do animal, solicitações do tutor, adoções vinculadas) continua renderizando corretamente com a nova paleta.
- Confirmar que nenhuma mudança em `.consultation-results`/`.animal-action-modal` vazou para o admin/staff (`.panel`/`.request-card`/`.workflow-modal` genéricos).

## Testes necessários

### Frontend

Sem testes automatizados novos (projeto não tem suíte configurada).

### E2E

- CDP/headless Chrome: landing de serviços, cada um dos 4 modais (Prontuário/Procedimento/Troca/Óbito) em ambos os passos (identificação e ação), e o painel de resultados após uma consulta bem-sucedida.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Push para `origin/main` segue bloqueado por permissão (403) nesta sessão — commits ficam pendentes até o usuário resolver o acesso.
- Escopo maior que rodadas anteriores (6 sub-áreas) — implementar em passos pequenos e verificáveis, um de cada vez, para facilitar revisão.
- `TutorDashboard`/`AnimalRecordPanel`/`.consultation-results` reaproveitam primitivos genéricos compartilhados com o admin (`.panel`, `.request-card`, `StatusBadge`, `.workflow-modal`) — qualquer edição fora do escopo já delimitado (`.consultation-results`/`.animal-action-modal`) arrisca vazar para o staff; seguir rigorosamente os seletores escopados definidos neste plano.

## Perguntas em aberto

Nenhuma — as 3 decisões de design (cor dos ícones, topbar enxuta, cor do botão primário) já foram confirmadas com o usuário antes de salvar este plano.

## Critérios de aceite do plano

- Landing, 4 modais de serviço, `AnimalRecordPanel` e resultados (`TutorDashboard`/adoções) usando a paleta v4 (verde/creme/texto quente), sem resíduo azul/indigo/cinza-frio (exceto o terracota do card "Registrar óbito", que é intencional).
- Nenhuma mudança visual no admin/staff (modais `.workflow-modal` genéricos, `.panel`/`.request-card` fora do escopo `.consultation-results`).
- Todos os 4 fluxos de serviço (identificação + ação) continuam funcionando ponta a ponta.
- `npm run typecheck` e `npm run build` passam sem erros novos.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não criar uma nova regra de cor de fundo para `.primary-action`/`.svc-modal-footer .primary-action` — o botão já renderiza escuro via `--ui-action: #020817` global; qualquer override aqui seria redundante ou conflitante.
- Antes de tocar `.workflow-modal`, confirmar que a edição está escopada à variante composta `.animal-action-modal` (exclusiva), nunca à classe bare (compartilhada com modais do staff).
- Antes de tocar `.panel`/`.request-card`/`StatusBadge`, confirmar que a edição está dentro do escopo `.consultation-results` já existente (`src/styles.css:14316+`), nunca na regra base.
- Não implementar a remoção da função `consult()` morta — está fora de escopo desta rodada.
- Não commitar/dar push — isso é responsabilidade da skill `finalizar`, só quando solicitado.
