# Plano de padronização e fotos na tela Denunciar

## Origem

Pedido no chat em 20 de novembro de 2026. Escopo aprovado após a revisão do plano preliminar. Classificação `fullstack`.

## Resultado esperado

A tela pública **Denunciar** usa campos com o mesmo estilo arredondado, permite anexar fotos da ocorrência e registra corretamente os dados do denunciante. A equipe abre as fotos na aba **Anexos** do processo.

## Diagnóstico e escopo

- O formulário em [App.tsx](../src/App.tsx) mistura regras de CSS para `text`, `tel` e `email`. Os rótulos estão em atributos `data-label`, e a tela mostra apenas os textos de exemplo na maioria dos campos.
- O formulário envia `tutor_name`, `tutor_email` e `is_confidential`. O [serializador da solicitação](../src/features/registered-animals/request-payload.ts) lê outras chaves para nome e e-mail e omite o sigilo. No fluxo público, o nome vazio pode impedir o registro.
- O trabalho cobre a entrada da denúncia, os campos e estilos compartilhados que ela usa, a validação das fotos e a exibição dos anexos para a equipe. A verificação de regressão inclui os demais formulários que usam os componentes alterados.

## Implementação

1. **Organizar o formulário.** Extrair `PublicReportPanel` de [App.tsx](../src/App.tsx) para um componente em `src/features/complaint/`. Simplificar as grades repetidas e remover a propriedade de município ignorada pelo componente. O município entra no pedido pela seleção da tela pública. Reaproveitar a [consulta de CEP](../src/features/animal-services/cep-lookup.ts), manter o preenchimento manual e aplicar a resposta apenas ao CEP ainda em edição.
2. **Padronizar campos e limpar estilos.** Reusar [Field](../src/components/ui.tsx) e os controles existentes do sistema. Usar rótulos visíveis, incluindo **E-mail (opcional)**, e consolidar altura mínima dos campos de uma linha, raio, borda, espaçamento e foco. Aplicar o mesmo acabamento à descrição, com altura própria. Preservar os teclados de telefone e e-mail, as máscaras e o controle de sigilo com rótulo clicável. Remover o `data-label` substituído e os seletores que perderem seus consumidores. Conferir os usos das grades de endereço e dos estilos compartilhados antes de removê-los. Os seletores órfãos `.form-subsection-title` e `.access-field--textarea` entram na limpeza dos campos.
3. **Corrigir o pedido enviado à API.** Ajustar o [serializador](../src/features/registered-animals/request-payload.ts) para incluir o nome, o e-mail e o sigilo preenchidos na denúncia. Cobrir a compatibilidade com as chaves já usadas pelo formulário de procedimento e com os valores do perfil do tutor. A confirmação da denúncia deve exibir o protocolo retornado após o registro.
4. **Adicionar a seção Fotos da ocorrência.** Colocá-la logo após a descrição. **Adicionar fotos** abre o seletor de arquivos com seleção múltipla. **Tirar foto** solicita a câmera traseira pelos controles nativos dos dispositivos compatíveis. O seletor de arquivos fica disponível como alternativa. Mostrar miniaturas, indicar o processamento de imagens e permitir remover cada foto até o envio. Aceitar até três fotos opcionais, com até 3 MB por foto depois do preparo no navegador. Usar JPEG ou PNG no envio e preservar a legibilidade ao reduzir imagens grandes. [Especificação de captura do W3C](https://www.w3.org/TR/html-media-capture/)
5. **Validar e persistir junto à denúncia.** Identificar as fotos pelo contrato de documentos da denúncia, com IDs reservados distintos para cada foto. Validar no backend o tipo de solicitação, a quantidade, a duplicidade, o formato real e o tamanho. Usar [a preparação de documentos](../backend/src/services/documents/request-documents.js), [a validação de conteúdo](../backend/src/services/documents/document-content.js) e [a transação existente](../backend/src/routes/requests.js) para gravar o conjunto em `requests.documents` no mesmo registro.
6. **Exibir para a equipe.** Usar a aba **Anexos** e a prévia e o download existentes. Identificar as imagens como **Fotos da ocorrência**, com estado informativo **Anexado**. As decisões sobre a denúncia continuam pelas ações do processo e as fotos opcionais ficam fora da contagem de pendências. Conferir a exportação das imagens no relatório do processo. [Linhas de anexos](../src/features/process-modal/attachment-rows.ts) [Modal de processo](../src/features/process-modal/process-modal.tsx)

## Dados e permissões

- A gravação usa a coluna `requests.documents` e o limite de 16 MB do pedido JSON. Três fotos de 3 MB ocupam aproximadamente 12 MB depois da codificação Base64, além dos demais dados. O preparo no navegador e a validação do tamanho total limitam o volume recebido e devolvido pela API.
- Cada foto fica vinculada à denúncia e ao município. A autorização da equipe segue o processo existente. Verificar separadamente o acompanhamento público, o catálogo e a consulta direta de documentos reaproveitáveis para impedir a exposição de fotos da denúncia por esses caminhos. [Acompanhamento](../backend/src/services/request-tracking/tracking-view.js) [Consulta de documentos](../backend/src/services/documents/document-catalog.js)
- A captura começa a partir do botão **Tirar foto**. A pessoa pode revisar e remover as imagens antes de enviar. Uma falha de preparo ou de envio deve preservar os dados e as fotos válidas para nova tentativa.
- Banco e infraestrutura usam o fluxo atual de criação de solicitações e anexos. A publicação segue a confirmação de produção prevista no [AGENT.md](../AGENT.md).

## Arquivos prováveis

- [App.tsx](../src/App.tsx), [ui.tsx](../src/components/ui.tsx) e [styles.css](../src/styles.css) para composição e estilo.
- `src/features/complaint/` para o formulário e a seleção de fotos. [request-payload.ts](../src/features/registered-animals/request-payload.ts) para o pedido enviado à API.
- [request-documents.js](../backend/src/services/documents/request-documents.js), [document-policy.js](../backend/src/services/documents/document-policy.js) e [document-catalog.js](../backend/src/services/documents/document-catalog.js) para permissão, validação e isolamento das fotos.
- [attachment-rows.ts](../src/features/process-modal/attachment-rows.ts) para identificar os anexos na interface da equipe.

## Validação e aceite

- Em desktop, tablet e celular, os campos têm o mesmo acabamento, rótulos legíveis e foco visível. A leitura e o preenchimento funcionam com teclado e toque.
- O formulário mantém máscaras, preenchimento manual do endereço e consulta de CEP. O envio com e sem fotos preserva nome, e-mail, telefone e sigilo e retorna protocolo.
- A escolha de um ou mais arquivos permite ver e remover as miniaturas. Testar captura, cancelamento e retorno ao formulário em Android e iOS compatíveis. A seleção de arquivos funciona como alternativa.
- Testar excesso de quantidade e tamanho, arquivo inválido, tentativa de enviar foto de denúncia em outro tipo de pedido e erro de envio com nova tentativa.
- A equipe autorizada abre e baixa a foto do processo. Testar isolamento entre municípios, projeção pública e indisponibilidade das fotos para reaproveitamento. As fotos aparecem como anexadas, e a denúncia pode ser registrada com zero fotos.
- Executar `npm run typecheck`, `npm test`, a suíte `backend/test/*.test.js`, `npm run build` e `git diff --check`, usando dados sintéticos nos testes de envio.

## Sequência de entrega

Começar pela extração do formulário e pela correção do pedido enviado à API. Em seguida, aplicar o padrão visual e remover os estilos obsoletos. Integrar a seleção e a captura de fotos à validação e à exibição no processo. Validar pelo fluxo público e pelo painel da equipe antes de finalizar.
