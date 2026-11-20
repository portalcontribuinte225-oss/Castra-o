# Plano de implementação da padronização das telas restantes

## Origem

- Escopo definido no chat após a revisão das telas restantes do painel interno do Castração.
- Plano preliminar aprovado em 20/11/2026.
- Classificação `frontend-only`.

## Resumo

Aplicar o padrão de Configurações e Solicitações a Credenciamentos, Agenda operacional, Adoção interna, Dashboard, Relatórios e aos controles comuns do painel. Reaproveitar os componentes, o tema e o comportamento de foco já usados no projeto. Preservar as regras por município, perfil e fluxo.

## Escopo

### Dentro do escopo

- **Credenciamentos** com lista, filtros, contagens e modal de parecer.
- **Agenda operacional** com controles, métricas, modos Mês, Semana, Dia, Ano e Lista, células, cards e painel lateral do dia. Conferir a entrada no Processo.
- **Adoção interna** com filtros, modos grade e lista, ficha e interessados, cadastro, edição, fotos e conclusão.
- **Dashboard** com a barra das seis abas, períodos, indicadores, painéis de gráficos e tabelas. **Relatórios** com filtros, ações, resumos, tabela e estados da busca e exportação.
- **Controles comuns** com menu lateral, atalhos móveis, busca superior, menu da conta e Alterar senha. Alinhar a visibilidade dos atalhos móveis às permissões usadas pelo menu lateral.

### Fora do escopo

- Redesenhar portal público, Configurações, Solicitações, Processo ou Agenda e Mutirão em Configurações. Conferir os pontos de entrada e os componentes compartilhados alcançados pelos ajustes.
- Alterar regras de negócio, persistência dos dados de adoção, permissões no backend, contratos da API, cálculos, conteúdo de PDFs, banco ou infraestrutura.
- Aplicar novo visual a selects antes de aprovação específica. Preservar as opções, os valores e as interações dos controles atuais.

## Leitura de contexto

- `AGENT.md` e o plano aprovado no chat.
- `.plans/padronizacao-configuracoes.md` e `.plans/padronizacao-solicitacoes-processos.md` como referências de interface e foco.
- `src/App.tsx` nas regiões do painel, da navegação comum e de `AdoptionView`.
- `src/features/accessRequests.tsx`, `src/features/agenda.tsx`, `src/features/dashboard/`, `src/features/reports.tsx` e a variante interna de `PasswordChangeForm`.
- `src/components/` e os trechos de `src/styles.css` que afetam os componentes migrados.

## Impacto por área

### Frontend

Reaproveitar `Card`, `Input`, `Button`, `CloseButton` e `useModalFocus`. Usar Tailwind no JSX e tokens do tema. Aplicar aos campos de texto fundo branco, altura de 44 px, raio de 14 px e borda verde no foco. Preservar máscaras, mensagens, tipagem dos campos, estados de somente leitura e altura multilinha. Botões usam a geometria em pílula e mantêm a cor de cada ação.

Quando a ação pertencer ao card inteiro, usar botão nativo. Em cards com várias ações, manter acionadores independentes. Nos painéis e modais, aplicar rótulos acessíveis, contenção de foco e Escape na camada superior, com retorno ao acionador conectado ou ao controle equivalente.

### Backend

Sem impacto esperado. Preservar chamadas, payloads, controle de acesso, filtros, exportações e solicitações de prontuário.

### Banco de dados

Sem impacto esperado. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infraestrutura e deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx` nos controles comuns e em `AdoptionView`.
- `src/styles.css`.
- `src/features/accessRequests.tsx`, `src/features/agenda.tsx` e `src/features/reports.tsx`.
- `src/features/dashboard/dashboard-view.tsx`, `src/features/dashboard/charts/chart-panel.tsx` e `src/features/dashboard/neighborhood-table.tsx`.
- `src/features/tutor-access/password-change-form.tsx` e os testes de troca de senha. `session-boundary.tsx` serve de referência para a troca obrigatória.
- Primitivas em `src/components/` e testes afetados, quando um ajuste compartilhado for necessário.

## O que será removido

- A simulação de botão dos cards de Credenciamentos e os cliques em elementos sem semântica de botão nos pontos migrados da Agenda. Remover handlers manuais de teclado que perderem uso.
- Os fechamentos próprios substituídos por `CloseButton`, incluindo os ramos exclusivos de `.ccm-close-btn`, `.ag-drawer-close` e `.adoption-drawer-close` após confirmar os consumidores. Remover a configuração de camada da ficha de Adoção que causar conflito com os modais se ela for substituída pela pilha compartilhada.
- Os ramos exclusivos de seleção e aparência dos filtros migrados de Credenciamentos e Adoção, dos controles `.ag-view-btn` e das barras de período e data. Retirar os estilos antigos das ações e dos campos migrados.
- A variante interna de campos e botões de Alterar senha que se tornar redundante. Preservar as regras de obrigatoriedade e de cancelamento conforme o ponto de entrada.
- Seletores, contêineres, imports e props que perderem seus consumidores. Conferir as regras agrupadas de cards, filtros, tabelas e modais antes de retirar ramos que também atendam o portal, Agenda ou Dashboard.

## Estratégia de implementação

1. **Credenciamentos como piloto.** Padronizar filtros Pendentes, Aprovados, Recusados e Todos, contagens, lista e estado vazio. Usar botão nativo nos cards. Migrar cabeçalho, X, textarea e ações do parecer. Preservar a leitura dos dados enviados, o parecer anterior, aprovação, recusa, mensagens de erro e a exibição única da senha inicial.
2. **Agenda operacional.** Migrar setas, botões de visualização e cards de resumo. Dar nome acessível aos controles de mês e ano. Manter tipo, status, mês e ano como selects nativos. Usar botões nos pontos clicáveis dos calendários e nas ações de abrir atendimento. Padronizar o painel lateral do dia, mantendo rolagem e dados de local, horário, status e ocupação. Conferir a abertura de Processo nos fluxos diretos e pelo painel lateral, incluindo o retorno ao controle de visualização quando o acionador tiver sido desmontado.
3. **Adoção interna.** Começar por filtros de status, espécie e sexo, grade, lista e ficha com interessados. Manter independentes as ações de abrir, editar, compartilhar, concluir, excluir ou reativar quando disponíveis. Padronizar cadastro, edição, carregamento de fotos e conclusão nas abas Tutor, Procedimentos e Dados do Animal. Corrigir a ordem das camadas e o retorno de foco entre a ficha lateral e os formulários, inclusive ao abrir Editar ou Concluir a partir da ficha. Preservar limites, foto principal, CEP, dados atuais enviados no encerramento e compartilhamento no portal.
4. **Dashboard e Relatórios em conjunto.** Padronizar abas, períodos prontos e datas em Dashboard. Reaproveitar `Metric` e `ChartPanel` para a apresentação, mantendo valores, séries, comparações, legendas, tooltips e alternativas acessíveis. Em Relatórios, padronizar datas, Buscar, Limpar, Exportar, Prontuário, resumos e tabela. Conferir a tabela compartilhada com Bairros no Dashboard, preservando ordenação, cabeçalho e rolagem. Manter a busca explícita, os selects existentes, os estados de geração e erro, o limite de exibição da tabela e a exportação completa do resultado filtrado.
5. **Controles comuns do painel.** Padronizar botões do menu e da conta, navegação móvel, campo de busca e modal Alterar senha. Gerar os atalhos móveis a partir das opções permitidas ao perfil, preservando a ordem dos atalhos e o acesso pelo menu lateral. Manter a seleção global de município e o modelo atual do select. Preservar validações, autocomplete, carregamento, saída e troca obrigatória de senha.
6. **Limpeza e verificação por fluxo.** Retirar os seletores substituídos junto com a migração. Revisar consumidores compartilhados, foco, seleção, carregamento, estados vazios, erros e confirmações. Rodar as validações ao final e entregar o roteiro de conferência visual.

## Regras de negócio identificadas

- Credenciamentos mantém a situação do pedido, o parecer e as condições atuais para aprovar ou recusar.
- Agenda mantém filtros, capacidade, horários, cálculo de ocupação e destino dos atendimentos.
- Adoção mantém status, interessados, foto principal, compartilhamento, dados de conclusão e demais operações existentes.
- O período do Dashboard controla as seis abas e as comparações conforme a lógica atual.
- Em Relatórios, Buscar aplica os filtros. Exportar usa todos os registros filtrados. Prontuário depende de CPF ou microchip na busca superior.
- A troca de senha preserva as regras atuais de validação, sessão e obrigatoriedade.

## Regras multi-tenant e segurança

- Preservar o recorte de dados e opções pelo município ativo. O filtro global continua com as condições de visibilidade atuais.
- Alinhar a navegação móvel à mesma lista de itens permitidos usada no menu lateral. Manter os controles existentes de acesso e operações por perfil.
- Preservar a exibição única da senha inicial de Credenciamentos e o tratamento de dados de tutor e animal. Manter a autorização de operações, consultas, PDFs e exportações.

## Validações necessárias

- **Credenciamentos** com navegação por teclado, filtros e contagens, parecer anterior, validação, aprovação, recusa e erro.
- **Agenda** em todas as visões, incluindo datas sem vagas, cheia, seleção de dia, Esc no painel lateral e abertura do Processo com retorno de foco.
- **Adoção** em grade e lista, com ficha, interessados, foto principal, upload, edição, conclusão, reativação, compartilhamento e ações conforme o perfil. Conferir fechamento da camada superior pela ficha.
- **Dashboard e Relatórios** com período predefinido e personalizado, mudança de município, dados vazios, tabelas em viewport estreito, busca, exportação e prontuário.
- **Controles comuns** com perfil restrito em desktop e celular, menu recolhido, busca, filtro de município e troca de senha obrigatória e voluntária.

## Testes necessários

### Frontend

- Rodar as suítes de Dashboard, relatórios e prontuário quando existentes, Agenda, Adoção, acessibilidade dos componentes e troca de senha. Atualizar asserções de marcação que forem afetadas.
- Acrescentar cobertura direcionada para regressões que os testes existentes não capturem, como a visibilidade dos atalhos móveis ou o estado acessível dos controles migrados.

### Backend

- Rodar a suíte de regressão existente para conferir compatibilidade com os fluxos.

### Conferência manual pelo usuário

- Em desktop e celular, conferir os cinco fluxos do painel e os controles comuns. Usar perfis com acessos diferentes e dados de municípios distintos.
- Dar atenção ao parecer de Credenciamentos, à abertura de Processo pela Agenda, aos modais sobre a ficha de Adoção, ao período do Dashboard, à exportação e ao modal Alterar senha.

## Comandos de validação sugeridos

```text
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

## Riscos e pontos de atenção

- A ficha de Adoção e os modais têm camadas diferentes. Ajustar a pilha e o retorno de foco sem bloquear o formulário ou o painel lateral.
- A Agenda reutiliza Processo e precisa preservar o fallback de foco quando o painel lateral fecha para abrir um atendimento.
- Controles, cards e tabelas recebem CSS em várias camadas. Alterar as regras efetivas e preservar os consumidores compartilhados, incluindo a tabela de Bairros do Dashboard e os componentes de Adoção do portal.
- O menu lateral aplica permissões e os atalhos móveis hoje são fixos. Conferir a mesma visibilidade por perfil em ambas as navegações.

## Perguntas em aberto

- O novo modelo visual dos selects depende de aprovação específica. A implementação dos outros controles pode avançar com os selects atuais.

## Critérios de aceite

- Credenciamentos, Agenda, Adoção interna, Dashboard, Relatórios e controles comuns usam o padrão aprovado nos elementos do escopo.
- Os fluxos preservam dados por município, permissões, regras, ações, cálculos, exportações e contratos existentes.
- Os controles migrados são operáveis por teclado. Esc fecha a camada superior e o foco retorna ao acionador ou ao controle equivalente.
- O CSS substituído que perdeu uso foi removido. Typecheck, testes e build passam, e o usuário recebe o roteiro de conferência visual.

## Observações para a skill `implementar`

- Usar este plano e `AGENT.md` em uma invocação separada de `/implementar`.
- Migrar pelas etapas aprovadas e retirar o código substituído junto com cada mudança.
- Aplicar o novo visual dos selects após aprovação específica.
