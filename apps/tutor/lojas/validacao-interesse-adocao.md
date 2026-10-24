# Ficha e interesse de adoção

Acesso: Atalhos → Adoção → Ver ficha e interesse. A ficha busca os dados atuais no servidor ao abrir/retornar e trata link inválido, pet indisponível, falha de rede e foto quebrada. Até seis fotos, cuidados informados pela ONG, idade, região e favorito. Não expõe cadastro/documentos da ONG nem contatos de outros tutores.

Tenho interesse abre mensagem (10–1000 caracteres), e-mail para resposta e concordância explícita em compartilhar ambos com a ONG responsável. Só registra após tocar Enviar interesse; o retorno do servidor confirma o registro. Não envia e-mail automaticamente. A ONG pode consultar os contatos pela RLS; a interface de gestão/resposta continua em task própria.

Servidor: conta esperada, pet publicado/confirmado há menos de 60 dias, ONG aprovada, bloqueio de interesse no próprio pet. Trava transacional por tutor evita duplicação e corridas no limite de cinco novos interesses em 24 h; nova tentativa retorna o recibo original sem alterar mensagem/e-mail ou consumir limite. Pet/ONG ficam protegidos por lock durante a verificação e gravação. Escrita direta e acesso anônimo continuam bloqueados. RLS, exportação LGPD existente e cascata incluem o e-mail. O formulário não persiste o rascunho no aparelho.

## Verificações automatizadas

- Tutor: 234 testes/39 arquivos, TypeScript e lint.
- `supabase/tests/testar-interesse-adocao.mjs`: PGlite isolado, migration reaplicada, conta/anon, consentimento, campos, recibo/retry, limite 24 h, indisponibilidade por status/60 dias/data futura/ONG suspensa, RLS tutor/ONG, exportação composta e cascata. Dados de teste somente em memória.
- A migration `20261209000000_interesse_adocao.sql` depende do catálogo `20261206`.

## Homologação no aparelho

1. Com ONG realmente verificada e pet real publicado, abrir ficha, percorrer fotos e favoritar. Voltar à lista e conferir favorito.
2. Testar link inexistente, pet adotado/sem atualização, foto inválida, modo offline e retorno à tela. Não deve aparecer confirmação de envio sem recibo do servidor.
3. Abrir Tenho interesse, conferir ONG destinatária e preencher e-mail/mensagem. Testar texto curto e e-mail inválido. Sem concordância, envio desativado.
4. Com dados reais e consentimento do tutor de teste, enviar uma vez. Atualizar, sair/retornar e tocar rapidamente: mesmo recibo, um contato. Não é reserva nem garantia de resposta/adoção.
5. Conferir no acesso da ONG que somente a responsável vê a mensagem/e-mail. Outra conta não pode lê-los. Validar exportação/exclusão de dados.
6. Trocar de conta durante a consulta/envio: a nova conta não pode receber dados ou confirmação da anterior. Testar fonte ampliada, teclado e rolagem em Android/iOS.

Esses testes nativos e o fluxo com uma ONG real continuam pendentes até execução no aparelho. Não publicar animais/ONGs fictícios para preencher o catálogo de produção.
