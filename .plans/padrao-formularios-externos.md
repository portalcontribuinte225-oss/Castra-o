# Plano de Implementação: padrão dos formulários externos e endereço no credenciamento

## Origem

- Arquivo de especificação: conversa de 2026-11-22 (prints das telas de Credenciamento e da etapa Você)
- Data do planejamento: `2026-11-22`
- Classificação: `frontend + backend + database`

---

## Resumo

Padronizar os formulários da parte externa do sistema:

- o asterisco de obrigatório vai no título do campo, nunca no texto de exemplo;
- o campo obrigatório que falta fica em vermelho, com o aviso embaixo, como na solicitação de procedimento;
- o botão principal fica à direita.

No Credenciamento (ONG e protetor), os campos passam a ficar lado a lado, em cartões como na etapa Você, e entra uma seção de Endereço com os mesmos campos do tutor. O endereço é gravado em colunas novas da tabela `access_requests`.

---

## Escopo

### Dentro do escopo

- **Asterisco no título**, com o padrão que já existe: a classe `required-asterisk`, usada por `OptionCardGroup`, `ScrollChecklist` e `CompactChoiceField`. Vale para:
  - solicitação de procedimento;
  - credenciamento;
  - denúncia;
  - acompanhar solicitação;
  - acessar minha solicitação e criar senha;
  - interesse de adoção.
- **Vermelho e aviso embaixo** no campo obrigatório que falta, após a primeira tentativa de envio, no credenciamento, na denúncia e no interesse de adoção.
- **Credenciamento:**
  - cartões Responsável, Endereço e Contato;
  - campos lado a lado;
  - seção de Endereço;
  - botão à direita;
  - formulário fora do `App.tsx`.
- **Endereço do credenciamento** gravado no banco e mostrado na tela interna de Credenciamento.
- **Botão principal à direita** nos formulários das páginas externas.

### Fora do escopo

- Modais de acesso (Entrar, Recuperar acesso, Trocar senha e Perfil do tutor): todos os campos são obrigatórios e os botões ocupam a largura toda. Ficam como estão (decisão de 2026-11-22).
- Telas internas, inclusive a aba "Dados do tutor" do modal do processo.
- Mudar a regra de quais campos são obrigatórios: os obrigatórios continuam os mesmos de hoje.

---

## Leitura de contexto

- `/AGENT.md`
- `src/App.tsx`: `PublicAccessRequestInline` (≈ linhas 2163-2290), formulário de interesse de adoção (≈ 1728-1750) e validação das etapas (`getStepIssues`/`showInvalid`, ≈ 2870-2920)
- `src/features/request-steps/request-text-field.tsx`, `request-select-field.tsx`, `request-form-layout.tsx`
- `src/features/tutor-access/tutor-step-fields.tsx`, `registration-contact-fields.tsx`
- `src/features/neighborhoods/neighborhood-field.tsx`
- `src/components/option-card-group.tsx`, `src/components/ui.tsx` (`CompactChoiceField`), `.required-asterisk` em `src/styles.css`
- `src/features/complaint/public-report-panel.tsx`
- `src/features/request-tracking/request-tracking.tsx`, `src/features/request-access/request-access.tsx`
- `src/features/animal-services/cep-lookup.ts`
- `src/features/accessRequests.tsx` (tela interna)
- `backend/src/routes/accessRequests.js`, `backend/src/db/migrations.js` (tabela `access_requests`), `backend/src/db/sql/20261116-tutor-address.sql` (modelo de SQL)

---

## Impacto por área

### Frontend

**Campos (base do padrão)**
- `RequestTextField` e `RequestSelectField`: quando recebem `required`, mostram `<span className="required-asterisk">*</span>` depois do título, como `OptionCardGroup`. O `aria-label` continua sem o asterisco.
- `NeighborhoodField`: deixa de montar o título como `` `${label} *` `` e repassa `required`.
- `RegistrationContactFields`: o título "Celular \*" vira "Celular" com `required`. "E-mail (opcional)" continua.

**Solicitação de procedimento**
- Etapa Você: Nome completo e CPF recebem `required` quando a identificação do tutor é exigida (`requiresTutorIdentity`).
- O `Continuar` já fica à direita (`tw:ml-auto`), sem mudança.

**Endereço reutilizável**
- Novo componente `src/features/address/address-fields.tsx`, extraído do cartão Endereço de `TutorStepFields`:
  - CEP / Número / UF;
  - Endereço;
  - Bairro (`NeighborhoodField` com a lista do município) / Cidade;
  - classes atuais `address-lookup-grid` e `address-city-grid`.
- O componente recebe os valores e callbacks. A consulta do CEP fica com quem o usa.
- `TutorStepFields` passa a usá-lo. A linha "Localização registrada" continua no cartão do tutor.

**Credenciamento**
- `PublicAccessRequestInline` sai do `App.tsx` para `src/features/access-request/public-access-request-form.tsx`.
- **Cartão Responsável** (`two-column-fields`): Organização | Responsável \*, e CPF / CNPJ.
- **Cartão Endereço:** `AddressFields`. O CEP preenche o endereço com `lookupCep` de `cep-lookup.ts`. A lista de bairros do município selecionado chega por prop, a mesma da solicitação.
- **Cartão Contato** (`two-column-fields`): E-mail \* | Telefone.
- Textos de exemplo sem asterisco. Ex.: "Nome completo do responsável", "E-mail para contato".
- Validação com campos em vermelho e aviso embaixo após a primeira tentativa:
  - Responsável obrigatório;
  - E-mail obrigatório e válido;
  - Telefone, CPF/CNPJ, CEP e UF válidos quando preenchidos.
- O formulário usa `noValidate`.
- Botão "Enviar solicitação" à direita.

**Denúncia** (`public-report-panel.tsx`)
- `ReportField` dá lugar ao `RequestTextField`, com `required` e `error`. Ficam com asterisco Nome, CPF, Telefone e Descrição.
- Os campos com problema ficam em vermelho com o aviso embaixo. A mensagem geral do fim é mantida só para falhas do envio.
- Botão "Enviar denúncia" à direita (largura toda no celular, como hoje).

**Acompanhar solicitação e Acessar minha solicitação**
- Asterisco em Protocolo e em E-mail ou telefone / CPF.
- Botões principais ("Enviar código", "Criar minha senha", "Entrar") à direita. Nos grupos de botões (Confirmar / Reenviar / Corrigir dados), o grupo inteiro fica à direita, sem mudar a ordem.

**Interesse de adoção** (`App.tsx`)
- Nome completo \* e WhatsApp \* com `RequestTextField`, vermelho e aviso embaixo.
- `noValidate`.
- Botão "Enviar interesse" à direita.

**Tela interna de Credenciamento** (`accessRequests.tsx`)
- No detalhe, mostrar o Endereço (endereço, número, bairro, CEP, cidade/UF) no lugar de "Cidade / UF".

### Backend

- `backend/src/routes/accessRequests.js`, no `POST /`, grava `cep`, `address`, `address_number` e `neighborhood` junto com `city` e `state`:
  - todos opcionais e sem espaços nas pontas;
  - limites de tamanho iguais aos do tutor;
  - CEP com 8 dígitos e UF com 2 letras quando preenchidos;
  - campo inválido responde 400 com mensagem clara.
- A listagem interna já devolve `SELECT *`, então as colunas novas chegam à tela sem mudança na leitura.

### Banco de dados

- Novo `backend/src/db/sql/20261122-access-request-address.sql`, aplicado à mão **antes** do deploy:
  ```sql
  -- Explicit application only; never run through the legacy boot migration file.
  -- Apply BEFORE deploying the credentialing address: the route writes these columns.
  BEGIN;
  ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS cep TEXT;
  ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS address TEXT;
  ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS address_number TEXT;
  ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS neighborhood TEXT;
  COMMIT;
  ```
- Sem mudança em `migrations.js` nem em SQL antigo.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

- Ordem:
  1. Aplicar o SQL.
  2. Fazer o deploy.
- Sem o SQL, o envio de credenciamento falha (erro 500).

---

## Arquivos provavelmente afetados

- `src/features/request-steps/request-text-field.tsx`, `request-select-field.tsx`
- `src/features/neighborhoods/neighborhood-field.tsx`
- `src/features/tutor-access/registration-contact-fields.tsx`, `tutor-step-fields.tsx`
- `src/features/address/address-fields.tsx` (novo)
- `src/features/access-request/public-access-request-form.tsx` (novo)
- `src/App.tsx` _(só os trechos do credenciamento, do interesse de adoção e do `required` da etapa Você)_
- `src/features/complaint/public-report-panel.tsx`
- `src/features/request-tracking/request-tracking.tsx`
- `src/features/request-access/request-access.tsx`
- `src/features/accessRequests.tsx`
- `backend/src/routes/accessRequests.js`
- `backend/src/db/sql/20261122-access-request-address.sql` (novo)
- Testes: `tutor-step-fields.test.tsx`, `request-tracking.test.tsx`, `request-access.test.tsx`, `option-card-group.test.tsx` (referência do padrão), testes novos do formulário de credenciamento e da denúncia, `backend/test/access-request-security.test.js`

---

## O que será removido

- O asterisco escrito no texto de exemplo do credenciamento: "Nome completo do responsável \*" e "Email para contato \*".
- A montagem `` `${label} *` `` em `NeighborhoodField` e o título "Celular \*" em `RegistrationContactFields`.
- Os campos Cidade e UF soltos do credenciamento. Passam para dentro do Endereço.
- `PublicAccessRequestInline` do `App.tsx`, substituído pelo arquivo novo, e os imports que ficarem sem uso.
- O `ReportField` local da denúncia, substituído pelo `RequestTextField`.
- O bloco de endereço duplicado dentro de `TutorStepFields`, substituído por `AddressFields`.
- O `required` nativo nos formulários que passam a validar pelo app (credenciamento e interesse de adoção), trocado por `noValidate` e pela validação com campo em vermelho.
- `tw:justify-self-start` dos botões principais das telas citadas.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. **Base:** `required` com asterisco em `RequestTextField` e `RequestSelectField`. Ajustar `NeighborhoodField` e `RegistrationContactFields`.
2. **Etapa Você:** extrair `AddressFields` de `TutorStepFields` e passar `required` em Nome completo e CPF.
3. **Back e banco:** SQL novo, sem aplicar, e gravação/validação do endereço em `POST /access-requests`.
4. **Credenciamento:** arquivo novo com os cartões Responsável, Endereço e Contato, validação com campo em vermelho e botão à direita. Remover do `App.tsx` e passar a lista de bairros.
5. **Denúncia:** `RequestTextField` com `required` e `error`, e botão à direita.
6. **Acompanhar e Acessar solicitação:** asteriscos e botões à direita.
7. **Interesse de adoção:** campos, validação e botão à direita.
8. **Tela interna de Credenciamento:** mostrar o endereço.
9. **Testes:** atualizar e criar, com valores falsos.
10. Validar uma vez ao final.

---

## Regras de negócio identificadas

- Obrigatórios (sem mudança de regra):
  - Etapa Você: Nome completo e CPF (quando a identificação é exigida) e Celular (no cadastro).
  - Credenciamento: Responsável e E-mail.
  - Denúncia: Nome, CPF, Telefone e Descrição.
  - Acompanhar: Protocolo e E-mail ou telefone.
  - Acessar: Protocolo e CPF.
  - Interesse de adoção: Nome completo e WhatsApp.
- Endereço do credenciamento **opcional**, como o do tutor (decisão de 2026-11-22).
- O asterisco aparece só no título. O texto de exemplo nunca tem asterisco. Opcionais levam "(opcional)" quando o formulário mistura os dois tipos, como já acontece no E-mail.
- O vermelho aparece depois da primeira tentativa de envio, no campo, com o aviso embaixo.
- O botão principal fica à direita (largura toda no celular). Em grupos de botões, o grupo inteiro fica à direita.

---

## Regras multi-tenant e segurança

- O pedido de credenciamento continua preso ao município da requisição (`pickMunicipalityId`), e a listagem interna continua filtrada por município.
- A lista de bairros vem do município selecionado na página pública, a mesma da solicitação.
- Endereço sem dado sensível novo. Validação no back com limites de tamanho e sem interpolar SQL.

---

## Validações necessárias

- **Front, credenciamento:**
  - Responsável não vazio;
  - E-mail válido;
  - Telefone válido quando preenchido;
  - CPF/CNPJ válido quando numérico;
  - CEP com 8 dígitos e UF com 2 letras quando preenchidos.
- **Front, denúncia:** as regras atuais de `complaintError`, agora por campo.
- **Back:** as mesmas regras do front para o credenciamento, mais limites de tamanho.

---

## Testes necessários

### Frontend

- `RequestTextField` e `RequestSelectField`: com `required`, mostram `required-asterisk` no título, e o `aria-label` fica sem asterisco.
- `NeighborhoodField` e contato: sem asterisco no texto do título nem no texto de exemplo.
- Etapa Você: Nome completo e CPF com asterisco quando a identificação é exigida.
- Credenciamento:
  - três cartões;
  - endereço com os mesmos campos do tutor;
  - o CEP preenche o endereço;
  - campos em vermelho após tentar enviar vazio;
  - o envio leva o endereço;
  - botão à direita;
  - nenhum texto de exemplo com asterisco.
- Denúncia: asteriscos, campos em vermelho por regra e botão à direita.
- Acompanhar e Acessar: asteriscos e botões à direita.

### Backend

- `POST /access-requests` grava o endereço completo, aceita o pedido sem endereço e recusa CEP ou UF inválidos.
- O isolamento por município continua (testes atuais de `access-request-security`).

### Conferência manual (tela)

- Credenciamento como ONG e como protetor: layout em cartões, endereço preenchido pelo CEP, envio e detalhe na tela interna.
- Tentar enviar credenciamento e denúncia vazios: campos em vermelho.
- Conferir os asteriscos nas quatro etapas da solicitação e os botões à direita no computador e no celular.

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

- **Afetar produção:** o SQL precisa ser aplicado antes do deploy, senão o credenciamento falha.
- **Bairro limitado à lista do município:** quem mora fora não encontra o bairro, a mesma limitação do tutor.
- **Validação do app no lugar da nativa:** a troca da validação nativa pela do app não pode deixar enviar formulário incompleto. Os testes cobrem isso.
- **Árvore de trabalho:** há mudanças em andamento de outro trabalho do usuário no `App.tsx` e em outros arquivos. A implementação toca o `App.tsx` só nos trechos citados, e o commit precisa separar o que é deste plano.

---

## Perguntas em aberto

Nenhuma pergunta em aberto identificada. Decisões de 2026-11-22 (recomendações aprovadas):

- Endereço do credenciamento opcional.
- Modais de acesso (Entrar, Recuperar acesso, Trocar senha e Perfil) ficam como estão.
- Credenciamento em cartões Responsável, Endereço e Contato.

---

## Critérios de aceite

- Em todas as telas externas do escopo, o obrigatório aparece com asterisco no título e nenhum texto de exemplo tem asterisco.
- Credenciamento, denúncia e interesse de adoção mostram o campo que falta em vermelho com o aviso embaixo, como a solicitação.
- O credenciamento tem os campos lado a lado, em cartões, e a seção Endereço com os mesmos campos do tutor. O endereço é gravado e aparece na tela interna.
- O botão principal fica à direita nas telas do escopo.
- Typecheck, testes do front e do back e build sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
- Não incluir no commit as mudanças em andamento de outro trabalho do usuário.
