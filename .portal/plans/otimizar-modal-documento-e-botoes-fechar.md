# Plano de Implementacao: Otimizar Modal de Documento e Botoes de Fechar

## Origem

- Arquivo de especificacao: `conversa: pedido para enxugar modal de documento, compactar decisao automatica e padronizar botoes X`
- Data do planejamento: `2026-07-28`
- Classificacao: `frontend-only`

## Resumo

Refatorar a estrutura visual do modal de documento para reduzir camadas desnecessarias, liberar mais area util para os criterios de analise e compactar a secao de decisao automatica. Padronizar tambem os botoes de fechar (`X`) com um visual vermelho suave e consistente nos modais/drawers, sem alterar regras de negocio, backend, banco, IA ou contratos de dados.

## Escopo

### Dentro do escopo

- Reduzir wrappers/divs no bloco `Criterios de analise` do modal de documento.
- Remover pelo menos duas camadas estruturais ou visuais desnecessarias no trecho dos criterios.
- Aumentar a area util dos textareas de criterios obrigatorios e de recusa.
- Compactar a secao `Decisao automatica`, mantendo titulo, slider e percentual.
- Padronizar botoes de fechar (`X`) em modais e drawers com vermelho suave.
- Revisar classes avulsas de fechar para alinhar o visual ao padrao central.
- Preservar responsividade mobile e scroll interno do modal.

### Fora do escopo

- Alterar regras de validacao de documentos.
- Alterar IA, OCR, Anthropics, backend ou banco de dados.
- Alterar salvamento dos campos do documento.
- Alterar permissoes, endpoints, schemas ou migrations.
- Redesenhar telas completas fora dos botoes de fechar.
- Padronizar botoes de exclusao/remocao que nao sejam acao de fechar.

## Leitura de contexto

Arquivos de contexto lidos:

- `/AGENT.md`
- `.agents/skills/planejar/SKILL.md`
- `src/App.tsx`
- `src/styles.css`
- `src/components/ui.tsx`

Observacao: `frontend/AGENT.md` foi verificado e nao existe no workspace atual.

## Impacto por area

### Frontend

Impacto esperado somente no frontend:

- Modal de documento em `configModal === "document"`.
- Componente `DocumentCriteriaColumn`.
- Componente `DocumentConfidenceSlider`.
- Componente compartilhado `ModalHeader`, se necessario apenas para centralizar padrao de fechar.
- CSS do modal documental e dos botoes de fechar em `src/styles.css`.
- Estados de formulario e salvamento devem permanecer iguais.
- O campo `minimumConfidence` continua sendo controlado pelo mesmo slider.
- O bloco `Decisao automatica` continua condicionado a `newDocument.useAi !== false`.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

Atencao: migrations nao devem ser executadas sem confirmacao explicita do usuario, pois o ambiente atual pode estar apontando para producao.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/styles.css`
- `src/components/ui.tsx`, somente se for necessario centralizar o padrao do botao fechar no `ModalHeader`.

## Estrategia de implementacao

1. Revisar o estado atual do diff antes de editar, pois existem alteracoes pendentes em `src/App.tsx` e `src/styles.css` relacionadas ao ajuste anterior do percentual da barra.
2. No modal de documento, trocar a secao de criterios para usar uma classe especifica, por exemplo `document-modal-panel--criteria`.
3. Remover o wrapper `document-criteria-grid` e fazer a propria secao de criterios controlar o grid das duas colunas.
4. Simplificar `DocumentCriteriaColumn`, reduzindo ao menos uma camada interna de markup no cabecalho dos criterios.
5. Ajustar CSS dos criterios para reduzir padding/gaps, preservar bordas suaves e ampliar a area util dos textareas.
6. Compactar `document-modal-panel--decision`, reduzindo padding/gap e mantendo slider + percentual em linha eficiente.
7. Revisar o padrao base `.modal-header-close` para vermelho suave.
8. Mapear e ajustar botoes avulsos de fechar: `irm-close-btn`, `prm-close-btn`, `assign-modal-close`, `cr-modal-close`, `toast-close` e botao do drawer de adocao quando forem realmente botoes de fechar.
9. Evitar aplicar o padrao vermelho a botoes destrutivos de excluir/remover, para nao misturar semanticas.
10. Conferir mobile: criterios empilhando corretamente, sem scroll horizontal e com acoes do modal acessiveis.
11. Rodar validacoes.

## Regras de negocio identificadas

- O modal continua salvando os mesmos campos do documento.
- `requiredCriteria` e `rejectionCriteria` continuam sendo texto por linha convertido por `textToCriteriaList`.
- `minimumConfidence` continua variando de 0 a 100.
- `Decisao automatica` continua aparecendo somente quando `Usar Analise por IA` esta ativo.
- Nenhuma regra de aprovacao, recusa, revisao manual ou analise por IA deve ser alterada.

## Regras multi-tenant e seguranca

Sem alteracao de tenant, prefeitura, permissao, autenticacao ou dados sensiveis.

Cuidados:

- Nao alterar chamadas de API.
- Nao alterar payloads enviados pelo formulario.
- Nao alterar logica de permissao ou exibicao por role.
- Nao alterar `.env`, secrets, certificados ou configuracoes de deploy.

## Validacoes necessarias

- Confirmar que os campos `name`, `expectedDocument`, `active`, `required`, `useAi`, `requiredCriteria`, `rejectionCriteria` e `minimumConfidence` continuam sendo atualizados como antes.
- Confirmar que o slider continua acessivel por teclado/foco.
- Confirmar que o percentual continua visivel ao lado direito da barra.
- Confirmar que o modal nao cria scroll horizontal em desktop ou mobile.
- Confirmar que botoes de fechar continuam com `aria-label="Fechar"` ou equivalente.
- Confirmar que botoes de excluir/remover nao receberam o padrao de fechar indevidamente.

## Testes necessarios

### Frontend

- Validacao visual do modal de documento em desktop.
- Validacao visual do modal de documento em mobile.
- Validacao visual dos botoes `X` em pelo menos tres superficies: `ModalHeader`, modal interno de solicitacao e drawer/modal de adocao.
- Validar foco/hover dos botoes de fechar.
- Validar slider de decisao automatica com mouse e teclado.

### Backend

- Sem testes backend necessarios.

### E2E

- Sem E2E obrigatorio para este ajuste visual, mas e recomendado conferir manualmente o fluxo de abrir/fechar modais principais.

## Comandos de validacao sugeridos

```bash
git diff --check
npm run typecheck
npm run build
```

Observacao: no `package.json` atual nao existem scripts `lint` ou `test`.

## Riscos e pontos de atencao

- O vermelho do `X` pode parecer acao destrutiva se for forte demais. Usar vermelho suave no estado normal e vermelho mais evidente apenas no hover/focus.
- O CSS possui camadas historicas e overrides duplicados; preferir consolidar seletores existentes em vez de adicionar novos overrides no fim do arquivo.
- Alguns botoes de fechar sao customizados por modal. Ajustar somente os que forem claramente acao de fechar.
- Remover wrappers do bloco de criterios pode quebrar mobile se o grid nao for migrado com cuidado.
- O projeto faz push direto em `main` quando a skill `finalizar` e usada; manter mudancas pequenas e revisaveis.

## Perguntas em aberto

- O `toast-close` deve receber o mesmo vermelho suave dos modais ou deve ficar fora por ser notificacao, nao modal?
- O texto auxiliar de `Decisao automatica` deve permanecer sempre visivel ou pode ser ainda mais discreto em uma linha menor?

## Criterios de aceite do plano

A implementacao deve ser considerada pronta quando:

- O bloco `Criterios de analise` tiver menos camadas de markup e pelo menos duas estruturas desnecessarias removidas/consolidadas.
- Os textareas de criterios tiverem mais area util visivel.
- A secao `Decisao automatica` ocupar menos altura mantendo titulo, barra e percentual.
- O percentual do slider permanecer visivel ao lado direito da barra.
- Botoes de fechar principais seguirem um padrao vermelho suave e consistente.
- Botoes destrutivos de excluir/remover nao forem alterados por engano.
- Desktop e mobile continuarem sem quebra visual ou scroll horizontal.
- `git diff --check`, `npm run typecheck` e `npm run build` passarem.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Nao alterar backend, banco, IA, endpoints, permissoes ou migrations.
- Nao executar migrations sem confirmacao explicita.
- Preservar as alteracoes pendentes atuais em `src/App.tsx` e `src/styles.css` relativas ao percentual do slider.
- Fazer mudancas pequenas, focadas e revisaveis.
- Preferir consolidar CSS existente a criar overrides finais empilhados.
- Usar `/AGENT.md` como regra operacional do projeto.
