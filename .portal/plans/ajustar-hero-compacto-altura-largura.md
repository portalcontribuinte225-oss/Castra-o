# Plano de Implementação: Ajustar altura e largura de texto do hero compacto (rail lateral)

## Origem

- Arquivo de especificação: sem `.md` externo — pedido direto do usuário no chat, com screenshot mostrando o hero compacto (`.public-hero--compact`) na coluna lateral esquerda quando um serviço público está aberto (ex: "Solicitar procedimento")
- Data do planejamento: 2026-07-28
- Classificação: `frontend-only`

## Resumo

Quando um serviço público está aberto (`activePublicService` truthy em `LoginView`), o hero (`PetWelcomeArt`) renderiza em modo compacto (`.public-hero--compact`) dentro de `.public-service-rail`, uma coluna lateral esquerda fixa (`position: sticky`) ao lado do formulário. Hoje esse card força `height: 100%` de um container com `height: calc(98vh - var(--public-header-height) - 16px)` — ou seja, tenta preencher quase toda a altura da viewport, independentemente do quanto de conteúdo (título, subtítulo, botões) realmente existe. Isso cria um vão vazio grande entre os botões e a imagem (`.hero-art`, ancorada no fundo via `position: absolute; bottom: 0`) quando o texto é curto, como mostrado na screenshot do usuário. Além disso, o texto (`.public-hero--compact .hero-content`, `max-width: 360px`) quebra em 3 linhas mesmo havendo mais largura disponível na coluna.

Este plano ajusta o card para se adequar à altura do seu próprio conteúdo (sem o vão vazio forçado pela viewport) e aumenta a largura de texto disponível, mantendo a imagem como elemento visual da parte inferior do card.

## Escopo

### Dentro do escopo

- `.public-hero--compact`: parar de forçar `height: 100%`/`min-height: 100%` a partir de um container de altura quase-viewport; o card deve ter altura definida pelo seu conteúdo (texto + botões + imagem em proporção adequada), com a altura da coluna (`.public-service-rail`) atuando no máximo como teto (`max-height`), não como altura obrigatória.
- Repensar o posicionamento de `.public-hero--compact .hero-art`: hoje é `position: absolute; bottom: 0; height: 43%` do pai — como o pai passará a ter altura por conteúdo (não mais fixa em vh), a imagem precisa de uma estratégia que não dependa de o pai ter altura predefinida (ex: `position: relative`/fluir no fluxo normal do card, com uma altura própria fixa ou proporcional à largura, em vez de percentual da altura do pai).
- `.public-hero--compact .hero-content`: aumentar `max-width` (hoje 360px) para aproveitar melhor a largura disponível da coluna (`minmax(280px, 3fr)` do grid `.public-service-workspace`), reduzindo quebras de linha desnecessárias no título.
- `.public-service-rail`: revisar `height`/`max-height` fixos em `calc(98vh - ...)` — ajustar para que sirvam como limite máximo (permitindo scroll interno se o conteúdo real for maior), não como altura forçada que o hero precisa preencher.
- Validar visualmente (ou pela leitura do CSS resultante) que o comportamento `position: sticky` da rail continua correto durante o scroll da coluna do formulário ao lado, sem sobreposição ou corte de conteúdo.
- Validar que a mudança funciona em todos os fluxos de serviço público que usam essa rail (cadastro/"Solicitar procedimento", credenciamento, denúncia, consulta por chave de validação) — não é exclusivo do formulário de cadastro.

### Fora do escopo

- O hero completo/não-compacto da home pública (`PetWelcomeArt` sem `className="public-hero--compact"`) — já ajustado em trabalho anterior desta sessão (`padding-right`/`max-width` do `.hero-content` base), não faz parte deste plano.
- Qualquer mudança de conteúdo/texto do hero (título, subtítulo, textos dos botões).
- Qualquer mudança no formulário (`NewRequest`) ou nos outros componentes renderizados dentro de `.public-service-panel`.
- O trabalho pendente de outra sessão paralela já identificado em `src/App.tsx`/`src/styles.css` (cards de adoção `.adoption-card-modern`) — não tocar.

## Leitura de contexto

- `/AGENT.md` (raiz) — mesmo contexto de planos anteriores nesta sessão: template genérico staging/PR; prática real do projeto é commit direto em `main`.
- `frontend/AGENT.md` / `backend/AGENT.md` — não existem neste repo.
- Estrutura atual investigada em `src/styles.css`:
  - `.public-service-workspace` (~21785-21793): grid de 2 colunas (`minmax(280px, 3fr) minmax(0, 7fr)`), coluna esquerda é a rail, direita é o painel do serviço.
  - `.public-service-rail` (~21795-21804): `position: sticky`, `height`/`max-height: calc(98vh - var(--public-header-height) - 16px)`, `overflow: hidden`.
  - `.public-hero--compact` (~21806-21816): `width/height/min-height/max-height: 100%` (preenche o pai inteiro), `padding`, `border-radius`, `overflow: hidden`.
  - `.public-hero--compact .hero-content` (~21818-21821): `max-width: 360px`.
  - `.public-hero--compact .hero-title` (~21823-21825): `font-size` responsivo, não é a causa da quebra de linha (a causa é a largura do container).
  - `.public-hero--compact .hero-actions`/`.hero-cta` (~21827-21835): botões empilhados verticalmente, `width: min(260px, 100%)`.
  - `.public-hero--compact .hero-art` (~21837-21849): `position: absolute; top:auto; left:0; right:0; bottom:0; height:43%` do pai — depende do pai (`.public-hero--compact`) ter altura definida para calcular os 43%.
  - Breakpoint responsivo relacionado em ~22485-22510 (`@media` ajustando `.public-service-rail`/`.public-hero--compact`/`.hero-art`/`.hero-actions` para telas menores) — precisa ser revisado em conjunto para não quebrar o comportamento mobile já existente.
- `src/App.tsx`: `PetWelcomeArt` (função compartilhada entre hero completo e compacto) é renderizado com `className="public-hero--compact"` dentro de `.public-service-rail`, dentro de `.public-service-workspace`, quando `activePublicService` está definido em `LoginView` — usado por todos os serviços públicos (procedure_form, credential, report, consulta), não só o cadastro.

## Impacto por área

### Frontend

- **`src/styles.css`**: ajustes de altura/layout em `.public-service-rail`, `.public-hero--compact`, `.public-hero--compact .hero-art`, `.public-hero--compact .hero-content`, e revisão do breakpoint responsivo correspondente. Sem mudança de JSX — `PetWelcomeArt` já é reaproveitado como está, é puramente CSS.
- Sem impacto em hooks de rede, React Query, formulários — é ajuste visual/estrutural de CSS.
- Sem mudança de estados de loading/error/empty.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css` — blocos `.public-service-rail`, `.public-hero--compact` e correlatos (~21785-21849), e o breakpoint responsivo (~22485-22510).

## Estratégia de implementação

1. Reconfirmar com grep as linhas atuais de todos os blocos listados (podem ter deslocado desde este levantamento).
2. Ajustar `.public-service-rail`: trocar `height` fixo por `max-height` (mantendo o valor atual como teto), permitindo que a altura real seja definida pelo conteúdo até esse limite.
3. Ajustar `.public-hero--compact`: remover `height: 100%`/`min-height: 100%` forçados; manter `max-height: 100%` (herdando o teto da rail) para não estourar em telas baixas, mas permitir altura menor quando o conteúdo for menor.
4. Reestruturar `.public-hero--compact .hero-art`: sair de `position: absolute` ancorada em `bottom: 0` de um pai com altura fixa, para uma abordagem que funcione com altura por conteúdo — ex.: `position: relative`, fluindo após `.hero-content` no documento, com uma altura própria (fixa em px/clamp, ou proporcional via `aspect-ratio`), preservando a máscara de gradiente (`mask-image`) já existente para a transição suave com o texto.
5. Aumentar `.public-hero--compact .hero-content` `max-width` para melhor aproveitar a largura da coluna (valor a calibrar visualmente, maior que os 360px atuais).
6. Revisar o breakpoint responsivo (~22485-22510) para garantir que a versão mobile/tablet continue coerente com a nova estrutura (não deve haver dois sistemas de altura conflitantes entre desktop e mobile).
7. Rodar grep de `.public-hero--compact`/`.hero-art`/`.public-service-rail` no arquivo inteiro para confirmar que não sobrou nenhuma regra antiga competindo com a nova abordagem de altura.
8. Rodar `typecheck` e `build`; validar visualmente (ou pela leitura do resultado) o comportamento em pelo menos dois fluxos de serviço público (ex: "Solicitar procedimento" e "Consultar/credenciamento") para confirmar que a rail não quebra em nenhum deles.

## Regras de negócio identificadas

Nenhuma regra de negócio nova — é ajuste de layout/CSS, sem alterar dado ou comportamento funcional.

## Regras multi-tenant e segurança

Sem impacto — não há dado de tenant/permissão envolvido, é reorganização visual de um componente de apresentação já existente.

## Validações necessárias

- Confirmar que o card do hero compacto não deixa mais vão vazio grande quando o texto é curto.
- Confirmar que o card não ultrapassa a altura disponível da coluna em nenhum breakpoint (a queixa original era justamente "não pode usar mais área que a tela").
- Confirmar que a imagem (`.hero-art`) continua com boa proporção visual e a máscara de transição continua suave após a reestruturação de posicionamento.
- Confirmar que `.public-service-rail` (sticky) continua se comportando corretamente durante o scroll da coluna do formulário.
- Confirmar visualmente em pelo menos 2 dos 4 fluxos de serviço público que usam esta rail.

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

- A reestruturação do posicionamento de `.hero-art` (de `absolute`/altura percentual do pai para uma abordagem baseada em conteúdo) é a parte estruturalmente mais delicada — requer atenção para não quebrar a máscara de gradiente/transição visual já existente entre texto e imagem.
- Mudança afeta a rail usada por **todos** os serviços públicos (cadastro, credenciamento, denúncia, consulta), não só o formulário de cadastro — validar em mais de um fluxo antes de considerar concluído.
- `.public-service-rail` é `position: sticky` — qualquer erro na cadeia de alturas pode fazer a rail "grudar" incorretamente ou cortar conteúdo durante o scroll.
- Revisar também o breakpoint responsivo (~22485-22510) para não deixar dois sistemas de altura (mobile vs desktop) desalinhados após a mudança.
- Push é direto em `main`, sem `staging` — qualquer regressão visual é imediatamente visível em produção.
- Possível colisão com trabalho de outra sessão paralela em `src/styles.css` — usar a mesma técnica de isolamento (stash/patch parcial) já usada nesta sessão antes de qualquer commit.

## Perguntas em aberto

- Quando o card ficar mais baixo (altura por conteúdo, sem preencher toda a viewport), o espaço que sobrar abaixo dele na coluna deve ficar simplesmente vazio (a rail fica mais curta que o formulário ao lado, que é mais longo) — confirmado pelo usuário como aceitável ao aprovar este plano; nenhuma ação adicional prevista para preencher esse espaço.

## Critérios de aceite do plano

- O hero compacto não deixa mais vão vazio grande entre os botões e a imagem quando o texto é curto.
- O texto usa mais largura horizontal disponível na coluna, quebrando em menos linhas.
- O card nunca ultrapassa a altura disponível da tela/coluna (sem overflow vertical forçado).
- A rail (`position: sticky`) continua funcionando corretamente durante o scroll.
- Comportamento validado em pelo menos 2 fluxos de serviço público diferentes.
- `typecheck` e `build` passam sem novos erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não executar migrations (não aplicável).
- Reconfirmar linhas atuais com grep antes de editar.
- Isolar as próprias edições de qualquer trabalho não commitado de outra sessão presente no mesmo arquivo (mesma técnica de stash/patch parcial já usada nesta sessão), antes de qualquer commit via skill `finalizar`.
- Testar/validar visualmente em mais de um fluxo de serviço público antes de considerar concluído — este componente é compartilhado, não exclusivo do formulário de cadastro.
- Seguir a regra de comunicação silenciosa da skill `implementar`.
