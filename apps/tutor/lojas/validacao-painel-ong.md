# Modo ONG: pets, interessados e adoção

Acesso: Atalhos → Adoção → Sou responsável por uma ONG. Exibe somente organizações vinculadas à conta, estado de aprovação, pets e quantidade de interesses. Listas de pets e contatos têm páginas de 20 itens com cursor composto data/ID, sem truncar no limite padrão do servidor.

ONG aprovada/responsável pode consultar mensagens/e-mails compartilhados e abrir o aplicativo de e-mail para responder. O servidor revalida conta e propriedade do contato antes da abertura. O usuário revisa e envia no aplicativo de e-mail; abrir o aplicativo não comprova envio/entrega. Contatos antigos sem e-mail têm explicação e não oferecem resposta. E-mail é selecionável para copiar quando não há aplicativo configurado.

Marcar como adotado exige confirmação, só vale para publicado e tem resultado idempotente no servidor. Remove o pet do catálogo, bloqueia novos interesses e preserva contatos antigos. Não permite reativar adotados ou contornar moderação de pets ocultos. ONG suspensa/recusada/pendente não pode acessar contatos nem alterar status. A RLS direta também aplica esse bloqueio; o tutor continua acessando seu próprio interesse.

Cadastro/aprovação de ONGs, documentos e cadastro/edição de novos pets permanecem em tasks próprias. Não há autoaprovação nem criação de ONG fictícia para preencher o painel. Contas sem ONG veem o estado vazio e a indicação de que o cadastro está em preparação.

## Verificações automatizadas

- Tutor: 240 testes/40 arquivos, TypeScript e lint aprovados.
- Testes do cliente: páginas inválidas, cursor, troca de conta antes/depois da consulta, confirmação real da adoção, revalidação do e-mail e codificação contra injeção no mailto.
- `supabase/tests/testar-painel-ong.mjs`: PGlite isolado com migration reaplicada, 25 pets/25 contatos com timestamps iguais, cursor sem duplicação, tutor/ONG diferente/anon, estados de aprovação, RLS direta, adoção idempotente, pet oculto, bloqueio de novo interesse e cascata após exclusão do tutor. Dados fictícios somente em memória.

## Homologação no aparelho

1. Entrar como responsável de ONG realmente aprovada com pets reais. Conferir organização, status e contagens; avançar páginas e atualizar.
2. Abrir interessados, ler mensagem e e-mail, voltar à lista. Outra conta ou ONG não pode acessar esses dados. Trocar de conta durante consulta deve descartar a resposta anterior.
3. Tocar Responder por e-mail: conferir destinatário/assunto e cancelar sem enviar. Com aplicativo ausente, verificar mensagem de erro e seleção do e-mail. Enviar de fato somente com autorização do destinatário/testador.
4. Em pet real de teste cuja adoção foi confirmada pela ONG, cancelar a confirmação primeiro. Depois confirmar a adoção: status Adotado no painel e indisponível no catálogo/ficha do tutor; os contatos continuam consultáveis pela ONG responsável.
5. Validar ONG suspensa/pendente/recusada, pet oculto e ausência de organização; falha de rede; paginação; retorno do aplicativo de e-mail e fonte ampliada. Android/iOS ainda precisam de teste no aparelho.
