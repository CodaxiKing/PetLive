# Cadastro e edição de pets da ONG

Acesso: Adoção → Sou responsável por uma ONG → Novo pet para adoção, ou Editar dados e fotos. Somente organização aprovada e responsável pela conta; cadastro/documentos/aprovação da ONG permanecem nas tasks próprias.

Nome, espécie, nascimento opcional (data civil), porte, sexo e cuidados com três estados (sim/não/não informado), descrição e até seis fotos. Primeiro salve um rascunho; depois adicione fotos pela galeria e salve ou publique com confirmação. Publicação exige ao menos uma foto. Salvar um publicado confirma sua disponibilidade novamente. Pets adotados ou ocultos não podem ser editados/reativados por esse fluxo.

Servidor valida conta, organização, campos, datas/limites e versão. Um ID estável impede criar duplicados após falha de rede; se o servidor já gravou e a resposta se perdeu, use Atualizar ficha do servidor para conferir antes de salvar novamente. Edição com versão antiga falha sem sobrescrever alterações. Atualizar exige confirmação e descarta o rascunho local não salvo.

Fotos JPEG/PNG/WebP de até 5 MB no cliente, enviadas com nomes aleatórios sem sobrescrita, no bucket público pets: `<tutor>/<pet>-<uuid>.<ext>`. O servidor confere existência e vínculo do arquivo novo; fotos legadas podem ser preservadas. A pasta plana mantém compatibilidade com a rotina de exclusão de arquivos já existente. A mensagem na tela explica que fotos são públicas. Remover da ficha só altera a referência ao salvar: não apaga arquivos do Storage; uploads sem salvamento também podem permanecer até limpeza/exclusão da conta. Não há nova dependência nativa.

## Verificações

- Tutor: 246 testes/41 arquivos; TypeScript e lint.
- Testes do cliente: campos/data civil/publicação, payload editável, versão, conta trocada, foto sem sobrescrita, formato/tamanho/falha de upload.
- PGlite `supabase/tests/testar-ong-salvar-pet.mjs`: migration reaplicada; rascunho/publicação/foto própria; versão antiga sem sobrescrita e criação sem duplicação; conta/ONG diferente, pendente/suspensa/recusada, adotado/oculto, escrita direta negada e LGPD composta. Dados fictícios somente em memória.

## Homologação no aparelho

1. Usar ONG realmente verificada. Salvar dados de um pet real em rascunho, sair/voltar, editar e conferir persistência.
2. Adicionar/remover/reordenar pela remoção e nova inclusão, até seis fotos. Testar galeria cancelada, formato incompatível, foto grande, falha de rede e troca de conta. Alterações só devem entrar na ficha após salvar.
3. Confirmar publicação do pet real autorizado e conferir a ficha no catálogo como tutor. Verificar descrição, cuidados desconhecidos, data civil, fotos e região da ONG.
4. Em dois aparelhos, abrir a mesma versão: salvar num deles e conferir que o outro pede atualizar, preservando os dados do primeiro. Simular resposta perdida: atualizar a ficha em vez de criar outro pet.
5. Conferir bloqueio para outra ONG/conta, ONG não aprovada e pet adotado/oculto. Testar teclado, fonte ampliada e rolagem Android/iOS. Esses testes reais ainda estão pendentes.
