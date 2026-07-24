# Plano de Implementação: Unificar "Adicionar animal" / "Remover animal" / "Continuar" na mesma linha (etapa Animal, fluxo público)

## Origem

- Arquivo de especificação: nenhum — pedido direto do usuário na conversa
- Data do planejamento: 2026-07-24
- Classificação: `frontend-only`

## Resumo

Hoje, "Adicionar animal"/"Remover animal" ficam numa linha (`.anm-actions-row`) dentro do conteúdo da etapa Animal, e "Continuar" fica numa segunda linha separada (`.nr-nav-row`), abaixo, com seu próprio espaçamento — essa segunda linha é **compartilhada por todas as etapas do wizard** (Tutor/Agenda/Documentos também usam, com "Voltar" e, na última etapa, "Enviar"). O usuário quer os três botões (Adicionar, Remover, Continuar) na mesma linha, só na etapa Animal.

## Escopo

### Dentro do escopo

- Fluxo **público** (`publicFlow`) apenas, etapa **Animal** (`formStep === 1`) apenas — consistente com o resto da sessão, que só mexeu no fluxo público.
- Renderizar "Continuar" dentro da mesma linha de "Adicionar animal"/"Remover animal", reaproveitando a mesma função (`goToNextStep`) e o mesmo estilo (`.nr-topbar-continue`) já usados hoje.
- Suprimir a renderização da `.nr-nav-row` genérica **somente quando** `publicFlow && formStep === 1` (nas outras etapas — Tutor/Agenda/Documentos — ela continua exatamente como está, incluindo "Voltar"/"Enviar").
- Ajuste de CSS para a nova linha de 3 botões (largura/alinhamento).

### Fora do escopo

- Modal interno do staff (`internalSimple`): lá, "Animal" **não é** a primeira etapa (é a etapa 1, depois de "Tutor"), então "Voltar" aparece — mesclar exigiria replicar também a lógica de "Voltar" ali, o que não foi pedido e muda um fluxo que não foi tocado nesta sessão. Fica com o layout atual (duas linhas separadas).
- Etapas Tutor/Agenda/Documentos — mantêm a `.nr-nav-row` exatamente como está hoje (com "Voltar" quando aplicável, e "Enviar"/"Encerrar" na última etapa).
- Qualquer mudança de validação: o clique em "Continuar" continua chamando `goToNextStep`, que já bloqueia o avanço se faltar campo obrigatório (mesmo comportamento de hoje, só muda a posição visual do botão).

## Leitura de contexto

- `/AGENT.md` — fluxo direto em `main`, sem staging/PR
- `src/App.tsx`:
  - `formSteps` (~L3074-3095): confirma que, no fluxo público, "Animal" é **sempre** a primeira etapa (`currentStepIndex === 0`) — ou seja, "Voltar" nunca aparece na etapa Animal pública hoje, o que simplifica a mesclagem (não precisa replicar "Voltar" ali).
  - `goToNextStep`/`currentStepIndex` (~L3096, 3323-3328): lógica de avanço reaproveitada sem alteração.
  - Bloco `.anm-actions-row` (~L3945-3963): onde "Adicionar animal"/"Remover animal" são renderizados hoje.
  - Bloco `.nr-nav-row` (~L4042-4073): "Voltar"/"Continuar"/"Enviar", renderizado uma vez por formulário (fora do `FormSection`), compartilhado por todas as etapas.
- `src/styles.css`: `.anm-actions-row` (regra pública, adicionada nesta sessão), `.nr-nav-row` (público, ~L17594-17604, reajustada na mensagem anterior).

## Impacto por área

### Frontend

- `src/App.tsx`:
  - Dentro do bloco `formStep === 1` (dentro do `FormSection`), adicionar o botão "Continuar" (mesmo `onClick={goToNextStep}`, mesma classe `nr-topbar-continue`) ao lado de "Adicionar animal"/"Remover animal" dentro de `.anm-actions-row`, condicionado a `publicFlow`.
  - Envolver a renderização da `.nr-nav-row` genérica (incluindo o `<p className="nr-bottom-error">`) numa condição que a esconda quando `publicFlow && formStep === 1` (ela some da etapa Animal pública, mas continua normal nas outras etapas e no staff).
- `src/styles.css`:
  - Ajustar `.anm-actions-row` (escopo público) para acomodar 3 itens: "Adicionar"/"Remover" continuam dividindo o espaço à esquerda (como hoje), "Continuar" fica com largura própria (não esticada) à direita — reaproveitando o padding lateral de 40px já usado por `.nr-nav-row` para bater com a borda dos cards.
  - Revisar se sobra CSS órfão em `.nr-nav-row` (público) depois que ele deixar de renderizar na etapa Animal — provavelmente não, já que continua em uso nas outras 3 etapas.

### Backend / Banco de dados / Infra

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/styles.css`

## Estratégia de implementação

1. Mover/duplicar o botão "Continuar" (mesmas props: `onClick={goToNextStep}`, classe `nr-topbar-continue`, sem `disabled` — já que na etapa Animal ele nunca fica desabilitado hoje) para dentro de `.anm-actions-row`, condicionado a `publicFlow`.
2. Condicionar a renderização da `.nr-nav-row` (e do parágrafo de erro que vem antes dela) a `!(publicFlow && formStep === 1)`.
3. Ajustar CSS de `.anm-actions-row` (público) para o layout de 3 itens (Adicionar/Remover flexíveis à esquerda, Continuar com largura própria à direita).
4. Testar via CDP/headless Chrome: 1 animal (Adicionar + Continuar), 2+ animais (Adicionar + Remover + Continuar), clique em Continuar avançando para Tutor normalmente, e confirmar que Tutor/Agenda/Documentos continuam com a `.nr-nav-row` de sempre (Voltar/Continuar/Enviar).
5. Confirmar que o modal interno do staff não foi afetado (a etapa Animal de lá continua com duas linhas separadas).
6. `npm run typecheck` e `npm run build`.

## Regras de negócio identificadas

Nenhuma — é reposicionamento visual de um botão já existente, reaproveitando a mesma função de avanço (`goToNextStep`) e a mesma validação que já existe hoje.

## Regras multi-tenant e segurança

Sem impacto.

## Validações necessárias

- Confirmar que clicar em "Continuar" dentro da nova linha ainda bloqueia o avanço quando falta campo obrigatório (mesma validação de hoje, só testar que o reposicionamento não quebrou o `onClick`).
- Confirmar visualmente que Tutor/Agenda/Documentos (fluxo público) e a etapa Animal do modal do staff continuam inalterados.

## Testes necessários

### Frontend

Sem testes automatizados novos (projeto não tem suíte configurada).

### E2E

- CDP/headless Chrome: etapa Animal com 1 e 2+ animais, clique em "Continuar" avançando corretamente, demais etapas e modal do staff inalterados.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Se o usuário mudar o tipo de solicitação configurado de forma que "Animal" deixe de ser a primeira etapa no fluxo público (hoje sempre é, mas a ordem vem de `formSteps`, que depende de config), a suposição "nunca tem Voltar aqui" deixaria de valer — não é o caso hoje, mas vale registrar.
- Push para `origin/main` segue bloqueado por permissão (403) desta sessão — commits ficam pendentes até o usuário resolver o acesso.

## Perguntas em aberto

Nenhuma — usuário aprovou o layout proposto (Adicionar/Remover à esquerda dividindo espaço, Continuar com largura própria à direita).

## Critérios de aceite do plano

- Na etapa Animal pública, "Adicionar animal", "Remover animal" (quando visível) e "Continuar" aparecem na mesma linha.
- Tutor/Agenda/Documentos (fluxo público) e a etapa Animal do modal do staff continuam exatamente como estão hoje.
- Clique em "Continuar" continua avançando/validando exatamente como hoje.
- `npm run typecheck` e `npm run build` passam sem erros novos.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Escopar tudo a `publicFlow && formStep === 1` — não tocar no modal do staff nem nas outras etapas.
- Reaproveitar `goToNextStep`/classe `nr-topbar-continue` — não duplicar lógica de validação.
- Não commitar/dar push — isso é responsabilidade da skill `finalizar`, só quando solicitado.
