# Plano de Implementação: Reduzir obrigatoriedades do cadastro e melhorar indicação visual de erro

## Origem

- Arquivo de especificação: sem `.md` externo — pedido direto do usuário no chat, refinado com respostas de esclarecimento
- Data do planejamento: 2026-07-28
- Classificação: `frontend-only`

## Resumo

Reduzir as obrigatoriedades de submissão do formulário de cadastro público (`NewRequest`, em `src/App.tsx`): nenhum campo de Tutor (nome, CPF, telefone, endereço) fica obrigatório. A validação de formato de telefone é removida por completo, junto com a etapa de confirmação por SMS. A mensagem de status "Endereço preenchido pelo CEP." é removida. Campos que continuam obrigatórios (Espécie, Sexo, Porte, Raça, Tipo de solicitação, Agenda, Documentos/aceite da declaração) passam a ter indicação visual tradicional de campo obrigatório: asterisco no rótulo, borda vermelha e mensagem de erro inline abaixo do campo quando vazios ao tentar enviar.

## Escopo

### Dentro do escopo

- Remover as checagens de tutor/CPF/telefone/SMS/endereço em `getRequestValidationIssues()` (~`src/App.tsx:3505`).
- Remover as mesmas checagens em `getStepIssues()` para `step === 0` (~`src/App.tsx:3538`) — a etapa Tutor deixa de bloquear avanço por qualquer campo vazio.
- Remover os checks `tutor`, `cpf`, `phone`, `sms`, `address`, `neighborhood`, `city`, `state` de `showInvalid()` (~`src/App.tsx:3584`).
- Remover a lógica de confirmação por SMS por completo: funções `sendSmsCode`/`confirmSmsCode`, states `smsCode`/`smsInput`/`smsConfirmed`/`smsStatus`, e o bloco JSX de verificação por SMS (~`src/App.tsx:4029-4044`).
- Manter o campo de telefone como texto livre opcional (mantendo a máscara de formatação visual, se já existir, mas sem validação de "celular válido" bloqueante).
- Remover a exibição da mensagem `cepStatus` ("Endereço preenchido pelo CEP.", "Buscando endereço...", "CEP não encontrado.") do JSX (~`src/App.tsx:4060`), mantendo a busca automática de endereço via CEP (ViaCEP) funcionando normalmente — só sem o texto de status visível.
- Adicionar indicação visual "tradicional" nos campos que continuam obrigatórios: asterisco (`*`) no rótulo/`data-label`, e mensagem de erro inline (ex.: "Campo obrigatório") abaixo do campo quando `showInvalid(...)` for `true`, reaproveitando o padrão `.access-field.is-invalid` já existente no CSS.
- Verificar e ajustar, se necessário, outros pontos do código que dependem de `smsConfirmed` (ex.: `canManagePublicAnimalFlows`, `skipTutorStep`) para não quebrar comportamento de outras roles/fluxos ao remover o state.
- Validar as 3 variantes do formulário (público, interno simples, interno completo) para garantir consistência visual e funcional após a mudança.

### Fora do escopo

- Qualquer mudança nas obrigatoriedades de Animal (Espécie, Sexo, Porte, Raça), Agenda ou Documentos — continuam obrigatórios como estão hoje, só ganham o novo tratamento visual.
- Qualquer mudança na lógica de busca de CEP em si (ViaCEP) — só a mensagem de status visível é removida, a funcionalidade de autopreenchimento permanece.
- Qualquer mudança de backend, endpoint ou schema de banco — o campo de telefone continua existindo e sendo salvo, só deixa de ser obrigatório/validado no frontend.
- Qualquer mudança em fluxos internos (admin) que não usem os mesmos campos de tutor do formulário público, além do necessário para não quebrar `smsConfirmed`/`skipTutorStep`.
- O trabalho pendente de outra sessão paralela em `src/App.tsx`/`src/styles.css` — não tocar.

## Leitura de contexto

- `/AGENT.md` (raiz) — mesmo contexto de planos anteriores nesta sessão: template genérico staging/PR; prática real do projeto é commit direto em `main`.
- `frontend/AGENT.md` / `backend/AGENT.md` — não existem neste repo.
- Investigação direta em `src/App.tsx` (componente `NewRequest`):
  - `getRequestValidationIssues()` (~3505-3536): valida tutor, CPF, telefone, SMS, endereço (dentro do bloco `if (!internalSimple && typeStepTutor)`), aceite da declaração, agenda, tipo, animal (espécie/sexo/porte/raça), documentos.
  - `getStepIssues()` (~3538-3582): mesma lógica por etapa, usada para bloquear navegação (`navigateToStep`).
  - `showInvalid(field)` (~3584-3612): mapa de campo → booleano de invalidez, usado para aplicar `.is-invalid` nos `access-field`.
  - Bloco JSX da etapa Tutor (~4000-4074): campos de nome, CPF, CadÚnico, email, telefone (com botão "Verificar" SMS), bloco de confirmação de código SMS (~4035-4043), endereço via CEP com `cepStatus` (~4060).
  - `lookupCep()` (~3636-3665+): busca ViaCEP e seta `cepStatus` em cada etapa (buscando/erro/sucesso).
  - `smsConfirmed` também é lido em outros pontos do arquivo (a confirmar com grep na implementação — ex.: `canManagePublicAnimalFlows`, `skipTutorStep`) — precisa de atenção para não quebrar esses usos.
  - CSS existente: `.access-field.is-invalid input/textarea` (~`src/styles.css:1489-1498`) já aplica borda vermelha/fundo — será reaproveitado como base, adicionando asterisco e mensagem de erro.

## Impacto por área

### Frontend

- **`src/App.tsx`**: alterações em `getRequestValidationIssues`, `getStepIssues`, `showInvalid`, remoção de `sendSmsCode`/`confirmSmsCode`/states de SMS, remoção do bloco JSX de verificação SMS, remoção da exibição de `cepStatus`, adição de asterisco/mensagem de erro nos campos obrigatórios restantes (Tipo, Espécie, Sexo, Porte, Raça, Agenda, Documentos/aceite).
- **`src/styles.css`**: possível novo estilo para o asterisco (`*`) no rótulo de campo obrigatório e para a mensagem de erro inline (reaproveitando paleta de erro já existente, ex.: `#ef4444`/`#fff1f2`).
- Sem impacto em hooks de rede, React Query — o campo de telefone continua sendo enviado normalmente ao backend, só sem validação bloqueante no frontend.
- Sem mudança de contrato com o backend (mesmos campos, mesma request).

### Backend

Sem impacto esperado — nenhuma rota, validação de servidor ou schema é alterado; o backend continua recebendo os mesmos campos (agora possivelmente vazios/opcionais no payload).

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx` — `NewRequest` (validações, remoção de SMS, remoção de `cepStatus`, indicação visual de obrigatório).
- `src/styles.css` — estilo de asterisco de campo obrigatório e mensagem de erro inline.

## Estratégia de implementação

1. Reconfirmar com grep as linhas atuais de todas as funções/blocos listados (o arquivo desloca com frequência por edições paralelas de outra sessão).
2. Ajustar `getRequestValidationIssues()`: remover checagens de tutor/CPF/telefone/SMS/endereço, mantendo o restante (aceite, agenda, animal, tipo, documentos).
3. Ajustar `getStepIssues()` para `step === 0`: retornar `[]` sempre (nenhuma pendência bloqueante nessa etapa), removendo os campos correspondentes.
4. Ajustar `showInvalid()`: remover/zerar os checks `tutor`, `cpf`, `phone`, `sms`, `address`, `neighborhood`, `city`, `state`.
5. Localizar todos os usos de `smsConfirmed`, `smsCode`, `smsInput`, `smsStatus`, `sendSmsCode`, `confirmSmsCode` no arquivo (grep) e remover a lógica de SMS por completo, ajustando com cuidado os pontos onde `smsConfirmed` é usado como guarda de outra lógica (ex.: `canManagePublicAnimalFlows(currentUser.role) || skipTutorStep`), preservando o comportamento para roles que já puलam esse fluxo.
6. Remover o bloco JSX de verificação SMS (botão "Verificar", input de código, botão "Confirmar", mensagem de status).
7. Remover a exibição de `cepStatus` no JSX; avaliar se `lookupCep`/state `cepStatus` continuam necessários internamente (mesmo sem exibição) ou se podem ser simplificados — sem remover a funcionalidade de autopreenchimento via CEP.
8. Adicionar asterisco (`*`) nos rótulos/`data-label` dos campos que continuam obrigatórios (Tipo de solicitação, Espécie, Sexo, Porte, Raça — quando aplicável no fluxo — Agenda, Documentos/aceite da declaração), nas 3 variantes do formulário onde esses campos aparecem.
9. Adicionar mensagem de erro inline (ex.: "Campo obrigatório") abaixo de cada campo obrigatório quando `showInvalid(...)` for `true`, reaproveitando o padrão visual já existente de `.is-invalid`.
10. Rodar grep de `sms`/`cepStatus` no arquivo inteiro para confirmar que não sobrou resíduo (função morta, state não usado, JSX órfão).
11. Rodar `typecheck` e `build`.
12. Validar visualmente (ou pela leitura do JSX resultante) que a etapa Tutor pode ser avançada/submetida vazia, que os campos obrigatórios restantes mostram asterisco + erro corretamente, e que as 3 variantes do formulário continuam consistentes.

## Regras de negócio identificadas

- Cadastro de solicitação de castração/procedimento pode ser enviado sem dados de contato do tutor (nome, CPF, telefone, endereço todos opcionais).
- Continuam obrigatórios: tipo de solicitação, dados do(s) animal(is) (espécie, sexo, porte, raça definida/indefinida), data de agenda com vaga disponível, documentos aprovados e aceite da declaração de responsabilidade.
- Sem validação de formato de telefone em nenhum ponto do fluxo de cadastro público.
- Sem etapa de confirmação por SMS no fluxo de cadastro público.

## Regras multi-tenant e segurança

Sem impacto — não há dado de tenant/permissão envolvido; é uma mudança de regra de validação de formulário de um fluxo público já existente. Nenhuma alteração de autenticação/autorização.

## Validações necessárias

- Confirmar que o formulário pode ser enviado com Tutor totalmente vazio (nome, CPF, telefone, endereço).
- Confirmar que os campos de Animal, Agenda e Documentos/aceite continuam bloqueando o envio quando vazios, com asterisco e mensagem de erro visíveis.
- Confirmar que a busca automática de CEP continua preenchendo endereço/bairro/cidade/UF, mesmo sem a mensagem de status visível.
- Confirmar que não sobrou nenhuma referência morta a SMS (`smsCode`, `smsInput`, `smsConfirmed`, `smsStatus`, `sendSmsCode`, `confirmSmsCode`) em nenhum lugar do arquivo.
- Confirmar que `skipTutorStep`/`canManagePublicAnimalFlows` continuam funcionando corretamente para as roles que já dependiam dessa lógica.
- Confirmar consistência visual nas 3 variantes do formulário (público, interno simples, interno completo).

## Testes necessários

### Frontend

Não há suíte de testes de componente identificada para `NewRequest`; validação será manual/visual + `typecheck`/`build`, como já é o padrão desta sessão.

### Backend

Sem impacto esperado.

### E2E

Não aplicável.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
npm run lint
```

## Riscos e pontos de atenção

- Remover a validação de telefone/SMS significa que cadastros podem ser enviados sem nenhum contato válido do tutor — decisão de produto já confirmada pelo usuário, mas com implicação operacional (equipe pode não conseguir contatar o tutor depois); registrado aqui para transparência, não bloqueia a implementação.
- `smsConfirmed` pode ser usado como guarda em mais de um lugar do arquivo (ex.: `canManagePublicAnimalFlows(currentUser.role) || skipTutorStep`) — remover o state exige cuidado para não alterar comportamento de roles internas que dependem dessa lógica; a skill `implementar` deve fazer grep completo antes de remover.
- Mudança visual de "obrigatório" precisa ser aplicada de forma consistente nas 3 variantes do formulário (público, interno simples, interno completo), sem quebrar layout existente em nenhuma delas.
- `App.tsx` está sujeito a edições paralelas de outra sessão — isolar as próprias mudanças (stash/patch parcial) antes de qualquer commit via skill `finalizar`.
- Push é direto em `main`, sem `staging` — qualquer regressão no fluxo de cadastro público é imediatamente visível em produção.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — escopo já confirmado pelo usuário nas respostas de esclarecimento (CPF também opcional; SMS removido por completo; estilo de erro = asterisco + borda vermelha + mensagem de texto).

## Critérios de aceite do plano

- Nenhum campo de Tutor (nome, CPF, telefone, endereço) bloqueia o avanço de etapa ou a submissão do formulário.
- Nenhuma validação de formato de telefone ou etapa de SMS existe mais no fluxo.
- Mensagem "Endereço preenchido pelo CEP." (e variações de status do CEP) não aparece mais, mas o autopreenchimento via CEP continua funcionando.
- Campos que continuam obrigatórios mostram asterisco no rótulo e, quando vazios após tentativa de envio, borda vermelha + mensagem de erro inline.
- Nenhum código morto relacionado a SMS permanece no arquivo.
- `typecheck` e `build` passam sem novos erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não executar migrations (não aplicável).
- Reconfirmar linhas atuais com grep antes de editar.
- Fazer grep completo de `sms`/`smsConfirmed` no arquivo inteiro antes de remover, para não quebrar `canManagePublicAnimalFlows`/`skipTutorStep` ou qualquer outro uso não mapeado neste plano.
- Isolar as próprias edições de qualquer trabalho não commitado de outra sessão presente no mesmo arquivo (técnica de stash/patch parcial já usada nesta sessão), antes de qualquer commit via skill `finalizar`.
- Validar as 3 variantes do formulário antes de considerar concluído.
- Seguir a regra de comunicação silenciosa da skill `implementar`.
