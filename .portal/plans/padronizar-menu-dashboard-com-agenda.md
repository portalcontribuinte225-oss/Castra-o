# Plano de Implementacao: Padronizar Menu do Dashboard com Agenda

## Origem

- Arquivo de especificacao: `conversa do usuario em 2026-07-27; sem arquivo .md em disco`
- Data do planejamento: `2026-07-27`
- Classificacao: `frontend-only`

## Resumo

Reestilizar o menu/cabecalho interno do Dashboard para seguir o mesmo modelo visual ja usado na tela Agenda. A mudanca deve manter um padrao visual no sistema, preservando a logica atual do Dashboard, seus KPIs, paineis, abas e filtros de periodo.

O foco e visual e estrutural no frontend: substituir a aparencia atual de hero/card grande por um cabecalho mais compacto, semelhante ao padrao `ag-header`, com controles segmentados, estado ativo escuro, trilho cinza claro e responsividade limpa.

## Escopo

### Dentro do escopo

- Reestilizar o cabecalho interno do Dashboard.
- Reorganizar o menu de abas do Dashboard para ficar visualmente alinhado ao menu de visualizacao da Agenda.
- Reestilizar o seletor de periodo do Dashboard para parecer um controle segmentado no mesmo padrao.
- Manter as abas existentes:
  - Gestao
  - Operacao
  - Processos
  - Produtividade
  - Territorio
  - Estatisticas
- Manter os periodos existentes:
  - 30 dias
  - 90 dias
  - 12 meses
  - Tudo
- Ajustar responsividade para desktop e mobile.
- Conferir encoding dos textos alterados para evitar caracteres quebrados.

### Fora do escopo

- Alterar calculos, metricas, KPIs ou conteudo dos paineis do Dashboard.
- Alterar a tela Agenda.
- Alterar backend, banco de dados, endpoints, permissoes ou regras multi-tenant.
- Instalar dependencias novas.
- Criar novos componentes compartilhados grandes sem necessidade.
- Fazer commit, push ou deploy.

## Leitura de contexto

- `/AGENT.md`
- `frontend/AGENT.md`: nao existe neste repositorio.
- `backend/AGENT.md`: nao existe neste repositorio.
- Especificacao do usuario na conversa: "reestilize o menu de daschboard para o mesmo modelo usado em agenda... quero manter um padrao no sistema".
- Print anexado pelo usuario mostrando o Dashboard atual.
- `src/features/dashboard.tsx`
- `src/features/agenda.tsx`
- `src/styles.css`
- `.portal/plans/reskin-visual-tela-agenda.md`
- `package.json`

## Impacto por area

### Frontend

Alteracoes esperadas:

- `src/features/dashboard.tsx`
  - Ajustar o JSX do cabecalho atual do Dashboard.
  - Substituir ou reorganizar a area `opdash-hero`, `opdash-nav`, `opdash-tabs`, `opdash-toolbar` e `opdash-segment`.
  - Manter a mesma semantica dos botoes e estados React existentes.
  - Manter `DASHBOARD_TABS`, `PERIOD_OPTIONS`, `activeTab`, `setActiveTab`, `period` e `setPeriod`.

- `src/styles.css`
  - Atualizar o bloco visual do Dashboard para alinhar com o padrao da Agenda:
    - trilho cinza claro;
    - botoes compactos;
    - ativo escuro;
    - hover branco;
    - gap e altura semelhantes aos controles `ag-nav`, `ag-views` e `ag-view-btn`.
  - Reduzir a aparencia de hero/card grande do cabecalho do Dashboard.
  - Revisar regras duplicadas antigas e novas de `opdash-tabs`, `opdash-segment`, `opdash-toolbar` e `opdash-nav`.
  - Garantir que as regras finais nao briguem por cascata.

Estados de UI:

- Aba ativa deve continuar destacada.
- Periodo ativo deve continuar destacado.
- Hover deve ser consistente com Agenda.
- Em mobile, controles devem quebrar de forma limpa ou rolar horizontalmente sem cortar texto.

Testes/validacoes:

- Typecheck.
- Build.
- Validacao visual manual ou via navegador, se disponivel.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

Atencao: migrations nao devem ser executadas sem confirmacao explicita do usuario, pois o ambiente atual pode estar apontando para producao.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/features/dashboard.tsx`
- `src/styles.css`

## Estrategia de implementacao

1. Ler o trecho atual do `DashboardView` em `src/features/dashboard.tsx`, especialmente o cabecalho entre `opdash-hero`, `opdash-nav`, `opdash-tabs`, `opdash-toolbar` e `opdash-segment`.
2. Ler o cabecalho da Agenda em `src/features/agenda.tsx`, especialmente `ag-header`, `ag-header-row`, `ag-title-block`, `ag-nav`, `ag-views` e `ag-view-btn`.
3. Definir uma estrutura equivalente para o Dashboard, preservando nomes `opdash-*` para nao acoplar Dashboard diretamente as classes da Agenda.
4. Ajustar o JSX do Dashboard:
   - bloco de titulo/kicker a esquerda;
   - abas do Dashboard como controle segmentado compacto;
   - filtro de periodo como controle segmentado separado;
   - manter handlers e listas existentes.
5. Atualizar o CSS do Dashboard no bloco mais recente de `src/styles.css`, perto do comentario `Public-office dashboard pass`.
6. Consolidar ou sobrescrever conscientemente as regras antigas de `opdash-tabs`, `opdash-segment`, `opdash-toolbar` e `opdash-nav` que aparecem antes no arquivo, evitando conflito de cascata.
7. Ajustar media queries para:
   - desktop amplo;
   - telas intermediarias;
   - mobile ate 640px.
8. Conferir os textos alterados no arquivo para evitar caracteres quebrados:
   - `Dashboard de gestao`
   - `Fluxo operacional`
   - `Periodo`
   - nomes das abas.
9. Rodar `npm run typecheck`.
10. Rodar `npm run build`.
11. Se houver navegador disponivel, abrir Dashboard e Agenda para comparar:
   - alinhamento;
   - estado ativo;
   - responsividade;
   - ausencia de corte de texto.

## Regras de negocio identificadas

- As abas do Dashboard continuam apenas alterando a secao visivel do Dashboard.
- O filtro de periodo continua alterando apenas o recorte das metricas ja existente.
- Nenhuma regra de calculo ou interpretacao dos indicadores deve ser alterada.

## Regras multi-tenant e seguranca

Sem impacto direto.

Cuidados:

- Nao alterar filtros de municipio.
- Nao alterar dados usados por `DashboardView`.
- Nao criar novos caminhos de leitura ou escrita.
- Nao alterar permissoes, roles, autenticacao ou endpoints.

## Validacoes necessarias

- Confirmar que todas as abas do Dashboard continuam navegando:
  - Gestao
  - Operacao
  - Processos
  - Produtividade
  - Territorio
  - Estatisticas
- Confirmar que todos os periodos continuam funcionando:
  - 30 dias
  - 90 dias
  - 12 meses
  - Tudo
- Confirmar que textos nao quebram em desktop e mobile.
- Confirmar que o Dashboard nao ganhou scroll horizontal indesejado na pagina inteira.
- Confirmar que a Agenda nao sofreu regressao visual.

## Testes necessarios

### Frontend

- Validacao visual do Dashboard em desktop.
- Validacao visual do Dashboard em mobile.
- Validacao visual comparando o menu do Dashboard com o menu da Agenda.
- Teste manual de clique em todas as abas.
- Teste manual de clique em todos os periodos.

### Backend

Sem impacto esperado.

### E2E

- Se houver Playwright ou navegador automatizado disponivel:
  - abrir Dashboard;
  - alternar abas;
  - alternar periodos;
  - comparar responsividade em viewport desktop e mobile.

## Comandos de validacao sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atencao

- Existem regras antigas e novas de Dashboard em `src/styles.css`; adicionar CSS sem consolidar pode causar conflito de cascata.
- Reduzir o cabecalho pode afetar o espaco disponivel para abas longas como `Produtividade` e `Estatisticas`.
- O arquivo ja teve historico recente de problema de UTF; evitar regravacao com encoding incorreto.
- Como o Dashboard esta em uma tela operacional, a mudanca deve ser pequena e focada para nao afetar KPIs ou paineis.
- O projeto possui worktree suja com alteracoes anteriores; nao reverter nada que nao esteja diretamente ligado a este plano.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Criterios de aceite do plano

A implementacao deve ser considerada pronta quando:

- O menu do Dashboard estiver visualmente alinhado ao padrao da Agenda.
- As abas do Dashboard continuarem funcionando sem alteracao de comportamento.
- O filtro de periodo continuar funcionando sem alteracao de comportamento.
- O layout estiver responsivo e sem texto cortado.
- Nao houver regressao visual evidente na Agenda.
- `npm run typecheck` passar.
- `npm run build` passar.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Nao executar migrations.
- Nao alterar backend.
- Nao alterar dados, metricas ou regras de negocio do Dashboard.
- Manter alteracoes pequenas e focadas em `src/features/dashboard.tsx` e `src/styles.css`.
- Preferir nomes de classes em ingles e prefixo `opdash-*`, seguindo a convencao existente.
- Evitar dependencias novas.
- Conferir UTF antes de concluir.
- Nao fazer commit/push sem solicitacao explicita do usuario.
