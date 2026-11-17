# Acesso do tutor — fase 5

Implementação baseada em `.plans/acesso-tutor-fase-5.md`, com os ajustes de `.plans/ajustes-login-recuperacao-senha.md`. Contas de tutor são municipais; não há migração de contas antigas nem compartilhamento automático de solicitações por CPF.

## Aplicação do schema

O código depende da migration nova `backend/src/db/sql/20261113-tutor-access.sql`. Ela **não** é executada pelo boot legado. Não iniciar o servidor nem publicar a aplicação dependente desse schema antes de aplicar a migration no ambiente correto.

1. Confirmar explicitamente o ambiente e a autorização para alterar o banco.
2. Revisar a migration e conferir que ela ainda não foi aplicada. Não executar duas vezes: a migration é transacional, com criação explícita de tabelas/constraints.
3. Usar a conexão PostgreSQL previamente configurada pelo operador. Exemplo de comando, **não executado pela implementação**:

   ```powershell
   psql -v ON_ERROR_STOP=1 -f backend/src/db/sql/20261113-tutor-access.sql
   ```

4. Conferir tabelas, índices e constraints criados antes de implantar o código.

O arquivo preserva a unicidade global de `users.email` para contas internas e permite valor nulo somente para tutores. CPF e contatos do tutor ficam em `tutor_profiles`, com unicidade de CPF no município e FK de correspondência municipal. Não há backfill, seed, alteração de senha existente ou limpeza de registros.

O índice único de e-mail normalizado falha se existirem contas internas distintas com e-mails que diferem apenas em maiúsculas/minúsculas. Nesse caso, a transação deve falhar e a implantação aguardar intervenção autorizada; não mesclar, excluir ou renomear identidades automaticamente.

O runtime continua usando o entrypoint `pg` existente, com queries parametrizadas, validação de município e transações explícitas nos repositories. Não presumir RLS automático ou Drizzle; nenhum ORM novo foi instalado nesta fase.

## Templates de autenticação

Os templates de e-mail são globais: o master salva a conta do EmailJS e o ID de cada template na aba E-mail (Configurações > Integrações). Cada município só liga ou desliga cada mensagem. A recuperação de senha por e-mail vem ligada por padrão; as demais finalidades vêm desligadas e só ligam quando o master já configurou o template. Não há fallback para variáveis de ambiente `EMAILJS_*`. As finalidades de e-mail são estas:

| Finalidade | Uso |
| --- | --- |
| `password_reset` | Código de recuperação para o contato cadastral escolhido, inclusive ainda não confirmado |
| `verify_email` | Código enviado exclusivamente ao e-mail novo |
| `verify_phone` | Código enviado exclusivamente ao telefone novo (não tem template de e-mail) |
| `request_tracking` | Código enviado ao contato do acompanhamento da solicitação e, em "Acessar minha solicitação", ao contato do tutor que está na solicitação |
| `contact_changed` | Aviso de alteração ao contato anterior confirmado |

E-mail usa a conta global do EmailJS e o mesmo controle de admissão do envio operacional. Parâmetros:

- Comuns: `to_email`, `to_name`, `purpose` e a identidade do município (`municipality_name`, `municipality_brasao_url`, `department_name`, `municipality_contact`, `municipality_email`, `municipality_address`). O brasão sai por uma rota pública (`/api/public/municipalities/:id/brasao`) e depende do endereço público do sistema salvo pelo master.
- Códigos: `code`, `codigo_recuperacao`, `validade` e `validity_minutes`.
- Aviso de contato alterado: `message`.

A recuperação de senha de equipe global (sem município) usa o template global de `password_reset`, sem interruptor. Sem a conta ou o template, o e-mail fica indisponível. Não editar `.env` para esta configuração.

WhatsApp reutiliza ativação, credenciais e cota municipais. Templates devem estar aprovados para a finalidade e corresponder aos componentes esperados pelo adapter:

- Aviso de contato: corpo com nome.
- Código: corpo com código e botão de autenticação/cópia com o mesmo código.

Confirmar o formato aceito pelo template configurado antes de qualquer teste real autorizado. Não usar template de agenda para enviar credenciais nem inserir senha/código no resolver de variáveis operacionais.

Mensagens de segurança não são avisos de agenda/documentos e não alteram o opt-out da solicitação. Os contatos do tutor que estão na solicitação vão para o perfil quando a conta nasce, no primeiro acesso, independentemente do acompanhamento operacional; só o contato que recebeu o código nasce confirmado. A recuperação pode usar os contatos ainda não confirmados; a conclusão correta confirma somente o contato utilizado.

**Contato do tutor e avisos.** O formulário público e o preenchido pela equipe são o mesmo componente e têm os mesmos quatro passos: Você, Animal, Agenda e Documentos (no balcão, os documentos são opcionais e não há termo do tutor). As perguntas do passo "Você" são cards grandes, sem resposta marcada, e cada resposta vira uma linha com "Alterar". No público o passo abre com "Como deseja solicitar?": "Primeira solicitação" segue no formulário e "Animal já cadastrado" abre o login do tutor (não há mais tela separada para essa escolha; "Solicitar procedimento", "Agendar castração" e o mutirão abrem o formulário direto). Depois vem "Esse animal tem tutor ou responsável?". Com tutor, pede os dados do responsável e o contato: o celular é obrigatório e o e-mail é opcional (mas válido quando informado). Celular é número completo: 11 dígitos, DDD e o 9 (`shared/phone-contract.js`, a mesma regra do envio de SMS); o servidor também exige, quando o tutor é exigido, salvo para tutor logado (vale o perfil) e para a denúncia (regra própria de telefone). A edição do tutor no atendimento também não deixa apagar o celular. O contato de um usuário da equipe nunca vem preenchido no formulário: só o de um tutor logado. Logo abaixo dos contatos vem "Quer acompanhar esta solicitação?": o "Sim, quero" nomeia os canais usados (o celular só entra se o município usa canal de telefone) e fica travado enquanto não houver contato que o município alcance. Sem tutor, o passo só pergunta "Quer acompanhar esta solicitação?" e, se a resposta for sim, pede celular e/ou e-mail (ao menos um); nada do tutor é enviado. Tutor logado ou animal já cadastrado não responde as duas primeiras: o passo mostra os contatos do cadastro e a pergunta dos avisos. Em todos os casos "Próximo" exige as respostas do passo. O acompanhamento salvo continua `{ enabled, email, phone }`, e o servidor aceita "ao menos um contato" (e-mail válido, ou celular quando há canal de telefone). Só essa resposta decide se o cadastro pede o tutor, no formulário e no servidor: são dois valores fixos (`AnimalTutorship`, em `shared/request-tutorship-contract.js`, guardados como `animal_com_tutor` e `animal_sem_tutor` em `workflow_data.tutorship` da solicitação e em `metadata.tutorship` do animal), sem resposta vale "com tutor" e qualquer outro valor é recusado. Não existe mais configuração de tipos de identificação nem interruptores de etapa por tipo: o município não liga nem desliga o tutor, a agenda ou os documentos, e os tipos de solicitação não dispensam o tutor. Um animal cadastrado cuja resposta não seja um dos dois valores fica bloqueado até a equipe conferir o cadastro.

**Declaração, requerimento e tela final.** O texto da declaração que o tutor aceita, a declaração impressa e a página 2 do requerimento (PDF) saem de um só contrato, `shared/request-declaration-contract.js`, com as variáveis do município (`{municipality}`, que vira "município de X", e `{department}`, o órgão, ou "a Prefeitura" quando o município não tem órgão cadastrado). Os nomes vêm do município da solicitação, nunca do que o tutor digita, e a cláusula dos animais de agricultores e da taxa só entra quando algum procedimento escolhido é cobrado (no requerimento, quando o valor guardado na solicitação não é "Gratuito"). Os textos são jurídicos: a revisão deles é do município. A tela final é a mesma na página pública e no modal do balcão (`RequestDoneCard`): "Recebemos sua solicitação! Ela está em análise.", o protocolo, o resumo dos avisos e o botão "Baixar requerimento"; só a página pública, quando a solicitação tem tutor, mostra também "Criar minha senha", que abre "Acessar minha solicitação" com o protocolo e o CPF já preenchidos (o código continua obrigatório). O tutor logado ("Animal já cadastrado") termina na mesma tela. Público e balcão montam o envio no mesmo ponto do formulário: o balcão acrescenta as observações internas e a origem, o público acrescenta o termo; só o público exige o termo e os documentos obrigatórios, e a agenda é exigida pelos dois.

Os códigos enviados a um telefone (confirmação de telefone e acompanhamento de solicitação por telefone) e o aviso de contato alterado tentam o WhatsApp e, se ele não enviar, o SMS, sempre para o mesmo telefone informado, sem fallback de e-mail (o aviso de contato alterado mantém o e-mail como reserva). A recuperação de senha segue com escolha explícita entre os canais disponíveis. E-mail confirma e-mail; telefone confirma telefone.

## Acessar minha solicitação (código para criar a senha)

Enviar uma solicitação não cria conta nem senha, no público ou no balcão. A conta do tutor nasce no primeiro acesso, pela página "Acessar minha solicitação", aberta pelo link do aviso "Solicitação registrada" (`/?m=<slug do município>&acessar=<protocolo>`, `shared/request-access-contract.js`) ou pelo botão "Criar minha senha" da tela final. O link escolhe o município pelo slug antes de qualquer outra escolha e sai da barra de endereço; um link malformado abre a página vazia.

- `POST /request-access/challenges` `{ municipalityId, protocol, cpf, channel }` (`channel` é `email` ou `phone`): limites por protocolo+origem, por CPF e por canal+protocolo, todos pelo que foi digitado. Só uma solicitação de procedimento de município ativo, com o CPF do tutor igual ao digitado e o contato do canal escolhido (e-mail ou celular do tutor, que já estão na solicitação), recebe o código, em segundo plano, com a mensagem do acompanhamento (`request_tracking`). A resposta é a mesma em todos os casos e o CPF nunca vai em mensagem.
- `POST /request-access/challenges/:id/confirm` `{ code, cpf }`: o CPF é conferido de novo contra a solicitação (tempo constante) antes do código; CPF errado gasta uma tentativa, como código errado. Por isso um código do acompanhamento, que não pede CPF, não abre o requerimento sem o CPF. Devolve um token de 15 minutos com finalidade de assinatura própria: o token do acompanhamento não abre o requerimento, e este não vale como sessão. Auditado como `REQUEST_ACCESS_GRANTED`.
- `GET /request-access/request` (Bearer): só o que o requerimento imprime (tutor, animais, agenda, protocolo, status, origem e aceite) e `account.exists`. Nada de histórico, observações, documentos, atribuição ou outras solicitações. `Cache-Control: no-store`.
- `POST /request-access/password` (Bearer) `{ password }`: em transação, com lock por município+CPF, cria o usuário `tutor` sem troca obrigatória e o perfil com nome, CPF, contatos e endereço da solicitação; confirma só o contato que recebeu o código (e só se ele ainda for o da solicitação); liga a solicitação verificada e seus animais sem tutor (`requests.tutor_id` e `animal_tutors`) e devolve a sessão como o login. CPF que já tem conta, ou solicitação que já tem tutor, recebe 409 e a página mostra "Entrar"; nada é criado nem ligado. Auditado como `TUTOR_ACCOUNT_CREATED`, sem senha nem contato.

Tutores atendidos no balcão que nunca acessarem ficam sem conta, de propósito.

## Aviso "Solicitação registrada"

Evento `request_registered`, nos três canais, disparado depois que a solicitação é salva e respondida (público e balcão, com ou sem tutor), só quando os avisos foram aceitos (`followUp.enabled === true`); fica no histórico como os outros avisos e nunca atrasa nem desfaz a solicitação. O texto: "Solicitação registrada! Protocolo X. Atendimento em DD/MM/AAAA, às HH:MM, em LOCAL. Sua solicitação está em análise. Para ver seu requerimento e criar sua senha, acesse: URL" (sem o atendimento quando não há agenda; "Para ver seu requerimento, acesse" quando o CPF já tem conta). O link só entra quando a solicitação tem tutor e o master salvou o endereço público na aba E-mail. No SMS o link só entra inteiro, quando cabe depois da agenda. Fora do código: criar na Meta o template `castracao_solicitacao_registrada` (2 variáveis: protocolo e texto do aviso), cadastrar o ID do template no EmailJS e ligar o uso por município nas telas de SMS, e-mail e WhatsApp (nasce desligado).

## Entrada e recuperação

- O botão público “Entrar” abre acesso da equipe; “Animal já cadastrado” e o “Entrar” de "Acessar minha solicitação" abrem acesso do tutor. O modal não oferece seleção de tipo de acesso ou município.
- O tutor usa o município já escolhido na página. Contas globais da equipe preservam o acesso sem município.
- Senhas manuais aceitam no mínimo 6 caracteres, sem composição obrigatória, e no máximo 72 bytes UTF-8. Senhas temporárias existem só na equipe (gestor criado com o município, protetor/ONG aprovados): continuam aleatórias e exigem primeira troca. O tutor cria a própria senha no primeiro acesso.
- `POST /auth/recovery-options` recebe `identifier`, `audience` e `municipalityId` do contexto. Retorna `recoveryToken` e `options` com IDs opacos, canal e destino mascarado. Não envia mensagens nem invalida códigos existentes.
- E-mail compartilhado por mais de um tutor retorna `CPF_REQUIRED`; o usuário deve informar CPF, sem lista de titulares. Nenhuma opção é oferecida quando não há contato/canal disponível.
- `POST /auth/forgot-password` recebe `recoveryToken`, `optionId`, audiência e município. O servidor revalida identidade, revisões, contato e integração. O desafio é vinculado ao canal/destino por envelope versionado em `destination`, protegido pelo HMAC existente.
- Identificador de escolha expirado ou invalidado retorna `RECOVERY_OPTIONS_EXPIRED`; a interface limpa código/senhas e permite consultar os contatos novamente com o identificador preenchido.
- O envio e o reenvio usam somente a escolha explícita. Falha de WhatsApp/SMS não envia e-mail automaticamente. O SMS só aparece com o canal da plataforma ativo, a credencial de produção validada, o município com contrato de SMS vigente e com saldo no mês e a mensagem de recuperação de senha ligada para o município (ela vem ligada por padrão); desativado, incompleto, em homologação, sem contrato ou saldo, ou com a mensagem desligada, não aparece. O e-mail só aparece com saldo no contrato de e-mail do município; a equipe sem município recupera por e-mail sem depender de contrato.
- `POST /auth/reset-password` mantém o contrato de confirmação. Desafios antigos sem vínculo de destino exigem reiniciar a recuperação. Sucesso confirma apenas o contato usado, altera senha, invalida sessões e registra auditoria na mesma transação.
- Códigos valem 600 segundos, reenvio tem cooldown de 60 segundos e cada desafio admite 5 tentativas. Limites persistentes também abrangem consulta, conta e origem. `serverNow`, `expiresAt` e `retryAt` orientam o relógio sem mostrar contadores na interface.
- A etapa final mostra código, nova senha, confirmação e ações necessárias. Após sucesso, retorna ao login da mesma origem, sem autenticação automática.

## SMSMais em Configurações → Integrações → SMS

A conta do SMSMais é da plataforma: uma só linha em `castragestao:sms`, sem município, que só o master grava e testa (`PUT /sms/account`, `POST /sms/test-connection`, `POST /sms/test-message`). O município não tem conta própria: cada um tem um contrato de mensagens (abaixo) e liga as mensagens que quer enviar. A aba é uma tela só, com o contador do contrato no topo. **Credenciais** (só o master): o token aparece só pelo começo (8 caracteres, no mesmo campo de segredo do WhatsApp e do e-mail), com "Ativar SMS" (vale para todos os municípios), remoção confirmada e teste de conexão/saldo e de envio. **Mensagens:** uma tabela com os 11 usos, o exemplo do texto (com o nome do município) e o interruptor de cada um, que quem tem a permissão `sms_settings` (ou a administração global) liga e desliga. `GET /sms/settings` devolve ao master a conta e, a quem tem a permissão `sms_settings`, só se o canal está ativo, as mensagens e o nome do município. A leitura pública `GET /sms/availability?municipalityId=` devolve só `{ active }` (canal ativo e município com contrato vigente), para o formulário de acompanhamento saber se pode pedir telefone. A conta não passa mais por `/config`.

O token fica cifrado no servidor e nunca é devolvido inteiro em respostas de leitura/gravação: o master recebe apenas `tokenPreview`, os 8 primeiros caracteres, gravados ao salvar o token (registros antigos sem prévia mostram a máscara de tamanho desconhecido). Salvar sem token preserva a credencial; remoção explícita também desativa o canal. Desativar preserva a credencial. A proteção exige a `CONFIG_ENCRYPTION_KEY` existente válida (32 bytes em base64); sem ela, o servidor impede gravar o segredo/ativar e informa indisponibilidade da configuração segura. Não há fallback de texto puro para SMS.

**Usos.** São 11 mensagens, cada uma com interruptor por município em `sms_active_uses` (`PUT /sms/uses/active`, auditado como `SMS_USE_UPDATE`): solicitação registrada, agendamento confirmado e alterado, não comparecimento, documentos conferidos, atendimento concluído, solicitação indeferida, recuperação de senha, confirmação de telefone, acompanhamento de solicitação e contato alterado. Só a recuperação de senha vem ligada. Ligar um uso exige o canal da plataforma ativo e o serviço do município ligado; desligar é sempre permitido, e desativar o canal preserva os interruptores. Quando um uso está ativo, ele é usado: nos avisos da solicitação, e-mail, WhatsApp e SMS são tentados de forma independente, cada um quando está em uso e há contato; um canal desligado, ou sem o aviso ligado, não é tentado e não deixa entrada no histórico, e a falha de um não impede os outros. O formulário de acompanhamento pede telefone quando o WhatsApp está ativo **ou** o SMS alcança o município (canal ativo e contrato vigente).

**Textos.** Fixos no código (`shared/sms-messages-contract.js`), sem acento, no máximo 160 caracteres e começando pelo nome do município; o local e o nome são cortados para o texto caber. O código só aparece nos usos de código. Exemplo: `Criciuma: seu codigo e 123456. Valido por 10 minutos. Nao compartilhe.`

`POST /sms/test-connection` (só o master) consulta apenas `GET /saldo`, com o token informado ou salvo. Não envia SMS, não persiste token e não ativa a integração. Ativação/troca de credencial ativa exige validação no servidor e usa o snapshot realmente persistido, sem manter conexão de banco durante a rede. Saldo zero não invalida a credencial.

O adapter usa `POST https://smsmais.com/send`, Bearer no header, uma mensagem por envio e referência externa correspondente ao ID da mensagem (o ID do desafio nos códigos, um UUID novo nos avisos). A resposta só é aceita se o texto, o destino e a referência devolvidos forem os enviados. Não usa o endpoint individual que retém mensagens sem saldo para disparar após recarga. Aceite do provedor não é entrega nem verificação do telefone. Sem saldo, token inválido, rejeição ou timeout retornam falha segura sem troca de canal ou retry automático.

Tokens `sbx_` podem ser armazenados/testados, mas não ativam o canal nem enviam. O sandbox do fornecedor pode enviar SMS real ao celular verificado da conta; os testes do projeto usam transportes simulados. Nenhum webhook ou URL pública é necessário. Com os textos maiores dos avisos, confirmar com um token real que o provedor devolve o texto sem alteração antes de ligar os avisos.

**Contrato de mensagens.** Os três canais (WhatsApp, SMS e e-mail) têm o mesmo contrato por município, nas chaves `whatsapp_quota`, `sms_quota` e `email_quota`: limite mensal, início, fim e uso do mês, contado no calendário de São Paulo. Cada tentativa de envio gasta uma mensagem do canal; sem plano, fora da vigência ou com o mês esgotado, o envio é bloqueado (`quota_unavailable`) e os outros canais seguem. O teste de envio de SMS e a recuperação de senha da equipe global, sem município, não gastam contrato. O master grava o contrato e zera o mês (`PUT /message-quota/:channel`, `POST /message-quota/:channel/reset`, o primeiro auditado); quem tem a permissão do canal lê só o contrato do próprio município (`GET /message-quota/:channel`), no contador no topo da aba de cada canal. Municípios sem contrato de SMS ou de e-mail não enviam por esse canal até o contrato ser cadastrado.

**Quem faz o quê nas integrações.** O admin (master) faz a integração: conta e token do SMS, conta e templates do e-mail, credenciais, teste e sincronização de templates do WhatsApp, o contrato e, no SMS e no e-mail, o interruptor "Serviço ativo para este município" (`PUT /message-quota/:channel/enabled`, auditado; guardado no contrato, ausente significa ligado). Com o serviço desligado o canal não envia, some da recuperação de senha, o formulário de acompanhamento não pede telefone por SMS e as mensagens do município ficam travadas. O suporte só lê. Ligar e desligar os tipos de mensagem é configuração do município: vale para quem tem o item do canal (`whatsapp_settings`, `sms_settings` ou `email_settings`) no grupo de permissões, e o contador do contrato segue a mesma permissão. O servidor confere o grupo (`castragestao:teams` e `permission_groups` do município do usuário, achando o usuário por id ou e-mail); grupo inativo ou ausente vale como sem grupo, e sem grupo só o gestor passa. O grupo padrão "Acesso total" inclui os três itens, e `backend/scripts/add-integration-permissions.js` (simulação por padrão; `--apply` grava, e fora do banco local exige `--confirm-host=<host>`) os acrescenta aos municípios que já existem. O admin global começa sem município selecionado ao logar: a escolha do filtro vale só durante a sessão.

Referências do contrato: [API SMSMais](https://smsmais.com/api-sms) e [OpenAPI](https://smsmais.com/doc/openapi.yaml). O usuário obtém a credencial no painel do fornecedor e a informa no formulário; nunca a registra no código ou na conversa.

## Segurança e operação

- O tutor não recebe senha: cria a própria no primeiro acesso, depois de provar protocolo, CPF e código. A resposta de `POST /requests` traz só a solicitação.
- CPF repetido anonimamente não redefine senha nem associa solicitações existentes; o primeiro acesso liga só a solicitação verificada. O acesso usa a identidade autenticada no município.
- Primeiro login da equipe com senha temporária exige troca de senha antes de acessar dados; token restrito não equivale a sessão comum.
- Troca de senha, recuperação e desativação invalidam sessões antigas pelo estado persistido.
- Códigos expiram, têm limite de tentativas e são consumidos atomicamente. Reenvio não oferece tentativas ilimitadas.
- Limites por origem usam `req.ip`, sem confiar em um `X-Forwarded-For` arbitrário. Em implantação atrás de proxy, o operador deve validar a topologia antes de configurar proxies confiáveis; sem isso, o limite de origem pode agrupar clientes do mesmo proxy. Limites por conta/finalidade continuam persistentes.
- A equipe corrige os dados do tutor e define uma senha nova na aba "Dados do tutor" do atendimento (`GET`/`PUT /auth/request-tutor/:requestId`). Exige equipe interna do município da solicitação; o CPF não muda; a senha digitada vale como está, sem troca obrigatória, e não vai para o log. Sem auditoria (`TUTOR_DATA_UPDATE`), a operação não se efetiva.
- Operações de agenda exigem equipe interna/global. Operações e listas privadas de adoção preservam os papéis de operador já existentes, excluindo tutor. Catálogo e registro público de interesse retornam apenas dados públicos do animal e contagem agregada, sem os contatos de outros interessados.
- Leituras de equipe, permissões, templates de autenticação e cota são administrativas; tutor não pode gravar configurações ou consultar listas de credenciais. Eventos de recuperação e troca de contato podem ser filtrados na auditoria municipal.
- Senhas/códigos não pertencem a logs, histórico, PDFs, analytics, localStorage ou objetos de solicitações/credenciamentos.
- Aceite pelo provedor não confirma entrega. Não há fila durável ou reenvio automático; uma resposta perdida exige recuperação, sem regenerar segredo de conta existente.

## Validação antes de publicar

Executar testes, typecheck, build e as revisões de código/segurança da fase. Testes usam banco e transportes simulados, sem executar `server.js` ou a migration.

Após a aplicação autorizada do schema e configuração dos templates, conferir o fluxo de conta nova pelo código para criar a senha, perfil, recuperação e isolamento municipal. Um envio real requer autorização própria e destinatário de teste controlado.
