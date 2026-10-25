# Álbum anual — prévia privada

Acesso: Pet → Linha do tempo → Montar álbum do ano (também para pets em memória).
Escolha um ano com registros, selecione até 60 lembranças e toque Ver prévia.
Cada lembrança vira uma página, em ordem cronológica, com data, título, texto
e foto quando existir. Editar seleção volta à montagem; mudar ano reinicia a
seleção daquele ano. A seleção fica somente em memória e é reiniciada ao sair.

Marcos manuais, chegada, nascimento e aniversários são sugeridos. Saúde não é
selecionada automaticamente: vacinas/consultas/pesos podem ser incluídos
explicitamente. Não há dados fictícios ou preenchimento dos meses sem registros.
Datas civis inválidas e itens duplicados são descartados; desempate por tipo/ID/data.

Usa linha_do_tempo e Storage privados existentes. Confere conta antes/depois
das operações; links de fotos valem cinco minutos e são pedidos somente para
fotos das páginas escolhidas, em pasta da própria conta. Falha de foto mantém
o texto com aviso. Reabrir a prévia renova os links. Callbacks antigos são
descartados ao sair, mudar ano ou trocar de conta/pet. Não grava/edita marcos,
não cria URLs públicas e não persiste seleção ou links em AsyncStorage.

Esta task entrega a montagem e prévia digital. PDF, gráfica, compra, endereço,
frete e Pix pertencem às tarefas seguintes; não há botão de pedido/cobrança.
Nenhuma migration ou dependência nativa adicional.

Testes: seis casos no albumAnual.test.ts cobrem seleção explícita de saúde,
anos/data civil, ordenação/deduplicação, limites, isolamento/troca de conta,
links privados e falhas. Rodar também TypeScript e lint.

Homologação nativa pendente: ano vazio e cheio, editar seleção, sessenta páginas,
foto ausente/expirada, modo offline, troca de conta/pet, voltar/retomar a tela,
pet em memória, fonte ampliada e leitor de tela. Build/bundle não certificam
essa experiência. Task permanece Em andamento até validação no aparelho.
