# Plano de Implementação: Fase 7 — remover a chave de validação e acompanhar por protocolo e contato

## Origem

- Arquivo de especificação: `.plans/solicitacao-animal-cadastrado-e-acesso-tutor.md` (fase 7)
- Data do planejamento: 2026-11-15
- Base: commit `89acece`, com as fases 1 a 6 concluídas.
- Classificação: `frontend + backend + database`
- Revisão extra obrigatória depois do `/implementar`: segurança e privacidade (fluxo público de verificação por código, isolamento municipal, autorização de animais), como nas fases 5 e 6.
- Aprovação: opção 1 do menu do `/planejar`. As quatro perguntas em aberto foram aprovadas com os padrões recomendados (ver "Perguntas em aberto").

---

## Resumo

A chave de validação permanente deixa de existir. Hoje ela é a única credencial de visitante em três lugares: a consulta pública de solicitações, a consulta de adoções e as rotas de animais (`/lookup`, `/consult`, `/:id/death`, `/:id/transfer`). A rota `GET /requests/public/:chave` devolve `SELECT *` sem login e com a chave na URL.

Nada mais insere em `request_validation_keys` desde as fases 5 e 6, então a consulta por CPF + chave só funcionaria com dados antigos. O banco local foi zerado em 2026-11-15 e o projeto não está em produção, portanto **não há período de transição**.

A remoção exige dois substitutos:

1. **Serviços de animal (prontuário, troca de tutor, óbito).** Hoje só funcionam como visitante com CPF + chave, e a área do tutor logado não os tem. Passam a ser ações por animal na área do tutor, com login.
2. **Acompanhamento sem conta.** Consulta por protocolo + contato informado em "Quer acompanhar?", com código enviado a esse contato e token curto de uma única solicitação. A chave ou o token nunca vão na URL.

Entrega em duas partes, com commits separados na mesma conversa: **7a** (remoção + serviços na área do tutor) e **7b** (acompanhamento).

---

## Escopo

### Dentro do escopo

- Remover a chave de validação de ponta a ponta (rotas, geração, gravação, credencial legada, telas, PDF, colunas de tabela, tabela e coluna no banco).
- Exigir login nas quatro rotas de animais e aceitar `animalId` no `/animals/consult`, porque existem animais sem microchip desde a fase 6.
- Mover prontuário (com PDF), troca de tutor e óbito para a área do tutor, por animal.
- Criar o acompanhamento por protocolo + contato + código, com token curto de escopo único.
- Novo propósito de mensagem `request_tracking`, com templates na aba E-mail e na aba WhatsApp.
- Nova tela pública "Acompanhar solicitação" e novo cartão na home.
- Tirar os cartões Prontuário, Troca de tutor e Óbito da home pública. O login continua pelo "Animal já cadastrado".
- SQL de remoção e SQL da nova tabela de desafios, entregues para o usuário aplicar.

### Fora do escopo

- Substituto para "Adoções vinculadas": a consulta de adoções por CPF + chave some sem equivalente.
- Link de acompanhamento dentro das mensagens de notificação.
- Acompanhar usando contatos cadastrais do tutor. Só vale o contato informado em "Quer acompanhar?" com `followUp.enabled === true`.
- Reenvio automático, fila durável e confirmação de entrega.
- Alterar fases 1 a 6, `.env`, dependências ou CI/CD.
- Inspeção visual em navegador, salvo pedido do usuário.

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md`
- `.plans/solicitacao-animal-cadastrado-e-acesso-tutor.md`
- `backend/src/routes/requests.js`, `adoptions.js`, `animals.js`
- `backend/src/db/migrations.js`, `backend/src/db/sql/20261113-tutor-access.sql`, `backend/src/scripts/rebootMunicipalities.js`
- `backend/src/services/auth/` (nomes e exports: `auth-security.js`, `auth-message-delivery.js`, `auth-contacts.js`)
- `shared/auth-contract.js`
- `src/App.tsx` (`ValidationKeyConsultation`, `AnimalRecordPanel`, `TutorDashboard`, `publicHomeServices`, ramo de serviços públicos, PDF do Requerimento), `src/api.ts`, `src/domain.ts`
- `src/features/tutor-access/tutor-area.tsx`, `auth-entry-context.ts`, `src/features/registered-animals/` (lista de arquivos)
- testes de backend que citam a chave: `animal-access-security`, `public-data-access`, `request-routes`, `notification-transports`

---

## Impacto por área

### Frontend

- **Home pública:** `publicHomeServices` perde `prontuario`, `transfer` e `death` e ganha `tracking` ("Acompanhar solicitação"). O ramo final do render de serviços públicos, que hoje cai em `ValidationKeyConsultation`, passa a renderizar a nova tela.
- **Nova `src/features/request-tracking/`:** formulário protocolo + contato, passo do código com reenvio e contagem regressiva, e visão somente leitura da solicitação (status, agenda, contagens de documentos). Hook próprio e testes. Mensagens genéricas, sem revelar se o protocolo existe. Estados de loading, erro e vazio.
- **Nova `src/features/animal-services/`:** prontuário (histórico e PDF via `generateProntuarioPdf` já existente), formulário de troca de tutor e formulário de óbito, extraídos de `ValidationKeyConsultation` e `AnimalRecordPanel`, sem `cpf`/`validationKey`.
- **Área do tutor:** `registered-animals-view.tsx` e `tutor-area.tsx` ganham as três ações por animal. Animal sem microchip precisa funcionar, então tudo usa o `animalId`.
- **`TutorDashboard`:** perde as props `cpf` e `validationKey`. A consulta de histórico para o prontuário (hoje por microchip + CPF + chave) passa a usar o consult autenticado por `animalId`.
- **Abas de integração:** `auth-delivery-settings.tsx` ganha o rótulo e o filtro do novo propósito `request_tracking` por canal.
- **`api.ts`:** remover `consultRequestsByCredentials` e `consultAdoptionsByCredentials`. Criar os métodos do acompanhamento e do consult por `animalId`. `createAnimalDeathRequest` e `createAnimalTransferRequest` deixam de enviar `cpf` e `validationKey`.
- **PDF do Requerimento:** trocar o bloco "VALIDAÇÃO / CHAVE DE VALIDAÇÃO DIGITAL" pelo protocolo, sem criar campo novo.
- **`domain.ts`:** remover `validation_key` da lista de colunas e de `normalizeRequest`.
- **CSS:** apagar os blocos exclusivos de `ValidationKeyConsultation` (`cons-*`, `svc-*`, comentário em torno da linha 21576 de `styles.css`). Antes de apagar cada classe, fazer grep no arquivo inteiro e só retirar o nome de seletores combinados compartilhados, sem duplicar regra nem usar `!important`.

### Backend

- **`routes/requests.js`:** remover `GET /public/:validationKey`, `POST /consult`, `randomValidationKey`, a gravação de `validation_key` no INSERT e `withoutValidationKey`.
- **`routes/adoptions.js`:** remover `GET /by-key/:validationKey` e `POST /consult`.
- **`routes/animals.js`:**
  - remover `randomValidationKey` e a gravação de `validation_key` nas solicitações de óbito e troca;
  - remover `hasLegacyCredential` e `isCredentialAuthorizedForAnimal`;
  - simplificar `ensureAuthorized`, `fetchActiveTutor` e `requestOwnerScope`, tirando o ramo anônimo por CPF;
  - `requireAnimalContext` e as quatro rotas passam de `optionalAuth` para `auth`;
  - `/consult` aceita `animalId` além do microchip. `ensureAnimalFromLegacyRequest` permanece;
  - óbito e troca criadas por tutor usam os dados do próprio vínculo autenticado (`animal_tutors.user_id`), e não o CPF do corpo da requisição.
- **Novo acompanhamento** (`services/request-tracking/`, repositório próprio, `shared/request-tracking-contract.js`):
  - `POST` iniciar: município + protocolo + contato. Resposta sempre igual e genérica. Só envia código se a solicitação do município tiver `workflow_data.followUp.enabled === true` e o contato normalizado for igual ao `followUp.email` ou `followUp.phone`.
  - `POST` verificar: código → token assinado, escopo de uma solicitação e um município, somente leitura, validade curta, enviado em header `Authorization`, `Cache-Control: no-store`.
  - `GET` visão: projeção por lista permitida (protocolo, tipo, status, agenda, contagens de documentos). Sem CPF, endereço, contatos, nomes de arquivos ou justificativas.
  - Reaproveitar `AUTH_CHALLENGE_SECONDS`, `AUTH_RETRY_SECONDS`, `AUTH_MAX_CODE_ATTEMPTS`, `verificationCode()`, `authenticatedDigest()`, `safeDigestEqual()`, `normalizeAuthEmail/Phone`, `auth_rate_limits` e `deliverAuthMessage`.
  - Novo `AuthPurpose.REQUEST_TRACKING` em `shared/auth-contract.js`. Conferir no `/implementar` os testes que enumeram propósitos e o mapeamento propósito → tipo de contato em `auth-message-delivery.js`.
  - Limites por IP, por protocolo + município e por contato. Resultado de envio indica aceite pelo provedor, não entrega.
- **`scripts/rebootMunicipalities.js`:** remover a linha que apaga `request_validation_keys`.

### Banco de dados

- **Remoção (7a):** `DROP TABLE IF EXISTS request_validation_keys` e `ALTER TABLE requests DROP COLUMN IF EXISTS validation_key` (o índice `requests_validation_key_idx` cai junto). SQL em `backend/src/db/sql/`, seguindo o padrão dos arquivos de 2026-11-13.
- **`db/migrations.js`:** apagar a criação de `request_validation_keys`, a coluna `validation_key` no `CREATE TABLE requests`, o `ADD COLUMN IF NOT EXISTS validation_key` e o índice. Esse arquivo roda a cada boot, e deixar qualquer uma dessas linhas desfaria o DROP.
- **Nova tabela (7b):** desafios de acompanhamento (solicitação, município, canal, digest do código, validade, tentativas, próximo envio, consumo), com índices por solicitação e validade. Arquivo SQL próprio. Não reutilizar `auth_challenges`, que exige `user_id`.
- **Ordem de aplicação:** o SQL da nova tabela vem **antes** do código de 7b. O SQL de DROP vem **depois** do código de 7a, porque o código antigo ainda escreve `validation_key`.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção. O SQL é entregue ao usuário. Aplicar no banco local só com autorização específica.

### Infra/Deploy

Sem impacto esperado. Nenhuma variável de ambiente, dependência ou configuração de deploy nova. O envio reaproveita EmailJS e WhatsApp já configurados e a cota existente.

---

## Arquivos provavelmente afetados

- `backend/src/routes/requests.js`, `adoptions.js`, `animals.js`
- `backend/src/db/migrations.js`, `backend/src/db/sql/` (dois arquivos novos), `backend/src/scripts/rebootMunicipalities.js`
- `backend/src/services/request-tracking/` e `backend/src/repositories/` (novos), `backend/src/services/auth/auth-message-delivery.js`
- `shared/auth-contract.js`, `shared/request-tracking-contract.js` (novo)
- `src/App.tsx`, `src/api.ts`, `src/domain.ts`, `src/styles.css`
- `src/features/request-tracking/` e `src/features/animal-services/` (novas)
- `src/features/tutor-access/tutor-area.tsx`, `auth-delivery-settings.tsx`, `src/features/registered-animals/registered-animals-view.tsx`
- `backend/test/animal-access-security.test.js`, `public-data-access.test.js`, `request-routes.test.js`, `notification-transports.test.js`, e novos testes
- `.plans/solicitacao-animal-cadastrado-e-acesso-tutor.md` (status da fase 7)

---

## O que será removido

- `ValidationKeyConsultation` inteiro e o `AnimalRecordPanel` legado, com seus estados, formulários, imports órfãos e CSS exclusivo.
- Props `cpf` e `validationKey` de `TutorDashboard`.
- `consultRequestsByCredentials` e `consultAdoptionsByCredentials` em `api.ts`.
- Cartões `prontuario`, `transfer` e `death` de `publicHomeServices`.
- Rotas `GET /requests/public/:validationKey`, `POST /requests/consult`, `GET /adoptions/by-key/:validationKey`, `POST /adoptions/consult`.
- `randomValidationKey` (em `requests.js` e `animals.js`), `withoutValidationKey`, `hasLegacyCredential`, `isCredentialAuthorizedForAnimal` e os ramos anônimos por CPF de `ensureAuthorized`, `fetchActiveTutor` e `requestOwnerScope`.
- Acesso anônimo (`optionalAuth`) às rotas `/lookup`, `/consult`, `/:id/death`, `/:id/transfer`.
- Bloco "CHAVE DE VALIDAÇÃO DIGITAL" do PDF do Requerimento, `validation_key` em `domain.ts` (coluna "Chave digital" e `normalizeRequest`).
- Em `migrations.js`: `request_validation_keys`, coluna `validation_key` e índice `requests_validation_key_idx`.
- Linha de `rebootMunicipalities.js` sobre `request_validation_keys`.
- Tabela `request_validation_keys` e coluna `requests.validation_key` no banco (via SQL manual).
- Fixtures de teste que usam `validation_key` e `validationKey` como credencial (as de `notification-transports` viram campo genérico de lista permitida).

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

**Parte 7a — remoção e serviços do tutor** (um commit):

1. Backend: apagar as rotas e a geração da chave; tornar as quatro rotas de animais autenticadas; simplificar autorização; aceitar `animalId` no `/consult`; óbito e troca usando o vínculo autenticado.
2. Frontend: criar `features/animal-services/` extraindo os formulários; ligar as ações por animal na área do tutor; ajustar `TutorDashboard` e `api.ts`.
3. Frontend: remover cartões da home, `ValidationKeyConsultation`, `AnimalRecordPanel`, PDF, `domain.ts` e CSS exclusivo (com grep por classe).
4. Banco: limpar `migrations.js` e `rebootMunicipalities.js`; escrever o SQL de DROP e entregá-lo ao usuário.
5. Testes de 7a e checks. Commit.

**Parte 7b — acompanhamento** (outro commit):

6. Contrato compartilhado e novo `AuthPurpose.REQUEST_TRACKING`; templates nas abas E-mail e WhatsApp.
7. SQL da nova tabela entregue ao usuário. Repositório, serviços (iniciar, verificar, visão), token e limites.
8. Frontend: tela "Acompanhar solicitação" e cartão na home.
9. Testes de 7b, revisão de segurança, checks completos. Commit.

**Fechamento:** atualizar o spec com o status e os hashes da fase 7. Depois, `/finalizar`.

---

## Regras de negócio identificadas

- Não existe mais chave de validação. A conclusão da solicitação mostra só o protocolo e a confirmação.
- Nunca listar nem expor animais só com CPF ou microchip sem autenticação. Busca só depois do login e só dentro dos animais do tutor.
- Prontuário, troca de tutor e óbito exigem login do tutor dono do vínculo ativo do animal. A equipe interna continua pelo painel administrativo.
- Acompanhamento sem conta: protocolo + contato informado + código enviado a esse contato. O código é de 6 dígitos, vale 10 minutos, o reenvio espera 60 segundos e há no máximo 5 tentativas.
- Só participam solicitações com `followUp.enabled === true`. Quem escolheu "Não" não tem como acompanhar sem conta.
- Escolher "Não" ou usar contato diferente do informado produz a mesma resposta genérica de qualquer protocolo inexistente.
- O token do acompanhamento é emitido depois do código, vale para uma solicitação, é somente leitura e nunca vai na URL. Não há link nas mensagens.
- Mascarar contatos na tela (ex.: `r*****@gmail.com`, `(48) *****-1234`) e não mostrar contato completo.
- Tutor com conta pode usar o login normal. O acompanhamento por código é para quem não tem conta.

---

## Regras multi-tenant e segurança

- Município sempre de origem confiável: na área do tutor, o da sessão; no acompanhamento, o município selecionado e validado no servidor. Toda consulta filtra por `municipality_id`, e o token carrega município e solicitação.
- Enumeração: protocolos são sequenciais (`000123/2026`). Resposta idêntica para protocolo inexistente, contato errado ou sem acompanhamento. Limites por IP, por protocolo + município e por contato, com `auth_rate_limits`. Comparação de código em tempo constante.
- Custo de abuso: o endpoint de iniciar dispara e-mail e WhatsApp. Respeitar a cota existente e não enviar quando não há correspondência.
- Visão pública mínima por lista permitida. Nenhum CPF, endereço, contato, nome de arquivo ou justificativa.
- Código guardado só como digest. Um desafio novo invalida o anterior, e o código é de uso único.
- Autorização de animais: `isUserAuthorizedForAnimal` por vínculo ativo do usuário. Sem ramo anônimo.
- PDFs: o Requerimento deixa de imprimir a chave. O prontuário continua gerado no navegador a partir de dados já autorizados.
- Nenhum secret, `.env` ou dependência alterados.

---

## Validações necessárias

- Município (UUID), protocolo (formato `NNNNNN/AAAA`) e contato (e-mail ou telefone normalizado) no iniciar. Tamanhos máximos.
- Código com exatamente 6 dígitos; token validado por assinatura, validade, escopo e município.
- Troca de tutor: nome, CPF válido do novo tutor e demais campos já exigidos hoje. Óbito: data e causa. Ambos validados no servidor, sem confiar em `cpf` do corpo.
- `animalId` em UUID no `/consult`; microchip continua validado como hoje.
- Rejeitar `GET` de acompanhamento sem token ou com token de outra solicitação.

---

## Testes necessários

### Frontend

- Home pública: sem os três cartões antigos e com "Acompanhar solicitação".
- Tela de acompanhamento: etapas protocolo/contato → código, mensagens genéricas, reenvio, erro e visão somente leitura sem dados sensíveis.
- Área do tutor: ações por animal, inclusive animal sem microchip; formulários de troca e óbito sem `cpf` nem `validationKey` no payload.
- Rótulos do novo propósito nas abas E-mail e WhatsApp (filtro por canal).
- Garantir que nenhum payload ou componente cita `validationKey`.

### Backend

- As quatro rotas de animais recusam acesso sem login e aceitam o tutor dono, por microchip e por `animalId`; recusam tutor de outro vínculo e de outro município.
- Rotas removidas respondem 404; `POST /requests` não grava nem devolve chave.
- Acompanhamento: resposta genérica para os três casos negativos, correspondência só com `followUp.enabled` e contato igual, limites por IP/protocolo/contato, código expirado, usado, errado e esgotado, reenvio antes de 60 segundos, token de uma solicitação não abre outra, isolamento entre municípios, projeção sem dados sensíveis, `Cache-Control: no-store`.
- Atualizar `animal-access-security`, `public-data-access`, `request-routes` e `notification-transports`.

### E2E

- Sem E2E automatizado neste projeto. Roteiro manual para o usuário conferir na tela: iniciar acompanhamento, receber código, ver status; entrar como tutor e usar prontuário, troca e óbito; gerar o PDF do Requerimento; home sem os cartões antigos.

---

## Comandos de validação sugeridos

```bash
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

Não há script de lint no projeto. O build mantém o aviso de chunks acima de 500 KB, que já existia.

---

## Riscos e pontos de atenção

- Superfície pública nova (enumeração e abuso de envio). Mitigada pelas respostas genéricas e pelos limites.
- Remoção de funcionalidade pública: consulta de adoções por CPF + chave e serviços de visitante. Aceitos pelo usuário.
- `migrations.js` roda a cada boot: editar o arquivo executa no deploy, e esquecer uma linha de DDL desfaz o DROP.
- Ordem entre código e SQL (nova tabela antes de 7b; DROP depois de 7a).
- `App.tsx` com 12 mil linhas e `styles.css` com 26 mil: trabalhar com greps direcionados e conferir cada classe antes de apagar CSS.
- Risco de quebrar o contrato frontend/backend nas rotas de animais: atualizar `api.ts` e os testes juntos.
- Sem inspeção visual por padrão: a conferência na tela fica com o usuário.
- Commit e push direto em `main`, sem `staging`. Sem produção hoje, mas migrations continuam só com confirmação.

---

## Perguntas em aberto

Resolvidas com os padrões recomendados na aprovação (opção 1). Revisar antes do `/implementar` se algum não estiver certo:

1. Prontuário, troca de tutor e óbito passam para a área do tutor logado, e os cartões públicos saem.
2. "Adoções vinculadas" é removida sem substituto.
3. Acompanhamento vale só para os contatos informados em "Quer acompanhar?". O "token por solicitação" é o token curto emitido depois do código. As mensagens não ganham link.
4. A entrega é dividida em 7a e 7b, com commits separados.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- `grep` por `validation_key`, `validationKey` e `request_validation_keys` em `src/`, `backend/src/` e `shared/` não encontra mais nada fora do SQL de remoção.
- As rotas legadas respondem 404 e nenhuma resposta de solicitação traz chave.
- Prontuário, troca de tutor e óbito funcionam na área do tutor, inclusive para animal sem microchip, e as quatro rotas exigem login.
- Acompanhamento por protocolo + contato + código funciona só para solicitações com acompanhamento ativo, com respostas genéricas, limites e token de escopo único.
- A visão pública não expõe CPF, endereço, contatos, arquivos nem justificativas.
- O PDF do Requerimento não imprime chave.
- Typecheck, testes de frontend e backend e build passam; revisão de segurança concluída.
- SQL de DROP e de nova tabela entregues ao usuário, sem execução automática.
- Spec atualizado com o status da fase 7.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`. Código novo em inglês, sem código morto, sem `console.log`, arquivos pequenos e uma responsabilidade por arquivo.
- Manter alterações pequenas e focadas. Fazer 7a e 7b em commits separados.
- Deletar tudo que está na seção "O que será removido" — não ocultar. Antes de apagar CSS, grep da classe no arquivo inteiro e só retirar o nome de seletores compartilhados, sem `!important` nem regra nova por cima.
- Verificar durante a implementação como `auth-message-delivery.js` mapeia propósito e contato antes de adicionar `request_tracking`.
- Atualizar os testes conforme descrito e rodar typecheck, testes e build uma vez ao final de cada parte.
- Depois do `/implementar`, rodar revisão de segurança antes do `/finalizar`.
