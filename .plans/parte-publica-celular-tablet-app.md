# Plano de Implementação: Parte pública no celular, tablet e app

## Origem

- Arquivo de especificação: nenhum `.md`. A base é a revisão visual da parte pública feita em 2026-11-23 (Chrome headless em 320×568, 360×740, 390×844, 768×1024, 1024×768 e celular deitado 740×360; Safari de iPhone para o aviso de instalar) e as decisões do usuário na mesma conversa.
- Data do planejamento: `2026-11-23`
- Classificação: `frontend-only` (CSS, React e `index.html`; sem backend, sem banco, sem migration)
- Linhas citadas: estado do `main` em `b9bc209`. Conferir antes de editar, porque podem ter mudado.

---

## Resumo

No celular, o cabeçalho público é fixo e tem altura fixa (132px até 820px), mas o conteúdo dele varia. Com o município escolhido, os 5 botões (Solicitar procedimento, Acompanhar solicitação, Credenciamento, Denunciar, Entrar) vão para uma segunda coluna fora da tela, e o cabeçalho cobre o título da página.

Cabeçalho (z-index 1000) e rodapé fixo (950) ficam acima das janelas (300). No celular, o X da janela do animal não recebe o toque, e o rodapé cobre o fim das páginas e o botão "Instalar aplicativo".

O formulário de solicitação tem rolagem interna e no celular sobram de 170px a 340px para preencher. Celular deitado fica inutilizável. O botão padrão nunca quebra o texto, o que sobrepõe os botões da etapa Animal e estica o calendário.

O plano:
- põe o cabeçalho no fluxo da página, com menu ☰ no celular;
- leva o rodapé para o fim da página no celular;
- corrige as camadas;
- faz o formulário rolar como página no celular, com Voltar/Próximo presos embaixo;
- tira o `nowrap` do botão padrão;
- faz o voltar do Android fechar a última camada aberta;
- ajusta os itens leves;
- corrige o painel interno entre 761 e 1120px.

---

## Escopo

### Dentro do escopo

"Celular" neste plano é a condição `(max-width: 820px), (max-height: 480px)`, a mesma que o CSS já usa e que inclui o celular deitado.

1. Camadas (z-index) do cabeçalho e do rodapé públicos abaixo das janelas, do painel lateral, da lista de municípios e do aviso de instalar.
2. Cabeçalho público no fluxo da página: `sticky` no computador; no celular, uma linha com a marca e o botão ☰, rolando junto com a página.
3. Menu ☰ no celular, usando o `SidePanel` existente, com os 4 serviços e "Entrar".
4. Rodapé público no fim da página no celular; no computador continua fixo.
5. Formulário de solicitação no celular rolando como página, com a barra Voltar/Próximo presa embaixo, as ações da etapa Animal em linha própria e a saída com o rótulo "Voltar ao início".
6. Serviços abrindo no topo, com o formulário primeiro: sem a imagem lateral até 1100px e com volta ao topo ao abrir, fechar e concluir.
7. Botão padrão sem `whitespace-nowrap`, com `nowrap`/`shrink-0` só onde a linha não pode quebrar.
8. Células da agenda sem quebra no meio da palavra.
9. Campos com 16px em telas de toque (evita o zoom do iPhone/iPad), inclusive campos sem `type`.
10. Voltar do Android ou do navegador fecha a última camada aberta (janela, menu, etapa, serviço) antes de sair do site ou do app.
11. Itens leves:
    - área de toque do "trocar"/"Município";
    - rótulo dos contadores da home em 12px;
    - `textarea` com a fonte do sistema;
    - Poppins removida;
    - aviso de instalar só na página inicial.
12. Painel interno entre 761 e 1120px: o conteúdo deixa de ficar espremido em 254px.

### Fora do escopo

- Tabelas "só para leitor de tela" do Dashboard (`.dash-sr-only` em `<table>`), que alargam a página interna para 466px no celular.
- Outros conflitos de classe do botão além do `nowrap`: `px`, tamanho da fonte e `gap` passados por `className` perdem para o estilo base, pela ordem do CSS gerado. Ficam para a migração Tailwind + shadcn com `cn()`.
- Contadores da home fixos em 0 no código (`value={0}` em `public-metrics.tsx`).
- Área do tutor logado, que não foi revisada.
- Rodapé fixo no computador quando quebra em duas linhas (endereço longo entre 821 e 1100px).
- Trocar a fonte do sistema (Aptos/Segoe UI, que no celular cai na fonte do aparelho).
- Barra inferior e demais telas do painel interno, além do item 12.

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md`
- `src/App.tsx`: `LoginView` (cabeçalho, serviços, rodapé), `NewRequest` (etapas), `AdoptionCarousel` (janela do animal), `PwaInstallPrompt`, `usesMobileMenu`
- `src/styles.css`: `.login-page`, `.public-topbar`, `.public-home-footer`, `.public-service-workspace/rail/panel`, `.login-page--request`, `.nr-shell/.nr-body`, `.modal-backdrop`, `.pwa-install-banner`, `.calendar-day-button`, regra de 16px, `.app-shell`
- `src/components/button.tsx`, `side-panel.tsx`, `modal-focus.ts`, `ui.tsx` (`Metric`)
- `src/features/request-steps/request-form-layout.tsx`, `request-stepper.tsx`, `request-steps.test.ts`
- `src/features/schedule-picker/public-schedule-picker.tsx`
- `src/features/public-home/hero-card.tsx`, `public-metrics.tsx`
- `src/features/adoption-share/use-shared-adoption.ts`
- `src/features/tutor-access/auth-entry.tsx`
- `index.html`, `public/manifest.webmanifest`, `public/sw.js`

---

## Impacto por área

### Frontend

**1. Camadas**
- `.public-topbar` ([styles.css:498](../src/styles.css#L498)): z-index de 1000 para 70.
- `.public-home-footer` ([styles.css:366](../src/styles.css#L366)): z-index de 950 para 60.
- Escala resultante:
  - conteúdo ≤ 50 (lista de procedimentos 40, lista de meses 50);
  - rodapé 60, cabeçalho 70, aviso de instalar 80;
  - lista de municípios 200/201, painel lateral 210/211;
  - janelas 300 (`.modal-backdrop`, `AuthEntry`, gaveta da adoção), avisos 99999.
- Mudar só as duas regras que decidem, sem regra por cima.

**2. Cabeçalho no fluxo**
- `.public-topbar` deixa de ser `position: fixed` e passa a `position: sticky; top: 0`, com `min-height: var(--public-header-height)` (76px) no lugar de `height`.
- Sai a reserva `padding-top` do `.login-page`. A variável `--public-header-height` continua para a faixa lateral e o card de sucesso no computador.
- Celular:
  - cabeçalho em linha: marca à esquerda (`min-width: 0`), botão ☰ à direita (sem encolher);
  - `position: static`, rolando junto com a página;
  - nome da secretaria (`.public-topbar-department`) em uma linha com reticências;
  - nome do município pode ocupar até duas linhas.
- `.public-topbar-brand .municipality-chip-btn` ([styles.css:562](../src/styles.css#L562)): área de toque com `min-height: 32px` (hoje 18px), mesmo visual de link.
- O cabeçalho tem `backdrop-filter`: elementos `fixed` dentro dele ficam presos à caixa do cabeçalho. Por isso o painel do ☰ precisa ser renderizado fora do cabeçalho.

**3. Menu ☰**
- Novo `src/components/use-media-query.ts`:
  - `useMediaQuery(query): boolean`, com `matchMedia` e o evento `change`;
  - o painel interno passa a usá-lo no lugar do efeito próprio de `usesMobileMenu` ([App.tsx:413-441](../src/App.tsx#L413-L441));
  - o fechamento do menu ao sair do modo celular continua num efeito do App.
- Novo `src/features/public-home/public-services-menu.tsx`:
  - botão "Menu" (ícone `Menu` do lucide, `aria-haspopup="dialog"`, `aria-expanded`) e o `SidePanel` com título "Menu";
  - itens com `Button variant="menu"`, largura total e os mesmos ícones: os 4 de `publicHomeServices` (o ativo com `aria-current`) e "Entrar";
  - escolher um item fecha o painel e abre o serviço (ou o login).
- `LoginView` mostra o `nav` atual só fora do celular e o menu ☰ só no celular, decidido por `useMediaQuery`. O nav não é renderizado no celular (não é ocultação por CSS).

**4. Rodapé**
- No celular: `.public-home-footer` com `position: static` e `margin-top: auto`, para ficar embaixo quando a página é curta. O `.login-page` fica sem a reserva `padding-bottom`.
- No computador: continua fixo (z-index 60), com a reserva atual.
- O rodapé passa a vir depois do formulário também no modo solicitação.

**5. Formulário de solicitação no celular** (`.login-page--request`)
- Rolagem de página:
  - `height: auto; min-height: 100dvh` no lugar de `height: 100dvh`;
  - `.public-service-workspace` com `flex: none`;
  - `.nr-shell` sem `overflow: hidden` ([styles.css:1378](../src/styles.css#L1378)) só neste contexto;
  - `.nr-shell--public .nr-body` sem rolagem própria (`flex: none; overflow: visible`).
- `RequestFormLayout` ([request-form-layout.tsx](../src/features/request-steps/request-form-layout.tsx)):
  - barra "Navegação da solicitação" presa embaixo (`sticky; bottom: 0`) no celular, só quando `internal` for falso, com fundo da página, z-index 30 e espaço da área segura (`env(safe-area-inset-bottom)`);
  - ao trocar de etapa, fora da equipe, `window.scrollTo({ top: 0 })` quando a página estiver rolada;
  - ações extras: com o container `request-form` (já declarado em `.nr-shell--public`) abaixo de 520px, as ações vêm numa linha própria, meio a meio, e Voltar/Próximo na linha de baixo;
  - botão de saída com `tw:shrink-0`.
- `App.tsx:1856`: sai o `backLabel="Voltar"`, e o formulário público usa o padrão "Voltar ao início", como os outros serviços. Assim deixam de existir dois "Voltar" com ações diferentes.
- A lista de procedimentos (`multi-select-panel`, z-index 40) passa a abrir sobre o conteúdo da página, não dentro de uma área de rolagem pequena.

**6. Serviços no topo**
- A regra `@media (max-width: 1100px), (max-height: 480px)`, que hoje vale só para `.login-page--request`, passa a valer para todos os serviços:
  - `.public-service-workspace` em uma coluna;
  - `.public-service-rail` não aparece (a imagem lateral).
- Juntar a regra de largura e margem do `.public-service-workspace` de 980px nessa regra.
- A faixa `@media (max-width: 1180px) and (min-width: 981px)` passa a `min-width: 1101px`.
- `openPublicService`, `joinMutirao`, `openRequestAccess`, `closePublicService` e a conclusão (`setPublicServiceDone`, no `onDone` do formulário e no envio da denúncia) chamam `window.scrollTo({ top: 0 })`.

**7. Botão padrão** ([button.tsx](../src/components/button.tsx))
- Sai `tw:whitespace-nowrap` do `buttonStyle`; `tw:leading-none` passa a `tw:leading-tight`.
- Por que é preciso: no Tailwind gerado, entre classes da mesma propriedade, vale a que vem depois no CSS (ordem alfabética), não a ordem no `className`. `whitespace-nowrap` vem depois de `whitespace-normal` e sempre vencia (conferido no `dist`).
- Saem os `tw:whitespace-normal` que ficam redundantes:
  - [App.tsx:2801](../src/App.tsx#L2801) (`animalActionStyle`);
  - [App.tsx:2904](../src/App.tsx#L2904);
  - [public-schedule-picker.tsx:184](../src/features/schedule-picker/public-schedule-picker.tsx#L184);
  - [public-schedule-picker.tsx:133](../src/features/schedule-picker/public-schedule-picker.tsx#L133) (lista de meses interna);
  - [active-filters-bar.tsx:24](../src/features/request-filters/active-filters-bar.tsx#L24);
  - [process-header.tsx:51](../src/features/process-modal/process-header.tsx#L51);
  - [dashboard-view.tsx:80](../src/features/dashboard/dashboard-view.tsx#L80) (`tw:max-[900px]:whitespace-normal`).
- Varredura dos cerca de 200 `<Button>`: os que ficam em linha que não quebra (flex sem `wrap`, faixa com rolagem lateral, abas, barra de ferramentas) e não podem quebrar o rótulo recebem `tw:shrink-0` (preferível) ou `tw:whitespace-nowrap`.
- Em linha flex com `wrap`, os itens continuam indo inteiros para a linha de baixo, porque a quebra usa a largura sem quebrar o texto. Só um item maior que a linha passa a quebrar o texto, que é o desejado.

**8. Agenda** ([public-schedule-picker.tsx](../src/features/schedule-picker/public-schedule-picker.tsx))
- No dia com vagas, o `<small>` mostra horário e "N vagas" em duas partes empilhadas.
- `.calendar-day-button small` ([styles.css:1636](../src/styles.css#L1636)): `overflow-wrap: anywhere` passa a `normal`.
- O mesmo componente atende o modo interno e o reagendamento. Conferir que nada muda além da quebra.

**9. Campos com 16px**
- A regra de [styles.css:4161-4173](../src/styles.css#L4161-L4173) sai do `@media (max-width: 720px)` e passa a `@media (max-width: 720px), (pointer: coarse)`.
- O seletor passa a incluir `input` sem `type`. Hoje Nome, CPF, CEP, Número, UF, Endereço, Bairro e Cidade da Denúncia e os campos do Acompanhar ficam em 14px.
- O `!important` dessa regra já existe; nenhum novo.

**10. Voltar do Android ou do navegador**
- Novo `src/features/public-navigation/back-stack.ts`: lógica pura, com o histórico injetável (`pushState`, `go`, `state`) para testar sem DOM. Regras:
  - cada camada ativa guarda exatamente uma entrada (`pushState` com uma marca própria no `state`);
  - o voltar (`popstate`) chama o `onBack` da camada dona da entrada que saiu;
  - camada que continua ativa depois do `onBack` (ex.: a etapa, que só voltou uma) guarda uma entrada nova;
  - camada fechada pela tela (X, Voltar, escolher no menu) consome a sua entrada: as entradas que sobram no topo saem num único `history.go(-n)`, e o `popstate` gerado por isso é ignorado;
  - `popstate` de entradas que não são da pilha (ex.: avançar depois de voltar, entradas de antes de recarregar) não faz nada;
  - o `state` existente é preservado. O link de adoção (`/adocao/<id>`) e o link do código de acesso já usam `replaceState` com o `state` atual.
- Novo `src/features/public-navigation/use-back-layer.ts`: hook `useBackLayer(active, onBack)` ligado ao `window.history` e a um único ouvinte de `popstate`.
- Camadas:
  - `LoginView`: serviço aberto (`activePublicService`) → `closePublicService`; menu ☰ → fecha; login (`authEntry`) → fecha.
  - `AdoptionCarousel`: janela do animal (`selectedAnimal`) → `closeAnimalModal`. O link compartilhado que abre a janela ganha a entrada já ao carregar.
  - `NewRequest` fora da equipe (`!internalSimple`, público e tutor):
    - etapa depois da primeira → `navigateToStep` para a etapa anterior;
    - `previewDocument`, `declarationOpen` e `reusedPreview` → fecham.
- O painel interno não usa a pilha.

**11. Itens leves**
- `Metric` compacto ([ui.tsx:105](../src/components/ui.tsx#L105)): `tw:text-[0.7rem]` passa a `tw:text-xs` (12px, o menor nível da escala). Só a home usa a versão compacta.
- Regra base [styles.css:75-78](../src/styles.css#L75-L78): `button, input, select { font: inherit }` passa a incluir `textarea`. A descrição da Denúncia deixa de sair em fonte monoespaçada.
- `PwaInstallPrompt` deixa de ser renderizado ao lado do `LoginView` ([App.tsx:827](../src/App.tsx#L827)) e passa para dentro dele, só quando não há serviço aberto. Assim não cobre a barra Voltar/Próximo presa embaixo.

**12. Painel interno, 761 a 1120px**
- `grid-template-columns: 254px minmax(0, 1fr)` vai para a regra base `.app-shell` ([styles.css:117](../src/styles.css#L117)).
- Sai a regra solta de [styles.css:7243](../src/styles.css#L7243), que vinha depois da de 1120px e a anulava.
- A regra de [styles.css:3756](../src/styles.css#L3756) (`1fr` até 1120px) volta a decidir.
- `.app-shell.sidebar-collapsed` não é aplicada até 1120px (`sidebarIsCollapsed` exige `!usesMobileMenu`), então não interfere.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado. A Poppins deixa de ser baixada do Google Fonts. O `sw.js` não guarda essas folhas.

---

## Arquivos provavelmente afetados

- `src/styles.css`
- `src/App.tsx` _(arquivo grande: só `LoginView`, `NewRequest`, `AdoptionCarousel`, o ponto do `PwaInstallPrompt` e o `usesMobileMenu`)_
- `index.html`
- `src/components/button.tsx`
- `src/components/ui.tsx`
- `src/components/use-media-query.ts` _(novo)_
- `src/features/public-home/public-services-menu.tsx` _(novo)_
- `src/features/public-navigation/back-stack.ts` _(novo)_
- `src/features/public-navigation/use-back-layer.ts` _(novo)_
- `src/features/public-navigation/back-stack.test.ts` _(novo)_
- `src/features/request-steps/request-form-layout.tsx`
- `src/features/request-steps/request-steps.test.ts`
- `src/features/schedule-picker/public-schedule-picker.tsx`
- `src/features/request-filters/active-filters-bar.tsx`
- `src/features/process-modal/process-header.tsx`
- `src/features/dashboard/dashboard-view.tsx`
- os arquivos com `<Button>` em linha que não quebra encontrados na varredura do passo 7

---

## O que será removido

**`index.html`**
- os dois `<link rel="preconnect">` do Google Fonts;
- o `<link>` da folha da Poppins.

**`src/styles.css`, parte pública**
- `.login-page`: `padding-top: var(--public-header-height)` (regra base).
- `@media (max-width: 720px)`: `.login-page { padding: 10px }` e, no `.public-topbar`, o `flex-wrap: wrap` e o `padding` desse bloco (substituídos pelo layout do item 2).
- `@media (max-width: 420px)`: `.login-page { padding: 8px }`.
- `@media (max-width: 820px)`:
  - `--public-header-height: 132px` e `--public-footer-height: 92px`;
  - no `.public-topbar`: `height: var(--public-header-height)`, `flex-direction: column` e `align-items: stretch`;
  - `.public-topbar-nav { justify-content: flex-start }`.
- `.login-page--request > .public-topbar { position: sticky; min-height: var(--public-header-height); z-index: 3 }`, redundante com o cabeçalho `sticky` na regra base.
- `@media (max-width: 820px), (max-height: 480px)`: as regras de `.login-page--request .public-topbar-nav` (rolagem lateral, `nowrap`, `max-width`, `padding-block`, `scrollbar-width`), porque o nav não existe no celular.
- `@media (min-width: 560px) and (max-height: 480px)`: `.login-page--request > .public-topbar { flex-flow: row nowrap; align-items: center }` e `.login-page--request .public-topbar-brand { flex: 0 0 auto; max-width: 42% }`, substituídos pelo cabeçalho em linha do item 2.
- `@media (max-width: 980px)`:
  - `.public-service-rail { position: static; height: auto; max-height: none }`, porque a faixa não aparece até 1100px;
  - a regra `.public-service-workspace` desse bloco, juntada à regra de 1100px do item 6.

**`src/styles.css`, painel interno**
- `.app-shell { grid-template-columns: 254px minmax(0, 1fr); }` solto em [7243](../src/styles.css#L7243) (o valor vai para a regra base).
- `.app-shell { grid-template-columns: 1fr; }` dentro do `@media (max-width: 760px)`, que fica redundante com o de 1120px.

**`src/App.tsx`**
- as constantes `scrollableMenuButton`, `serviceButtonLayout` e `enterButtonLayout` e o uso delas nos botões do nav;
- o efeito próprio do `usesMobileMenu` (substituído por `useMediaQuery`);
- `backLabel="Voltar"` no `NewRequest` público;
- `tw:whitespace-normal` em `animalActionStyle` (2801) e em 2904;
- o `<PwaInstallPrompt />` ao lado do `LoginView` (passa para dentro dele).

**Demais arquivos**
- `src/components/button.tsx`: `tw:whitespace-nowrap` e `tw:leading-none` do `buttonStyle` (este troca por `tw:leading-tight`).
- `src/features/schedule-picker/public-schedule-picker.tsx`: `tw:whitespace-normal` nas linhas 133 e 184.
- `src/features/request-filters/active-filters-bar.tsx`: `tw:whitespace-normal`.
- `src/features/process-modal/process-header.tsx`: `tw:whitespace-normal`.
- `src/features/dashboard/dashboard-view.tsx`: `tw:max-[900px]:whitespace-normal`.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. **Camadas:** z-index do cabeçalho (70) e do rodapé (60) nas regras que decidem.
2. **Cabeçalho:**
   - `sticky` no computador; tirar as reservas de `padding` do `.login-page` e os blocos de 720, 420 e 820px listados para remoção;
   - layout em linha no celular, `static`, secretaria em uma linha;
   - área de toque do "trocar".
3. **Hook `useMediaQuery`:** criar e trocar o `usesMobileMenu` por ele, mantendo o fechamento do menu interno ao sair do modo celular.
4. **Menu ☰:** criar `public-services-menu.tsx` com o `SidePanel`, renderizado fora do cabeçalho. No `LoginView`: nav fora do celular, ☰ no celular. Apagar `scrollableMenuButton`, `serviceButtonLayout` e `enterButtonLayout`.
5. **Rodapé:** `static` no celular, sem reserva; fixo no computador.
6. **Serviços:** generalizar a regra de 1100px (uma coluna, sem a faixa lateral); ajustar a faixa de 1180px; apagar a regra de 980px; `window.scrollTo({ top: 0 })` ao abrir, fechar e concluir.
7. **Formulário no celular:** rolagem de página no modo solicitação; no `RequestFormLayout`, barra presa embaixo (só fora da equipe), topo ao trocar de etapa, ações em linha própria abaixo de 520px, saída com `shrink-0`; apagar o `backLabel="Voltar"`.
8. **Botão padrão:** tirar `whitespace-nowrap`, trocar `leading-none` por `leading-tight`, apagar os `whitespace-normal` redundantes e varrer os `<Button>` em linhas que não quebram.
9. **Agenda:** horário e vagas em duas partes; `overflow-wrap: normal`.
10. **Campos com 16px:** mover a regra para `(max-width: 720px), (pointer: coarse)` e incluir `input` sem `type`.
11. **Pilha do voltar:** criar `back-stack.ts` com os testes, depois `use-back-layer.ts`, e ligar as camadas na ordem: janela do animal, login, menu ☰, prévias e declaração, etapa, serviço.
12. **Itens leves:** rótulo do `Metric` compacto, `textarea` na regra `font: inherit`, Poppins fora do `index.html`, `PwaInstallPrompt` dentro do `LoginView` só sem serviço aberto.
13. **Painel interno:** mover o `grid-template-columns` para a regra base `.app-shell` e apagar as duas regras listadas.
14. **Testes:** atualizar e criar (ver "Testes necessários"); rodar a validação uma vez ao final.

---

## Regras de negócio identificadas

- **Celular** = `(max-width: 820px), (max-height: 480px)`. Nele:
  - cabeçalho em linha (marca + ☰), rolando junto com a página;
  - rodapé no fim da página;
  - formulário de solicitação com rolagem de página.
- **Menu ☰:** lista os mesmos 4 serviços do nav e "Entrar", na mesma ordem. O serviço aberto aparece marcado. Escolher um item fecha o menu.
- **Computador:** cabeçalho e nav como hoje, mas no fluxo da página (`sticky`); rodapé continua fixo.
- **Camadas:** janelas, menu, lista de municípios e aviso de instalar sempre acima do cabeçalho e do rodapé.
- **Serviços até 1100px:** abrem sem a imagem lateral e no topo da página; a confirmação "Recebemos sua solicitação!" também aparece no topo.
- **Formulário:** a saída se chama "Voltar ao início", como nos outros serviços; o "Voltar" da barra volta uma etapa.
- **Voltar do celular:** fecha, nesta ordem, a janela aberta, o menu, a etapa (volta uma) e o serviço (volta para o início). Só depois sai do site ou do app. Fechar pela tela tem o mesmo efeito e não deixa voltar "morto" no histórico.
- **Aviso "Instale o aplicativo":** só na página inicial, sem serviço aberto.

---

## Regras multi-tenant e segurança

- Mudança só de apresentação e navegação no navegador; não muda nenhuma chamada à API.
- O município continua vindo da escolha na página (`selectedMunicipalityId`). A pilha do voltar não guarda dado no histórico além de uma marca da própria camada: nenhum dado pessoal, protocolo ou município vai para o `history.state`.
- Sem impacto em permissões, relatórios ou PDFs.

---

## Validações necessárias

Nenhuma validação de formulário muda. A troca de etapa pelo voltar usa o `navigateToStep` existente, que nunca valida ao voltar.

---

## Testes necessários

### Frontend

- **`back-stack.test.ts`** (novo, histórico falso). Confere que:
  - abrir uma camada guarda uma entrada;
  - o voltar chama o `onBack` só da camada de cima;
  - a camada que continua ativa depois do voltar guarda uma entrada nova;
  - fechar pela tela consome a entrada sem chamar o `onBack` de novo;
  - fechar a camada de baixo com outras abertas por cima consome todas num único `go(-n)`;
  - `popstate` de entrada alheia não faz nada;
  - o `state` alheio é preservado.
- **Menu ☰** (`renderToStaticMarkup`): botão com `aria-expanded`; com o painel aberto, os 4 serviços e "Entrar", com `aria-current` só no serviço ativo.
- **`request-steps.test.ts`**:
  - ajustar a regex da estrutura (`Campos da etapa… role="alert"… Navegação da solicitação`) ao novo HTML;
  - confirmar "Voltar ao início" na saída pública;
  - ações extras numa linha própria antes de Voltar/Próximo;
  - barra presa embaixo só sem `internal`.
- **Agenda:** o dia com vagas mostra horário e "N vagas" em partes separadas.
- **Testes existentes:** rodar todos. Ajustar os que conferem classes do botão ou textos alterados.

### Backend

Sem mudança. Rodar a suíte por regra do AGENT.md.

### Conferência manual (tela)

Quem confere é o usuário, em 320×568, 360×740, 390×844, 768×1024, 1024×768, celular deitado 740×360 e computador 1280+.

**Página inicial**
- Com e sem município: ☰ no celular e nav no computador.
- O título da imagem principal não fica embaixo do cabeçalho.
- O rodapé fica no fim no celular.

**Janelas e menu**
- Janela do animal, também pelo link `/adocao/<id>`: X e "Quero adotar" tocáveis; cabeçalho e rodapé escurecidos atrás.
- Login de equipe e de tutor.
- Menu ☰ abrindo e fechando; lista de municípios ("trocar") abrindo por cima do conteúdo.

**Serviços e formulários**
- Denúncia, Credenciamento e Acompanhar abrem com o formulário no topo.
- "Enviar denúncia" e o texto final do Acompanhar visíveis e tocáveis.
- Formulário de solicitação nas 4 etapas:
  - barra Voltar/Próximo presa embaixo;
  - etapa Animal com "Adicionar outro animal" e "Repetir os dados do anterior" legíveis;
  - lista de procedimentos inteira;
  - calendário sem cortar o sábado ao escolher um dia com mais de um local;
  - "Recebemos sua solicitação!" no topo.

**iPhone/iPad (Safari)**
- Tocar num campo não dá zoom.
- Barra presa embaixo com o teclado aberto.

**App instalado (Android)**
- O voltar fecha a janela, depois volta uma etapa, depois volta para o início, e só então sai.

**Aviso "Instale o aplicativo"**
- Inteiro e tocável na página inicial; não aparece com serviço aberto.

**Painel interno (por causa do botão e da regra de 16px)**
- Telas principais em 768 e 1280: botões sem quebra estranha.
- Entre 761 e 1120px o conteúdo ocupa a largura toda.

---

## Comandos de validação sugeridos

```bash
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

---

## Riscos e pontos de atenção

- **Botão padrão (risco médio):** a mudança alcança cerca de 200 botões, inclusive no painel interno. Rótulos podem quebrar em linhas que hoje transbordam. A varredura do passo 8 e a conferência manual interna cobrem isso.
- **Pilha do voltar (risco médio):**
  - camadas umas dentro das outras e fechamento por desmontagem (ex.: login de tutor que leva para a área do tutor);
  - não pode deixar entrada "morta" nem quebrar o link de adoção ou o link do código de acesso;
  - a lógica fica pura e testada antes de ligar nas telas.
- **Rolagem de página no formulário do celular:**
  - barra presa embaixo com o teclado do iPhone;
  - trocar de etapa precisa levar ao topo.
  - O layout com rolagem interna continua no computador e no modal da equipe.
- **`backdrop-filter` do cabeçalho:** o painel do ☰ precisa ficar fora do cabeçalho. A lista de municípios (dentro dele) usa `position: absolute` e um fundo `fixed` que hoje já fica preso ao cabeçalho; não piora.
- **Campos com 16px em toque** e **`textarea` com a fonte do sistema** também valem no painel interno (tablets e campos de texto longo). É intencional.
- **`(pointer: coarse)`:** iPad com teclado e trackpad pode relatar ponteiro fino e voltar a 14px. A regra de 720px continua.
- **Produção:** commit e push direto em `main`, sem `staging`. Publicar só com ordem do usuário.

---

## Perguntas em aberto

Nenhuma pergunta em aberto identificada. O plano foi aprovado sem resposta às três perguntas do plano preliminar; ficam assumidas as recomendações:

1. Cabeçalho no celular rola junto com a página (não fica preso no topo).
2. Nome da secretaria no cabeçalho do celular em uma linha, com reticências.
3. Aviso "Instale o aplicativo" só na página inicial, sem serviço aberto.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- **Página inicial**
  - Em 320, 360 e 390px, os 4 serviços e "Entrar" ficam acessíveis pelo ☰. Nenhum botão fica fora da tela e nada fica escondido sob o cabeçalho.
  - Em 768 e 1024px o cabeçalho não cobre o título da página.
- **Janelas**
  - Ficam acima do cabeçalho e do rodapé em todos os tamanhos. O X e os botões de ação recebem o toque (conferível com `elementFromPoint`).
- **Rodapé**
  - No celular fica no fim da página e não cobre "Enviar denúncia", o texto do Acompanhar nem o aviso de instalar.
- **Celular deitado (740×360)**
  - A página inicial e o formulário mostram conteúdo e permitem preencher.
- **Formulário de solicitação**
  - No celular rola como página e Voltar/Próximo ficam sempre visíveis.
  - Na etapa Animal, os 4 botões ficam legíveis e sem sobreposição.
  - O calendário não fica mais largo que a tela ao escolher um dia com mais de um local.
  - Em 320px, "08:00" e "N vagas" não quebram no meio da palavra.
  - A saída mostra "Voltar ao início".
- **Serviços**
  - Até 1100px, Denúncia, Credenciamento, Acompanhar e a confirmação abrem no topo, sem a imagem lateral.
- **Campos e textos**
  - Campos de texto com 16px em telas de toque e até 720px, inclusive os sem `type`.
  - A descrição da Denúncia usa a fonte do sistema.
  - Contadores da home com rótulo de 12px.
  - `index.html` sem Poppins nem Google Fonts.
- **Voltar do celular**
  - Fecha a janela, o menu, a etapa e o serviço, nessa ordem, antes de sair.
  - Fechar pela tela não deixa voltar sem efeito.
- **Painel interno**
  - Entre 761 e 1120px o conteúdo ocupa a largura toda.
- **Código e validação**
  - Tudo da seção "O que será removido" apagado.
  - Nenhum `!important` novo.
  - Typecheck, testes do front e do back e build sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita (não há migration neste plano).
- Seguir `/AGENT.md`: código novo em inglês, um arquivo por responsabilidade (por isso os arquivos novos, sem engordar o `App.tsx`), sem código morto.
- CSS: mudar a regra que decide, nunca regra por cima nem `!important` novo. Reutilizar `SidePanel`, `Button` e as variáveis `--type-*`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito. Testes e dados só com valores falsos.
- O app que o usuário abre é o `dist` servido pelo back na 3002: o front só muda depois de `npm run build`. Conferência visual fica com o usuário.
