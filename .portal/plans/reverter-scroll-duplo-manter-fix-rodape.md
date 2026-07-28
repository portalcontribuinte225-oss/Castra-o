# Plano de Implementação: Reverter scroll duplo do formulário, manter só o fix do rodapé

## Origem

- Arquivo de especificação: sem `.md` externo — pedido direto do usuário no chat, após reportar que a implementação anterior (`.portal/plans/corrigir-rodape-sobrepondo-banner-scroll-cadastro.md`) criou um segundo scrollbar (scroll da página + scroll interno do formulário) em vez de só corrigir a sobreposição do rodapé
- Data do planejamento: 2026-07-28
- Classificação: `frontend-only`

## Resumo

A implementação anterior corrigiu a sobreposição do rodapé sobre o banner (fórmula de altura do `.public-service-rail` passou a descontar `--public-footer-height`), mas também deu scroll interno próprio ao formulário (`.public-service-panel`, via `max-height` calculado + `overflow-y: auto`). Isso resultou em **dois scrollbars visíveis simultaneamente** na tela de serviço público (ex.: "Solicitar procedimento") — o da página inteira e o do formulário — o que o usuário não pediu e não quer.

Nenhuma dessas mudanças foi commitada ainda (confirmado via `git log`/`git status` — o último commit em `main` é anterior a todo este trabalho). Este plano reverte especificamente a parte que criou o scroll interno do formulário, mantendo apenas a correção da fórmula de altura do rail que resolve o problema original relatado (rodapé cobrindo o banner), restaurando o comportamento de **um único scroll** (o da página, como sempre foi).

## Escopo

### Dentro do escopo

- Reverter `.public-service-panel` (`src/styles.css`, região atual ~21565-21578) ao estado original: `max-height: none`, `overflow: visible` (uma única propriedade `overflow`, não o par `overflow-x`/`overflow-y` introduzido) — removendo o teto de altura calculado e o `overflow-y: auto` adicionados na implementação anterior.
- Remover o bloco de reset adicionado no breakpoint mobile (`@media max-width: 980px`, região atual ~22200-22210) que reseta `.public-service-panel { max-height: none; overflow-y: visible; }` — esse reset só existia para compensar o `overflow-y: auto` da base que está sendo revertido; sem a mudança da base, o reset fica redundante/morto e deve ser removido também.
- Manter intacta a correção de fórmula em `.public-service-rail` (`height`/`max-height: calc(100vh - var(--public-header-height) - var(--public-footer-height) - 16px)`) — é a correção real e válida do bug original (rodapé sobrepondo o banner).
- Manter intacta a correção equivalente em `.public-service-panel--success` (mesma fórmula, dentro de `@media min-width: 981px`).
- Confirmar, ao final, que existe apenas 1 scrollbar visível na tela de serviço público (o da página), e que o rodapé nunca mais sobrepõe o banner.

### Fora do escopo

- Qualquer nova abordagem de scroll interno/classe condicional para travar o scroll da página (essa ideia foi descartada pelo usuário) — não introduzir.
- Qualquer mudança em `.public-home-footer`, `.login-page` (além do que já existia antes desta sessão), ou na home pública sem serviço aberto.
- Qualquer mudança de lógica/validação do formulário `NewRequest`.
- Qualquer mudança na posição/proporção da imagem do hero (`.hero-art`) — já tratada e revertida ao original em trabalho anterior desta sessão.
- O trabalho pendente de outra sessão paralela em `src/App.tsx`/`src/styles.css` — não tocar.

## Leitura de contexto

- `/AGENT.md` (raiz) — mesmo contexto de planos anteriores nesta sessão.
- `frontend/AGENT.md` / `backend/AGENT.md` — não existem neste repo.
- Estado atual confirmado por leitura direta nesta sessão:
  - `src/styles.css:21509-21518` (`.public-service-rail`): já corrigido corretamente, fórmula com `--public-footer-height` — **não mexer**.
  - `src/styles.css:21565-21578` (`.public-service-panel`): tem hoje `max-height: calc(100vh - var(--public-header-height) - var(--public-footer-height) - 16px)` e `overflow-x: visible; overflow-y: auto` — **é o alvo da reversão**.
  - `src/styles.css` breakpoint `@media max-width: 980px`, bloco `.public-service-panel { max-height: none; overflow-y: visible; }` — **é o segundo alvo da reversão** (remoção completa do bloco, por ter ficado redundante).
  - `git log --oneline -5` confirma que nenhuma dessas mudanças (fórmula do rail, scroll do panel, reset mobile) está commitada — o trabalho inteiro desta sub-tarefa está apenas no working tree local.

## Impacto por área

### Frontend

- **`src/styles.css`**: reversão pontual de 2 blocos (`.public-service-panel` na base, e o reset dela dentro do breakpoint `max-width: 980px`), sem tocar em mais nada. A correção de fórmula do rail e da tela de sucesso permanece como está.
- Sem impacto em hooks de rede, React Query, formulários — é reversão de contêiner/CSS.
- Sem mudança de JSX.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css` — blocos `.public-service-panel` (base) e o reset equivalente dentro do breakpoint mobile.

## Estratégia de implementação

1. Reconfirmar com grep as linhas atuais de `.public-service-panel` (base) e do bloco de reset dentro de `@media max-width: 980px` (podem ter deslocado desde este planejamento).
2. Reverter `.public-service-panel` para `max-height: none; overflow: visible;` (removendo o `max-height` calculado e trocando `overflow-x`/`overflow-y` separados de volta para a propriedade única `overflow: visible`).
3. Remover por completo o bloco `.public-service-panel { max-height: none; overflow-y: visible; }` dentro do breakpoint `max-width: 980px` (ficou redundante após o passo 2).
4. Confirmar que `.public-service-rail` e `.public-service-panel--success` permanecem exatamente como estão (fórmula com `--public-footer-height`) — não tocar nelas.
5. Rodar grep de `.public-service-panel` no arquivo inteiro para confirmar que não sobrou nenhuma referência a `overflow-y: auto`/`max-height` calculado ligada a essa classe.
6. Rodar `typecheck` e `build`.
7. Validar visualmente (ou pela leitura do CSS resultante) que existe só 1 scrollbar na tela de serviço público, e que o rodapé não cobre mais o banner em nenhuma altura de viewport testável.

## Regras de negócio identificadas

Nenhuma — é reversão/ajuste de contêiner CSS, sem mudança de comportamento funcional.

## Regras multi-tenant e segurança

Sem impacto — não há dado de tenant/permissão envolvido.

## Validações necessárias

- Confirmar visualmente que existe apenas 1 scrollbar na tela "Solicitar procedimento" (e demais serviços públicos).
- Confirmar que o rodapé continua sem sobrepor o banner após a reversão (a correção do rail, que resolve isso, não foi tocada).
- Confirmar que o breakpoint mobile (≤980px) continua sem regressão após a remoção do bloco de reset redundante.
- Confirmar a tela de sucesso do formulário (`.public-service-panel--success`) também sem sobreposição do rodapé.

## Testes necessários

### Frontend

Não há suíte de testes de componente identificada para este layout; validação será manual/visual + `typecheck`/`build`.

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

- Baixo risco geral — é majoritariamente reversão de mudança não commitada (confirmado via `git log`), mantendo apenas o fix já validado (fórmula do rail).
- Com a reversão, a página volta a rolar inteira como sempre foi; o `.public-service-rail` (sticky) vai descolar naturalmente quando a página rolar além da sua própria altura — esse é o comportamento padrão de `position: sticky`, não uma regressão nova introduzida por este plano.
- Trabalho de outra sessão paralela pode estar mexendo no mesmo arquivo simultaneamente — usar a mesma técnica de isolamento (stash/patch parcial) já usada nesta sessão antes de qualquer commit via skill `finalizar`.
- Push é direto em `main`, sem `staging` — qualquer regressão visual é imediatamente visível em produção.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Critérios de aceite do plano

- Apenas 1 scrollbar visível na tela de serviço público (o da página).
- Rodapé nunca sobrepõe o banner, em nenhuma altura de viewport.
- Comportamento mobile (≤980px) sem regressão.
- `typecheck` e `build` passam sem novos erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não executar migrations (não aplicável).
- Reconfirmar linhas atuais com grep antes de editar.
- Não tocar em `.public-service-rail` nem `.public-service-panel--success` — já estão corretos, fora de escopo desta reversão.
- Isolar as próprias edições de qualquer trabalho não commitado de outra sessão presente no mesmo arquivo, antes de qualquer commit via skill `finalizar`.
- Validar visualmente que sobrou só 1 scroll antes de considerar concluído.
- Seguir a regra de comunicação silenciosa da skill `implementar`.
