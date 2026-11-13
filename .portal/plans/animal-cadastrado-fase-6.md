# Plano: Animal já cadastrado — fase 6

## Origem

- Especificação: `.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md`, fase 6.
- Classificação: `fullstack + database`.
- Data: 2026-11-13.
- Base investigada: `3068ac8`, fase 5 concluída e enviada para `main`.
- Aprovação: o usuário respondeu **“sim”** à pergunta para salvar esta proposta neste caminho.
- Destino aprovado: `.portal/plans/animal-cadastrado-fase-6.md`, conforme a organização do roadmap. Esta autorização específica prevalece sobre a pasta `.plans/` indicada pela skill global.
- Decisões explícitas: animal aparece após o envio da primeira solicitação, inclusive sem microchip; validade para reaproveitamento em dias por tipo de documento, contados do envio; ausência de prazo significa sem vencimento por idade do arquivo.
- Contexto operacional confirmado: trabalho local e envio ao repositório Git. Isso não autoriza migrations, seeds, alterações de ambiente ou implantação durante a implementação.

## Resumo

Acrescentar as opções “Primeira solicitação” e “Animal já cadastrado” na entrada do procedimento. O primeiro caminho preserva o formulário público completo. O segundo exige conta de tutor no município, permite procurar seus animais e iniciar um pedido com animal e tutor preenchidos para leitura.

No novo pedido, o cidadão informa o procedimento, a agenda quando habilitada, os documentos faltantes ou vencidos e a preferência de acompanhamento. A identidade do animal, a propriedade, os dados preenchidos e os documentos reaproveitados são resolvidos e conferidos novamente pelo servidor.

O cadastro passa a ter um UUID por animal desde a primeira submissão bem-sucedida, independentemente de microchip ou atendimento. O microchip informado pelo cidadão não é prova de propriedade nem confirmação de identificação. Documentos enviados anteriormente podem evitar outro upload, sem transformar uma aprovação declarada pelo navegador em revisão confiável.

## Decisões e limites do desenho

- Conta e sessão continuam municipais, conforme a fase 5. CPF, contato compartilhado e microchip não concedem propriedade nem acesso a registros.
- O fluxo “Animal já cadastrado” seleciona **um animal por solicitação** nesta fase. O primeiro cadastro e o balcão mantêm seu suporte a vários animais.
- Todo animal de uma nova solicitação de procedimento recebe UUID na mesma transação. Denúncia, óbito e transferência não passam a cadastrar novos animais por este mecanismo.
- A ausência de tutor não cria conta, CPF ou vínculo fictício. Um cadastro sem proprietário autenticado não aparece automaticamente na conta de alguém que informe o mesmo CPF depois.
- A área do tutor permanece separada do painel administrativo. Nenhum carregamento ou autosave administrativo é montado para fornecer o novo formulário.
- O tipo de identificação do animal e sua raça são preservados ao escolher outro procedimento. Não substituir silenciosamente uma identificação desativada pelo primeiro tipo ativo.
- Documentos terão abrangência configurável: tutor, animal ou solicitação. O padrão para configuração sem esse campo é **solicitação**, sem reaproveitamento automático entre pedidos, até classificação consciente pela prefeitura.
- Prazo em dias é uma regra para reaproveitamento desde o recebimento do arquivo. Não comprova data de emissão, validade legal ou aprovação do conteúdo. Os critérios documentais atuais continuam aplicáveis.
- O padrão sem prazo é `null`, não zero ou texto vazio convertido em um prazo. Quando definido, o prazo deve ser um inteiro positivo, validado no servidor e na configuração.
- Recusados, revogados, substituídos, vencidos ou incompatíveis com o requisito atual não podem ser selecionados automaticamente como documentos válidos.
- Arquivo anexado pendente pode ser reaproveitado como pendente, evitando novo upload sem dispensar conferência. Aprovação só é transportada quando houver revisão confiável vinculada ao conteúdo e aos critérios atuais.

## Escopo

### Dentro do escopo

- Entrada com duas opções, texto simples e preservação do município e eventual data de mutirão.
- Continuidade da intenção depois de login e troca obrigatória da senha inicial.
- Aba “Meus animais”, com cards, busca autenticada por nome/microchip, carregamento, erro, vazio e nova solicitação.
- Formulário existente adaptado para animal selecionado, resumo de tutor/animal somente leitura e etapas reduzidas.
- Cadastro canônico de cada animal da primeira solicitação, com vínculo e registro municipais.
- Tratamento seguro dos registros próprios anteriores que ainda não tenham UUID de animal.
- Persistência de raça, pelagem, nascimento, demais características necessárias e tipo de identificação.
- Configuração municipal de abrangência e prazo dos documentos; identificação dos arquivos e origem do reaproveitamento.
- Catálogo de documentos por metadados e conteúdo autorizado sob demanda.
- Validação no servidor do contexto preenchido, documentos e disponibilidade da agenda.
- Ajustes pontuais em confirmação de microchip, transferência e óbito para manter propriedade, UUID e status coerentes.
- Testes de fronteira HTTP, transações, concorrência, contratos e comportamento do formulário.

### Fora do escopo

- Fase 7: remoção das consultas antigas, protocolo com código por contato, links/token e extinção final da chave antiga.
- Nova autenticação, contas globais de tutor ou associação automática de histórico por CPF.
- Busca pública de animais, busca nacional por microchip ou compartilhamento de documentos entre municípios/proprietários.
- Transferir animais ou alterar cadastro pelo novo formulário do tutor.
- Mesclar registros por nome, raça ou microchip alegado; importação em lote de histórico; apagar dados existentes.
- Novo serviço de upload/storage, migração geral de base64, fila de PDF, reorganização de PDFs ou alteração do plano de documentos PDF já existente.
- Reformulação do portal, painel, credenciamento, calendário ou provedor de IA além das integrações necessárias à fase.
- Instalar ORM, framework ou dependências; alterar lockfiles, `.env`, portas, serviços ou pipeline de deploy.
- Executar migrations, seeds, limpeza de dados, iniciar/reiniciar backend que execute migrations, commit, push ou deploy durante `/implementar`.

## Leitura de contexto

### Arquivos inspecionados

- `AGENT.md`; não foi encontrado `CLAUDE.md` na raiz ou instrução de domínio adicional durante a investigação.
- Especificação mestre e `.portal/plans/acesso-tutor-fase-5.md`.
- `src/App.tsx`: fronteira de sessão, entrada pública, consulta legada, `NewRequest`, documentos, análise interna e disponibilidade de agenda.
- `src/api.ts`, `src/domain.ts`, `src/types.ts`, `src/utils.ts`.
- `src/features/tutor-access/session-boundary.tsx`, `tutor-area.tsx`, `auth-entry.tsx`, `auth-types.ts`, `tutor-identity.ts`.
- `src/features/request-steps/request-steps.ts` e `src/features/identification-types/identification-types.ts`.
- `backend/src/routes/animals.js`, `requests.js`, `schedule.js`, `config.js`, `ai.js`.
- `backend/src/services/request-submission.js`, `request-animal-link.js`, `auth/tutor-enrollment.js`, `auth/profile-handlers.js`.
- `backend/src/repositories/request-settings.js`, `tutor-profiles.js`; `backend/src/tenant.js`.
- `backend/src/db/index.js`, `db/migrations.js`, `db/sql/20261113-tutor-access.sql`, `server.js` e manifests.
- `.portal/plans/reorganizar-documentos-pdf.md`, apenas para identificar a demanda alheia que deve continuar separada.

### Constatações verificadas

1. `App.tsx:313` já separa o tutor com `SessionBoundary`. `TutorArea` só tem solicitações, perfil e senha.
2. `LoginView` e o CTA do mutirão abrem o formulário diretamente. O prefill legado recebe animal/tutor, mas só tipo e agenda chegam efetivamente ao `NewRequest`.
3. `NewRequest` começa com animal e uploads vazios. `skipTutorStep` depende de nome/CPF do perfil; isso não garante endereço ou dados cadastrais completos.
4. Trocar o procedimento limpa a raça no formulário atual. Esse comportamento não deve apagar a raça do animal já cadastrado.
5. `animals.microchip` é `NOT NULL UNIQUE`. A tabela de animais é global; município é comprovado por `animal_records`. Propriedade autenticada é comprovada por `animal_tutors.user_id` ativo.
6. O POST de solicitações grava o array de animais em JSON e só relaciona `animal_id`/prontuário do primeiro. Não cria cadastros canônicos de todos os animais.
7. A materialização legada lê `breed`/`color`, mas o formulário envia `breedDescription`/`coat`. Tipo de identificação e características também precisam de mapeamento explícito.
8. O POST atual grava documentos fornecidos pelo cliente, inclusive `status`. Uma linha persistida com `approved` não prova revisão interna.
9. A saída de `/ai/validate` não é persistida nem vinculada a hash, proprietário e política do arquivo. Não é um atestado para herdar aprovação.
10. Não existem prazo de reaproveitamento, abrangência ou timestamp confiável por upload. Documentos e foto são compartilhados pelo pedido, inclusive com vários animais.
11. O GET da agenda não traz ocupação agregada; o frontend calcula vagas usando solicitações recebidas. A lista própria do tutor não representa a ocupação municipal. O POST não reserva vagas sob lock.
12. Transferência e óbito são efetivados depois do commit do status. A transferência insere destinatário sem `user_id`; precisa de ajuste pontual para o acesso autenticado por vínculo ativo.
13. Há armazenamento de anexos base64 em JSONB e limite HTTP de 16 MB. Não aumentar esse limite para acomodar reaproveitamento.

## Impacto por área

### Frontend

- Criar componentes e hooks pequenos para escolha inicial, intenção do procedimento, cards/busca de animais, contexto do pedido e seleção de documentos.
- Guardar a intenção mínima no nível de `App`, fora de `LoginView`, para sobreviver ao login/troca de senha. Não guardar credenciais ou documentos em storage. Limpar intenção e resultados em logout, troca de conta ou município.
- Fazer todos os CTAs de procedimento, inclusive mutirão, passarem pela escolha inicial. Preservar os demais serviços públicos e o acesso da equipe.
- Acrescentar “Meus animais” à área do tutor e priorizar essa aba quando a entrada foi “Animal já cadastrado”. Solicitações e perfil continuam disponíveis.
- Não carregar histórico completo/base64 para montar os cards. Montar o carregamento das solicitações quando necessário à aba correspondente.
- Entregar ao ramo tutor um callback de renderização que reutilize `NewRequest`; não importar `App` de dentro da feature nem montar `ApplicationWorkspace`.
- Carregar opções municipais por hook específico, com proteção contra respostas tardias de contexto anterior.
- No modo cadastrado, usar um animal, impedir adicionar/remover/trocar seus dados e mostrar resumo do tutor. Manter seleção de procedimento e etapas habilitadas pela combinação atual de configurações.
- Preservar a função única de etapas e o acompanhamento no final. Ocultar Tutor porque há contexto autorizado; isso não altera os requisitos de CPF do servidor.
- Manter raça/identificação mesmo quando não figurarem mais em opções ativas. Identificação inexistente ou desativada deve impedir o novo pedido com orientação de atendimento, sem alteração silenciosa do animal.
- Exibir falta de dados do contexto de forma explícita. Não inventar endereço, CPF, proprietário ou elegibilidade para dispensar uma etapa. Correções do cadastro selecionado ficam para o atendimento existente.
- Em documentos, mostrar “reaproveitado”, “pendente de conferência”, “vencido” e “precisa anexar” conforme resultado do servidor. Permitir substituir arquivo reaproveitado por upload novo.
- Configuração de documento recebe abrangência e prazo com ajuda clara: prazo desde envio não substitui os critérios de emissão/conteúdo.
- Continuar exigindo novo aceite/declaração quando a etapa existir; não copiar assinatura ou data de aceite anterior.
- Usar a disponibilidade agregada no picker, com atualização após conflito de vaga. Nenhuma lista de solicitações de terceiros entra na área do tutor.

### Backend

- Controllers finos; casos de uso e normalizações em services; queries parametrizadas em repositories usando o cliente da transação existente.
- Reaproveitar autenticação de sessão completa e município persistidos. Tokens restritos à troca de senha não podem listar animais ou documentos.
- Endpoints novos propostos, registrados sem interferir nas rotas legadas:
  - `GET /api/animals/mine?query=...&cursor=...`: lista/busca paginada de animais próprios e referências próprias anteriores ainda sem vínculo; query e tamanho de página limitados.
  - `POST /api/animals/from-request`: resolve uma referência de animal de solicitação própria anterior em um UUID, sob transação e de forma idempotente.
  - `GET /api/animals/:id/request-context?requestTypeId=...`: animal autorizado, resumo do tutor, opções/requisitos e metadados de documentos elegíveis para esse pedido.
  - Conteúdo de anexo sob demanda por referência de origem, sempre autenticado, com município e proprietário novamente verificados. Sem URL pública/capability por hash.
  - `GET /api/schedule/availability`: disponibilidade agregada por período municipal limitado, ocorrência e horário, sem identificadores de solicitações ou dados de terceiros.
- Reutilizar `POST /api/requests`. Sempre que um tutor enviar UUID de animal existente, reidratar os campos a partir do banco; não confiar em prefill, `skipTutor`, CPF ou dados readonly enviados pelo cliente.
- Revalidar no envio: conta, vínculo ativo, município ativo, animal vivo, identificação, procedimento, documentos e agenda. Não basta a validação do GET de contexto.
- Não retornar colunas inteiras de animais, tutores ou documentos: DTOs explícitos, sem histórico de terceiros, contatos de antigos proprietários, chaves, evidências internas ou secrets.
- Retornar `Cache-Control: no-store` para contexto e conteúdo privado; erros de vínculo não revelam o proprietário ou município de um UUID inacessível.

### Banco de dados

- Preparar migration SQL nova em `backend/src/db/sql/`, com nome em inglês e sem editar a migration legada ou a SQL da fase 5.
- Remover apenas o `NOT NULL` de `animals.microchip`, preservando sua unicidade para valores confirmados. Sem chip vazio, artificial ou UUID usado como chip.
- Acrescentar índices necessários às consultas de propriedade ativa, vínculo municipal e ocupação de agenda, após conferir os existentes. Preferir `(user_id, animal_id) WHERE active = TRUE` em `animal_tutors`, `(municipality_id, animal_id)` em `animal_records` e `(municipality_id, schedule_date)` em `requests` se ainda não houver índice equivalente.
- Usar as estruturas existentes de JSONB para características adicionais do animal e metadados dos documentos; não criar armazenamento paralelo de arquivos nesta fase.
- Não adicionar `municipality_id` ao animal global por suposição nem presumir RLS automático.
- Não incluir backfill em lote, merge por CPF/chip, remoção de dados, reset de senha ou seed nesta migration.
- A migration da fase 5 foi aplicada localmente com autorização anterior. Essa autorização não se estende à nova migration.

**Não executar a nova migration sem confirmação explícita do ambiente e do usuário. Não iniciar/reiniciar `server.js` para testar schema: o boot executa o runner legado.**

### Infra/Deploy

- Preservar dependências, configurações de ambiente, portas, limite HTTP e mecanismo de boot.
- Documentar a aplicação autorizada do schema antes de executar o código dependente no ambiente escolhido.
- A aprovação deste plano não autoriza deploy ou alterações de produção. O contexto atual é desenvolvimento local com versionamento Git.

## Arquivos provavelmente afetados

Arquivos existentes verificados:

- `src/App.tsx`: integração dos CTAs, ramo tutor, `NewRequest`, edição de documentos e ações internas que confirmem microchip/revisão.
- `src/api.ts`: contratos e chamadas das novas consultas/referências, preservando tratamento de sessão e envelope da fase 5.
- `src/domain.ts`: normalização documental e mapeamentos compatíveis.
- `src/features/tutor-access/tutor-area.tsx`, `auth-entry.tsx`, `auth-types.ts`: navegação, intenção e contratos de sessão/contexto sem ampliar a autoridade do cliente.
- `src/features/request-steps/request-steps.ts`: somente se necessário para representar o modo cadastrado preservando a regra única de etapas.
- `src/features/identification-types/identification-types.ts`: resolução estrita do tipo persistido, separada do default permitido para cadastro novo.
- `src/styles.css`: estilos locais coerentes com os componentes existentes.
- `backend/src/routes/animals.js`, `requests.js`, `schedule.js`, `config.js`: montagem de handlers e integração dos serviços.
- `backend/src/services/request-submission.js`, `request-animal-link.js`; `backend/src/repositories/request-settings.js`: contexto confiável e carregamento dos requisitos atuais.
- `backend/src/services/audit.js`: constantes e eventos novos apenas se necessários à vinculação/conferência.
- Testes existentes de submissão, vínculo de animal, acesso a animais, dados públicos e configuração em `backend/test/`; testes de etapas e tutor em `src/features/`.

Novos arquivos propostos, a criar durante a implementação:

- Feature `src/features/registered-animals/` com contratos, componentes, hooks e funções puras testáveis.
- Contratos compartilhados para abrangência/validade documental e animal cadastrado em `shared/`.
- Repositories de animais próprios, documentos de origem e disponibilidade; services de cadastro de animal, pedido cadastrado, reaproveitamento documental e reserva de agenda, em arquivos com responsabilidade única.
- Uma migration SQL e testes HTTP/de transação/contrato correspondentes.

Os nomes finais dos módulos devem seguir suas responsabilidades. Não usar esta lista para ampliar `App.tsx` ou criar um segundo formulário completo com regras duplicadas.

## Estratégia de implementação

### 1. Contratos e contexto

- Centralizar valores finitos novos: abrangência documental, estados de reaproveitamento e confirmação de microchip. Reutilizar status e roles existentes.
- Tipar DTO de card, referência anterior, contexto do pedido, documento candidato, referência de reuso e disponibilidade.
- Preparar schema e repositories antes de integrar a interface; sem executar SQL ou backend nesta etapa.
- O runtime real usa `pg` e `backend/src/db/index.js`, como já registrado na fase 5. As referências genéricas de `AGENT.md` a Drizzle/entrypoint TypeScript não existem nesta aplicação. Estender o entrypoint e as transações existentes com SQL parametrizado e escopo municipal explícito; não instalar ORM nem abrir pools paralelos.

### 2. Cadastro e vínculo canônicos

- Dentro da transação da solicitação de procedimento, primeiro validar identidade/configuração e concluir a criação/identificação do tutor conforme a fase 5.
- Gerar um UUID para cada animal novo; gravar `animals`, o vínculo de tutor quando existir identidade autorizada e o registro municipal na mesma transação do pedido.
- Preencher `requests.animals[].id` com os UUIDs resolvidos pelo servidor. Preservar `requests.animal_id` como referência primária de compatibilidade, sem ignorar os demais animais.
- Mapear `breedDescription -> breed`, `coat -> color`, `birthDate -> birth_date`; preservar `breedType`, idade aproximada e características sem coluna própria em metadata com normalização explícita.
- Persistir a identificação e seu contexto municipal. Default legado “Animal com Tutor” só vale para campo ausente; um ID explícito inválido não vira default silenciosamente.
- No cadastro público, chip informado vai para metadata como declarado; o campo único confirmado permanece nulo até conferência interna. Busca própria pode encontrar tanto confirmado quanto declarado, com rótulo que distingue a situação.
- Não fazer upsert que altere cadastro/proprietário de animal com chip existente. A conferência interna usa UUID, município e autorização; colisão é tratada sem reassociar, excluir ou mesclar identidades automaticamente.
- Adaptar a materialização interna por microchip para reconhecer um UUID já relacionado à solicitação, sem criar um segundo cadastro do mesmo item.
- Se a solicitação falhar, não sobram animal, proprietário, registro, conta recém-criada ou reserva de agenda.
- Cadastro autenticado de outro animal continua possível pelo formulário completo. CPF repetido anonimamente mantém a regra da fase 5: sem redefinir conta nem vincular animal à conta existente.

### 3. Compatibilidade com solicitações próprias anteriores

- Não depender de backfill em lote para a área funcionar com solicitações da fase 5 que ainda tenham apenas `animals[]` sem UUID.
- O GET de lista pode fornecer candidatos separados, extraídos somente de solicitações com `tutor_id` e município iguais aos da sessão. Cada candidato traz referência de solicitação, posição e fingerprint do item, não um UUID fictício.
- Ao selecionar “Usar este animal”, o cliente resolve essa referência pelo POST explícito. O servidor bloqueia a solicitação de origem, confere dono/município/fingerprint e verifica novamente se o item já tem vínculo. O fingerprint precisa excluir UUID/metadados acrescentados pela própria materialização, ou ser conservado como origem imutável, para que retry e duas seleções concorrentes resolvam o mesmo resultado.
- Antes de criar UUID, procurar vínculos canônicos já comprovados pela origem/item, incluindo `requests.animal_id` e `animal_records.request_id`, além de `animals[].id`. O materializador legado pode ter criado animal/registro sem atualizar o JSON da solicitação. Se houver vínculo anterior transferido, negar ao ex-tutor; se a correspondência entre item e registro for ambígua, exigir conferência em vez de criar um clone. Não resolver ambiguidade por CPF ou chip apenas declarado.
- Se já vinculado, devolver o mesmo UUID autorizado; se o UUID existente estiver inacessível, rejeitar sem criar outro animal para contornar a restrição. Se não houver vínculo, criar o cadastro a partir do item persistido, atualizar a posição exata de `animals[]`, o primário quando aplicável, vínculo e registro em uma única transação.
- Leituras não escrevem no banco. Não buscar, apropriar ou converter solicitações sem vínculo de usuário apenas porque o CPF coincide.
- Não deduplicar candidatos de pedidos diferentes por nome ou chip autodeclarado. Situações ambíguas continuam separadas até resolução autorizada; não concluir que são o mesmo animal.

### 4. Listagem e formulário de animal cadastrado

- Listar apenas animais com vínculo ativo da sessão e presença municipal comprovada. Não usar `current_tutor_id` como fonte paralela de autorização.
- Buscar depois de restringir por usuário/município; limitar query/página e evitar wildcard irrestrito sobre toda a base.
- Contexto do tutor: nome/CPF da identidade atual; contatos do perfil; endereço e dados complementares de fonte persistida autorizada do vínculo/solicitação própria. Não usar cadastro de outro usuário com mesmo CPF.
- Devolver lacunas cadastrais quando não houver informação suficiente. O modo readonly não deve contornar validações nem inventar dados para pular Tutor.
- O frontend envia UUID, procedimento, escolha de agenda, referências documentais, novos anexos, aceite e acompanhamento. Campos de animal/tutor enviados por compatibilidade são ignorados ou rejeitados se conflitantes; o servidor monta os snapshots persistidos.
- Revalidar propriedade/status sob lock no POST. Transferência ou óbito entre seleção e envio invalida o contexto e impede salvar o pedido.

### 5. Documentos e validade

- Ampliar o carregamento de configurações para incluir `castragestao:document-types`. Requisitos e política vêm do catálogo/tipo de solicitação do município, não da definição enviada pelo navegador.
- Acrescentar `reuseScope` com valores de código `tutor`, `animal`, `request` (rótulo “Solicitação”) e `reuseValidityDays` inteiro positivo seguro ou `null`. Validar escrita administrativa, intervalo representável das datas e normalizar leitura de configurações anteriores.
- Em configuração antiga sem abrangência, usar solicitação e não inferir categoria por palavras do nome. O administrador classifica os documentos para habilitar reaproveitamento.
- Arquivos novos recebem `attachmentId`, hash dos bytes, `receivedAt`, tipo documental, origem e vínculo de animal quando aplicável, calculados/controlados pelo servidor.
- Proteger a procedência com receipt HMAC de finalidade própria, reutilizando os primitives `authenticatedDigest`/`safeDigestEqual` de `backend/src/services/auth/auth-security.js` e o segredo já configurado, sem nova variável de ambiente. Vincular ID/hash do arquivo, tipo, usuário, município, abrangência, animal quando aplicável, origem e recebimento original. A revisão confiável também vincula decisão, ator, data e fingerprint dos critérios. Remover campos de autoridade fornecidos no input antes de emitir esses receipts; não retornar o segredo nem usar o receipt como autorização de acesso.
- A simples presença de timestamp, revisão, ID ou versão no JSON legado não comprova autoria do servidor. Receipt ausente/inválido exige fallback conservador para a origem/data comprovadas pelo banco e status pendente. Não renovar idade pela data de uma cópia recente cuja origem original não seja verificável; com prazo e origem ambígua, a validade permanece pendente. A assinatura do recebimento conserva seu valor histórico mesmo se a configuração mudar; compatibilidade atual e aprovação são avaliadas separadamente. Rotação do segredo pode exigir nova conferência, nunca gerar aprovação ou data recente automaticamente.
- Reenvio de referência conserva o recebimento original. Copiar, reaproveitar ou revisar o mesmo arquivo não reinicia sua validade. Persistir instantes UTC; vencer quando o relógio do servidor atingir `originalReceivedAt + reuseValidityDays * 24 horas`, usando a regra atual do tipo e sem deslocamento dependente do fuso do navegador.
- Sem prazo configurado, não vencer por idade; isso não dispensa abrangência, conteúdo, revisão, formato ou status válidos.
- Para arquivos anteriores sem timestamp próprio, usar como marco conservador a criação da solicitação de origem original, registrada pelo banco; nunca a data atual da seleção. Se origem/idade forem desconhecidas ou ambíguas para um tipo com prazo, informar validade pendente e exigir conferência/substituição, sem fabricar uma data.
- Identificar anexos anteriores por referência estável da origem e hash do conteúdo persistido, sem escrever durante catálogo/preview. IDs de tipo documental e nomes de arquivo não identificam sozinhos um anexo.
- Documentos do tutor só podem vir de pedidos do mesmo usuário municipal. Documentos de animal exigem também associação inequívoca ao UUID selecionado; arquivo/foto compartilhado de pedido com vários animais não recebe vínculo individual presumido.
- Não reaproveitar documentos exclusivamente processuais, declaração, aceite, assinatura, PDFs oficiais gerados, evidências internas ou arquivos de outro proprietário/município.
- Excluir candidatos rejeitados, substituídos ou incompatíveis. Anexo pendente pode satisfazer presença do arquivo e continuar aguardando conferência.
- Requisição de reuso contém referências, sem bytes/status apresentados como prova. O servidor carrega a origem, confere hash, proprietário, vínculo, política, prazo e estado novamente dentro da transação de envio.
- Não transportar `approved`, `reviewedBy`, datas, proveniência ou validade do body. Arquivo anterior sem revisão confiável entra como `attached`, mesmo que o JSON antigo diga aprovado.
- Para manter aprovação entre pedidos, registrar revisão interna controlada pelo servidor com ator, data, decisão, hash do conteúdo e fingerprint dos critérios. Mudança de bytes ou critérios invalida sua reutilização como aprovado. A interface de revisão interna deve enviar decisões explícitas por anexo, preservando o fluxo de conferência já existente.
- O resultado atual da IA é informativo para esta finalidade; não autoriza herdar aprovação sem prova vinculada ao arquivo. Não reescrever o provedor de IA nesta fase.
- Catálogo e cards retornam só metadados; preview autorizado carrega um conteúdo sob demanda. A implementação pode copiar bytes no servidor para manter a solicitação autocontida, registrando origem imutável; não criar cadeias que reiniciem prazo ou pulem autorização.
- Aplicar limites de formato, bytes por arquivo, quantidade e tamanho agregado do pedido final, incluindo reaproveitados. Não confiar em `fileSize`, MIME ou status declarados. Preservar o teto atual de `16mb` do parser (16 * 1024 * 1024 bytes): medir o JSON final serializado em UTF-8, incluindo expansão base64, reaproveitados, foto e demais campos, além dos limites por bytes decodificados. Rejeitar excesso com mensagem recuperável, mesmo quando o HTTP de entrada contiver somente referências pequenas.

### 6. Agenda sem dados de terceiros

- Produzir disponibilidade a partir das ocorrências/regras municipais reais, com as mesmas regras de data, horários e capacidade do calendário atual; cobrir regras recorrentes/mutirão com testes de paridade.
- DTO contém apenas ocorrência, data, horários, local público e vagas disponíveis. Não incluir protocolos, IDs de solicitações, nomes, CPF, documentos ou contatos.
- Contar animais, não apenas pedidos. Solicitações canceladas não ocupam vaga; pedidos existentes sem horário explícito precisam de alocação conservadora e determinística, compatível com o calendário.
- Resolver ocorrência e horário no servidor. Não confiar em local, capacidade, data/horário ou quantidade de animais do payload sem conferência.
- Persistir a chave estável da ocorrência e o horário resolvidos pelo servidor, por exemplo em `workflow_data`, e usar a mesma identidade para agregado, reserva e reagendamento. Data textual sozinha não distingue dois locais/ocorrências; registros antigos sem chave exigem atribuição conservadora e determinística ou conferência se ambíguos, sem inventar vagas livres.
- No POST de procedimento com Agenda habilitada, bloquear a ocorrência/chave municipal de agenda, reler configuração e ocupação e reservar pela gravação da solicitação na mesma transação. Lotação ou configuração alterada gera conflito recuperável, não ocupação excessiva.
- Compartilhar essa disciplina com os escritores que alteram ocupação: reagendamento, cancelamento, remoção e ajustes de ocorrência. Quando houver duas ocorrências envolvidas, obter locks em ordem estável para evitar deadlock.
- Não condicionar segurança a um lock exclusivo do novo fluxo enquanto outro POST/PATCH puder disputar a mesma vaga sem a mesma regra.
- Sem etapa Agenda, não reservar nem exigir data. Preservar a combinação de etapas e as permissões do balcão, sem conceder ao tutor uma dispensa por flag do cliente.
- Provedores e notificações continuam depois do commit, conforme a fase 4.

### 7. Manutenção do vínculo em ações internas

- Efetivar óbito e troca de tutor junto à transição autorizada do pedido, na transação, com locks e escopo municipal. Evitar anunciar conclusão enquanto o vínculo correspondente falhou depois do commit.
- Transferência para perfil municipal já existente pode ligar `user_id` somente como consequência da operação interna aprovada, conferindo role, conta ativa, município e identidade alvo. Uma alegação pública de CPF não basta.
- Atualizar/desativar somente os IDs de vínculos cuja origem municipal esteja comprovada; substituir a desativação global de todos os vínculos por `animal_id`. Usar a identidade municipal do usuário vinculado e as relações de origem pertinentes. Um vínculo legado com `user_id = NULL` e origem municipal ambígua não autoriza alterar relações de outra prefeitura nem presumir propriedade por CPF.
- Se não houver conta destinatária, preservar cadastro sem usuário; não criar conta ou reivindicar histórico silenciosamente. Não tornar dados/documentos do proprietário anterior visíveis ao destinatário.
- Animal em óbito não inicia novo procedimento. Ex-proprietário perde imediatamente lista/contexto/envio, mesmo com contexto aberto antes da transferência.
- Atendimentos com vários animais mantêm registros de cada UUID pertinente. Preservar idempotência de transições e notificações, sem duplicar prontuário por PATCH repetido.
- Registrar ações sensíveis usando auditoria existente, sem anexar bytes de documentos ou credenciais ao log.

### 8. Integração e verificação

- Integrar entrada e ramo tutor depois de testar os contratos/serviços; preservar primeiro cadastro, no-Tutor, múltiplos animais, balcão e serviços públicos.
- Remover prefill/ramificações antigas substituídas, sem apagar as consultas legadas da fase 7 ou esconder versões duplicadas por CSS.
- Documentar precondições de schema e configuração documental e executar os checks disponíveis com DB/transportes simulados.

## Segurança, dados e multi-tenant

- Sessão válida, completa e ativa é obrigatória para animais próprios, contexto e documentos. Reutilizar a revogação/validação da fase 5.
- Município e usuário vêm do servidor; parâmetros não redirecionam uma sessão municipal para outra prefeitura.
- Propriedade e relação municipal são verificadas no acesso e no envio. Nenhuma autorização nasce de CPF, e-mail, microchip, nome, readonly da interface ou hash público.
- Vínculo, status, arquivo original, política e vaga devem resistir a alterações entre consulta e submissão. Definir uma ordem consistente de locks entre submissão, materialização, revisão e ações internas.
- Tutores não recebem listas administrativas, permissões, contatos alheios ou evidências internas. Contatos exibidos em resumos seguem o mascaramento definido na especificação; dados necessários do próprio usuário permanecem restritos às operações autorizadas.
- Sem senhas, códigos, chaves antigas, base64 ou dados pessoais desnecessários em URLs, logs e analytics.
- Sem fetch de URLs arbitrárias recebidas como arquivo, preview público ou conteúdo HTML executável. Preview deve respeitar MIME permitido e download autorizado.
- Não usar normalização de chip/CPF como mecanismo de merge ou autorização.
- Não reinterpretar o contexto “sistema novo” como permissão para apagar dados ou dispensar proteção de contas já criadas.

## Validações necessárias

- IDs válidos, listas e buscas limitadas; conta/município ativos; vínculo atual, animal e status autorizados.
- Identificação persistida compatível com o município; tipo de procedimento ativo; raça/espécie preservadas sem exigir que um cadastro readonly seja reescrito.
- Campos mínimos de tutor vindos de origem confiável; CPF corresponde à identidade municipal da sessão.
- Tipo e abrangência documental atuais; origem própria; vínculo individual quando exigido; hash e recebimento; prazo e estado; presença de arquivos obrigatórios e novo aceite.
- Rejeitar ou neutralizar metadados de revisão/validade forjados. Não aprovar automaticamente por erro de IA ou ausência de prova.
- Limites de arquivo efetivos e pedido agregado; conflitos concorrentes de origem/documento/propriedade tratados antes de salvar.
- Agenda ativa, data/ocorrência/slot corretos e capacidade suficiente para a quantidade real de animais.

## Testes recomendados

### Backend e transações

- Primeira solicitação elegível cria todos os UUIDs, vínculos e registros, inclusive sem chip; rollback remove toda a operação se qualquer etapa falhar.
- Tutor autenticado pode cadastrar outro animal; submissão anônima com CPF já existente não adquire a conta nem seus animais.
- Cadastro sem Tutor não cria usuário/CPF fictício. Balcão não recebe propriedade por ser o autor do cadastro.
- Chip declarado não reserva o índice global confirmado; confirmação interna e colisão não reassociam animal/proprietário. Resolver legado não duplica UUID já persistido.
- Raça, pelagem, nascimento, identificação e IDs de todas as posições sobrevivem ao ciclo banco/API/formulário.
- Conversão de solicitação própria anterior é explícita, idempotente sob concorrência/retry após acréscimo de UUID, rejeita origem/item alterados e não opera por CPF. Registro canônico legado fora do JSON é reconhecido; transferência ou ambiguidade não permite criar clone para o ex-tutor.
- Lista, busca, contexto e preview negam outro usuário, município, conta inativa e token restrito; busca não amplia escopo com curingas.
- Payload adulterado de tutor/animal não altera o snapshot do servidor. Transferência/óbito entre GET e POST bloqueia a criação.
- Documentos de outro usuário/município/animal e referências inexistentes, trocadas ou rejeitadas não podem ser reaproveitados.
- Prazo positivo, ausência de prazo, fronteira exata do vencimento e relógio do servidor; cadeia de reuso não renova `receivedAt`; fonte antiga sem data não ganha data atual.
- Aprovação, recebimento e receipts forjados no POST/JSON antigo não são herdados; revisão só vale com conteúdo/política correspondentes e procedência verificável. Arquivo alterado invalida revisão anterior; alteração de política não reinicia a data original; receipt inválido/cópia de origem desconhecida não recebe idade nova.
- Foto de origem com vários animais, evidência interna, declaração e assinatura não recebem reuso indevido.
- Catálogo não contém bytes; conteúdo é autorizado sob demanda; limites de arquivo/tamanho agregado incluem reaproveitados e são aplicados no servidor. Testar expansão base64 e caracteres multibyte para medir bytes do JSON UTF-8 final, não só tamanho decodificado ou número de caracteres.
- Última vaga disputada por duas transações aceita só uma; vários animais consomem várias vagas; cancelamento libera vaga; reagendamento disputa a mesma reserva sem deadlock.
- Disponibilidade não contém dados de terceiros e respeita município, recorrências/mutirão, lotação, cancelamento e legados sem slot. Duas ocorrências/locais na mesma data não compartilham uma identidade textual ambígua; agregado e reserva usam a chave persistida do servidor.
- Óbito, transferência e atendimento são consistentes, auditados e idempotentes; destinatário com conta existente recebe somente o vínculo autorizado, sem documentos do ex-tutor. Transferência municipal não altera vínculos de outra prefeitura nem usa relação legada ambígua como prova de autorização.

### Frontend

- CTAs mostram as duas opções; município/data permanecem após login e troca obrigatória. Logout/troca de contexto remove intenção e dados antigos.
- Tutor não monta painel ou autosaves administrativos. Listagem inicial não carrega todo o histórico de anexos.
- Busca, carregamento, erro/retry, vazio e cadastro de outro animal; candidato anterior se converte antes de abrir contexto.
- Modo cadastrado mostra apenas um animal readonly, pula Tutor com contexto válido e mantém as etapas configuradas e acompanhamento final.
- Trocar procedimento não apaga raça/identificação; tipo inativo não vira outro automaticamente; lacunas não são preenchidas com valores fictícios.
- Reuso seleciona referências, permite substituição e diferencia pendente/vencido; novo aceite obrigatório. Troca de animal/procedimento invalida candidatos incompatíveis e respostas tardias.
- Agenda usa agregados e atualiza após conflito sem perder dados válidos do pedido.
- Fluxos de primeiro cadastro com vários animais, animal sem Tutor, balcão, consultas legadas, adoção, denúncia e recuperação de acesso permanecem funcionais.

### Comandos e revisão

```powershell
npm run typecheck
npm test
$backendTests = @(rg --files backend/test -g '*.test.js')
node --test @backendTests
npm run build
git diff --check
```

- Não há script de lint nos manifests inspecionados; não inventar um.
- Conferir sintaxe dos novos arquivos JS com `node --check`.
- Testes devem usar banco e provedores simulados, sem iniciar o boot, executar a migration ou enviar mensagens reais.
- A especificação pede revisão de código com atenção elevada nesta fase. Revisar especialmente propriedade, DTOs, reuso e transações/locks; não tratar somente testes de funções puras como evidência suficiente.
- Inspeção visual em navegador e testes reais de fluxo somente quando solicitados. A etapa atual não executa esses checks: entrega o plano.

## Riscos e pontos de atenção

- A fase depende de schema novo; o boot legado não aplica automaticamente essa SQL. Uma migração local anterior não prepara um ambiente diferente.
- O formulário e as rotas são grandes: extrair novos comportamentos para módulos, mantendo integração pequena; evitar uma refatoração geral como efeito colateral.
- Animal global e propriedade municipal exigem dois vínculos independentes. CPF coincidente não corrige um vínculo ausente.
- Chip autodeclarado precisa de conferência antes de ocupar a unicidade global. Histórico ambíguo não deve ser mesclado automaticamente para reduzir cards.
- Arquivo recente não significa documento emitido recentemente; prazo de reuso e análise do conteúdo são coisas distintas.
- Reaproveitamento não é aprovação. Dados existentes sem autoria/hash não oferecem prova suficiente para manter `approved`.
- Anexos em JSONB podem crescer por cópia. Usar catálogo leve, conteúdo sob demanda e limites; storage próprio é evolução separada.
- Datas/slots legados e calendário por regras precisam de paridade no servidor. Não publicar um agregado que conte somente pedidos do tutor.
- Transferência e revisão concorrentes exigem rechecagem sob lock e ordem de aquisição consistente.
- Configuração antiga usa abrangência por solicitação; o administrador deve classificar os tipos que podem ser reaproveitados. Não habilitar tudo automaticamente.

## Perguntas em aberto

Não há decisão de produto bloqueando o salvamento deste plano. Foram confirmados pelo usuário o momento do cadastro e a regra de prazo; as escolhas técnicas conservadoras descritas acima detalham a proposta aprovada.

Pendências operacionais que não constituem autorização implícita:

- Confirmar ambiente e autorizar a aplicação da **nova** migration antes de executar código dependente.
- A prefeitura classifica abrangência e prazo dos documentos no catálogo. Ausência de configuração não é autorização para inferir categoria pelo nome.
- Resolução de colisões/duplicidades históricas e correção de dados faltantes continuam exigindo atendimento autorizado; não implementar merge automático.
- Templates e validação real de entrega da fase 5 continuam como pendência própria, sem incorporá-los nesta implementação.

## Critérios de aceite

- O cidadão escolhe primeira solicitação ou animal cadastrado sem perder município/data.
- Após login, vê apenas seus animais municipais, incluindo os sem chip, com busca por nome ou chip próprio.
- Uma primeira submissão bem-sucedida cadastra todos os animais e seus vínculos atomicamente. Registro próprio anterior pode ser utilizado sem apropriar histórico por CPF.
- Animal/tutor escolhidos vêm do servidor para leitura; usuário informa somente os dados do novo procedimento e etapas aplicáveis.
- Raça, identificação, características e IDs permanecem íntegros; animal falecido ou transferido não pode ser usado indevidamente.
- Arquivos elegíveis são reaproveitados sem novo upload; vencidos, incompatíveis ou faltantes exigem substituição/anexo. Prazo original não é renovado pela cópia.
- Reuso não transporta aprovação forjada; novo aceite e revisão necessária são preservados.
- Disponibilidade e reserva funcionam sem divulgar pedidos alheios e sem aceitar duas ocupações da última vaga.
- Token restrito, conta/município incorretos e IDs/referências adulterados são rejeitados no servidor.
- Checks aplicáveis e revisão de risco passam; `.env`, secrets, lockfiles, migrations antigas e alterações alheias permanecem preservados.
- A nova migration é entregue revisável, sem ser executada pela implementação.

## Instruções para /implementar

- Implementar a partir deste plano somente após invocação separada de `/implementar .portal/plans/animal-cadastrado-fase-6.md`.
- Começar confirmando o estado do repositório e as instruções atuais; preservar as alterações preexistentes em skills, `AGENT.md`, specs e plano de PDFs.
- Não confundir a aprovação deste Markdown com autorização de migration, seed, boot que escreve no banco, `.env`, mensagens reais, commit/push ou deploy.
- Preparar o schema novo e validar com testes simulados. Não editar `backend/src/db/migrations.js` nem a migration SQL já aplicada da fase 5.
- Reutilizar domínio, sessão e contratos das fases anteriores. Novos serviços/repositories devem ser pequenos, testáveis e explícitos sobre usuário/município/transação.
- Não criar uma segunda versão completa do formulário nem montar o painel administrativo dentro da área do tutor.
- Se uma limitação concreta impedir os critérios, apresentar evidência e ajustar o plano antes de ampliar escopo ou enfraquecer isolamento. Não deixar núcleo de autorização/reuso/agenda para depois sem registrar a incompletude.
- Entregar resumo das mudanças, testes, revisão e pendências operacionais. `/finalizar` cuida de commit/push em `main` em etapa própria.
