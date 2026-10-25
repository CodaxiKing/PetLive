# Troca de e-mail no app

Implementada em Meus dados → E-mail de acesso. Valida formato, repetição e diferença do endereço atual. A solicitação usa `auth.updateUser`, respeitando a confirmação configurada no Supabase; não altera segurança, SMTP nem redirects. O endereço efetivo é consultado no servidor pelo botão Verificar confirmação. Não declaramos confirmação apenas pelo sucesso da solicitação.

A operação usa um cliente temporário sem persistência, vinculado à sessão capturada; bloqueia conta divergente e sessão próxima de expirar. A tela descarta resultados após desmontar e impede toques duplicados. Não há envio de e-mails nos testes.

`20261227000000_sincronizar_email_confirmado.sql` sincroniza `profiles.email` apenas quando `auth.users.email` muda, preservando o endereço enquanto `email_change` estiver pendente. Função interna sem execução para clientes, search_path vazio. Não faz atualização em massa dos perfis existentes.

Validação: 326 testes do tutor, lint, TypeScript após geração das rotas pelo Expo e teste PGlite de pendência, confirmação, preservação dos demais dados, permissões e reaplicação. A migration foi validada no schema real com rollback antes da aplicação.

Pendente para encerrar o board: instalar uma versão contendo esta tela; solicitar a troca com uma conta de teste; confirmar os e-mails exigidos pelas configurações atuais; voltar ao app e verificar; sair e entrar com o novo endereço. Verificar erro, spam e reenvio sem alterar contas reais de terceiros. A entrega e o redirecionamento dos e-mails dependem da configuração já existente no Supabase. Não foram validados neste desenvolvimento.

Os limites de plano permanecem desligados. Sem alteração em Firebase, push ou cobrança.

Produção: migration aplicada em `qurdqbhjtgapyksrilyk` após o commit `51cb348`. Verificação de metadados confirmou `trigger_ativo=true`, `cliente_executa=false` e `limites_ativos=false`. Nenhuma solicitação de troca foi enviada durante a implantação.
