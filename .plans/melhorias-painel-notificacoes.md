# Plano de implementação — Painel e notificações

## Origem

- Escopo confirmado na conversa de 20/11/2026.
- Proposta aprovada pela opção 1.
- Classificação — frontend, backend e banco de dados.

## Resumo

Usar o brasão do município na sidebar, aplicar em Relatórios o padrão de filtros de Solicitações, separar cancelamento de agendamento e não comparecimento nos três canais e transformar o sininho em uma central com alertas de nova solicitação e de processo atribuído.

## Escopo

- Identificação institucional no topo da sidebar.
- Filtros, resultados e exportação em PDF de Relatórios.
- Cancelamento de agendamento por procedimento e avisos ao cidadão em WhatsApp, e-mail e SMS.
- Alertas internos de nova solicitação e de atribuição, com leitura por usuário.

## Leitura de contexto

- `AGENT.md` e as decisões de escopo confirmadas no chat.
- `src/App.tsx`, `src/styles.css`, `src/features/reports.tsx` e `src/features/request-filters/`.
- `shared/request-procedure-contract.js`, `shared/schedule-contract.js` e os contratos compartilhados de notificação.
- `backend/src/routes/requests.js`, `backend/src/routes/animals.js` e os serviços de ações de procedimento, agenda, permissões e envio.

## Impacto por área

### Frontend

- Usar o brasão cadastrado como única imagem no topo da sidebar. Para contas municipais, resolver o município da conta. Para master e suporte, usar o município selecionado no filtro global. Em **Todos os municípios** ou quando faltar brasão, apresentar a identificação textual e os controles do menu.
- Reaproveitar a barra, o painel lateral e os filtros removíveis de Solicitações. Aplicar o mesmo padrão de seleção, contagem e limpeza. Preservar a busca e os filtros próprios de Relatórios. Alimentar tabela, totais e PDF com o mesmo conjunto de solicitações filtradas.
- Incluir a ação **Cancelar agendamento** na aba do procedimento, com confirmação do horário selecionado. Exibir carregamento, erro de conflito e resultado da ação no modal de Processo.
- Tornar o sininho acionável e incluir contagem de não lidas, lista de alertas, estados de carregamento, vazio e erro e abertura do Processo pelo alerta.

### Backend

- Estender o endpoint de ações de procedimento para cancelar o agendamento selecionado. Reaproveitar o lock municipal de agenda, o bloqueio da linha da solicitação, o cálculo de vagas e a atualização do estado agregado.
- Definir um evento específico de cancelamento e disparar o de não comparecimento pela ação efetiva no procedimento, com deduplicação em relação ao disparo agregado. Reaproveitar o despacho independente por canal e o histórico de entregas.
- Registrar os eventos da central nas transações de criação da solicitação e alteração de responsável. Consultar os alertas e marcar leituras por meio de rotas autenticadas e escopadas.

### Banco de dados

- Criar uma migração aditiva em `backend/src/db/sql/` para eventos internos e leituras. Os eventos incluem município, solicitação, tipo, data e destinatário quando a atribuição for individual.
- Identificar a leitura pela combinação de evento e usuário. Indexar as consultas paginadas por município, data e destinatário, conforme o plano de consultas.
- Usar a identidade do evento para deduplicação. Registrar um evento de criação por solicitação e um evento por mudança efetiva de responsável. Uma atribuição A → B → A gera um novo alerta para A na volta.
- A execução de migrations exige confirmação explícita, pois o ambiente pode apontar para produção.

### Infra e publicação

- Usar o fluxo de build e deploy existente. Coordenar a aplicação autorizada da migração antes da publicação da central que depende das novas tabelas.
- Validar a estrutura e o vínculo do template de cancelamento aprovado na Meta durante a configuração do canal. Usar as credenciais, contratos e cotas já cadastrados.

## Arquivos provavelmente afetados

- Sidebar e central — trechos de `src/App.tsx`, `src/api.ts`, estilos estritamente necessários em `src/styles.css` e componentes próprios da central.
- Relatórios — `src/features/reports.tsx`, `src/features/request-filters/` e as regras antigas em `src/styles.css`.
- Procedimentos e agenda — `src/features/process-modal/`, `src/features/request-actions.ts`, `shared/request-procedure-contract.js`, `shared/schedule-contract.js` e `backend/src/services/procedure-actions/`.
- Avisos ao cidadão — `shared/notification-contract.js`, contratos de WhatsApp, e-mail e SMS, `backend/src/services/request-change-notifications.js`, `backend/src/services/notifications/` e resolução de templates ativos.
- Alertas internos — `backend/src/routes/requests.js`, `backend/src/routes/animals.js`, rotas e serviços da central, repositório de alertas, autorização e nova migração.

## O que será removido

- Ramo que renderiza a pata como imagem alternativa no topo da sidebar. Preservar os usos da pata e de seus estilos que atendem à página pública e à Adoção.
- Grade antiga de filtros de Relatórios, classificação de etapas duplicada e seletores CSS exclusivos dos elementos substituídos. A classificação compartilhada passa a atender Solicitações, Relatórios e PDF.
- Alias `cancelamento` na lista de nomes reconhecidos como **Não comparecimento** no WhatsApp. Corrigir os vínculos explícitos incompatíveis por município, preservando as outras associações e ativações.
- Botão de sininho isolado e sem ação, substituído pelo acionador da central.

## Estratégia de implementação

1. **Brasão na sidebar.** Reaproveitar o município ativo já resolvido pelo painel. Renderizar o brasão cadastrado quando disponível. Conferir os modos aberto, recolhido e móvel e os controles em contas municipais e globais.
2. **Filtros de Relatórios.** Reaproveitar a composição e a lógica compartilhada de filtros de Solicitações. Incluir etapa, tipo e responsável com seleção múltipla, contagem e limpeza. Integrar período, taxa, tipo de agenda, bairro do tutor, bairro do animal e busca. Usar a mesma lista filtrada e os mesmos rótulos para totais, tabela e PDF. Remover as regras antigas após confirmar que ficaram sem consumidores.
3. **Cancelamento por procedimento.** Adicionar a transição do procedimento agendado para aguardando agendamento. Sob o lock, validar que data, ocorrência e horário correspondem ao agendamento confirmado pelo operador. Registrar a agenda anterior no histórico, liberar a reserva correspondente quando ficar sem uso e recalcular o estado geral. Exigir agenda válida ao confirmar um agendamento. Reaproveitar o fluxo de reserva para uma nova marcação.
4. **Avisos ao cidadão.** Selecionar cancelamento e falta pela transição efetiva. Preencher a mensagem de cancelamento a partir da agenda anterior. Preservar o histórico da falta e sua regra atual de disponibilidade. Conferir cada canal, revisar as ativações existentes por município e testar os disparos com provedores simulados.
5. **Central do sininho.** Criar tabelas, consultas, autorização e captura dos eventos. Registrar criação no fluxo principal e nos de óbito e transferência de tutela. Na atribuição, comparar os IDs anterior e novo dentro do lock existente. Montar a lista paginada e atualizar a contagem quando abrir a central ou retornar ao painel. Reaproveitar o modal de Processo após confirmar acesso à solicitação.
6. **Validar os fluxos.** Executar typecheck, testes de frontend e backend e build. Entregar os pontos de conferência visual ao usuário.

## Regras de negócio identificadas

- **Cancelamento** atua no agendamento de um procedimento. O procedimento fica disponível para nova marcação e os outros procedimentos continuam no fluxo.
- Se outro procedimento do mesmo animal ocupar a mesma ocorrência e horário, a vaga permanece reservada até sair a última ocupação. Aplicar a unidade de reserva vigente.
- **Não comparecimento** continua sendo um resultado próprio, com a agenda no histórico. Registrar a falta gera seu aviso mesmo quando a solicitação ainda tem procedimentos abertos. **Indeferimento** mantém seu evento próprio.
- WhatsApp usa um template aprovado com aviso vinculado e variáveis numeradas. E-mail usa o template configurado e suas variáveis. SMS usa o texto interno e a ativação correspondente. Para cancelamento, usar protocolo, data e horário conforme o canal, e somente um motivo público quando previsto no template.
- Cada canal habilitado segue sua configuração, o template ou aviso ativo, as cotas e a preferência de acompanhamento do cidadão. Manter a política vigente de solicitações legadas. Começar os novos disparos a partir das novas transições.
- **Nova solicitação** gera alerta à equipe interna que tem acesso a Solicitações no município. **Processo atribuído** alerta apenas o novo responsável ativo e elegível. Acionar **Assumir** para si próprio dispensa o alerta de atribuição.
- A central apresenta protocolo, tipo de evento, data e estado de leitura. O acesso aos demais dados passa pelo modal autenticado do Processo.

## Regras multi-tenant e segurança

- Resolver escopo e permissões pela sessão. Usar o filtro de município para perfis globais dentro dos acessos já autorizados.
- Verificar acesso à área de Solicitações no servidor ao listar ou marcar alertas e revalidar a visibilidade do processo ao abrir. Respeitar as restrições de solicitações confidenciais.
- Confirmar a conta destinatária pelo ID, vínculo ao município, estado ativo e acesso. Tratar IDs antigos de equipe conforme a identidade real da conta.
- Manter a leitura individual. Um usuário marca somente os eventos que pode visualizar e a operação é idempotente.
- Manter na exportação de Relatórios o escopo municipal usado na consulta da tela. Usar parâmetros nas consultas e mensagens de erro sanitizadas.

## Validações necessárias

- Conferir brasão, seleção global de município, modos da sidebar e navegação por teclado.
- Validar filtros combinados, intervalo de datas, contagens, remoção individual, limpeza e recorte exportado.
- Validar procedimento e agendamento efetivos, estado em que a ação é permitida, concorrência com remarcação e recálculo de vagas.
- Conferir variáveis disponíveis, vínculo, ativação e falhas independentes em cada canal.
- Validar autorização, destinatário, paginação e estado de leitura. Exibir indisponibilidade quando o processo já tiver sido removido ou o acesso tiver mudado.

## Testes necessários

### Frontend

- Brasão do município ativo e identificação textual quando não houver imagem cadastrada.
- Filtros de Relatórios com seleção múltipla, limpeza e equivalência entre tabela, totais e PDF.
- Ação de cancelamento, confirmação, conflito de agenda e mensagens distintas para cancelamento e falta.
- Central com leitura, contagem, acesso por teclado e abertura de processo fora dos filtros atuais.

### Backend

- Cancelamento de um procedimento com outros agendados, ocupação compartilhada por animal, cancelamento concorrente com remarcação e nova reserva sem exceder a capacidade.
- Falta e indeferimento independentes, deduplicação, variáveis a partir da agenda anterior e despacho por canal conforme ativação e preferência. Ausência de evento em operação revertida.
- Eventos nas origens previstas de solicitação. Atribuição, transferência e reatribuição legítima. Repetição de atualização e autoatribuição pelo botão **Assumir**.
- Isolamento entre municípios, recusa de destinatário inelegível, acesso a solicitações confidenciais e persistência de leitura por usuário.

### Conferência visual

- O usuário confere a sidebar, os filtros, a confirmação de cancelamento e a central em desktop e celular.

## Comandos de validação

```sh
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

## Riscos e pontos de atenção

- Um vínculo manual antigo pode continuar associando o template de cancelamento ao aviso de falta mesmo após a remoção do alias. Revisar as ativações por município.
- Usar a agenda já limpa ao montar a mensagem perde data e horário. Usar o agendamento anterior registrado na transação.
- Derivar falta apenas pelo status agregado pode omitir o aviso em solicitações com vários procedimentos. Selecionar o evento pela ação efetiva.
- Uma chave única permanente por processo e responsável impediria novos alertas em reatribuições legítimas. Diferenciar as transições.
- A central envolve novos dados e permissões. Testar a execução com a migração aplicada em ambiente autorizado antes do deploy.

## Decisões aprovadas

- Cancelar o agendamento de um procedimento e mantê-lo disponível para nova marcação.
- Mostrar o brasão cadastrado como única imagem de identificação no topo da sidebar.
- Dispensar o alerta da central em autoatribuição pelo botão **Assumir**.

## Critérios de aceite

- A sidebar mostra o brasão aplicável ao município ativo e permite navegar com os controles existentes em todos os tamanhos.
- A experiência de filtragem em Relatórios segue Solicitações e todos os resultados refletem o recorte aplicado.
- Cancelamento e falta geram avisos independentes nos três canais conforme a configuração de cada município. A liberação de vagas respeita as reservas remanescentes.
- A central registra novas solicitações e atribuições, mostra a contagem correta, salva a leitura por usuário e abre somente processos autorizados.

## Observações para implementação

- Usar este plano e seguir `AGENT.md`.
- Executar a migração somente após confirmação explícita.
- Deletar os trechos substituídos e manter os componentes compartilhados com consumidores ativos.
