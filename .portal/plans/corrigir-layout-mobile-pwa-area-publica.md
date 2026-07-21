# Plano de Implementação: Corrigir layout mobile/PWA da área pública

## Origem

- Arquivo de especificação: Nenhum `FEATURE_FILE` fornecido. Entrada baseada em auditoria mobile/PWA ao vivo (Playwright, viewports 320/360/375px) realizada nesta mesma conversa contra as telas públicas de Solicitações, Prontuário, Credenciamento e Adoção.
- Data do planejamento: 2026-07-21
- Classificação: `frontend-only`

## Resumo

A área pública do sistema (acessada sem login, inclusive como PWA instalado em modo `standalone`) tem 3 bugs confirmados por screenshot em telas de smartphone pequenas (320/360/375px):

1. **Crítico** — a tela "Solicitações" trava o usuário sem nenhuma navegação possível quando o município não foi auto-detectado (falha comum de geolocalização/rate-limit do `ipapi.co`). Em PWA `standalone` não há botão "voltar" do navegador, então o usuário fica preso.
2. O botão flutuante "Início" sobrepõe visualmente o título "Serviços do prontuário" quando não há brasão de município carregado.
3. A grid de 2 colunas dos cards de serviço do Prontuário fica com texto cortado em qualquer tela pequena (320/360/375px), por falta de breakpoint mobile.

Os bugs 2 e 3 têm causas diferentes, mas os bugs 2 e a variante do stepper de Solicitações (item 4 da estratégia) compartilham a mesma causa raiz: botões `position: fixed` (`.nr-home-btn` / `.consultation-home-btn`) que nunca reservam espaço no fluxo do documento.

## Escopo

### Dentro do escopo

- Garantir que a tela pública de Solicitações sempre exiba header/navegação/seletor de município, mesmo sem município auto-detectado.
- Corrigir a sobreposição do botão "Início" com o título em `ValidationKeyConsultation` (Prontuário) quando não há brasão.
- Adicionar breakpoint mobile para a grid de cards de serviço do Prontuário (`.cons-service-cards`).
- Revisar as variantes de `.nr-home-btn`/`.nr-topbar` usadas exclusivamente pela página pública de Solicitações, garantindo espaço reservado consistente para o botão fixo.

### Fora do escopo

- Qualquer alteração no mecanismo de auto-detecção de município (geolocalização/`ipapi.co`) em si — o plano só garante que a UI não trave quando a detecção falha, não corrige a confiabilidade da detecção.
- Alterações nas variantes de `.nr-home-btn`/`.nr-topbar` usadas dentro do modal interno (`internal-request-modal .nr-shell--internal`) ou em outras telas do admin — essas já funcionam corretamente hoje e não devem ser tocadas.
- Qualquer refatoração maior de `src/styles.css` (é um arquivo grande e com muitas variantes reaproveitando nomes de classe; a intenção aqui é a correção pontual, não uma reorganização do arquivo).
- Melhorias de UX além dos 3 bugs relatados (ex.: redesenhar o fluxo de seleção de município).

## Leitura de contexto

- `/AGENT.md` (raiz) — lido integralmente nesta conversa.
- `frontend/AGENT.md` — não existe neste repositório (frontend vive em `src/`, não em `frontend/`). Confirmado via busca no filesystem.
- `backend/AGENT.md` — não existe neste repositório. Não aplicável de qualquer forma, pois não há impacto backend.
- Auditoria mobile/PWA realizada nesta conversa: screenshots Playwright em 320×568, 360×740 e 375×667 cobrindo Home, Solicitações, Prontuário, Credenciamento e Adoção.
- `src/App.tsx` — inspecionado: `PublicCastrationForm` (linhas ~2638-2755), `simpleHeader` (linhas ~2669-2688), `ValidationKeyConsultation` (linhas ~1153-1454 e ~1413-1423), `MunicipalitySelectorChip` (linha ~2560), lógica de auto-detecção de município (linhas ~274, ~320-360).
- `src/styles.css` — inspecionado: `.cons-shell`/`.cons-topbar`/`.cons-body` (linhas ~14302-14367), `.cons-service-cards` (linhas ~14442-14446), breakpoint existente `@media (max-width: 540px)` (linhas ~14671-14684), `.consultation-home-btn` (linhas ~14745-14761), variantes de `.nr-home-btn` (linhas ~2841-2856, ~17037-17046, ~18103-18112) e seu override mobile (linhas ~15999-16005).

## Impacto por área

### Frontend

- `PublicCastrationForm` (`src/App.tsx`): passar a renderizar `simpleHeader` também no estado `!selectedMunicipalityId`, em vez de renderizar isoladamente a `<div className="public-municipality-prompt">`.
- `ValidationKeyConsultation` (`src/App.tsx`): parar de condicionar `<header className="cons-topbar">` à existência de `municipalityBrasao` — o header (ou um espaçador equivalente) deve sempre ocupar espaço, para que o botão fixo "Início" nunca sobreponha `.cons-title`.
- `src/styles.css`: adicionar `grid-template-columns: 1fr` para `.cons-service-cards` dentro do breakpoint `@media (max-width: 540px)` já existente; revisar padding/posicionamento das variantes públicas de `.nr-home-btn`/`.nr-topbar` para reservar espaço equivalente à altura do botão fixo.
- Sem novos componentes, hooks, query keys ou formulários — é ajuste de renderização condicional e CSS em componentes existentes.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx`
  - `PublicCastrationForm` (~linha 2731-2755)
  - `ValidationKeyConsultation` (~linha 1413-1423)
- `src/styles.css`
  - `.cons-service-cards` (~linha 14442-14446)
  - `.cons-topbar` / `.cons-body` (~linha 14302-14367, ~14671-14684)
  - `.consultation-home-btn` (~linha 14745-14761)
  - Variantes públicas de `.nr-home-btn` / `.nr-topbar` (~linha 2841-2856, ~17037-17046, ~18103-18112, ~15999-16005) — **somente** os seletores com escopo `.public-form-page:not(.public-form-page--consultation)`; não tocar `.internal-request-modal .nr-shell--internal`.

## Estratégia de implementação

1. **Corrigir dead-end de Solicitações sem município.** Em `PublicCastrationForm`, mover/duplicar a renderização de `{simpleHeader}` para que ela apareça também no branch `!selectedMunicipalityId` (hoje só aparece nos branches `done` e implicitamente dentro de `NewRequest`). O `MunicipalitySelectorChip` já embutido no `simpleHeader` passa a dar ao usuário uma forma manual de escolher o município e destravar o fluxo; o `nr-home-btn`/`onBack` do próprio header já cobre a volta à Home.
2. **Corrigir overlap do botão "Início" no Prontuário.** Em `ValidationKeyConsultation`, remover a condicional `{municipalityBrasao && (...)}` ao redor de `<header className="cons-topbar">` — o header deve renderizar sempre (com o brasão quando existir, ou como espaçador vazio quando não existir), garantindo que `.cons-body` comece sempre abaixo da área ocupada pelo botão fixo `.consultation-home-btn`.
3. **Corrigir grid cortada dos cards de serviço.** Em `src/styles.css`, dentro do bloco `@media (max-width: 540px)` já existente (linha ~14671), adicionar:
   ```css
   .cons-service-cards {
     grid-template-columns: 1fr;
   }
   ```
4. **Aplicar a mesma correção de espaço reservado ao stepper de Solicitações.** Revisar as variantes de `.nr-home-btn` com escopo `.public-form-page:not(.public-form-page--consultation)` (base ~18103-18112, override mobile ~15999-16005) e o `.nr-topbar` correspondente (~18087-18100), garantindo padding/margem suficiente para que o primeiro passo do stepper nunca fique atrás do botão fixo — usando a mesma técnica aplicada no passo 2 (reservar espaço, sem remover o `position: fixed`).
5. **Verificação visual.** Reexecutar o mesmo roteiro de auditoria Playwright (320×568, 360×740, 375×667) contra Home → Solicitações (com e sem município simulado) → Prontuário → Credenciamento, confirmando que os 3 bugs não aparecem mais e capturando screenshots de evidência.
6. **Verificação de não-regressão no admin.** Conferir rapidamente (viewport desktop, 1400px) que Dashboard, Solicitações internas e o modal interno de nova solicitação (`internal-request-modal`) continuam iguais — já que alguns seletores CSS tocados (`.nr-home-btn`, `.nr-topbar`) têm variantes reaproveitadas nessas telas.

## Regras de negócio identificadas

Não aplicável — task de correção de bugs de layout/fluxo em UI existente, sem nova regra de negócio.

## Regras multi-tenant e segurança

- Nenhuma lógica de tenant/prefeitura é criada ou alterada. O plano só garante que a UI de seleção de município (`MunicipalitySelectorChip`, já existente e já usada em outras telas públicas) fique visível/acessível também no estado sem município — o fluxo de dados (`selectedMunicipalityId` → `onMunicipalitySelect` → `handleMunicipalitySelect`) permanece o mesmo.
- Sem impacto em permissões, autorização ou relatórios/PDFs.

## Validações necessárias

- Não há formulário novo nem schema novo — não há validação de input a adicionar.
- Validação é de layout/renderização: conferir visualmente que não há sobreposição, corte de texto ou overflow horizontal nos 3 viewports auditados.

## Testes necessários

Não existe framework de teste automatizado configurado no projeto (sem Jest/Vitest/Playwright Test como dependência, sem script `test` em `package.json` raiz ou `backend/package.json`). A verificação será manual:

### Frontend

- Reteste visual manual (script Playwright ad-hoc, mesmo usado na auditoria) nos 3 viewports, cobrindo os 3 cenários corrigidos.
- Conferência manual rápida das telas internas afetadas por seletores CSS compartilhados (Dashboard, Solicitações internas, modal interno de nova solicitação).

### Backend

Não aplicável.

### E2E

Não aplicável — sem framework configurado. Cobertura equivalente feita via script Playwright ad-hoc (ver acima).

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

Não existem scripts `lint` ou `test` configurados neste projeto (nem no `package.json` raiz, nem em `backend/package.json`), apesar do `AGENT.md` mencionar ESLint como linter — não há `.eslintrc`/`eslint.config.*` no repositório. Nenhum comando de lint/test deve ser inventado; isso deve ser reportado como limitação existente, não como falha introduzida por esta implementação.

## Riscos e pontos de atenção

- `src/styles.css` tem ~21 mil linhas com múltiplas variantes de `.nr-home-btn`/`.nr-topbar` reaproveitando nomes de classe entre a página pública, o modal interno (`internal-request-modal`) e o Prontuário (`.cons-shell`). Risco principal: mexer em um seletor sem escopo suficiente e vazar a mudança para uma tela do admin que já funciona bem hoje. Mitigação: tocar apenas seletores com prefixo `.public-form-page:not(.public-form-page--consultation)` e `.cons-shell`/`.consultation-home-btn`, nunca `.internal-request-modal .nr-shell--internal`.
- Remover a condicional do `municipalityBrasao` no header do Prontuário muda o espaçamento vertical da tela mesmo quando há brasão (já que o header passa a ter uma altura mínima garantida). Precisa conferir visualmente que o caso "com brasão" (hoje já correto) não regride.
- Sem suíte de testes automatizados, a garantia de não-regressão depende inteiramente da verificação visual manual descrita acima — risco de um caso de borda não coberto pelos 3 viewports testados.

## Perguntas em aberto

Nenhuma pergunta bloqueante. As 3 questões levantadas na apresentação do plano foram resolvidas com os padrões recomendados, já que o plano foi aprovado sem ajuste:

- O botão "Início" continua `position: fixed` — a correção é reservar espaço ao redor dele, não remover o comportamento flutuante.
- O breakpoint da grid do Prontuário usa `max-width: 540px`, reaproveitando o breakpoint já existente em `.cons-body`/`.cons-search-card` no mesmo arquivo.
- A tela de Prontuário (`screen === "consulta"`) não tem o bug de dead-end (`ValidationKeyConsultation` já renderiza `.consultation-home-btn` incondicionalmente) — só o overlap (bug 2) se aplica a ela. Nenhum trabalho adicional além do item 2 da estratégia é necessário ali.

## Critérios de aceite do plano

- Em 320px, 360px e 375px, a tela "Solicitações" sem município selecionado exibe header com botão de voltar e seletor de município — nunca só uma frase sem navegação.
- Em 320px, 360px e 375px, o título "Serviços do prontuário" nunca fica sobreposto pelo botão "Início", com ou sem brasão de município carregado.
- Em 320px, 360px e 375px, os 4 cards de serviço do Prontuário ficam em coluna única, sem texto cortado.
- O stepper da tela pública de Solicitações não fica com o passo 1 obscurecido pelo botão "Início" em nenhum dos 3 viewports.
- `npm run typecheck` e `npm run build` passam sem novos erros.
- Nenhuma tela do admin (Dashboard, Solicitações internas, modal interno de nova solicitação) apresenta regressão visual nos seletores CSS compartilhados.

## Observações para a skill implementar

- Usar este arquivo como fonte principal de contexto.
- Não executar migrations (não há nenhuma neste plano).
- Seguir `/AGENT.md` (não há `frontend/AGENT.md`/`backend/AGENT.md` neste repositório).
- Manter as alterações pequenas e focadas nos 4 pontos da estratégia — não aproveitar para refatorar `src/styles.css` além do necessário.
- Ao mexer nas variantes de `.nr-home-btn`/`.nr-topbar`, confirmar o seletor completo antes de editar (usar grep pelo seletor exato, não só pelo nome da classe) para não alterar a variante errada.
- Revalidar com o mesmo roteiro Playwright (320/360/375px) usado na auditoria original antes de reportar como concluído.
