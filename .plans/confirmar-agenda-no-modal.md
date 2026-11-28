# Plano de implementação — Confirmar Agenda no modal de processo

## Origem

- Especificação aprovada na conversa sobre **Confirmar Agenda** e **Gerenciar agendamento**. O fluxo anterior foi registrado no [plano Atendimento de animais v31](atendimento-animais-v31.md).
- Planejamento aprovado em 28/11/2026.
- Classificação **fullstack**.

## Resumo

O tutor escolhe unidade, data e horário na etapa **Agenda** do formulário público. A equipe confere os documentos e usa **Confirmar Agenda** para confirmar a reserva que já consta no processo. As abas **Análise de documentos** e **Procedimento e saúde** oferecem a mesma ação de agenda no rodapé. O calendário do modal é aberto pela ação **Reagendar**.

## Escopo

### Dentro do escopo

- Mostrar **Confirmar Agenda** nas duas abas enquanto houver procedimentos abertos com confirmação pendente. Usar a reserva vigente e informar o motivo quando a ação estiver bloqueada.
- Mostrar **Gerenciar agendamento** nas duas abas após a confirmação, com as ações aplicáveis de **Reagendar**, **Não compareceu** e **Atendimento Encerrado**. Preservar o acesso ao encerramento quando todos os procedimentos já tiverem resultado.
- Permitir **Reagendar** quando a reserva ainda não confirmada tiver vencido ou perdido disponibilidade. A reserva substituta fica aguardando **Confirmar Agenda**.
- Revalidar documentos, responsabilidade, estado do processo e disponibilidade no servidor. Registrar as mudanças em histórico e emitir os avisos correspondentes.

### Fora do escopo

- Reenvio ou substituição de documento obrigatório indeferido no mesmo protocolo.
- Redesenho do formulário público, da tela Agenda e das ações dos processos sem agenda.

## Leitura de contexto

- [AGENT.md](../AGENT.md) e [plano Atendimento de animais v31](atendimento-animais-v31.md).
- [Modal](../src/features/process-modal/process-modal.tsx), [rodapé](../src/features/process-modal/process-footer.tsx), [diálogo de reagendamento](../src/features/process-modal/reschedule-dialog.tsx) e [entrada pela Agenda](../src/features/agenda/agenda-view.tsx).
- [Rota de solicitações](../backend/src/routes/requests.js), [serviço de ações do procedimento](../backend/src/services/procedure-actions/procedure-action-handler.js), [regras de documentos](../backend/src/services/procedure-actions/procedure-documents.js), [reserva da agenda](../backend/src/services/schedule/schedule-booking.js) e [contrato compartilhado](../shared/request-procedure-contract.js).

## Impacto por área

### Frontend

- Usar o rodapé compartilhado para renderizar a mesma ação de agenda nas duas abas. O botão **Confirmar Agenda** envia a ação diretamente, usando o protocolo e a versão em tela. Exibir unidade, data e horário da reserva vigente e reaproveitar o resumo do horário solicitado.
- Aplicar os bloqueios existentes de permissão, gravação, documentos obrigatórios, responsável e resultados com alterações pendentes. Exibir o motivo junto à ação bloqueada e atualizar a interface com o estado devolvido pelo servidor. Após confirmar, trocar o botão pelo menu de gerenciamento nas duas abas.
- Se a reserva pendente estiver indisponível, mostrar o motivo e oferecer **Reagendar** quando o processo estiver apto. Abrir o calendário apenas ao executar essa ação. Reaproveitar o diálogo de seleção de outra data, local e horário, com seus estados de carregamento, falta de vagas e falha.

### Backend

- Adaptar a ação existente `confirm_schedule` para extrair a seleção do horário vigente gravado nos procedimentos abertos, com a leitura compatível dos registros anteriores. Vincular a confirmação a um único horário identificável e preservar o horário originalmente solicitado no histórico do processo.
- Reusar a transação e as travas do processo e da agenda municipal. Validar estado, documentos, responsabilidade e capacidade antes de atualizar em conjunto os procedimentos abertos. A contagem exclui a reserva do próprio processo ao calcular a disponibilidade e aplica uma vaga por animal.
- Usar `reschedule` para receber a nova seleção. Antes da primeira confirmação, o servidor só aceita a troca se a reserva vigente estiver comprovadamente indisponível ou não puder ser identificada com os dados existentes. Nesse caso, gravar a nova reserva com os procedimentos ainda aguardando confirmação. Em um reagendamento de reserva confirmada, aplicar as regras vigentes para esse estado.
- Registrar o horário efetivamente alterado, autor e data. Emitir o aviso de confirmação após a primeira confirmação gravada. Se houver aviso de alteração para a reserva pendente, o texto precisa informar que a confirmação continua pendente.

### Banco de dados

Usar os campos existentes `requests.animals`, `requests.workflow_data` e `requests.history` para a reserva, os resultados e a trilha de ações. Sem impacto esperado no esquema.

> Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- Frontend: `src/features/process-modal/process-modal.tsx`, `process-footer.tsx`, `reschedule-dialog.tsx`, `process-types.ts` e `process-components.test.tsx`.
- Backend: `backend/src/services/procedure-actions/procedure-action-input.js`, `procedure-action-apply.js` e, conforme a resposta de indisponibilidade, `procedure-action-handler.js` e `backend/src/services/schedule/schedule-booking.js`.
- Avisos e testes: `backend/src/services/request-change-notifications.js`, `backend/test/request-procedure-actions.test.js` e `backend/test/request-change-notifications.test.js`.
- Contratos a reaproveitar: `shared/schedule-contract.js` e `shared/request-procedure-contract.js`.

## O que será removido

- O gatilho **Agendar** e a opção duplicada **Agendar** do menu inicial.
- O modo **Agendar solicitação** do diálogo, incluindo o ramo de seleção inicial, a pré-seleção usada só por esse modo e seus textos, propriedades e estados exclusivos.
- A seleção de agenda como entrada de `confirm_schedule` no frontend e no backend. A seleção enviada pelo cliente pertence a `reschedule`.
- Imports, callbacks, controles e expectativas de teste que ficarem sem consumidores após a troca.

## Estratégia de implementação

1. Derivar o horário vigente pela leitura compartilhada da reserva. Fazer `confirm_schedule` validar a transição e confirmar esse horário dentro da transação existente. Identificar falhas de disponibilidade de forma que o modal consiga diferenciá-las dos demais bloqueios.
2. Adaptar `reschedule` para recuperar uma reserva pendente indisponível sob as mesmas travas. Validar vagas no destino, persistir a substituição e registrar o reagendamento. Em caso de falha, conservar a reserva e o estado anteriores.
3. Ligar **Confirmar Agenda** à confirmação direta nas duas abas e oferecer o menu ou o caminho de recuperação conforme o estado. Enxugar o calendário para o uso exclusivo de **Reagendar**.
4. Atualizar tipos, chamadas, histórico, avisos e testes afetados. Conferir os dois pontos de entrada do modal, inclusive em tela estreita.

## Regras de negócio identificadas

- A data inicial é escolhida pelo tutor no formulário. A confirmação usa unidade, data e horário da reserva vigente vinculada ao protocolo.
- Os documentos obrigatórios dos procedimentos ativos precisam estar aprovados. Para processos de origem pública, o setor e o usuário responsável precisam estar definidos. Aplicar as regras existentes aos registros internos.
- Dois animais com três procedimentos no mesmo horário ocupam duas vagas. Confirmar preserva essa contagem. Reagendar muda a reserva do grupo em uma única operação.
- A perda da reserva vigente habilita a recuperação pelo **Reagendar**. Depois de reservar um novo horário nesse caso, o processo continua aguardando **Confirmar Agenda**. O horário pedido no cadastro permanece disponível para consulta histórica.
- A confirmação ocorre uma vez por transição. As ações de ausência e encerramento continuam dependentes do estado e dos resultados dos procedimentos.

## Regras multi-tenant e segurança

- Obter a prefeitura do processo autenticado e validar o vínculo do usuário interno, a permissão de edição e a situação do processo. Consultar o horário e as vagas na agenda dessa prefeitura.
- Validar a versão do processo e reaplicar as regras de documentos, atribuição e disponibilidade dentro da transação. Gravar histórico e estado juntos. Solicitações repetidas ou desatualizadas ficam sem efeito adicional.

## Validações necessárias

- Para confirmar, exigir uma reserva atual identificável, uma ocorrência e um horário válidos e capacidade para os animais elegíveis. Aplicar as regras de vencimento da agenda.
- Para reagendar, validar a seleção no município do processo, o horário de destino, a capacidade e a elegibilidade da transição. Em reserva pendente, revalidar também a indisponibilidade da reserva atual.
- Distinguir falhas de horário ou capacidade dos bloqueios documentais, de atribuição, de permissão e de versão. Só sinalizar a recuperação por **Reagendar** quando o horário vigente estiver indisponível.

## Testes necessários

### Frontend

- Conferir a mesma ação nas duas abas conforme o estado. Validar confirmação direta, ausência de abertura de calendário, mensagem de bloqueio por documentos ou responsável e prevenção de clique repetido durante a operação.
- Conferir que o calendário abre por **Reagendar**, que uma reserva pendente substituída volta ao estado de confirmação e que o menu aparece após confirmar. Cobrir a visibilidade das ações de ausência e encerramento conforme o estado.

### Backend

- Confirmar o horário persistido sem seleção no pedido. Cobrir entrada com horário diferente, documentos e responsável pendentes, usuário de outra prefeitura, versões concorrentes e repetição sem novo evento ou aviso.
- Confirmar uma solicitação com vários procedimentos para mais de um animal e verificar a contagem de vagas. Testar recuperação com data vencida ou horário removido, rejeição da troca quando a reserva pendente estiver válida, rollback quando o destino estiver lotado e confirmação posterior do novo horário.

### Conferência manual em tela

- Abrir o mesmo tipo de processo pelas telas de Solicitações e Agenda. Conferir o rodapé nas duas abas em desktop e em tela estreita. Confirmar a reserva após aprovar os documentos, abrir o calendário via **Reagendar** e conferir a sequência na aba **Histórico**.

## Comandos de validação sugeridos

```powershell
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

## Riscos e pontos de atenção

- Registros antigos podem trazer uma reserva incompleta ou ambígua. Usar os dados que identificarem um único horário e mostrar a recuperação explícita nos demais casos.
- Capacidade e versão podem mudar entre a abertura do modal e o clique. Tratar a decisão do servidor como definitiva e manter a reserva anterior em caso de falha.
- A confirmação muda de contrato no frontend e no backend. Validar as duas pontas juntas e conferir os textos dos avisos para horário alterado e horário confirmado.

## Perguntas em aberto

Nenhuma pergunta em aberto para o escopo aprovado.

## Critérios de aceite

- **Análise de documentos** e **Procedimento e saúde** mostram **Confirmar Agenda** para a reserva pendente e **Gerenciar agendamento** para a confirmada. O motivo do bloqueio fica visível quando a confirmação estiver indisponível.
- **Confirmar Agenda** confirma o horário já reservado, preserva a contagem de vagas e gera um único registro de confirmação no **Histórico**. A mudança é refletida nas duas abas.
- No modal, **Reagendar** é a única ação que abre o calendário. Uma reserva pendente indisponível pode ser substituída e fica aguardando confirmação. Se a substituição falhar, a reserva anterior continua registrada.
- O botão **Agendar** e as conexões exclusivas do fluxo inicial foram removidos.

## Observações para a skill `implementar`

- Usar este plano e seguir [AGENT.md](../AGENT.md).
- Excluir os itens listados em **O que será removido** e atualizar os testes descritos.
- A implementação começa com uma solicitação separada à skill `implementar`.
