# Solicitação simplificada para animal já cadastrado + acesso do tutor

Roadmap e especificação mestre. É a memória entre conversas: decisões fechadas, estado do código e status de cada fase. Última revisão: 2026-11-13.

## Como retomar (uma conversa por fase)

Cada fase roda inteira em uma única conversa (planejar, implementar e finalizar). A fase seguinte começa em conversa nova.

1. `/clear`, e escolher manualmente modelo e esforço com `/model` e `/effort` (ver a nota de modelo abaixo da tabela).
2. Ler **este arquivo** (não precisa reler o histórico): pegar a primeira fase com status `[ ]`.
3. `/planejar .portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md` informando "fase N". O plano é salvo em `.portal/plans/{nome}.md`; preencher o link na tabela.
4. Na mesma conversa, em mensagem separada: `/implementar .portal/plans/{nome}.md`.
5. Na mesma conversa: `/finalizar`; depois marcar a fase como `[x]` aqui, com data e hash do commit.
6. `/clear` para a fase seguinte.

Se uma decisão mudar, atualizar este arquivo antes de planejar a fase seguinte.

## Objetivo

Hoje o formulário de solicitação é único: quem já tem animal atendido refaz todos os campos. O público que cadastra é leigo.

- Quem já tem registro informa só **o que fazer e quando**; animal e tutor vêm preenchidos.
- A chave de validação permanente (uma por CPF) deixa de existir e dá lugar a login com senha.
- Tipos de identificação (com tutor, sem tutor, outros) e raças passam a ser configuráveis pelo usuário.

## Fluxo final do usuário

1. **Tela de entrada:** "Primeira solicitação" ou "Animal já cadastrado", com texto curto e informativo em cada opção (público leigo, sem poluir a tela).
2. **Já cadastrado:** login com CPF (ou e-mail) + senha → lista dos animais do tutor em cards, com busca por nome ou microchip → ao selecionar, animal e tutor vêm preenchidos (somente leitura) e a etapa Tutor é pulada → só "o que fazer + quando + documentos". Documentos já enviados são reaproveitados; só pede o que falta ou venceu.
3. **Primeira solicitação:** formulário completo, sem login. Tipo de identificação no topo define as etapas. Ao concluir, o acesso do tutor é criado.
4. **Última pergunta antes de concluir:** "Quer acompanhar sua solicitação?"
   - Sim: campo **E-mail** (obrigatório) e **Telefone** (só aparece se WhatsApp ou SMS estiverem ativos no município). Não há escolha de canal pelo usuário.
   - Não: conclui com aviso do que isso significa (sem contato não há como avisar mudança de data; recuperação de senha só presencial).
5. **Conclusão:** protocolo + confirmação. Não mostra mais chave de validação.

## Decisões fechadas

### Tipo de identificação (novo, configurável)
- Cadastro no painel, igual ao tipo de solicitação: o usuário cria os tipos e marca quais etapas existem (Tutor, Agenda, Documentos).
- De fábrica: **"Animal com Tutor"** e **"Animal sem Tutor"**. O usuário pode editar e criar outros (ex.: animal comunitário, de abrigo).
- Substitui as opções do topo de "Tipo e identificação" (hoje Castração / Microchipagem / Ambos).
- **Regra de combinação:** uma etapa aparece se **ambos** (tipo de identificação e tipo de solicitação) permitirem. Todos nascem com tudo ligado, então o cliente pode configurar só um dos lados. Sem bloqueio nem validação de conflito.
- `stepTutor` do tipo de solicitação **permanece** (não sai). Uma função única calcula as etapas visíveis.
- Textos de ajuda nos dois cadastros: "Esta etapa só aparece se o outro cadastro também permitir". Resumo "Etapas desta solicitação: ..." para o administrador.
- Campo de tipo de identificação no animal e na solicitação. Migração: registros existentes recebem "Animal com Tutor". Animal já cadastrado traz o tipo do registro.
- **Decididas e implementadas na fase 2 (2026-11-12, commit 5ee05b5):**
  - Chave de config `castragestao:identification-types`, por município. De fábrica: "Animal com Tutor" (ativo) e "Animal sem Tutor" (**inativo**: Tutor desligado, Agenda e Documentos ligados).
  - O controle da etapa Documentos mora no tipo de identificação (3 toggles). O tipo de solicitação continua com 2 toggles e `stepDocuments: true` forçado ao salvar. "Dispensar a declaração para animal sem tutor" virou configuração do município (de fábrica, Documentos ligado).
  - Castração / Microchipagem / Ambos deixaram de ser campo do formulário (`procedureType` removido) e viram tipos de solicitação que a prefeitura cadastra; nenhum é criado automaticamente. O PDF do prontuário mantém o fallback para registros antigos.
  - Seletor só no fluxo público e só com 2 ou mais tipos ativos (1 ativo é aplicado implicitamente; padrão = primeiro ativo). Grava `workflowData.identificationTypeId` e `animals[].identificationTypeId`. O fluxo interno (balcão) não mostra nem grava (equivale a "Animal com Tutor").
  - Sem backfill nem migration: registro sem o campo equivale a "Animal com Tutor" (leitura com default; nada lê o campo ainda). `runMigrations()` roda a cada boot, então editar `migrations.js` executa em produção no deploy.
  - Chave de config sem linha: `GET /api/config/castragestao:identification-types` devolve os tipos de fábrica, porque o loader do frontend só marca a chave como carregada quando o GET não é `null` (sem isso a primeira criação no painel não seria gravada).
  - **Pré-requisito resolvido na fase 4:** o backend aceita solicitação sem CPF quando a configuração municipal dispensa Tutor. "Animal sem Tutor" continua inativo de fábrica; a prefeitura pode ativá-lo manualmente.

### Raças (novo, configurável)
- Cadastro de raças no painel; cada raça é vinculada a um ou mais tipos de solicitação.
- No formulário, "Raça = Definida" mostra um **select** com as raças vinculadas ao tipo escolhido; "Indefinida" não mostra.
- **Decididas e implementadas na fase 3 (2026-11-12, commits 3ec8b45 e b9c9834):**
  - Chave de config `castragestao:breeds`, por município. Cada raça tem `name`, `speciesId` (uma espécie por raça) e `active`. Sem exclusão, só ativar/desativar. Sem catálogo de fábrica e sem busca na lista (melhoria futura se crescer).
  - **O vínculo raça↔tipo de solicitação é feito no tipo de solicitação** (`breedIds[]` dentro do tipo), no modal "Tipo de Solicitação", por um multisseletor das raças cadastradas (pills agrupadas por espécie, mesmo padrão de "Documentos vinculados"). Foi decisão do usuário após a primeira versão, que ligava pelo modal da raça. Tipo novo começa sem raças vinculadas (formulário com texto livre até vincular).
  - Raça é cadastrada uma por vez (campo de nome único); o cadastro em lote por texto foi descartado por pedido do usuário. Raças gravadas antes do ajuste podem ter um `requestTypeIds` sem uso (ignorado).
  - No formulário (público e balcão), "Definida" mostra um select com as raças ativas ligadas ao tipo de solicitação **e** à espécie do animal, em ordem alfabética. Sem raça para o par (tipo, espécie), o campo de texto livre de antes continua (estado válido de município sem raças configuradas, inclusive logo após o deploy).
  - O nome da raça vai em `breedDescription` (sem `breedId`); a escolha continua opcional e `breedType` segue obrigatório. PDFs e telas não mudaram.
  - Trocar de fato a espécie do animal ou o tipo de solicitação limpa a raça informada.
  - O select de raças no formulário usa o visual `access-field` dos campos vizinhos (público e balcão); o CSS dele é um bloco próprio, só para `select`, no fim de `styles.css`.
  - `GET /api/config/castragestao:breeds` devolve `[]` quando o município não tem linha (mesmo mecanismo da fase 2, `DEFAULT_CONFIG_VALUE_BUILDERS`).

### Acesso do tutor
- Conta criada ao concluir a primeira solicitação (CPF + senha gerada). A senha é enviada ao contato informado e mostrada uma única vez na conclusão, com aviso para anotar. Troca obrigatória no primeiro acesso.
- Login: CPF (ou e-mail) + senha. Funciona mesmo que o contato tenha mudado.
- "Esqueci minha senha": reaproveitar `/forgot-password` e `/reset-password`, enviando o código pelos canais ativos do município.
- Recuperação quando o tutor perdeu todos os contatos: **atendente** confirma identidade e atualiza o contato, com registro em `audit_logs`.
- Tela de perfil: trocar telefone e e-mail, com código de confirmação enviado ao contato **novo**.
- Senha com hash; limite de tentativas de login e de reenvio de código; código de uso único e com validade curta.
- Reaproveitar contas `users` com role `tutor` (já existem). Verificar no plano se o login aceita CPF.

### Canais de notificação
- Quem decide o meio é a **prefeitura**, na configuração do município: **e-mail sempre ativo** (padrão); **WhatsApp** e **SMS** ativáveis. O usuário só informa os contatos.
- Estrutura de envio por canal (interface única), para o SMS entrar depois só com o provedor. **SMS:** integração do provedor é feita pelo usuário numa fase futura; até lá fica oculto.
- Fallback para e-mail se o WhatsApp falhar ou ficar sem cota.
- Notificações: confirmação do agendamento, mudança de data, status dos documentos, conclusão (tudo junto, sem escolha por tipo).

### Decididas e implementadas na fase 4 (2026-11-13, commit bc596dc)

- Acompanhamento é a última etapa de todo formulário público de procedimento, mesmo sem Tutor, Agenda ou Documentos. A escolha Sim/Não é explícita; o balcão preserva seu fluxo.
- Sim exige e-mail; telefone é opcional e aparece somente quando `whatsapp.active === true` no município. Não há escolha de canal pelo cidadão. Escolher “Não” limpa os destinatários de acompanhamento e impede envios, mesmo que existam contatos no cadastro do tutor.
- A preferência fica em `workflow_data.followUp: { enabled, email, phone }`, separada dos contatos cadastrais. O PATCH operacional não altera consentimento, destinatários ou metadados protegidos.
- Configuração `castragestao:notifications`, por município, com e-mail sempre habilitado, SMS indisponível, `emailTemplateId` próprio e `whatsappTemplates` para `schedule_changed`, `documents_reviewed` e `completed`. A confirmação usa o template de agenda existente. O painel de canais reutiliza a aba de WhatsApp; não há segundo toggle de ativação.
- WhatsApp é prioritário; indisponibilidade, falha, ausência de telefone/template/credenciais ou falta de cota levam ao e-mail. Sucesso do primeiro canal encerra o envio. Solicitações antigas sem preferência mantêm somente WhatsApp de confirmação/reagendamento, sem consentimento presumido para novos eventos/e-mail.
- Notificações de agenda consideram mudanças reais de data, horário ou local. Decisões de documentos são agrupadas e o texto usa somente contagens de aprovados/correção, sem nomes de arquivos ou justificativas sensíveis. Conclusão significa atendimento realizado, não abertura da solicitação.
- Alterações operacionais usam bloqueio transacional da solicitação antes de comparar estados, evitando disparo duplicado em PATCHs idênticos concorrentes. A transação termina antes de acessar provedores; falha de envio/histórico não anuncia falha da operação já salva.
- Cota de WhatsApp: consumo, salvamento da configuração e reset usam transações com lock da mesma linha. E-mail tem timeout e admissão por processo com, no máximo, um próximo envio aguardando até um segundo. Não há fila durável, reenvio automático ou confirmação de entrega; resultados significam aceite pelo provedor.
- CPF só é dispensado por tipos ativos e confiáveis do município, nunca por flags do navegador. Tipo desconhecido/inativo/de outro município não concede dispensa. Tutor autenticado, balcão e denúncia mantêm exigência de CPF válido. Não são criados CPF, conta ou vínculo fictícios para animal sem tutor.
- Escrita de tipos de solicitação/identificação, notificações, WhatsApp e cota fica restrita a administradores municipais/globais. PATCH de solicitações fica restrito à equipe interna/global; demais usuários têm visualização sem ações operacionais.
- Contratos compartilhados em `shared/notification-contract.js`; domínio/envio em `backend/src/services/notifications/`; UI em `src/features/request-follow-up/` e `src/features/notifications/`. Sem migrations, dependências novas ou alteração de `.env`.
- **Pendência operacional:** configurar os templates corretos no painel/provedores e validar uma entrega real autorizada. O template de recuperação de senha permanece separado. Testes usaram provedores e banco simulados; não houve inspeção visual em navegador.
- Chave e consultas antigas permanecem até a fase 7. A etapa não cria conta/senha (fase 5), não lista animais (fase 6) e não implementa consulta por contato/token (fase 7).

### Fase 5 implementada e enviada ao repositório (commit 3068ac8)

- Plano aprovado: [acesso-tutor-fase-5](../plans/acesso-tutor-fase-5.md). Conta de tutor por município; não há migração ou associação automática de histórico antigo por CPF.
- Implementados login, troca obrigatória da senha inicial, perfil, confirmação de contatos, recuperação remota e recuperação assistida com auditoria. Credenciais iniciais aparecem apenas na resposta que cria a conta.
- Revisões de código/segurança e checks concluídos: 118 testes de frontend e 139 de backend, typecheck e build. Sem alteração de `.env`, dependências ou migrations antigas.
- O usuário confirmou trabalho somente local, com envio ao repositório Git. Commit e push em `main` concluídos; nenhum deploy realizado por esta finalização.
- **Ambiente local preparado:** após autorização explícita do usuário, `backend/src/db/sql/20261113-tutor-access.sql` foi aplicada e verificada em `localhost:5433/castracao_db`. Tabelas, colunas, constraints e índices conferidos; API reiniciada na porta 3002 com o boot existente autorizado. Frontend 5175 e health retornaram HTTP 200; `/api/auth/me` sem sessão retornou HTTP 401 pela rota nova; leitura municipal pelo proxy retornou HTTP 200. Uma futura implantação depende de aplicar o schema no ambiente de destino.
- Templates de autenticação e entrega real permanecem como configuração/validação operacional autorizada. O escopo dessa etapa não incluiu as fases 6 e 7; a implementação da fase 6 está registrada abaixo.

### Fase 6 implementada e enviada ao repositório (commit 9d44bdd)

- Plano aprovado: [animal-cadastrado-fase-6](../plans/animal-cadastrado-fase-6.md). Entrada com “Primeira solicitação” e “Animal já cadastrado”; intenção preservada após login/troca inicial, área do tutor com lista/busca própria e pedido com animal/tutor somente leitura.
- Decisão do usuário: cada animal recebe UUID ao enviar a primeira solicitação, inclusive sem microchip. Todos os animais são vinculados na transação; o primário permanece por compatibilidade. Chip declarado não ocupa o valor confirmado global nem concede propriedade. Raça, pelagem, nascimento e identificação são persistidos.
- Registros próprios anteriores sem UUID podem ser materializados por POST explícito e idempotente. GET não escreve, CPF não reivindica histórico e vínculo transferido não cria clone para ex-tutor.
- Decisão do usuário: prazo documental em dias desde o recebimento original; sem prazo significa sem vencimento por idade. Abrangência configurável (`tutor`, `animal`, `request`), padrão conservador `request`. A prefeitura precisa classificar documentos que poderão ser reaproveitados. Reuso por referência, origem/hash/receipts HMAC conferidos no servidor; copiar não renova prazo nem herda aprovação sem prova. Novo pedido exige seu próprio aceite.
- Disponibilidade de agenda agregada, sem pedidos alheios, e reserva sob lock municipal compartilhado pelos escritores. Cancelamento libera capacidade; legado ambíguo é contado conservadoramente. Balcão preserva cadastro sem agenda; reagendamento escolhe ocorrência/horário. Transferência, óbito, conferência explícita de chip e prontuário são transacionais.
- Revisões finais corrigiram alias de tipo que dispensava indevidamente documentos obrigatórios e substituição de foto reaproveitada. Validação final: 135 testes de frontend + 184 de backend (319), typecheck, build, sintaxe JS e diff. Build com aviso de chunks acima de 500 KB; sem script de lint. Limites temporários de workers/memória usados nos checks, sem alterar configuração do projeto.
- Commit e push em `main` concluídos no contexto local + repositório confirmado pelo usuário. Nenhuma nova migration, boot, mensagem real, alteração de `.env` ou deploy foi executado nesta etapa; sem inspeção visual em navegador.
- **Ambiente local preparado após autorização específica:** `backend/src/db/sql/20261113-registered-animals.sql` aplicada e verificada em `localhost:5433/castracao_db`. Microchip nullable, unicidade preservada e três índices conferidos. API iniciada na porta 3002 com o boot existente autorizado; frontend 5175 e health retornaram HTTP 200, rota privada de animais retornou HTTP 401 sem sessão e disponibilidade da fase 6 retornou HTTP 200 pelo proxy com leitura real do banco. Guia: `docs/registered-animals.md`. Outro ambiente continua dependendo de aplicação autorizada do schema.
- A fase 7 permanece pendente; as consultas/chaves legadas foram preservadas.

### Acompanhamento sem CPF
- Animal sem tutor e quem escolheu acompanhar sem conta: consulta por **protocolo + contato informado**, com código enviado a esse contato.
- Token próprio por solicitação nos links de acompanhamento. A chave nunca vai na URL.

### Privacidade (vale para todas as fases)
- Nunca listar ou expor animais só com CPF ou microchip sem autenticação. Busca por nome ou microchip só depois do login e só dentro dos animais do tutor.
- Mascarar contatos na tela (ex.: `r*****@gmail.com`, `(48) *****-1234`).
- Não mostrar contato completo para quem só sabe o CPF.

## Pendências para decidir no /planejar

- ~~Documentos de tutor para animal sem tutor~~ e ~~Castração / Microchipagem / Ambos~~: resolvidas na fase 2 (ver "Decididas e implementadas na fase 2").
- Raça por espécie (ver acima).
- Há chaves de validação e links em circulação? Define o tamanho do período de transição da fase 7 (o projeto era "ainda não foi para produção" em outro spec; confirmar).
- Migrations: não executar sem confirmação; sem `DATABASE_URL` local, entregar o SQL ao usuário.

## Estado do código investigado (2026-11-13, conferir antes de planejar)

**Frontend (`src/App.tsx`, arquivo monolítico):**
- Etapas: `getVisibleSteps` em `src/features/request-steps/` combina os tipos de solicitação e identificação. `RequestStep.FOLLOW_UP` é a última etapa pública; o resumo administrativo omite essa etapa fixa. `skipTutorStep` exige perfil completo e CPF válido do tutor autenticado.
- Cadastro de tipo de solicitação: `emptyRequestType` (com `stepTutor`/`stepAgenda`/`stepDocuments`), checkbox de etapa no painel e `createRequestType`.
- `createRequestType` já persiste as flags de etapa (corrigido no commit 8185937, junto com o plano `reorganizar-etapas-tipo-solicitacao.md`). A fase 1 criou `src/features/request-steps/` (`getVisibleSteps`, enum `RequestStep`); a fase 2 acrescentou o tipo de identificação em `configs` (`src/features/identification-types/`, `summarizeVisibleSteps` em `request-steps.ts`). O controle da etapa Documentos ficou no tipo de identificação.
- Raça: o estado do animal tem `breedType` e `breedDescription` (nome da raça). A configuração `castragestao:breeds` passou a existir na fase 3 (`src/features/breeds/`).

**Backend (`backend/src`):**
- `routes/animals.js`: `POST /lookup` (microchip), `POST /consult` (microchip + CPF + chave opcional, `ensureAuthorized`, devolve animal, tutor e histórico), `fetchActiveTutor`, `/:id/death`, `/:id/transfer`.
- `routes/requests.js`: `validationKeyForCpf` (uma chave por CPF na tabela `request_validation_keys`, em texto puro), `GET /public/:validationKey` e consulta por CPF + chave.
- `routes/auth.js`: `/login`, `/register`, `PUT /users`, `/forgot-password`, `/reset-password`.
- `services/`: adapters em `email.js`/`whatsapp.js`, cota em `whatsappQuota.js`, domínio/despacho em `notifications/` e orquestração em `request-change-notifications.js`. `request-submission.js` valida CPF/consentimento contra configuração municipal. Nenhuma integração de SMS.

## Fases

Ordem pensada por dependência e risco. Cada fase é entregável sozinha.

| # | Fase | Revisão extra | Plano | Status |
|---|---|---|---|---|
| 1 | Função única de etapas visíveis (`createRequestType` e o plano `reorganizar-etapas-tipo-solicitacao.md` já estavam corrigidos/implementados no commit 8185937) | — | [funcao-unica-etapas-visiveis](../plans/funcao-unica-etapas-visiveis.md) | [x] 2026-11-12, commit e84c4d4 |
| 2 | Tipos de identificação configuráveis + combinação com tipo de solicitação + migração | — | [tipos-identificacao-configuraveis](../plans/tipos-identificacao-configuraveis.md) | [x] 2026-11-12, commit 5ee05b5 |
| 3 | Raças configuráveis, vinculadas ao tipo de solicitação | — | [racas-configuraveis](../plans/racas-configuraveis.md) | [x] 2026-11-12, commits 3ec8b45 e b9c9834 (ajuste do vínculo) |
| 4 | Etapa "Quer acompanhar?" + configuração de canais do município + notificações + solicitação sem CPF quando a configuração dispensa Tutor | — | [acompanhamento-canais-notificacoes-fase-4](../plans/acompanhamento-canais-notificacoes-fase-4.md) | [x] 2026-11-13, commit bc596dc |
| 5 | Acesso do tutor: senha, login, "esqueci minha senha", perfil, recuperação por atendente | Revisões de código/segurança concluídas, incluindo autorização de config e isolamento municipal | [acesso-tutor-fase-5](../plans/acesso-tutor-fase-5.md) | [x] 2026-11-13, commit 3068ac8 e push concluídos; migration local aplicada e API reiniciada com autorização |
| 6 | Tela de entrada + "Animal já cadastrado": lista, busca, pré-preenchimento, reuso documental e cadastro por UUID sem chip obrigatório | Revisão de código/segurança concluída, incluindo propriedade, documentos e concorrência de agenda | [animal-cadastrado-fase-6](../plans/animal-cadastrado-fase-6.md) | [x] 2026-11-13, commit 9d44bdd e push concluídos; migration local aplicada e API iniciada com autorização |
| 7 | Remover chave de validação antiga + acompanhamento por protocolo e token | — | | [ ] |

Dependências: 2 antes de 6 (tipo de identificação no animal); 4 antes de 5 (a senha é enviada pelo contato); 5 antes de 6 (login); 7 por último (período de transição).

Modelo e esforço: escolhidos manualmente pelo usuário com `/model` e `/effort`; as skills não definem nenhum dos dois. Sugestão: `/planejar` e `/implementar` em Opus, esforço alto; `/finalizar` em Sonnet, esforço baixo; `/rodar` em Haiku, esforço baixo. Trocar de modelo no meio da conversa perde o cache. A coluna "Revisão extra" lista o que roda depois do `/implementar` nas fases de risco (5 e 6: autenticação e dados pessoais).
