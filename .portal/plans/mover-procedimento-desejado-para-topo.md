# Plano de Implementação: Mover "Procedimento desejado" para o topo do card de identificação

## Origem

- Arquivo de especificação: sem `.md` externo — pedido direto do usuário no chat, motivado pela limpeza visual já feita no formulário de cadastro (redução de cards/bordas desnecessários na etapa Animal)
- Data do planejamento: 2026-07-28
- Classificação: `frontend-only`

## Resumo

A etapa "Animal" do formulário de cadastro (`NewRequest`, em `src/App.tsx`) hoje renderiza 3 cards (`.form-sub-card`) sequenciais dentro de cada bloco de animal: "Tipo e identificação" (ou "Identificação do animal"), "Procedimento desejado" (card pequeno, com um único campo de escolha) e "Saúde e cuidados". Este plano funde o card "Procedimento desejado" para dentro do card de identificação, posicionado no topo (antes do seletor de tipo de solicitação e dos demais campos), eliminando um `.form-sub-card` inteiro da tela — reduzindo o número de caixas/bordas visíveis, na mesma direção da limpeza já aplicada ao stepper e aos `.form-section`.

## Escopo

### Dentro do escopo

- Mover o bloco JSX de "Procedimento desejado" (`<div className="animal-choice-grid species-row"><CompactChoiceField label="Tipo de Procedimento" ... /></div>`, hoje em `src/App.tsx` por volta da linha 4263-4268) para o início do card "Tipo e identificação" (antes do seletor de tipo de solicitação, linha ~4171).
- Remover o `.form-sub-card` que hoje envolve "Procedimento desejado" isoladamente, já que o conteúdo passa a viver dentro do card de identificação.
- Ajustar título do card resultante, se necessário, para refletir que agora cobre também o procedimento (a definir durante a implementação, com preferência por manter simples).
- Validar visualmente que o reposicionamento funciona corretamente nas 3 variantes do formulário que compartilham este bloco: fluxo público (`publicFlow`), interno simples (`internalSimple`) e interno completo (nem público nem simples).
- Ajustes pontuais de CSS (espaçamento entre o campo de procedimento e o restante do card), se o reaproveitamento direto de `.animal-choice-grid`/`.form-sub-card` não for suficiente.

### Fora do escopo

- Qualquer mudança nos campos do card "Saúde e cuidados" (permanece como card separado).
- Qualquer mudança de lógica/validação do campo `procedureType` — só reposicionamento visual.
- Qualquer mudança nos outros passos do formulário (Tutor, Agenda, Documentos).
- O trabalho já pendente/não commitado de outra sessão paralela em `src/App.tsx`/`src/styles.css` — não tocar.
- O botão "Adicionar animal" já movido para a barra de navegação nesta mesma sessão (trabalho anterior, não relacionado a este plano) — não deve ser desfeito nem alterado por este plano.

## Leitura de contexto

- `/AGENT.md` (raiz) — mesmo contexto de planos anteriores nesta sessão: template genérico staging/PR; a prática real do projeto é commit direto em `main`.
- `frontend/AGENT.md` / `backend/AGENT.md` — não existem neste repo.
- Estrutura atual investigada diretamente em `src/App.tsx` (componente `NewRequest`):
  - Linha ~4167-4262: card "Tipo e identificação" (título condicional `showTypeSelector ? "Tipo e identificação" : "Identificação do animal"`), contendo seletor de tipo de solicitação, campo Nome (quando `externalLikeRegistration`), grid de Espécie/Sexo/Raça, campo de raça descritiva condicional, campos de Porte/Idade/Pelagem (variando por `externalLikeRegistration`), e campo de microchip (quando `internalSimple`).
  - Linha ~4263-4268: card "Procedimento desejado" — `<div className="form-sub-card"><span className="form-sub-card-title">Procedimento desejado</span><div className="animal-choice-grid species-row"><CompactChoiceField label="Tipo de Procedimento" value={animal.procedureType} options={["Castração", "Microchipagem", "Ambos"]} onChange={...} /></div></div>`. É o card mais simples dos três, um único campo.
  - Linha ~4269-4278: card "Saúde e cuidados" (fora de escopo, permanece como está).
  - Toda essa árvore está dentro do bloco condicional `{isOpen && <>...</>}` do acordeão de cada animal (`animals.map(...)`), compartilhado entre as 3 variantes do formulário via as flags `externalLikeRegistration` (= `publicFlow || internalSimple`) e `internalSimple`.

## Impacto por área

### Frontend

- **`src/App.tsx`**: reordenação de JSX dentro do componente `NewRequest` — mover o conteúdo de "Procedimento desejado" para o topo do card "Tipo e identificação", remover o `.form-sub-card` que ficou vazio. Nenhuma mudança de estado, validação ou lógica de negócio — é puramente estrutural/visual.
- **`src/styles.css`**: possível ajuste pontual de espaçamento (`.animal-choice-grid.species-row` dentro do novo contexto), avaliado durante a implementação; não deve exigir nova classe se o padrão existente (`.form-sub-card` com múltiplos blocos internos, como já ocorre em "Saúde e cuidados" com vários campos) já cobrir o caso.
- Sem impacto em hooks de rede, React Query, formulários Zod/RHF — não há validação nova, é reposicionamento.
- Estados de loading/error/empty do formulário não são afetados.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx` — reordenação de JSX dentro de `NewRequest` (~linhas 4167-4268).
- `src/styles.css` — ajuste pontual de espaçamento, se necessário.

## Estratégia de implementação

1. Reconfirmar com grep as linhas atuais dos dois cards antes de editar (o arquivo pode ter deslocado desde este levantamento, inclusive por causa do trabalho pendente de outra sessão).
2. Mover o bloco de "Procedimento desejado" (o `<div className="animal-choice-grid species-row">...</div>`, sem o wrapper `.form-sub-card` e sem o `<span className="form-sub-card-title">Procedimento desejado</span>`) para logo após a abertura do card "Tipo e identificação" e antes do seletor de tipo de solicitação (`{showTypeSelector && (...)}`).
3. Remover o `.form-sub-card` vazio que sobrou de "Procedimento desejado".
4. Revisar se o título do card ainda faz sentido ("Tipo e identificação" continua adequado, já que agora inclui também o procedimento) — decidir durante a implementação, mantendo simples se não houver instrução em contrário.
5. Rodar `typecheck` e `build`.
6. Confirmar visualmente (ou pela leitura do JSX resultante) que as 3 variantes do formulário (`publicFlow`, `internalSimple`, interno completo) continuam renderizando corretamente, sem campo duplicado ou ausente.

## Regras de negócio identificadas

Nenhuma regra de negócio nova — é reposicionamento visual, sem alterar o que é validado, salvo ou exibido em termos de dado.

## Regras multi-tenant e segurança

Sem impacto — não há dado de tenant/permissão envolvido, é reorganização de layout de um formulário já existente.

## Validações necessárias

- Confirmar que o campo `procedureType` continua funcionando (seleção, valor, `onChange`) exatamente como antes, só em nova posição.
- Confirmar que nenhum outro `.form-sub-card`/card ficou com espaçamento quebrado após a remoção do card "Procedimento desejado" isolado.
- Confirmar visualmente nas 3 variantes do formulário.

## Testes necessários

### Frontend

Não há suíte de testes de componente identificada para `NewRequest` neste projeto; validação será manual/visual + `typecheck`/`build`, como já é o padrão desta sessão.

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

- O bloco de JSX afetado é compartilhado entre 3 variantes do formulário (`publicFlow`, `internalSimple`, interno completo) — mover o procedimento para o topo precisa funcionar bem visualmente nas 3, não só na pública (que é a mais testada visualmente até agora nesta sessão).
- `src/App.tsx` está sendo editado por outra sessão em paralelo — usar a mesma técnica de isolamento (stash/patch parcial) já usada nesta sessão antes de qualquer commit, para não misturar mudanças.
- Push é direto em `main`, sem `staging` — qualquer regressão visual é imediatamente visível em produção.

## Perguntas em aberto

- Título do card resultante: manter "Tipo e identificação"/"Identificação do animal" (títulos já condicionais por `showTypeSelector`) ou ajustar para algo que mencione também o procedimento. Decisão pode ser tomada durante a implementação, mantendo o título atual como padrão seguro se não houver preferência explícita.

## Critérios de aceite do plano

- A etapa Animal passa a ter 2 cards em vez de 3 (identificação+procedimento fundidos, e saúde e cuidados).
- O campo de "Tipo de Procedimento" aparece no topo do card de identificação, antes do seletor de tipo de solicitação.
- Nenhuma perda de funcionalidade ou dado do formulário.
- `typecheck` e `build` passam sem novos erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não executar migrations (não aplicável).
- Reconfirmar linhas atuais com grep antes de editar — o arquivo pode ter mudado desde este planejamento.
- Isolar as próprias edições de qualquer trabalho não commitado de outra sessão presente no mesmo arquivo (mesma técnica de stash/patch parcial já usada nesta sessão).
- Manter a alteração pequena e focada: só reposicionamento do bloco de procedimento, sem tocar em "Saúde e cuidados" ou nos outros passos do formulário.
- Seguir a regra de comunicação silenciosa da skill `implementar`.
