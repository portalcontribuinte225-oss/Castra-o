# Plano de Implementação: Acompanhamento, canais e notificações — fase 4

## Origem

- Arquivo de especificação: `.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md`.
- Fase: 4 — etapa “Quer acompanhar?”, configuração dos canais municipais e notificações.
- Data do planejamento: 2026-11-12.
- Classificação: `fullstack`, com persistência nos campos JSON existentes e sem alteração de schema prevista.
- Aprovação: proposta aprovada pelo usuário pela opção `1`, após confirmar explicitamente a inclusão de solicitações sem CPF quando a configuração dispensar a etapa Tutor.
- Destino: `.portal/plans/acompanhamento-canais-notificacoes-fase-4.md`.

## Resumo

Adicionar uma etapa final de acompanhamento ao formulário público, independentemente das etapas configuráveis. Quem quiser receber atualizações informa e-mail e, quando o WhatsApp municipal estiver habilitado, pode informar telefone. Quem não quiser recebe um aviso e pode concluir normalmente.

Persistir a escolha por solicitação e centralizar notificações de confirmação de agenda, reagendamento, decisões sobre documentos e conclusão do atendimento. Usar WhatsApp quando habilitado e disponível, com fallback para e-mail. E-mail permanece habilitado na política do município; isso não autoriza enviar mensagens a quem recusou acompanhamento.

Permitir solicitação sem CPF apenas quando a configuração municipal efetivamente dispensar Tutor. O backend deve tomar essa decisão consultando a configuração, sem confiar em flags de visibilidade enviadas pelo navegador.

## Escopo

### Dentro do escopo

- Nova etapa final de acompanhamento no formulário público e adequação da navegação e validação.
- E-mail obrigatório para quem escolher acompanhar; telefone opcional e exibido somente com canal telefônico habilitado. Nesta fase, somente WhatsApp pode estar habilitado.
- Escolha e contatos de acompanhamento separados dos dados de identidade do tutor.
- Configuração de notificações por município, com e-mail sempre habilitado e ativação de WhatsApp reutilizando a configuração existente.
- Contrato de envio preparado para futura integração de SMS, sem provedor ou controle visível nesta fase.
- Despachante único, adapters de canal, resultados estruturados e registro seguro no histórico.
- Eventos de confirmação de agendamento, reagendamento, alteração de status dos documentos e atendimento concluído.
- Aceitar ausência de CPF no fluxo público cuja configuração dispense Tutor, com validação no backend e compatibilidade com os demais fluxos.
- Restringir a escrita das configurações envolvidas aos administradores autorizados e preservar o isolamento municipal.
- Testes das regras, fronteiras HTTP e integrações com provedores simulados.

### Fora do escopo

- Criação automática de conta, geração e troca de senha, recuperação de acesso e perfil do tutor: fase 5.
- Tela de entrada, listagem e busca de animais, pré-preenchimento e reaproveitamento de documentos: fase 6.
- Consulta por protocolo e contato, códigos de consulta, tokens de acompanhamento e remoção da chave antiga: fase 7.
- SMS real, escolha de canal pelo cidadão e seleção de quais eventos deseja receber.
- Notificação adicional de abertura da solicitação: os eventos aprovados são os de agenda, documentos e conclusão do atendimento.
- Reformulação do fluxo de denúncias, adoções, balcão, PDFs ou permissões gerais do sistema.
- Fila durável, worker, processamento em lote, webhooks de entrega, reenvio automático ou garantia de entrega exatamente uma vez.
- Instalar ORM, atualizar dependências, alterar CI/CD, `.env`, Render, portas ou executar migrations.

## Leitura de contexto

Arquivos e padrões investigados:

- `AGENT.md` da raiz; não foram encontrados `frontend/AGENT.md`, `backend/AGENT.md`, outros `AGENTS.md` ou `CLAUDE.md` no projeto.
- `.agents/skills/planejar/SKILL_planejar.md`, `.claude/skills/planejar/SKILL.md` e `.claude/skills/planejar/TEMPLATE_planejar.md`.
- Especificação mestre e plano anterior `.portal/plans/racas-configuraveis.md`, considerando as decisões posteriores registradas na especificação.
- `src/App.tsx`: carregamento de configurações, `createRequest`, `LoginView`, `NewRequest`, conclusão pública, revisão de documentos e configuração de WhatsApp.
- `src/domain.ts`, `src/api.ts`, `src/types.ts`, `src/utils.ts` e padrões de campos em `src/styles.css`.
- `src/features/request-steps/request-steps.ts` e seus testes; `src/features/identification-types/identification-types.ts`.
- `src/features/request-actions.ts`, `src/features/agenda.tsx` e `src/features/request-analysis-sections.tsx`.
- `backend/src/routes/requests.js`, `config.js`, `whatsapp.js`, `schedule.js` e trechos de `ai.js` relacionados à análise documental.
- `backend/src/services/email.js`, `whatsapp.js`, `whatsappQuota.js` e `identification-type-defaults.js`.
- `backend/src/tenant.js`, `utils.js`, `db/index.js`, `db/migrations.js`, `server.js` e `municipalityDefaults.js`.
- Scripts reais de `package.json` e `backend/package.json`.

Constatações que orientam o plano:

- `getVisibleSteps` concentra a ordem e os toggles; Documentos pode não existir, portanto a pergunta final não pode ficar dentro dessa etapa.
- `POST /api/requests` exige CPF válido em todos os casos hoje. As colunas `requests.cpf` e `validation_key` admitem ausência; há `workflow_data` JSONB.
- A etapa Tutor pode desaparecer por configuração ou por perfil completo de tutor autenticado. Essas causas não equivalem para a validação de CPF.
- `PATCH /api/requests/:id` envia somente WhatsApp para confirmação de agenda e mudança de data de solicitação agendada.
- `email.js` só implementa recuperação de senha com EmailJS. Não há sender de notificações gerais, SMS ou infraestrutura de fila.
- A revisão manual de documentos grava `documents` por PATCH antes de confirmar a agenda; uploads novos e análise inicial não são, por si, decisões posteriores a notificar.
- `config.js` permite escrita autenticada para a maioria das chaves; a restrição municipal de administrador hoje está aplicada apenas a `ai`, além da regra global de `platform`.
- O backend real usa JavaScript e `pg`, sem Drizzle ou isolamento automático por RLS no entrypoint investigado. Não presumir a infraestrutura descrita genericamente no `AGENT.md`.

## Impacto por área

### Frontend

- Acrescentar a etapa final ao fluxo público através da função única de etapas. Usar um novo valor de `RequestStep` sem renumerar os existentes.
- Preservar a ordem fixa e o comportamento do balcão. Resumos administrativos devem continuar descrevendo as etapas configuráveis, sem sugerir que acompanhamento possui toggle.
- Extrair o componente e as regras de acompanhamento para módulos pequenos, com fiação mínima em `App.tsx`.
- Exigir resposta explícita Sim/Não; não selecionar Sim automaticamente.
- Sim exige e-mail válido. Telefone é opcional, mas, se preenchido e aplicável, precisa ser válido com DDD. Não mostrar seletor de canal.
- Não exibir telefone de acompanhamento quando WhatsApp estiver desligado. SMS não deve aparecer como opção configurável ou funcional.
- Remover os inputs públicos de e-mail e telefone da etapa Tutor. Preservar os campos de identidade e contato usados pelos outros fluxos.
- Não reaproveitar silenciosamente o e-mail do usuário interno como contato da solicitação. Respeitar valores vazios e a preferência explícita ao montar o payload.
- Preservar contatos na identidade do tutor quando forem dados cadastrais legítimos; a recusa deve impedir envio, sem apagar o cadastro do tutor.
- Exibir loading/error ao carregar a política municipal; não assumir canal habilitado enquanto carrega ou após erro. Permitir nova tentativa.
- Ao trocar município, invalidar o carregamento anterior e a política anterior. Revalidar dados transitórios antes de enviar, evitando vazamento ou reaproveitamento de contatos entre fluxos.
- Mostrar na conclusão o protocolo e a preferência salva; se houver referência a contato, mascará-lo.
- Atualizar os avisos das ações administrativas para usar resultados estruturados dos canais, sem deduzir sucesso por palavras no histórico.
- A UI não deve prometer conta criada, recuperação de senha já implantada ou consulta autenticada por contato. A fase 4 oferece avisos; os recursos de acesso chegam nas fases seguintes.

### Backend

- Validar a preferência, os contatos e a configuração no `POST /api/requests`.
- Para dispensar CPF, resolver os tipos pelo município da operação e avaliar a combinação de `stepTutor` dos cadastros confiáveis.
- Configuração ausente mantém o comportamento seguro de Tutor habilitado. ID desconhecido, inativo ou pertencente a outro município não pode dispensar CPF.
- Preservar os contratos dos fluxos específicos preexistentes, como balcão e denúncia, que não recebem a nova etapa. O novo formulário público exige a preferência; omiti-la não pode classificá-lo como legado nem dispensar CPF.
- Manter as validações específicas de denúncia. Não confiar em `origin`, `skipTutor` ou equivalentes fornecidos pelo cliente para liberar ausência de CPF.
- Perfil completo pode dispensar a tela, mas a identidade autenticada continua sendo validada. Não tratar `skipTutor` como solicitação sem tutor.
- Extrair a seleção de eventos e a política de canais para funções testáveis; adapters não devem decidir regras de negócio.
- Notificar apenas após salvar a operação. Não manter transação ou lock de banco aberto durante chamadas de rede.
- Comparar o estado anterior com o estado salvo; PATCH repetido, atribuição de responsável, atualização de nota ou anexação de evidência sem decisão documental não devem reenviar mensagens.
- Tratar alterações de horário/local de agenda, quando persistidas, como mudança relevante do agendamento, além da mudança de data.
- Agrupar decisões documentais de uma mesma atualização em uma notificação, sem uma mensagem para cada arquivo.
- Prever proteção contra duplicação de um mesmo evento, inclusive no processamento de atualizações concorrentes, usando estado controlado pelo servidor nos campos existentes. Não aceitar metadados de envio arbitrários do cliente.
- Proteger o tratamento pós-persistência: falha do provedor ou do registro do resultado não pode fazer a API anunciar que a operação principal falhou depois de já ter sido salva.

### Banco de dados

- Sem tabelas, colunas, índices, backfill ou migrations previstos.
- Usar `workflow_data` para a preferência e contatos de acompanhamento, em subobjeto próprio, com nomes em inglês; proposta: `followUp: { enabled, email, phone }`.
- `enabled: false` prevalece sobre qualquer outro contato cadastrado. Dados transitórios do formulário não devem alimentar o sender nesse caso.
- Metadados de eventos/envios ficam separados dos dados recebidos do cidadão e são controlados exclusivamente pelo servidor.
- Usar `history` para resultados auditáveis, sem contatos completos, CPF, chave de validação, tokens, conteúdo de documentos ou resposta bruta do provedor.
- Adicionar uma chave municipal de notificações, proposta `castragestao:notifications`, na tabela `config`; ausência da linha deve devolver defaults utilizáveis.
- Não criar registros fictícios de tutor nem inserir CPF vazio em `request_validation_keys`. Preservar a geração de chave de transição já existente para solicitações sem CPF, sem vinculá-la a um CPF inventado.
- Conferir os caminhos de conclusão do atendimento para que uma solicitação sem tutor não produza vínculo fictício nem quebre o registro do procedimento. Não antecipar a reformulação do cadastro de animais da fase 6.
- Manter acesso pelo entrypoint existente. Concentrar alterações nas operações legadas necessárias, sem pools novos e sem refatoração geral do banco. A regra do `AGENT.md` para novas operações continua válida; não introduzir novas consultas raw como arquitetura paralela.

> **Atenção:** migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção. Este plano não prevê nem autoriza sua execução.

### Infra/Deploy

- Sem alterações de Render, start/build commands, portas, CI/CD, workers ou dependências.
- Reutilizar o serviço EmailJS e as credenciais já referenciadas pelo backend, sem ler, expor ou modificar arquivos `.env`.
- Usar template próprio para notificações; não reutilizar o template de recuperação de senha para mensagens com outro conteúdo. O identificador do template pode ser configurado por município.
- Preservar o contrato de `sendResetCodeEmail` para a fase 5 e para os fluxos atuais.
- Reutilizar credenciais e template atual de confirmação do WhatsApp. Para os outros eventos, configurar templates adequados, sem enviar texto de documento ou conclusão usando um template exclusivo de agenda.
- Credenciais ou templates ausentes devem gerar resultado operacional claro, nunca falso sucesso. E-mail habilitado por política não significa que o provedor esteja configurado.
- Aplicar timeouts, tratamento de rate limit e limite de espera no envio. Não criar fila em memória sem limite nem disparar promises sem observação como substituto de processamento confiável.
- A fase não promete reenvio após reinício nem confirmação de entrega ao destinatário; diferenciar aceite do provedor de entrega confirmada.

## Arquivos provavelmente afetados

Arquivos existentes verificados:

- `src/App.tsx`: carregamento e passagem da política municipal, payload, formulário, conclusão e painel de integrações.
- `src/domain.ts`: chave de configuração, defaults e normalização dos dados relevantes.
- `src/api.ts`: contratos dos resultados e passagem dos novos dados, conforme necessário.
- `src/styles.css`: somente estilos do novo componente ou remoção de estilos exclusivos de elementos deletados.
- `src/features/request-steps/request-steps.ts` e `request-steps.test.ts`.
- `src/features/request-actions.ts`: resultados de envio nas ações administrativas.
- `backend/src/routes/requests.js`: validação de CPF/contatos e disparo dos eventos após persistência.
- `backend/src/routes/config.js`: defaults, validação, projeção pública e autorização das chaves envolvidas.
- `backend/src/routes/whatsapp.js`: preservar endpoints existentes e aplicar escopo/autorização consistentes onde forem usados pelo fluxo de configuração e testes.
- `backend/src/services/email.js`, `whatsapp.js` e `whatsappQuota.js`: adapters, templates, timeout e integração com a política central.
- `backend/src/services/identification-type-defaults.js`: remover a justificativa obsoleta sobre CPF, mantendo o default inativo.

Novos módulos previstos, cujos nomes finais podem acompanhar os padrões locais:

- `src/features/request-follow-up/`: componente final, contrato do formulário e regras testáveis.
- `src/features/notifications/`: configuração municipal e resultados exibidos pela UI.
- `backend/src/services/notifications/`: eventos, política de canais, despacho e contratos dos adapters.
- Testes próximos aos módulos; testes do backend em diretório executável por `node --test`, sem subir a aplicação.

Valores finitos de eventos, canais e resultados devem ter uma definição central compatível com os consumidores JavaScript/TypeScript. Não espalhar literais nem criar contratos divergentes entre frontend e backend.

## O que será removido

- Inputs públicos de e-mail e telefone na etapa Tutor, substituídos pelos campos da etapa final.
- Chamada direta de confirmação de WhatsApp no PATCH de solicitações, substituída pelo despachante único, com os imports e blocos que ficarem sem uso.
- Interpretação de sucesso/falha por busca de palavras como “WhatsApp”, “enviado” e “falha” no histórico em `request-actions.ts`.
- Comentário de `identification-type-defaults.js` que atribui a inatividade de “Animal sem Tutor” à exigência universal de CPF.
- Estilos, imports e helpers que perderem todos os consumidores nessas substituições.

Não remover endpoints de consulta, chaves antigas, função de recuperação por e-mail ou primitivas de WhatsApp ainda usadas pelo endpoint de teste. Não remover colunas ou dados nesta fase.

Cada item substituído deve ser deletado, sem comentários, flags fixas, `display: none`, `if (false)` ou supressões de compilação como alternativa.

## Estratégia de implementação

1. Confirmar o estado atual dos pontos citados e preservar alterações locais não relacionadas. Não executar servidor, que chama `runMigrations()` no boot, como estratégia de inspeção do banco.
2. Definir o contrato da preferência e os valores centralizados de eventos/canais/resultados. Separar dados enviados pelo cidadão de metadados de entrega controlados pelo servidor.
3. Implementar regras puras para validação de contato, determinação de dispensa de Tutor e seleção dos eventos. Manter a semântica única de combinação dos toggles; não criar uma segunda regra de etapas com comportamento diferente.
4. Acrescentar a configuração municipal de notificações, defaults e projeção pública mínima. Reutilizar `whatsapp.active` como fonte de ativação do canal; não duplicar essa decisão em outra chave.
5. Proteger as chaves que controlam a dispensa de Tutor e o envio: tipos de solicitação, tipos de identificação, notificações, WhatsApp e cota. Apenas administradores municipais ou globais autorizados podem alterá-las, sempre no escopo correto. Não ampliar isso para uma revisão geral das permissões.
6. Implementar a etapa final e integrá-la à função de etapas, navegação, mensagens, payload e conclusão pública. Preservar o fluxo interno.
7. Adequar o POST para validar e salvar acompanhamento e aceitar ausência de CPF somente com configuração municipal permissiva. Preservar denúncias e compatibilidade das solicitações legadas.
8. Generalizar o envio por canal mantendo a API existente de recuperação de senha. A política tenta WhatsApp quando cabível; se não puder enviar ou falhar, tenta e-mail. SMS permanece indisponível.
9. Substituir o envio direto no PATCH pela seleção de eventos a partir do antes/depois salvo, com prevenção de duplicação e resultados estruturados. Não enviar antes do sucesso da operação principal.
10. Adaptar os resultados administrativos e o histórico, sempre com contatos mascarados e erros sanitizados. Não transformar falha de notificação em falha falsa do atendimento/agendamento.
11. Executar os testes e checks pertinentes uma vez ao final; corrigir falhas novas e documentar limitações de validação real dos provedores.

## Regras de negócio identificadas

- O cidadão escolhe receber atualizações; o município determina o canal.
- Sim exige e-mail. Telefone é opcional e aparece somente com WhatsApp habilitado nesta fase.
- Escolher “Não” permite concluir sem contatos de acompanhamento e impede mensagens, mesmo que exista contato cadastral.
- O aviso de recusa explica que mudanças de agenda não poderão ser comunicadas. Mensagens sobre senha devem acompanhar a disponibilidade real do acesso, sem anunciar antecipadamente a fase 5.
- Não oferecer seleção de eventos: a preferência cobre os quatro eventos previstos.
- WhatsApp é prioritário quando ativo, com telefone e condições de envio; e-mail é o fallback. Não enviar pelos dois canais após sucesso do primeiro.
- Sem preferência registrada em solicitação antiga, manter o comportamento legado de WhatsApp para confirmação/reagendamento, sem presumir consentimento para e-mail ou novos eventos. Não classificar solicitações públicas novas como legadas apenas porque omitiram a preferência.
- Ausência de Tutor por configuração permite ausência de CPF; ausência da tela por perfil completo não elimina a identidade exigida do tutor.
- “Animal sem Tutor” continua inativo de fábrica e não é ativado em massa. A prefeitura pode ativá-lo após a implementação.
- Manter a chave antiga durante a transição, sem incluí-la nas novas mensagens ou URLs.
- Acompanhamento por notificações não equivale ao novo mecanismo de consulta por contato da fase 7.

## Regras multi-tenant e segurança

- Resolver município pelos helpers existentes: usuário municipal fica no próprio município; usuário global pode selecionar município; fluxo público precisa apontar para município válido, cujas configurações serão consultadas pelo servidor.
- Não confiar no município de objetos aninhados nem aceitar tipo de outro município para dispensar CPF.
- Política pública deve expor apenas capacidades necessárias ao formulário. Não expor tokens, credenciais, dados privados ou respostas brutas dos provedores.
- Escrita de configurações e operações auxiliares usadas pelo painel devem validar autorização no backend. Esconder botão não é controle de acesso.
- Não permitir que um PATCH de `workflow_data` apague a recusa de acompanhamento ou forje resultados de entrega por sobrescrita genérica de metadados protegidos.
- Não inferir consentimento pelo simples fato de existir e-mail em `users` ou telefone no tutor.
- Não usar `validation_key` nos novos templates, links ou logs; preservar somente o mecanismo legado já existente para a transição.
- Não listar animais por CPF ou microchip nem acrescentar endpoint público que devolva contato completo.
- Na cota, validar município, contrato e saldo e evitar consumo concorrente acima do limite. Conferir telefone/template/configuração antes de consumir cota; não consumir novamente por atualização sem novo evento.
- Não registrar conteúdo de documentos ou justificativas potencialmente sensíveis no texto enviado. Mensagens devem comunicar o resultado necessário com o mínimo de dados.
- Não enviar mensagens reais durante testes. Não ler valores de `.env` para produzir relatórios ou artefatos.

## Validações necessárias

- Preferência obrigatória e booleana nos novos formulários públicos; rejeitar estruturas inválidas e não interpretar strings como booleanos.
- E-mail normalizado e válido quando acompanhamento estiver habilitado; limites de tamanho dos campos antes de enviar ao provedor.
- Telefone, se informado e aplicável, válido com DDD e normalizado pelo adapter. Não exigir telefone quando e-mail é suficiente.
- Com Não, não transportar contatos transitórios como destinatários nem recuperar contatos via fallback do usuário logado.
- IDs de tipos e configurações ativos e pertencentes ao município; tipos ausentes ou inválidos não autorizam dispensa de CPF.
- CPF obrigatório e válido nos fluxos correspondentes; se fornecido, CPF inválido não deve ser aceito como se estivesse ausente.
- Regras próprias de denúncia e do fluxo interno preservadas.
- Payload não escolhe provedor/canal, templates, cota ou resultados de entrega.
- Configuração mantém e-mail habilitado e SMS indisponível, inclusive contra payload manual.
- Mudanças relevantes de agenda e status documentais detectadas por dados persistidos, nunca por texto livre do histórico.
- Falhas de template, credenciais, cota, timeout, HTTP e rate limit convertidas em resultados seguros e identificáveis.

## Testes necessários

### Frontend

- Acompanhamento é a última etapa pública com todas as combinações de Tutor, Agenda e Documentos; fluxo interno mantém a ordem anterior.
- Resumos das etapas configuráveis continuam coerentes e não ganham toggle de acompanhamento.
- Resposta explícita, Sim sem e-mail, e-mail inválido, telefone ausente e telefone inválido.
- Escolher “Não” permite conclusão sem contato e não envia contato oculto ou herdado como destinatário.
- Troca de município, cancelamento de carregamento antigo e falha de carregamento não reaproveitam política ou contato indevido.
- Contatos na confirmação são mascarados; resultados de canal não dependem de texto do histórico.

### Backend

- POST com/sem CPF conforme a combinação real dos tipos municipais; tentativas de forjar `stepTutor`, `origin` ou `skipTutor` não dispensam CPF.
- Tipo inválido, inativo e de outro município; configuração ausente; denúncia; tutor autenticado com perfil completo.
- Sim com contatos válidos/invalidos; Não com contatos antigos; payload novo sem preferência; compatibilidade com solicitações antigas.
- Não criar chave por CPF vazio nem vínculo de tutor fictício; conclusão de solicitação sem Tutor não falha por essa ausência.
- Seleção dos quatro eventos, incluindo decisões agrupadas de documentos, mudança real de agenda e conclusão.
- PATCH sem mudança relevante e repetição/concorrência do mesmo evento não provocam envio duplicado.
- WhatsApp ativo e sucesso; desativado; sem telefone; sem credenciais/template; contrato/cota indisponíveis; falha e timeout com fallback para e-mail.
- E-mail com template próprio, falha/timeout/rate limit e preservação do contrato atual de recuperação de senha.
- Falha de provedor e falha ao registrar histórico não revertem nem anunciam falha falsa de uma operação já salva.
- Isolamento e autorização das configurações envolvidas, inclusive tutor tentando alterá-las e usuário municipal tentando atingir outro município.
- Sem exposição de credenciais, contatos completos ou chave de validação em resultados e logs de notificação.

### E2E / conferência manual

- Formulário público com Tutor: Sim e Não, conclusão e protocolo.
- Município com Tutor, Agenda e Documentos dispensados: etapa final permanece acessível e a solicitação conclui sem CPF.
- Ativar “Animal sem Tutor” manualmente e concluir sem criar tutor fictício.
- Alterar preferências municipais e recarregar; confirmar que o formulário acompanha a configuração certa.
- Confirmar agenda, reagendar, decidir documentos e concluir atendimento com adapters simulados, verificando eventos, canais e histórico.
- Conferir regressão de balcão, denúncia, consulta legada e recuperação de senha.
- Sem automação visual por padrão; navegador e screenshots apenas se o usuário solicitar. Não instalar framework E2E para esta fase.

## Comandos de validação sugeridos

Scripts existentes na raiz:

```powershell
npm run typecheck
npm test
npm run build
```

Backend: executar os testes adicionados com `node --test` e validar sintaxe dos módulos alterados com `node --check`, usando os caminhos efetivamente criados. Não iniciar `server.js` para rodar testes, pois o boot executa migrations.

Não existem scripts de lint na raiz nem scripts de test/typecheck/build no `backend/package.json` investigado. Não propor comandos inexistentes nem alterar scripts sem necessidade.

## Riscos e pontos de atenção

- CPF opcional é uma alteração de autorização de fluxo: a decisão precisa ser tomada no servidor e as configurações que a controlam precisam de proteção.
- `App.tsx` e `requests.js` já são grandes. Concentrar regras novas em módulos pequenos e evitar uma reorganização geral desses arquivos.
- O backend usa `pg`, enquanto o `AGENT.md` menciona Drizzle e RLS. Não presumir ORM/RLS existente nem transformar a fase em migração de infraestrutura. Se surgir necessidade de operação nova não atendida pelas operações legadas ajustadas, resolver a compatibilidade com as regras antes de introduzir outro padrão.
- Política municipal sem linha precisa de default não nulo; o loader existente usa esse sinal para considerar configurações carregadas.
- O template atual do EmailJS é de recuperação, e o de WhatsApp é de confirmação de agenda. Entregas novas dependem de templates adequados, não apenas de ter credenciais.
- EmailJS documenta limite de uma requisição por segundo; rajadas e eventos consecutivos precisam de tratamento limitado e explícito, sem bloqueio indefinido de requests.
- Aceite do provedor não comprova entrega. Sem fila durável/reenvio automático nesta fase, falhas devem ser registradas; reinício do processo pode interromper um envio em andamento.
- As chaves e consultas legadas continuam existindo. Não prometer remoção desse risco nesta fase nem ampliar a superfície pública de consulta.
- O projeto tem alterações locais preexistentes em skills, `AGENT.md` e documentos. Não incluí-las incidentalmente na implementação ou no commit desta fase.
- Commit/push/deploy pertencem ao fluxo posterior de `/finalizar`, direto em `main`, sem PR ou `staging`. Este plano não executa essas ações.

Referências técnicas consultadas:

- [EmailJS — REST API /send](https://www.emailjs.com/docs/rest-api/send/): template próprio, parâmetros e rate limit.
- [Meta — envio de template](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/): templates aprovados e habilitados. A referência do SDK está arquivada; não instalar esse SDK nem trocar a integração HTTP existente por ele.

## Perguntas em aberto

As decisões de produto abaixo foram aprovadas junto com a proposta:

- Incluir a solicitação sem CPF quando a configuração dispensar Tutor.
- Telefone opcional, com e-mail obrigatório para acompanhamento.
- WhatsApp prioritário e e-mail como fallback, sem envio duplo após sucesso.
- Preservar comportamento legado para solicitações antigas, sem presumir preferência para os novos canais/eventos.
- Manter “Animal sem Tutor” inativo de fábrica e as chaves antigas durante a transição.

Pendência operacional para validação de entrega real: identificar/configurar os templates adequados no EmailJS e no WhatsApp. Isso não impede implementar e testar o fluxo com adapters simulados, mas deve ser informado na entrega caso continue pendente. Não preencher a ausência com template de conteúdo incorreto nem editar `.env` automaticamente.

## Critérios de aceite

- A pergunta final aparece em todo formulário público, mesmo sem Tutor, Agenda ou Documentos, e exige resposta explícita.
- Sim exige e-mail; telefone é opcional e aparece apenas com WhatsApp habilitado; SMS não aparece.
- Escolher “Não” permite concluir sem contatos de acompanhamento e bloqueia envios mesmo com contato cadastrado.
- Escolha e contatos são persistidos por solicitação, separados da identidade do tutor e sem fallback indevido para usuário interno.
- Backend aceita ausência de CPF somente conforme a configuração confiável do município; denúncias e demais fluxos mantêm suas exigências.
- Nenhuma conta, CPF ou vínculo fictício é criado para representar animal sem tutor.
- Eventos relevantes dos quatro tipos passam por um único despachante; atualizações irrelevantes/repetidas não reenviam.
- WhatsApp respeita ativação, destinatário, credenciais, template, contrato e cota; indisponibilidade ou falha leva ao e-mail quando autorizado.
- Falhas de notificação ficam identificáveis sem invalidar operação já salva; resultados não expõem dados sensíveis nem a chave antiga.
- Configurações e operações auxiliares envolvidas respeitam autorização e município no backend.
- Os testes e checks previstos passam sem erros novos; limitações de entrega real são documentadas.
- Sem migration, `.env`, dependência, infraestrutura ou arquivo não relacionado alterado; sem chamada real de provedor nos testes.

## Observações para a skill implementar

- Usar este plano aprovado e as decisões fechadas da especificação como contexto. Confirmar os trechos atuais, pois números de linha mudam.
- Seguir `AGENT.md`; código, campos novos, tipos, enums e testes em inglês, textos da interface em português.
- Este salvamento não autoriza iniciar implementação. Aguardar uma invocação separada de `/implementar .portal/plans/acompanhamento-canais-notificacoes-fase-4.md`.
- Não executar migrations nem iniciar a aplicação para validar testes de unidade. Não editar migrations já existentes.
- Não ativar “Animal sem Tutor” automaticamente; apenas remover a limitação que impedia seu uso configurado.
- Deletar os itens substituídos da seção de remoções; não manter dois caminhos de notificação ativos.
- Preservar consultas/chaves antigas e recuperação de senha, sem antecipar as fases 5, 6 e 7.
- Usar testes isolados e mocks de transporte/banco para não exigir banco ativo ou credenciais reais.
- Não refatorar o monorepo, adicionar Drizzle, framework de fila ou dependências de testes como efeito colateral desta fase.
- Na retomada da especificação após a implementação/finalização, registrar o link deste plano, decisões finais e eventuais pendências operacionais; marcar fase 4 concluída somente com os critérios cumpridos e data/hash do commit. A edição da especificação pertence à etapa posterior, não a este salvamento.
