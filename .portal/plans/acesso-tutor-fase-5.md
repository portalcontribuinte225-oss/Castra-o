# Plano: Acesso do tutor — fase 5

## Origem

- Especificação: `.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md`.
- Fase: 5 — conta, senha, login, recuperação, perfil e recuperação assistida do tutor.
- Data do planejamento: 2026-11-13.
- Base investigada: commit `bc596dc`, que concluiu a fase 4.
- Classificação: `fullstack + database`.
- Aprovação: o usuário autorizou salvar a proposta revisada com a resposta “pode”.
- Decisões explícitas do usuário: **conta por município**; **o sistema é novo e não tem contas antigas**.
- Destino aprovado: `.portal/plans/acesso-tutor-fase-5.md`, mantendo a organização do roadmap deste projeto. Essa aprovação específica do destino prevalece sobre a pasta `.plans/` da skill global invocada.

## Resumo

Criar o acesso do tutor ao concluir sua primeira solicitação pública com identificação de tutor e CPF válido. Reutilizar `users` para autenticação e acrescentar um perfil de tutor municipal para CPF e contatos. A senha inicial é aleatória, persistida somente como hash, exibida uma única vez e enviada ao contato informado quando houver canal adequado.

Implementar login por CPF ou e-mail no município, troca obrigatória da senha inicial, recuperação com códigos seguros, perfil com confirmação do contato novo e recuperação assistida com auditoria obrigatória. A área autenticada inicial apresenta solicitações próprias e perfil; a lista de animais continua na fase 6.

A fase também precisa fechar caminhos existentes de alteração indevida de contas, exposição de credenciais e permissões administrativas acessíveis a tutores. Sem isso, adicionar contas públicas tornaria esses caminhos diretamente exploráveis.

## Decisões fechadas e simplificação aprovada

- Uma conta de tutor por CPF **em cada município**. O mesmo CPF pode ter credenciais diferentes em municípios diferentes, sem compartilhar solicitações ou sessões municipais.
- Não há contas antigas de tutor a migrar. Não implementar backfill de CPF, importação de contas, contas provisórias para reivindicar histórico, comprovação de contato histórico ou fluxo de liberação de registros legados.
- Não inferir, a partir dessa informação, autorização para apagar dados de teste, contas internas, tabelas, chaves ou registros existentes.
- A proteção contra repetição continua necessária: depois de criada a primeira conta, nova solicitação anônima com o mesmo CPF não revela nem redefine a senha dessa conta.
- E-mail pode ser compartilhado entre familiares. Pode servir como identificador de login quando resolver uma única conta de tutor no município; em caso de ambiguidade, solicitar CPF sem listar pessoas ou divulgar quantas contas existem.
- A conta funciona sem e-mail/telefone. Nesse caso, a senha inicial aparece na conclusão e a recuperação posterior depende do atendimento presencial.
- Um contato informado não é automaticamente confirmado. Receber a senha inicial no navegador ou fazer login com ela não comprova posse do contato que também a recebeu.
- As solicitações pertencem ao usuário identificado pelo servidor, não a uma busca pública por CPF. CPF é um identificador declarado, não uma prova de identidade civil.

## Escopo

### Dentro do escopo

- Conta de tutor criada transacionalmente com a primeira solicitação elegível.
- Identidade municipal por CPF; contatos opcionais separados do e-mail de contas internas.
- Senha inicial aleatória, apresentação única e envio por adapter de autenticação com template adequado.
- Login de tutor por CPF/e-mail e município, mantendo o acesso da equipe.
- Troca obrigatória da senha inicial com restrição efetiva no backend.
- Validação de sessão no servidor, revogação e tratamento de usuário/município desativados.
- Recuperação de senha com código protegido, validade, limite de tentativas e consumo único transacional.
- Perfil do tutor, confirmação dos contatos e alteração segura de senha.
- Recuperação por atendente autorizado, com identificação presencial, motivo e auditoria obrigatória.
- Área mínima do tutor com solicitações autenticadas e perfil.
- Proteção dos endpoints de configuração, credenciamento e dados que não devem ser acessíveis a tutores.
- Encerramento da divulgação de senhas temporárias em listagens e da devolução da chave existente de outro acesso por uma nova solicitação pública.
- Migration nova, testes isolados e revisões adicionais de código e segurança previstas no roadmap.

### Fora do escopo

- Migração de contas antigas ou vinculação de histórico legado; o usuário confirmou que não existem contas antigas.
- Conta única global, federação de identidades ou compartilhamento de conta entre municípios.
- Lista, busca e seleção de animais, formulário simplificado e reaproveitamento documental: fase 6.
- Consulta por protocolo/contato, tokens de acompanhamento e remoção completa da infraestrutura de chaves: fase 7.
- Integração de SMS, passkeys, MFA, login social ou validação de CPF por serviço externo.
- Reformulação geral do credenciamento de ONG/protetor ou do painel administrativo; corrigir apenas os caminhos necessários de autorização, colisão de identidade e exposição de credenciais.
- Trocar ORM, adicionar framework de autenticação, instalar React Query/Zod/RHF, criar fila/worker ou mudar a estratégia de deploy como efeito colateral.
- Executar migrations, seeds, limpeza de dados, alterar `.env`, fazer commit/push ou deploy durante `/implementar`.

## Leitura de contexto

- `AGENT.md`; não foram encontrados `CLAUDE.md`, `frontend/AGENT.md` ou `backend/AGENT.md` no repositório.
- Skill global `C:/Users/rodri/.codex/skills/planejar/SKILL.md`, invocada pelo usuário, adaptada à estrutura real deste projeto.
- Especificação mestre e `.portal/plans/acompanhamento-canais-notificacoes-fase-4.md`.
- `backend/src/routes/auth.js`, `middleware/auth.js`, `tenant.js` e `db/migrations.js`.
- `backend/src/routes/requests.js`, `animals.js`, `config.js`, `accessRequests.js` e `municipalities.js`.
- `backend/src/services/audit.js`, `email.js`, `whatsapp.js`, `whatsappQuota.js`, `config-secret-cipher.js`, `request-submission.js` e `notifications/`.
- `backend/src/repositories/request-settings.js`, `municipalityDefaults.js`, `server.js` e o entrypoint `db/index.js`.
- `shared/notification-contract.js` e testes adicionados na fase 4 em `backend/test/`.
- `src/App.tsx`, `src/api.ts`, `src/domain.ts`, `src/utils.ts`, `src/features/accessRequests.tsx`, `src/features/request-follow-up/` e `src/features/notifications/`.
- `package.json`, `backend/package.json` e `tsconfig.json`.

### Constatações verificadas

- O login atual consulta `lower(users.email)` globalmente, sem município, e não aceita CPF.
- `users.email` é `UNIQUE NOT NULL`; não existem CPF/telefone nem controle de primeira troca em `users`. O índice de `lower(email)` não é uma restrição de unicidade.
- Existem escritores de usuários em autenticação, aprovação de credenciamento, criação de município e bootstrap. A unicidade global do e-mail é usada por `ON CONFLICT(email)`, inclusive no boot.
- O middleware atual verifica somente assinatura do JWT; mudanças de senha, role, município ou desativação não invalidam imediatamente tokens emitidos.
- A recuperação atual usa código em texto puro, throttle em memória e leitura/atualização não atômicas. O login não tem limite de tentativas.
- O frontend restaura `currentUser` do localStorage e entra no shell administrativo. Não há área de perfil do tutor funcional; `TutorDashboard` é usado principalmente pela consulta legada.
- A troca de senha própria usa o endpoint administrativo `PUT /auth/users`, incompatível com uma operação segura de autoatendimento do tutor.
- `createRequest` registra imediatamente a resposta no estado global, e `normalizeRequest` preserva propriedades extras. Uma senha anexada à solicitação pode se propagar para outros consumidores.
- `logAudit` engole falhas. Recuperação assistida não pode usar esse comportamento para uma auditoria obrigatória.
- Credenciamento exige apenas autenticação em caminhos de leitura/revisão, expõe `temporary_password` e possui upsert que pode sobrescrever outra identidade pelo e-mail.
- `teams`, `permission_groups` e outras configurações não protegidas na fase 4 ainda aceitam acessos impróprios de tutores.
- Nova solicitação pública com CPF pode receber a chave já existente desse CPF. Não usar essa chave como prova de posse de conta.
- O backend usa JavaScript e `pg`; Drizzle e o RLS descritos genericamente no `AGENT.md` não estão presentes no runtime investigado.

## Impacto por área

### Frontend

- Extrair autenticação/perfil para módulos específicos, evitando aumentar o monólito de `App.tsx` com regras de segurança.
- Manter o acesso da equipe e apresentar um contexto de acesso do tutor com CPF/e-mail e município. O backend deve conhecer explicitamente a audiência pretendida, sem inferir privilégio a partir do e-mail do perfil.
- Centralizar as chamadas em `src/api.ts` e hooks dedicados, seguindo os padrões já instalados. Remover `fetch` de recuperação dentro de `LoginView` e preservar o status HTTP em erros da API.
- Fazer bootstrap da sessão por endpoint autenticado, sem confiar em role, município ou `mustChangePassword` do localStorage.
- Bloquear também os efeitos de leitura e auto-save de configurações enquanto a sessão estiver pendente/restrita. Esconder menus não basta.
- Criar uma área mínima de tutor com suas solicitações, perfil e saída; reutilizar a apresentação existente de solicitações sem autenticar por chave legada.
- Criar tela obrigatória de primeira troca e formulário de senha própria. Tratar loading, erro, expiração da sessão restrita e limites de tentativas.
- Confirmar alterações de contato em duas etapas: solicitar código e confirmar. O contato atual permanece até concluir a operação.
- Exibir contatos mascarados nas confirmações e superfícies em que não for necessário editar o valor completo. Nunca exibir contato completo a quem só informou um CPF.
- Criar uma interface específica de recuperação de tutor para a equipe autorizada. Não reutilizar a lista de usuários internos como cadastro de tutores.
- Separar o retorno da criação da solicitação em envelope tipado, por exemplo `{ request, enrollment? }`. Extrair a credencial imediatamente na fronteira da API, antes de registrar/normalizar a solicitação.
- A senha inicial fica somente no estado efêmero da conclusão que efetivamente criou a conta. Limpar ao fechar, navegar, trocar município ou sair. Não acrescentá-la ao objeto de solicitação, localStorage, analytics, PDF ou histórico.
- Conclusão sem senha nova deve orientar login/recuperação sem divulgar a senha existente ou contatos da conta.
- Para novos acessos, a conclusão não depende de exibir chave antiga. Preservar as consultas da transição sem revelar novamente o segredo de uma conta existente.

### Backend

- Organizar controllers, services de autenticação, repositories e adapters de envio em módulos testáveis, com contratos compartilhados para finalidades e estados finitos.
- Reutilizar os endpoints de login e recuperação com audiência explícita, ou uma rota de login de tutor dedicada que preserve a compatibilidade do login interno. A decisão de privilégio vem da identidade persistida, nunca do contato do perfil.
- Acrescentar sessão atual, senha própria, perfil, desafios de contato e recuperação assistida. Os caminhos finais devem ser consistentes e documentados nos contratos da API.
- Operações autenticadas de tutor usam `user.id` e município resolvidos no servidor. Não aceitar ID, role, CPF proprietário ou município livremente do body para acessar outra conta.
- Criar conta/perfil e vincular a solicitação recém-criada na mesma transação, somente para fluxo elegível de tutor com CPF válido. Solicitação sem Tutor/CPF não cria conta por valores residuais ocultos do formulário.
- Nome e CPF do cadastro de tutor precisam ser válidos para criar a conta; não preencher nome ou e-mail fictícios para satisfazer constraints.
- Em sessão autenticada, identificar o tutor pelo perfil; não permitir que um CPF diferente no payload reassocie a conta ou a solicitação.
- Uma submissão anônima repetida pode salvar a solicitação conforme as regras do formulário, mas não altera a conta existente nem se apropria de suas solicitações. Não vincular registros existentes apenas por CPF/e-mail.
- Não mudar silenciosamente a recuperação de contas internas, o bootstrap do administrador ou os escritores de contas institucionais ao introduzir os perfis de tutor.
- Usar credencial aleatória de alta entropia, hash e troca obrigatória; código de verificação e senha são conceitos separados.
- A recuperação deve consumir código, alterar senha, revogar sessões e invalidar desafios anteriores atomicamente, de modo que apenas uma confirmação concorrente possa vencer.
- Chamadas de provedor ficam fora das transações e sem conexão de banco retida durante o envio.
- Respostas públicas de recuperação são genéricas para contas existentes/inexistentes, desativadas, sem contato ou limitadas. Não vazar existência por mensagens, status específicos ou diferenças triviais de tratamento; considerar a janela de resposta limitada quando houver envio inline.

### Banco de dados

Migration nova e explícita, sem editar a migration antiga já aplicada.

Modelo proposto:

1. **`users`**
   - Permitir `email = NULL` exclusivamente para role `tutor`, com constraint adequada.
   - Preservar `UNIQUE(email)` e a identificação das contas internas; não remover a constraint que o bootstrap utiliza.
   - Acrescentar `must_change_password` e `session_version`, com defaults compatíveis para contas internas.
   - Novas contas de tutor usam e-mail de autenticação interno nulo; seus contatos reais ficam em `tutor_profiles`.

2. **`tutor_profiles`**
   - `user_id` PK/FK, `municipality_id` obrigatório, CPF normalizado obrigatório e único no município.
   - E-mail/telefone opcionais, timestamps de confirmação e versão do perfil para invalidar desafios concorrentes obsoletos.
   - E-mail de contato não precisa ser único, pois pode ser compartilhado; índice municipal para resolução do identificador.
   - Garantir correspondência entre município do usuário e do perfil, preferencialmente com FK composta e índice/constraint de apoio.
   - CPF não é editável por autoatendimento genérico.

3. **`auth_challenges`**
   - ID opaco, usuário, município, finalidade, destino pendente, digest do segredo, validade, tentativas, próximo reenvio, consumo e resultado de envio.
   - Vincular a verificação à finalidade, usuário, município, destino e versão pertinente; um código de troca de telefone não pode redefinir senha ou alterar e-mail.
   - Nunca persistir o código em texto puro. Usar digest autenticado com segredo do servidor e separação de finalidade, sem inventar secret fixo no código.
   - Segredos e credenciais não pertencem a `workflow_data`.

4. **Limites persistentes de autenticação**
   - Contadores/janelas por identificador, finalidade e origem, incluindo identificadores inexistentes.
   - Chaves dos limites devem evitar CPF/e-mail/IP completos em logs. Definir expiração e limpeza limitada, sem mapas ou filas sem limite.

Não há backfill de contas antigas, preenchimento de CPF por histórico, mesclagem de usuários ou limpeza de registros nesta fase. Verificar as precondições do schema antes da aplicação, sem transformar essa verificação em migração de dados não solicitada.

O acesso ao banco deve usar o entrypoint existente e repositories com queries parametrizadas, escopo municipal e transações explícitas. Não presumir RLS/Drizzle nem introduzir outro pool. A escolha de compatibilidade com `pg`, diante da infraestrutura real e das regras genéricas do `AGENT.md`, deve ser documentada na implementação; não transformar a fase em instalação/migração de ORM.

> **Migrations não devem ser executadas sem confirmação explícita do usuário. O ambiente pode apontar para produção. Aprovar este plano ou chamar `/implementar` não autoriza aplicar schema, seeds ou scripts que escrevam no banco.**

### Infra/Deploy

- O boot atual chama `runMigrations()`. Não encaixar alterações novas na migration antiga nem iniciar o servidor para validar schema.
- Preparar migration nova revisável e instruções para sua aplicação autorizada antes de implantar o código que depende das tabelas/colunas novas.
- Mudanças aditivas devem permitir esse ordenamento sem redefinir senhas ou interromper o login interno.
- Reutilizar credenciais existentes dos provedores; não ler/expor valores de `.env` nem alterar arquivos de ambiente automaticamente.
- Configurar templates específicos de autenticação para boas-vindas/senha inicial, recuperação e confirmação de contatos. Não usar um template de agenda ou um texto de recuperação para uma finalidade diferente.
- A configuração de templates de autenticação deve ser municipal, validada e gravável apenas pela administração autorizada. Reutilizar `whatsapp.active` e a cota existentes, sem segundo toggle do canal.
- Reutilizar o transporte e a admissão limitada de e-mail da fase 4, com uma única política compartilhada entre os tipos de envio. Não criar outro sender independente que ultrapasse o limite do mesmo provedor.
- Não ampliar o resolver de variáveis operacionais de WhatsApp para aceitar senha/código ou campos arbitrários. Autenticação tem contrato explícito e adapter próprio para seus templates.
- Sem fila durável ou garantia de entrega nesta fase. Falha/timeout do provedor não deve desfazer solicitação/conta já gravadas nem provocar redefinição de senha em uma repetição.
- Falha na entrega da senha inicial fica claramente indicada na conclusão que já possui a senha efêmera. Em perda da resposta, usar recuperação confirmada/presencial; não recuperar o plaintext do banco.

## Arquivos provavelmente afetados

Arquivos existentes verificados:

- `src/App.tsx`, `src/api.ts`, `src/domain.ts` e `src/styles.css`.
- `src/features/accessRequests.tsx`: impedir persistência/exposição de credenciais temporárias em listas normalizadas.
- `src/features/request-follow-up/` e `src/features/notifications/`, apenas onde a integração de perfil/contatos exigir.
- `backend/src/routes/auth.js`, `middleware/auth.js` e `tenant.js`.
- `backend/src/routes/requests.js`, `animals.js`, `config.js`, `accessRequests.js` e `municipalities.js`.
- `backend/src/services/audit.js`, `email.js`, `whatsapp.js` e serviços de notificações reutilizados.
- `backend/src/server.js`, somente se necessário para montar novas rotas sem alterar o mecanismo antigo de migrations.
- Testes existentes em `backend/test/` e módulos de frontend afetados.

Novos artefatos previstos, com nomes finais em inglês:

- Módulos de acesso e perfil em `src/features/tutor-access/`.
- Contrato compartilhado de autenticação, separado do domínio de eventos operacionais.
- Services/repositories para perfis, sessão, desafios, limites e recuperação assistida; adapters de mensagens de autenticação.
- Migration SQL nova e documentação mínima de aplicação/setup de templates.

`backend/src/db/migrations.js` foi lido como contexto: **não editar a migration antiga**. Não alterar `.env`, lockfiles ou dependências sem necessidade demonstrada.

## O que será removido ou substituído

- `fetch` direto e URLs hardcoded de recuperação dentro de `LoginView`.
- Campo exclusivamente `type="email"` no login de tutor, substituído por identificador CPF/e-mail.
- Uso de `PUT /auth/users` para alterar a própria senha.
- Confiança no objeto de usuário persistido como fonte de autorização, sem validação de sessão.
- Throttle de recuperação baseado exclusivamente no mapa em memória.
- Persistência/comparação de novos códigos de recuperação em texto puro nas colunas antigas; remover esse caminho do código. A remoção física das colunas antigas, se necessária, exige migration nova e revisão própria.
- Registro público independente que permita contornar as regras do novo cadastro. Reutilizar o caso de uso seguro ou remover a rota se confirmada sem consumidores; não manter dois mecanismos incompatíveis de criação de tutor.
- Upserts de identidade que sobrescrevam senha, role ou município de outra conta por coincidência de e-mail.
- Persistência de novas senhas temporárias e exposição delas em consultas/listagens de credenciamento. A resposta que realmente gera uma nova credencial pode apresentá-la uma vez à pessoa autorizada, fora do objeto persistido/listado.
- Devolução da chave existente de um CPF a quem apenas submeteu uma nova solicitação anônima.
- Auto-save/carregamento de configurações administrativas por sessão de tutor ou sessão restrita.
- Imports, helpers e estilos que perderem todos os consumidores nessas substituições.

Não ocultar os caminhos substituídos por flags fixas, comentários, CSS ou supressões de compilação. Não remover nesta fase toda a infraestrutura da consulta por chave, que continua sendo tratada na fase 7.

## Estratégia de implementação

1. Confirmar o estado dos arquivos citados e preservar alterações locais não relacionadas. Não conectar ao banco desconhecido ou iniciar o boot como forma de investigação.
2. Definir contratos compartilhados: audiência, finalidade de desafio, estado de sessão, retorno de matrícula e erros seguros. O retorno de credenciais deve ser separado de `request` desde a fronteira da API.
3. Preparar a migration nova e repositories de perfil/sessão/desafios/limites. Entregar os comandos e precondições sem executá-los automaticamente.
4. Implementar serviços puros e transacionais de senha, validação de identificador, consumo de desafio, primeira troca e revogação; adicionar testes com relógio/transportes/banco injetáveis.
5. Fechar os caminhos administrativos exploráveis por tutor antes de liberar contas públicas: configuração, credenciamento, escritores de usuários, consultas sensíveis e emissão da chave existente.
6. Integrar o cadastro à transação da primeira solicitação e tratar concorrência/CPF existente sem trocar senha ou associar registros apenas por CPF.
7. Implementar login de tutor e sessão restrita, sessão atual, senha própria, recuperação e perfil, preservando login e credenciais das contas internas.
8. Integrar adapters de autenticação aos canais municipais, com templates corretos, cota, timeout e resultados sanitizados. Não enviar códigos/credenciais em testes reais.
9. Implementar área inicial, bootstrap de sessão, gate de primeira troca, recuperação e contato novo. Manter os efeitos administrativos fora da área do tutor.
10. Implementar recuperação assistida com auditoria obrigatória e autorização municipal, sem permitir promoção de role ou alteração de CPF por endpoint genérico.
11. Revisar retorno de senhas temporárias de credenciamento e remover persistência em listagens/objetos genéricos sem reformular todo o produto de credenciamento.
12. Rodar validações e revisão adicional de código/segurança previstas no roadmap. Documentar pendências de templates, aplicação de schema e conferência visual.

## Segurança, dados e multi-tenant

### Identidade e criação

- CPF válido é requisito de identificação, não prova de titularidade. Não liberar dados de outra conta por CPF, microchip, e-mail compartilhado ou chave antiga obtida em nova submissão.
- Unicidade municipal deve ser garantida pelo banco e pelo serviço, inclusive em cadastros concorrentes.
- Repetições nunca fazem `ON CONFLICT ... DO UPDATE password` nem revelam credenciais existentes.
- E-mail de perfil de tutor não entra em regras de promoção a `master`. Privilégio deve vir de papel confiável persistido, preservando a identificação segura do administrador de ambiente.
- Solicitação criada por atendente não transforma `req.user.id` do atendente em identidade de tutor; separar ator da operação e proprietário da solicitação.
- Não existir conta antiga elimina a migração de tutores, mas não elimina a proteção das contas internas já presentes no sistema.

### Senhas e sessões

- Usar gerador criptográfico para senha inicial e bcrypt existente com custo adequado, sem migração de hash oportunista.
- Política inicial recomendada para novas senhas do tutor: no mínimo 15 caracteres, permitir espaços/colar/gerenciador e não impor composição artificial. Rejeitar explicitamente entradas acima do limite de 72 bytes UTF-8 do bcrypt, sem truncamento silencioso.
- Senhas atuais da equipe não são reinicializadas por este plano.
- A senha inicial exige troca no primeiro acesso; o ticket dessa etapa é curto e restrito à troca. Não tratar esse ticket como sessão comum.
- A senha inicial não recebe um prazo adicional de ativação nesta fase; continua sujeita à troca obrigatória, recuperação, desativação e revogação. Isso preserva o uso de contas sem contato, sem criar recuperação remota fictícia.
- Verificar estado ativo, município, versão da sessão e restrições no servidor. Troca/reset/recuperação assistida invalidam sessões anteriores e desafios que deixaram de ser válidos.
- JWT antigo, role alterada e usuário desativado não podem continuar operando apenas por assinatura ainda válida.
- Respostas com senha/ticket sensível usam `Cache-Control: no-store`; nenhum segredo vai em URLs, logs, analytics, histórico ou PDFs.

### Desafios e limites

- Código aleatório, protegido por digest autenticado com finalidade/usuário/desafio; comparar e consumir em operação transacional.
- Valores iniciais propostos: código de seis dígitos, validade de 10 minutos, cinco tentativas e intervalo de 60 segundos entre envios. Reenvio não pode restaurar indefinidamente o orçamento de tentativas.
- Limitar também login e solicitações por identificador/origem, com espera temporária/progressiva e sem bloqueio permanente acionável por terceiros.
- Expiração, consumo, tentativas, reenvio, alteração de destino e recuperação concorrente precisam ser testados com relógio controlado.
- Não interpretar resposta `sent` como confirmação de posse do contato. O código de confirmação não é exibido no navegador que solicita o cadastro.

### Contatos e acompanhamento

- Mensagens de segurança da conta são separadas da preferência de avisos operacionais. Recusar acompanhamento não apaga contatos de recuperação já confirmados.
- Conta nova sem contatos permanece sem recuperação automática. Não usar `tutor_email`, `phone` ou `workflow_data.followUp` como contato confirmado apenas porque vieram no formulário.
- Confirmar e-mail enviando somente ao novo e-mail; confirmar telefone enviando somente ao novo telefone. Fallback para outro contato não comprova posse do destino proposto.
- Com WhatsApp desligado e SMS indisponível, o telefone não pode ser confirmado remotamente por e-mail. Mantê-lo não confirmado ou encaminhar ao atendimento autorizado.
- Mudança de contato exige sessão válida e senha atual quando aplicável, mantém o contato anterior até sucesso e notifica o contato anterior confirmado quando disponível.
- Após confirmação, atualizar os destinatários das solicitações próprias em andamento que tenham `followUp.enabled === true`. Não alterar recusas, solicitações de terceiros, documentos ou dados históricos da identidade do tutor.
- Essa atualização deve ser municipal, auditável e compatível com o lock das operações da fase 4.

### Recuperação assistida e permissões

- Apenas equipe interna/global autorizada; excluir tutor, ONG e protetor dos endpoints operacionais de recuperação.
- O alvo deve ser tutor do município da operação. Não aceitar alteração de role, município, senha de administrador ou identidade institucional nesse fluxo.
- Exigir confirmação de identidade e motivo. Gravar auditoria obrigatória na mesma transação; se ela falhar, a recuperação não acontece.
- Não guardar foto de documento ou dados pessoais desnecessários como justificativa. Auditoria referencia ator, alvo, município, método e motivo sem senha/código.
- Quando houver contato novo, confirmar a posse pelo canal adequado antes de habilitá-lo para recuperação remota. Sem contato, pode ser emitida nova senha temporária uma única vez no atendimento autorizado, com troca obrigatória.
- Aplicar política explícita às leituras/escritas de configuração, em vez de deixar qualquer chave nova automaticamente gravável por tutor. Proteger também leituras de equipe/grupos e endpoints de credenciamento.
- Não ampliar a superfície de consulta pública. Corrigir bypass de autorização em consultas de animal/solicitação que hoje permitam entrar sem comprovação exigida.

## Validações necessárias

- Município válido/ativo e origem confiável para toda operação autenticada; o município selecionado no login resolve o contexto de tutor, sem autorizar acesso a outro município.
- CPF normalizado, obrigatório no cadastro de tutor e único no município; não aceitar CPF distinto do perfil em operações autenticadas de proprietário.
- Nome válido para matrícula, sem placeholders de identidade.
- E-mail/telefone com tamanho e formato válidos; duplicidade de e-mail de contato não redefine propriedade.
- Audiência, role e finalidade com enum/constante compartilhada; payload não concede privilégios.
- Senha atual/nova/confirmada conforme a operação e limite de bytes do bcrypt.
- Desafio vinculado ao usuário, município, finalidade, destino e versão atuais; código não usado/expirado/bloqueado.
- Dados enviados pelo cliente não definem `verified_at`, `session_version`, `must_change_password`, proprietário ou resultado de entrega.
- Templates e canais adequados à finalidade; não usar fallback para validar posse de outro contato.
- Inputs e respostas de recuperação não expõem contatos completos, existência de conta ou detalhes internos do provedor/banco.
- Envelope de matrícula contém senha somente no sucesso que criou uma conta, nunca em listagens ou no retorno de conta existente.

## Testes recomendados

### Backend

- Mesmo CPF em municípios distintos e CPF duplicado no mesmo município, inclusive concorrência: apenas uma conta e uma apresentação de nova senha.
- CPF repetido anonimamente não redefine senha, muda contato, associa dados de outra conta ou devolve sua chave existente.
- Cadastro sem contato, sem Tutor/CPF e com campos residuais ocultos; atores internos não viram proprietários indevidos.
- Colisão de contato com conta interna e e-mail compartilhado entre tutores; login ambíguo solicita CPF sem enumerar identidades.
- Login válido/inválido, conta/município desativados, limites de tentativas e recuperação sem contato.
- Ticket de primeira troca impedido de acessar dados/configurações, inclusive após refresh; versão antiga revogada após mudança/reset.
- Código incorreto, expirado, reutilizado, destinado a outra finalidade/município/contato e consumo concorrente.
- Reenvio não zera tentativas de forma explorável; limites persistem entre instâncias do serviço testado.
- Contato novo só substitui o anterior após confirmação; envio vai ao destino novo; e-mail não confirma telefone.
- Atualização de avisos limitada às solicitações próprias em andamento com opt-in, preservando recusas e isolamento municipal.
- Recuperação assistida negada por role/município/alvo indevido; auditoria obrigatória falhando provoca rollback.
- Tutor não lista senhas de credenciamento, aprova credenciamento, altera equipe/grupos ou redefine conta privilegiada.
- Colisões nos escritores de usuários não sobrescrevem senha/role/município de outra identidade.
- Credenciais não presentes em histórico, logs, PDFs, objetos de solicitação, listagens ou respostas indevidas.
- Falha de provedor depois do commit não anuncia falha da solicitação nem possibilita regenerar senha existente por repetição.

### Frontend

- Identificador CPF/e-mail, seleção municipal, ambiguidade segura, loading e erros por status HTTP.
- Bootstrap autenticado e gate de primeira troca antes de efeitos administrativos; saída limpa o estado sensível.
- Senha inicial apenas na conclusão correta, fora da normalização/estado global e sem persistência local.
- Recuperação, expiração, cooldown e telas de confirmação do contato novo.
- Perfil com mascaramento e estados pendente/sucesso/falha; sem afirmar alteração antes de confirmar.
- Recuperação assistida visível somente à equipe autorizada, sem senha no objeto/lista de tutores.
- Regressão de login interno, credenciamento, formulário público, acompanhamento e área de solicitações.
- Troca de município não reutiliza sessão, contatos, códigos ou credenciais de outro contexto.

### Conferência integrada

- Conta nova criada no formulário, senha apresentada uma vez, primeiro login restrito, troca e entrada na área própria.
- Conta sem contato e recuperação presencial autorizada.
- Fluxo completo de recuperação e mudança de e-mail/telefone com transportes simulados.
- Conta criada seguida de nova solicitação anônima com mesmo CPF: nenhuma tomada de conta.
- Sem chamada real de provedor, banco de produção ou boot com migrations nos testes. Conferência visual em navegador somente quando solicitada.

## Comandos de validação sugeridos

Scripts existentes:

```powershell
npm run typecheck
npm test
npm run build
node --test (rg --files backend/test -g '*.test.js')
```

- Executar `node --check` nos módulos JavaScript alterados e conferir `git diff --check`.
- Não há script de lint na raiz nem scripts de test/typecheck/build em `backend/package.json`; não inventar comandos.
- Atualizar os fixtures de testes da fase 4 quando o middleware passar a validar sessão no servidor. Não enfraquecer a autenticação em produção para preservar fixtures antigos.
- Executar as revisões adicionais de código e segurança previstas para a fase 5 no roadmap (`/code-review high` e `/security-review`, ou revisão equivalente disponível), sem afirmar que já foram feitas durante este planejamento.

## Riscos e pontos de atenção

- A fase muda autenticação, autorização e schema; testes somente de funções puras não bastam. Cobrir fronteiras HTTP e transações com dependências simuladas.
- A implantação deve respeitar a aplicação autorizada da migration antes do código dependente. O boot atual executa a migration antiga; não usar deploy como autorização implícita de schema.
- Preservar a unicidade e os escritores de contas internas é essencial para não quebrar o bootstrap ou permitir colisões de identidade.
- Primeiro cadastro por CPF é autodeclarado. Contestação de um CPF previamente cadastrado por terceiro exige atendimento; não tentar resolver por nova submissão anônima.
- E-mail compartilhado exige desambiguação por CPF. Não autenticar o primeiro resultado arbitrário de uma consulta.
- Contatos de acompanhamento e de recuperação têm responsabilidades diferentes; confirmação de contato não deve alterar consentimento operacional.
- Entregas reais dependem de templates de autenticação e configuração dos provedores. A configuração da fase 4, por si, não garante templates para senha/código.
- Sem fila durável e confirmação de entrega; uma resposta perdida não pode ser resolvida recuperando senha em texto puro.
- Senhas iniciais e códigos precisam ficar fora dos objetos genéricos da aplicação, especialmente de `normalizeRequest` e da normalização de credenciamento.
- As consultas por chave ainda existirão durante a sequência do roadmap, mas não podem continuar recebendo segredos existentes por novas submissões. A remoção completa fica na fase 7.
- Não incorporar no trabalho alterações preexistentes de skills, `AGENT.md`, outros planos ou especificações não relacionadas.

Referências técnicas consultadas:

- [OWASP — Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): códigos seguros, expiração, consumo único e prevenção de enumeração.
- [OWASP — Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html): limites, reautenticação e alterações de contato. O fluxo proposto de senha atual + confirmação nova + aviso ao contato anterior não deve ser anunciado como cumprimento integral do fluxo mais estrito de dupla confirmação.
- [NIST — Password guidance](https://pages.nist.gov/800-63-4/sp800-63b.html#passwordver): referência para comprimento e uso de senhas sem regras artificiais de composição; não declarar conformidade integral com NIST.
- [OWASP — Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#bcrypt): cuidados com bcrypt existente e limite de bytes.

## Perguntas em aberto

Nenhuma decisão de produto impeditiva ficou pendente após a aprovação da proposta revisada. As escolhas são:

- Conta por município, conforme resposta explícita do usuário.
- Sem migração/recuperação de contas antigas, conforme esclarecimento explícito do usuário.
- E-mail compartilhado permitido como contato; CPF resolve ambiguidade de login, conforme proposta revisada aprovada.
- Perfil confirmado atualiza avisos das solicitações próprias em andamento com opt-in, preservando recusas.
- Recuperação sem contato depende de atendimento autorizado.

Pendências operacionais, não autorizações implícitas:

- Ambiente e momento de aplicação da migration precisam de confirmação específica antes de executar qualquer mudança de banco.
- Identificação/configuração dos templates de autenticação e eventual validação real de entrega dependem de setup dos provedores e autorização para envio real.

## Critérios de aceite

- A primeira solicitação elegível cria conta municipal e solicitação atomicamente, com senha somente em hash no banco e plaintext apresentado uma única vez.
- Solicitações sem CPF não criam tutor fictício. Conta com CPF pode funcionar sem contato, com consequência de recuperação presencial explicada.
- CPF repetido/concorrente ou e-mail de outra conta não redefinem credenciais nem transferem propriedade.
- Tutor entra por município + CPF/e-mail, com tratamento seguro de e-mail compartilhado e sem colisão de privilégio com a equipe.
- Primeira troca obrigatória é aplicada no backend; sessões antigas deixam de funcionar após recuperação/mudança/desativação.
- Recuperação e confirmação de contato usam códigos protegidos, finitos, expirantes, limitados e consumidos atomicamente.
- Contato novo só entra após confirmação; destino errado/fallback não confirma posse de outro canal.
- Recuperação assistida exige autorização municipal, identificação e auditoria obrigatória, com rollback se a auditoria falhar.
- Tutor acessa somente suas solicitações/perfil e não alcança dados administrativos, credenciais de terceiros ou escrita de permissões.
- Chaves existentes e senhas temporárias não são divulgadas por nova submissão ou listagens.
- Há área inicial de tutor, sem antecipar lista de animais, consulta por token ou integração SMS.
- Testes, typecheck, build, sintaxe e revisões adicionais passam sem erros novos; limitações de setup/validação real são informadas.
- Nenhuma migration, seed ou limpeza foi executada sem confirmação específica; `.env`, secrets e alterações não relacionadas ficam preservados.

## Instruções para /implementar

- Usar este plano aprovado como contexto principal e a especificação mestre como roadmap. As decisões do usuário sobre conta municipal e inexistência de contas antigas substituem as hipóteses levantadas na análise inicial.
- A aprovação atual autoriza somente salvar o plano. Aguardar invocação separada de `/implementar .portal/plans/acesso-tutor-fase-5.md`.
- Não reintroduzir migração de contas antigas, reivindicação de histórico, e-mail fictício ou conta global para resolver a modelagem.
- Não executar migration, seed, script de escrita no banco ou boot que execute migrations sem a confirmação específica necessária.
- Aplicar módulos pequenos com nomes em inglês, contratos compartilhados, testes isolados e fiação mínima em `App.tsx`/rotas existentes.
- Preservar os padrões e dependências reais do projeto; não instalar frameworks ausentes ou converter o backend para outro ORM como efeito colateral.
- Não deixar dois mecanismos concorrentes de cadastro/recuperação nem manter caminhos inseguros escondidos por UI ou flags.
- Não confundir mensagens de segurança, contato confirmado, consentimento operacional e identidade civil.
- Não incluir senha/código em objetos persistidos, logs, histórico, analytics, PDFs ou estado global de solicitações/credenciamento.
- Não fazer commit, push, PR ou deploy nesta etapa. `/finalizar` cuida de commit/push em `main`, depois das validações e das condições operacionais de banco.
- Após implementação/finalização, atualizar a especificação com o link deste plano, decisões e pendências reais. Marcar fase 5 concluída somente quando os critérios forem cumpridos e registrar data/hash do commit, sem prometer entregas reais não validadas.
