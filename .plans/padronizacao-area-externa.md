# Plano de implementação da padronização da área externa

## Origem

- Especificação **Padronização da área externa** colada no chat.
- Plano aprovado no chat em 20/11/2026.
- Classificação `frontend-only`.

## Resumo

Padronizar a interface do portal público, o acesso da equipe e a área autenticada do tutor. Usar os componentes e tokens existentes, aplicar Tailwind no JSX e remover o CSS substituído conforme cada fluxo é migrado. `NewRequest`, `PublicSchedulePicker` e a prévia de documentos também servem a equipe. Aplicar as mudanças visuais aos pontos de entrada externos e verificar os consumidores compartilhados.

## Escopo

### Dentro do escopo

- Página inicial, menu superior, seleção de município e entrada por mutirão.
- Adoção, incluindo filtros, cards, detalhes, interesse, compartilhamento e abertura por link.
- **Solicitar procedimento**, da entrada à confirmação, nas variantes pública e autenticada do tutor. As etapas são **Você**, **Animal**, **Agenda** e **Documentos**.
- **Acompanhar solicitação**, **Acessar minha solicitação**, **Credenciamento** e **Denunciar**.
- Login da equipe, acesso do tutor, recuperação de senha e área do tutor, com seus subfluxos.

### Fora do escopo

- Telas da equipe após autenticação, incluindo o painel e o atendimento no balcão. **Processo** serve como referência para o botão de fechar.
- Mudanças de regras de negócio, rotas, contratos da API, permissões, backend, banco e infraestrutura.

## Leitura de contexto

- `AGENT.md` e especificação aprovada no chat.
- `.plans/login-equipe-padrao-ui.md`, `.plans/etapa-animal-cartoes.md`, `.plans/denuncia-padrao-e-fotos.md` e `.plans/compartilhar-animal-adocao.md` como referências das decisões anteriores.
- Pontos de entrada em `src/App.tsx`, componentes de UI e trechos de `src/styles.css`, com atenção às regras globais, aos seletores por fluxo e às media queries.

## Impacto por área

### Frontend

| Controle | Padrão |
| --- | --- |
| Cards | Reusar `Card` quando aplicável. Usar cantos arredondados, borda discreta e borda verde fina no estado selecionado, como em **Credenciamento**. Conservar a semântica de radio, ação ou conteúdo de cada card. |
| Inputs | Partir de `Input` e do piloto **Contato para os avisos**. Fundo branco, altura de 44 px, raio de 14 px e uma borda verde no foco. Preservar os estados inválido e desabilitado. Textareas mantêm altura multilinha. |
| Selects | Inventariar os controles de seleção simples, múltiplos e próprios de cada fluxo. Aprovar o modelo do campo, da lista e dos estados de seleção antes de replicá-lo. |
| Botões | Reusar `Button` com pílula, borda fina, altura e espaçamento do menu superior. Preservar a cor de cada ação e seus estados de foco, carregamento e desabilitado. |
| Modais e etapas | Reusar `CloseButton` de **Processo** nos modais. Alinhar hierarquia de títulos, indicadores de etapa, navegação e mensagens. Manter os botões de voltar nas áreas que funcionam como painéis ou formulários. |

### Backend

Sem impacto esperado. Preservar o encaminhamento por município, os links existentes, os contratos de autenticação e as chamadas de agenda, documentos e protocolo.

### Banco de dados

Sem impacto esperado. Migrations não devem ser executadas sem confirmação explícita, pois o ambiente pode estar apontando para produção.

### Infraestrutura e deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

| Área | Arquivos |
| --- | --- |
| Portal, município, adoção e ponto de entrada dos serviços | `src/App.tsx` nos trechos `LoginView`, `MunicipalitySelectorChip`, `MutiraoBanner`, `AdoptionCarousel` e `PublicAccessRequestInline`, mais `src/features/public-home/` e `src/features/adoption-share/`. |
| Componentes e tema | `src/components/card.tsx`, `input.tsx`, `button.tsx`, `close-button.tsx`, `ui.tsx`, `option-card-group.tsx`, `multi-select-dropdown.tsx` e `src/styles.css`, conforme os usos confirmados. |
| Solicitação pública e autenticada | `src/App.tsx` nos trechos de `NewRequest`, `PublicSchedulePicker` e prévia, mais `src/features/request-steps/`, `request-requester/`, `request-procedures/`, `neighborhoods/` e `registered-animals/`. |
| Serviços e autenticação | `src/features/request-tracking/`, `request-access/`, `complaint/` e `tutor-access/`. |
| Área autenticada do tutor | `src/features/tutor-access/tutor-area.tsx`, `tutor-profile.tsx`, `src/features/registered-animals/`, `src/features/animal-services/` e o modo compacto de `TutorDashboard` em `src/App.tsx`. |

## O que será removido

- Em `HeroCard`, deletar `actionStyle` depois de migrar as ações para `Button`. Nos fluxos de início e adoção, deletar os ramos exclusivos substituídos de `.mutirao-banner-cta`, `.showcase-pill-text`, `.public-interest-cta`, `.adoption-main-cta` e das regras do X legado em `.adoption-profile-modal > .modal-header .icon-button`. Preservar o destaque da adoção e os usos compartilhados do botão de compartilhar.
- Em **Credenciamento**, deletar o agrupador que repete `single-request-form clean-form` e os invólucros `.access-field` que servem apenas de contêiner dos inputs migrados. Preservar os rótulos e os usos de `.access-field` em outros fluxos.
- Em **Acompanhar solicitação** e **Acessar minha solicitação**, deletar a repetição do título inicial e manter títulos próprios para as etapas e resultados que precisam deles.
- Em `NewRequest`, deletar a marcação de cabeçalho de `FormSection` ocultada por `.form-section-header`, os parâmetros de cabeçalho que ficarem órfãos e a regra de ocultação correspondente. Preservar o nome acessível da etapa e o contêiner enquanto sustentar o layout. Deletar os descendentes `.nr-shell--public .anm-actions-row .anm-add-btn` e `.nr-shell--public .anm-actions-row .animal-remove-inline` que apontam para a linha antiga. Retirar as regras públicas de navegação, foco e seleção substituídas após verificar os usos restantes.
- Em **Denunciar**, retirar o ramo dos seletores de altura, raio e foco que ainda sobrescreve os `Input`s migrados em `.public-report-inline`. Manter as regras necessárias para textarea, checkbox, botões e upload. Deletar os ramos exclusivos de `.public-inline-actions .primary-action` após a migração do botão de envio.
- Em autenticação, deletar o botão de fechar legado e os seletores exclusivos `.compact-auth-modal` e `.password-field` depois de migrar seus últimos usos. Preservar `.auth-modal`, `.modal-backdrop` e as regras compartilhadas da equipe.
- Em cada fluxo, deletar imports e regras que perderem uso. Em listas agrupadas, retirar apenas o seletor substituído quando os demais ainda atenderem outras telas. Para os selects, remover os seletores substituídos após a aprovação do modelo e respeitar os consumidores internos do controle.

## Estratégia de implementação

1. **Registrar padrões e consumidores.** Em cada tela, identificar o componente atual, as regras locais e globais que afetam o mesmo elemento e os consumidores da equipe. Reusar `Card`, `Input`, `Button`, `CloseButton`, `RequestStepper` e os controles de seleção quando atenderem ao padrão. Aplicar utilitários Tailwind com o prefixo `tw:` e os tokens existentes do tema. Usar as variantes existentes quando suficientes. Registrar os seletores a remover junto ao fluxo correspondente.
2. **Migrar início, menu, município e adoção.** Cobrir home com e sem município, busca e estado vazio do seletor, brasão e logo, seleção pelo link e layout do menu em celular. Preservar a entrada de mutirão com data preenchida. Em adoção, cobrir filtros, lista vazia, cards, destaque, detalhes, compartilhamento e manifestação de interesse. Mostrar falha de envio no próprio formulário. Preservar as ações independentes dentro do card e os estados de carregamento, disponível, adotado e indisponível do link.
3. **Migrar Solicitar procedimento.** Reusar `RequestStepper` e ajustar a apresentação do cabeçalho, do rodapé e das mensagens na variante externa. Cobrir **Você** com primeira solicitação, animal cadastrado, responsável, dados de contato e consentimento. Cobrir **Animal** com raça, bairro, procedimentos condicionais e ações de adicionar, repetir, remover e copiar para outros animais. Cobrir **Agenda** com mutirão, lotação, dia, ocorrência, horário, carregamento, erro e nova tentativa. Cobrir **Documentos** com anexar, substituir, remover, prévia, reaproveitamento, termo e aceite com foco por teclado. Conferir confirmação, protocolo, PDF e opção de criar senha quando aplicável. Verificar a variante da equipe e o reagendamento interno onde os componentes forem compartilhados.
4. **Migrar os demais serviços públicos.** Unificar a apresentação dos cabeçalhos e estados de **Acompanhar solicitação** e **Acessar minha solicitação**, preservando os contratos e pontos de entrada distintos. Cobrir os estados de código, reenvio, expiração, erro e retorno. Em **Credenciamento**, migrar cards de ONG e protetor, rótulos e campos com máscaras. Em **Denunciar**, aplicar o padrão em campos e ações, preservando sigilo, CEP, fotos por câmera e galeria, preparo, envio e confirmação.
5. **Migrar autenticação e área do tutor.** Usar o piloto do login da equipe para alinhar acesso do tutor e recuperação, com seus estados de identificação, contatos mascarados, código, reenvio e redefinição. Cobrir **Meus animais**, inclusive busca e paginação, prontuário e PDF, transferência, registro de óbito, nova solicitação autenticada, **Minhas solicitações**, **Meu perfil**, **Alterar senha** e saída. Preservar a troca obrigatória de senha e o retorno ao procedimento após autenticação, respeitando o uso interno do formulário de troca.
6. **Validar a entrega.** Rodar as verificações automatizadas ao final. Entregar roteiro para a conferência visual do usuário em desktop e celular. Conferir o diff final por fluxo e as regras que ainda atendem outras telas.

## Regras de negócio identificadas

- **Acompanhar solicitação** usa protocolo e contato e exibe o andamento. **Acessar minha solicitação** usa protocolo e CPF, valida o código e permite consultar o requerimento e, quando aplicável, criar a senha ou entrar.
- **Solicitar procedimento** mantém as quatro etapas e suas validações, incluindo o bloqueio de avanço quando necessário, o envio, a recuperação de conflito de agenda e as condições de confirmação.
- A área autenticada do tutor usa as informações e permissões da sessão para decidir quais animais, documentos, serviços e solicitações ficam acessíveis.

## Regras multi-tenant e segurança

- Preservar a origem do município em cada fluxo e a prioridade usada na resolução de links. Manter a reinicialização dos dados adequados ao trocar de município.
- Preservar a intenção de procedimento e agenda ao entrar como tutor, vinculada ao município e à conta corretos.
- Preservar mascaramento de contatos, validação e expiração dos códigos e permissões de acesso a documentos e PDFs.

## Validações necessárias

- Manter campos obrigatórios, máscaras e validações atuais de CPF, CEP, telefone, e-mail, senha, código e anexos.
- Conferir foco visível e navegação por teclado em botões, selects, cards de opção, fechamento, troca de etapa e aceite do termo. Associar rótulos e estados inválidos aos campos e manter mensagens de erro e status acessíveis.
- Conferir carregamento, estados vazios, erro e nova tentativa, seleção, navegação de ida e volta, envio e confirmação.

## Testes necessários

### Frontend

- Rodar as suítes existentes de componentes, etapas, campos de solicitação, seleção múltipla, confirmação, adoção, rastreamento, acesso, recuperação, sessão e serviços do tutor. Ajustar ou complementar testes quando uma mudança de marcação afetar um contrato ou quando for necessário cobrir uma regressão específica.
- Conferir as variantes externa e interna dos componentes compartilhados nos testes aplicáveis. Priorizar tipo do botão, rótulo acessível, estado de seleção, comportamento de envio e variante de navegação.

### Backend

- Rodar a suíte existente como verificação de regressão do projeto.

### Conferência manual pelo usuário

- Em desktop e celular, passar pela home e troca de município, abrir um link de adoção e conferir a disposição do menu e das listas abertas.
- Percorrer as quatro etapas da solicitação, incluindo erros, foco por teclado, agenda, anexos e confirmação. Repetir a entrada pelo tutor com um animal cadastrado.
- Conferir os estados de código em rastreamento, acesso e recuperação, o fechamento dos modais e os envios de credenciamento e denúncia. Verificar a navegação principal da área do tutor.

## Comandos de validação após a implementação

```text
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

## Riscos e pontos de atenção

- `styles.css` repete algumas regras e contém `!important`. Conferir precedência, estados e media queries antes de remover seletores. O foco de **Denunciar** e os overrides públicos de `NewRequest` precisam de atenção para evitar a soma de borda e outline nos inputs.
- `NewRequest`, `PublicSchedulePicker`, `RequestDoneCard`, `ModalHeader`, prévia de documentos e `PasswordChangeForm` têm consumidores externos e internos. Conferir o efeito de cada alteração nos dois pontos de entrada.
- Preservar o comportamento no celular, especialmente a abertura de listas sobre formulários e modais, o deslocamento de foco e o acesso ao rodapé das etapas.

## Perguntas em aberto

**Modelo dos selects com aprovação específica pendente.** A proposta é manter listas nativas em raça, bairro e tipo de contato, com a aparência compartilhada no campo fechado. Preservar o campo de texto do bairro quando não houver catálogo municipal. Reusar `MultiSelectDropdown` para procedimentos, com pesquisa quando aplicável, checkboxes, resumo e retorno do foco com `Esc`. Manter município e mês da agenda com seus controles próprios, alinhando o campo, a lista e o estado selecionado. Apresentar esse modelo para aprovação antes de replicá-lo.

## Critérios de aceite

- Os fluxos externos listados usam os padrões aprovados de cards, inputs, botões, modais e etapas. Os controles de seleção seguem o modelo aprovado separadamente.
- As ações, permissões, validações e estados de cada fluxo funcionam nos pontos de entrada atuais, inclusive links diretos e área autenticada do tutor.
- O CSS substituído sem consumidores é deletado e os usos compartilhados da equipe passam pelas verificações de regressão.
- Typecheck, testes e build passam sem erros novos. O usuário recebe o roteiro de conferência visual em desktop e celular.

## Observações para a skill `implementar`

- Usar este plano e `AGENT.md` como referência. Seguir a ordem por fluxo e incorporar as remoções ao mesmo ajuste que substitui o código.
- A implementação depende de uma invocação separada de `/implementar`. A replicação dos selects depende da aprovação específica registrada em **Perguntas em aberto**.
