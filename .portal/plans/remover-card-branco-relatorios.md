# Plano de Implementação: Remover card branco desnecessário no painel de Relatórios

## Origem

- Arquivo de especificação: `.portal/specs/remover-card-branco-relatorios.md`
- Data do planejamento: `2026-07-29`
- Classificação: `frontend-only`

## Resumo

Na tela interna de Relatórios, o bloco que envolve os 5 resumos (Status, Resultado, Tipos de solicitação, Responsáveis, Taxas) e a tabela de resultados está dentro de um `<div className="panel wide">` (`src/features/reports.tsx:258`), que herda fundo branco, borda e sombra da classe genérica `.panel` (`src/styles.css:5085-5093`). O usuário pediu para remover essa moldura de card, deixando o conteúdo solto sobre o fundo da página.

Investigação prévia (computed style real via Chrome headless, não apenas leitura do CSS-fonte) confirmou que a faixa de filtros acima (`.page-toolbar.reports-controls`) já é transparente — não existe um segundo card ali. A impressão inicial de "duas divs card" era um efeito de contraste entre os inputs nativos do navegador (com fundo branco próprio) e o único card real por baixo. Portanto, esta implementação remove apenas o card do `.panel.wide` em Relatórios.

## Escopo

### Dentro do escopo

- Remover fundo, borda e sombra do bloco `.panel.wide` específico da tela de Relatórios (resumo + tabela).
- Preservar espaçamento interno suficiente para não colar o conteúdo nas bordas da tela.

### Fora do escopo

- Qualquer mudança na faixa de filtros (`.page-toolbar.reports-controls`) — já confirmado que não tem card visual a remover.
- Qualquer mudança em outras telas que usam `.panel`/`.panel.wide` (ex: bloco "Minhas solicitações" do Dashboard, `App.tsx:3204`).
- Mudanças de dados, filtros, exportação de PDF ou lógica de negócio do relatório.

## Leitura de contexto

- `/AGENT.md`
- `.portal/specs/remover-card-branco-relatorios.md`
- `src/features/reports.tsx` (estrutura completa do componente `ReportsView`)
- `src/styles.css` (regras `.panel`, `.reports-breakdown-grid`, `.reports-breakdown`, `.reports-table-wrap`, `.page-toolbar`, `.reports-controls`, `.wide`)
- `src/App.tsx` (confirmação de outro uso de `.panel.wide` fora de Relatórios, linha 3204)

Observação: não existe `frontend/AGENT.md` nem `backend/AGENT.md` neste repositório — projeto usa `src/` (frontend) e `backend/` na raiz, com um único `AGENT.md`. Este `AGENT.md` descreve um fluxo `staging → PR → main` que não corresponde ao histórico real do repositório (commits diretos em `main`, sem branch `staging` — já documentado em sessões anteriores e na skill `finalizar` do projeto). Esta implementação segue o padrão real do repositório.

## Impacto por área

### Frontend

Impacto pontual em dois arquivos:

- `src/features/reports.tsx`: adicionar uma classe extra ao `<div className="panel wide">` da linha 258, para criar um seletor de escopo dedicado a Relatórios sem tocar na classe genérica `.panel` (que é usada também em `App.tsx:3204`, fora de escopo).
- `src/styles.css`: adicionar uma regra escopada a essa classe nova, neutralizando fundo/borda/sombra apenas nesse contexto.

Nenhuma mudança de estado, lógica de filtro, busca ou exportação de PDF.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado. Nenhuma migration necessária.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/features/reports.tsx`
- `src/styles.css`

## Estratégia de implementação

1. Em `src/features/reports.tsx:258`, alterar `<div className="panel wide">` para `<div className="panel wide reports-summary-panel">` — mantendo as classes existentes (evita quebrar qualquer comportamento herdado não-visual) e adicionando um seletor de escopo específico.
2. Em `src/styles.css`, adicionar uma regra nova:
   ```
   .reports-summary-panel {
     background: transparent;
     border: 0;
     box-shadow: none;
     padding: 0;
   }
   ```
   Posicionada perto das outras regras `.reports-*` (ex: próximo a `.reports-breakdown-grid`, por volta da linha 7368), não misturada com a regra genérica `.panel`.
3. Conferir visualmente se o `padding: 0` deixa o conteúdo (resumos + tabela) colado demais nas bordas da tela — se necessário, ajustar para um padding pequeno (ex: `padding: 4px 0`) apenas nessa classe, sem reintroduzir o card.
4. Rodar `npx vite build` e `npx tsc --project tsconfig.json --noEmit`.
5. Validar visualmente via Chrome headless/CDP (mesma técnica já usada nesta sessão):
   - Abrir Relatórios — confirmar que o card branco (fundo/borda/sombra) sumiu do bloco de resumo + tabela.
   - Abrir a tela que usa `.panel.wide` fora de Relatórios (Dashboard/Solicitações, verificar qual view expõe o bloco de `App.tsx:3204`) — confirmar que o card permanece intacto ali.
6. Se o backend local estiver rodando durante o `vite build`, conferir `curl localhost:3002/health` depois — já observado nesta sessão que o build pode derrubar o processo Node por um `ENOENT` transitório em `dist/index.html`; reiniciar se necessário.

## Regras de negócio identificadas

Nenhuma — ajuste puramente visual.

## Regras multi-tenant e segurança

Sem impacto. Nenhum dado, permissão ou escopo de tenant é tocado.

## Validações necessárias

- O bloco de resumo + tabela em Relatórios não deve ter fundo branco, borda nem sombra após a mudança.
- O bloco "Minhas solicitações" (App.tsx:3204), que também usa `.panel.wide`, deve permanecer com o card visual intacto — validação cruzada obrigatória antes de considerar a tarefa concluída.
- O conteúdo não pode ficar colado nas bordas da tela por falta de padding.

## Testes necessários

### Frontend

- Verificação visual manual (ou screenshot headless) da tela de Relatórios: card branco removido do bloco de resumo + tabela.
- Verificação visual manual (ou screenshot headless) da tela que usa `.panel.wide` fora de Relatórios: card branco preservado (regressão zero).

### Backend

Sem testes backend necessários.

### E2E

- Fluxo manual: abrir Relatórios → conferir ausência de card branco no bloco de resumo/tabela → abrir a outra tela que usa `.panel.wide` → conferir que o card ali continua normal.

## Comandos de validação sugeridos

```bash
npx vite build
npx tsc --project tsconfig.json --noEmit
```

## Riscos e pontos de atenção

- Risco principal, já mitigado pela estratégia: `.panel.wide` é compartilhada com outra tela (`App.tsx:3204`). A correção usa uma classe adicional dedicada (`reports-summary-panel`) em vez de mexer na regra genérica `.panel`, eliminando esse risco.
- Atenção ao rodar `vite build` com o backend local ativo: pode derrubar o processo Node (erro `ENOENT` transitório servindo `dist/`); reiniciar o backend após o build se for testar localmente.
- Este projeto não segue o fluxo `staging → PR → main` descrito no `/AGENT.md` raiz — o histórico real (`git branch -a`, `git log`) mostra commits diretos em `main`. Esta implementação não deve criar branch nem PR.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — causa raiz, escopo e risco de regressão já confirmados por inspeção direta do código e do computed style renderizado.

## Critérios de aceite do plano

A implementação deve ser considerada pronta quando:

- O bloco de resumo + tabela em Relatórios não tiver mais fundo branco, borda ou sombra de card.
- A tela que usa `.panel.wide` fora de Relatórios continuar com o card visual intacto.
- `npx vite build` e `npx tsc --noEmit` passarem sem erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não alterar a regra genérica `.panel` — criar e usar a classe de escopo `reports-summary-panel`.
- Não mexer na faixa de filtros (`.page-toolbar.reports-controls`) — já confirmado que não tem card a remover.
- Validar cruzadamente a outra tela que usa `.panel.wide` (App.tsx:3204) antes de reportar como concluído.
- Não criar branch nem PR — seguir o fluxo real do projeto (commit direto, via skill `finalizar` quando solicitado).
