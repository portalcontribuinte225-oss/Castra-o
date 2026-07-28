# Plano de Implementação: Unificar peso/tamanho de fonte entre métodos de botão de escolha

## Origem

- Arquivo de especificação: sem `.md` externo — pedido direto do usuário no chat, após reportar que "Tipo de solicitação" (Ninhada/Animal de Rua) parece usar fonte diferente dos demais grupos de botões na etapa Animal
- Data do planejamento: 2026-07-28
- Classificação: `frontend-only`
- Investigação preliminar: feita por agente de exploração dedicado nesta conversa (read-only), que mapeou todos os métodos de botão de escolha usados na etapa Animal e confirmou a causa raiz antes deste plano ser escrito

## Resumo

Na etapa Animal do formulário público (`NewRequest`, `.nr-shell--public`), dois métodos distintos de "botão de escolha" convivem sem convergir visualmente:

1. **`CompactChoiceField`** (componente reutilizável, `src/components/ui.tsx:164-183`) — usado para Tipo de Procedimento, Espécie, Sexo, Raça, Porte. Seu `font-weight` vem de variáveis CSS globais de normalização tipográfica (`--type-weight-control` = 500 base, `--type-weight-control-active` = 600 selecionado), aplicadas com `!important` num bloco final do arquivo (`~styles.css:25554-25585`).
2. **`.anm-type-card`** (JSX cru, direto em `App.tsx:4088-4105`, sem usar `CompactChoiceField`) — usado só para "Tipo de solicitação" (Ninhada/Animal de Rua). Nunca foi incluído no bloco de normalização tipográfica; mantém `font-weight: 600` fixo e `font-size: 0.95rem` fixo na definição base (`~styles.css:5825-5831`), sem variar entre estado normal/selecionado.

Resultado: o grupo "Ninhada/Animal de Rua" renderiza com peso de fonte mais forte (600 fixo) que os demais grupos da mesma tela (500 no estado normal), e com um `font-size` que os outros não declaram explicitamente. `font-family` não diverge entre os dois métodos — ambos herdam corretamente `var(--font-ui)` do body; a causa é peso/tamanho, não família tipográfica.

Este plano unifica `.anm-type-card` ao mesmo sistema de normalização já usado por `.compact-choice-field button`, sem consolidar os dois métodos num único componente React (mudança estrutural maior, fora do escopo deste pedido).

## Escopo

### Dentro do escopo

- Adicionar `.anm-type-card` (e seu estado `.anm-type-card.is-selected`, se aplicável) à lista de seletores do bloco de normalização tipográfica global (`~styles.css:25554-25563` para o peso base, `~styles.css:25580-25585` para o peso do estado selecionado).
- Remover o `font-weight: 600` fixo e o `font-size: 0.95rem` fixo da definição base de `.anm-type-card` (`~styles.css:5825-5831`), deixando o elemento herdar os valores das variáveis de normalização, igual `.compact-choice-field button` já faz.
- Validar visualmente (ou pela leitura do CSS resultante) que "Ninhada/Animal de Rua" passa a ter peso/tamanho de fonte visualmente consistente com "Castração/Microchipagem/Ambos", "Canino/Felino", "Macho/Fêmea", "Indefinida/Definida" e "Pequeno/Médio/Grande" na mesma tela.
- Confirmar que outros contextos onde `.anm-type-card` também aparece (`.nr-shell` genérico, `.public-form-page`, e o bloco final `.nr-shell--public` de cor/borda) continuam coerentes após a mudança — a normalização é global, então precisa não quebrar esses outros escopos.

### Fora do escopo

- Consolidar `.anm-type-card` e `CompactChoiceField` num único componente React — é uma refatoração estrutural maior (mudaria JSX, não só CSS), mais arriscada, e não foi pedida; o pedido é sobre aparência consistente, não arquitetura. Fica registrado como possível trabalho futuro.
- Qualquer mudança em `.yes-no-toggle-field` (Saúde e cuidados) — é uma estrutura diferente (toggle switch, não botão), já com paleta de cor consistente com o restante; fora do escopo de "botão de escolha".
- Qualquer mudança de cor/borda/padding/border-radius dos botões — só peso e tamanho de fonte estão em escopo, o resto do estilo visual já está coerente (confirmado pela investigação).
- Limpeza geral de duplicação de `.compact-choice-field`/`.anm-type-card` em outros contextos não relacionados (ex.: `.adoption-form-modal`, `.internal-request-modal`) — fora do escopo, que é só a tela pública de cadastro.
- Investigação/limpeza dos múltiplos blocos `:root {}` duplicados no arquivo (achado lateral da investigação, não relacionado à causa raiz deste bug específico) — fica registrado como achado para uma limpeza futura, não faz parte deste plano.

## Leitura de contexto

- `/AGENT.md` (raiz) — mesmo contexto de planos anteriores nesta sessão.
- `frontend/AGENT.md` / `backend/AGENT.md` — não existem neste repo.
- Investigação do agente de exploração (mapeamento completo, resumido abaixo):
  - `src/App.tsx:4085` — Tipo de Procedimento via `CompactChoiceField`.
  - `src/App.tsx:4088-4105` — Tipo de solicitação via `.anm-type-card` cru (não usa `CompactChoiceField`).
  - `src/App.tsx:4108-4110` — Espécie/Sexo/Raça via `CompactChoiceField`.
  - `src/App.tsx:4119` — Porte via `CompactChoiceField`.
  - `src/components/ui.tsx:164-183` — definição de `CompactChoiceField`.
  - `src/styles.css:5825-5852` — definição base de `.anm-type-card` (`font-weight: 600` fixo, `font-size: 0.95rem` fixo, sem variação no estado selecionado).
  - `src/styles.css:5918-5935` — definição base de `.compact-choice-field button` (sem `font-size` fixo).
  - `src/styles.css:20958-20982` (contexto `.nr-shell--public`) — cor/borda de ambos os métodos já convergem (paleta `#e6ddc9`/`#1f8a5f`/`#eaf3ee`), não é fonte do problema.
  - `src/styles.css:25554-25563` — bloco de normalização tipográfica global, `font-weight: var(--type-weight-control) !important` aplicado a `.compact-choice-field button` e ~15 outros seletores heterogêneos, **sem** `.anm-type-card`.
  - `src/styles.css:25580-25585` — mesmo bloco, estado `.selected`, `font-weight: var(--type-weight-control-active) !important`, também sem `.anm-type-card`.
  - Confirmado: nenhum dos dois métodos declara `font-family` próprio — ambos herdam `var(--font-ui)` do `body`/`:root` (linhas 1-7, 53-63) via `button { font: inherit }` (linha 66-70). A causa é exclusivamente peso/tamanho, não família.

## Impacto por área

### Frontend

- **`src/styles.css`**: adicionar `.anm-type-card`/`.anm-type-card.is-selected` aos dois blocos de normalização tipográfica (~25554-25585); remover `font-weight`/`font-size` fixos da definição base de `.anm-type-card` (~5825-5831).
- Sem mudança de JSX, sem mudança de lógica/comportamento — é puramente visual/tipográfico.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css` — bloco base `.anm-type-card` (~5825-5852) e bloco de normalização tipográfica global (~25554-25585).

## Estratégia de implementação

1. Reconfirmar com grep as linhas atuais de `.anm-type-card` (base) e do bloco de normalização tipográfica (podem ter deslocado por edições paralelas de outra sessão).
2. Adicionar `.anm-type-card` à lista de seletores do bloco `font-weight: var(--type-weight-control) !important` (peso base).
3. Adicionar `.anm-type-card.is-selected` à lista de seletores do bloco `font-weight: var(--type-weight-control-active) !important` (peso selecionado).
4. Remover `font-weight: 600` e `font-size: 0.95rem` da definição base de `.anm-type-card` (~5825-5831), deixando esses valores virem só da normalização.
5. Rodar grep de `.anm-type-card` no arquivo inteiro para confirmar que nenhum outro contexto (`.nr-shell`, `.public-form-page`, `.nr-shell--public`) dependia do `font-weight`/`font-size` fixo removido de forma que quebraria visualmente.
6. Rodar `typecheck` e `build`.
7. Validar visualmente (ou pela leitura do CSS resultante) que os grupos de botão da etapa Animal ficam consistentes entre si.

## Regras de negócio identificadas

Nenhuma — é ajuste puramente visual/tipográfico, sem alterar dado, validação ou comportamento funcional.

## Regras multi-tenant e segurança

Sem impacto — não há dado de tenant/permissão envolvido.

## Validações necessárias

- Confirmar que "Ninhada/Animal de Rua" tem o mesmo peso/tamanho de fonte que os demais grupos de botão na etapa Animal, tanto no estado normal quanto selecionado.
- Confirmar que os outros contextos onde `.anm-type-card` aparece (`.nr-shell` genérico, `.public-form-page`) não regrediram visualmente.
- Confirmar que a cor/borda/padding dos botões permanece inalterada (só fonte muda).

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

- O bloco de normalização tipográfica (~25554+) é `!important` e afeta muitos seletores simultaneamente — adicionar `.anm-type-card` à lista é uma mudança aditiva de baixo risco (só amplia o escopo já existente da normalização), mas remover `font-weight`/`font-size` da definição base precisa ser conferida em todos os contextos onde `.anm-type-card` aparece, não só no público.
- Este plano não resolve a duplicação estrutural (dois métodos de componente diferentes para o mesmo tipo de UI) — só a aparência. Se o usuário quiser consolidação de componente depois, será um plano à parte.
- Trabalho de outra sessão paralela pode estar mexendo no mesmo arquivo — isolar as próprias edições (stash/patch parcial) antes de qualquer commit via skill `finalizar`.
- Push é direto em `main`, sem `staging` — qualquer regressão visual é imediatamente visível em produção.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Critérios de aceite do plano

- "Ninhada/Animal de Rua" visualmente consistente (peso/tamanho de fonte) com os demais grupos de botão da etapa Animal.
- Nenhuma mudança de cor/borda/padding.
- Outros contextos de `.anm-type-card` (fora do público) não regrediram.
- `typecheck` e `build` passam sem novos erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não executar migrations (não aplicável).
- Reconfirmar linhas atuais com grep antes de editar.
- Não consolidar `.anm-type-card` e `CompactChoiceField` num único componente — fora de escopo deste plano.
- Não tocar em `.yes-no-toggle-field` (Saúde e cuidados).
- Isolar as próprias edições de qualquer trabalho não commitado de outra sessão presente no mesmo arquivo, antes de qualquer commit via skill `finalizar`.
- Seguir a regra de comunicação silenciosa da skill `implementar`.
