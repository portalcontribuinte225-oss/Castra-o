---
name: limpar
description: Limpa código legado, duplicado ou empilhado no projeto de castração com foco em segurança, revisão pequena e preservação de comportamento. Use quando o usuário pedir limpeza, remoção de código morto, consolidação de CSS/overrides, redução de duplicidade, organização de estilos acumulados, ou após ajustes visuais que tenham criado blocos empilhados.
---

# Limpar Código do Projeto

Use esta skill para limpar código sem mudar comportamento funcional. O objetivo é reduzir acúmulo, duplicidade e overrides frágeis, especialmente em `src/styles.css`, mantendo o sistema estável e fácil de revisar.

## Regras de Segurança

- Leia `/AGENT.md` antes de alterar arquivos.
- Não altere backend, banco, permissões, endpoints, `.env`, CI/CD ou deploy salvo pedido explícito.
- Não execute migrations, commit ou push.
- Não reverta alterações do usuário.
- Não remova código apenas porque parece antigo; confirme uso com busca e contexto.
- Prefira limpeza pequena, auditável e reversível.

## Fluxo Obrigatório

1. Entender o alvo da limpeza: arquivo, tela, componente, fluxo ou problema visual.
2. Mapear duplicidade com `rg` antes de editar.
3. Identificar a origem real do comportamento atual: regra base, override intermediário/final, `!important`, seletor específico ou markup duplicado.
4. Escolher uma estratégia: substituir regra antiga, consolidar equivalentes, remover bloco morto, reduzir especificidade ou mover para camada global existente.
5. Só adicionar override novo se remover/consolidar o anterior for arriscado demais.
6. Editar apenas os arquivos necessários.
7. Rodar validações e resumir o que foi removido, consolidado e preservado.

## CSS e Estilos

Antes de adicionar CSS novo:

- Procure seletores existentes com `rg`.
- Verifique se há mais de um bloco para o mesmo componente.
- Não empilhe um terceiro override quando o segundo pode ser corrigido.
- Se precisar adicionar override temporário, deixe-o concentrado e explique no resumo.
- Remova ou substitua regras antigas quando a nova regra tornar a antiga redundante.
- Evite ampliar `!important`; preserve apenas quando necessário para vencer legado existente.
- Prefira tokens e classes globais já criados em `src/styles.css`.
- Preserve responsividade, contraste e estados de hover/focus/disabled/selected.

Use atenção especial em:

- `src/styles.css`, por ter muitas camadas históricas;
- cabeçalhos e ações de páginas;
- botões, filtros, chips, tabs e badges;
- modais;
- Adoção, Solicitações, Agenda, Dashboard, Credenciamentos e Configurações.

## Código Morto e Duplicado

Para remover código:

- Busque símbolo, classe, função, componente ou rota.
- Confirme uso dinâmico, strings montadas ou classes condicionais.
- Em React, verifique JSX, props, estados, handlers e imports.
- Em CSS, confirme se a classe aparece no markup ou se é usada por estado dinâmico.
- Remova imports, estados e helpers que ficarem sem uso.
- Não remova dados mockados, constantes de domínio ou fallbacks sem entender a finalidade.

## Backend

Limpeza em backend só deve ocorrer quando o usuário pedir explicitamente ou quando o alvo for claramente backend.

Se houver backend:

- Leia `/backend/AGENT.md`.
- Preserve isolamento multi-tenant.
- Não altere SQL, Drizzle, RLS, permissões ou erros sem necessidade clara.
- Não remova logs ou tratamentos de erro sem entender impacto operacional.

## Validações

Execute conforme o impacto:

```bash
git diff --check
npm run typecheck
npm run build
```

Quando a limpeza for visual, valide pelo menos a tela alvo, responsivo básico, estados selected/hover/focus e ausência de texto cortado ou scroll horizontal.

## Saída Final

Responda com:

- o que foi limpo ou consolidado;
- quais arquivos foram alterados;
- quais validações passaram;
- o que foi preservado intencionalmente;
- qualquer risco restante ou limpeza futura recomendada.
