# Plano de Implementação: Redesign da Home Pública (LoginView)

## Origem

- Arquivo de especificação: nenhum `.md` foi fornecido pelo usuário; a especificação usada foi um mockup HTML ("Sistema Municipal de Proteção Animal - standalone") compartilhado diretamente no chat, mais o mapeamento feito em conversa contra o código atual.
- Data do planejamento: 2026-07-22
- Classificação: `frontend-only`

## Resumo

Redesenhar a home pública (componente `LoginView`, hoje o ponto de entrada não autenticado do sistema) para bater com a estrutura visual do mockup anexado: topbar separada do card de login, hero escuro com CTAs e imagem, layout de 2 colunas (grid de adoção + sidebar de serviços), e cards de animal com badge/contador/CTA mais destacados.

## Escopo

### Dentro do escopo

- Nova topbar full-width (logo + nome do município + "trocar" + nav decorativo + botão "Entrar")
- Novo hero: fundo escuro, imagem de animal, 2 CTAs, sem a lista de features atual
- Layout 2 colunas: card de adoção (esquerda) + card "Bem-estar e proteção animal" com ações (direita)
- Cards de animal com badge de espécie/porte, contador de interessados, CTA "Adotar" mais forte
- Ajuste dos breakpoints mobile existentes para o novo layout

### Fora do escopo

- Qualquer alteração de backend/API
- Alteração do fluxo interno de login veterinário (modal `showVetModal`) além de religar o gatilho de abertura
- Alteração do formulário de solicitação (`NewRequest`) ou do fluxo de credenciamento (`PublicAccessRequestModal`)

## Leitura de contexto

- `/AGENT.md`
- Mockup HTML fornecido no chat (referência visual completa da nova home)
- `src/App.tsx` — componentes `LoginView` (L2102-2392), `PetWelcomeArt` (L2540-2558), `AdoptionCarousel` (L1824-2059)
- `src/styles.css` — classes `.login-page`, `.login-layout`, `.login-card`, `.login-card-topbar`, `.login-big-action`, `.public-hero`, `.adoption-showcase`, `.public-animal-card`, `.public-interest-cta`, breakpoints em L8373, L8518, L8723
- Memórias de sessão do projeto: padrão de cor público estabelecido (`--teal` mapeado para azul `#2563eb`, sem verde/teal literal em telas públicas), regra de manter o chip de município sempre visível, regra de não misturar estilos entre steps/telas públicas

Nota: este projeto não possui `frontend/AGENT.md` nem `backend/AGENT.md` separados — apenas o `/AGENT.md` da raiz, que cobre frontend e backend juntos.

## Impacto por área

### Frontend

- `LoginView`: reestruturar JSX (topbar separada do card, grid de 2 colunas, sidebar de ações); decidir destino do botão "Entrar" do novo topbar (ver perguntas em aberto)
- `PetWelcomeArt`: adicionar CTAs (`onPublicRequest`, toggle de adoção), slot de imagem de animal, remover lista de features atual
- `AdoptionCarousel`: adicionar pills "Todos/Cães/Gatos" reaproveitando `speciesQuickFilters` já existente, badge de espécie/porte no card, contador de interessados mais visível
- `styles.css`: novas classes para topbar/hero/sidebar, reaproveitando os tokens de cor já existentes (`--teal`/`--teal-dark`/`--blue`) em vez das cores literais do mockup
- Sem novos hooks, sem novas query keys (projeto não usa React Query — chamadas via `api.*` diretamente)
- Testes: verificação manual em browser (não há suíte de testes de frontend automatizada identificada para esta tela)

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

Atenção: este plano não autoriza executar migrations automaticamente (não aplicável aqui, mas mantido por padrão do template).

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx` (componentes `LoginView`, `PetWelcomeArt`, `AdoptionCarousel`)
- `src/styles.css` (blocos de estilo correspondentes + breakpoints em L8373, L8518, L8723)

## Estratégia de implementação

1. Construir a nova topbar full-width, extraindo-a de dentro do `login-card` atual, mantendo `MunicipalitySelectorChip` funcional e sempre visível.
2. Atualizar `PetWelcomeArt`: adicionar os 2 CTAs do hero, slot de imagem de animal, remover a lista de features, aplicar a paleta de cores já estabelecida.
3. Reestruturar `LoginView` em grid de 2 colunas: `AdoptionCarousel` dentro de um card próprio à esquerda; sidebar à direita com as ações (Solicitações destacado, Prontuário, Credenciamento, link discreto para Acesso restrito).
4. Atualizar os cards de animal em `AdoptionCarousel`: badge de espécie/porte sobre a foto, contador de interessados, CTA "Adotar" reforçado.
5. Revisar os breakpoints mobile existentes (L8373/8518/8723) para o novo grid de 2 colunas e para o toggle de adoção no mobile.
6. Rodar `npm run typecheck` e `npm run build`.

## Regras de negócio identificadas

- O fluxo público de castração continua sem exigir login (`GUEST_USER`).
- O município selecionado deve permanecer sempre visível na tela, em qualquer estado do layout.
- "Acesso restrito" e o novo botão "Entrar" do topbar não podem virar dois modais de login diferentes — precisa ser uma única entrada para login veterinário.

## Regras multi-tenant e segurança

- Nenhuma mudança em autenticação/autorização real; a alteração é apenas na UI do gatilho de login.
- Nenhum dado de outra prefeitura é exposto — `municipalities` e `adoptionAnimals` já chegam filtrados pelo backend por município selecionado.
- Nenhum endpoint novo é criado; não há superfície nova de ataque.

## Validações necessárias

- Nenhuma validação de formulário nova — não há formulário novo, apenas reorganização visual de componentes existentes.

## Testes necessários

### Frontend

- Verificação manual em browser: seleção de município → hero CTAs → grid de adoção com filtros → abrir modal de detalhes do animal → registrar interesse → cards de ação da sidebar (Solicitações/Prontuário/Credenciamento) → responsivo mobile

### Backend

- Não aplicável (sem impacto esperado).

### E2E

- Não há suíte E2E identificada neste projeto.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Conflito de paleta: o mockup usa teal (`#3fd6c2`) e verde (`#1f8a45`), mas a memória do projeto registra explicitamente "sem verde/teal nos formulários públicos" — o plano assume mapear essas cores para a paleta azul já estabelecida (`--teal`/`--teal-dark`/`--blue`), salvo confirmação em contrário do usuário.
- Discrepância no `/AGENT.md`: ele descreve fluxo `staging → PR → main`, mas o fluxo real deste repositório é commit direto em `main`, sem branch `staging` nem PR (confirmado pela skill `finalizar` do projeto). A implementação deve seguir o fluxo real, não o descrito no `/AGENT.md`.
- Risco de regressão visual/funcional no toggle mobile de adoção (`showMobileAdoption`) ao reestruturar o layout em 2 colunas.
- Risco de quebrar a visibilidade do chip de município durante a extração da topbar (regra crítica já reforçada por feedback anterior do usuário).

## Perguntas em aberto

Todas resolvidas com o usuário em 2026-07-22:

1. Nav "Serviços" / "Dúvidas frequentes": **decorativos por enquanto**, sem funcionalidade.
2. Botão "Entrar" do topbar: **unificado** com o modal de login veterinário já usado por "Acesso restrito" — os dois pontos de entrada abrem o mesmo `showVetModal`.
3. Paleta de cores: **manter a paleta azul já estabelecida** (`--teal`/`--teal-dark`/`--blue`) em vez do teal/verde literais do mockup, inclusive no eyebrow do hero e no CTA "Adotar".
4. Toggle mobile: **manter o comportamento atual** ("Ver animais para adoção" / "Ocultar adoção") como está hoje, sem transferir esse papel para o CTA do hero.

Nenhuma pergunta em aberto restante.

## Critérios de aceite do plano

- Home renderiza com a estrutura do mockup (topbar, hero, grid de 2 colunas) mantendo os dados dinâmicos reais (município, animais para adoção, ações).
- Nenhuma quebra no fluxo de solicitação pública, consulta de solicitações, credenciamento e login veterinário.
- `npm run typecheck` e `npm run build` passam sem novos erros.
- Chip de município permanece sempre visível em qualquer estado da tela.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto. Todas as decisões de escopo já foram confirmadas com o usuário (ver seção "Perguntas em aberto") — não reabrir essas decisões sem motivo novo.
- Botão "Entrar" do topbar deve reaproveitar o mesmo estado/handler que hoje abre `showVetModal` a partir do card "Acesso restrito" — não criar um segundo modal.
- Usar a paleta de cores já estabelecida no projeto (`--teal`/`--teal-dark`/`--blue`), não os hex literais do mockup (teal `#3fd6c2` / verde `#1f8a45`).
- Manter as alterações em `App.tsx` restritas aos 3 componentes listados (`LoginView`, `PetWelcomeArt`, `AdoptionCarousel`) — não tocar em `NewRequest`, `PublicAccessRequestModal` ou outros fluxos.
- Manter o toggle mobile de adoção (`showMobileAdoption`) com o comportamento atual, apenas adaptado ao novo layout.
- Nav "Serviços"/"Dúvidas frequentes" no topbar: renderizar como texto/spans decorativos, sem `onClick` nem navegação.
- Seguir o fluxo real de git deste projeto (commit direto em `main`, sem `staging`/PR), não o descrito genericamente no `/AGENT.md`.
- Rodar `npm run typecheck` e `npm run build` antes de considerar a implementação concluída.
