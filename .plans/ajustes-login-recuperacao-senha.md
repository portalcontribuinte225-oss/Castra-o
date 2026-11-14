# Plano: ajustes de login, recuperação de senha e integração SMSMais

## Origem

- Origem: ajustes solicitados pelo usuário após testar o acesso do tutor e a recuperação de senha das fases 5 e 6.
- Contexto: `.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md` e `.portal/plans/acesso-tutor-fase-5.md`.
- Classificação: `fullstack`.
- Data: 2026-11-13.
- Status: **implementado, revisado e validado localmente**.
- Aprovação: escopo definido e confirmado na conversa; o usuário pediu a confirmação do plano aprovado e salvo.
- Atualização aprovada em 2026-11-13: o usuário escolheu **SMSMais** e autorizou atualizar o plano com token, campos necessários e toggle de ativar/desativar na aba de integração. Essa decisão substitui o adiamento anterior da escolha do provedor.
- Implementação e revisão concluídas em 2026-11-13. Validações finais: 213 testes backend e 163 frontend aprovados, typecheck, build e sintaxe JavaScript. Commit e push seguem o fluxo `/finalizar`; configuração do token real e ativação operacional permanecem separadas.
- Destino: `.plans/`, conforme a skill global `planejar` invocada. O roadmap anterior permanece em `.portal/`.

## Resumo

Definir o tipo de acesso pelo ponto de entrada da página pública, retirar os seletores de tipo de acesso e município do modal e simplificar a recuperação em três etapas: identificar a conta, escolher um contato disponível e informar código e nova senha.

A nova senha deve aceitar no mínimo **6 caracteres**, sem exigir composição específica. Os contatos cadastrais elegíveis serão apresentados mascarados. O código será enviado somente pelo canal escolhido.

Adicionar a aba SMS em Configurações → Integrações com **SMSMais como provedor definido**, campo para token de API e toggle de ativar/desativar. Implementar o adapter real de envio dos códigos nesta entrega. A integração começa desativada e SMS só aparece na recuperação quando estiver configurado e ativo no município, com credencial de produção validada. Não é necessário escolher outro provedor ou criar um seletor de fornecedores.

## Decisões fechadas

1. **Animal já cadastrado** abre acesso de **Tutor**. O botão **Entrar** da página pública abre acesso de **Equipe**. O acesso oferecido após a primeira solicitação também é de Tutor.
2. Recuperar senha e voltar ao login preservam essa origem. Não descobrir o tipo de conta pelo formato do CPF ou e-mail; não oferecer rádio Tutor/Equipe.
3. O município do tutor vem do contexto já selecionado na página. Não pedir município novamente no modal. Sem município válido, orientar a seleção na página antes de abrir o acesso do tutor.
4. O acesso institucional continua resolvendo a identidade persistida da equipe. Preservar o acesso de usuários globais sem município; não restringi-los ao município visualizado na página pública.
5. Senha manual: mínimo de **6 caracteres**, permitindo letras, números, símbolos e espaços. Não exigir que seja exclusivamente numérica, nem impor combinação obrigatória de tipos de caracteres. Preservar o limite técnico de 72 bytes UTF-8 do bcrypt.
6. O usuário escolhe o destino antes do envio, por exemplo: “Receber código por e-mail: r*****@gmail.com”, “Receber código pelo WhatsApp: (48) *****-1234” e “Receber código por SMS: (48) *****-1234”. Mostrar somente as opções realmente disponíveis.
7. Os contatos informados na criação da conta podem receber recuperação mesmo sem confirmação anterior. Concluir a recuperação com código correto confirma somente o contato efetivamente utilizado.
8. Um e-mail que corresponda a mais de um tutor no município exige identificação por CPF. Não escolher arbitrariamente uma conta nem listar os respectivos titulares.
9. WhatsApp desativado não aparece. WhatsApp ativo também precisa de telefone válido, credenciais, template de autenticação e cota disponível. A consulta não consome cota; o envio a verifica e consome atomicamente.
10. O provedor será **SMSMais (`smsmais.com`)**. A aba permite informar/substituir/remover o token e ativar/desativar a integração municipal. A entrega inclui envio real por esse provedor; desligado, não configurado ou em homologação, SMS fica oculto na recuperação. Desativar preserva o token cifrado para reativação; remover o token desativa o canal.
11. A etapa de redefinição terá título “Redefinir senha”, código recebido, nova senha, confirmação, salvar, reenviar e voltar ao login. Remover os textos explicativos existentes, o identificador repetido, o contador de expiração e a exigência visual de 15 caracteres.
12. Manter apenas mensagens curtas de erro, carregamento, expiração ou sucesso quando necessárias. Após sucesso, limpar segredos do estado e retornar ao login da mesma origem, sem login automático.

## Escopo

### Dentro do escopo

- Corrigir as três origens de abertura do acesso em `App.tsx` e a limpeza do estado ao fechar ou trocar contexto.
- Simplificar login e recuperação sem selecionar audiência ou município dentro do modal.
- Aplicar a mesma política de senha manual nos fluxos de primeira troca, perfil, recuperação e criação/edição administrativa de usuário.
- Consultar contatos disponíveis sem disparar mensagem e permitir a escolha explícita de canal.
- Enviar e reenviar somente pelo canal e destino selecionados, sem fallback automático.
- Persistir os contatos cadastrais válidos na criação da conta do tutor independentemente da opção de acompanhamento operacional da solicitação.
- Vincular o desafio de recuperação ao canal e destino usados; confirmar esse contato somente no sucesso.
- Criar a aba SMS com SMSMais fixo, token protegido, toggle de ativar/desativar, teste de conexão sem envio e consulta de saldo.
- Implementar envio de códigos de recuperação via SMSMais, com autenticação Bearer, timeout, correlação da mensagem e tratamento explícito de falhas.
- Persistir configuração e segredo por município, sem expor o token salvo ao navegador ou em respostas públicas.
- Atualizar documentação e testes dos contratos e comportamentos alterados.

### Fora do escopo

- Contratar/abrir conta no SMSMais, comprar créditos, inserir credenciais reais ou realizar envios reais pelo agente durante a implementação. O usuário informará o token pela aba após a entrega.
- Integrar múltiplos fornecedores de SMS ou criar seletor/framework genérico de provedores.
- Implementar recepção de respostas, webhook de entrega, polling contínuo, campanhas, voz ou agendamento de SMS. Para recuperação, o aceite do envio e a confirmação pelo código são suficientes nesta entrega.
- Trocar a integração existente de WhatsApp ou e-mail por outro fornecedor.
- Implantar SMS em notificações operacionais de agenda/documentos; manter a indisponibilidade atual desse canal nesses fluxos.
- Alterar dados de contas antigas, preencher contatos a partir de solicitações históricas ou vincular histórico por CPF/e-mail.
- A fase 7 de consulta por protocolo/contato e remoção da infraestrutura legada de chaves.
- Introduzir ORM, framework, biblioteca de formulários, gerenciador de dados ou dependência nova.
- Executar migrations, seeds, boot da API, mudanças de `.env`, commit, push ou deploy durante a implementação deste plano.

## Leitura de contexto

- `AGENT.md`; não há `CLAUDE.md` nem instruções adicionais de domínio encontradas no repositório.
- Skill global `C:/Users/rodri/.codex/skills/planejar/SKILL.md`, adaptada ao projeto de castração e à sua estrutura real.
- Plano e documentação da fase 5, contratos compartilhados, componentes de acesso do tutor, recuperação, serviços de autenticação, repositories, configuração e testes existentes.
- O runtime real usa JavaScript, `pg`, queries parametrizadas e transações explícitas. Drizzle/RLS descritos genericamente em `AGENT.md` não estão instalados. Preservar a arquitetura real já adotada nas fases 5 e 6, sem criar pools paralelos ou migrar de ORM.
- Atualmente todos os botões abrem o mesmo modal, cujo tipo inicial é Tutor. O modal ainda mostra tipo de acesso e município durante a recuperação.
- O envio atual escolhe WhatsApp e pode fazer fallback para e-mail. A recuperação exige contato previamente confirmado e aplica uma espera artificial de 12 segundos.
- O cadastro do perfil hoje copia somente os contatos de `workflow.followUp` quando o acompanhamento está habilitado. Isso não representa todos os contatos cadastrais informados.
- A API possui desafios, versões de sessão/perfil, limites persistentes e auditoria transacional. `auth_challenges.destination` é `TEXT` e já participa do HMAC do desafio.
- O contrato de notificações conhece o valor `sms`, mas rejeita a ativação desse canal operacional. Ainda não existe adapter de SMS no código atual; este plano passa a incluí-lo para recuperação de senha, sem habilitar SMS de agenda/documentos como consequência.
- A cifra existente em `backend/src/services/config-secret-cipher.js` usa AES-256-GCM, mas permite fallback para texto puro quando não há chave válida. **O novo token de SMS não pode usar esse fallback**: gravação de segredo e ativação exigem criptografia válida, preservando a compatibilidade dos fluxos legados não relacionados.
- Não há script de lint em `package.json`; existem typecheck, testes frontend, testes nativos do backend e build.

### Documentação SMSMais verificada

- [API de SMS](https://smsmais.com/api-sms): autenticação, limites, envio e saldo.
- [Referência técnica](https://smsmais.com/doc/) e [especificação OpenAPI](https://smsmais.com/doc/openapi.yaml): contratos de requisição/resposta, erros e particularidades do sandbox. A especificação foi consultada em 2026-11-13.
- [Central de ajuda](https://smsmais.com/central-ajuda): obtenção do token e diferença entre envio individual retido por falta de saldo e envio em lote recusado.
- Base definida: `https://smsmais.com`, com Bearer no cabeçalho. A API pública documenta envio por `POST /send` e consulta por `GET /saldo`; não há necessidade documentada de login/senha, ID de conta, número remetente ou ID de template para o SMS transacional deste fluxo.

## Impacto por área

### Frontend

- Substituir o booleano de abertura do modal por contexto explícito de origem/audiência. O componente recebe esse contexto; não permite alterá-lo internamente.
- Remover props, estado, elementos e callbacks dos seletores eliminados. Não ocultar elementos com CSS ou conservar caminhos alternativos mortos.
- Separar as etapas de recuperação sem repetir campos: identificação com botão “Continuar”; opções de destino cujo clique solicita o envio; formulário mínimo de código e nova senha.
- Representar carregamento, erro curto, limites de envio, ausência de canal e expiração. O botão de reenviar permanece bloqueado durante o cooldown, sem contador de segundos na tela.
- Descartar respostas de operações antigas após troca de município, origem, fechamento ou novo fluxo. Uma resposta tardia não pode encerrar uma sessão nova ou sobrescrever o contexto atual.
- Preservar o procedimento pretendido do tutor e sua associação ao município durante login e primeira troca de senha.
- Criar a aba SMS com formulário dedicado: provedor SMSMais fixo, token de API, indicador de token configurado, toggle, salvar, remover token e testar conexão/consultar saldo. O segredo salvo nunca é preenchido de volta no input.

### Backend

- Separar descoberta de canais, solicitação de envio e confirmação da recuperação.
- Resolver contatos e configuração no servidor a cada operação. O cliente nunca fornece livremente e-mail ou telefone de destino.
- Acrescentar envio explícito por canal ao adapter de autenticação. Não alterar inadvertidamente o comportamento de senha inicial, confirmação de contato e avisos de segurança.
- Preservar limites persistentes por origem/identificador, por conta e por confirmação; novas consultas também são limitadas.
- Remover a espera artificial de 12 segundos da recuperação revisada. A apresentação de canais mascarados já revela deliberadamente a existência de opções, conforme o requisito aprovado.
- Normalizar e validar os contatos da primeira criação de conta usando os dados cadastrais existentes. Não depender de consentimento para acompanhamento operacional e não modificar uma identidade já existente a partir de solicitação anônima.
- Na identidade institucional atual, oferecer somente os contatos que realmente estejam persistidos; não inventar telefone para equipe ou usuários globais.
- Separar configuração segura, teste de conexão e transporte SMSMais em módulos pequenos. Verificar a mesma disponibilidade municipal na descoberta e imediatamente antes de enviar.
- Validar credenciais pelo saldo antes de ativar ou trocar token de uma configuração ativa; teste e chamadas ao provedor acontecem fora de transações e sem conexão de banco retida. Não confiar em um `tokenValid` enviado pelo cliente.

### Banco de dados

- **Nenhuma migration planejada.** Reutilizar `tutor_profiles`, `auth_challenges`, `auth_rate_limits` e a tabela de configuração municipal existentes.
- Para recuperação, armazenar em `destination` um envelope textual JSON versionado contendo canal e destino normalizado. Ele continua protegido pelo HMAC já existente. Finalidades de confirmação de contato mantêm seus contratos próprios.
- Não adicionar um propósito de descoberta ao banco: o identificador temporário dessa etapa será assinado e não criará nem invalidará um desafio de código.
- Desafios de recuperação antigos sem vínculo explícito de canal/destino exigem reiniciar a recuperação, sem migração ou alteração destrutiva de registros.
- Se a investigação na implementação revelar necessidade real de schema, atualizar o plano antes; não executar alteração de banco como consequência implícita.

### Infra/Deploy

- Nenhuma mudança de porta, CI/CD, scripts de inicialização, variáveis de ambiente ou infraestrutura.
- Usuário trabalha localmente e envia ao repositório Git. Não criar dependência de um banco de produção inexistente para este escopo.
- Provedor definido: SMSMais. Credencial e saldo ficam na conta contratada pelo usuário; a API do projeto acessa somente os endpoints oficiais definidos no adapter.
- Reutilizar `CONFIG_ENCRYPTION_KEY` para a proteção do token, sem editar `.env`. Se ela estiver ausente/inválida, o formulário deve informar que a configuração segura está indisponível e impedir gravação de segredo/ativação até a configuração operacional pelo responsável. Isso não impede implementar e testar o código com chave de teste isolada.

## Arquivos provavelmente afetados

Os caminhos existentes abaixo foram verificados; não pressupor que todos precisarão de alteração.

- `src/App.tsx`: origem de entrada, integração do modal, nova aba e permissões de configurações.
- `src/api.ts` e `src/features/tutor-access/auth-types.ts`: contratos de descoberta, envio e tempos do desafio.
- `src/features/tutor-access/auth-entry.tsx`, `password-recovery-form.tsx`, `password-change-form.tsx` e `use-auth-challenge-clock.ts`: interface e estado do fluxo.
- `src/features/registered-animals/procedure-intent.ts`: compatibilidade da intenção de procedimento; alterar somente se necessário.
- `shared/auth-contract.js` e `shared/notification-contract.js`: política de senha, tipos finitos e disponibilidade consistente dos canais, sem ativar SMS operacional.
- `backend/src/routes/auth.js` e `backend/src/services/auth/recovery-handlers.js`: descoberta, envio, confirmação e erros estruturados.
- `backend/src/services/auth/auth-message-delivery.js`, `auth-security.js`, `tutor-enrollment.js`, `internal-user-handlers.js` e `session-handlers.js`: envio explícito, proteção dos identificadores, contatos e política de senha.
- `backend/src/repositories/auth-users.js`, `auth-challenges.js`, `auth-limits.js` e `tutor-profiles.js`: consulta, vínculo do desafio, limites e confirmação atômica do contato.
- `backend/src/routes/config.js`: validação, merge seguro do segredo, respostas sem token, escopo municipal e autorização da configuração de SMS, inclusive a lista de permissões permitidas.
- `backend/src/services/config-secret-cipher.js`: disponibilizar uso estrito da cifra para o novo token, sem alterar a política dos consumidores legados não abrangidos.
- `backend/src/services/notifications/delivery-result.js`: rótulos de falha segura, caso os códigos compartilhados precisem distinguir falta de saldo e autenticação do provedor.
- `backend/src/server.js`: somente registrar a nova rota administrativa de SMS, se criada; não alterar boot, migrations, portas ou comandos de inicialização.
- `docs/tutor-access.md`: novos fluxos e regra dos contatos cadastrais ainda não confirmados.
- Testes existentes: `backend/test/auth-core.test.js`, `auth-routes.test.js`, `auth-delivery.test.js`, `config-security.test.js`, `src/features/tutor-access/auth-api.test.ts` e `tutor-access.test.tsx`.

Novos arquivos previstos, a criar com responsabilidade única:

- `shared/sms-contract.js`: contrato da integração SMSMais, estados finitos, chave de configuração municipal, limites e DTO seguro.
- Componente/hook dedicado da aba SMS em `src/features/`, sem ampliar `App.tsx` com regras de integração.
- `backend/src/services/smsmais.js`: adapter de envio/consulta de saldo com `fetch` injetável, sem SDK ou dependência nova.
- `backend/src/services/sms-integration-settings.js`: configuração, disponibilidade, proteção do token e teste de conexão, com acesso ao banco separado em repository quando necessário.
- `backend/src/routes/sms.js`: operações administrativas de teste de conexão/saldo com autenticação e escopo municipal, se não couberem na rota de configuração existente.
- Testes focados de adapter, configuração segura e permissões em `backend/test/`.
- Módulo específico para descoberta de canais e validação do identificador temporário, se necessário para manter os handlers pequenos.
- Testes focados das etapas de recuperação e disponibilidade dos canais.

## Estratégia de implementação

1. **Contratos e senha:** alterar o validador compartilhado para 6 caracteres e preservar 72 bytes UTF-8. Reutilizá-lo nos escritores manuais de senha; na edição administrativa, senha vazia continua significando manter a atual. Senhas temporárias geradas continuam aleatórias, sem reduzir sua entropia ou forçar troca de senhas existentes.
2. **Contato cadastral:** persistir e-mail/telefone válidos na primeira criação de `tutor_profiles`, a partir dos campos cadastrais já enviados pela aplicação. Manter `followUp` e suas preferências operacionais independentes. Não consultar solicitações antigas para recuperar contato nem sobrescrever perfil existente.
3. **Descoberta:** criar `POST /auth/recovery-options` com identificador, audiência e município de contexto. Resolver uma conta elegível e retornar opções mascaradas e um identificador temporário assinado, de finalidade exclusiva e validade curta. Consultar opções não envia mensagens nem invalida códigos existentes.
4. **Identificador temporário:** vincular conta, audiência, município efetivo, versões de sessão/perfil e expiração. Reutilizar primitivas existentes de autenticação; não introduzir outra chave de ambiente. Contatos completos, senhas e códigos não entram no payload legível do identificador. IDs das opções são opacos e autenticados para aquele contexto.
5. **Disponibilidade:** e-mail exige contato válido e transporte/template disponível; WhatsApp exige os requisitos reais descritos nas decisões fechadas; SMS exige telefone válido no perfil, integração municipal ativa, token de produção decifrável e validação correspondente à credencial configurada. Desativado, incompleto ou em homologação, não oferecer SMS. Não consumir cota ou consultar saldo remoto em cada descoberta pública; o provedor faz a verificação final de crédito no envio e pode recusar por falta de saldo.
6. **Envio:** adaptar `POST /auth/forgot-password` para receber identificador temporário e ID da opção. Revalidar assinatura, expiração, conta, versões, escopo, contato e disponibilidade. Sob lock da identidade, criar o desafio vinculado a canal/destino; confirmar a transação antes de chamar o provedor. Enviar exatamente pelo canal escolhido, com tempo de execução limitado e sem conexão de banco retida durante a chamada.
7. **Falhas e reenvio:** normalizar retorno do provedor em estados/códigos finitos, sem expor resposta bruta ou credenciais. Em falha, apresentar mensagem curta e permitir ação posterior dentro dos limites. Reenviar mantém o canal escolhido, revalida as condições e substitui o código anterior. Trocar de destino passa por escolha explícita e pelos mesmos limites da conta.
8. **Confirmação:** manter `POST /auth/reset-password`, agora validando também o vínculo de canal/destino. Em uma transação, validar e consumir o código, confirmar apenas o contato usado se necessário, atualizar senha, revogar sessões/desafios e registrar auditoria obrigatória. Tentativas erradas continuam contadas de forma persistente.
9. **Tempos:** manter validade de 600 segundos, intervalo de reenvio de 60 segundos e máximo de 5 tentativas por desafio, além dos limites existentes entre desafios. Retornar horários do servidor para expiração e próximo envio. A UI não deve reiniciar a validade a partir da hora em que recebe a resposta; compatibilizar outros consumidores do hook sem regressão.
10. **Interface:** aplicar as origens de acesso, remover seletores e implementar as três etapas com limpeza de estado, acessibilidade, labels e botões adequados. Limpar as credenciais ao terminar e voltar ao login correto.
11. **SMSMais:** implementar a aba, armazenamento seguro, teste de conexão e adapter real conforme a seção específica abaixo. A configuração inicial é desativada; habilitar exige as condições validadas pelo servidor. Não aceitar URL arbitrária, salvar segredo em texto puro ou simular sucesso de envio. Reutilizar a tabela de configurações; não criar tabela ou framework genérico de provedores.
12. **Documentação e validação:** atualizar a regra antiga de recuperação apenas para contatos confirmados, testar os novos contratos e executar as verificações do projeto.

## Aba e integração SMSMais

### Campos e ações da aba

| Elemento | Comportamento |
| --- | --- |
| Provedor | SMSMais, fixo; sem seletor de fornecedor ou URL editável. |
| Token de API | Campo de senha para informar ou substituir a credencial. Aceitar o token sem o prefixo `Bearer`, rejeitar valores inválidos/controles e limitar tamanho no contrato. Nunca exibir o segredo já salvo. |
| Ativar/desativar SMS | Toggle municipal, inicialmente desligado. Desligar oculta SMS na recuperação e impede novos envios, preservando o token. |
| Salvar | Persistir os campos autorizados. Token omitido/vazio mantém o segredo anterior. Uma nova credencial invalida a validação da antiga. |
| Remover token | Ação explícita, distinta de deixar o input vazio; apaga o segredo e desativa a integração na mesma gravação. |
| Testar conexão / Consultar saldo | Ação administrativa via backend que consulta saldo e autenticação, sem enviar SMS e sem ativar ou salvar uma credencial automaticamente. |
| Estado e saldo | Exibir somente status seguro, ambiente detectado, última verificação e saldo retornado nessa consulta, com data de atualização. Não apresentar saldo antigo como garantia de envio. |

O token é o único segredo necessário neste contrato. Não pedir usuário/senha SMSMais, número de remetente, ID de conta ou template. O texto de recuperação é composto pelo servidor, sem editor de campanhas nesta aba.

### Persistência, autorização e ativação

- Centralizar a chave proposta `castragestao:sms` em `shared/sms-contract.js`, com fornecedor fixo SMSMais, `active: false` por padrão e contratos separados para entrada de segredo, registro interno cifrado e resposta segura.
- Reutilizar a tabela `config`, isolando por município. Não retornar o registro interno bruto: a resposta pode conter `active`, `hasToken`, ambiente e metadados de verificação, nunca o token em claro ou cifrado.
- Token novo exige AES-256-GCM com chave válida. Acrescentar um modo/helper estrito à cifra existente; ausência de chave, chave inválida ou falha de decifragem impedem ativação/envio. Não tratar o texto cifrado como um token válido nem usar fallback em claro para SMS.
- Somente administração municipal do próprio município ou administração global no município escolhido pode alterar/testar a integração. Reutilizar os controles existentes e a permissão de aba `sms_settings`; tutor e usuário operacional não podem consultar saldo nem fornecer token para testar.
- Validar ativação no servidor com token de produção e consulta de autenticação bem-sucedida. Se o token for trocado com o toggle ativo, validar a nova credencial antes de efetivar a troca. Nenhum envio de teste é necessário para isso; saldo zero não invalida a credencial.
- A validação é vinculada à credencial/contexto realmente persistidos. Em alteração concorrente, não aplicar o resultado de teste antigo a outro token/município. Chamadas externas acontecem fora da transação, com conferência do snapshot validado ao salvar; não copiar o padrão legado que mantém um client enquanto chama provedor.
- Uma falha ao salvar/validar não apaga a configuração anterior nem expõe detalhes sensíveis. Metadados de auditoria podem indicar ativação, substituição ou remoção, sem o token, headers, payload de mensagem ou resposta bruta.
- Endpoint administrativo proposto: `POST /sms/test-connection`, sob a base `/api`, recebendo o município autorizado e opcionalmente um token novo ainda não salvo; token ausente usa o configurado. Aplicar limite por ator/município e timeout. O retorno contém apenas resultado seguro e resumo de saldo; não devolve dados financeiros/histórico da conta inteira.
- Nunca chamar o provedor diretamente do navegador. Campos como `hasToken`, validação, ambiente e saldo são resultados do servidor, sem valor de autorização se enviados pelo cliente.

### Contrato de transporte

Contratos extraídos da [especificação OpenAPI oficial](https://smsmais.com/doc/openapi.yaml); a forma de armazenamento e os controles abaixo são decisões deste projeto.

- Base fixa `https://smsmais.com`; autenticação em `Authorization: Bearer <token>` e corpo JSON. Proibir token em URL/query string e redirecionamento para origem arbitrária.
- Usar **`POST /send` com uma única mensagem e um único destino**: `messages[0].id` corresponde ao ID do desafio, `destinations[0].to` contém o telefone normalizado com DDI 55, e `msg` contém o código e sua validade. Não enviar `schedule`, `audio`, CPF, senha nova ou dados do animal.
- Preferir esse endpoint para OTP porque responde `402 insufficient_balance` sem inserir mensagens quando o crédito não cobre o envio. Não usar `POST /api/enviar_sms.php` para recuperação: esse caminho pode retornar `held_no_balance` com HTTP 200 e liberar a mensagem em recarga posterior, conforme a [central de ajuda](https://smsmais.com/central-ajuda).
- Manter o SMS em até 160 caracteres. Usar texto fixo e curto, por exemplo identificando CastraGestao, código de seis dígitos, validade em minutos e orientação para não compartilhar. O código continua sendo gerado, protegido e verificado pelo projeto; não há novo serviço de geração de OTP.
- Enviar o ID do desafio como referência externa para idempotência/correlação. Um reenvio explícito cria novo desafio, novo código e nova referência; repetição técnica da mesma operação, se houver, mantém referência e conteúdo. Não implementar retries automáticos cegos após timeout.
- Validar o corpo do aceite de `/send`, inclusive o item correspondente ao ID externo e destino; HTTP 200 sozinho não é prova de envio. Array vazio, opt-out, conteúdo inválido, mensagem retida ou retorno incompatível não contam como sucesso.
- Tratar autenticação inválida, falta de saldo, rejeição do destino, limites, resposta inválida, timeout e indisponibilidade com códigos finitos e mensagens curtas. Reaproveitar os códigos de entrega existentes onde adequados; centralizar os novos, se necessários.
- Preservar a distinção entre aceite pelo provedor e entrega ao aparelho. Guardar somente IDs/referências e estados normalizados em `auth_challenges.delivery`, sem copiar `msg`, token ou resposta inteira. Não marcar o telefone como confirmado por aceite ou saldo válido; somente pelo código correto.
- Consulta administrativa de conexão/saldo: **`GET /saldo`**, validando o envelope de sucesso antes de usar saldo e equivalente em SMS. Credencial válida com saldo zero pode ficar ativa, mas a API de envio pode recusar o código por crédito insuficiente; não fazer fallback para outro canal.
- Limitar tempo de rede e tamanho de resposta; injetar `fetch`/relógio nos testes e reutilizar constantes e padrões existentes. Não manter client/lock de banco durante rede, não criar fila/worker e não enviar depois de o desafio já estar expirado no servidor.

### Homologação e configuração operacional

- Detectar token `sbx_` como homologação. Permitir salvar/testar essa credencial de modo claramente identificado, mas **não ativar SMS na recuperação pública com ela** nem confundir aceite simulado com entrega real.
- A especificação informa que o sandbox pode entregar SMS real ao celular verificado da conta. Portanto, testes automatizados usam mocks; não presumir que um token de homologação torna qualquer chamada de envio inofensiva. O teste de conexão deste projeto usa apenas `GET /saldo`.
- A obtenção do token acontece no painel SMSMais pelo próprio usuário. Nenhuma credencial vai para este plano, conversa, repositório ou `.env` do frontend. Credencial real e créditos não são necessários para implementar/testar os contratos isoladamente.
- Não exigir webhook ou URL pública para habilitar recuperação. O adapter registra aceite e o usuário confirma a posse digitando o código; DLR assíncrono, campanhas e respostas recebidas permanecem fora deste escopo.

## Segurança, dados e multi-tenant

- Audiência no cliente representa intenção de acesso; autorização e papel sempre vêm da identidade persistida. Um identificador/ID de opção adulterado não pode mudar conta, destino, município ou privilégio.
- O tutor continua identificado por conta municipal. Não procurar o mesmo CPF em outras prefeituras nem combinar contatos entre municípios.
- Contatos exibidos antes da autenticação são mascarados. Não mostrar nome completo, CPF completo ou contatos completos nos retornos de descoberta. A listagem de opções implica divulgação limitada de existência, aceita no desenho aprovado; manter limites e respostas sem detalhes adicionais.
- Contatos cadastrais ainda não confirmados são elegíveis por decisão do usuário. A posse só é confirmada pelo código recebido no próprio canal, sem confirmação cruzada por outro destino.
- Um envio aceito pelo provedor não confirma posse do contato nem entrega efetiva. A confirmação depende da conclusão correta do desafio.
- Não buscar novos destinos em `followUp` durante recuperação nem inferir vínculos a partir de CPF/e-mail compartilhado.
- Um novo cadastro anônimo com CPF já existente continua sem redefinir senha, trocar contatos, assumir identidade ou vincular solicitações anteriores.
- Não guardar código, senha, identificador temporário ou contato completo em localStorage, logs, analytics, histórico da solicitação ou mensagens de erro.
- Respostas da recuperação usam `Cache-Control: no-store`. Aplicar limites persistentes à descoberta, envio e confirmação. O cooldown visual não substitui os limites do servidor.
- Novas configurações são isoladas por município, com escrita administrativa e leitura interna autorizada. A opção `sms_settings` precisa ser reconhecida no validador das permissões; esconder a aba não é controle suficiente.
- Leituras e gravações da configuração de SMS passam por DTO seguro; nem administradores recebem o segredo salvo em endpoints de configuração, saldo ou erros. Controles públicos da recuperação não expõem token, saldo, ambiente interno ou histórico financeiro.
- Preservar erros centralizados, queries parametrizadas, ordem consistente dos locks e rollback em falha da auditoria.

## Validações necessárias

- Conferir o diff e o escopo, sem secrets, `.env`, lockfiles ou migrations alterados.
- `npm run typecheck`.
- `npm test`, com execução sequencial e poucos workers quando necessário pela memória local.
- Testes backend por `node --test --test-concurrency=1`, usando os arquivos `backend/test/*.test.js` existentes e novos, sem subir `server.js`.
- `npm run build`.
- Verificação de sintaxe dos módulos JavaScript alterados e `git diff --check`.
- Lint somente se houver script disponível; não instalar ferramenta para esta tarefa.
- Nenhuma migration ou chamada real de envio para verificar a implementação. Testes de integrações usam transportes simulados.

## Testes recomendados

- Origens Equipe/Tutor corretas, retorno da recuperação, primeira troca e intenção de procedimento preservados no município correto.
- Troca de contexto/fechamento descarta respostas antigas e não encerra uma sessão posterior.
- Senha com 5 caracteres falha, com 6 funciona sem composição obrigatória; máximo de 72 bytes e comportamento com Unicode são coerentes no cliente e servidor.
- Descoberta não envia nem consome código/cota; retorna somente contatos mascarados da conta correta. Conta ambígua por e-mail solicita CPF sem expor titulares.
- Cadastro com e-mail/telefone e acompanhamento desativado preserva os contatos válidos no novo perfil. CPF repetido não atualiza perfil existente.
- Contato inicial ainda não confirmado pode receber; código incorreto não confirma contato; sucesso confirma somente o usado.
- Canal escolhido recebe exatamente um envio. Falha de WhatsApp não dispara e-mail; falha de e-mail não dispara WhatsApp.
- WhatsApp inativo, sem credenciais/template ou sem cota não é oferecido; desativação entre consulta e envio impede o envio.
- SMS desativado, sem token válido/decifrável, sem telefone ou em homologação não aparece; SMS configurado, validado e ativo permite selecionar envio pelo SMSMais. Desativação entre consulta e envio impede a chamada ao provedor.
- Toggle preserva token ao desligar; input vazio mantém o segredo; remoção explícita limpa segredo e desativa. Token novo invalida a validação antiga e não pode herdar um teste de outra credencial/contexto.
- Token é cifrado com chave válida e nunca aparece em GET/PUT, erros ou auditoria; ausência/invalidade da chave impede gravação de segredo/ativação sem alterar o comportamento dos outros consumidores legados da cifra.
- Teste de conexão consulta somente `/saldo`, interpreta envelope válido e distingue token inválido de saldo zero. Rejeita acesso por tutor, operador não autorizado ou município alheio; não envia SMS nem ativa a integração.
- Adapter chama `/send` no domínio fixo com Bearer e payload de um destinatário, referência do desafio e texto de até 160 caracteres. Timeout, 401, 402, 429, falha 5xx, JSON malformado, array vazio e opt-out não viram sucesso nem disparam outro canal.
- Sandbox não habilita recuperação pública. HTTP 200 retido/simulado não confirma contato, e aceite normal não equivale a entrega no aparelho. Escopo/permissões não vazam configuração entre municípios.
- Manipulação de identificador temporário, opção, audiência, conta, município, expiração ou versão invalida a operação. Desafio de outra finalidade não redefine senha.
- Expiração, cooldown, bloqueio entre desafios, 5 tentativas, reenvio invalidando código anterior e confirmação concorrente preservam as garantias existentes.
- Falha de auditoria reverte senha e confirmação de contato. Sucesso invalida sessões antigas, sem login automático.
- Interface final não contém seletores eliminados, identificador repetido, textos explicativos antigos, mínimo de 15 caracteres ou contador de expiração.

## Riscos e pontos de atenção

- Esta mudança relaxa intencionalmente a elegibilidade de contatos e o mínimo da senha. Não remover por consequência os limites, hash, revogação, auditoria ou confirmação por código.
- Descoberta e envio precisam usar a mesma regra de disponibilidade; alterações de configuração entre as etapas exigem revalidação.
- Os formatos antigos de desafio e os outros fluxos que usam o adapter/hook devem ser tratados explicitamente para evitar regressões.
- Limites existentes podem agrupar clientes atrás de proxy; não mudar configuração de proxy por conta deste escopo.
- A integração real do SMSMais faz parte da entrega, mas permanece desligada até o usuário configurar um token de produção com proteção válida e ativá-la. Créditos e revogação externa do token podem mudar depois de uma validação; tratar a resposta real de cada envio sem prometer entrega.
- As páginas do fornecedor resumem sandbox como simulado, enquanto a especificação registra entrega real ao celular verificado. Priorizar o contrato específico, não realizar envios no desenvolvimento e não ativar recuperação com token `sbx_`.

## Perguntas em aberto

- **Nenhuma pergunta bloqueia esta implementação.**
- Provedor fechado: **SMSMais (`smsmais.com`)**. O usuário adicionará a credencial pela aba; não é necessário fornecer token agora para implementar o código. Não substituir o fornecedor por outro nem reabrir a escolha.

## Critérios de aceite

- [x] “Entrar” acessa Equipe; “Animal já cadastrado” e acesso após cadastro acessam Tutor, sem seletor interno.
- [x] Login/recuperação usam o contexto municipal correto sem pedir município novamente e preservam o acesso global da equipe.
- [x] Todas as senhas manuais dos fluxos abrangidos seguem mínimo de 6 caracteres e máximo técnico de 72 bytes.
- [x] Consultar opções não envia código. O usuário escolhe um contato mascarado elegível antes do envio.
- [x] O envio e o reenvio respeitam exatamente a escolha, sem fallback automático.
- [x] Contatos válidos do novo cadastro são persistidos independentemente do acompanhamento, sem alterar contas existentes por submissão anônima.
- [x] A recuperação pode usar contato cadastral ainda não confirmado e confirma somente o utilizado ao concluir com sucesso.
- [x] WhatsApp só aparece quando disponível; SMS aparece somente com integração SMSMais municipal ativa/configurada e telefone válido, sem token de homologação.
- [x] Configurações → Integrações contém a aba SMS com SMSMais fixo, token de API, toggle funcional, salvar, remover token e teste de conexão/consulta de saldo sem envio.
- [x] Token fica cifrado no servidor e não retorna ao navegador; ativação inválida é rejeitada no backend. Desativar preserva o token; remover desativa.
- [x] Recuperação envia pelo SMSMais com o canal explicitamente escolhido, referência única do desafio e tratamento de falta de saldo, autenticação inválida, rejeição e timeout, sem fallback.
- [x] A redefinição apresenta somente os campos e ações necessários, sem os elementos e textos removidos.
- [x] Isolamento municipal, limites, expiração, consumo único, revogação e auditoria passam nas validações.
- [x] Código e documentação refletem os novos contratos; typecheck, testes e build passam sem erros novos.

Validação final de envio usa transportes simulados. Durante a implementação não foram configuradas credenciais reais de SMS nem realizados recarga, envio real de SMS, migration, seed, alteração de `.env`, commit ou push. A revisão de finalização também validou o encerramento de conexões em falhas do provedor e a expiração imediatamente antes do transporte, inclusive após a espera do gate de e-mail. O build mantém o aviso já conhecido sobre chunks acima de 500 kB. Não existe script de lint neste repositório.

## Instruções para /implementar

- Usar este documento como escopo aprovado e atualizado. Implementar os ajustes completos e a **integração real SMSMais**, incluindo configuração municipal segura, token e toggle funcional; a escolha do fornecedor já está concluída.
- Preservar o runtime e os padrões reais existentes, sem dependências novas nem migração de arquitetura.
- Seguir os contratos e as decisões de segurança aprovados, incluindo contato inicial elegível, mascaramento e canal explícito.
- Manter cada responsabilidade em módulo próprio. Não acrescentar toda a lógica ao `App.tsx` ou a um handler monolítico.
- Preservar as alterações locais preexistentes de instruções, skills e outros planos. Não incluí-las como parte desta implementação.
- Não alterar `.env`, executar migration/boot, fazer envio real, commit, push ou deploy nesta etapa. A finalização permanece separada.
- Informar ao concluir o que foi implementado e quais verificações passaram. Explicar apenas o que falta para uso operacional: o usuário cadastrar seu token na aba, ter créditos e ativar a integração; se a chave de cifra do servidor estiver ausente, informar essa dependência concreta sem editar `.env` por conta própria.
