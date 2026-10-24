# Validação Android: QR, Premium e runtime

O perfil `preview` gera um APK para instalação interna, usando uma cópia
limpa dos commits. Alterações locais não commitadas não entram nesse build.
TypeScript e 16 testes passaram na cópia do commit `ca1387d`.

Preview com a URL corrigida: [a387fe10-ae05-406a-aeba-5e372b75689a](https://expo.dev/accounts/codaxi/projects/petlive-tutor/builds/a387fe10-ae05-406a-aeba-5e372b75689a).
Código enviado: `32d0125`. Runtime:
`1264fb8e8b1374172a594db4c6ebbf26fe172e0c`.
Build enviado ao EAS; confirmar sucesso e baixar o APK na página do build
antes de seguir o roteiro. Não foi submetido a nenhuma loja.

Os commits foram enviados para `origin/main`. O responsável informou que
o Redeploy no Coolify é manual e que aplicará a migration no Supabase.
Isso ainda precisa de confirmação e nova verificação HTTP.

O build [62190dd8-779a-4e7a-a28b-f0c936d04c3f](https://expo.dev/accounts/codaxi/projects/petlive-tutor/builds/62190dd8-779a-4e7a-a28b-f0c936d04c3f)
foi cancelado para substituir o domínio antigo pela URL informada pelo tutor.
Não usar esse build como evidência de validação concluída.

Site do preview: `http://nea67e6gbvk6kc25l5dct9qk.191.96.225.192.sslip.io`.
A URL foi configurada somente em `build.preview.env.EXPO_PUBLIC_SITE_URL`.
O perfil de produção conserva o domínio definitivo.

## Antes de testar o QR

O ambiente configurado no preview ainda precisa ser publicado:

- A consulta anônima de código inexistente a `qr_pet_publico` retornou HTTP 404.
- `https://petlive.app` retornou erro de DNS `ENOTFOUND` nesta máquina.
- A URL do Coolify fornecida responde por HTTP, mas `/p/[codigo]` retorna
  404. HTTPS apresentou `DEPTH_ZERO_SELF_SIGNED_CERT`; não foi ignorada a
  verificação do certificado. A validação de dados reais requer HTTPS válido.
- Aplicar `supabase/migrations/20261130000000_qr_coleira.sql` no projeto
  configurado e publicar a página `/p/[codigo]` em um domínio HTTPS acessível.
- Se o domínio publicado for outro, ajustar `EXPO_PUBLIC_SITE_URL` antes
  de distribuir etiquetas. Confirmar a URL no QR, sem reutilizar etiquetas
  de um ambiente de testes como etiquetas definitivas.

Essas verificações não publicaram o site nem alteraram o banco remoto.
Sem o endpoint, a tela deve mostrar falha de carregamento; isso não valida
a geração e o compartilhamento da etiqueta.

## Roteiro no aparelho

1. Instalar o APK quando o EAS concluir o build. Abrir o app e entrar na
   conta de teste. Conferir Perfil > Premium: plano correto, erro amigável
   quando desconectado e ausência de cobrança nesta versão.
2. Após publicar as dependências acima, abrir a carteirinha > QR da coleira.
   Gerar com foto, telefone e alergias desligados. Na página pública, conferir
   que aparecem somente nome e espécie.
3. Baixar a etiqueta PNG pelo compartilhamento do Android. Abrir o arquivo
   salvo e ler o QR com outro aparelho ou leitor de imagem. O destino deve
   ser o domínio configurado e o mesmo código mostrado pelo app.
4. Ativar um campo por vez e salvar. Reabrir a mesma URL para conferir que
   apenas os campos selecionados são exibidos. Ativar telefone sem cadastro
   deve pedir seu preenchimento no perfil.
5. Desativar o QR e reabrir o link: nenhum dado deve aparecer. Reativar e
   confirmar que a etiqueta antiga volta a funcionar, com o mesmo código.
6. Alternar conexão durante o carregamento e repetir a consulta. Uma falha
   de rede deve permitir nova tentativa, sem afirmar que o link foi cancelado.
7. Em um pet descartável de teste, registrar a partida e confirmar que o QR
   não abre. Reativar esse pet para verificar o retorno conforme as permissões.

Registrar aparelho, versão do Android, data, etapa, resultado esperado e
resultado observado. Os testes automatizados já cobrem orientação da matriz,
margem branca e decodificação do desenho; o aparelho valida a exportação nativa.

## Limites deste preview

A tela Premium consulta o plano, mas compra e restauração pelas lojas ainda
não estão integradas. O mapa usa a fonte/configuração disponível no build;
esta entrega não comprova Google Maps com chaves reais. Este APK interno
também não comprova publicação no Google Play ou na App Store.
