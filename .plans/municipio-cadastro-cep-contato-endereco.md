# Plano de Implementação: Cadastro de município com busca por CEP, máscara no contato e endereço em campos separados

## Origem

- Arquivo de especificação: nenhum arquivo único. Base: o pedido de 2026-11-16 sobre o modal "Cadastrar município" (puxar dados pelo CEP, máscara no contato, separar os campos de endereço), as decisões do usuário no mesmo dia (abaixo) e o código do `main` (commit `531486c`).
- Data do planejamento: `2026-11-16`
- Classificação: `frontend + backend + database` (3 colunas novas em `municipalities`; nenhuma variável de ambiente nova)

---

## Resumo

O modal "Cadastrar município" (o mesmo serve para criar e editar) guarda hoje `contact`, `address` e `cep` como texto solto: o endereço é um campo único ("Rua, número, bairro"), o CEP não tem máscara, o contato é texto livre, e Estado e Município são selects alimentados pela API de localidades do IBGE.

Passa a funcionar assim:

- **O CEP é o ponto de partida.** Com 8 dígitos, o sistema consulta o ViaCEP e preenche Rua, Bairro, Município e UF. O campo ganha a máscara `00000-000`.
- **Estado e Município deixam de ser selects.** Viram campos (Município e UF) preenchidos pelo CEP. A recomendação é que continuem editáveis depois do CEP, para o caso de o ViaCEP falhar ou não achar o CEP (ver "Perguntas em aberto").
- **Endereço separado:** CEP, Número, Rua, Complemento e Bairro, mais Município e UF.
- **Contato:** máscara `(00) 00000-0000`, opcional. Se preenchido, precisa ser telefone válido (10 ou 11 dígitos), no formulário e no servidor.
- **Modelo:** `address` passa a ser a Rua; entram `address_number`, `address_complement` e `neighborhood`. Um formatador único monta o endereço completo e o rodapé da receita passa a usá-lo, em vez de guardar o endereço duas vezes.
- **Colunas** criadas pelo `migrations.js`, no mesmo padrão da coluna `department_name` (`ADD COLUMN IF NOT EXISTS`).

Decisões do usuário (2026-11-16):

- campos de endereço: CEP, Rua, Número, Complemento e Bairro;
- o CEP passa a mandar em Município e UF, e os selects de Estado e Município são eliminados;
- o Contato vira só telefone (texto livre antigo se perde ao salvar);
- sobre como criar as colunas, a resposta foi "limpa o banco": interpretado como usar o `migrations.js`, que cria as colunas sozinho no start e num banco limpo (a ser confirmado, ver "Perguntas em aberto").

---

## Escopo

### Dentro do escopo

- Campos de endereço separados no modal de município (criar e editar), com o CEP primeiro.
- Busca de Rua, Bairro, Município e UF pelo CEP.
- Remoção dos selects de Estado e Município e da carga do IBGE que os alimentava.
- Máscara e validação do contato e do CEP.
- Colunas novas, validação e edição no backend (`POST` e `PATCH /municipalities`), inclusive na edição pelo administrador do próprio município.
- Formatador de endereço do município e uso no rodapé da receita.
- Colunas novas no `migrations.js`.

### Fora do escopo

- Importação de bairros do IBGE e a tela de Bairros.
- Alterar outros textos de contato do sistema (acesso de tutor, credenciamento, WhatsApp, SMS).
- Reescrever em massa os endereços dos municípios já cadastrados.
- Limpar ou apagar dados do banco (decisão separada do usuário, não faz parte desta implementação).

---

## Leitura de contexto

- `/AGENT.md`
- `src/App.tsx`: estado e modal do município (`emptyMunicipalityForm`, `openMunicipalityModal`, `saveMunicipality`, selects de Estado e Município, efeitos que consultam o IBGE, campos "Contato", "Endereço" e "CEP"), rodapé da receita (`buildPrescriptionFooterLines`)
- `src/features/animal-services/cep-lookup.ts` (consulta ao ViaCEP), `src/utils.ts` (`formatPhone`, `formatCep`, `isValidPhone`)
- `backend/src/routes/municipalities.js` (criação, edição, listas de campos editáveis), `backend/src/db/migrations.js` (padrão da coluna `department_name`)
- `backend/test/municipality-identity.test.js`

---

## Impacto por área

### Frontend

- Componente `municipality-address-fields.tsx` e arquivo `municipality-address.ts` em `src/features/municipality-form/` (formatador do endereço, validação do contato e do CEP, regra "o CEP preenche Rua, Bairro, Município e UF"). O trecho do modal no `App.tsx` passa a usá-los.
- Estados de carregando da consulta ao CEP, "CEP não encontrado", erro silencioso (a falha nunca bloqueia o preenchimento manual, conforme a decisão de Município e UF editáveis), e campos inválidos destacados.
- Edição de município antigo: os campos novos vêm vazios e o texto de `address` aparece no campo Rua; Município e UF vêm do que já está salvo.
- Remoção dos selects de Estado e Município, dos efeitos que consultam a API de localidades do IBGE e dos estados e constantes que ficarem sem uso (`brazilStates`, `brazilMunicipalities`, fallback de estados; conferir com grep se algo mais os usa).
- O rodapé da receita usa o formatador.
- Testes de frontend: formatador, validação do contato, regra do CEP.

### Backend

- `POST /municipalities`: aceita e valida `address_number`, `address_complement` e `neighborhood`; contato opcional, mas válido se vier; CEP com 8 dígitos ou vazio; limites de tamanho (rua 200, número 20, complemento 80, bairro 120).
- `PATCH /municipalities/:id`: os campos novos entram em `MUNICIPALITY_SELF_EDIT_FIELDS` (e, por herança, nos globais), com a mesma validação.
- A listagem de municípios passa a devolver os campos novos, se ela seleciona colunas específicas.
- Testes de backend: validação, e permissão (administrador municipal só edita o próprio município; perfis sem permissão recebem 403).

### Banco de dados

- `backend/src/db/migrations.js`: `ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS address_number TEXT`, `address_complement TEXT` e `neighborhood TEXT` (sem NOT NULL, sem apagar nada), junto da linha existente de `department_name`. Roda sozinho no próximo start do servidor, inclusive em produção depois do deploy.
- Não editar migration já aplicada; só acrescentar.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção. Como a mudança fica no `migrations.js`, ela só roda quando o servidor sobe; a skill `implementar` não deve subir o servidor para "testar a migration" sem confirmação.

### Infra/Deploy

Sem impacto esperado, além de a produção criar as 3 colunas no primeiro start depois do deploy.

---

## Arquivos provavelmente afetados

- `src/App.tsx` _(arquivo grande: só o modal do município, os efeitos do IBGE e o rodapé da receita)_
- `src/features/municipality-form/*` _(novos)_
- `src/features/animal-services/cep-lookup.ts` _(reuso; se for movido para um local compartilhado, ajustar os imports)_
- `backend/src/routes/municipalities.js`
- `backend/src/db/migrations.js`
- `backend/test/*` e testes do frontend

---

## O que será removido

- Os selects de Estado e Município do modal de município.
- As chamadas à API de localidades do IBGE que alimentavam esses selects e os estados e constantes que ficarem sem uso (`brazilStates`, `brazilMunicipalities`, fallback de estados), após grep de usos.
- O campo único "Endereço" do modal de município.
- O campo livre de "Contato" do modal, substituído pelo campo com máscara de telefone.
- A montagem do endereço do município diretamente em `buildPrescriptionFooterLines`, substituída pelo formatador.
- Imports e props que ficarem órfãos.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. Backend: validação e novos campos em `POST` e `PATCH /municipalities`, listas de campos editáveis e a listagem; colunas no `migrations.js`; testes.
2. Frontend, regras puras: `municipality-address.ts` (formatador, validação do contato e do CEP, regra do CEP) com testes.
3. Frontend, componente `municipality-address-fields.tsx` e troca no modal do município (CEP primeiro, depois Número, Rua, Complemento, Bairro, Município e UF); estados de carregando, "CEP não encontrado" e erro.
4. Remover os selects de Estado e Município, os efeitos do IBGE e o que ficou sem uso; rodapé da receita usando o formatador.
5. Validações: `npm run typecheck`, `npm test`, `node --test backend/test/*.test.js` e `npm run build`.
6. Informar ao usuário que o `migrations.js` cria as colunas no próximo start. Não subir o servidor para executá-lo sem confirmação.

---

## Regras de negócio identificadas

- Endereço do município: CEP, Rua, Número, Complemento, Bairro, Município e UF.
- O CEP preenche Rua, Bairro, Município e UF; o preenchimento é uma conveniência: a falha da consulta nunca bloqueia o preenchimento manual.
- Município e UF continuam sendo o nome e o estado do município (o nome gera o identificador `slug`); a regra de edição desses campos depende da decisão em "Perguntas em aberto".
- Contato: telefone com DDD, opcional; formato salvo `(00) 00000-0000`.
- CEP: 8 dígitos, exibido com a máscara `00000-000`.
- Município antigo continua exibindo o endereço antigo (campo `address`) até ser editado.

---

## Regras multi-tenant e segurança

- Só o usuário global cria município; o administrador municipal só edita o próprio (regra existente, preservada). Nome e UF continuam editáveis só pelo usuário global.
- Os campos novos entram nas listas de campos editáveis, nada além disso; nenhum campo editável é ampliado por engano.
- Consultas parametrizadas, como hoje.
- A consulta ao ViaCEP é feita pelo navegador, como no formulário de solicitação; o CEP digitado é o único dado enviado.
- Mensagens de erro do servidor continuam genéricas.

---

## Validações necessárias

- Contato: vazio, ou 10 a 11 dígitos com DDD válido.
- CEP: vazio, ou 8 dígitos.
- Rua até 200, número até 20, complemento até 80, bairro até 120 caracteres.
- UF com 2 letras; nome do município obrigatório (como hoje).

---

## Testes necessários

### Frontend

- Formatador do endereço: completo, só com a rua (município antigo), com complemento, sem número.
- Validação do contato e do CEP.
- Regra do CEP: preenche Rua, Bairro, Município e UF; CEP não encontrado e falha da consulta não alteram os campos.

### Backend

- `POST` e `PATCH`: campos novos salvos; contato e CEP inválidos recusados; limites de tamanho.
- Permissão: administrador municipal edita só o próprio município; perfil sem permissão recebe 403.

### Conferência manual (tela)

- Criar um município: digitar o CEP e conferir Rua, Bairro, Município e UF preenchidos, e as máscaras do CEP e do contato.
- Digitar um CEP inexistente e conferir a mensagem e que dá para preencher à mão.
- Editar um município antigo: o endereço antigo aparece no campo Rua.
- Gerar uma receita e conferir o rodapé com o endereço e o contato.

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

- **Produção:** o `migrations.js` cria as 3 colunas no primeiro start depois do deploy. É só acrescentar, mas é alteração de schema sem execução manual.
- **Nome do município:** sem o select do IBGE, o nome pode ser digitado errado quando o CEP falhar, e o nome gera o identificador (`slug`) do município.
- Município antigo com Contato em texto livre perde o texto ao ser salvo de novo (o "responsável" já tem lugar em "Nome do órgão / secretaria").
- Falha ou indisponibilidade do ViaCEP: o preenchimento manual continua funcionando (se Município e UF ficarem editáveis).
- Mexe em cadastro de município (global e administrador municipal): manter a regra de tenant.
- Risco de afetar produção: commit e push direto em `main`, sem `staging`.

---

## Perguntas em aberto

1. Município e UF ficam **editáveis** depois do CEP (recomendado: permite cadastrar quando o ViaCEP falha, mas aceita erro de digitação) ou **bloqueados**, preenchidos só pelo CEP (mais seguro contra erro de digitação, mas impede cadastrar sem o ViaCEP)?
2. A resposta "limpa o banco" à pergunta sobre as colunas foi interpretada como "usar o `migrations.js`". Confirmar. Limpar o banco, se for isso que o usuário quis dizer, é uma ação separada e não faz parte desta implementação.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- o modal do município tem CEP, Número, Rua, Complemento, Bairro, Município e UF, e o CEP preenche Rua, Bairro, Município e UF;
- os selects de Estado e Município e a carga do IBGE do modal não existem mais;
- o contato e o CEP têm máscara e validação, no formulário e no servidor;
- município antigo continua exibindo o endereço e o rodapé da receita funciona com o formatador;
- o administrador municipal edita os novos campos só do próprio município;
- `typecheck`, testes de frontend e de backend e `build` passam, sem erros novos;
- as colunas novas estão no `migrations.js` e nenhuma migration foi executada sem confirmação.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
- As perguntas em aberto não foram respondidas até aqui: usar as recomendações indicadas, ou perguntar antes de implementar a parte que depender delas.
