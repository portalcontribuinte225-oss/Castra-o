# Acesso do tutor — fase 5

Implementação baseada em `.portal/plans/acesso-tutor-fase-5.md`, com os ajustes de `.plans/ajustes-login-recuperacao-senha.md`. Contas de tutor são municipais; não há migração de contas antigas nem compartilhamento automático de solicitações por CPF.

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

Configuração municipal: `castragestao:auth-delivery`. Somente administradores autorizados podem gravá-la. Os mapas `emailTemplates` e `whatsappTemplates` usam estas finalidades:

| Finalidade | Uso |
| --- | --- |
| `initial_password` | A senha inicial de uma conta realmente criada naquela operação |
| `password_reset` | Código de recuperação para o contato cadastral escolhido, inclusive ainda não confirmado |
| `verify_email` | Código enviado exclusivamente ao e-mail novo |
| `verify_phone` | Código enviado exclusivamente ao telefone novo |
| `contact_changed` | Aviso de alteração ao contato anterior confirmado |

E-mail usa as credenciais já configuradas do EmailJS e o mesmo controle de admissão do envio operacional. Parâmetros:

- Comuns: `to_email`, `to_name`, `purpose`.
- Senha inicial: `temporary_password`.
- Códigos: `code`, `codigo_recuperacao`, `validade` e `validity_minutes`.
- Aviso de contato alterado: `message`.

Na recuperação, o template de recuperação já configurado por `EMAILJS_TEMPLATE_ID` pode ser utilizado quando não houver substituição municipal. Demais finalidades exigem template próprio adequado. Não editar `.env` para esta configuração municipal.

WhatsApp reutiliza ativação, credenciais e cota municipais. Templates devem estar aprovados para a finalidade e corresponder aos componentes esperados pelo adapter:

- Senha inicial: corpo com nome e senha temporária, nessa ordem.
- Aviso de contato: corpo com nome.
- Código: corpo com código e botão de autenticação/cópia com o mesmo código.

Confirmar o formato aceito pelo template configurado antes de qualquer teste real autorizado. Não usar template de agenda para enviar credenciais nem inserir senha/código no resolver de variáveis operacionais.

Mensagens de segurança não são avisos de agenda/documentos e não alteram o opt-out da solicitação. Os contatos válidos do primeiro cadastro são salvos no perfil independentemente do acompanhamento operacional. A recuperação pode usar esses contatos ainda não confirmados; a conclusão correta confirma somente o contato utilizado. Uma senha exibida na conclusão também ter sido enviada por e-mail não confirma posse desse e-mail.

A confirmação de uma alteração de telefone no perfil continua usando seu fluxo próprio de WhatsApp, sem fallback de e-mail. SMSMais atende à recuperação de senha com escolha explícita. E-mail confirma e-mail; telefone confirma telefone.

## Entrada e recuperação

- O botão público “Entrar” abre acesso da equipe; “Animal já cadastrado” e o acesso após a primeira solicitação abrem acesso do tutor. O modal não oferece seleção de tipo de acesso ou município.
- O tutor usa o município já escolhido na página. Contas globais da equipe preservam o acesso sem município.
- Senhas manuais aceitam no mínimo 6 caracteres, sem composição obrigatória, e no máximo 72 bytes UTF-8. Senhas temporárias continuam aleatórias e exigem primeira troca.
- `POST /auth/recovery-options` recebe `identifier`, `audience` e `municipalityId` do contexto. Retorna `recoveryToken` e `options` com IDs opacos, canal e destino mascarado. Não envia mensagens nem invalida códigos existentes.
- E-mail compartilhado por mais de um tutor retorna `CPF_REQUIRED`; o usuário deve informar CPF, sem lista de titulares. Nenhuma opção é oferecida quando não há contato/canal disponível.
- `POST /auth/forgot-password` recebe `recoveryToken`, `optionId`, audiência e município. O servidor revalida identidade, revisões, contato e integração. O desafio é vinculado ao canal/destino por envelope versionado em `destination`, protegido pelo HMAC existente.
- Identificador de escolha expirado ou invalidado retorna `RECOVERY_OPTIONS_EXPIRED`; a interface limpa código/senhas e permite consultar os contatos novamente com o identificador preenchido.
- O envio e o reenvio usam somente a escolha explícita. Falha de WhatsApp/SMS não envia e-mail automaticamente. SMS desativado, incompleto ou em homologação não aparece.
- `POST /auth/reset-password` mantém o contrato de confirmação. Desafios antigos sem vínculo de destino exigem reiniciar a recuperação. Sucesso confirma apenas o contato usado, altera senha, invalida sessões e registra auditoria na mesma transação.
- Códigos valem 600 segundos, reenvio tem cooldown de 60 segundos e cada desafio admite 5 tentativas. Limites persistentes também abrangem consulta, conta e origem. `serverNow`, `expiresAt` e `retryAt` orientam o relógio sem mostrar contadores na interface.
- A etapa final mostra código, nova senha, confirmação e ações necessárias. Após sucesso, retorna ao login da mesma origem, sem autenticação automática.

## SMSMais em Configurações → Integrações → SMS

Cada município possui configuração independente em `castragestao:sms`. O formulário permite salvar/substituir/remover o token, ativar/desativar o canal e testar conexão/consultar saldo. Somente administração municipal do próprio município ou administração global autorizada pode gravar/testar; `sms_settings` controla a aba.

O token fica cifrado no servidor e nunca é devolvido em respostas de leitura/gravação. Campo vazio preserva a credencial; remoção explícita também desativa o canal. Desativar preserva a credencial. A proteção exige a `CONFIG_ENCRYPTION_KEY` existente válida (32 bytes em base64); sem ela, o servidor impede gravar o segredo/ativar e informa indisponibilidade da configuração segura. Não há fallback de texto puro para SMS.

`POST /sms/test-connection` consulta apenas `GET /saldo`, com o token informado ou salvo. Não envia SMS, não persiste token e não ativa a integração. Ativação/troca de credencial ativa exige validação no servidor e usa o snapshot realmente persistido, sem manter conexão de banco durante a rede. Saldo zero não invalida a credencial.

O adapter usa `POST https://smsmais.com/send`, Bearer no header, uma mensagem por desafio e referência externa correspondente ao ID do desafio. Não usa o endpoint individual que retém mensagens sem saldo para disparar após recarga. Aceite do provedor não é entrega nem verificação do telefone. Sem saldo, token inválido, rejeição ou timeout retornam falha segura sem troca de canal ou retry automático.

Tokens `sbx_` podem ser armazenados/testados, mas não habilitam recuperação pública. O sandbox do fornecedor pode enviar SMS real ao celular verificado da conta; os testes do projeto usam transportes simulados. Nenhum webhook ou URL pública é necessário para esta entrega. SMS operacional de agenda/documentos permanece desabilitado.

Referências do contrato: [API SMSMais](https://smsmais.com/api-sms) e [OpenAPI](https://smsmais.com/doc/openapi.yaml). O usuário obtém a credencial no painel do fornecedor e a informa no formulário; nunca a registra no código ou na conversa.

## Segurança e operação

- A senha inicial aparece somente na resposta que efetivamente cria a conta, em envelope separado da solicitação. Não há endpoint para recuperá-la depois.
- CPF repetido anonimamente não redefine senha nem associa solicitações existentes. O acesso usa a identidade autenticada no município.
- Primeiro login exige troca de senha antes de acessar dados; token restrito não equivale a sessão comum.
- Troca de senha, recuperação e desativação invalidam sessões antigas pelo estado persistido.
- Códigos expiram, têm limite de tentativas e são consumidos atomicamente. Reenvio não oferece tentativas ilimitadas.
- Limites por origem usam `req.ip`, sem confiar em um `X-Forwarded-For` arbitrário. Em implantação atrás de proxy, o operador deve validar a topologia antes de configurar proxies confiáveis; sem isso, o limite de origem pode agrupar clientes do mesmo proxy. Limites por conta/finalidade continuam persistentes.
- Recuperação presencial exige equipe autorizada, alvo tutor do município, confirmação de identidade, motivo e auditoria obrigatória. Sem auditoria, a operação não se efetiva.
- Operações de agenda exigem equipe interna/global. Operações e listas privadas de adoção preservam os papéis de operador já existentes, excluindo tutor. Catálogo e registro público de interesse retornam apenas dados públicos do animal e contagem agregada, sem os contatos de outros interessados.
- Leituras de equipe, permissões, templates de autenticação e cota são administrativas; tutor não pode gravar configurações ou consultar listas de credenciais. Eventos de recuperação e troca de contato podem ser filtrados na auditoria municipal.
- Senhas/códigos não pertencem a logs, histórico, PDFs, analytics, localStorage ou objetos de solicitações/credenciamentos.
- Aceite pelo provedor não confirma entrega. Não há fila durável ou reenvio automático; uma resposta perdida exige recuperação, sem regenerar segredo de conta existente.

## Validação antes de publicar

Executar testes, typecheck, build e as revisões de código/segurança da fase. Testes usam banco e transportes simulados, sem executar `server.js` ou a migration.

Após a aplicação autorizada do schema e configuração dos templates, conferir o fluxo de conta nova, primeira troca, perfil, recuperação e isolamento municipal. Um envio real requer autorização própria e destinatário de teste controlado.
