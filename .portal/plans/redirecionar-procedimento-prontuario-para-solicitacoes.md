# Plano de Implementação: Redirecionar "Solicitar procedimento" do Prontuário para o wizard de Solicitações

## Origem

- Arquivo de especificação: nenhum — pedido direto do usuário após observar que "Solicitar procedimento" via Prontuário deveria reaproveitar o mesmo fluxo de cadastro de "Solicitações", em vez de ter modais próprios.
- Data do planejamento: 2026-07-24
- Classificação: `frontend-only`

## Resumo

Hoje existem 2 implementações duplicadas de "Solicitar procedimento" dentro da tela pública "Prontuário": uma no card da landing (`ValidationKeyConsultation`, `activeServiceModal==="procedure"`) e outra dentro do `AnimalRecordPanel` (`procedureOpen`). Ambas chamam `api.createRequest(...)` diretamente com um payload reduzido — **sem agendamento (Agenda) e sem documentos obrigatórios (Documentos)** — diferente de uma solicitação criada via o wizard `NewRequest` (Animal → Tutor → Agenda → Documentos). Isso é uma lacuna funcional real, não só duplicação de UI.

A solução: eliminar os 2 modais customizados e redirecionar para o mesmo wizard `NewRequest` usado por "Cadastro por Solicitações", pré-preenchendo o que já é conhecido do tutor (e do animal, quando disponível) para evitar redigitação. A arquitetura já está parcialmente pronta para isso — `PublicCastrationForm` já alterna entre Prontuário e Solicitações como telas irmãs via state `screen`, e existe uma função `goToStart()` (`setScreen("formulario")`) já escrita mas nunca chamada em lugar nenhum.

## Escopo

### Dentro do escopo

1. Adicionar um callback (`onRequestProcedure` ou nome equivalente) que `PublicCastrationForm` passa para `ValidationKeyConsultation`, ligando à função `goToStart()` hoje morta (`src/App.tsx:2598`) — troca `screen` para `"formulario"`.
2. Ao acionar o redirecionamento, montar um objeto `currentUser`-shaped a partir do tutor já identificado:
   - Vindo do card da landing: usar o resultado de `handleServiceIdentify`/`svcFoundTutor` (hoje derivado de `api.consultRequestsByCredentials`, que retorna a última solicitação do CPF — pode conter só `{cpf}` se o tutor nunca solicitou antes).
   - Vindo do `AnimalRecordPanel`: usar `record.tutor` (retornado por `api.consultAnimalByMicrochip`, tipicamente mais completo: nome, email, telefone, endereço).
3. Passar esse objeto como `currentUser` para o `NewRequest` renderizado por `PublicCastrationForm` — reaproveitando o mecanismo de pré-preenchimento **já existente** no estado inicial de `requestData` (`src/App.tsx:2984-3004`), sem criar prop nova de pré-preenchimento.
4. Quando vier do `AnimalRecordPanel` (animal já conhecido), pré-preencher também os campos do step Animal que se sobrepõem ao registro do animal (nome/espécie/sexo/porte/microchip) — campos de saúde/cuidados (vermifugado, vacinas, etc.) continuam em branco, pois não existem no registro.
5. Manter o "gate" de identificação (CPF + chave de validação, ou microchip) exatamente como está hoje — a única mudança é o que acontece DEPOIS de identificar: em vez de abrir um formulário reduzido, redireciona para o wizard completo já com os dados encontrados.
6. **Manter a confirmação por SMS obrigatória** no wizard, mesmo com o tutor já identificado por CPF+chave — decisão confirmada: CPF+chave prova "conhecer os dados", não "ter acesso ao celular cadastrado agora"; o SMS é o que garante isso.
7. Remover os 2 modais duplicados de "Solicitar procedimento":
   - Landing card: bloco `isProc` dentro do `activeServiceModal` (`src/App.tsx`, JSX do `svc-modal` para `procedure`), função `submitServiceProcedure`, state `svcProcForm`.
   - `AnimalRecordPanel`: bloco `procedureOpen`, função `submitProcedure`, state `procedureForm`/`procedureAnimalMode`/`procedureOtherMicrochip`/`procedureOtherAnimal`/`procedureLookingUp`/`procedureNewAnimal`.
8. Remover CSS que fica morto só por causa desta remoção (ex.: partes de `.svc-grid-4`/`.svc-mode-btn` se ficarem sem nenhum outro uso, `.pac-animal-options`/`.pac-animal-option`/`.pac-lookup-row`/`.pac-found-animal` se exclusivos do fluxo de procedimento) — confirmar exclusividade via grep antes de remover cada classe, já que algumas (`.pac-tutor-banner`, por exemplo) podem continuar em uso por "Troca de tutor"/"Registrar óbito".
9. Atualizar o card "Solicitar procedimento" da landing (`.cons-service-card`) para refletir que ele agora abre o gate de identificação e, ao identificar, navega para o wizard (texto do subtítulo pode continuar igual, já que o comportamento do usuário final — identificar e depois preencher — não muda conceitualmente).

### Fora do escopo

- "Troca de tutor" e "Registrar óbito" continuam com seus próprios modais (`.svc-modal`/`.animal-action-modal`) — não têm equivalente no wizard de Solicitações, pois coletam dados completamente diferentes (novo tutor; data/causa de óbito).
- Qualquer mudança em `api.createRequest`, backend, ou na lógica interna das etapas Agenda/Documentos do wizard.
- Tela de sucesso do wizard (protocolo + chave de validação) e `onBack` — reaproveitados como já funcionam hoje, sem criar um "voltar pro Prontuário" separado.
- Alinhamento visual adicional (já feito em rodada anterior, commit `e12bb90`).

## Leitura de contexto

- `/AGENT.md` — lido em rodada anterior desta sessão; nota já registrada sobre a seção de git flow não corresponder à prática real do projeto (commit direto em `main`).
- `src/App.tsx`:
  - `PublicCastrationForm` (L2571-2694): componente pai com state `screen` ("consulta"|"formulario"), já alterna entre `ValidationKeyConsultation` e `NewRequest`; função `goToStart()` (L2598) definida mas nunca chamada.
  - `ValidationKeyConsultation` (L1151-1711): landing + modais de serviço; `submitServiceProcedure` (L1327-1367), `svcProcForm`, `svcFoundTutor`.
  - `AnimalRecordPanel` (L8932+): `procedureOpen`, `submitProcedure`, `procedureForm` e variantes.
  - `NewRequest` (L2945+): `requestData` inicial (L2984-3004) já deriva campos de `currentUser`; `skipTutorStep`/`smsConfirmed` (L2983, L3038).

## Impacto por área

### Frontend

- `src/App.tsx`: novo callback de navegação `ValidationKeyConsultation` → `PublicCastrationForm`; construção do objeto `currentUser`-shaped a partir do tutor/animal identificado; remoção dos 2 modais de procedimento e seus states/funções associados.
- `src/styles.css`: remoção do CSS que ficar comprovadamente morto após a remoção dos modais (verificar exclusividade classe a classe antes).

### Backend

Sem impacto esperado — `api.createRequest` já existe e já é usado pelo `NewRequest`.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/styles.css`

## Estratégia de implementação

1. Adicionar prop de callback em `ValidationKeyConsultation` e conectar ao `goToStart()`/`screen` de `PublicCastrationForm`.
2. Implementar a construção do objeto `currentUser`-shaped a partir do tutor (landing card) e do `record.tutor`/`record.animal` (AnimalRecordPanel).
3. Passar esse objeto pro `NewRequest` via `PublicCastrationForm` quando o redirecionamento for acionado a partir do Prontuário (vs. o `GUEST_USER` vazio usado quando entra direto por "Solicitações").
4. Implementar pré-preenchimento do primeiro animal (`animals[0]`) quando vier do `AnimalRecordPanel`, reaproveitando os campos que já existem no registro.
5. Remover o modal de procedimento do landing card (`isProc` dentro de `activeServiceModal`) e sua função/state associados.
6. Remover o modal de procedimento do `AnimalRecordPanel` (`procedureOpen`) e sua função/state associados.
7. Grep de cada classe/função removida no arquivo inteiro para confirmar que não sobrou referência morta nem CSS órfão sendo removido por engano (que ainda seja usado por Troca de tutor/Registrar óbito).
8. `npm run typecheck` e `npm run build`.
9. Verificação visual/funcional via Chrome headless/CDP: fluxo completo landing → identificar tutor → wizard pré-preenchido → completar Animal/Agenda/Documentos → sucesso; e o mesmo partindo do `AnimalRecordPanel` (animal + tutor pré-preenchidos). Testar também o caso de tutor sem histórico prévio (pré-preenchimento só com CPF).

## Regras de negócio identificadas

- Solicitações de procedimento criadas via Prontuário devem passar pelo mesmo fluxo completo (com agendamento e documentos) que solicitações criadas via "Solicitações" direto — não deve mais existir um caminho que gera solicitação incompleta.
- Confirmação por SMS continua obrigatória mesmo para tutor já identificado por CPF+chave de validação (decisão confirmada).

## Regras multi-tenant e segurança

- `municipalityId` já é propagado corretamente hoje entre `ValidationKeyConsultation`/`AnimalRecordPanel` e `PublicCastrationForm` — manter essa propagação ao construir o objeto `currentUser`-shaped, para o wizard continuar operando sob o município correto.
- Nenhuma mudança em autenticação/autorização — o "gate" de identificação (CPF+chave/microchip) continua sendo a única prova de identidade antes de qualquer dado ser exibido ou pré-preenchido.

## Validações necessárias

- Confirmar que o pré-preenchimento nunca insere dados de um tutor/animal diferente do que foi legitimamente identificado (sem vazamento entre CPFs/microchips).
- Confirmar que a etapa de confirmação por SMS continua funcionando ponta a ponta mesmo com os campos de tutor pré-preenchidos.
- Confirmar que o caso "tutor sem solicitações anteriores" (pré-preenchimento pobre, só CPF) não quebra o wizard — os demais campos devem simplesmente ficar em branco e editáveis normalmente.

## Testes necessários

### Frontend

Sem testes automatizados novos (projeto não tem suíte configurada).

### E2E

- CDP/headless Chrome: fluxo completo a partir do card da landing (com e sem histórico prévio do tutor) e a partir do `AnimalRecordPanel`, incluindo confirmação por SMS e conclusão do wizard (Agenda + Documentos).

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Push para `origin/main` segue bloqueado por permissão (403) nesta sessão — commits ficam pendentes até o usuário resolver o acesso.
- Pré-preenchimento "pobre" (só CPF) quando o tutor nunca fez solicitação antes pelo card da landing — comportamento esperado, não é bug, mas precisa ser testado explicitamente na verificação visual.
- Ao remover CSS, checar cuidadosamente se alguma classe `.pac-*` continua em uso por "Troca de tutor"/"Registrar óbito" antes de remover — não presumir que tudo prefixado `.pac-` é exclusivo de procedimento.

## Perguntas em aberto

Nenhuma — as 3 decisões (SMS obrigatório mantido, pré-preenchimento do Animal sem pular o step, escopo restrito só a "Solicitar procedimento") foram confirmadas antes de salvar este plano.

## Critérios de aceite do plano

- "Solicitar procedimento" (landing card e `AnimalRecordPanel`) redireciona para o wizard `NewRequest` completo, com tutor (e animal, quando aplicável) pré-preenchidos.
- Solicitações criadas por esse caminho passam pelas etapas Agenda e Documentos como qualquer outra solicitação.
- "Troca de tutor" e "Registrar óbito" continuam funcionando exatamente como antes, sem regressão.
- Nenhum código morto/CSS órfão deixado para trás pela remoção dos modais antigos.
- `npm run typecheck` e `npm run build` passam sem erros novos.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Antes de remover qualquer classe CSS prefixada `.pac-`, confirmar via grep se ela também é usada pelos modais de Troca de tutor/Registrar óbito (que permanecem).
- Não alterar a lógica de identificação (CPF+chave/microchip) em si — só o que acontece depois dela.
- Não remover a exigência de confirmação por SMS no wizard.
- Não commitar/dar push — isso é responsabilidade da skill `finalizar`, só quando solicitado.
