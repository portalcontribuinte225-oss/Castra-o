# Plano de Implementacao: Reorganizar Modal de Analise Documental por IA

## Origem

- Solicitação: reorganizar o modal de tipos de documento para ficar mais claro, moderno e coerente com o método visual da home/admin.
- Contexto: o modal atual ficou funcional, mas visualmente pesado, com campos grandes demais, pouca hierarquia e leitura ruim dos critérios.
- Data do planejamento: 2026-07-25
- Classificacao: frontend

## Objetivo

Refatorar o modal de criacao/edicao de documento solicitado para uma experiencia mais organizada, clara e moderna, sem alterar o fluxo de validacao por IA ja implementado.

O foco e melhorar a UX de configuracao dos criterios que a IA usa para analisar documentos.

## Problema Atual

- O modal ficou largo e alto sem uma composicao visual refinada.
- Os campos de texto parecem blocos soltos e pouco guiados.
- Nome, documento esperado, criterios obrigatorios, revisao e recusa competem visualmente.
- Os toggles ficam pouco contextualizados.
- A organizacao nao segue bem o padrao mais polido usado na home/admin, com secoes claras, superficies leves e hierarquia de informacao.

## Escopo

### Dentro do escopo

- Reorganizar apenas o modal de documento em `src/App.tsx`.
- Ajustar CSS relacionado em `src/styles.css`.
- Manter a estrutura de dados `analysisRules`.
- Manter a rota `/api/ai/validate`.
- Manter a regra de um criterio por linha.
- Melhorar legibilidade dos textareas.
- Separar o modal em areas claras:
  - Cabecalho e status.
  - Identificacao do documento.
  - Modelo de analise da IA.
  - Criterios obrigatorios.
  - Criterios de recusa.
  - Revisao manual.
  - Decisao automatica.
- Usar visual coerente com a home/admin:
  - superficies limpas;
  - bordas suaves;
  - grid organizado;
  - espacamento consistente;
  - destaque visual moderado;
  - botoes e toggles no padrao existente.
- Garantir responsividade.

### Fora do escopo

- Alterar backend.
- Alterar prompt/schema da IA.
- Alterar regras de LGPD ja definidas.
- Criar novo componente paralelo permanente.
- Criar endpoint novo.
- Alterar banco ou migrations.
- Alterar a imagem/banner da home.
- Mexer no fluxo de prontuario/procedimento.

## Direcao de UX

### Estrutura Recomendada

O modal deve virar um painel de configuracao em duas camadas:

1. Topo compacto:
   - Titulo.
   - Fechar.
   - Toggles `Obrigatorio/Opcional` e `Ativo/Inativo`.

2. Corpo organizado:
   - Uma coluna esquerda com dados basicos e decisao automatica.
   - Uma area principal para criterios da IA.

### Layout sugerido

Desktop:

```txt
------------------------------------------------------+
| Editar documento                              [x]   |
| [Opcional] [Ativo]                                  |
+------------------------------------------------------+
| Documento                                           |
| Nome                                                |
| Documento esperado                                 |
+----------------------+-------------------------------+
| Criterios obrigatorios | Regras de recusa            |
| textarea maior         | textarea maior              |
+----------------------+-------------------------------+
| Revisao manual                                         |
| textarea horizontal                                    |
+------------------------------------------------------+
| Decisao automatica                                     |
| Confianca minima | Aprovar auto | Recusar auto        |
+------------------------------------------------------+
|                                      Cancelar Salvar |
+------------------------------------------------------+
```

Mobile:

- Todas as secoes empilhadas.
- Textareas com altura confortavel.
- Botoes no rodape sem sobrepor conteudo.

## Regras de Implementacao

- Nao alterar nomes de campos salvos.
- Nao alterar `analysisRules`.
- Nao mudar `createDocumentType`, `openDocumentModal` ou `validateDocumentWithAI` alem do necessario para o layout.
- Evitar textos explicativos longos dentro da UI.
- Usar classes especificas do modal para nao afetar outros modais.
- Evitar card dentro de card; usar secoes limpas com borda leve.
- Nao usar cores fortes demais.
- Manter botoes existentes `ghost-button` e `primary-action`.
- Manter `ConfigActiveToggle`.

## Arquivos Afetados

- `src/App.tsx`
- `src/styles.css`
- `.portal/plans/reorganizar-modal-analise-documental-ia.md`

## Passos

1. Revisar o modal atual de documento em `ConfigView`.
2. Reestruturar o JSX do modal em secoes sem alterar persistencia.
3. Criar classes CSS especificas para:
   - `document-analysis-modal`
   - `document-modal-body`
   - `document-modal-section`
   - `document-identity-grid`
   - `document-criteria-grid`
   - `document-decision-grid`
   - `document-modal-actions`
4. Ajustar textareas com alturas confortaveis.
5. Garantir responsividade em telas menores.
6. Rodar:
   - `npm run typecheck`
   - `npm run build`
7. Revisar diffs para garantir que nada fora do modal entrou por acidente.

## Criterios de Aceite

- Modal fica visualmente mais organizado que a versao atual.
- Campos longos ficam faceis de ler e editar.
- Criterios obrigatorios e regras de recusa ficam lado a lado em desktop.
- Revisao manual fica separada e clara.
- Decisao automatica fica em uma area propria.
- Responsivo em telas menores.
- Typecheck e build passam.
- Nenhuma mudanca em backend, env, migrations ou fluxo nao relacionado.

## Riscos

- Misturar no commit mudancas locais antigas de `App.tsx` e `styles.css`.
- Afetar outros modais por CSS generico.
- Criar modal grande demais para telas menores.

## Mitigacao

- Usar classes especificas do modal.
- Revisar `git diff` antes do stage.
- Fazer stage parcial se houver alteracoes nao relacionadas nos mesmos arquivos.
- Deixar `.env.development`, imagens temporarias e planos nao relacionados fora do commit.
