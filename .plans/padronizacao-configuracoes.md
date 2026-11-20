# Plano de implementação da padronização de Configurações

## Origem

- Escopo solicitado no chat para aplicar às telas de **Configurações** o padrão usado na área externa.
- Plano preliminar aprovado no chat em 20/11/2026.
- Classificação `frontend-only`.

## Resumo

Padronizar os campos, cards, filtros, botões e modais das 15 telas de **Configurações**. Reaproveitar os componentes e tokens existentes e remover os estilos substituídos por fluxo. Preservar os contratos da API, as permissões, os vínculos e o escopo por município.

## Escopo

### Dentro do escopo

- **Configurar Ambiente** com Agenda e Mutirão, Tipos de Solicitação, Portes, Espécies, Raças, Bairros e Documentos Solicitados.
- **Dados Gerais**, **Criar Usuários**, **Criar Setores** e **Permissões**.
- **Integrações** com WhatsApp, E-mail, SMS e Inteligência Artificial.
- Navegação de Configurações, filtros, listas, formulários, modais de criação, edição e vínculo e seus estados de carregamento, vazio, erro e sucesso.

### Fora do escopo

- Outras áreas do painel e do portal público.
- Mudanças de regras de negócio, rotas, dados, permissões, backend, banco ou infraestrutura.

## Leitura de contexto

- `AGENT.md` e o escopo e feedback aprovados no chat.
- `.plans/padronizacao-area-externa.md` como referência do padrão visual.
- `src/App.tsx` nos trechos de navegação, `ConfigView`, `SimpleConfigList` e seletores próprios.
- `src/components/ui.tsx`, primitives de UI, `SavedSecretField`, módulos de Configurações e trechos relevantes de `src/styles.css`.

## Impacto por área

### Frontend

| Controle | Padrão |
| --- | --- |
| Cards e listas | Reusar `Card` com cantos arredondados e borda discreta. Usar botão nativo quando toda a linha tiver uma única ação. Em linhas com várias ações, oferecer controles independentes. |
| Campos de texto | Reusar `Input` com fundo branco, altura de 44 px, raio de 14 px e uma borda verde no foco. Preservar os tipos, máscaras, autocomplete e estados inválido, desabilitado e somente leitura. Textareas preservam sua altura multilinha. |
| Botões e filtros | Reusar `Button` com a geometria em pílula do menu, borda fina e as cores atuais das ações. Manter rótulos, foco visível, estado ativo acessível, ícones e progresso de salvamento. |
| Modais | Reusar o X de `CloseButton` e alinhar cabeçalhos e rodapés. Preservar a largura útil, a rolagem interna e a ordem de foco dos formulários extensos. |
| Controles de seleção | Inventariar selects simples, seleção múltipla, checklists, toggles e controles próprios. Aplicar aos selects o modelo aprovado separadamente. |

Aplicar Tailwind no JSX com o prefixo `tw:` e os tokens compartilhados. Reaproveitar `ConfigSectionHeader`, `ConfigStatusFilter` e `ConfigActiveToggle` como pontos comuns das telas de Configurações.

### Backend

Sem impacto esperado. Preservar as chamadas atuais, os payloads e o escopo de leitura e salvamento.

### Banco de dados

Sem impacto esperado. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infraestrutura e deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx` nos trechos de navegação de Configurações, `ConfigView`, `SimpleConfigList` e componentes de vínculo usados nessas telas.
- `src/styles.css` e `src/components/ui.tsx`. Reusar `Card`, `Input`, `Button` e `CloseButton` conforme os consumidores identificados.
- `src/features/breeds/`, `src/features/neighborhoods/` e `src/features/municipality-form/`.
- `src/components/saved-secret-field.tsx` e os módulos `src/features/whatsapp-integration/`, `src/features/email/`, `src/features/sms/` e `src/features/message-contract/`.
- Testes existentes das áreas que tiverem mudanças de marcação ou interação.

## O que será removido

- O botão legado `.config-create-action` e seus estilos exclusivos após a migração da ação de criar para `Button`.
- As classes de seleção `.active` ou `.selected` que controlam os botões migrados de `.config-status-filter`. Preservar as regras de layout que ainda forem necessárias.
- A marcação de linha com `role="button"`, `tabIndex` e clique em catálogos com ação única após sua substituição por botão nativo. Manter ações distintas onde a linha contém outros controles.
- As instâncias do X desenhadas diretamente em Setores e Permissões e as regras exclusivas do botão legado nos modais migrados, incluindo os ramos de `.config-clean-modal .modal-header-close` que perderem uso.
- Os seletores exclusivos de altura, raio, fundo e sombra de foco substituídos em formulários migrados. Conferir os overrides de `.config-modal.compact .field input`, `.modal-backdrop` e as regras tardias de `.field input` antes de retirar ramos. Manter os consumidores de Adoção interna, Processo, Dashboard e outras áreas.
- Imports, invólucros e estilos que perderem uso em cada etapa. Nas regras compartilhadas entre WhatsApp, E-mail e SMS, retirar cada ramo após conferir seus consumidores nos três canais.

## Estratégia de implementação

1. **Validar o padrão em Portes e Espécies.** Inventariar os seletores por estado e reaproveitar `SimpleConfigList`, cabeçalho, filtro e toggle. Padronizar a lista, a ação de criar e os modais simples. Conferir a abertura das linhas com Enter e Espaço, o foco ao abrir e fechar o modal e o estado acessível de Ativos, Inativos e Todos.
2. **Migrar Raças e Bairros.** Aplicar o padrão às listas e modais de criação e edição. Preservar o vínculo entre raça e espécie e a criação de bairros em lote. Tratar estados de validação, salvamento e nenhum resultado.
3. **Migrar Dados Gerais, Usuários, Setores e Permissões.** Alinhar listas, filtros, formulários, toggle de ativo e modais. Preservar consulta de CEP, upload de brasão e logo, ações por perfil e município, vínculo de usuários e setores e dependência Estado → Município → Setores e Grupo. Preservar o submodal de adicionar setor e seus retornos ao formulário.
4. **Migrar Agenda, Tipos de Solicitação e Documentos Solicitados.** Alinhar campos, seções e rodapés com Tailwind e os componentes existentes. Cobrir agenda recorrente, dia específico, Mutirão, datas, faixas de horário, local e vagas. Preservar taxas e vencimentos, vínculos com documentos e raças, critérios de análise por IA e a política de reaproveitamento.
5. **Migrar WhatsApp, E-mail, SMS e IA.** Padronizar `SavedSecretField` entre os três canais que o usam. Preservar credenciais mascaradas, substituição, remoção com confirmação, estados de testes de envio, contratos e cotas. Cobrir a lista, o vínculo e a prévia de templates no WhatsApp e a validação, o salvamento e a remoção da chave em IA.
6. **Validar por fluxo.** Rodar typecheck, testes de frontend e backend e build após as mudanças. Entregar roteiro para a conferência do usuário em desktop e celular, cobrindo variantes de perfil, formulários longos, foco e estados de retorno. Verificar que a versão em teste contém as alterações entregues antes da conferência visual.

## Regras de negócio identificadas

- Preservar os filtros Ativos, Inativos e Todos, suas contagens e o resultado de ativar ou desativar registros.
- Preservar as dependências entre espécie e raça, município e demais catálogos, tipo de solicitação e seus documentos e raças vinculados.
- Preservar os valores, condições, validações e o momento de envio de cada formulário. Manter as regras específicas de agenda, documentos e reaproveitamento.
- Nas integrações, conservar a distinção entre credencial da plataforma, configuração municipal, permissão do canal, contrato, cota e ativação.

## Regras multi-tenant e segurança

- Preservar a resolução do município selecionado e as diferenças de acesso entre administrador global, gestor municipal e grupos com permissões específicas.
- Conferir a filtragem de setores, grupos, documentos e demais itens ao trocar de município. Preservar a limpeza ou substituição de seleções dependentes.
- Preservar a exibição mascarada das credenciais e as permissões já exigidas para salvar, remover, testar e editar contrato ou cota.

## Validações necessárias

- Testar campos de texto, e-mail, telefone, senha, número, data e horário em desktop e celular. Conferir altura, borda, foco, máscaras, preenchimento, erro e estado desabilitado.
- Conferir foco por teclado, Enter e Espaço nas linhas, estado selecionado dos filtros, fechamento com `Esc` e retorno ao acionador. Conferir alcance do rodapé nos modais com rolagem.
- Cobrir criação, edição, ativação, troca de município, vínculos, carregamento, falha, nova tentativa e mensagens de sucesso. Usar dados de teste e preservar os contratos.

## Testes necessários

### Frontend

- Rodar as suítes existentes de municípios, Raças, Bairros, acesso a integrações, WhatsApp, E-mail, SMS e contratos de mensagens.
- Atualizar testes afetados pela marcação e acrescentar cobertura quando necessário para regressões específicas de teclado, seleção, confirmação ou visibilidade por perfil.

### Backend

- Rodar a suíte existente de regressão do projeto.

### Conferência manual pelo usuário

- Em desktop e celular, conferir Portes ou Espécies do filtro à edição, Raças e Bairros, Dados Gerais com upload, os vínculos de Usuários e Setores e a grade de Permissões.
- Percorrer um formulário longo de Agenda, os vínculos de Tipo de Solicitação e as opções de Documentos Solicitados.
- Conferir Integrações com credenciais mascaradas, modais, estados de teste de envio e a visibilidade das ações em perfis distintos.

## Comandos de validação sugeridos

```text
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

## Riscos e pontos de atenção

- O CSS legado aplica estilos de entrada em camadas. Um `Input` dentro de `.field` ainda pode receber borda, fundo e foco forçados por regras globais. Corrigir o seletor efetivo conforme cada formulário for migrado.
- `Field`, `ModalHeader` e `PanelHeader` atendem áreas fora de Configurações. A migração deve preservar esses pontos de entrada.
- Classes com prefixo `.whatsapp-` são compartilhadas com E-mail e SMS. Conferir os três canais antes de remover os estilos.
- Em formulários longos, preservar a rolagem, o acesso ao rodapé, a navegação por teclado e a operação de submodais.

## Perguntas em aberto

**Modelo dos selects com aprovação específica pendente.** A proposta é manter listas nativas em campos de opção única como município, espécie e modelo de IA, e aprovar a aparência do campo fechado antes de replicá-la. Seleção múltipla, dias da semana, documentos vinculados e permissões preservam suas interações próprias.

## Critérios de aceite

- As 15 telas e seus modais usam o padrão aprovado de cards, inputs, botões, filtros e fechamento. Selects seguem o modelo aprovado separadamente.
- Validações, vínculos, permissões, dados por município e chamadas da API permanecem compatíveis nos pontos de entrada atuais.
- Campos e ações são acessíveis por teclado. Carregamento, vazio, erro e sucesso ficam identificáveis nos fluxos afetados.
- O CSS substituído sem consumidores foi deletado. As validações passam sem erros novos, e o usuário recebe o roteiro de conferência visual.

## Observações para a skill `implementar`

- Usar este plano e `AGENT.md` como referência. Incorporar as remoções ao ajuste que substitui os estilos e a marcação de cada fluxo.
- Iniciar em uma invocação separada de `/implementar`. Replicar o modelo dos selects após sua aprovação específica.
