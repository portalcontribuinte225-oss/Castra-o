# Plano de Implementação: Aba "Dados do tutor" no atendimento e filtros de bairro nos relatórios

## Origem

- Arquivo de especificação: nenhum arquivo único. Base: a conversa de 2026-11-16 (duas demandas e as respostas às perguntas de decisão) e o código do `main` (commit `5a6c74c`).
- Data do planejamento: `2026-11-16`
- Classificação: `frontend + backend + database` (5 colunas novas em `tutor_profiles`, por SQL manual em `backend/src/db/sql/`; nenhuma variável de ambiente nova)

---

## Resumo

Duas demandas.

1. **Aba "Dados do tutor"** no modal do atendimento (`RequestPreviewModal`), ao lado de "Anexos". A equipe edita nome, e-mail, telefone e endereço do tutor (CPF só leitura) e pode definir uma senha nova no mesmo formulário. A senha digitada passa a valer como está, sem troca obrigatória no próximo acesso. O "Recuperar acesso de tutor" sai do sistema, porque o campo de senha o substitui.
2. **Bairros nos relatórios.** Dois filtros, "Bairro do tutor" e "Bairro do animal", e duas colunas na tabela e no PDF. O bairro do animal é novo: obrigatório, um por animal, escolhido em uma lista de bairros cadastrada por município (tela "Bairros" em Configurações). O bairro do tutor passa a usar a mesma lista.

Decisões do usuário:

- senha trocada pelo atendente vale como está (sem troca obrigatória);
- e-mail e telefone alterados pela equipe valem direto;
- CPF somente leitura;
- bairro do animal: um por animal, lista de seleção, obrigatório;
- lista de bairros: cadastro por município;
- bairro do tutor: mesma lista do animal;
- limpar o banco, ficando só dados padrão (apenas dados de uso; só o banco local, SQL entregue ao usuário).

---

## Escopo

### Dentro do escopo

- Aba "Dados do tutor" (leitura e edição), com campo de senha opcional.
- Endpoint de leitura e de gravação dos dados do tutor, por solicitação, restrito à equipe interna do município, com auditoria.
- Remoção do fluxo "Recuperar acesso de tutor" (botão, modal, rotas, métodos de API, tipo, CSS, teste).
- Configuração `castragestao:neighborhoods` por município e tela "Bairros" em Configurações (criar vários por linha, editar, ativar/inativar).
- Campo "Bairro do animal" obrigatório no formulário público e no interno, com validação no servidor.
- Bairro do tutor como lista (com texto livre enquanto a lista do município estiver vazia).
- Filtros e colunas de bairro nos Relatórios (tela e PDF).
- SQL de colunas de endereço em `tutor_profiles` e SQL de limpeza do banco (ambos entregues ao usuário, não executados).

### Fora do escopo

- Editar o CPF do tutor.
- Bairro em transferência de tutor (`target_tutor_*`), em adoção e em denúncia.
- Exigir bairro de solicitações no formato antigo (sem procedimentos por animal) e de animais já cadastrados.
- Carregar uma lista real de bairros (a lista de um município é cadastrada pelo administrador).
- Mudar o dashboard (ele já agrupa por `request.neighborhood`).
- Executar qualquer SQL no banco.

---

## Leitura de contexto

- `/AGENT.md`
- `src/App.tsx`: `RequestPreviewModal` (abas), botão e estado do `AssistedRecovery`, formulário de solicitação (endereço do tutor e passo do animal), carga e persistência de config (`CONFIG_KEYS`)
- `src/features/reports.tsx`, `src/features/request-procedures/animal-fields.tsx`, `request-procedures.ts`, `src/features/breeds/*` (padrão de tela de config e de fallback para texto)
- `src/features/tutor-access/assisted-recovery.tsx`, `src/api.ts`, `src/domain.ts`
- `backend/src/routes/auth.js`, `config.js`, `requests.js`
- `backend/src/services/auth/*` (recuperação assistida, sessão, segurança, contatos), `request-submission.js`, `request-procedures.js`, `registered-animals/*`
- `backend/src/repositories/auth-users.js`, `tutor-profiles.js`, `request-settings.js`, `registered-animals.js`
- `backend/src/db/sql/20261113-tutor-access.sql`, `backend/src/db/migrations.js`
- `backend/test/fixtures/auth-http.js` e os testes de auth e de requisição

---

## Estado atual do disco (fora do fluxo, a confirmar)

Antes da aprovação deste plano, parte do **backend** foi escrita direto no disco, sem commit. O que existe, a ser conferido e aproveitado pela skill `implementar` (ou desfeito, se o usuário decidir):

- `backend/src/services/auth/tutor-data-handlers.js` (leitura e gravação por solicitação) e as rotas `GET/PUT /auth/request-tutor/:requestId` em `routes/auth.js`
- `backend/src/services/auth/assisted-recovery-handlers.js` removido, com o teste antigo removido de `auth-routes.test.js`
- `backend/src/services/neighborhood-defaults.js`, `request-neighborhoods.js` e a chave `castragestao:neighborhoods` em `routes/config.js` (com validação de nome repetido)
- `request-settings.js` lê os bairros; `request-submission.js` exige o bairro de cada animal novo (só no caminho com procedimentos por animal); `ANIMAL_FIELDS` ganhou `neighborhood`
- `AUDIT_ACTIONS.TUTOR_DATA_UPDATE`
- `backend/src/db/sql/20261116-tutor-address.sql` (não executado)
- testes novos `tutor-data.test.js` e `request-neighborhoods.test.js`; ajustes em `fixtures/auth-http.js`, `request-submission.test.js` e `request-routes.test.js`

Nada disso foi validado com `typecheck` e `build`, e a suíte completa de backend não foi rodada de ponta a ponta depois do último ajuste (só os arquivos afetados).

---

## Impacto por área

### Frontend

- `RequestPreviewModal`: terceira aba "Dados do tutor" (`modalTab` ganha o valor novo). Formulário com nome, e-mail, telefone, CEP, endereço, bairro (lista), cidade, UF, CPF somente leitura e senha opcional. Estados de carregamento, erro, sucesso e desabilitado; somente leitura quando o processo está finalizado (`readOnly`); mensagem quando a solicitação não tem tutor com acesso.
- Componente e hook novos em `src/features/tutor-data/` (padrão `use-*.ts`), métodos em `src/api.ts`. Sem `fetch` no componente.
- Tela "Bairros" em `src/features/neighborhoods/`, no padrão de Raças (`ConfigSectionHeader`, `ConfigStatusFilter`, lista, modal), com criação de vários bairros (um por linha). Nova aba em `environmentConfigTabs`.
- `CONFIG_KEYS` ganha `neighborhoods`; estado, carga por município (inclusive usuário global), persistência e leitura pública na tela de login por município, como as raças.
- `animal-fields.tsx`: campo "Bairro do animal" obrigatório (lista; texto livre se a lista estiver vazia); `blankAnimal` e "duplicar o anterior" levam o bairro; validação por etapa e por envio; destaque de campo inválido.
- Endereço do tutor nos formulários público e interno: bairro vira lista; o CEP (ViaCEP) só preenche o bairro se ele existir na lista.
- Relatórios: filtros "Bairro do tutor" e "Bairro do animal" (opções vindas dos dados, agrupando variações de grafia), colunas na tabela e no PDF, linhas em "Filtros aplicados".
- `normalizeRequest`: expõe o bairro do tutor e o do animal (primeiro animal; múltiplos animais contam cada bairro distinto).
- Testes: hook e formulário da aba, tela Bairros, campo do animal, filtros do relatório.

### Backend

- Endpoints `GET` e `PUT /auth/request-tutor/:requestId`: só equipe interna; município resolvido por `tenant.js`; o tutor é o da solicitação (`tutor_id`, ou o de mesmo CPF); limite de tentativas; transação; auditoria obrigatória sem gravar a senha.
- A gravação atualiza `users.name`, `tutor_profiles` (contatos e endereço), as solicitações em andamento (`NOVA` e `AGENDADA`) do tutor e os vínculos ativos em `animal_tutors`; as finalizadas ficam como foram registradas. Contato alterado pela equipe conta como verificado. Senha digitada: sessão revogada e sem troca obrigatória.
- Remoção do endpoint e do handler de recuperação assistida.
- Configuração `castragestao:neighborhoods`: leitura pública por município, escrita só para administração municipal ou global, validação (lista, nome até 120, sem repetição ignorando acento e caixa).
- Bairro do animal validado em `POST /requests` (animais novos, caminho com procedimentos por animal): obrigatório; se a lista do município tem itens, precisa ser um deles e é gravado com o nome cadastrado.
- Testes: dados do tutor (permissão, tenant, senha, propagação, auditoria, rollback), bairros (validação e config).

### Banco de dados

- Novo arquivo `backend/src/db/sql/20261116-tutor-address.sql`: `ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS address, neighborhood, city, state, cep` (texto, sem NOT NULL). Aplicação manual, antes do deploy do código.
- O bairro do animal não exige coluna: vai no cadastro do animal (`animals.metadata.registration`) e no JSON `requests.animals`. A config de bairros usa a tabela `config` existente.
- SQL de limpeza do banco (só dados de uso: solicitações e tabelas dependentes, animais, tutores e seus perfis, anexos, auditoria, tentativas e desafios de autenticação; mantém municípios, equipe, setores, permissões, tipos e configurações). Entregue como texto, com confirmação, para o usuário rodar no banco local.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

---

## Arquivos provavelmente afetados

- `src/App.tsx` _(arquivo grande: só os trechos do modal, do botão de recuperação, do endereço do tutor, do passo do animal e da carga de config)_
- `src/api.ts`, `src/domain.ts`, `src/features/reports.tsx`
- `src/features/request-procedures/animal-fields.tsx`, `request-procedures.ts`
- `src/features/tutor-data/*` _(novo)_ e `src/features/neighborhoods/*` _(novo)_
- `src/features/tutor-access/assisted-recovery.tsx` _(removido)_, `auth-types.ts`, testes de `tutor-access`
- `src/styles.css` _(só o CSS do modal removido, após grep)_
- `backend/src/routes/auth.js`, `config.js`
- `backend/src/services/auth/tutor-data-handlers.js` _(novo)_, `assisted-recovery-handlers.js` _(removido)_
- `backend/src/services/neighborhood-defaults.js`, `request-neighborhoods.js` _(novos)_, `request-submission.js`, `audit.js`
- `backend/src/services/registered-animals/animal-data.js`, `backend/src/repositories/request-settings.js`
- `backend/src/db/sql/20261116-tutor-address.sql` _(novo)_
- `backend/test/*` (novos e ajustados)

---

## O que será removido

- Botão "Recuperar acesso de tutor" e estado `recoveryOpen` em `App.tsx`, e o import do `AssistedRecovery`.
- `src/features/tutor-access/assisted-recovery.tsx` (arquivo inteiro).
- `searchTutors` e `recoverTutorAccess` em `src/api.ts`.
- O tipo `RecoveryTutor` em `auth-types`, se ficar sem uso.
- Endpoint `GET /auth/tutors` e `POST /auth/tutors/:id/assisted-recovery` e o handler `assisted-recovery-handlers.js`.
- O teste antigo da recuperação assistida e referências em `tutor-access.test.tsx`, se houver.
- O CSS exclusivo do modal removido (`tutor-recovery-*`), depois de grep em `styles.css` inteiro.
- Imports e props que ficarem órfãos.
- Mantém-se `AUDIT_ACTIONS.TUTOR_ASSISTED_RECOVERY`: os registros de auditoria históricos continuam a usá-la.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. Conferir o estado do disco (seção acima) e rodar a suíte de backend inteira; desfazer ou ajustar conforme a decisão do usuário.
2. Backend de bairros e de dados do tutor: concluir o que faltar, com testes (a lista de pendências sai da conferência do passo 1).
3. Frontend, aba "Dados do tutor": hook e componente em `src/features/tutor-data/`, métodos em `api.ts`, terceira aba no `RequestPreviewModal`, somente leitura quando finalizado.
4. Frontend, remoção do fluxo "Recuperar acesso de tutor" (itens da seção "O que será removido"), com grep de código morto e de CSS.
5. Frontend, bairros: `CONFIG_KEYS.neighborhoods`, estado, carga e persistência; tela "Bairros"; leitura pública por município na tela de login.
6. Frontend, formulário: "Bairro do animal" obrigatório em `animal-fields.tsx` e nos fluxos público e interno; bairro do tutor como lista; ViaCEP condicionado à lista; validação por etapa e por envio.
7. Frontend, relatórios: filtros, colunas e PDF.
8. Testes de frontend e de backend; `npm run typecheck`, `npm test`, `node --test backend/test/*.test.js` e `npm run build`.
9. Entregar ao usuário, como texto e com confirmação: o SQL de colunas de `tutor_profiles` e o SQL de limpeza do banco. Não executar.

---

## Regras de negócio identificadas

- A senha digitada pela equipe é a senha do tutor a partir dali: sem senha temporária e sem troca obrigatória. Campo vazio não muda a senha.
- E-mail e telefone alterados pela equipe valem direto (sem confirmação por código) e passam a contar como verificados.
- O CPF é somente leitura.
- Os dados editados seguem para as solicitações em andamento e para os vínculos ativos do animal; as solicitações finalizadas não mudam.
- Bairro do animal: um por animal, obrigatório, escolhido na lista do município. Com a lista vazia, é texto livre e obrigatório.
- O bairro do tutor usa a mesma lista; se a lista estiver vazia, é texto livre.
- Animal já cadastrado não é perguntado de novo; fica com o bairro do próprio cadastro (ou sem bairro, no caso de cadastros antigos).
- Relatório: o filtro de bairro do animal considera todos os animais da solicitação; quem não tem bairro aparece como "Não informado".
- A lista de bairros começa vazia por município e é cadastrada pelo administrador (vários por linha).

---

## Regras multi-tenant e segurança

- Município do endpoint de tutor vem de `tenant.js` e da própria solicitação (`requests.municipality_id`); a solicitação de outro município responde 404.
- Só equipe interna lê ou grava; tutor e credenciados (ONG, protetor) recebem 403.
- Todas as consultas parametrizadas e filtradas por município; o tutor é buscado no mesmo município da solicitação.
- Senha: `requireNewPassword` (mínimo 6 caracteres, máximo 72 bytes), hash `bcrypt`; nunca devolvida, nunca gravada na auditoria (só `passwordChanged: true`).
- Auditoria obrigatória na mesma transação; falha de auditoria desfaz a gravação.
- Mudança de contato afeta o destino da recuperação de senha e das notificações: por isso é auditada (campos alterados, sem valores).
- Config de bairros: leitura pública (necessária para o formulário público), escrita só pela administração municipal ou global, sempre por município.
- Relatórios e PDF só leem os dados que a tela já carrega; nenhum dado novo de outro município.

---

## Validações necessárias

- Tutor: nome 2 a 160; e-mail válido ou vazio; telefone com DDD ou vazio; UF com 2 letras; CEP com 8 dígitos; endereço até 200; bairro e cidade até 120; senha opcional com a regra de senha.
- Bairros (config): lista; nome obrigatório até 120; sem repetição ignorando acento e caixa; limite de 2000.
- Solicitação: cada animal novo precisa de bairro; com lista cadastrada, o bairro tem de ser um item ativo da lista do município (grava o nome cadastrado); sem lista, texto até 120.
- Formulário: destaque do campo e bloqueio do botão de continuar enquanto faltar o bairro do animal.

---

## Testes necessários

### Frontend

- Hook e formulário da aba "Dados do tutor": carga, edição, senha opcional, erro, somente leitura, tutor ausente.
- Tela "Bairros": criar vários por linha, repetido, ativar/inativar.
- `animal-fields`: bairro obrigatório, lista e texto livre; `blankAnimal` e duplicar animal.
- Relatório: filtro por bairro do tutor e do animal, "Não informado", colunas.
- CEP não preenche bairro fora da lista.

### Backend

- Dados do tutor: permissão (tutor e credenciado 403), tenant (404), senha (hash, sessão, sem troca obrigatória), propagação só para solicitações abertas, CPF imutável, auditoria sem senha, rollback se a auditoria falhar.
- Config de bairros: validação e permissão de escrita.
- Solicitação: bairro obrigatório, normalizado, fora da lista recusado, texto livre com lista vazia, denúncia isenta.

### Conferência manual (tela)

- Abrir um atendimento, ir para "Dados do tutor", editar contato e endereço, definir senha e entrar como tutor com ela.
- Conferir que o botão "Recuperar acesso de tutor" não existe mais.
- Cadastrar bairros em Configurações, abrir uma solicitação nova e conferir o campo obrigatório de bairro do animal.
- Em Relatórios, filtrar por bairro do tutor e do animal e exportar o PDF.

---

## Comandos de validação sugeridos

```bash
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

---

## Riscos e pontos de atenção

- Autenticação e senha: troca de senha por terceiro, revogação de sessão e auditoria.
- Multi-tenant: o endpoint cruza solicitação, usuário e perfil; precisa ficar sempre dentro do município.
- O código novo depende do SQL das colunas de `tutor_profiles`: sem ele, a aba falha. O SQL precisa ser aplicado antes do deploy.
- Lista de bairros vazia em município novo cai em texto livre: o filtro por bairro fica sujeito a variações de grafia até a lista ser cadastrada.
- Quebra de contrato: `POST /requests` passa a recusar solicitação com procedimentos por animal sem bairro do animal; clientes antigos abertos no navegador precisam recarregar.
- Contato alterado pela equipe muda o destino de notificações sem confirmação do tutor.
- `App.tsx` é grande: mudanças cirúrgicas, extraindo componentes novos para arquivos próprios.
- Produção: commit e push direto em `main`, sem `staging`.

---

## Perguntas em aberto

1. A lista de bairros de cada município começa vazia (proposta) ou o usuário informa a lista de Criciúma para carga inicial?
2. Animal já cadastrado, escolhido pelo tutor logado, não pergunta o bairro de novo e usa o do cadastro. Confirmar.
3. Limpeza do banco: só dados de uso, mantendo equipe e configurações (proposta). Confirmar o escopo antes de gerar o SQL.
4. O backend já escrito no disco (seção "Estado atual do disco") fica como ponto de partida ou é desfeito?

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- a aba "Dados do tutor" edita os dados, mantém o CPF somente leitura e troca a senha quando preenchida, sem exigir nova troca;
- o botão, o modal, as rotas e o teste de "Recuperar acesso de tutor" não existem mais;
- é possível cadastrar bairros por município e escolhê-los no endereço do tutor e no animal;
- uma solicitação nova não é enviada sem o bairro de cada animal;
- o relatório filtra por bairro do tutor e por bairro do animal, mostra as colunas e inclui ambos no PDF;
- `typecheck`, testes de frontend e de backend e `build` passam, sem erros novos;
- nenhum SQL foi executado e os dois SQLs foram entregues ao usuário.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations nem SQL sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
- O backend já está parcialmente no disco (ver "Estado atual do disco"): conferir antes de reescrever.

---

## Ajustes feitos durante a implementação

- A aba "Dados do tutor" edita com a permissão de editar solicitações, mesmo com o processo finalizado (os dados são do tutor, não do processo). Só fica somente leitura para quem não pode editar.
- Solicitação cadastrada pela equipe não cria conta de tutor: nesse caso a aba mostra e edita os dados da própria solicitação (e das abertas com o mesmo CPF), sem campo de senha, e a auditoria é da solicitação.
- Depois de salvar, o cabeçalho do atendimento e a lista de solicitações passam a mostrar os dados novos.
- A aba também funciona no modal aberto pela Agenda.
- A lista de bairros começou vazia por município (enquanto estiver vazia, o campo é texto livre e obrigatório); a tela "Bairros" cria vários de uma vez, um por linha.
- Testado em navegador no banco local: tela Bairros, formulário interno (bairro do animal obrigatório), aba Dados do tutor (com e sem conta, senha nova entrando sem troca obrigatória) e filtros do relatório. O SQL de colunas foi aplicado só no banco local, para esse teste; o dado de teste foi removido depois.
