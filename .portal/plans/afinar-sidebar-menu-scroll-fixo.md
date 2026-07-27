# Plano de Implementação: Afinar cards do menu lateral e fixar rodapé (scroll contido em Configurações)

## Origem

- Especificação: descrita em conversa (sem arquivo `.md` de origem), a partir de screenshot da sidebar em `Configurações` expandido.
- Data do planejamento: `2026-07-26`
- Classificação: `frontend-only`

## Resumo

O menu lateral (`<aside className="sidebar">` em `src/App.tsx`) tem dois problemas visuais/estruturais:

1. Os cards de item do menu (nível 1: Dashboard/Solicitações/.../Configurações; nível 2: Configurar Ambiente/Criar Usuários/Criar Setores/Permissões; nível 3: Agenda/Tipo de Solicitação/Portes/Espécies/Documentos Solicitados/WhatsApp dentro de "Configurar Ambiente") estão visualmente pesados demais ("cavalão") — bordas grossas, `border-radius` grande, sombra e `font-weight` alto.
2. O `<aside>` inteiro (brasão + nav + rodapé "Sair"/usuário) é hoje um único bloco com `overflow-y:auto`. Quando "Configurações" expande vários níveis de submenu, o rodapé é empurrado para fora da tela e rola junto — não fica fixo.

## Escopo

### Dentro do escopo

- Reduzir peso visual (`min-height`, `padding`, `border-radius`, `font-weight`, `box-shadow`) dos botões de menu nos 3 níveis e do rodapé (`sidebar-user-card`, `sidebar-action-item`), editando a camada de CSS que hoje efetivamente vence a cascata (`src/styles.css:20711-20869`, bloco "Company portal layout alignment" — é a última e sem media query, portanto a que realmente está sendo aplicada), em vez de empilhar mais uma camada por cima.
- Reestruturar `.sidebar` para que:
  - o brasão (topo) e o nav de nível 1 (Dashboard...Configurações) fiquem **sempre visíveis, sem scroll**;
  - o rodapé ("Sair"/card de usuário) fique **sempre fixo no rodapé, nunca rola**;
  - apenas o submenu expandido de "Configurações" (níveis 2 e 3 juntos) ganhe **scroll próprio e contido**, com `max-height` calculado a partir do espaço restante entre nav de nível 1 e rodapé.
- Onde a mudança exigir tocar uma regra genuinamente compartilhada com outros componentes fora de escopo (ex.: variáveis `--ui-radius-lg`/`--ui-shadow-line` usadas também em `.topbar-*`/cards), usar seletor escopado à sidebar em vez de mudar a variável global, com comentário explicando o motivo.
- Testar visualmente em desktop e no drawer mobile (`.sidebar.open`, media query `max-width:760px`), já que ambos herdam a mesma estrutura base do `<aside>`.

### Fora do escopo

- Mudança de conteúdo/rótulos do menu, de comportamento de navegação, cliques ou permissões visíveis por role.
- Redesign de outras telas que reusam classes/variáveis tocadas aqui (`.panel`, `.metric-card`, `.topbar-*`, etc.) além do necessário para não quebrá-las.
- **Limpeza geral do CSS morto/duplicado da sidebar** (blocos intermediários `src/styles.css:16397-16449` e `18875-18984`, que hoje perdem para a camada final em quase todas as propriedades de peso visual mas ainda podem ter alguma propriedade residual válida). Essa limpeza mais ampla fica para uma sessão `/limpar` separada — decisão explícita do usuário. Nesta implementação, só mexo nessas camadas se alguma propriedade específica delas continuar vencendo e atrapalhar o resultado esperado.

## Leitura de contexto

- `/AGENT.md` (regras globais do monorepo; não há `frontend/AGENT.md`/`backend/AGENT.md` neste repositório — estrutura real é `src/` na raiz).
- Investigação de código feita nesta sessão:
  - `src/App.tsx:736-862` — estrutura JSX do `<aside className="sidebar">`: brasão (`.brand`), `<nav aria-label="Menu principal">` com itens de nível 1, submenu `.sidebar-subnav` (nível 2, `.config-nav-item`) e `.config-nav-children` (nível 3, `.config-nav-child`), e `.sidebar-footer` (troca de senha, sair, card de usuário).
  - `src/styles.css` — **4 blocos diferentes** redefinem `.sidebar`, `.brand`, `.sidebar nav button`/`.config-nav-item`/`.config-nav-child` e `.sidebar-footer`, sem media query nem escopo, em ordem crescente no arquivo:
    1. `119-330` — base original (radius 10px, `font-weight:500`, sombra fina, `min-height:44px`).
    2. `16397-16449` — camada "ui design system" (radius 16px).
    3. `18875-18984` — camada "public-office clean shell polish" (radius 14px, `font-weight:650`).
    4. `20711-20869` — camada **"Company portal layout alignment"**, a mais recente e sem media query — **é essa quem vence hoje** (`min-height:46px`, `border-radius: var(--ui-radius-lg)` = 18px, `font-weight:600`, `box-shadow: var(--ui-shadow-line)`, ícone ativo com badge de fundo colorido). Principal responsável pelo visual "cavalão".
  - `src/styles.css:494-608` — `.sidebar-footer` (`margin-top:auto`, depende do `.sidebar` ser `display:flex; flex-direction:column`), `.sidebar-action-item`, `.sidebar-user-card`.
  - `src/styles.css:119-134` — `.sidebar` base: `position:sticky; top:0; height:100vh; overflow-y:auto` — **é aqui que está o bug do scroll**: o `<aside>` inteiro rola como um bloco só, arrastando o rodapé junto.
  - `src/styles.css:8554-8566` — versão mobile de `.sidebar` (`position:fixed`, drawer deslizante `translateX`), dentro de media query `max-width` — herda a mesma estrutura de scroll do bloco base, então precisa da mesma correção.

## Impacto por área

### Frontend

- **`src/App.tsx`** (~736-862): envolver o bloco do submenu de Configurações (`.sidebar-subnav` + itens) em um container próprio com classe nova (ex.: `.sidebar-subnav-scroll`) para receber `overflow-y:auto` e `max-height` independentes do restante do nav. Nav de nível 1 e `.sidebar-footer` continuam como irmãos diretos do `.sidebar`, fora dessa área de scroll.
- **`src/styles.css`**:
  - `.sidebar` (base, ~119-134): remover `overflow-y:auto` do elemento raiz; manter `display:flex; flex-direction:column; height:100vh`.
  - Nova regra para o container do submenu com scroll: `overflow-y:auto`, `min-height:0`, `flex-shrink:1` (para não estourar o espaço disponível).
  - Ajustar `min-height`/`padding`/`border-radius`/`font-weight`/`box-shadow` na camada vencedora (20711-20869) para valores mais enxutos, nos 3 níveis de item e no rodapé.
  - Repetir o ajuste de scroll na versão mobile (~8554-8566), garantindo que o drawer também respeite nav fixo + submenu com scroll + rodapé fixo.
- Sem impacto em testes automatizados existentes (não há suíte de testes de UI para a sidebar hoje); validação será visual via Playwright.

### Backend

`Sem impacto esperado`.

### Banco de dados

`Sem impacto esperado`.

### Infra/Deploy

`Sem impacto esperado`.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/styles.css`

## Estratégia de implementação

1. Reestruturar `.sidebar` em `src/styles.css`: remover `overflow-y:auto` do elemento raiz, manter como flex column de altura total da viewport.
2. No JSX (`src/App.tsx`), envolver o submenu de Configurações (`.sidebar-subnav` e seus filhos) em um wrapper com nova classe dedicada ao scroll interno.
3. Adicionar CSS do novo wrapper: `overflow-y:auto`, `min-height:0`, para conter o scroll só ali.
4. Ajustar os valores de peso visual (`min-height`, `padding`, `border-radius`, `font-weight`, `box-shadow`) na camada de CSS que efetivamente vence hoje (20711-20869), para os 3 níveis de item e para `.sidebar-user-card`/`.sidebar-action-item` no rodapé.
5. Repetir o ajuste estrutural de scroll na regra mobile (~8554-8566) do `.sidebar`.
6. Rodar grep de cada classe alterada no arquivo inteiro para confirmar que nenhuma camada antiga (16397/18875) está silenciosamente revertendo o resultado esperado; se estiver, ajustar a mínima propriedade necessária ali (sem fazer a limpeza completa, que fica fora de escopo).
7. Build (`npm run build`), reiniciar backend local, validar com Playwright: desktop com "Configurações" expandido e vários subitens, e drawer mobile.
8. Rodar `npm run typecheck`.

## Regras de negócio identificadas

Nenhuma regra de negócio envolvida — mudança é puramente visual/estrutural de layout.

## Regras multi-tenant e segurança

`Sem impacto esperado` — a sidebar já usa dados de município/role existentes (brasão, nome do município, role label); nenhuma lógica de acesso é alterada.

## Validações necessárias

- Conferir visualmente que nav de nível 1 e rodapé nunca saem da viewport, em qualquer combinação de submenu expandido.
- Conferir que o scroll aparece **somente** dentro do submenu de Configurações quando o conteúdo excede o espaço disponível, e não em mais nenhum lugar da sidebar.
- Conferir em desktop (sidebar expandida e colapsada) e no drawer mobile.

## Testes necessários

### Frontend

- Nenhum teste automatizado novo previsto (sidebar não tem cobertura de testes hoje); validação via Playwright manual nesta sessão.

### Backend

`Sem impacto esperado`.

### E2E

- Playwright: login → abrir "Configurações" → expandir "Configurar Ambiente" → confirmar que nav nível 1 e rodapé continuam visíveis e que o submenu tem scroll próprio quando necessário. Repetir em viewport mobile (`max-width:760px`) com o drawer aberto.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- As classes tocadas (`.sidebar`, `.brand`, `.sidebar nav button`, `.config-nav-item`, `.config-nav-child`, `.sidebar-footer`) aparecem em pelo menos 4 blocos diferentes do CSS, sem escopo por media query. Risco de ajustar a camada errada e o resultado não aparecer na tela (ou aparecer só em um dos breakpoints). Mitigação: grep de cada classe alterada no arquivo inteiro antes de considerar concluído.
- Mudar `display`/`overflow` do `.sidebar` raiz pode afetar o comportamento do drawer mobile (`position:fixed` + `translateX`), que depende da mesma estrutura. Testar os dois casos.
- Deixar as camadas intermediárias de CSS (16397/18875) sem limpeza pode significar que, se alguma propriedade específica delas ainda estiver "ganhando" em algum caso não previsto, o resultado fique inconsistente entre nível 1/2/3. Se isso acontecer durante a implementação, ajustarei a propriedade mínima necessária ali (documentando no resumo final), sem fazer a limpeza completa.
- Risco de produção: commit/push são feitos direto em `main`, sem `staging`.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — decisões já confirmadas pelo usuário:
- Nav de nível 1 e rodapé sempre fixos; só o submenu de Configurações ganha scroll próprio e contido.
- Limpeza do CSS morto das camadas intermediárias (16397/18875) fica para uma sessão `/limpar` separada; nesta implementação só mexo no mínimo necessário se alguma propriedade residual atrapalhar o resultado.

## Critérios de aceite do plano

A implementação deve ser considerada pronta quando:

- Os cards de item do menu (nos 3 níveis) estiverem visivelmente mais enxutos (menos padding/radius/peso de fonte/sombra) que o estado atual.
- O rodapé ("Sair"/card de usuário) permanecer sempre visível e fixo, em qualquer estado de expansão do menu.
- O scroll só aparecer dentro do submenu de Configurações, nunca arrastando nav de nível 1 ou rodapé junto.
- Build e typecheck passarem sem erros novos.
- Validado visualmente em desktop e mobile via Playwright, sem erros de console.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não fazer a limpeza completa das camadas intermediárias de CSS (16397-16449, 18875-18984) — está fora de escopo por decisão explícita do usuário; mexer nelas só na propriedade mínima necessária, se surgir conflito real durante a implementação.
- Preferir editar a camada de CSS que já vence a cascata (20711-20869) em vez de empilhar uma nova camada por cima.
- Manter alterações pequenas e focadas em `src/App.tsx` e `src/styles.css`.
- Validar com Playwright (desktop + mobile) e reportar screenshots antes/depois.
