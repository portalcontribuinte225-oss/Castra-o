# Plano de Implementação: Normalizar Tipografia Global do Sistema

## Origem

- Arquivo de especificação: `contexto da conversa com o usuário`
- Data do planejamento: `2026-07-27`
- Classificação: `frontend-only`

## Resumo

Implementar uma normalização tipográfica global para reduzir excesso de pesos fortes no sistema, organizar a hierarquia visual e corrigir casos como placeholders, labels, chips, botões, badges e cards aparecendo com fonte grossa demais.

A mudança deve preservar comportamento, regras de negócio, permissões, endpoints, dados e fluxos existentes. O foco é visual/CSS.

## Escopo

### Dentro do escopo

- Criar uma escala global de pesos tipográficos em `src/styles.css`.
- Normalizar placeholders para peso leve e cor secundária.
- Suavizar labels de campos e textos auxiliares.
- Reduzir peso excessivo em botões primários, secundários e ghost.
- Reduzir peso excessivo em chips, tabs, filtros e segmentos.
- Ajustar badges/status para manter legibilidade sem aparência pesada.
- Melhorar hierarquia visual em cards, tabelas, painéis e menus.
- Aplicar a normalização principalmente na área interna do sistema.
- Corrigir pontos públicos apenas quando forem componentes compartilhados, como inputs, botões e placeholders.

### Fora do escopo

- Trocar a fonte principal do sistema.
- Criar componentes React novos de design system.
- Refatorar todo o CSS legado em arquivos separados.
- Alterar backend, banco de dados, APIs, permissões ou regras multi-tenant.
- Alterar textos de negócio ou fluxos funcionais.
- Reestruturar telas inteiras.
- Remover todos os `font-weight` antigos do arquivo nesta primeira etapa.

## Leitura de contexto

- `/AGENT.md`
- `frontend/AGENT.md`: não encontrado; o frontend está diretamente em `src/`.
- `src/styles.css`
- `src/App.tsx`
- `src/features/accessRequests.tsx`
- Contexto da conversa sobre excesso de fontes grossas, placeholders em negrito e falta de hierarquia visual global.

## Impacto por área

### Frontend

Haverá impacto visual no frontend, principalmente em `src/styles.css`.

Telas/componentes afetados esperados:

- Dashboard
- Solicitações
- Agenda
- Relatórios
- Credenciamentos
- Adoção
- Configurações
- Modais internos
- Topbar
- Sidebar
- Inputs/selects/textareas
- Botões
- Chips/filtros/tabs
- Badges/status
- Cards e painéis

Não deve haver alteração em hooks, query keys, APIs ou estado de dados.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

Atenção: migrations não devem ser executadas sem confirmação explícita do usuário, pois o ambiente atual pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css`
- `src/App.tsx`, somente se algum texto/controle precisar de classe estrutural mínima.
- `src/features/accessRequests.tsx`, somente se algum problema visual estiver ligado a markup duplicado e não puder ser resolvido com CSS.

## Estratégia de implementação

1. Mapear os blocos finais de `src/styles.css` que atualmente sobrescrevem pesos de fonte em componentes globais.
2. Criar tokens globais de tipografia, por exemplo:
   - peso normal para texto comum;
   - peso médio para labels e controles;
   - peso semibold para botões e títulos de painel;
   - peso forte apenas para títulos principais e números importantes.
3. Adicionar uma camada final de normalização tipográfica, evitando alteração funcional.
4. Definir regra global para placeholders:
   - peso normal;
   - cor secundária;
   - sem negrito;
   - sem aparência de label.
5. Normalizar controles compartilhados:
   - `.primary-action`
   - `.secondary-action`
   - `.ghost-button`
   - `.request-filter-tabs button`
   - `.request-today-segment button`
   - `.config-status-filter button`
   - `.tab-bar button`
   - `.opdash-tabs button`
   - `.opdash-segment button`
   - `.ag-view-btn`
   - `.adoption-nav-modern .adoption-filter-group button`
   - `.compact-choice-field button`
6. Normalizar labels e textos auxiliares:
   - `.field > span`
   - `.field label`
   - `.form-field label`
   - `.tc-label`
   - `.cr-label`
   - labels de modais e formulários.
7. Normalizar badges/status para peso controlado, preservando contraste.
8. Ajustar títulos de cards e painéis para não competir com o cabeçalho principal.
9. Validar visualmente as telas principais em desktop e mobile.
10. Rodar validações finais.

## Regras de negócio identificadas

- Nenhuma regra de negócio nova.
- A mudança é exclusivamente visual.
- Não alterar cálculos, filtros, permissões, endpoints ou persistência.

## Regras multi-tenant e segurança

- Sem alteração de backend ou dados multi-tenant.
- Não alterar origem de tenant/prefeitura.
- Não alterar permissões.
- Não alterar relatórios/PDFs.
- Garantir que nenhuma mudança visual oculte informações importantes de status, prefeitura, usuário ou filtro ativo.

## Validações necessárias

- Placeholders devem ficar leves e não parecer labels.
- Labels devem ficar legíveis, mas secundários.
- Botões principais devem manter destaque sem peso visual excessivo.
- Chips, tabs e filtros devem parecer controles, não blocos de título.
- Badges/status devem preservar contraste e leitura rápida.
- Sidebar e topbar devem manter hierarquia clara.
- Títulos principais devem continuar sendo os elementos mais fortes da página.
- Não deve haver perda de contraste em telas internas ou públicas.
- Não deve haver texto cortado ou scroll horizontal causado pela alteração.

## Testes necessários

### Frontend

- Validar manualmente Dashboard, Solicitações, Agenda, Relatórios, Credenciamentos, Adoção e Configurações.
- Validar modais principais, especialmente cadastro de animal, credenciamento, edição/configurações e formulários de solicitação.
- Validar inputs com placeholder, campo preenchido, foco, erro e disabled.
- Validar responsivo até 640px.

### Backend

- Sem testes backend necessários.

### E2E

- Não obrigatório nesta etapa.
- Recomendado apenas se houver suíte visual/e2e já configurada futuramente.

## Comandos de validação sugeridos

```bash
git diff --check
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Risco de suavizar demais botões ou status importantes.
- Risco de conflitos com regras antigas que usam `!important`.
- Risco de a área pública perder acolhimento se a normalização for aplicada de forma agressiva.
- Risco de alguns modais específicos continuarem herdando pesos antigos por seletores mais específicos.
- `src/styles.css` está grande e possui camadas de overrides; a implementação deve ser pequena, incremental e validada visualmente.
- O projeto possui regra operacional de evitar alterações amplas e difíceis de revisar.

## Perguntas em aberto

- A área pública deve receber apenas correções leves de inputs/placeholders/botões, mantendo estilo próprio mais acolhedor.
- A implementação inicial deve priorizar a área interna operacional.

## Critérios de aceite do plano

A implementação deve ser considerada pronta quando:

- Placeholders não aparecerem em negrito em nenhuma tela principal.
- Labels e textos auxiliares tiverem peso menor que botões/títulos.
- Botões principais preservarem destaque sem parecerem pesados demais.
- Chips, filtros e abas tiverem peso médio e legível.
- Badges/status continuarem legíveis e menos agressivos.
- Cards e painéis tiverem hierarquia visual mais clara.
- Dashboard, Solicitações, Agenda, Relatórios, Credenciamentos, Adoção e Configurações forem visualmente conferidos.
- `git diff --check`, `npm run typecheck` e `npm run build` passarem.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não alterar backend, banco, endpoints, permissões ou regras de negócio.
- Não executar migrations.
- Não alterar `.env`.
- Preferir uma camada CSS global e focada antes de refatorar regras antigas.
- Evitar uma mudança agressiva que deixe a interface sem hierarquia.
- Preservar a diferença entre área interna operacional e área pública.
- Validar visualmente os componentes mais reutilizados antes de concluir.