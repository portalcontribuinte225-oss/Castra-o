# Plano de Implementação: Corrigir largura do painel de adoção (coluna fantasma)

## Origem

- Arquivo de especificação: `.portal/specs/corrigir-largura-painel-adocao.md`
- Data do planejamento: `2026-07-28`
- Classificação: `frontend-only`

## Resumo

O painel de adoção interno (tela `Adoção`) tinha uma coluna lateral operacional (`Aguardando triagem`, `Visitas agendadas`, `Destaque automático`) removida em sessão anterior a pedido do usuário. O JSX e as classes CSS específicas dos cards dessa coluna foram removidos corretamente, mas um bloco de CSS residual em `src/styles.css` ainda reserva 296px de largura para essa coluna que não existe mais, deixando uma faixa de espaço vazio à direita do grid de cards e impedindo que ele ocupe a largura total da tela.

## Escopo

### Dentro do escopo

- Corrigir o `grid-template-columns` residual em `.adoption-board-layout` (linha ~23412 de `src/styles.css`) para uma única coluna.
- Confirmar que a ocorrência de `.adoption-board-layout` dentro da media query `max-width: 1180px` (linha ~23524) não precisa de ajuste adicional.
- Validar visualmente nos dois modos de visualização (grade e lista), já que ambos compartilham o mesmo container `.adoption-board-layout` / `.adoption-results-panel`.

### Fora do escopo

- Qualquer mudança no card do animal em si (foto, nome sobreposto, badge de interessados, X de excluir, botões de editar/concluir) — já ajustado em sessão anterior.
- Reintroduzir a coluna lateral removida.
- Mudanças de backend, banco de dados ou infraestrutura.
- Qualquer outra tela além do painel de adoção.

## Leitura de contexto

- `/AGENT.md`
- `.portal/specs/corrigir-largura-painel-adocao.md`
- `src/App.tsx` (JSX do painel de adoção, linhas ~6593-6656)
- `src/styles.css` (`.adoption-board-layout`, linhas 22850, 23412, 23524)
- `.portal/plans/redesign-painel-adocao-mockup.md` (plano anterior que introduziu a coluna lateral, hoje removida)

Observação: não existe `frontend/AGENT.md` nem `backend/AGENT.md` neste repositório — o projeto não usa a estrutura `frontend/`/`backend/AGENT.md` descrita no `/AGENT.md` raiz; há apenas `src/` (frontend) e `backend/` na raiz, com um único `AGENT.md`.

## Impacto por área

### Frontend

Impacto pontual em `src/styles.css`, sem nenhuma alteração de JSX/`App.tsx` necessária. O container `.adoption-board-layout` (usado uma única vez no JSX, linha 6593, envolvendo tanto o modo grade quanto o modo lista) tem hoje dois blocos de definição:

- Linha 22850: já corrigido em sessão anterior — `grid-template-columns: minmax(0, 1fr);` (uma coluna).
- Linha 23412: **ainda residual** — `grid-template-columns: minmax(0, 1fr) 296px;`, reservando a largura da antiga coluna lateral. Este é o bloco que vence a cascata (mais específico/posterior no arquivo) e causa o bug relatado.

A correção é trocar a linha 23412 para `grid-template-columns: minmax(0, 1fr);`, igualando ao bloco 22850.

A terceira ocorrência (linha 23524, dentro de `@media (max-width: 1180px)`) já foi verificada e não define `grid-template-columns` — apenas `grid-column`/`grid-row` — então não precisa de ajuste.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado. Nenhuma migration necessária.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css` (uma linha, dentro do bloco `.adoption-board-layout` por volta da linha 23412-23418)

## Estratégia de implementação

1. Abrir `src/styles.css` no bloco `.adoption-board-layout` por volta da linha 23412.
2. Alterar `grid-template-columns: minmax(0, 1fr) 296px;` para `grid-template-columns: minmax(0, 1fr);`.
3. Rodar `npx vite build` para confirmar que o CSS compila sem erros.
4. Rodar `npx tsc --project tsconfig.json --noEmit` (nenhuma mudança de `.tsx` esperada, mas mantém o hábito de validação já seguido nesta sessão).
5. Validar visualmente com Chrome headless via CDP (técnica já usada nesta sessão: login local via `POST /api/auth/login`, injeção de `castragestao:token`/`castragestao:user` no `localStorage`, `Page.captureScreenshot`):
   - Abrir o painel de Adoção no modo grade — confirmar que o grid de cards ocupa a largura total, sem faixa vazia à direita.
   - Alternar para o modo lista — confirmar o mesmo comportamento.
6. Se o backend local estiver rodando durante o `vite build`, conferir `curl localhost:3002/health` depois — já observado nesta sessão que o build pode derrubar o processo Node por um `ENOENT` transitório em `dist/index.html`; reiniciar se necessário.

## Regras de negócio identificadas

Nenhuma regra de negócio envolvida — é um ajuste puramente visual de layout.

## Regras multi-tenant e segurança

Sem impacto. Nenhum dado, permissão ou escopo de tenant é tocado nesta correção.

## Validações necessárias

- Grid de cards deve ocupar a largura total da área de conteúdo após a correção, em telas desktop (acima de 1180px, fora da media query que já lida com o colapso mobile/tablet).
- Nenhuma regressão visual em outras telas — confirmado que `.adoption-board-layout` é exclusiva da tela de Adoção (única ocorrência no JSX).
- Ambos os modos de visualização (grade e lista) devem refletir a correção, já que compartilham o mesmo container pai.

## Testes necessários

### Frontend

- Verificação visual manual (ou via screenshot headless) do painel de Adoção em modo grade: grid ocupa 100% da largura.
- Verificação visual manual (ou via screenshot headless) do painel de Adoção em modo lista: mesma verificação.
- Conferir em pelo menos uma largura de viewport abaixo de 1180px que o comportamento responsivo existente (media query) continua funcionando sem regressão.

### Backend

Sem testes backend necessários.

### E2E

- Fluxo manual: abrir Adoção → conferir grade ocupando largura total → alternar para lista → conferir mesmo comportamento.

## Comandos de validação sugeridos

```bash
npx vite build
npx tsc --project tsconfig.json --noEmit
```

## Riscos e pontos de atenção

- Risco muito baixo: mudança de uma única propriedade CSS, em seletor exclusivo de uma tela, sem lógica de negócio envolvida.
- Atenção ao rodar `vite build` com o backend local ativo: já observado nesta sessão que isso pode derrubar o processo Node (erro `ENOENT` transitório servindo `dist/`); reiniciar o backend após o build se for testar localmente.
- Este projeto **não segue** o fluxo `staging → PR → main` descrito no `/AGENT.md` raiz — o histórico real (`git branch -a`, `git log`) mostra commits diretos em `main`, sem branch `staging`, e a skill `finalizar` deste projeto já documenta esse comportamento como o padrão esperado. Esta correção deve seguir o padrão real do repositório (commit direto em `main` via skill `finalizar`, quando solicitado pelo usuário), não o fluxo de branch/PR descrito no `AGENT.md` genérico.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — causa raiz e correção já confirmadas por leitura direta do código nesta análise.

## Critérios de aceite do plano

A implementação deve ser considerada pronta quando:

- O grid de cards do painel de adoção ocupar a largura total da área de conteúdo, sem faixa vazia reservada, tanto no modo grade quanto no modo lista.
- `npx vite build` e `npx tsc --noEmit` passarem sem erros.
- Nenhuma outra tela ou componente for afetado (confirmado pela exclusividade da classe `.adoption-board-layout`).

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Mudança de escopo mínimo: uma linha em `src/styles.css`.
- Não mexer no card do animal, no rail lateral (já removido) ou em qualquer outra parte do painel de adoção além do container de layout.
- Validar com build + typecheck, e se possível com screenshot real (grade e lista) antes de reportar como concluído — este projeto tem histórico nesta sessão de bugs de CSS que não são visíveis por leitura estática da cascata.
- Não criar branch nem PR — seguir o fluxo real do projeto (commit direto, via skill `finalizar` quando solicitado).
