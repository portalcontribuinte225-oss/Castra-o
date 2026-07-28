# Plano de Implementação: Limpeza do fluxo de cadastro (NewRequest) — CSS duplicado e código morto

## Origem

- Arquivo de especificação: sem `.md` externo — originado de revisão feita pela skill `limpar` nesta conversa, a partir do pedido do usuário ("readeque os espaços para as descrições das etapas, estão ficando cortadas" no stepper Animal/Tutor/Agenda/Documentos)
- Data do planejamento: 2026-07-28
- Classificação: `frontend-only`

## Resumo

O componente `NewRequest` (`src/App.tsx`, linhas ~3237-4462) e o CSS relacionado a ele (`src/styles.css`) acumularam múltiplas gerações de redesign nunca limpas. O sintoma relatado pelo usuário (texto cortado no stepper "1 ANIMAL / 2 TUTOR / 3 AGENDA / 4 DOCUMENTOS", com fundo/borda indesejados) é consequência direta de **8 blocos concorrentes** de CSS para as mesmas classes `.nr-step*`, incluindo cadeias de `!important` empilhadas em vez de correção na raiz. Este plano consolida cada grupo de classes em uma única regra vigente por contexto de layout (genérico / `.internal-request-modal` / `.public-form-page` / `.public-service-panel`), remove os `!important` redundantes, e remove código morto identificado no mesmo componente (`useCurrentLocation`, `locationStatus`, props `municipalities`/`onMunicipalitySelect` não usadas).

## Escopo

### Dentro do escopo

- Consolidar `.nr-stepper`, `.nr-step`, `.nr-step--current`, `.nr-step--done`, `.nr-step--invalid`, `.nr-step-circle`, `.nr-step-label`, `.nr-step-connector` em uma única regra vigente por contexto, removendo os blocos tornados inalcançáveis.
- Remover a cadeia de `!important` acoplada em `.nr-step--current` (blocos ~15803, ~17289, ~17297, ~17899), preservando o comportamento visual atual em cada contexto (genérico, `.internal-request-modal`, `.public-form-page` mobile).
- Remover o "lock" tardio com `!important` sobre `.nr-shell`/`.nr-topbar--internal`/`.nr-body` (~24758-24777), corrigindo a regra-base em vez de sobrepor, se viável sem quebrar tema.
- Consolidar `.nr-topbar-continue` (botão "Continuar") nas gerações redundantes (~2804, ~17072, ~17456, ~24707, ~25483, ~26221) em uma única regra vigente por contexto.
- Remover código morto em `NewRequest`: função `useCurrentLocation` (nunca chamada), state `locationStatus` (nunca populado por outro caminho) e os dois blocos JSX condicionais que dependem dele (~4102, ~4154).
- Remover props não utilizadas `municipalities` e `onMunicipalitySelect` da assinatura de `NewRequest`, e dos callers que as passam sem necessidade.
- Validar visualmente (via build local) que o stepper deixa de cortar/sobrepor texto nas 4 variantes de layout onde é usado (modal interno, formulário público completo, painel de serviço público, e o layout genérico/compacto).

### Fora do escopo

- `.access-field`, `.animal-form`, `.animal-choice-grid` e demais classes de campo do wizard com duplicação suspeita (achado de menor confiança, recomendado para um plano futuro separado — não faz parte desta limpeza).
- Qualquer mudança de comportamento/lógica de negócio do formulário (validações, regras de submit, fluxo de etapas).
- Qualquer alteração em outros componentes fora de `NewRequest` e do CSS `.nr-*` correlato.
- Alterações no restante do trabalho pendente de outra sessão paralela, identificado como não-commitado em `src/App.tsx`/`src/styles.css` no momento deste planejamento (slider de confiança de documento, normalização de unicode literal) — não tocar nesses trechos.

## Leitura de contexto

- `/AGENT.md` (raiz) — lido (mesmo contexto do plano anterior nesta sessão: template genérico staging/PR, prática real do projeto é commit direto em `main`).
- `frontend/AGENT.md` / `backend/AGENT.md` — não existem neste repo.
- Levantamento produzido por agente de exploração dedicado nesta conversa, mapeando com números de linha precisos (grep direto, não aproximação):
  - Todas as definições de `.nr-stepper`, `.nr-step`, `.nr-step--current/--done/--invalid`, `.nr-step-circle`, `.nr-step-label`, `.nr-step-connector`, `.nr-shell`, `.nr-shell--internal`, `.nr-shell--public`, `.nr-topbar`, `.nr-topbar-continue`, `.nr-back-btn`, `.nr-home-btn`, `.nr-body`, `.nr-bottom-error`, `.nr-nav-row` em `src/styles.css`, com a regra vencedora identificada por contexto.
  - Leitura completa do componente `NewRequest` (`src/App.tsx:3237-4462`) para código morto, props não usadas, `console.log`/`debugger` (nenhum encontrado) e comentários obsoletos (nenhum dentro do range).
- **Importante:** os números de linha listados abaixo refletem o estado do arquivo no momento do levantamento (antes de qualquer edição desta sessão). Como o CSS tem ~26 mil linhas, qualquer edição anterior a outra desloca as linhas subsequentes — a skill `implementar` deve reconfirmar cada linha com grep pontual imediatamente antes de editar, não confiar cegamente nos números abaixo.

## Impacto por área

### Frontend

- **`src/styles.css`**: consolidação de regras `.nr-*` em 8 blocos (~2946, ~13125, ~15756/15783, ~16722/16749, ~17238/17265, ~17843/17876, ~22272/22305, ~26686-26733) para 4 blocos vigentes (um por contexto de layout: genérico, `.internal-request-modal`, `.public-form-page`, `.public-service-panel`). Remoção de `!important` redundante em `.nr-step--current` (4 ocorrências) e no lock tardio de `.nr-shell`/`.nr-topbar--internal`/`.nr-body` (~24758-24777), se a correção na raiz não quebrar nenhum dos 4 contextos. Consolidação de `.nr-topbar-continue` (6 gerações → 1 por contexto).
- **`src/App.tsx`**: remoção de `useCurrentLocation` (~3644-3663), state `locationStatus` (~3323) e os 2 blocos JSX condicionais dependentes (~4102, ~4154); remoção das props `municipalities`/`onMunicipalitySelect` da assinatura de `NewRequest` (~3243, ~3245) e ajuste dos callers (~2472-2482 e chamada interna equivalente) que hoje as passam sem necessidade.
- Sem impacto em hooks de rede, React Query, formulários Zod/RHF — é limpeza de CSS e remoção de código morto, não mudança de comportamento.
- Estados de loading/error/empty do formulário não são afetados (o `locationStatus` removido nunca teve efeito visível em produção).

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css` — consolidação de ~8 blocos duplicados de `.nr-*` em 4, remoção de `!important` redundante.
- `src/App.tsx` — remoção de função/state/JSX morto e props não usadas em `NewRequest`; ajuste dos 1-2 callers que passam `municipalities`/`onMunicipalitySelect`.

## Estratégia de implementação

1. Reconfirmar com grep, imediatamente antes de editar, a linha atual de cada bloco `.nr-*` listado neste plano (os números podem ter deslocado desde o levantamento).
2. Para cada classe do stepper (`.nr-stepper`, `.nr-step`, `.nr-step--current`, `.nr-step--done`, `.nr-step--invalid`, `.nr-step-circle`, `.nr-step-label`, `.nr-step-connector`): identificar a regra vencedora por contexto (genérico / `.internal-request-modal` / `.public-form-page` / `.public-service-panel`), mesclar nela qualquer propriedade relevante das regras redundantes que só existisse lá, e remover os blocos redundantes — não sobrepor com nova regra.
3. Resolver a cadeia de `!important` de `.nr-step--current`: reescrever a regra-base de cada contexto para já produzir o resultado visual esperado sem precisar de `!important`; testar visualmente cada contexto (modal interno, formulário público, painel de serviço, genérico) antes de remover o `!important` seguinte da cadeia.
4. Aplicar o mesmo tratamento ao lock tardio de `.nr-shell`/`.nr-topbar--internal`/`.nr-body` (~24758-24777) — só remover o `!important` se a regra-base puder ser corrigida sem quebrar nenhum tema/contexto; se a regra "vencida" for de fato compartilhada com componentes fora de escopo, manter o `!important` com comentário explicando o motivo (regra do checklist de CSS da skill `implementar`).
5. Consolidar `.nr-topbar-continue` nas 6 gerações em uma regra vigente por contexto.
6. Remover `useCurrentLocation`, `locationStatus` e os 2 blocos JSX dependentes em `App.tsx`.
7. Remover as props `municipalities`/`onMunicipalitySelect` da assinatura de `NewRequest` e dos callers correspondentes.
8. Rodar grep de cada classe alterada no arquivo `styles.css` inteiro novamente, para confirmar que não sobrou nenhuma versão antiga/duplicada ainda alcançável.
9. Rodar `typecheck` e `build`; testar visualmente (`npm run dev` ou build) o stepper nos 4 contextos de layout, especialmente a etapa "Animal" mostrada na screenshot original (texto não deve mais cortar, sem fundo/borda indesejados).

## Regras de negócio identificadas

Nenhuma regra de negócio nova — é limpeza estrutural preservando o comportamento visual e funcional existente do wizard.

## Regras multi-tenant e segurança

- Sem impacto em tenant/autenticação/permissões — é view pública e interna já existente, sem mudança de dado exibido.
- Ao remover as props `municipalities`/`onMunicipalitySelect`, confirmar que nenhum caller depende de efeito colateral (baixo risco, mas checar antes de remover, conforme já sinalizado no relatório da skill `limpar`).

## Validações necessárias

- Confirmar visualmente que o stepper renderiza corretamente (sem corte de texto, sem fundo/borda indesejados) em: modal de cadastro interno (`.internal-request-modal`), formulário público completo (`.public-form-page`), painel de serviço público (`.public-service-panel`), e layout genérico/compacto.
- Confirmar que a remoção de `locationStatus`/`useCurrentLocation` não deixou nenhum outro ponto do arquivo dependente desses símbolos (grep global).
- Confirmar que os 2 callers de `NewRequest` continuam funcionando sem as props removidas.

## Testes necessários

### Frontend

- Não há suíte de testes de componente identificada para `NewRequest` neste projeto; validação será manual/visual + `typecheck`/`build`, como já é o padrão desta sessão.

### Backend

Sem impacto esperado.

### E2E

Não aplicável — sem suíte Playwright configurada para este fluxo.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
npm run lint
```

## Riscos e pontos de atenção

- **Alto valor, mas requer cautela**: a cadeia de `!important` em `.nr-step--current` tem comentários que **admitem explicitamente** dependência cruzada entre regras — remover sem testar cada contexto pode reintroduzir o próprio bug que este plano resolve (texto cortado) ou quebrar outro contexto que hoje funciona por acaso.
- **Trabalho paralelo no mesmo arquivo**: há mudanças não commitadas de outra sessão em `src/App.tsx`/`src/styles.css` (slider de confiança de documento, normalização de unicode) no momento deste planejamento. A skill `implementar` deve isolar suas próprias edições (mesma técnica de patch parcial já usada nesta sessão) para não colidir nem commitar por engano o que não é desta tarefa.
- **`App.tsx` é monolítico (~12 mil linhas)** e `styles.css` tem ~26 mil linhas — qualquer novo grep antes de editar é obrigatório, pois os números de linha deste plano podem já estar desatualizados no momento da implementação.
- Push é direto em `main`, sem `staging` — qualquer regressão visual no stepper (usado tanto na área pública quanto no admin) é imediatamente visível em produção.
- O achado de menor confiança (`.access-field`/`.animal-form`/`.animal-choice-grid`) foi deliberadamente deixado fora do escopo para não aumentar o raio de risco desta limpeza.

Atenção: migrations não devem ser executadas sem confirmação explícita do usuário, pois o ambiente atual pode estar apontando para produção. (Não aplicável a este plano — não há impacto de banco de dados, mas a regra é mantida por padrão do processo.)

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — o usuário já aprovou o escopo "plano único com tudo confirmado" ao revisar o relatório da skill `limpar`.

## Critérios de aceite do plano

- Stepper "1 ANIMAL / 2 TUTOR / 3 AGENDA / 4 DOCUMENTOS" renderiza sem corte de texto e sem fundo/borda indesejados, nos 4 contextos de layout.
- `.nr-*` reduzido a uma regra vigente por contexto, sem blocos redundantes remanescentes.
- Nenhum `!important` novo introduzido; os `!important` existentes removidos ou (se genuinamente necessários) documentados com comentário explicando o motivo.
- `useCurrentLocation`, `locationStatus` e os 2 blocos JSX dependentes removidos, sem quebrar nenhum outro fluxo.
- Props `municipalities`/`onMunicipalitySelect` removidas de `NewRequest` e dos callers.
- `typecheck` e `build` passam sem novos erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto; usar também o relatório de achados já produzido pela skill `limpar` nesta conversa como referência complementar de contexto (não precisa re-executar a skill `limpar`).
- Reconfirmar cada número de linha com grep pontual antes de editar — este plano foi escrito a partir de um levantamento anterior a qualquer edição.
- Isolar as próprias edições de qualquer trabalho não commitado de outra sessão presente no mesmo arquivo no momento da implementação (mesma técnica de patch parcial/`git apply --cached` já usada nesta sessão, se necessário no momento do commit via skill `finalizar`).
- Testar visualmente o stepper nos 4 contextos antes de considerar concluído — este plano nasceu de um bug visual, então a validação visual é o critério de aceite mais importante, não só typecheck/build.
- Manter a alteração focada no que está listado em "Dentro do escopo" — não expandir para `.access-field`/`.animal-form`/`.animal-choice-grid` nesta rodada.
