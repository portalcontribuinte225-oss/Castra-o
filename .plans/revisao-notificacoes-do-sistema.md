# Plano de implementação — Revisão das notificações do sistema

## Origem

- Especificação aprovada na conversa de revisão dos avisos da interface e dos envios ao tutor.
- Data do planejamento: 28/11/2026.
- Classificação: `fullstack`. A interface exibe o feedback e a API distingue as falhas de envio das falhas de registro no histórico.

## Resumo

Agenda e Solicitações exibem dois avisos quando uma ação salva também gera um envio ao tutor. Os cartões aparecem no canto inferior direito, sem fundo opaco. A revisão consolida o feedback da ação em um aviso no topo direito, acima dos modais, e padroniza as mensagens que precisam ficar junto ao formulário ou ao documento.

## Escopo

- Uma fila compartilhada de avisos flutuantes para Agenda e Solicitações, com o componente existente renderizado acima dos modais.
- Feedback de confirmação de agenda, reagendamento, ausência, encerramento, salvamento, atribuição e decisões dos processos especiais.
- Avisos contextuais de documentos, cadastro, adoção, credenciamento, acesso e configurações. Priorizar as mensagens com resultado ambíguo ou que repetem um aviso flutuante.
- Resultados de envio por canal e estado separado para falha de gravação do histórico.
- Conferência dos sete avisos de acompanhamento e dos usos de acesso por e-mail, SMS e WhatsApp. A revisão de código cobre os dados fornecidos aos templates. O texto publicado no EmailJS e na Meta requer leitura nos painéis externos.

## Leitura de contexto

- `AGENT.md` e especificação aprovada na conversa.
- `src/components/toast-container.tsx`, `src/styles.css`, `src/App.tsx` e `src/features/agenda/agenda-view.tsx` para apresentação, filas e temporizadores.
- `src/features/request-actions/request-actions.ts`, `src/features/notifications/notification-results.ts` e `src/features/process-modal/use-attachment-actions.ts` para composição e tratamento dos resultados.
- `backend/src/services/request-change-notifications.js`, `backend/src/services/notifications/dispatch-notification.js` e os contratos de notificações e acesso em `shared/`.

## Impacto por área

### Frontend

- Reaproveitar `ToastContainer` e o padrão de portal usado pelos diálogos do projeto. Montar uma única camada na área autenticada, fora do empilhamento de cada tela. Usar o topo direito, largura responsiva, fundo opaco, ícone e tom por status, título curto, detalhe opcional e botão de fechar com nome acessível.
- Manter o foco no controle em uso, inclusive com um diálogo secundário aberto. Anunciar o resultado aos leitores de tela. Dar tempo curto aos sucessos simples e manter no formulário as mensagens que pedem correção.
- Produzir um aviso por ação com seu resultado no título. Aceite total fica disponível por canal no Histórico. Aceite parcial, falha ou indisponibilidade entram como detalhe do mesmo aviso, com os nomes dos canais conhecidos.
- Usar mensagens específicas para confirmar agenda, reagendar, registrar ausência, encerrar, assumir, definir responsável ou enviar o processo à fila do setor. Distinguir **Reserva atualizada** acompanhada de **Aguardando confirmação da agenda** de **Reagendamento salvo** para uma agenda já confirmada.
- Exibir deferimento e indeferimento na linha do anexo. Apresentar falhas de gravação de documentos na aba **Análise de documentos**. No credenciamento, dizer **Credenciamento aprovado** ou **Credenciamento recusado** e exibir a senha inicial em área própria, restrita ao fluxo autorizado.
- Reutilizar os padrões existentes de avisos contextuais para mensagens de campo, carregamento, salvamento e erro. O sino é a caixa de entrada de **Nova solicitação** e **Processo atribuído a você**.

### Backend

- Preservar `notificationResults` como lista de resultados efetivos dos canais. Retornar à parte a falha de registro do histórico em metadados da resposta. Falhas sem canal identificável recebem mensagem geral.
- Ajustar os consumidores do registro de resultados para lidar com a falha de histórico sem transformar uma ação já salva em erro da operação. Cobrir tanto a rota de atualização da solicitação quanto as ações de procedimento. Conferir também os consumidores de registro e lembrete que rodam em segundo plano.
- Usar os motivos e códigos seguros de entrega já existentes. Distinguir aceito pelo provedor, indisponível e falha no envio. O histórico continua consultável por canal e por ação.
- Conferir registro, confirmação, lembrete, reagendamento, ausência, conclusão e indeferimento. Em recuperação de senha, confirmação de contato e acesso à solicitação, conferir o código, o prazo quando aplicável e o canal selecionado. Incluir o aviso de contato alterado na revisão de textos.

### Banco de dados

A entrega usa o histórico e o esquema existentes.

> Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infraestrutura e publicação

A entrega usa o fluxo atual de build e publicação. Os testes de canal usam transportes simulados. A publicação segue a autorização explícita definida no `AGENT.md`.

## Arquivos provavelmente afetados

- `src/App.tsx`, `src/features/agenda/agenda-view.tsx`, `src/components/toast-container.tsx` e `src/styles.css`.
- `src/features/request-actions/request-actions.ts`, `src/features/notifications/notification-results.ts`, `src/features/process-modal/use-attachment-actions.ts` e os componentes dos avisos contextuais identificados, incluindo `src/features/access-requests/access-requests-view.tsx`.
- `backend/src/services/request-change-notifications.js`, `backend/src/services/procedure-actions/procedure-action-handler.js`, `backend/src/routes/requests.js` e os consumidores do registro de resultados que precisarem da adaptação.
- Testes de avisos, ações de processo, histórico, envios e recuperação. Usar um contrato em `shared/` para os valores de domínio efetivamente compartilhados.

## O que será removido

- Deletar as filas locais, os temporizadores duplicados e as duas montagens de `ToastContainer` em Agenda e Solicitações após instalar a fila compartilhada.
- Deletar a chamada que cria um segundo cartão para complementar o resultado da mesma ação. Usar a composição do feedback único.
- Deletar a inclusão artificial de uma falha de e-mail quando falha a gravação no histórico. Deletar a atribuição a um canal em falhas gerais nas quais ele não pôde ser identificado.
- Deletar o fechamento por clique no cartão inteiro e os estilos do posicionamento inferior e do botão de fechar vermelho usado por todos os tipos.
- Deletar o aviso flutuante quando seu erro já é apresentado no formulário ou no modal. Substituir os textos genéricos pelo resultado correspondente à ação e pelos canais identificados.

## Estratégia de implementação

1. Centralizar a fila e reaproveitar o componente para aplicar a posição, o empilhamento, os estilos, os tempos de exibição e o fechamento acessível.
2. Ajustar o contrato de resposta para representar falhas de histórico e de envio. Atualizar os consumidores e os testes existentes com o resultado real de cada canal.
3. Compor um único aviso a partir da ação e dos resultados disponíveis. Usar as mensagens específicas de cada operação e manter o feedback de documentos no anexo ou na aba.
4. Padronizar os avisos contextuais identificados. Conferir as mensagens, eventos e campos enviados pelos canais e registrar a necessidade de conferência dos templates externos.
5. Remover os fluxos substituídos e executar os testes aplicáveis, checagem de tipos e build sobre a versão final.

## Regras de negócio

- Uma operação salva gera um resultado de sucesso da ação. Falhas de aviso ou de histórico aparecem como detalhe do resultado.
- A disponibilidade do canal e a autorização de acompanhamento determinam os envios. A confirmação da agenda usa a reserva vigente. A substituição de uma reserva antes da confirmação continua aguardando confirmação.
- O texto da interface descreve o que foi salvo e o status que a resposta confirma. Citar o canal afetado quando o resultado o identifica.
- O detalhe por canal fica no Histórico. O status dos documentos fica na própria aba de análise.

## Regras multi-tenant e segurança

- Usar o município e as permissões do processo devolvidos pelo servidor. Limpar avisos ao encerrar a sessão ou trocar o contexto municipal.
- Manter o histórico restrito às permissões atuais de acesso ao processo. Expor somente dados e motivos de envio já saneados.
- Exibir a senha inicial do credenciamento apenas na área autorizada. Manter credenciais, códigos de recuperação e respostas brutas do provedor fora dos avisos flutuantes.

## Validações e testes

### Frontend

- O mesmo fluxo a partir de Agenda ou Solicitações apresenta um único aviso com título, tom e detalhe esperados.
- Cobrir aceite total, envio parcial, falha total, acompanhamento desativado, falha de histórico e erro da própria operação.
- Validar os textos de atribuição, reserva pendente, reagendamento e credenciamento. Confirmar a exibição de erro no contexto do documento ou do formulário.

### Backend

- Cobrir ação salva com falha de gravação do histórico. A resposta preserva os resultados reais e identifica a falha de registro separadamente.
- Cobrir falhas gerais, motivos seguros, autorização de acompanhamento e preservação das regras de envio por município.
- Com transportes simulados, validar o código gerado para redefinição e o uso do mesmo código para concluir a operação nos três canais.

### Interface

- Na conferência de tela solicitada, verificar desktop e tela estreita com modal principal e diálogo secundário abertos. Conferir legibilidade, empilhamento, fechamento e foco do teclado.

### Comandos de validação da implementação

```bash
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

## Riscos e pontos de atenção

- Renderizar o aviso na camada de uma tela pode reproduzir a sobreposição incorreta. Usar o portal e validar a convivência com os diálogos existentes.
- Misturar o estado da operação com o resultado do envio pode induzir o usuário a repetir uma ação já gravada. Manter esses dados separados no contrato e combinados corretamente no aviso.
- Um erro pós-gravação exige preservar o resultado salvo na resposta. Preservar também a compatibilidade da lista por canal dos consumidores existentes.
- O texto de um template publicado pode divergir dos parâmetros fornecidos pelo sistema, especialmente na recuperação de senha.

## Pergunta em aberto

Os templates ativos do EmailJS e da Meta usam os campos esperados? A conferência no painel de cada serviço depende de acesso a ele. A interface, o histórico e os parâmetros enviados podem ser implementados e validados pelo repositório.

## Critérios de aceite

- Agenda e Solicitações usam a mesma fila, com cartões opacos no topo direito acima dos modais e comportamento consistente em tela estreita.
- Cada ação apresenta um único resultado visível. Um alerta de entrega identifica o canal quando conhecido e uma falha de histórico aparece como tal.
- Os avisos dizem qual resultado foi salvo. Os erros que exigem correção aparecem junto ao campo, documento ou modal correspondente.
- O Histórico informa o resultado real por canal e os testes de envio e recuperação passam com transportes simulados.

## Observações para a skill implementar

- Usar este plano e o `AGENT.md` como referência.
- Excluir do código os itens da seção **O que será removido**.
- Executar os checks de implementação uma vez sobre a versão final e registrar as verificações externas pendentes.
