# Plano de implementação do modal Entrar como equipe

## Origem

- Especificação aprovada na conversa, com o print do modal **Entrar como equipe** e as referências de **Contato para os avisos**, **Denúncia** e **Processo**.
- Data do planejamento em 20/11/2026.
- Classificação `frontend-only`. O trabalho altera os componentes e estilos usados para exibir o modal e seus controles.

## Resumo

Usar o login da equipe como piloto para validar os campos compartilhados e registrar a referência visual dos botões. Aplicar Tailwind no JSX, reaproveitar os componentes `Card` e `Input` e compartilhar com o Processo o botão de fechar.

## Escopo

### Dentro do escopo

- Superfície, cabeçalho, layout, campos **E-mail da equipe** e **Senha** e ações do modal de login da equipe.
- Componente reutilizável de botão com as variantes preenchida e contornada do login.
- Componente compartilhado de fechar com o X do Processo, usado no login e nas três ocorrências atuais do Processo.
- Exclusão dos seletores que perderem todos os consumidores após a migração.

### Fora do escopo

- Redesenho do acesso de tutor, da recuperação de senha e das demais telas.
- Mudanças em autenticação, sessão, regras de município, dados ou deploy.

## Leitura de contexto

- `AGENT.md`
- `src/features/tutor-access/auth-entry.tsx`
- `src/features/tutor-access/password-recovery-form.tsx`
- `src/features/tutor-access/tutor-access.test.tsx` e `src/features/tutor-access/recovery-flow.test.tsx`
- `src/components/card.tsx`, `src/components/input.tsx` e `src/components/ui.tsx`
- `src/features/process-modal/process-header.tsx`, `src/features/process-modal/reschedule-dialog.tsx` e `src/features/process-modal/prescription-dialog.tsx`
- `src/styles.css` e `package.json`

## Impacto por área

### Frontend

- Reaproveitar `Card` como superfície do modal e aplicar classes Tailwind com prefixo `tw:` para o layout e os estados visuais. Usar os tokens de tema existentes onde corresponderem à aparência aprovada.
- Reaproveitar o `Input` de **Contato para os avisos** para e-mail e senha, com 44 px de altura, raio de 14 px de **Denúncia** e foco verde. Posicionar o ícone de senha com espaço suficiente para o texto do campo.
- Preservar nos botões a largura, a altura, o arredondamento e as cores do login atual. **Entrar** é o botão verde preenchido e **Esqueceu a senha?** é o botão contornado.
- Reproduzir no componente compartilhado o ícone e os estados visuais do X de Processo, incluindo foco e interação por teclado. Preservar o rótulo acessível, o callback de fechar e a condição de desabilitado de cada uso.
- Manter a lógica do formulário comum em `AuthEntry` e limitar a troca dos controles ao login da equipe. Conferir a transição de e para o formulário de recuperação e os estados de erro e carregamento.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

> Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/features/tutor-access/auth-entry.tsx` e seus testes.
- `src/components/button.tsx` e `src/components/close-button.tsx` como componentes compartilhados propostos.
- `src/features/process-modal/process-header.tsx`, `src/features/process-modal/reschedule-dialog.tsx` e `src/features/process-modal/prescription-dialog.tsx`.
- `src/styles.css` para remover os seletores obsoletos.

## O que será removido

- Texto **Fechar** do botão no login da equipe, substituído pelo X com nome acessível.
- Classes de estilo antigas nos elementos migrados do login, incluindo `primary-action`, `ghost-button` e as classes específicas de layout e de campos que forem substituídas por Tailwind.
- Marcação duplicada do X nos três pontos do Processo, substituída pelo botão compartilhado, e imports de ícones que ficarem sem uso.
- Seletores próprios de `.prm-close-btn` e a sua ocorrência no seletor agrupado com `.prm-pdf-btn` após a migração dos três consumidores.
- Seletores antigos do modal sem correspondência no JSX, como os de `.modal-header-close` dentro de `.compact-auth-modal`, após conferir todos os estados de `AuthEntry`. Regras globais com consumidores ativos, inclusive no tutor e na recuperação, continuam em uso.

## Estratégia de implementação

1. Conferir os estilos efetivos dos dois botões no login e do X no Processo, incluindo os estados interativos e as regras sobrepostas no CSS global.
2. Criar as variantes preenchida e contornada em `Button` a partir desses estilos existentes. Extrair o X do Processo para `CloseButton` e substituir suas três ocorrências.
3. Aplicar `Card`, `Input` e os botões compartilhados ao login da equipe. Usar um único fluxo de envio e fechamento em `AuthEntry`, com a diferença de apresentação limitada à tela da equipe.
4. Conferir referências para cada seletor substituído e excluir os estilos e imports obsoletos.
5. Rodar as validações do projeto e conferir o piloto em desktop e celular.

## Regras de negócio identificadas

- **Entrar** usa o envio atual de `AuthEntry`, com o rótulo **Entrando...** durante o carregamento.
- **Esqueceu a senha?** abre o fluxo existente de recuperação. O olho alterna a visibilidade da senha. Fechar mantém a limpeza atual do formulário e o callback que encerra o modal.
- Preservar a distinção entre acesso da equipe e acesso de tutor, incluindo seus identificadores, estados e validações atuais.

## Regras multi-tenant e segurança

- Preservar a origem atual de `municipalityId` e a seleção de `AuthAudience.STAFF` e `AuthAudience.TUTOR` em seus fluxos. A migração usa os contratos, as validações e as permissões da autenticação existente.

## Validações necessárias

- Preservar `type="email"`, os atributos obrigatórios e de comprimento já usados, `autoComplete="username"` e `autoComplete="current-password"`.
- Preservar a associação dos rótulos com os campos, os anúncios dos erros, o bloqueio de envio atual e o estado de carregamento. O olho e o X mantêm `type="button"`.

## Testes necessários

### Frontend

- Executar os testes de acesso de tutor, recuperação e componentes do Processo. Cobrir no teste do login da equipe os rótulos dos campos, o tipo do botão de envio e o nome acessível do X.

### Backend

- Executar a suíte existente como regressão do fluxo de autenticação.

### Conferência manual

- Comparar o verde, o contorno, o arredondamento e as proporções dos botões com o print. Comparar o X com o cabeçalho de Processo.
- Conferir o raio e o foco dos campos, a posição do olho e o preenchimento automático em desktop e celular. Percorrer a tela por teclado e verificar envio, carregamento, erro, fechamento e abertura da recuperação.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

## Riscos e pontos de atenção

- `AuthEntry` também atende tutor e recuperação. Os seletores de `compact-auth-modal` ainda usados por esses fluxos precisam permanecer aplicáveis.
- Regras globais podem sobrescrever as classes novas. A comparação dos estilos efetivos é necessária para preservar a aparência dos botões de referência e do X.

## Perguntas em aberto

Nenhuma pergunta de escopo identificada. O modal da equipe é o piloto para validação visual dos campos e dos botões antes de replicar o padrão.

## Critérios de aceite

- E-mail e senha usam `Input` com 44 px de altura, raio de 14 px e foco verde.
- **Entrar** e **Esqueceu a senha?** usam o componente de botão compartilhado e mantêm a apresentação da referência.
- O login e os três pontos do Processo usam o mesmo botão X, com nome acessível e comportamento apropriado a cada uso.
- O modal da equipe usa `Card` e utilitários Tailwind no JSX. Os seletores substituídos que perderam todos os consumidores são excluídos.
- Envio, recuperação, fechamento e acesso do tutor passam pelas verificações de regressão e pelos comandos de validação.

## Observações para a skill `implementar`

- Usar este plano e `AGENT.md` como referência e concentrar o diff nos componentes e estilos indicados.
- Deletar as regras obsoletas identificadas, preservando as declarações de seletores que atendem componentes ativos.
