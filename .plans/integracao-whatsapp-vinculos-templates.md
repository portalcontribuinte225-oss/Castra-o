# Integração WhatsApp: templates reconhecidos automaticamente

Especificação da integração do WhatsApp (Cloud API da Meta). Implementada em 2026-11-15 conforme `whatsapp-templates-reconhecimento-automatico.md`. O plano anterior, `reforma-integracao-whatsapp.md`, está substituído.

## Objetivo

O usuário cria o template na Meta, o sistema o identifica e o usuário só liga ou desliga, sem mexer no código e sem configurar variáveis. A Meta é a fonte da verdade dos templates; o sistema nunca os cadastra.

## Como funciona

- **Credenciais por município:** token (cifrado), ID da conta (WABA) e ID do número. Não há credencial de ambiente compartilhada entre municípios.
- **Catálogo:** `POST /api/whatsapp/templates/sync` lê `GET /{WABA}/message_templates` e guarda só fatos estruturais de cada template. A tela sincroniza ao abrir quando a última sincronização tem mais de 10 minutos.
- **Reconhecimento** (contrato em `shared/whatsapp-templates-contract.js`): o nome segue `castracao_<parte>` com sufixo opcional `_v<número>`, e as variáveis são numeradas, em ordem fixa por aviso. Um template fora disso aparece como "Fora do padrão", com o motivo.
- **Usos:** cinco avisos (agendamento confirmado, alterado e cancelado, documentos conferidos, atendimento concluído) e as mensagens de acesso (códigos, contato alterado, senha inicial). Um uso tem no máximo um template ativo por município.
- **Ligar** exige template reconhecido e aprovado na Meta; **desligar** só remove da lista de ativos. Sem template ativo, o aviso segue por e-mail.
- **No envio:** template ativo que sumiu da Meta, mudou de estrutura ou não está aprovado é bloqueado antes de consumir cota. Erros de template devolvidos pela Meta (pausado, desativado, não encontrado) são guardados no cache até a próxima sincronização.

## Decisões fechadas

- Variáveis numeradas, sem tela de mapeamento (variáveis com nome ficam para depois).
- Os 11 campos disponíveis são fixos no código; CPF, telefone e contatos não existem como variável.
- Tudo começa desligado até o usuário ligar.
- Aviso novo ou dado novo exige código.

## Pendências e riscos

- **Verificação empresarial da Meta** não aprovada e os três `castracao_*` ainda em análise: o primeiro envio real só acontece depois da aprovação.
- **Template de autenticação** bloqueado pela Meta para esta conta ("sem permissão para criar modelo"): os códigos de acesso por WhatsApp só funcionam depois que ele existir.
- **Senha inicial por WhatsApp:** decidir se corta (risco de reprovação ou recategorização pela Meta; suspeita não verificada).
- **Token:** trocar o temporário por token de usuário do sistema antes do uso real.
- **Chave de criptografia** (`CONFIG_ENCRYPTION_KEY`) válida no ambiente, senão salvar o token falha com 503.
- A API do Graph está na v21; o painel da Meta já mostra v25.
