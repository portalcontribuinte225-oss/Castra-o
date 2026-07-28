# Plano de Implementação: Suavização Visual do Dashboard

## Origem

- Arquivo de especificação: `conversa: análise visual do dashboard solicitada pelo usuário`
- Data do planejamento: `2026-07-27`
- Classificação: `frontend-only`

## Resumo

Suavizar a aparência do dashboard administrativo, reduzindo cores muito saturadas em gráficos e indicadores, substituindo a paleta da aba Estatísticas por uma alternativa mais institucional e padronizando pesos de fonte para ficar coerente com a suavidade já aplicada em Solicitações.

A implementação deve preservar os cards gerais, layouts, grids, navegação por abas e dados exibidos. O foco é tema visual, tipografia e intensidade dos gráficos.

## Escopo

### Dentro do escopo

- Suavizar cores dos gráficos do dashboard (`Ranking`, `Trend`, `Funnel`, `ProgressLine`).
- Trocar a paleta da aba `Estatísticas`, removendo rosa/magenta forte.
- Reduzir pesos de fonte em KPIs, mini métricas, labels, títulos internos e números.
- Consolidar a camada final de CSS `.opdash-*` para evitar remendos empilhados.
- Preservar cards gerais, espaçamento, responsividade e estrutura visual atual.
- Validar build e typecheck.

### Fora do escopo

- Alterar dados, métricas ou regras do dashboard.
- Criar novos gráficos.
- Alterar backend, endpoints, banco de dados ou permissões.
- Alterar fluxo multi-tenant.
- Alterar relatórios/PDFs.
- Refatorar arquitetura de `src/features/dashboard.tsx`, salvo ajuste mínimo se necessário.

## Leitura de contexto

- `/AGENT.md`
- `/frontend/AGENT.md`: não existe neste repositório
- `src/features/dashboard.tsx`
- `src/styles.css`
- Conversa com o usuário sobre dashboard, cores vivas, fontes pesadas e aba Estatísticas

## Impacto por área

### Frontend

Impacto esperado apenas em estilo visual do dashboard.

Telas/componentes afetados:

- Dashboard administrativo (`DashboardView`)
- Abas: Gestão, Operação, Processos, Produtividade, Território e Estatísticas
- Componentes visuais renderizados por `src/features/dashboard.tsx`:
  - `KpiCard`
  - `Ranking`
  - `Trend`
  - `Funnel`
  - `MiniMetric`
  - `ProgressLine`
  - `SignalList`
  - `DecisionList`

Estados a preservar:

- Aba selecionada
- Hover/focus das abas
- Responsividade
- Empty states
- Gráficos com valores zero ou poucos dados

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

Atenção: migrations não devem ser executadas sem confirmação explícita do usuário, pois o ambiente atual pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css`

Possível, apenas se necessário:

- `src/features/dashboard.tsx`

## Estratégia de implementação

1. Mapear as regras finais que controlam `.opdash-root`, `--opdash-action`, `--opdash-accent`, `--opdash-accent-2` e `--opdash-soft`.
2. Evitar adicionar uma nova camada solta no fim do CSS se for possível consolidar os overrides existentes.
3. Definir uma paleta suave para dashboard:
   - Gestão: azul acinzentado suave.
   - Operação/Processos: teal discreto.
   - Produtividade/Território: índigo/cinza azulado com baixa saturação.
   - Estatísticas: substituir magenta por azul petróleo/cinza azulado ou teal discreto.
4. Trocar preenchimentos fortes dos gráficos:
   - `.opdash-rank-track i`
   - `.opdash-funnel-row i`
   - `.opdash-progress b`
   - `.opdash-trend-bars i`
5. Remover ou suavizar gradientes vivos em barras de tendência.
6. Ajustar tipografia do dashboard:
   - KPIs grandes: `600` ou `620`.
   - Títulos de painel: `600`.
   - Labels: `500`.
   - Textos auxiliares: `400`.
   - Mini métricas: manter destaque, mas sem `780/820`.
7. Preservar o layout dos cards e grids existentes.
8. Revisar responsivo básico para não criar texto cortado ou scroll horizontal.
9. Rodar validações.
10. Se aprovado visualmente, finalizar com commit/push conforme fluxo do projeto.

## Regras de negócio identificadas

- Não há alteração de regra de negócio.
- O dashboard deve continuar exibindo os mesmos dados e métricas.
- A alteração é exclusivamente visual.

## Regras multi-tenant e segurança

- Sem impacto multi-tenant esperado.
- Não alterar filtros por município, usuário, permissões ou dados carregados.
- Não alterar backend, rotas ou contratos de API.
- Não alterar relatórios/PDFs.

## Validações necessárias

- Confirmar que todas as abas do dashboard continuam renderizando.
- Confirmar que gráficos com dados vazios continuam exibindo empty state.
- Confirmar que selected/hover/focus das abas continuam claros.
- Confirmar que cores não ficam intensas demais nos gráficos.
- Confirmar que textos não ficam pesados em KPIs e painéis.
- Confirmar que o layout responsivo não ganha scroll horizontal.

## Testes necessários

### Frontend

- Validação visual manual do dashboard nas seis abas.
- Validação visual em viewport desktop.
- Validação visual em viewport mobile/tablet, se possível.
- Verificar estados com poucos dados e sem dados.

### Backend

- Sem testes backend necessários.

### E2E

- Não obrigatório para este ajuste visual.
- Se houver ferramenta disponível, capturar screenshot do dashboard antes/depois para comparação.

## Comandos de validação sugeridos

```bash
git diff --check
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- `src/styles.css` tem várias camadas históricas para `.opdash-*`; adicionar mais overrides no fim pode manter a dívida visual.
- Algumas regras finais usam `!important`; remover sem cuidado pode fazer estilos antigos voltarem.
- Seletores compartilhados como `.metric-card`, `.summary-card` e variáveis globais podem afetar telas fora do dashboard.
- Cores muito neutras podem reduzir leitura de status; manter contraste suficiente.
- O projeto faz commit/push direto em `main`, então a revisão deve ser pequena e fácil de reverter.

## Perguntas em aberto

- Definir a cor final da aba Estatísticas durante a implementação: recomendação inicial é azul petróleo/cinza azulado, evitando magenta/rosa.
- Confirmar visualmente se ainda deve existir cor por aba ou se o dashboard deve ficar quase todo neutro com poucos acentos.

## Critérios de aceite do plano

A implementação deve ser considerada pronta quando:

- Os gráficos do dashboard estiverem visivelmente mais suaves.
- A aba Estatísticas não usar mais a paleta rosa/magenta forte.
- KPIs, mini métricas, labels e títulos internos tiverem pesos de fonte mais leves.
- Cards gerais e layout continuarem iguais.
- Todas as abas continuarem funcionais.
- `git diff --check`, `npm run typecheck` e `npm run build` passarem.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não alterar backend, banco, permissões ou infra.
- Priorizar mudanças em `src/styles.css`.
- Só alterar `src/features/dashboard.tsx` se for necessário para reduzir duplicidade ou remover estilo inline problemático.
- Manter alterações pequenas, auditáveis e reversíveis.
- Evitar criar uma nova camada de overrides se for possível consolidar a camada `.opdash-*` existente.
- Não executar migrations.
