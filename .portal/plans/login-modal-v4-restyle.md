# Plano de Implementação: Restilização do modal de login ("Entrar no sistema") para o padrão v4

## Origem

- Arquivo de especificação: nenhum (sem mockup HTML fornecido pelo usuário desta vez — ver seção "Estratégia sem mockup")
- Data do planejamento: 2026-07-23
- Classificação: `frontend-only`

## Resumo

Restilizar o modal de login de staff/veterinários ("Entrar no sistema", disparado pelo botão "Entrar" do topbar público) e seu fluxo de "Esqueci a senha" para a paleta verde/creme v4 já aplicada em 3 rodadas anteriores nesta sessão (home pública, modal de credenciamento, wizard público de Solicitações). Mudança 100% CSS — nenhuma alteração de lógica, JSX ou fluxo de autenticação.

Achado de investigação: `LoginView` (`src/App.tsx` ~L2047) não é o formulário de login — é a página inteira da home pública. O login real é um modal controlado por `showVetModal`, usando `<form className="auth-modal compact-auth-modal">` + `ModalHeader` + campos `.field`/`.password-field` + botão `.primary-action` + `.reset-password-link`, com uma tela irmã de reset de senha (`.reset-form`, `.reset-success-msg`) dentro do mesmo `.modal-backdrop`.

## Escopo

### Dentro do escopo

- `.compact-auth-modal` — fundo, borda, raio, sombra do card do modal (sem tocar na regra base compartilhada `.auth-modal`)
- `ModalHeader` renderizado dentro deste modal, escopado via `.compact-auth-modal .modal-header*` (mesmo padrão usado no modal de credenciamento)
- Inputs de email/senha (`.field`, `.password-field`), escopados via `.compact-auth-modal .field` / `.compact-auth-modal .password-field`
- Botão do olho (mostrar/ocultar senha) — `.password-field button` escopado, removendo a cor azul antiga (`var(--teal-dark)`)
- Botão `.primary-action` do "Entrar", escopado a este modal
- `.reset-password-link` (link "Esqueceu a senha?") — pode ser editado diretamente, é exclusivo deste fluxo
- `.form-error` — escopado via `.compact-auth-modal .form-error` (classe genérica compartilhada com outros formulários)
- `.reset-form`, `.reset-form-actions`, `.reset-success-msg` — telas de reset de senha dentro do mesmo modal, mesmo tratamento visual

### Fora do escopo

- `.auth-modal` (regra base, compartilhada com `.adoption-confirm-modal` e `.sector-picker-modal`) — não editar diretamente
- Lógica de autenticação (`api.login`, fluxo de reset de senha, geração/validação de código)
- Qualquer outro modal fora deste login (credenciamento, Solicitações, etc. já concluídos em rodadas anteriores)
- Alteração de campos, validações ou comportamento do formulário

## Leitura de contexto

- `/AGENT.md` (raiz) — regras de fluxo direto em `main`, sem staging/PR
- `src/App.tsx` — JSX do modal de login (`showVetModal`, ~L2215-2326) e confirmação de que `LoginView` é a home pública, não o login
- `src/styles.css` — regras atuais de `.auth-modal`, `.compact-auth-modal`, `.password-field`, `.reset-password-link`, `.field` (uso compartilhado confirmado via grep), `.reset-form`/`.reset-form-actions`/`.reset-success-msg`
- Padrão de referência: plano e implementação já aplicados em `redesign-home-publica-mockup-v4.md`, `modal-credenciamento-mockup.md` e `solicitacoes-v2-mockup.md`

## Impacto por área

### Frontend

- Nenhuma alteração de componente/JSX — apenas CSS.
- Elementos visuais afetados: card do modal, cabeçalho, campos de email/senha, botão do olho, botão "Entrar", link "Esqueceu a senha?", tela de reset de senha (etapas email → código/senha → sucesso).
- Estados a cobrir: normal, `:hover`, `:focus`, erro (`.form-error`), sucesso do reset (`.reset-success-msg`).

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css` (único arquivo a ser alterado)

## Estratégia de implementação

Como não há mockup HTML desta vez, a estratégia é **extrapolar por analogia** o padrão já validado nas 3 rodadas anteriores, em vez de traduzir um HTML de referência:

1. `.compact-auth-modal`: fundo branco `#ffffff`, borda `#e6ddc9`, raio ~20-22px, sombra suave consistente com os outros modais v4.
2. `ModalHeader` escopado: título em `#2b2420`/Poppins, botão de fechar circular com fundo creme (`#f4f1ea`) e hover levemente mais escuro — mesmo padrão do modal de credenciamento.
3. Campos (`.field` dentro do modal): label em maiúsculas `#93887a`, input com borda `#e6ddc9`, raio 10px, foco com borda/anel verde `#1f8a5f` (substituindo o azul/teal atual).
4. Botão do olho: neutro por padrão, hover com acento verde escuro `#156b48` (substituindo `var(--teal-dark)`, que resolve para azul antigo).
5. Botão "Entrar" (`.primary-action` escopado): **verde sólido `#1f8a5f`** (hover `#156b48`) — decisão adotada por analogia: este botão é uma ação final e decisiva de um modal autocontido (equivalente ao "Enviar solicitação" do credenciamento), não um passo intermediário de wizard multi-etapa (que é onde o padrão escuro/quase-preto foi usado). Ver seção "Decisões adotadas sem precedente único" abaixo.
6. `.reset-password-link`: trocar azul `#2563eb`/`#1479b8` por verde `#1f8a5f`/`#156b48`.
7. Tela de reset (`.reset-form`, `.reset-form-actions`, `.reset-success-msg`, `.form-error`): mesma paleta de inputs/botões acima; `.ghost-button` "Reenviar código" com borda creme e texto `#2b2420`.
8. Grep de todas as classes tocadas no arquivo inteiro (`.auth-modal`, `.compact-auth-modal`, `.field`, `.password-field`, `.primary-action`, `.reset-password-link`, `.reset-form`, `.form-error`) para confirmar que nenhuma regra antiga com especificidade igual/maior ou `!important` escondida continua vencendo a cascata (mesmo cuidado que já causou 3 bugs nas rodadas anteriores).
9. Verificação visual via CDP/headless Chrome: abrir o modal de login, testar hover/focus dos campos, alternar mostrar/ocultar senha, forçar um erro de login (senha errada) para ver `.form-error`, e navegar até a tela de reset de senha (todas as 3 etapas) para conferir a paleta.

## Decisões adotadas sem precedente único (extrapolação, não pergunta em aberto)

Como o usuário pediu explicitamente para eu decidir por analogia em vez de perguntar, as duas questões abertas identificadas na apresentação preliminar foram resolvidas assim:

1. **Cor do botão "Entrar"**: verde sólido `#1f8a5f` (mesma lógica do botão final do credenciamento — ação decisiva e única do modal, não um passo de wizard).
2. **Botão do olho (mostrar senha)**: hover com acento verde escuro `#156b48`, alinhado à paleta geral, mantendo o estado padrão neutro/cinza.

## Regras de negócio identificadas

Nenhuma — mudança puramente visual.

## Regras multi-tenant e segurança

Sem impacto — nenhuma alteração em lógica de autenticação, permissões ou dados.

## Validações necessárias

Nenhuma validação de formulário nova — campos e regras existentes permanecem intactos.

## Testes necessários

### Frontend

Sem testes automatizados novos (mudança CSS-only, projeto não possui suíte de testes frontend configurada).

### Backend

Sem impacto esperado.

### E2E

- Verificação manual/CDP: abrir modal de login, testar foco/hover dos campos, alternar visibilidade de senha, disparar erro de login, navegar pelo fluxo completo de reset de senha (3 etapas).

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- `.auth-modal` e `.field` são classes compartilhadas com outros modais/formulários (`.adoption-confirm-modal`, `.sector-picker-modal`, formulários diversos) — todo ajuste de cor deve ser escopado via `.compact-auth-modal`, nunca editando a regra base.
- Risco já conhecido desta sessão: podem existir regras `!important` ou seletores mais específicos "escondidos" mais abaixo no arquivo que sobrescrevem os novos estilos — necessário grep completo + verificação visual ao vivo antes de considerar concluído.
- Sem mockup como referência, há mais espaço de interpretação visual — mitigado documentando explicitamente as decisões adotadas acima.
- Push para `origin/main` segue bloqueado por permissão (403, `RodrigoMartini02` sem acesso a `portalcontribuinte225-oss/Castra-o.git`) — commits desta tarefa ficarão pendentes de push até o usuário resolver o acesso, como já ocorreu na rodada anterior.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — as duas questões de design sem precedente único foram resolvidas por decisão documentada na seção acima, conforme solicitado pelo usuário.

## Critérios de aceite do plano

- Modal de login e tela de reset de senha visualmente alinhados à paleta v4 (verde `#1f8a5f`/`#156b48`, creme `#f4f1ea`/`#e6ddc9`, texto `#2b2420`/`#93887a`) sem nenhum resquício de azul/teal antigo.
- Nenhuma classe compartilhada (`.auth-modal`, `.field`) alterada na sua regra base — apenas escopos específicos deste modal.
- `npm run typecheck` e `npm run build` passam sem erros novos.
- Fluxo funcional de login e reset de senha permanece idêntico ao atual (sem regressão).

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Escopar toda mudança via `.compact-auth-modal` — nunca editar `.auth-modal` base nem `.field`/`.form-error` fora desse escopo.
- Seguir o checklist de CSS da skill `implementar` (grep de cada classe alterada no arquivo inteiro, verificar `!important` escondido, verificar hover/focus).
- Verificar visualmente via CDP/headless Chrome antes de reportar como concluído (login, erro de senha, fluxo completo de reset).
- Não commitar/dar push — isso é responsabilidade da skill `finalizar`, apenas quando solicitado.
