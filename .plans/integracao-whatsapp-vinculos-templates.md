# Integração WhatsApp: vínculos de template dinâmicos + sincronização com a Meta

Especificação mestre da reforma da tela de integração do WhatsApp. Criada em 2026-11-15, a partir da análise do registro `registro_configuracoes_meta_sistema_castracao.md` (raiz do repo) contra o código atual.

## Como retomar

1. `/clear`, escolher modelo e esforço manualmente (`/model`, `/effort`).
2. Ler **este arquivo**: pegar a primeira fase com status `[ ]`.
3. `/planejar .plans/integracao-whatsapp-vinculos-templates.md` informando "fase N"; depois `/implementar` e `/finalizar` na mesma conversa.
4. Marcar a fase como `[x]` aqui, com data e hash do commit.

## Objetivo

Hoje a tela de integração pede nomes de template digitados à mão (8 campos), chips de variáveis e credenciais, e nada confere com o que existe na Meta. Resultado: o envio falha por padrão com os templates já cadastrados. A reforma troca isso por:

- **Catálogo** de templates vindo da Meta por sincronização (somente leitura).
- **Vínculos** editáveis: cada evento do sistema aponta para um template aprovado, com o mapeamento das variáveis.
- Validação no momento de vincular, para não existir erro silencioso no envio.

Critérios do usuário: funcionar corretamente, não arriscar banimento da conta, ser prático.

## Estado atual (problemas confirmados no código)

- `castracao_confirmacao_agendamento` (Meta) tem 4 variáveis (nome, data, hora, local). O padrão do código é o nome `confirmacao_agenda_castracao` com 2 variáveis (`backend/src/services/whatsapp.js`, `getRuntimeConfig`). Só funciona se o usuário digitar o nome e clicar os chips na ordem certa.
- `castracao_reagendamento` (4 variáveis): o envio de `schedule_changed` manda sempre 2 parâmetros (protocolo + texto livre) em `dispatch-notification.js`. A Meta rejeita por contagem de parâmetros.
- `castracao_cancelamento` (3 variáveis): não existe evento de cancelamento em `shared/notification-contract.js`.
- Chip "Telefone" (`phone` em `WHATSAPP_TEMPLATE_VARS`, `src/domain.ts`) não é resolvido por `resolveTemplateVariable`: envia `-` em silêncio.
- `schedule_date` é TEXT (provavelmente `YYYY-MM-DD`); a variável de data vai sem converter para `dd/mm/aaaa` (só o texto livre converte, em `notification-message.js`). **Confirmar com um registro real na fase 1.**
- Fluxo legado (`legacy`) usa o template de confirmação também para `schedule_changed`.
- Token de acesso é mascarado na leitura (`routes/config.js`), mas não vi criptografia como a da `apiKey` (`config-secret-cipher.js`). Verificar na fase 2.
- Templates de acesso (senha inicial, recuperação, confirmação de telefone, contato alterado, acompanhamento) dependem de um template de **autenticação**, que a Meta bloqueou ("conta sem permissão"), provavelmente até a verificação empresarial ser aprovada (hipótese, não confirmada).

## Decisões fechadas (2026-11-15)

- **Credenciais por município** (token, ID da conta WABA, ID do número remetente). Cada município pode ter conta e número próprios. Consequência: catálogo e vínculos também são por município.
- **Sincronização na mesma reforma, em fases**: vínculos primeiro, sync logo depois. O sync pode ser testado já com o template de teste ativo (`3p_direct_integration_test_template`).
- **A Meta é a fonte da verdade dos templates.** Ninguém cadastra template à mão no sistema; o usuário escolhe de uma lista sincronizada.
- **Template novo na Meta não envia sozinho.** Aparece no catálogo após sincronizar; só é usado depois de vinculado a um evento. Evento novo (ex.: lembrete de véspera) exige código.
- **Os eventos e os campos de dados disponíveis são definidos em código.** O usuário mapeia posição `{{n}}` → campo conhecido (ou texto fixo).

## Modelo

1. **Catálogo** (por município, cache da sincronização): nome, idioma, status, categoria, qualidade, texto do corpo, quantidade de variáveis, estrutura dos componentes. Fonte: `GET /{WABA-ID}/message_templates`.
2. **Vínculos** (por município): uma linha por evento: `evento → { template, idioma, mapeamento[posição → campo | texto fixo] }`.
   - Eventos iniciais: confirmação de agendamento, reagendamento, cancelamento (novo), documentos conferidos, concluído.
   - Valores iniciais pré-preenchidos com os templates da Meta (`castracao_confirmacao_agendamento`, `castracao_reagendamento`, `castracao_cancelamento`).
3. **Regras de validação ao vincular**:
   - Só template com status aprovado.
   - Quantidade de variáveis do mapeamento = quantidade do template.
   - Variável sem campo correspondente: bloquear ou exigir texto fixo (nunca enviar `-`).
   - Componentes ainda não suportados (cabeçalho com variável/mídia, botão com variável) marcados como "formato não suportado".
   - Em tempo de envio: template pausado, desativado ou reprovado bloqueia o envio e registra motivo (proteção da qualidade do número).
4. **Autenticação (códigos)**: formato fixo (código no corpo + botão de copiar). Só o **nome** do template é editável, sem mapeamento. Um único template pode servir recuperação, confirmação de telefone e acompanhamento.

## Fases

| Fase | Conteúdo | Status | Plano |
|---|---|---|---|
| 1 | **Backend dos vínculos.** Chave de config de vínculos por município; catálogo de campos disponíveis; formatar data `dd/mm/aaaa`; remover `phone` dos campos; evento de cancelamento; envio passa a usar vínculos (corrige confirmação e reagendamento); migração dos valores atuais (`confirmationTemplate`, `templateVariables`, `whatsappTemplates`, templates de acesso) para vínculos; testes. | `[ ]` | |
| 2 | **Sincronização.** Campo do ID da conta (WABA); token com permissão de gerenciamento; endpoint de sync + cache do catálogo; status, categoria e qualidade; validação dos vínculos contra o catálogo; criptografar o token se ainda não for. Decidir polling vs webhook `message_template_status_update` (confirmar o nome do evento na documentação da Meta). | `[ ]` | |
| 3 | **Tela nova.** Grid de vínculos (criar/editar), grid do catálogo (somente leitura, botão "Sincronizar"), credenciais enxutas, status/cota/teste de envio mantidos. Remove os 8 campos de nome e os chips da tela antiga. | `[ ]` | |
| 4 | **Limpeza.** Remover chaves e caminhos antigos; avaliar fim do envio de senha inicial por WhatsApp (ver pendências); atualizar testes. | `[ ]` | |

## Pendências e riscos

- **Verificação empresarial da Meta não aprovada** e templates ainda "Em análise" (registro de 2026-11-14). O texto aprovado pode mudar; o sync absorve isso, mas validar os valores iniciais dos vínculos quando aprovarem.
- **Template de autenticação bloqueado** pela Meta. Sem ele, recuperação, confirmação de telefone e acompanhamento por WhatsApp não saem; o fallback é e-mail.
- **Proposta ainda não confirmada pelo usuário:** cortar o envio de **senha inicial por WhatsApp** (risco de reprovação ou recategorização pela Meta; suspeita, não verificada). Decidir antes da fase 4.
- **Token:** o registro informa que o token apareceu em capturas de tela e foi gerado no painel (costuma ser temporário, 24h). Trocar por token de usuário do sistema antes de uso real.
- **Limite atual da conta:** 250 conversas iniciadas pela empresa em 24h até a verificação.
- **Referência da Meta:** a documentação oficial não carregou na pesquisa; o endpoint e o evento de webhook vieram de documentação de terceiros (360dialog, Plivo, Chatwoot). Confirmar contra a referência da Meta na fase 2.
