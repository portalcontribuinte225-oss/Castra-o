# Plano de Implementação: Compactar espaços externos e "Saúde e cuidados" na etapa Animal

## Origem

- Arquivo de especificação: sem `.md` externo — pedido direto do usuário no chat, refinado com resposta de escopo
- Data do planejamento: 2026-07-28
- Classificação: `frontend-only`

## Resumo

Compactar a etapa Animal do formulário público (`.nr-shell--public`/`.public-service-panel`) em dois pontos específicos: reduzir o espaço vertical "em branco" entre cabeçalho do painel, stepper e o card do formulário; e tornar a seção "Saúde e cuidados" mais densa (menos padding entre os itens, fonte menor). O padding interno dos cards (`.form-sub-card`) e o espaçamento entre eles (`.single-request-form`) permanecem como estão — usuário confirmou que essa parte já está boa. O scroll do container não é removido, só reduz a necessidade de rolar tanto.

## Escopo

### Dentro do escopo

- Reduzir `.public-service-panel { gap: 14px }` para aproximar cabeçalho, stepper e corpo do formulário.
- Reduzir padding de `.public-service-panel .nr-topbar`/`.nr-body` se ainda sobrar espaço solto entre o stepper e o primeiro card, após o ajuste do gap acima.
- Em "Saúde e cuidados": reduzir `.nr-shell--public .yes-no-toggle-field { padding: 9px 0 }` (para algo como 6px) e `font-size: 0.86rem` (para algo como 0.8rem) do texto de cada item (Vermifugado, Vacinas em dia, Já teve cria, Histórico de doenças, Alimentação exclusiva com ração).

### Fora do escopo

- `.form-sub-card` (padding/gap interno dos cards) — permanece como está.
- `.single-request-form` (espaço entre os sub-cards empilhados) — permanece como está.
- `.animal-choice-grid` (grid de Espécie/Sexo/Raça/Porte) — permanece como está.
- Qualquer remoção de scroll — o container continua rolável quando o conteúdo exceder o espaço disponível.
- Etapas Tutor, Agenda, Documentos — não fazem parte deste ajuste (a menos que compartilhem literalmente a mesma regra `.yes-no-toggle-field`/`.public-service-panel`, o que é aceitável já que é a mesma classe genérica do painel).

## Leitura de contexto

- `/AGENT.md` (raiz) — mesmo contexto de planos anteriores nesta sessão.
- `frontend/AGENT.md` / `backend/AGENT.md` — não existem neste repo.
- Mapa de espaçamentos investigado em `src/styles.css`:
  - `.public-service-panel` (~21638): `gap: 14px` — espaço entre header do painel, stepper (`.nr-topbar`) e corpo (`.nr-body`).
  - `.public-service-panel .nr-topbar` (~21717): `padding: 6px 0 10px`.
  - `.public-service-panel .nr-body` (~21725): `padding: 10px 0 0`.
  - `.nr-shell--public .form-sub-card` (~21195, vencedora sobre ~21149 que só ajusta `border-color`): `padding: 24px 26px; gap: 18px` — fora de escopo, não tocar.
  - `.nr-shell--public .single-request-form` (~21202): `gap: 18px` — fora de escopo, não tocar.
  - `.nr-shell--public .yes-no-toggle-field` (~21022): `padding: 9px 0`, e o `<span>` filho (~21032) com `font-size: 0.86rem` — alvo principal deste plano.
  - `.nr-shell--public .health-grid` (~21016): `grid-template-columns: 1fr; gap: 0` — já é o container das linhas de saúde, sem padding próprio a reduzir.

## Impacto por área

### Frontend

- **`src/styles.css`**: ajuste pontual de `gap`/`padding` em `.public-service-panel`, `.public-service-panel .nr-topbar`/`.nr-body` (se necessário), `.nr-shell--public .yes-no-toggle-field` e seu `<span>` filho.
- Sem mudança de JSX, sem mudança de lógica/comportamento — é puramente visual/espaçamento.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css` — blocos `.public-service-panel` (~21638), `.public-service-panel .nr-topbar`/`.nr-body` (~21717-21730), `.nr-shell--public .yes-no-toggle-field` (~21022-21036).

## Estratégia de implementação

1. Reconfirmar com grep as linhas atuais dos blocos listados (podem ter deslocado por edições paralelas de outra sessão).
2. Reduzir `.public-service-panel { gap }` de 14px para um valor menor (ex.: 8px).
3. Se ainda sobrar espaço perceptível entre stepper e card após o passo 2, reduzir o padding de `.nr-topbar`/`.nr-body` no mesmo contexto.
4. Reduzir `.nr-shell--public .yes-no-toggle-field { padding: 9px 0 }` para um valor menor (ex.: 6px 0).
5. Reduzir `font-size` do `<span>` de cada item de saúde (~0.86rem → ~0.8rem), mantendo legibilidade.
6. Rodar grep de `.yes-no-toggle-field`/`.public-service-panel` no arquivo inteiro para confirmar que não sobrou versão antiga/duplicada competindo com a mudança.
7. Rodar `typecheck` e `build`.
8. Validar visualmente (ou pela leitura do CSS resultante) que o scroll continua funcionando quando necessário, e que "Saúde e cuidados" não ficou ilegível/apertado demais.

## Regras de negócio identificadas

Nenhuma — é ajuste puramente visual de espaçamento, sem alterar dado, validação ou comportamento funcional.

## Regras multi-tenant e segurança

Sem impacto — não há dado de tenant/permissão envolvido.

## Validações necessárias

- Confirmar que o espaço entre cabeçalho, stepper e card diminuiu perceptivelmente.
- Confirmar que "Saúde e cuidados" ficou mais compacto (menos altura total), com texto ainda legível.
- Confirmar que o scroll do painel continua funcionando quando o conteúdo excede o espaço disponível.
- Confirmar que `.form-sub-card`/`.single-request-form`/`.animal-choice-grid` não foram alterados.

## Testes necessários

### Frontend

Não há suíte de testes de componente identificada para este layout; validação será manual/visual + `typecheck`/`build`.

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

- Baixo risco — mudança pequena e escopada a 2-3 blocos de CSS, sem tocar em estrutura/layout.
- `.public-service-panel { gap }` é compartilhado por todas as etapas do formulário público (não só Animal) — reduzir esse gap afeta a aparência geral do painel em todas as etapas, o que é esperado e aceitável (é o espaçamento externo do container, não interno de cada card).
- `.yes-no-toggle-field` pode ser usada em outros contextos do sistema — confirmar com grep que a mudança está escopada a `.nr-shell--public` (contexto público) e não vaza para outras telas.
- Trabalho de outra sessão paralela pode estar mexendo no mesmo arquivo — isolar as próprias edições (stash/patch parcial) antes de qualquer commit via skill `finalizar`.
- Push é direto em `main`, sem `staging` — qualquer regressão visual é imediatamente visível em produção.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Critérios de aceite do plano

- Espaço entre cabeçalho/stepper/card reduzido.
- "Saúde e cuidados" mais compacto (menos padding, fonte menor), ainda legível.
- Scroll do painel preservado.
- `.form-sub-card`/`.single-request-form`/`.animal-choice-grid` intocados.
- `typecheck` e `build` passam sem novos erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não executar migrations (não aplicável).
- Reconfirmar linhas atuais com grep antes de editar.
- Não tocar em `.form-sub-card`, `.single-request-form`, `.animal-choice-grid` — usuário confirmou que essa parte já está boa.
- Isolar as próprias edições de qualquer trabalho não commitado de outra sessão presente no mesmo arquivo, antes de qualquer commit via skill `finalizar`.
- Confirmar via grep que `.yes-no-toggle-field` está sendo alterada só no contexto `.nr-shell--public`, sem vazar para outros usos do mesmo componente em outras telas.
- Seguir a regra de comunicação silenciosa da skill `implementar`.
