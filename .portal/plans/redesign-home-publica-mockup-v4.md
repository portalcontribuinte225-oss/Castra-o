# Plano de Implementação: Redesign da Home Pública v4 (substitui o layout de 2 colunas)

## Origem

- Arquivo de especificação: nenhum `.md` foi fornecido pelo usuário; a especificação usada foi um segundo mockup HTML standalone ("Sistema Municipal de Proteção Animal v4"), colado diretamente no chat, substituindo o mockup usado no plano anterior (`redesign-home-publica-mockup.md`).
- Data do planejamento: 2026-07-23
- Classificação: `frontend-only`

## Resumo

Este plano substitui a estrutura implementada a partir do plano anterior (topbar + hero escuro + grid de 2 colunas com sidebar de ações "Bem-estar e proteção animal") por uma nova estrutura de coluna única, focada em adoção: topbar com nav ligado às ações reais, hero claro com 2 CTAs e foto de animal real, linha de estatísticas (zeradas por enquanto), grid de animais disponíveis com filtro fixo Todos/Cães/Gatos, e rodapé simples. O plano também documenta explicitamente o código (JSX e CSS) que fica obsoleto e deve ser removido, conforme pedido do usuário ("excluir códigos antigos e estilizações, deixando só o código novo").

## Escopo

### Dentro do escopo

- Reescrever `PetWelcomeArt` (hero): fundo claro (gradiente bege/creme do mockup), título/subtítulo, 2 CTAs ("Quero adotar" leva até a grid de adoção; "Agendar castração" chama `onPublicRequest`), imagem real de um animal disponível para adoção.
- Reestruturar `LoginView`: remover grid de 2 colunas e sidebar de ações; nav do topbar passa a chamar diretamente `onPublicRequest` (Solicitações), `onPublicConsult` (Prontuário) e abrir `showAccessModal` (Credenciamento); "Denunciar" fica decorativo; adicionar seção de estatísticas zeradas; adicionar rodapé.
- Restilizar `AdoptionCarousel`: trocar o filtro de pills com ícone (espécie+sexo dinâmicos) por 3 pills fixos de texto "Todos/Cães/Gatos" (reaproveitando `normalizeText` já existente no arquivo); botão do card vira "Quero adotar" verde full-width; contador de interesse vira texto "N interessados".
- Remover todo o JSX e CSS listados na seção "Código a remover" abaixo.
- Adotar a paleta de cores literal do novo mockup (verde `#1f8a5f`, gradiente bege/creme, outline escuro) em vez dos tokens azuis usados na versão anterior.

### Fora do escopo

- Qualquer alteração de backend/API.
- Criar uma rota/página real de "ver todos os animais" (não existe destino hoje para `onOpenAdoption`; a lista já mostrada passa a ser tratada como a lista completa, com `limit` maior).
- Fluxo real de "Denunciar" (sem equivalente no backend).
- Alterar o funcionamento interno do modal de login veterinário (`showVetModal`) além de manter o gatilho já existente.
- Dados reais para as estatísticas (adoções/castrações/ONGs) — ficam com valor `0` até existir uma fonte de dados real.

## Leitura de contexto

- `/AGENT.md` (regras globais; não há `frontend/AGENT.md`/`backend/AGENT.md` separados neste projeto)
- Mockup HTML v4 fornecido no chat (fonte completa, incluindo template embutido no bundler)
- `src/App.tsx`:
  - `AdoptionCarousel` (L1823-2059) — confirmado que só é usado dentro de `LoginView`; `public-animal-card`/`adoption-showcase`/`showcase-pill`/`public-animal-grid` não são usados em nenhum outro componente do arquivo, portanto seguros para restilizar sem afetar outras telas.
  - `LoginView` (L2102-2276+) — estrutura atual com `.public-topbar`, `.login-layout` (2 colunas), `.login-adoption-panel`, `.login-card` (sidebar de ações).
  - `PetWelcomeArt` (L2539+) — versão atual já simplificada (sem botões/imagem, por pedido anterior do usuário nesta mesma sessão).
  - Confirmado: `onOpenAdoption` nunca é passado com handler real em nenhum lugar do arquivo (já era assim antes desta sessão) — não há destino de "ver todos" a inventar.
  - `getAnimalMainPhoto`/`getAnimalPhotos` já existentes, usados para extrair foto real de um animal.
- `src/styles.css`: blocos `.login-page` (L611), `.login-layout` (L619), `.login-card` (L633), `.login-adoption-panel` (L651), `.mobile-adoption-toggle` (L663), `.login-wide-banner` (L668), `.public-hero`/`.hero-*` (L674-730), `.public-topbar` (L910), `.login-welcome*`/`.login-main-actions`/`.login-big-action*` (L1002-1120), overrides `.login-adoption-panel .public-animal-*` (L2351-2400), breakpoints `@media (max-width: 1120px)` em L8360/L8833/L9226 e `@media (max-width: 720px)` em L8550/L9245, bloco de reset `min-width:0` (~L14100-14140).
- Único asset estático de imagem no projeto: `public/pwa-icon.svg` (ícone PWA, não serve como foto de animal) — confirma que a imagem do hero deve vir de dados reais (foto de animal), não de um novo asset estático.
- Memória de sessão: workflow real deste projeto é commit direto em `main` (sem `staging`/PR), apesar do `/AGENT.md` genérico descrever `staging → PR`.

## Impacto por área

### Frontend

- `PetWelcomeArt`: nova prop implícita — passa a receber a lista de animais (ou a foto já resolvida) para exibir a imagem real; recebe `onPublicRequest` e um handler de scroll/abertura da grid de adoção (ex.: `onOpenAdoptionSection`, implementado como scroll até a seção via `ref`/`id`, sem necessidade de novo estado global).
- `LoginView`: remove `showMobileAdoption` (não é mais necessário, já que não há mais layout de 2 colunas/toggle); nav do topbar ganha `onClick` reais; adiciona seção de estatísticas e rodapé.
- `AdoptionCarousel`: substitui `adoptionFilters.species/sex` + `speciesQuickFilters`/`sexQuickFilters` (ícones) por um filtro único de 3 opções fixas baseado em `normalizeText(animal.species)`; ajusta render do card (botão, contador).
- Sem novos hooks, sem novas query keys (projeto não usa React Query).
- Testes: verificação manual em browser (sem suíte automatizada para esta tela).

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

Atenção: este plano não autoriza executar migrations automaticamente (não aplicável aqui, mantido por padrão do template).

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx` (componentes `LoginView`, `PetWelcomeArt`, `AdoptionCarousel`)
- `src/styles.css` (blocos listados em "Leitura de contexto" + novas classes de hero claro/stats/pills fixos)

## Código a remover

**JSX (`src/App.tsx`):**
- `<div className="login-layout">` (wrapper de grid 2 colunas) e todo o seu conteúdo estrutural.
- `<button className="mobile-adoption-toggle">` e o estado `showMobileAdoption`.
- `<section className="login-adoption-panel">`.
- `<section className="login-card">` inteiro, incluindo `.login-welcome`, `.login-main-actions` e os 3 `.login-big-action` (Solicitações/Prontuário/Credenciamento como big buttons — a funcionalidade migra para o nav, não o visual).

**CSS (`src/styles.css`):**
- `.login-layout`, `.login-wide-banner`, `.mobile-adoption-toggle`, `.login-adoption-panel` (+ overrides aninhados `.login-adoption-panel .public-animal-grid/.public-animal-card/.public-animal-photo/.public-animal-meta/.public-interest-cta` em ~L2351-2400).
- `.login-card`, `.login-welcome*`, `.login-main-actions`, `.login-big-action*` (todas as variantes e estados).
- Entradas dessas classes nos breakpoints `@media (max-width: 1120px)` (~L8360, L8833, L9226) e `@media (max-width: 720px)` (~L8550, L9245).
- Entradas dessas classes no bloco de reset `min-width:0` (~L14100-14140).
- Regras antigas de cor azul específicas do hero anterior (`.hero-eyebrow` cor azul, etc.) e do botão "Adotar" azul (`.public-interest-cta`), substituídas pela paleta verde do mockup v4.

## Estratégia de implementação

1. Ajustar `AdoptionCarousel`: trocar lógica de filtro (species/sex dinâmico) por 3 pills fixos Todos/Cães/Gatos usando `normalizeText`; restilizar card (botão verde full-width "Quero adotar", "N interessados" por extenso).
2. Reescrever `PetWelcomeArt`: hero claro, 2 CTAs, imagem real de animal (via `getAnimalMainPhoto` do primeiro animal disponível com foto), fallback sem imagem se nenhum animal tiver foto.
3. Reestruturar `LoginView`: remover grid 2 colunas/sidebar/toggle; adicionar seção de estatísticas (valores `0`); adicionar rodapé; ligar nav do topbar aos handlers reais (`onPublicRequest`, `onPublicConsult`, `showAccessModal`); adicionar mecanismo de scroll até a grid de adoção para o CTA "Quero adotar" do hero.
4. Atualizar `styles.css`: remover os blocos listados em "Código a remover"; adicionar novas classes para hero claro, stats, pills fixos, footer, usando a paleta verde/bege do mockup v4.
5. Revisar os breakpoints mobile (1120px/720px) para o novo layout de coluna única (deve simplificar bastante, já que não há mais grid 2 colunas para colapsar).
6. Rodar `npm run typecheck` e `npm run build`.
7. Verificar visualmente em pelo menos 3 larguras (mobile ~390px, tablet ~900px, desktop ~1440px) via screenshot headless, confirmando ausência de overflow e que o nav do topbar continua funcional.

## Regras de negócio identificadas

- O fluxo público de castração continua sem exigir login (`GUEST_USER`).
- Solicitações, Prontuário e Credenciamento devem continuar acessíveis a partir da home (agora via nav, não mais via big-action buttons) — regressão funcional a evitar.
- O município selecionado deve permanecer sempre visível (chip no topbar, já implementado, não deve ser tocado).
- A grid de adoção deve mostrar apenas animais reais disponíveis (`adoptionAnimals` filtrado por status), nunca cards fixos/vazios de preenchimento.

## Regras multi-tenant e segurança

- Nenhuma mudança em autenticação/autorização.
- `municipalities`/`adoptionAnimals` já chegam filtrados por município via backend — sem alteração nesse contrato.
- Nenhum endpoint novo.

## Validações necessárias

- Nenhuma validação de formulário nova.

## Testes necessários

### Frontend

- Verificação manual em browser: hero (CTAs → scroll/`onPublicRequest`) → stats (zeradas) → filtro Todos/Cães/Gatos → grid de adoção (só animais reais) → modal de interesse → nav (Solicitações/Prontuário/Credenciamento/Entrar) → responsivo mobile/tablet/desktop.

### Backend

Não aplicável.

### E2E

Não há suíte E2E neste projeto.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Remover a sidebar de ações sem religar Solicitações/Prontuário/Credenciamento ao nav seria uma regressão funcional real — tratado como obrigatório neste plano, não opcional.
- Fluxo real de deploy deste projeto é commit direto em `main` (sem `staging`/PR, confirmado pela skill `finalizar`), diferente do que o `/AGENT.md` genérico descreve — seguir o fluxo real.
- Há 7 commits locais pendentes de push (bloqueados por permissão no GitHub) de rodadas anteriores desta sessão; este trabalho vai empilhar mais commits locais até isso ser resolvido pelo usuário.
- Risco de regressão mobile ao remover os breakpoints antigos — mitigado testando em 3 larguras via screenshot antes de finalizar.
- Paleta verde é uma reversão da decisão anterior (que pedia manter azul) — já confirmada explicitamente pelo usuário para esta rodada.

## Perguntas em aberto

Todas resolvidas com o usuário em 2026-07-23:

1. Paleta de cor: **usar a paleta literal do mockup v4** (verde/bege), abandonando a regra anterior de "só azul" para esta versão.
2. Imagem do hero: **foto real de um animal disponível para adoção** (dado dinâmico já existente), já que o projeto não tem asset estático equivalente.
3. Estatísticas: **criar a UI, mas com valores zerados** (`0`), sem dados fictícios nem wiring de backend.
4. Filtro de espécie: **adotar o modelo fixo do mockup** ("Todos/Cães/Gatos"), não mais o filtro dinâmico por espécie do banco.
5. "Denunciar": **decorativo por enquanto**, sem ação.
6. Grid de adoção: **sem link "ver todos"**; mostra só animais reais disponíveis, nunca cards vazios/fixos de preenchimento.

Nenhuma pergunta em aberto restante.

## Critérios de aceite do plano

- Home bate visualmente com a estrutura do mockup v4 (topbar, hero claro com CTAs e foto real, stats zeradas, filtro Todos/Cães/Gatos, grid de adoção, rodapé).
- Solicitações, Prontuário, Credenciamento e Entrar continuam 100% funcionais a partir do nav da home.
- Nenhum CSS/JSX órfão da versão anterior (2 colunas/sidebar) permanece no código.
- `npm run typecheck` e `npm run build` passam sem novos erros.
- Chip de município permanece sempre visível.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto; ele **substitui** o plano anterior `redesign-home-publica-mockup.md` para a home pública — não misturar as duas estruturas.
- Remover ativamente o código listado em "Código a remover" — não deixar classes/JSX órfãos "só por precaução".
- Religar Solicitações/Prontuário/Credenciamento ao nav do topbar é obrigatório, não opcional (evita regressão funcional).
- Não criar nenhuma rota/página nova para "ver todos os animais" — não há destino real hoje.
- Usar a paleta verde/bege literal do mockup v4 (não os tokens azuis da versão anterior).
- Manter as alterações em `App.tsx` restritas aos 3 componentes listados (`LoginView`, `PetWelcomeArt`, `AdoptionCarousel`).
- Seguir o fluxo real de git deste projeto (commit direto em `main`, sem `staging`/PR).
- Rodar `npm run typecheck` e `npm run build`, além de verificação visual em 3 larguras, antes de considerar a implementação concluída.
- Não fazer commit/push automaticamente — isso é responsabilidade da skill `finalizar`, a ser chamada pelo usuário quando quiser.
