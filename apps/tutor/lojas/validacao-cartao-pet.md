# Cartão do pet: temas, formatos e convite

Task: `[APP-CLIENTE] Cartão do pet: Temas de cor, formatos Stories e Post e link de convite`.

Implementados cinco temas (Céu, Jardim, Lavanda, Carinho e Sol), Post 1:1 e
Stories 9:16. Céu é o tema grátis; os outros exigem uma consulta atual que
confirme Premium. Carregamento, erro e retirada do benefício usam Céu.
Os dois formatos estão disponíveis no grátis. O modo memorial conserva
o texto Em memória e omite selos de metas.

A prévia tem proporção fixa, texto limitado ao espaço disponível e tamanho
de fonte próprio da imagem. Os controles continuam usando a fonte acessível
do sistema. Alterar formato/tema remonta a prévia e bloqueia a exportação
até layout e foto estarem prontos. Durante o compartilhamento os seletores
ficam desabilitados. Falhas de foto/selos permitem tentar de novo.

A exportação PNG usa 1080 × 1080 ou 1080 × 1920. O view-shot 6.1.1 instalado
recebe pixels finais no Android (`RNViewShotModule.java`, scaleWidth/scaleHeight)
e tamanho lógico no iOS (`RNViewShot.mm`, UIGraphicsImageRenderer na densidade
da tela). Por isso o helper divide as dimensões por PixelRatio somente no iOS.
A resolução efetiva ainda deve ser conferida em arquivos exportados reais.

O convite usa apenas a origem de EXPO_PUBLIC_SITE_URL com parâmetros genéricos
utm_source=cartao_pet e utm_medium=compartilhamento. Caminhos, queries e
fragmentos da configuração são removidos; endereços inválidos/com credenciais
não geram convite. O QR leva ao site e o botão Compartilhar link de convite
abre o menu do sistema com texto e URL. Não há atribuição individual, recompensa
ou código de acesso ao pet. Sem endereço válido, o cartão continua exportável,
com aviso e sem QR. O convite não dá acesso à ficha de saúde.

## Validação automatizada

Rodar `npm test`, `npm run typecheck` e `npm run lint` em apps/tutor.
Os testes verificam dados públicos, memorial, retorno ao tema grátis,
proporções/densidades e remoção de parâmetros privados. O QR é rasterizado
em 192 × 192 e decodificado por jsQR usando a URL longa do preview.
Isso não substitui a captura nativa ou uma leitura pela câmera.

## Roteiro de aparelho — pendente

1. Abrir um pet em Cartão do pet; grátis deve permitir Céu e ambos os formatos.
2. Em conta Premium, escolher os cinco temas e alternar Post/Stories.
3. Conferir nome/raça longos, pet sem foto, seis selos e pet em memória;
   nada deve ultrapassar os limites do cartão. Verificar tela pequena e fonte
   ampliada nos controles.
4. Gerar PNG nos dois formatos e conferir resolução/proporção no arquivo.
   Confirmar foto, nome, raça e selos iguais à prévia.
5. Escanear o QR da imagem em outro aparelho: deve abrir o site, sem ficha ou
   identificadores pessoais. Compartilhar o convite pelo botão separado.
6. Trocar tema/formato durante o carregamento da foto: exportar só deve ser
   possível depois de a nova prévia carregar. Cancelar o menu do sistema e repetir.
7. Reabrir sem internet e em caso de falha dos selos/foto: verificar aviso e
   nova tentativa. A indisponibilidade da consulta do plano mantém Céu.
8. Retirar Premium pelo servidor e reabrir a tela: o tema deve voltar a Céu.

Não requer migration, nova dependência ou novo módulo nativo. Task permanece
In Progress até conferir exportação, layout e convite em aparelho.

## Preview publicado — 24/10/2026

Código cb9395c enviado para main e publicado em cópia limpa, após 131 testes,
TypeScript e lint aprovados. [Atualização Android preview](https://expo.dev/accounts/codaxi/projects/petlive-tutor/updates/e978a0f2-8d24-458f-85d3-ffb6df2a6d63).
Runtime 1264fb8e8b1374172a594db4c6ebbf26fe172e0c, compatível com o
[APK a387fe10](https://expo.dev/accounts/codaxi/projects/petlive-tutor/builds/a387fe10-ae05-406a-aeba-5e372b75689a).
O endereço público do convite respondeu HTTP 200 nesta entrega.

Conferir a compatibilidade com
`npx eas-cli@latest fingerprint:generate --build-profile preview --platform android --json --non-interactive`.
O cálculo local sem o perfil completo retornou 7ab8864e0a0ec045ef994e3d4f71402b91e21545
tanto para o código novo quanto para o commit anterior 490df32. O cálculo EAS
com o perfil e a publicação confirmaram 1264fb8e8b1374172a594db4c6ebbf26fe172e0c.
Não foi alterada a configuração nativa para forçar compatibilidade.

No APK compatível, fechar e abrir o app com internet para receber a atualização;
se necessário, abrir novamente após o download. Depois seguir o roteiro acima.
Publicar a OTA não confirma que o aparelho a recebeu ou que o teste nativo passou.

Referências consultadas: [Expo SDK 58 Sharing](https://docs.expo.dev/versions/v58.0.0/sdk/sharing/),
[Expo SDK 58 view-shot](https://docs.expo.dev/versions/v58.0.0/sdk/captureRef/)
e [React Native Share](https://reactnative.dev/docs/share).
