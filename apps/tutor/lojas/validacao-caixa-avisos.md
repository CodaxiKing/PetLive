# Caixa de avisos e abertura de fichas

No sino da tela inicial, abrir o histórico. A consulta carrega até cem avisos
dos últimos trinta dias, ordenados por data/ID. Falha mostra nova tentativa,
não a mensagem de lista vazia/Tudo lido. Reabrir a tela limpa os dados anteriores
e consulta de novo; resposta atrasada após sair/trocar de conta é descartada.

Tocar em aviso não lido espera confirmação de gravação do ID pelo servidor.
Falha mantém não lido e informa erro, sem navegar como se tivesse confirmado.
Resposta sem linha acessível também falha. Toques repetidos ficam bloqueados
durante a ação. Notificações já lidas abrem o destino sem nova gravação.
Consulta e atualização conferem a conta antes/depois, além da RLS do banco.

Backend faf835e: leitura própria e alteração somente de read_at reconciliadas
em produção. Abertura válida de carteirinha/ficha gera aviso no histórico,
no máximo um por link/hora. O texto não afirma que uma clínica identificada
abriu: pode ser o próprio tutor ou qualquer pessoa que recebeu o código.
Não há push integrado nesta entrega. Registro de intenção e limites de reuso
estão em 07dee60; não confirmam entrega por WhatsApp.

Fonte do app 6fafe86. Seis novos testes de serviço; total 280 testes/47 arquivos,
TypeScript e lint aprovados também no checkout limpo. Testes SQL específicos e
integrados passaram, incluindo UUID de places como em produção. Sem nova
dependência nativa. Fingerprint preview igual ao APK 74634fba, runtime
782d3618069253d333bb21ef58e609d7ef25e74e. Publicação registrada no relatório
docs/deploy/avisos-envios-fichas-2026-10-25.md.

Homologação no aparelho pendente: confirmar lista vazia real, falha de rede e
nova tentativa; abrir aviso não lido e retornar; negar rede na gravação e
conferir que o ponto permanece; tocar repetidamente; sair/trocar de conta
durante a consulta e gravação; fonte ampliada e leitor de tela. Gerar ficha
real autorizada e conferir aviso de abertura no histórico, sem usar documentos
ou contatos de terceiros como dados fictícios. Não presumir que houve push.
