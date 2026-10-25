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

## Preview publicado — 25/10/2026

APK 74634fba-1899-4717-ab63-d54033078a75 concluído (fonte 9436a23): https://expo.dev/artifacts/eas/erbQTPVVu1VTGEQ4QliAit9WD0ZBjU_ehrHucR1JpyU.apk . Download local solicitado: build/apk/PetLive-preview-2026-10-25.apk, 178799507 bytes, SHA256 65EDEAF57AFF794C20F356C6AF903535172152A33574B79984ECF1DA3B88181B. Arquivo ignorado pelo Git; manifest/classes.dex conferidos. Usuário informou que conseguiu acessar/obter o arquivo, sem confirmação funcional dos fluxos ainda.

OTA Android preview adbdacbf-3c99-4aaa-9002-afead428dd37 publicada a partir de bc152f387f2f020985950f76cc46e0e4b47ce485: https://expo.dev/accounts/codaxi/projects/petlive-tutor/updates/adbdacbf-3c99-4aaa-9002-afead428dd37 . Runtime 782d3618069253d333bb21ef58e609d7ef25e74e, igual ao APK e ao fingerprint calculado com perfil preview. Inclui compatibilidade de privacidade, resumo real de compartilhamentos e álbum anual. Abrir com internet e reabrir para receber; o APK antigo com runtime diferente não recebe essa OTA.

Cópia limpa: 274 testes/46 arquivos, TypeScript e lint aprovados, bundle Android gerado. Warnings transitivos do expo-router em export caíram para resolução de arquivos; bundle concluído. Homologação no aparelho continua pendente. Migrations 20261215000000 e 20261216000000 aplicadas em produção após ROLLBACK de validação; grants conferidos. Não ativada exclusão automática nem implantados serviços antigos de cuidador/carteirinha ausentes. RPCs cuidador_visao e cuidador_marcar_dose também confirmadas ausentes, além das rotinas de criação/revogação. Tasks afetadas reabertas. OCR depende de serviço de leitura ainda não implementado; tarefa de revisão não foi anunciada como concluída nem recebeu dados simulados.
