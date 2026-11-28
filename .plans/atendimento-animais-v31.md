# Plano de implementação — Atendimento de animais v31

## Origem

- Especificação visual e de interação [atendimento_animais_v31.html](C:/Users/rodri/Downloads/atendimento_animais_v31.html).
- Planejamento aprovado em 27/11/2026.
- Classificação **fullstack**. A troca do modal afeta o frontend React, as ações do backend Express e os contratos compartilhados. Os campos atuais do PostgreSQL comportam as mudanças previstas.

## Resumo

Substituir o modal de atendimento aberto por Processos e pela Agenda por uma única implementação do HTML v31, conectada aos dados reais. Adotar os fluxos de agendamento em grupo, resultados em lote, encerramento explícito e receita unificada. Excluir as funções, interfaces e conexões exclusivas do fluxo substituído depois de atualizar os consumidores.

## Escopo

### Dentro do escopo

- Cabeçalho, abas, rodapé, controles e janelas conforme o v31, com uma implementação usada pelos dois pontos de entrada.
- Atribuição a setor com responsável opcional, opção de assumir, agenda de grupo, resultados individuais ou em lote, remoção com motivo e encerramento explícito.
- Análise documental, documentos complementares, dados do tutor, receita unificada, relatório e histórico com dados reais.
- Operações em lote no backend, preservação da contagem de vagas e leitura dos registros existentes.
- Remoção dos componentes, estilos, funções, handlers e conexões que perderem todos os consumidores após a troca.

### Fora do escopo

- Redesenho do cadastro público, da Agenda e das telas fora do modal.
- Reestruturação dos fluxos de denúncia, óbito e troca de tutor.
- Migrations, alterações de infraestrutura, mudanças de deploy e limpeza de dados históricos.

## Leitura de contexto

- [AGENT.md](../AGENT.md) e [HTML v31](C:/Users/rodri/Downloads/atendimento_animais_v31.html).
- [Modal atual](../src/features/process-modal/process-modal.tsx), [origem na Agenda](../src/features/agenda/agenda-view.tsx), [origem em Processos](../src/App.tsx) e [ações da solicitação](../src/features/request-actions/request-actions.ts).
- [Ações de procedimento](../backend/src/services/procedure-actions/procedure-action-handler.js), [estado da solicitação](../backend/src/services/procedure-actions/procedure-request-state.js), [reserva da agenda](../backend/src/services/schedule/schedule-booking.js) e [contrato da agenda](../shared/schedule-contract.js).
- [Revisão documental](../backend/src/services/documents/document-reviews.js), [serviço de dados do tutor](../backend/src/services/auth/tutor-data-handlers.js), [histórico](../backend/src/services/request-history.js) e [PDF do processo](../src/features/process-report/process-report-pdf.ts).

## Impacto por área

### Frontend

- Abrir **Procedimento e saúde**, como no v31. Exibir protocolo, tutor, resumo do agendamento e os ícones **Baixar relatório** e **Fechar** no cabeçalho. Reproduzir as quatro abas, com **Análise de documentos** no lugar de **Anexos**.
- Exibir **Definir responsável** em todas as abas. Em **Procedimento e saúde**, exibir **Salvar** e **Agendar** ou **Gerenciar agendamento** conforme a situação. Em **Dados do tutor**, alternar entre **Editar dados** e **Salvar alterações**. Posicionar **Receita unificada** na lista de animais.
- Reproduzir a lista de animais e procedimentos com seleção por item, por animal e em **Todos realizados**. Mostrar a ficha de saúde do animal selecionado, a situação dos itens e a remoção com confirmação e motivo.
- Usar a agenda e os documentos reais na apresentação do v31. Vincular a conferência às versões dos arquivos. Exibir documentos complementares, erros de validação, progresso e o resultado da gravação.
- Agrupar os eventos do **Histórico** por data e mostrar hora, responsável e descrição quando registrados. Usar o relatório e as rotinas de PDF municipal do projeto.
- Reaproveitar os componentes de foco e fechamento dos diálogos. Bloquear uma ação enquanto estiver em gravação e atualizar botões, contagens e histórico com o estado devolvido pelo servidor.

### Backend

- Adaptar a rota autenticada de ações de procedimento para agendar ou reagendar em grupo, registrar resultados e saúde em lote, remover com motivo e encerrar explicitamente. Usar o serviço existente como ponto de entrada e consolidar as regras de cada ação.
- Revalidar a seleção, a situação atual, as exigências documentais e as vagas dentro da transação. Reutilizar a trava de agenda por prefeitura e o bloqueio do registro do processo. Gravar resultados, informações clínicas, reservas e histórico de forma atômica em cada operação em lote.
- Permitir atribuição à fila do setor e validar o responsável escolhido no diretório da prefeitura. Reaproveitar os serviços de revisão documental, auditoria do tutor, numeração de receita, atualização do prontuário e notificações.
- Registrar no servidor a data e o autor das ações. Usar o estado efetivamente salvo para avisos e atualização da agenda. A emissão ou a consulta de receitas usa identificação profissional e a sequência do município.

### Banco de dados

Usar `requests.animals`, `requests.workflow_data` e `requests.history` para as informações adicionais de resultados, agendamento, encerramento, receitas e histórico. Manter a compatibilidade da leitura com os registros existentes e com os quatro valores aceitos pela coluna `requests.status`. Estão previstas mudanças no conteúdo desses campos, sem alterações de schema.

> Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado. A geração de PDFs segue a infraestrutura de documentos do projeto.

## Arquivos provavelmente afetados

- Modal, abas, diálogos, hooks e testes em [src/features/process-modal](../src/features/process-modal), além dos estilos correspondentes em [styles.css](../src/styles.css).
- Pontos de entrada e API em [App.tsx](../src/App.tsx), [agenda-view.tsx](../src/features/agenda/agenda-view.tsx), [request-actions.ts](../src/features/request-actions/request-actions.ts) e [api.ts](../src/api.ts).
- Contratos em [request-procedure-contract.js](../shared/request-procedure-contract.js) e [schedule-contract.js](../shared/schedule-contract.js).
- Rota de [requests](../backend/src/routes/requests.js), serviços em [procedure-actions](../backend/src/services/procedure-actions), [schedule-booking.js](../backend/src/services/schedule/schedule-booking.js), [document-reviews.js](../backend/src/services/documents/document-reviews.js) e [request-history.js](../backend/src/services/request-history.js).
- Receitas, relatório e leitura dos registros em [src/features/process-report](../src/features/process-report) e [animal-record-pdf.ts](../src/features/municipal-documents/animal-record-pdf.ts).

## O que será removido

- **Ver procedimentos** e `showProcedures`. A navegação passa pela aba **Procedimento e saúde**.
- **Reatribuir**, o botão separado **Assumir** e o caminho exclusivo `onAssume` / `assumeFromPreview`. A seleção **Eu — assumir atendimento** passa a integrar **Definir responsável**.
- **Confirmar agenda** fora do calendário. A confirmação passa a ocorrer na janela de agendamento do v31.
- **Cancelar agendamento** e **Indeferir procedimento** no modal de atendimento. Deletar `CancelScheduleDialog` e os callbacks, tipos e estados exclusivos desses diálogos. Após a verificação de consumidores, excluir os ramos de mutação `cancel_schedule` e `reject` exclusivos dos procedimentos substituídos, incluindo seus validadores e notificações específicas que ficarem órfãs. A leitura de indeferimentos e cancelamentos históricos continua nos componentes e relatórios em uso.
- A implementação parcial e sem consumidor em `process-procedure-actions.tsx` e as props de cabeçalho e rodapé que perderem uso.
- O salvamento sequencial com uma chamada por procedimento, incluindo o caminho correspondente em `saveDraftsAndClose`. O novo salvamento em lote cobre os rascunhos de saúde e de atendimento.
- A interface isolada de emissão por procedimento que for substituída pela janela **Receita unificada**. Reutilizar validação, numeração e geração de PDF nesses fluxos.
- Imports, estilos, testes de controles retirados e métodos de API que ficarem sem consumidores em **Processos**, **Agenda**, relatórios ou notificações. Deletar os itens órfãos junto com a troca do fluxo.

## Estratégia de implementação

1. Conciliar as alterações parciais já presentes no modal e conectar **Processos** e **Agenda** à mesma implementação do v31. Conferir os nomes e estados com o HTML.
2. Adaptar os contratos e as transações de agenda, procedimentos e encerramento. Usar o horário solicitado como referência do cadastro e preservar horários diferentes já gravados até que o operador confirme uma alteração. Confirmar a capacidade para o grupo antes da gravação.
3. Conectar o formulário de setor e responsável, o calendário, a seleção de resultados, os dados clínicos e as janelas de remoção e encerramento. Reaproveitar a validação de saúde e a confirmação de microchip do prontuário.
4. Integrar documentos, tutor, receitas, relatório e histórico. Usar registros persistidos no lugar dos dados ilustrativos. Manter emissão, consulta e download das receitas documentados por animal e vinculados ao procedimento quando selecionado.
5. Atualizar os consumidores, deletar os caminhos substituídos e conferir referências de funções, tipos, estilos, componentes e rotas. Executar as validações do projeto ao final.

## Regras de negócio identificadas

- **Vagas.** Reservar uma vaga por animal para cada combinação de data, local e horário. Dois animais com três procedimentos no mesmo horário ocupam duas vagas. A confirmação reaproveita a reserva feita no cadastro. A vaga de um animal só é liberada quando terminar o último procedimento aberto que ocupa aquele horário.
- **Reagendamento.** Mover os procedimentos pendentes conforme a seleção do atendimento e validar todas as vagas antes de confirmar. Um horário insuficiente conserva a reserva anterior. Abrir um processo antigo preserva os horários gravados.
- **Atribuição.** O setor é obrigatório e o responsável pode ficar em branco para encaminhar à fila. Em solicitações públicas, a confirmação da agenda exige responsável. **Eu — assumir atendimento** salva o usuário logado quando elegível e com o processo sem responsável ou atribuído a outra pessoa.
- **Resultados.** Aceitar a marcação individual, por animal ou de todos os elegíveis. Gravar **Não compareceu** nos itens selecionados. **Remover procedimento** exige motivo e conserva o item no histórico.
- **Encerramento.** Habilitar **Atendimento Encerrado** após classificar todos os procedimentos. Registrar **Conclusão positiva** com pelo menos um realizado e **Encerrado sem realização** com zero realizados. Mapear os dois resultados para a situação correspondente do sistema e dos relatórios.
- **Documentos.** Permitir **Deferir** e **Indeferir** enquanto a versão estiver pendente. Exigir justificativa na confirmação de **Indeferir** e usar o motivo no histórico e na orientação ao tutor. Validar formato e tamanho dos documentos complementares com a política do servidor.
- **Receitas.** Concentrar a edição por animal em **Receita unificada**, com procedimento opcional. Usar os PDFs e números reais. Permitir consultar emissões anteriores e conservar a rastreabilidade das alterações.
- **Solicitações especiais.** Denúncia, óbito e troca de tutor seguem as decisões correspondentes ao tipo. Os novos lotes e controles de agenda se aplicam aos atendimentos com procedimentos.

## Regras multi-tenant e segurança

- Resolver o município pelo processo e pelo usuário autenticado conforme `tenant.js` e `lockRequestForUpdate`. Escopar leituras, atualizações, vagas, documentos, membros de setor e números de receita pela prefeitura autorizada.
- Restringir mutações à equipe interna autorizada. Persistir datas, autores, vínculos e resultados no backend. Validar todos os identificadores do lote antes de alterar o registro.
- Proteger os campos derivados da agenda, dos procedimentos e do encerramento no cadastro e na atualização genérica. Preservar as regras de dados visíveis ao tutor e à equipe em consultas, histórico e PDFs.

## Validações necessárias

- Identidade do processo, município, setor, responsável, animal e procedimento. Estado atual e duplicidade dos alvos em cada lote.
- Data, local, horário, capacidade e documentos exigidos para confirmar ou reagendar. Mudanças concorrentes devem receber um conflito e conservar o estado salvo.
- Resultado permitido, motivo de remoção, código do microchip quando exigido, justificativa de indeferimento e identificação profissional das receitas.
- Tipo, tamanho e versão dos arquivos. Quaisquer notificações devem refletir uma operação já gravada.

## Testes necessários

### Frontend

- Abertura pela Agenda e por Processos, abas e botões conforme o v31, edição do tutor e troca de seleção entre vários animais.
- Habilitação do calendário, salvamento em lote, falta, remoção, conclusão e decisões de documento. Depois da gravação, a interface reflete os botões e estados devolvidos pelo servidor.
- Consulta de processos antigos, receitas emitidas, histórico e solicitações especiais.

### Backend

- Vagas por animal, reserva reutilizada, última vaga concorrente, reagendamento sem capacidade e liberação do horário quando termina o último procedimento do animal nele.
- Lote válido e lote com item inválido, repetição de envio, encerramento com e sem realização e remoção com registro de motivo.
- Isolamento por prefeitura, responsável fora do setor, decisão repetida de documento e emissão numerada. Verificar atualização do prontuário, histórico, relatório e avisos após gravação.

### Conferência manual na tela

- Comparar com o HTML v31 as quatro abas, o cabeçalho e as ações disponíveis em cada aba. Conferir o rodapé em largura de celular e a seleção por item, animal e todos.
- Validar com dois animais e três procedimentos no mesmo horário e repetir com uma única vaga disponível. Conferir agenda, relatório e histórico após salvar e reabrir o processo.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

## Riscos e pontos de atenção

- A agenda atual tem reservas por horário e por procedimento. Agrupar operações exige conferir a capacidade final da seleção e transferir as vagas na mesma transação.
- O encerramento passa a ser explícito e afeta relatórios, avisos e filtros. Os resultados individuais, as datas registradas e os horários antigos precisam continuar legíveis.
- O modal parte de duas telas. Alterar ou remover uma função exige conferir ambos os pontos de entrada e os consumidores de agenda, prontuário, relatórios e notificações.
- A receita unificada deve reunir os documentos com a numeração da prefeitura e manter acessíveis as emissões anteriores.

## Perguntas em aberto

Nenhuma. Foram aprovadas as regras de encerramento com zero realizados, atribuição inicial só ao setor e justificativa obrigatória no indeferimento de documento.

## Critérios de aceite

- **Processos** e **Agenda** abrem o mesmo modal com o layout e os fluxos do v31 ligados ao sistema.
- A agenda reserva vagas por animal e horário. Confirmações, mudanças e repetições respeitam a capacidade. Lotes inválidos são recusados sem gravação parcial.
- As ações de documentos, resultados, remoção, receitas e encerramento respeitam as permissões, os estados e os registros de histórico aprovados.
- Processos antigos, horários distintos já gravados, receitas e fluxos de solicitações especiais continuam consultáveis.
- Os controles e caminhos substituídos foram removidos, com itens órfãos deletados. Typecheck, testes de frontend e backend e build passam.

## Observações para a skill `implementar`

- Usar este plano, o HTML v31 e o `AGENT.md` como fontes de escopo.
- Aplicar a lista de remoções nos dois pontos de entrada e verificar as referências compartilhadas.
- Executar a implementação em uma invocação separada da skill `/implementar`.
