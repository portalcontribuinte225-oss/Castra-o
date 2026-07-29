---
name: planejar
description: Planeja a implementação de uma solução a partir de um arquivo Markdown (.md). Use quando o usuário fornecer/linkar um .md com especificação, user story, requisitos, critérios de aceite, endpoints, UI/UX ou regras de negócio e pedir um plano de implementação antes de codar.
---

# Planejar implementação a partir de um .md

Planejamento é um processo iterativo. A primeira versão do plano é uma proposta — não versão final. O usuário deve revisar, corrigir, reduzir ou expandir o escopo antes de o plano ser salvo.

Esta skill **não implementa código**. O objetivo é entender o escopo, identificar impactos no monorepo e salvar um plano em `.portal/plans/`. A implementação só começa quando o usuário chamar `/implementar` — em uma invocação separada, nunca na mesma resposta.

**Atenção — erro comum a evitar:** quando o usuário aprovar o plano (responder "1", "sim", "aprovado" etc.), a única ação permitida é salvar o arquivo `.md` em `.portal/plans/` e encerrar. "Aprovar o plano" NUNCA significa "pode começar a codar" — mesmo que o usuário tenha aprovado com entusiasmo ou o plano pareça simples. Se a mensagem de aprovação não citar explicitamente `/implementar`, não escreva nem edite nenhum arquivo de código.

---

## Entrada esperada

```txt
/planejar FEATURE_FILE=docs/features/emissao-alvara.md
/planejar docs/features/novo-relatorio.md
```

---

## Fluxo obrigatório

```txt
1. Ler o .md da feature
2. Ler /AGENT.md (sempre)
3. Ler frontend/AGENT.md (se houver impacto no frontend)
4. Ler backend/AGENT.md (se houver impacto no backend)
5. Investigar padrões existentes no projeto
6. Classificar escopo
7. Gerar plano preliminar
8. Apresentar plano ao usuário
9. Receber feedback e ajustar se necessário
10. Solicitar aprovação explícita
11. Salvar em .portal/plans/{nome}.md
12. Encerrar — aguardar /implementar
```

---

## Regras obrigatórias

1. Ler completamente o `.md` fornecido antes de qualquer análise.
2. Ler `/AGENT.md` sempre, sem exceção.
3. Ler `frontend/AGENT.md` se houver impacto no frontend.
4. Ler `backend/AGENT.md` se houver impacto no backend.
5. Não implementar código nesta etapa.
6. Não executar migrations.
7. Não alterar arquivos fora de `.portal/plans/`.
8. Não salvar o plano sem aprovação explícita do usuário.
9. Não chamar `/implementar` — quem decide quando implementar é o usuário.
10. Se a feature substituir algo existente, listar explicitamente o que deve ser **deletado** na seção "O que será removido" — nunca planejar ocultação (`display:none`, `if(false)`, flag desativada, bloco comentado) como substituto de remoção.

---

## Investigação do projeto

Antes de escrever o plano, inspecionar o projeto para encontrar padrões existentes:

- módulos, rotas, hooks, schemas, query keys, services, repositories similares
- componentes reutilizáveis
- padrões de validação, erro, permissão, relatório/PDF

Não inventar arquitetura nova se já existir padrão equivalente.

---

## Classificação de escopo

Classificar como uma das opções e explicar o motivo:

```txt
frontend-only | backend-only | fullstack | backend + database
frontend + backend + database | infra/deploy | documentação
```

---

## Apresentação do plano preliminar

Antes de salvar, apresentar ao usuário:

- **Classificação** — qual camada é afetada
- **Resumo** — o que será implementado, áreas afetadas, riscos principais
- **O que será removido** — lista explícita do que deve ser deletado (não ocultado)
- **Estratégia** — etapas numeradas
- **Arquivos provavelmente afetados**
- **Riscos**
- **Perguntas em aberto**

Ao final, exibir obrigatoriamente:

```txt
Escolha uma opção:

1. Aprovar e salvar o plano em .portal/plans/ (isso NÃO inicia a implementação)
2. Ajustar o plano antes de salvar
3. Reduzir o escopo
4. Expandir o escopo
5. Cancelar o planejamento
```

Se o usuário solicitar ajustes: atualizar, reapresentar completo, solicitar nova aprovação. Não salvar versões intermediárias.

Se o usuário responder com a opção 1 (ou equivalente como "sim"/"aprovado"/"pode salvar"), a única ação é gerar e salvar o `.md` — nunca editar código nessa mesma resposta, mesmo que o plano seja pequeno e a tentação seja "só resolver de uma vez".

---

## Salvamento

Somente após aprovação explícita (`sim`, `aprovado`, `pode salvar`, `prosseguir`):

1. Gerar o arquivo usando [TEMPLATE_planejar.md](TEMPLATE_planejar.md) como estrutura.
2. Salvar em `.portal/plans/{nome-do-plano}.md`.
3. Informar o caminho e encerrar — nenhuma outra ação.

A skill encerra aqui, na mesma resposta em que o `.md` é salvo. Não editar/criar arquivos de código. Não rodar lint/typecheck/build do projeto. Não iniciar implementação. Não chamar `/implementar` — mesmo implicitamente. Se quiser implementar, o usuário deve invocar `/implementar` explicitamente numa mensagem separada.

---

## Regras de banco de dados

- Identificar se migrations serão necessárias e descrever os riscos.
- **Não executar migrations** nem gerar `ALTER TABLE`/`DROP COLUMN` automaticamente.
- Incluir no plano: *"Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção."*

---

## Anti-patterns

- Planejar "desativar" em vez de deletar — se algo será substituído, o plano lista o que será removido, não ocultado
- Implementar código durante o planejamento
- Alterar arquivos fora de `.portal/plans/`
- Ignorar AGENT.md relevantes
- Assumir escopo sem verificar impacto multi-tenant ou banco de dados
- Executar migrations, rodar comandos destrutivos, alterar `.env`, CI/CD, abrir PR ou fazer commit
