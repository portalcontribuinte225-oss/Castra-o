# Plano de Implementação: Redesign do Painel de Adoção pelo Mockup

## Origem

- Arquivo de especificação: `C:\Users\rodri\Downloads\Painel de Adocao.html`
- Data do planejamento: `2026-07-27`
- Classificação: `frontend-only`

## Resumo

Refazer a tela interna de Adoção para seguir o mockup fornecido, transformando a galeria atual em uma área operacional mais densa e organizada. A implementação deve preservar os fluxos existentes de cadastro, edição, exclusão, interessados, confirmação de adoção e reativação, sem alterar a sidebar.

O plano também inclui uma função de destaque automático para animais disponíveis há mais de 15 dias, usando esse destaque na seção pública de adoção da home. Não haverá criação de campo novo no backend nem persistência de destaque nesta etapa.

## Escopo

### Dentro do escopo

- Reestruturar somente a área de conteúdo da tela interna `Adoção`.
- Manter a sidebar, menu lateral, topbar global e navegação principal inalterados.
- Aplicar visual do mockup: fundo creme, cards brancos, bordas suaves, chips compactos, botões pretos/verdes e layout mais operacional.
- Adicionar busca local por dados já existentes do animal, como nome, espécie, sexo, idade, descrição e microchip quando existir.
- Separar filtros locais por status, espécie e sexo.
- Mapear visualmente `em_processo` como uma fila intermediária de triagem/interessados, sem criar status novo no backend.
- Adicionar alternância de visualização entre grade e lista.
- Criar painel lateral operacional com:
  - interessados recentes/aguardando triagem;
  - visitas agendadas a partir de `interests[].visit_date`;
  - destaque automático de animal disponível há mais de 15 dias.
- Criar drawer lateral de ficha do animal, inspirado no mockup, preservando ações existentes.
- Usar a função de destaque automático também na seção pública de adoção da home, priorizando/realçando animais disponíveis há mais de 15 dias.
- Manter modais existentes de cadastro/edição e confirmação de adoção, ajustando apenas o visual se necessário para harmonizar com a nova tela.
- Usar apenas dados já disponíveis no frontend/API atual.

### Fora do escopo

- Alterar sidebar, colapso da sidebar, itens de menu ou navegação global.
- Alterar backend, banco de dados, migrations ou contratos de API.
- Criar persistência para destaque manual.
- Criar fluxo de mutirão.
- Adicionar campos novos ao cadastro de adoção.
- Alterar regras de validação ou permissão.
- Alterar a lógica pública de manifestação de interesse, exceto o destaque visual na home.
- Refatorar telas fora de Adoção e da seção pública de adoção da home.

## Leitura de contexto

- `/AGENT.md`
- `C:\Users\rodri\Downloads\Painel de Adocao.html`
- `src/App.tsx`
- `src/styles.css`
- `src/api.ts`
- `backend/src/routes/adoptions.js`
- `backend/src/db/migrations.js`

Observação: não existe `frontend/AGENT.md` neste repositório.

## Impacto por área

### Frontend

Impacto esperado em `AdoptionView`, dentro de `src/App.tsx`, e em estilos escopados a `.adoption-workspace` em `src/styles.css`.

Mudanças principais:

- Adicionar estados locais para busca, status selecionado, espécie, sexo, modo de visualização e animal selecionado no drawer.
- Criar helpers locais para:
  - normalizar status visual;
  - calcular dias desde cadastro;
  - identificar animais disponíveis há mais de 15 dias;
  - ordenar/priorizar animais destacados;
  - montar listas de interessados e visitas a partir de `interests`.
- Reestruturar o JSX da tela interna de adoção:
  - header compacto;
  - busca;
  - filtros por pills;
  - botões de grade/lista;
  - área principal com cards/lista;
  - rail lateral operacional;
  - drawer de ficha.
- Ajustar `AdoptionCarousel` ou a seção pública equivalente da home para realçar/priorizar animais destacados automaticamente.
- Preservar `api.createAdoption`, `api.updateAdoption`, `api.deleteAdoption`, `api.getInterests` e `api.removeInterest` como estão.
- Preservar todos os handlers atuais de cadastro, edição, exclusão, reativação, interessados e confirmação de adoção.
- Adicionar estados empty/loading visuais apenas onde já houver dados locais suficientes.

### Backend

Sem impacto esperado.

O destaque após 15 dias deve ser calculado no frontend com `created_at` e `status`, sem gravar informação nova.

### Banco de dados

Sem impacto esperado.

Não criar migrations, colunas, índices ou alteração de schema.

Atenção: migrations não devem ser executadas sem confirmação explícita do usuário, pois o ambiente atual pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

Não alterar `.env`, scripts de build, Render, service worker, manifest ou comandos de deploy.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/styles.css`

## Estratégia de implementação

1. Preservar a estrutura externa da aplicação e localizar apenas o bloco `AdoptionView` em `src/App.tsx`.
2. Adicionar os novos estados locais:
   - `adoptionSearch`;
   - `adoptionStatusFilter`;
   - `adoptionViewMode`;
   - `selectedAdoptionAnimal`;
   - manter/reaproveitar `adoptionFilters`.
3. Criar helpers pequenos, próximos ao componente ou em seção utilitária já existente no arquivo:
   - `getAdoptionStatusView`;
   - `getAdoptionDaysInProgram`;
   - `isAdoptionHighlighted`;
   - `getHighlightedAdoptionAnimals`;
   - `matchesAdoptionSearch`;
   - `getAdoptionVisitItems`.
4. Ajustar o filtro atual para incluir:
   - status `disponivel`;
   - status `em_processo`;
   - status `adotado`;
   - espécie;
   - sexo;
   - busca textual.
5. Reestruturar o JSX da tela interna:
   - trocar toolbar simples por header do mockup;
   - adicionar barra de busca;
   - manter botão `Cadastrar animal`;
   - adicionar chips de filtros;
   - adicionar botões de grade/lista com ícones lucide.
6. Recriar os cards de adoção:
   - foto no topo;
   - badge de status;
   - nome;
   - metadados disponíveis;
   - contagem de interessados;
   - ações compactas: ver ficha, editar, concluir/reativar, excluir.
7. Criar visualização em lista usando os mesmos dados e ações dos cards.
8. Criar drawer lateral de ficha:
   - foto principal;
   - status;
   - nome;
   - informações já disponíveis;
   - saúde/descrição quando houver;
   - interessados;
   - ações existentes.
9. Substituir ou adaptar o modal atual de interessados para que a ficha/drawer seja o ponto central, sem perder a capacidade de remover interessados.
10. Criar rail lateral operacional:
    - interessados recentes derivados de `interests`;
    - visitas com `visit_date`;
    - card de destaque automático para animal disponível há mais de 15 dias.
11. Atualizar `AdoptionCarousel` na home pública:
    - calcular animais destacados com a mesma regra de 15 dias;
    - priorizar destacados na ordenação;
    - aplicar selo/realce visual discreto no card destacado.
12. Revisar `src/styles.css`:
    - remover/neutralizar regras antigas conflitantes dentro do escopo `.adoption-workspace`;
    - aplicar paleta e espaçamentos do mockup;
    - garantir responsividade desktop/mobile;
    - não tocar estilos da sidebar.
13. Rodar validações:
    - `npm run typecheck`;
    - `npm run build`.
14. Fazer verificação manual no navegador:
    - tela interna de adoção com sidebar inalterada;
    - filtros e busca;
    - grade/lista;
    - drawer;
    - cadastro/edição;
    - confirmação de adoção;
    - reativação;
    - exclusão;
    - interessados;
    - destaque na home pública.

## Regras de negócio identificadas

- Animais com `status === "adotado"` ficam no histórico de adotados.
- Animais com `status === "em_processo"` devem ser tratados visualmente como em triagem/interessados.
- Animais com status diferente de `adotado` continuam disponíveis para a galeria pública, conforme comportamento atual.
- O destaque automático deve considerar animais não adotados com mais de 15 dias desde `created_at`.
- O destaque automático é visual e calculado no frontend; não deve persistir no backend.
- A confirmação de adoção deve continuar usando o fluxo existente.
- A remoção de interessados deve continuar chamando `api.removeInterest`.

## Regras multi-tenant e segurança

- Não alterar a origem dos dados: continuar usando `adoptionAnimals` já escopado por município no app.
- Não criar chamadas novas que ignorem `municipalityId`.
- Não alterar permissões: ações de gestão continuam condicionadas a `canManageAdoptions`.
- Não expor dados entre prefeituras.
- Não alterar endpoints públicos ou autenticados.
- Não alterar `.env`, tokens ou configurações sensíveis.

## Validações necessárias

- Busca deve funcionar com strings vazias sem quebrar.
- Filtros devem poder ser limpos.
- Grade/lista devem usar a mesma coleção filtrada.
- Drawer deve lidar com animal sem foto, sem interessados e sem microchip.
- Destaque após 15 dias deve ignorar animais adotados.
- Home pública deve continuar renderizando quando não houver animais destacados.
- Ações existentes não podem mudar de payload.
- O layout mobile não pode sobrepor texto, drawer, filtros ou cards.

## Testes necessários

### Frontend

- Verificar `AdoptionView` com lista vazia.
- Verificar `AdoptionView` com animais disponíveis, em processo e adotados.
- Verificar busca por nome/descrição/espécie/microchip quando houver.
- Verificar filtros por status, espécie e sexo.
- Verificar alternância grade/lista.
- Verificar abertura e fechamento do drawer.
- Verificar ações de editar, excluir, concluir adoção, reativar e remover interessado.
- Verificar destaque automático para animal com `created_at` superior a 15 dias.
- Verificar seção pública da home com e sem animais destacados.

### Backend

Sem testes backend novos esperados.

### E2E

- Fluxo manual interno: abrir Adoção, filtrar, buscar, abrir ficha, editar animal, abrir interessados, confirmar adoção.
- Fluxo manual público: abrir home, confirmar que a seção de adoção continua funcionando e que destaque aparece quando aplicável.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- `src/styles.css` contém regras de adoção em mais de um ponto; revisar a cascata inteira para evitar conflito visual.
- Não alterar seletores globais que afetem sidebar, home inteira ou outros módulos.
- O mockup contém dados fictícios que não existem obrigatoriamente no backend atual; a implementação deve usar somente campos já disponíveis e aplicar fallback visual.
- O status visual de triagem deve ser apenas rótulo para `em_processo`, sem novo valor de domínio.
- A regra de destaque por 15 dias depende de `created_at`; se algum registro legado não tiver essa data, ele não deve quebrar a tela.
- A home pública já tem fluxo de interesse; o destaque não pode esconder cards nem impedir o envio de interesse.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Critérios de aceite do plano

A implementação deve ser considerada pronta quando:

- A tela interna de Adoção estiver visualmente alinhada ao mockup.
- A sidebar permanecer inalterada.
- Busca, filtros e alternância grade/lista funcionarem localmente.
- O drawer de ficha abrir e preservar as ações existentes.
- Animais disponíveis há mais de 15 dias forem destacados na tela interna e na seção pública de adoção da home.
- Nenhum endpoint, migration ou contrato de API for alterado.
- `npm run typecheck` e `npm run build` passarem.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não implementar backend ou banco nesta tarefa.
- Não alterar sidebar.
- Não criar campos novos para raça, peso, porte ou similares.
- Não executar migrations.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas em `src/App.tsx` e `src/styles.css`.
- Preservar comportamento existente antes de trocar visual.
- Validar manualmente a home pública e a tela interna de Adoção.
