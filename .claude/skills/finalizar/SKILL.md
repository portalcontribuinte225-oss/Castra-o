---
name: finalizar
description: Publica uma entrega no Render com commit e push direto em main. Use após implementar ou quando o usuário pedir para finalizar a entrega.
---

# Finalizar e publicar

O pedido para usar `finalizar` autoriza o commit e o push da entrega em `main` para produção. Faça os dois na mesma execução e encerre assim que o GitHub aceitar o push.

1. **Confira a entrega.** Use `git status --short --branch` e confirme que a branch é `main`. Revise os diffs necessários, inclusive o que já estiver no índice. Identifique os arquivos da tarefa e o plano relacionado, quando houver.
2. **Reaproveite os checks da implementação.** Use os resultados bem-sucedidos referentes ao código atual. Rode uma vez os checks aplicáveis que estiverem pendentes ou precisarem ser refeitos após mudança de código, conforme `AGENT.md`. Para uma alteração só de documentação, confira o diff com `git diff --check`.
3. **Crie o commit.** Use `git add -- <arquivos da entrega>` e confira o índice com `git diff --cached --check` e `git diff --cached --name-only`. Preserve alterações de outras tarefas e limite o commit aos caminhos da entrega. Use Conventional Commits em inglês e cite o plano no corpo, quando houver.
4. **Envie para produção.** Execute `git push origin main`. O push em `main` aciona o deploy automático do Render. Reserve `[skip render]` para pedidos explícitos de envio somente ao GitHub.

Se o commit da entrega já estiver criado localmente, confira os commits a enviar com `git log --oneline origin/main..HEAD` e faça o mesmo push. Se a entrega já estiver sincronizada, informe o estado.

Mantenha `.env`, chaves, certificados e segredos fora do commit. Siga a autorização específica de banco definida em `AGENT.md` se a entrega aplicar migrations. Em caso de falha de check, conflito ou push recusado, informe o ponto exato e preserve o trabalho local.

## Resposta

Após o push, informe o hash e o envio ao Render em uma linha, seguindo o exemplo.

> Commit `abc1234` enviado à `main` para publicação no Render.

Verifique o estado do deploy apenas se o usuário pedir.
