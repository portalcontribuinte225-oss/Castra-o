# Plano de Implementação: Reduzir espaços externos entre card, botões e rodapé na etapa Animal

## Origem

- Arquivo de especificação: sem `.md` externo — pedido direto do usuário no chat, com screenshot mostrando espaço vazio acumulado entre o card "Saúde e cuidados", a barra de botões ("Adicionar animal"/"Próximo") e o rodapé
- Data do planejamento: 2026-07-28
- Classificação: `frontend-only`

## Resumo

Reduzir os espaços vazios *entre elementos* (não dentro dos cards) na etapa Animal do formulário público: o espaço entre o último card e a barra de botões, e o espaço acumulado entre a barra de botões e o rodapé fixo. O padding interno dos cards (`.form-sub-card`) e o gap entre cards (`.single-request-form`) permanecem intocados — usuário confirmou explicitamente que essa parte já está boa e não deve ser alterada novamente.

## Escopo

### Dentro do escopo

- Reduzir `.public-service-panel .nr-nav-row { margin: 12px 0 0 }` (o espaço entre o último card e a barra de botões).
- Reduzir `.public-service-panel { padding: 0 0 42px }` (o espaço entre a barra de botões e o fim do painel, antes do rodapé fixo).

### Fora do escopo

- `.nr-shell--public .form-sub-card { padding: 24px 26px }` — padding interno dos cards, permanece como está (confirmado pelo usuário).
- `.nr-shell--public .single-request-form { gap: 18px }` — espaço entre os cards empilhados, permanece como está.
- `.login-page { padding-bottom: calc(var(--public-footer-height) + 10px) }` — espaço reservado pro rodapé fixo em si; necessário para a página não ficar coberta pelo footer, não é espaço desperdiçado.
- Qualquer remoção de scroll — o container continua rolável quando necessário.

## Leitura de contexto

- `/AGENT.md` (raiz) — mesmo contexto de planos anteriores nesta sessão.
- `frontend/AGENT.md` / `backend/AGENT.md` — não existem neste repo.
- Mapa de espaçamentos investigado em `src/styles.css`:
  - `.public-service-panel .nr-nav-row` (~22179): `margin: 12px 0 0` — alvo 1.
  - `.public-service-panel` (~21680): `padding: 0 0 42px` — alvo 2, maior espaço vazio isolado identificado.
  - `.nr-shell--public .form-sub-card` (~21237): `padding: 24px 26px; gap: 18px` — fora de escopo, não tocar (confirmado).
  - `.nr-shell--public .single-request-form` (~21244): `gap: 18px` — fora de escopo, não tocar.
  - `.login-page` (~615): `padding-top: var(--public-header-height); padding-bottom: calc(var(--public-footer-height) + 10px)` — espaço reservado pro rodapé fixo, fora de escopo.

## Impacto por área

### Frontend

- **`src/styles.css`**: ajuste pontual de `margin`/`padding` em `.public-service-panel .nr-nav-row` e `.public-service-panel`. Sem mudança de JSX, sem mudança de lógica/comportamento.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css` — blocos `.public-service-panel .nr-nav-row` (~22179) e `.public-service-panel` (~21680).

## Estratégia de implementação

1. Reconfirmar com grep as linhas atuais dos dois blocos (podem ter deslocado por edições paralelas de outra sessão).
2. Reduzir `.nr-nav-row { margin-top: 12px }` para um valor menor (ex.: 6-8px).
3. Reduzir `.public-service-panel { padding-bottom: 42px }` para um valor menor (ex.: 16-20px).
4. Rodar grep de `.public-service-panel`/`.nr-nav-row` no arquivo inteiro para confirmar que não sobrou versão antiga/duplicada competindo com a mudança.
5. Rodar `typecheck` e `build`.
6. Validar visualmente (ou pela leitura do CSS resultante) que a barra de botões fica próxima do card e do rodapé, sem ficar colada/apertada demais, e que o scroll continua funcionando quando necessário.

## Regras de negócio identificadas

Nenhuma — é ajuste puramente visual de espaçamento, sem alterar dado, validação ou comportamento funcional.

## Regras multi-tenant e segurança

Sem impacto — não há dado de tenant/permissão envolvido.

## Validações necessárias

- Confirmar que o espaço entre o card e a barra de botões diminuiu perceptivelmente.
- Confirmar que o espaço entre a barra de botões e o rodapé diminuiu perceptivelmente.
- Confirmar que `.form-sub-card`/`.single-request-form`/`.login-page` não foram alterados.
- Confirmar que o scroll do painel continua funcionando quando o conteúdo excede o espaço disponível.

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

- Baixo risco — mudança pequena e escopada a 2 propriedades.
- `.public-service-panel { padding-bottom }` é compartilhado por todas as etapas do formulário público (não só Animal), mas é o container externo genérico do painel — reduzir esse respiro final é esperado e aceitável em todas as etapas.
- Trabalho de outra sessão paralela pode estar mexendo no mesmo arquivo — isolar as próprias edições (stash/patch parcial) antes de qualquer commit via skill `finalizar`.
- Push é direto em `main`, sem `staging` — qualquer regressão visual é imediatamente visível em produção.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Critérios de aceite do plano

- Espaço entre card e barra de botões reduzido.
- Espaço entre barra de botões e rodapé reduzido.
- `.form-sub-card`, `.single-request-form`, `.login-page` intocados.
- `typecheck` e `build` passam sem novos erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não executar migrations (não aplicável).
- Reconfirmar linhas atuais com grep antes de editar.
- Não tocar em `.form-sub-card`, `.single-request-form`, `.login-page` — usuário confirmou explicitamente que essa parte não deve mudar.
- Isolar as próprias edições de qualquer trabalho não commitado de outra sessão presente no mesmo arquivo, antes de qualquer commit via skill `finalizar`.
- Seguir a regra de comunicação silenciosa da skill `implementar`.
