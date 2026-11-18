# Plano de Implementação: Etapa "Animal" no modelo de cartões

## Origem

- Arquivo de especificação: pedido no chat (2026-11-17), com dois prints de referência (layout da etapa e lista de procedimentos aberta)
- Data do planejamento: `2026-11-17`
- Classificação: `frontend-only`

---

## Resumo

A etapa "Animal" do formulário de solicitação (público e interno da equipe) passa para o modelo da imagem: procedimento num campo que abre uma lista flutuante, perguntas do animal e da saúde em cartões com opções em bolinhas (radio), e botões tracejados com ícone no rodapé. As cores e a tipografia continuam as atuais do app. Os valores salvos não mudam, então back e banco não são tocados.

---

## Escopo

### Dentro do escopo

- **Procedimento:** título "Qual procedimento solicitar? *" e dica "Pode marcar mais de um."; campo fechado mostra os nomes escolhidos separados por vírgula ("Microchipagem, Vacinação antirrábica"), cortados com "…" se não couberem, ou "Selecione os procedimentos" sem nada escolhido; ao clicar, a lista abre flutuando sobre o conteúdo abaixo, com caixa de marcar à esquerda e a taxa ("Gratuito") à direita; busca no topo com mais de 8 itens; fecha com Esc, clique fora ou novo clique no campo.
- **Como ele é?:** Espécie, Sexo, Tem raça definida? e Qual o porte? numa linha de 4 cartões, cada um com legenda e opções em bolinhas empilhadas; faixa de peso do porte em azul ao lado do nome; campo da raça numa linha inteira abaixo dos cartões quando "Com raça definida"; depois nome, pelagem e idade em 3 colunas e o bairro com a dica.
- **Saúde e cuidados:** dica "Responda como souber, tudo bem não ter certeza." e 4 cartões com Sim/Não em bolinhas, sem resposta marcada ("Come só ração?": Sim = "Ração", Não = "Diversos").
- **Rodapé da etapa:** "Adicionar outro animal" e "Repetir os dados do anterior" tracejados, fundo branco, texto azul, com ícone (lucide `PlusCircle` e `RefreshCw`); hover em azul claro (sai o hover verde que sobrou).
- **Formulário interno da equipe** (modal) recebe o mesmo modelo, por usar os mesmos campos; lá os cartões ficam em 2 colunas.
- **Responsivo:** cartões em 4 colunas no computador, 2 no tablet/modal, 1 no celular; nome/pelagem/idade em 3 colunas, 1 no celular.
- **Cores:** as atuais (azul `#2563eb`/`--accent-blue`, fundo `#eff6ff`, bordas `#dbe5f1`, textos `--type-color-*`). **Tipografia:** escala atual de 5 níveis (`--type-*`), pouco negrito.

### Fora do escopo

- Stepper, "Voltar" do topo, "Voltar" e "Próximo" do rodapé (comuns às 4 etapas): ficam como estão.
- Outras etapas (Você, Agenda, Documentos) e a escolha de procedimento do animal já cadastrado (`RegisteredRequestSelection`).
- Edição do animal no admin (App.tsx ~5586) e demais telas que usam `CompactChoiceField` (adoção, acesso à solicitação).
- Back, banco e valores salvos.

---

## Leitura de contexto

- `/AGENT.md`
- `src/features/request-procedures/animal-fields.tsx`, `request-procedure-list.tsx`, `animal-accordion-card.tsx`, `request-procedures.ts` (animal vazio com saúde em `""`)
- `src/components/ui.tsx` (`CompactChoiceField`, `YesNoToggleField`, `ToggleChoiceField`, `ToggleSwitch`, `FormSection`)
- `src/components/scroll-checklist.tsx` (`toggleSelection`, `filterChecklistGroups`, `CHECKLIST_SEARCH_THRESHOLD`; também usado por `breeds/breed-checklist.tsx`)
- `src/App.tsx` (~3320–3370 etapa Animal, ~3469–3509 rodapé)
- `src/styles.css`: regras de `.compact-choice-field`, `.yes-no-toggle-field`, `.health-grid`, `.animal-choice-grid`, `.anm-add-btn`, `.nr-shell--public` (~18758–19060), `.internal-request-modal .nr-shell--internal` (~22947–23210), `.public-service-panel` (~19505, ~19841)
- `src/features/request-procedures/request-procedure-components.test.tsx`

---

## Impacto por área

### Frontend

- **Novo `src/components/option-card-group.tsx`** (`OptionCardGroup`): `<fieldset>` com `<legend>` (asterisco quando obrigatório) e uma `<input type="radio">` por opção, empilhadas; opção como texto ou `{ value, label, subtitle }` (subtitle ao lado do rótulo); `name` por `useId()` (únicos com vários animais); nenhuma marcada com valor `""`; estado `invalid` com a cor de erro atual. Aceita valor igual a `value` ou `label` (como o `CompactChoiceField` faz hoje).
- **Novo `src/components/multi-select-dropdown.tsx`** (`MultiSelectDropdown`): botão gatilho (`aria-expanded`, `aria-controls`) com o resumo dos escolhidos ou o placeholder; painel flutuante (posição absoluta abaixo do gatilho, acima do conteúdo, altura máxima com rolagem) com linhas de checkbox + detalhe à direita; busca acima de `CHECKLIST_SEARCH_THRESHOLD`; reaproveita `toggleSelection` e `filterChecklistGroups`; fecha com Esc, clique fora e novo clique no gatilho; mensagem de erro e vazio como no `ScrollChecklist`.
- **`request-procedure-list.tsx`:** título do cartão (`form-sub-card-title`) "Qual procedimento solicitar?" + asterisco, dica, e o `MultiSelectDropdown` no lugar do `ScrollChecklist`; mantém fee por `requestTypeFeeLabel`, erro "Escolha ao menos um procedimento" e texto de vazio.
- **`animal-fields.tsx`:** 4 `OptionCardGroup` numa grade de 4 colunas; raça abaixo da grade; linha nome/pelagem/idade; bairro e dica; saúde com 4 `OptionCardGroup` Sim/Não (e Ração/Diversos com rótulos Sim/Não); microchip interno segue igual.
- **`App.tsx`:** só os dois botões do rodapé da etapa (ícones, sem "+" no texto).
- **`styles.css`:** classes novas dos dois componentes e da grade; `.anm-add-btn` tracejado sem o hover verde (corrigir a regra que decide, sem `!important` novo); remoção do que ficar morto (abaixo).

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

---

## Arquivos provavelmente afetados

- `src/components/option-card-group.tsx` _(novo)_
- `src/components/multi-select-dropdown.tsx` _(novo)_
- `src/components/ui.tsx`
- `src/features/request-procedures/animal-fields.tsx`
- `src/features/request-procedures/request-procedure-list.tsx`
- `src/App.tsx` _(só o rodapé da etapa Animal)_
- `src/styles.css`
- Testes: `src/features/request-procedures/request-procedure-components.test.tsx`, `src/components/option-card-group.test.tsx` e `src/components/multi-select-dropdown.test.tsx` _(novos)_

---

## O que será removido

- `YesNoToggleField` e `ToggleChoiceField` de `src/components/ui.tsx` (só a etapa Animal usa).
- Todas as regras `.yes-no-toggle-field` do `styles.css` (inclusive dentro de listas de seletores, como `.public-service-panel .yes-no-toggle-field`).
- Regras de `.compact-choice-field` que só alcançam o formulário do animal: `.single-request-form .animal-form .compact-choice-field…`, `.nr-shell .compact-choice-field…`, `.nr-shell--public .compact-choice-field…`, `.internal-request-modal .nr-shell--internal .compact-choice-field…`, `.internal-request-modal .single-request-form .animal-form .compact-choice-field` — conferindo por busca que nenhum outro `CompactChoiceField` renderiza dentro de `.nr-shell`/`.animal-form`.
- `.animal-choice-grid.three-col` e `.animal-choice-grid.name-coat-age-row` (e `.two-col` se ficar sem uso); `.health-grid` antigas que não valerem mais para a grade nova.
- O "+" escrito em "Adicionar outro animal" e o hover verde de `.nr-shell--public .anm-add-btn`.
- Imports que ficarem órfãos (`ScrollChecklist` em `request-procedure-list.tsx`, toggles em `animal-fields.tsx`).

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. Criar `OptionCardGroup` e seus testes.
2. Criar `MultiSelectDropdown` (reaproveitando os helpers de `scroll-checklist.tsx`) e seus testes.
3. Trocar `RequestProcedureList` para o título novo + `MultiSelectDropdown`.
4. Reescrever `AnimalFields` com a grade de 4 cartões, raça, linha de texto, bairro e saúde em cartões; remover os toggles de `ui.tsx`.
5. Ajustar os botões do rodapé no `App.tsx`.
6. CSS: estilos novos com as variáveis atuais; grade responsiva (4/2/1); lista flutuante acima do conteúdo e sem corte no modal; botões tracejados; remover o que ficou morto, conferindo cada classe por busca no arquivo inteiro.
7. Atualizar `request-procedure-components.test.tsx`.
8. Validar (typecheck, testes, build) e conferir no Chrome de teste com dados falsos: público e modal interno, computador e celular; apagar a prévia no fim.

---

## Regras de negócio identificadas

- Pode escolher mais de um procedimento; ao menos um é obrigatório quando o município tem tipos cadastrados.
- Espécie, sexo, raça definida, porte e bairro são obrigatórios; nome, pelagem, idade e saúde são opcionais.
- Nenhuma resposta vem marcada; sem resposta, a saúde continua salva como `""` ("Não informado" nas fichas).
- Valores salvos inalterados: Sim/Não, Ração/Diversos, Indefinida/Definida, nomes de espécie e porte.

---

## Regras multi-tenant e segurança

- Sem mudança de dados, rotas ou permissões; procedimentos, espécies, portes, raças e bairros continuam vindo da configuração do município como hoje.

---

## Validações necessárias

- As mesmas de hoje (`needsProcedure`, obrigatórios do animal, bairro), agora refletidas no estado `invalid` dos cartões e do campo de procedimentos.

---

## Testes necessários

### Frontend

- `OptionCardGroup`: legenda e asterisco; um radio por opção com o mesmo `name`; nada marcado com `""`; marca a opção pelo valor ou rótulo; subtítulo ao lado do rótulo; classe de inválido.
- `MultiSelectDropdown`: placeholder sem escolha; nomes separados por vírgula com escolha; fechado por padrão (`aria-expanded="false"`, sem linhas); detalhe da taxa nas linhas; texto de vazio.
- `AnimalFields`: rótulos e perguntas de sempre, radios no lugar dos toggles, raça só com "Com raça definida", bairro, microchip só para a equipe.
- `RequestProcedureList`: título "Qual procedimento solicitar?", dica e erro.

### Backend

- Nenhum.

### Conferência manual (tela)

- Formulário público, etapa Animal: cartões em 4 colunas, lista de procedimentos flutuando sobre o cartão de baixo, nomes no campo, Esc/clique fora fecham, cores atuais, sem verde no hover dos botões.
- Celular: 1 coluna, lista sem passar da tela.
- Modal interno da equipe: 2 colunas, lista sem ser cortada, microchip presente.
- Dois animais: acordeão, "Remover animal", "Aplicar os procedimentos do Animal 1 a todos" e "Repetir os dados do anterior" funcionando.

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

- `styles.css` (~24 mil linhas) tem regras duplicadas e `!important` nessas classes: componentes novos usam classes próprias; cada remoção conferida por busca e, na dúvida, pela regra que decide no Chrome de teste.
- Lista flutuante: `z-index` acima dos cartões, sem corte por `overflow` do modal interno e do painel público; altura máxima com rolagem.
- Modal interno mais estreito: grade se ajusta (2 colunas).
- Commit e push direto em `main`.

---

## Perguntas em aberto

Respondidas no planejamento:

1. O formulário interno da equipe também fica no modelo novo.
2. O campo de procedimentos mostra os nomes escolhidos separados por vírgula, e a lista abre flutuando (print de referência).

---

## Critérios de aceite

- A etapa Animal (pública e interna) segue o layout da imagem com as cores e a tipografia atuais.
- Procedimentos num campo com lista flutuante, nomes escolhidos no campo, múltipla escolha e taxa por item.
- Perguntas do animal e da saúde em cartões com bolinhas, sem resposta marcada, valores salvos iguais aos de hoje.
- Sem regras/componentes antigos mortos (toggles, `.yes-no-toggle-field`, regras do `compact-choice-field` do formulário do animal).
- Typecheck, testes e build sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
