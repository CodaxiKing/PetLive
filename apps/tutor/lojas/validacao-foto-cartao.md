# Foto do cartão com guia

Task: `[APP-CLIENTE] Cartão por foto: Foto do cartão de vacina com guia de enquadramento`.

Em Pet → Documentos de saúde, selecionar Cartão de vacina e tocar em
Fotografar cartão com guia · Premium. A captura usa câmera traseira, moldura
para a página inteira, foco automático, lanterna opcional e instruções sobre
reflexos/bordas. A moldura orienta o enquadramento; a imagem salva é completa,
sem recorte automático. A prévia permite conferir, refazer ou cancelar.

Salvar foto como anexo envia a imagem somente após confirmação, para os anexos
privados existentes, e registra documentos_saude. Não cria vacinas, resultados
de OCR ou datas de vacinação. Nome/data do documento são validados antes de
abrir a câmera e antes de salvar. A leitura automática e revisão de vacinas
continuam nas tasks próprias do board. Não há quota de OCR consumida nesta etapa.

O Premium precisa ser confirmado na UI e novamente no serviço de salvamento.
O pet e a conta são conferidos antes do envio e do registro. Mudança de conta
impede anunciar sucesso para a conta errada. Falha de gravação tenta remover
somente o upload novo; erro de rede pode exigir limpeza posterior de arquivo
órfão. Um anexo já registrado não é apagado por troca de conta tardia.

Fotos têm limite de 10 MB e pelo menos 720 px em cada dimensão. Quando o aparelho
informa tamanhos disponíveis, usa a maior opção até 4 MP que preserve a resolução
mínima, ou a menor opção legível disponível. A foto temporária continua disponível
para tentar salvar de novo após falha; refazer, cancelar, sair ou concluir removem
a cópia do cache. Não há gravação automática na galeria. Não se solicita EXIF na
resposta da captura; isso não equivale a garantir remoção de metadados dos bytes.

A câmera só é montada enquanto a captura está aberta e o app está ativo. Sair
do primeiro plano desmonta a câmera; voltar exige seu callback de prontidão.
Resultados atrasados de preparação/captura são descartados quando a tela fecha.
Toques repetidos ficam bloqueados durante captura/envio. Voltar do Android e
Cancelar fecham quando não há operação em andamento. A captura guiada é móvel;
o acesso pelo navegador informa que deve usar o app do celular.

## Dependência nativa

expo-camera ~58.0.12 instalado com expo install para o SDK 58. Plugin oficial
configura a finalidade da câmera. Microfone/gravação de áudio estão desligados;
android.blockedPermissions remove RECORD_AUDIO inclusive de manifests transitivos.
A introspecção da configuração confirmou CAMERA habilitada, RECORD_AUDIO removida
e mensagem da câmera no iOS. Não foram gerados/editados projetos android/ios à mão.

Esta entrega exige novo APK: o runtime anterior
1264fb8e8b1374172a594db4c6ebbf26fe172e0c não contém o novo módulo. Não publicar
esta captura como atualização daquele runtime. O build preview inclui o módulo
e as entregas anteriores da main. Não exige SQL novo; depende dos anexos privados
e da tabela documentos_saude da migration 20261120000000_documentos_saude.sql.

## Verificação

210 testes (35 arquivos) passaram no tutor. Os testes novos cobrem seleção de
resolução, data civil inválida/bissexta, nome, URI/resolução/tamanho de imagem,
arquivo ausente, Premium/conta/pet, confirmação, falha de gravação, limpeza do
upload, troca de conta antes/depois do registro e exclusão restrita ao cache.
TypeScript e lint também passaram. Mocks não comprovam funcionamento da câmera.

## Conferência no Android — pendente

1. Instalar o novo APK preview. Abrir um pet próprio → Documentos de saúde →
   Cartão de vacina → Fotografar cartão com guia (Premium confirmado).
2. Negar câmera, autorizar depois e conferir que só a câmera é solicitada.
   Sem Premium, conferir o convite; erro de consulta do plano deve permitir tentar.
3. Fotografar página com texto/datas reais, usar lanterna e conferir nitidez,
   orientação, resolução e limites. A moldura não deve ocultar o texto salvo.
4. Refazer, cancelar e usar Voltar do Android. Sair/voltar ao app durante captura
   deve parar a câmera e impedir callbacks antigos de reutilizar uma sessão fechada.
5. Conferir a prévia e salvar anexo. Reabrir o documento e comparar a imagem.
   Vacinas da carteirinha não podem ser alteradas pelo salvamento da foto.
6. Testar falha de rede, nova tentativa e troca de conta. Conferir que só o pet/
   conta escolhidos recebem o anexo e que a outra conta não consegue abri-lo.
7. Conferir tela pequena, fonte ampliada e leitura dos botões.

Task permanece In Progress até homologação da câmera no aparelho. Backend OCR,
limite mensal/eliminação da imagem de leitura e revisão das vacinas seguem Todo.

Referências: [Expo Camera SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/camera/)
e [configuração do app SDK 58](https://docs.expo.dev/versions/v58.0.0/config/app/).
