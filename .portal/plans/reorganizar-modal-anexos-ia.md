# Plano de Implementacao: Reorganizar Modal de Anexos com Analise por IA

## Origem

- Arquivo de especificacao: `conversa atual / captura de tela do modal de processo`
- Data do planejamento: `2026-07-28`
- Classificacao: `frontend-only`

## Resumo

Reorganizar visualmente o modal de processo para deixar a aba de anexos mais clara, compacta e facil de operar. Cada documento deve exibir sua propria conclusao da IA, informando quando foi aprovado pelos criterios cadastrados e deixando evidente que a revisao manual e opcional nesses casos.

## Escopo

### Dentro do escopo

- Ajustar a apresentacao dos documentos no modal de processo.
- Exibir mensagem individual por documento aprovado pela IA: `IA aprovou este documento pelos criterios cadastrados. Revisao manual opcional.`
- Exibir mensagens objetivas para documentos pendentes, recusados ou ausentes.
- Compactar espacos verticais e reduzir informacao sobreposta.
- Padronizar botoes e acoes dentro do modal.
- Separar visualmente acao de indeferir solicitacao das acoes de visualizar, baixar, aprovar ou recusar documento.
- Melhorar alinhamento de status, confianca, criterios e botoes.

### Fora do escopo

- Alterar backend.
- Alterar banco de dados.
- Alterar integracao com Anthropic ou qualquer provedor de IA.
- Alterar regras de aprovacao automatica.
- Alterar salvamento dos dados.
- Alterar PDFs ou relatorios.
- Criar novas permissoes.

## Leitura de contexto

- `/AGENT.md`
- `/frontend/AGENT.md`: nao encontrado no repositorio
- `src/App.tsx`
- `src/styles.css`

## Impacto por area

### Frontend

O impacto fica concentrado no `RequestPreviewModal`, especialmente na renderizacao da aba `Anexos`.

Mudancas esperadas:

- Criar ou ajustar helpers locais para identificar o estado visual de cada anexo.
- Reorganizar `renderAttachments()` para separar:
  - cabecalho do documento;
  - status da IA;
  - confianca;
  - mensagem curta;
  - criterios;
  - acoes.
- Ajustar classes CSS `.prm-modal`, `.process-attachment-*`, `.attachment-ai-*`, `.doc-decision-btn`, `.icon-action` e `.prm-action-btn`.
- Manter responsividade mobile.
- Evitar alteracoes globais fora do escopo do modal.

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

## Estrategia de implementacao

1. Localizar `RequestPreviewModal` em `src/App.tsx`.
2. Ajustar a logica visual dos anexos sem mudar contrato de dados.
3. Adicionar mensagem individual para documento aprovado pela IA:
   `IA aprovou este documento pelos criterios cadastrados. Revisao manual opcional.`
4. Para documentos recusados, pendentes ou ausentes, exibir texto curto e claro sobre a pendencia.
5. Reorganizar o markup de cada anexo para reduzir sobreposicao:
   - topo: nome, status e confianca;
   - corpo: mensagem curta;
   - base: criterios compactos;
   - lado direito: acoes padronizadas.
6. Padronizar botoes do modal com um unico sistema visual:
   - botoes de icone com mesmo tamanho;
   - botao fechar vermelho;
   - acoes neutras para visualizar/baixar;
   - acoes destrutivas em vermelho;
   - acao principal em destaque.
7. Reduzir padding, gaps e margens excessivas na aba de anexos.
8. Garantir que `indeferir solicitacao` nao concorra visualmente com `recusar documento`.
9. Ajustar estilos mobile para empilhar informacoes sem quebrar layout.
10. Rodar validacoes.

## Regras de negocio identificadas

- Documento aprovado pela IA deve ser tratado como aprovado automaticamente.
- Revisao manual em documento aprovado pela IA e opcional.
- Documento obrigatorio recusado, pendente ou ausente bloqueia confirmacao da agenda.
- Indeferimento pode ocorrer por anexo especifico ou em lote pelos documentos bloqueantes.
- A aba `Procedimento e saude` so deve ficar acessivel apos confirmacao da agenda.

## Regras multi-tenant e seguranca

Sem impacto esperado em multi-tenant, pois a mudanca e somente visual no frontend.

Cuidados:

- Nao alterar origem dos dados da prefeitura/tenant.
- Nao alterar permissoes.
- Nao alterar chamadas de API.
- Nao alterar dados persistidos.

## Validacoes necessarias

- Documento aprovado pela IA mostra mensagem individual correta.
- Documento sem envio mostra mensagem objetiva.
- Documento pendente ou recusado continua bloqueando confirmacao da agenda.
- Botoes de visualizar, baixar, aprovar, recusar e indeferir ficam alinhados.
- Footer mantem acoes coerentes por status do processo.
- Modal nao ganha espacos mortos nem desalinhamento em desktop.
- Layout mobile nao corta acoes nem textos principais.

## Testes necessarios

### Frontend

- Validacao visual/manual do modal com processo `NOVA`.
- Validacao visual/manual do modal com processo `AGENDADA`.
- Validacao visual/manual com documento aprovado pela IA.
- Validacao visual/manual com documento pendente, recusado e ausente.

### Backend

- Sem testes backend esperados.

### E2E

- Fluxo de abrir processo novo, revisar anexos e confirmar agenda.
- Fluxo de indeferir por documento obrigatorio pendente ou recusado.

## Comandos de validacao sugeridos

```bash
git diff --check
npm run typecheck
npm run build
```

## Riscos e pontos de atencao

- Risco de confundir visualmente `recusar documento` com `indeferir solicitacao`.
- Risco de esconder criterios demais e prejudicar auditoria; a solucao deve compactar, nao remover.
- Risco de alterar botoes globais por acidente; estilos devem ficar restritos ao `.prm-modal`.
- Risco de regressao mobile se a linha de anexo ficar dependente de largura fixa.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Criterios de aceite do plano

A implementacao deve ser considerada pronta quando:

- Cada documento aprovado pela IA exibir mensagem clara de aprovacao e revisao opcional.
- A tela de anexos estiver mais compacta, alinhada e sem informacao sobreposta.
- Os botoes do modal estiverem padronizados em tamanho, raio, borda e peso visual.
- A acao de indeferir solicitacao estiver visualmente separada das acoes do documento.
- A confirmacao de agenda continuar respeitando documentos bloqueantes.
- `git diff --check`, `npm run typecheck` e `npm run build` passarem.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Nao alterar backend, banco de dados, IA, PDFs ou contratos de API.
- Manter alteracoes pequenas e focadas em `src/App.tsx` e `src/styles.css`.
- Nao criar dependencias novas.
- Nao executar migrations.
- Nao fazer commit ou push nesta etapa.
