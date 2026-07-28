# Plano de Implementacao: Padronizar Modais de Configurar Ambiente

## Origem

- Arquivo de especificacao: pedido direto no chat com screenshot do modal de documento
- Data do planejamento: 2026-07-28
- Classificacao: `frontend-only`

## Resumo

Padronizar os modais de `Configuracoes > Configurar Ambiente` usando o modal de criar/editar documento como referencia visual. O modal de documento tambem deve usar mais area vertical para ampliar os campos de criterios. A mudanca e somente frontend, sem alterar regras de negocio, backend, banco, contratos de dados ou salvamento.

## Escopo

### Dentro do escopo

- Aumentar a area vertical util do modal de documento.
- Dar mais espaco aos campos de criterios obrigatorios e recusa.
- Padronizar visualmente os modais de ambiente:
  - municipio/dados gerais;
  - agenda;
  - tipo de solicitacao;
  - especies;
  - portes;
  - documentos solicitados.
- Usar um shell comum inspirado no modal de documento:
  - fundo branco simples;
  - borda suave;
  - sombra leve;
  - fechar vermelho;
  - rodape de acoes consistente;
  - botoes arredondados;
  - inputs compactos;
  - toggles no topo quando fizer sentido.
- Remover CSS morto, duplicado ou sobreposto dos modais revisados.
- Preservar responsividade e scroll interno em desktop/mobile.

### Fora do escopo

- Alterar backend, endpoints ou contratos de API.
- Alterar banco de dados ou migrations.
- Alterar regras de negocio de agenda, documentos, especies, portes ou municipios.
- Criar novos campos.
- Alterar permissoes ou fluxo multi-tenant.
- Refatorar toda a tela de configuracoes fora dos modais.

## Leitura de contexto

- `/AGENT.md`
- `/frontend/AGENT.md`: nao encontrado no workspace
- `.agents/skills/planejar/SKILL.md`
- `src/App.tsx`
- `src/styles.css`

## Impacto por area

### Frontend

Impacto em JSX e CSS dos modais de configuracao.

Alteracoes esperadas:

- Ajustar `configModal === "document"` para usar mais altura vertical e criterios maiores.
- Reaproveitar o padrao visual do modal de documento nos outros modais.
- Reduzir wrappers visuais desnecessarios, especialmente cards dentro de cards.
- Consolidar estilos de `.config-modal`, `.config-modal.compact`, `.agenda-config-modal`, `.request-type-modal`, `.document-analysis-modal`, `.config-modal-options`, `.agenda-modal-block` e secoes relacionadas.
- Manter estados de formulario, submit, cancelamento e fechamento como estao.

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

1. Conferir o estado do repositorio antes de editar, pois existem alteracoes pendentes recentes em relatorios que devem ser separadas ou tratadas conscientemente.
2. Mapear todos os modais acionados por `configModal` dentro de `ConfigView`.
3. Definir um padrao comum de shell para modais de ambiente:
   - largura por tipo de modal;
   - altura maxima;
   - header;
   - corpo rolavel;
   - rodape fixo;
   - fechar vermelho;
   - botoes consistentes.
4. Ajustar primeiro o modal de documento:
   - aumentar `max-height`;
   - melhorar grid vertical;
   - aumentar a area dos criterios;
   - reduzir espacos que nao ajudam leitura;
   - manter decisao automatica compacta.
5. Aplicar o mesmo metodo aos modais menores:
   - municipio;
   - especie;
   - porte.
6. Aplicar o mesmo metodo aos modais mais complexos:
   - agenda;
   - tipo de solicitacao.
7. Remover estilos antigos que ficarem sem uso.
8. Revisar mobile:
   - toggles empilhando corretamente;
   - campos empilhando sem quebrar;
   - rodape sempre acessivel;
   - scroll interno funcionando.
9. Rodar validacoes.

## Regras de negocio identificadas

- Nenhuma regra de negocio deve mudar.
- Os formularios continuam salvando os mesmos campos.
- Toggles continuam alterando os mesmos valores.
- Agenda e mutirao continuam com o mesmo comportamento atual.
- Documento continua usando IA/criterios/confianca como hoje.

## Regras multi-tenant e seguranca

- Sem mudanca de tenant/prefeitura.
- Nao alterar permissoes.
- Nao alterar origem dos dados por municipio.
- Nao alterar backend, banco, `.env`, deploy ou migrations.

## Validacoes necessarias

- Modal de documento ocupa mais altura vertical e criterios ganham mais area.
- Modal de documento preserva scroll interno e rodape.
- Modais de municipio, agenda, tipo de solicitacao, especie e porte usam o mesmo padrao visual.
- Fechar vermelho aparece de forma consistente.
- Botoes `Cancelar` e `Salvar` mantem padrao comum.
- Inputs/toggles mantem usabilidade em desktop e mobile.
- Nao ha card dentro de card desnecessario.
- Nao ha CSS novo empilhado no fim do arquivo quando for possivel consolidar no bloco existente.

## Testes necessarios

### Frontend

- Validacao visual desktop dos modais de ambiente.
- Validacao visual mobile dos modais de ambiente.
- Confirmar que salvar/cancelar/fechar continuam funcionando.
- Confirmar que agenda com recorrencia, dia especifico e mutirao continua utilizavel.
- Confirmar que criterios do documento aceitam texto longo sem cortar.

### Backend

Sem testes backend esperados.

### E2E

Nao obrigatorio para este ajuste visual, mas desejavel futuramente para cobrir configuracoes de ambiente.

## Comandos de validacao sugeridos

```bash
git diff --check
npm run typecheck
npm run build
```

## Riscos e pontos de atencao

- `src/App.tsx` e `src/styles.css` sao arquivos grandes e acumulam estilos historicos; manter mudancas pequenas e focadas.
- O modal de agenda possui bastante conteudo e pode quebrar em mobile se o scroll/rodape nao forem preservados.
- Existem alteracoes pendentes recentes em `src/features/reports.tsx` e `src/styles.css`; a implementacao deve isolar o escopo antes de commit.
- Remover CSS duplicado exige checar se seletores ainda sao usados por outras telas.
- Push e commit sao feitos direto em `main` quando a skill `finalizar` for usada.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Criterios de aceite do plano

- Modal de documento usa mais area vertical.
- Campos de criterios ficam maiores e mais confortaveis.
- Todos os modais de `Configurar Ambiente` seguem o mesmo padrao visual.
- Nao ha duplicacao visual grosseira nem cards desnecessarios dentro de cards.
- Nenhum comportamento funcional e alterado.
- Sem backend, banco, migrations ou novas dependencias.
- `git diff --check`, `npm run typecheck` e `npm run build` passam.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Nao executar migrations.
- Nao alterar backend.
- Nao criar dependencia.
- Preservar alteracoes pendentes nao relacionadas ou separar claramente se fizerem parte de outro pedido.
- Consolidar CSS nos blocos existentes, evitando overrides empilhados no fim do arquivo.
