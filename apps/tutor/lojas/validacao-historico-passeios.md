# Histórico de passeios e meta semanal

Task: `[APP-CLIENTE] Passeios: Histórico de passeios com totais por semana e meta semanal`.

Entrega de 24/10/2026: em Passeios, abrir Histórico e meta semanal. Lista de
passeios concluídos, filtro por pet, períodos Semana/Mês/Todos, totais de
distância, tempo ativo e quantidade da semana e do mês. Cada item permite
expandir o desenho do trajeto salvo. Pets já removidos continuam identificados
pelo nome guardado no passeio. Passeios ativos ou pausados não entram nos totais.

As datas seguem o horário local do aparelho. Semana começa segunda-feira à
meia-noite; mês começa no primeiro dia. O passeio pertence ao período de sua
finalização. Registros com fim futuro não entram. As bordas usam datas civis,
em vez de subtrair uma quantidade fixa de horas para construir a semana.

Grátis mostra hoje e os 29 dias anteriores. Premium confirmado pela consulta
atual mostra todo o histórico local. Carregamento não mostra dados antigos da
interface; erro na consulta do plano usa a janela grátis e oferece nova tentativa.
O filtro é aplicado antes dos totais, inclusive no mês com mais de 30 dias.
A tela informa essa limitação. Nenhum registro antigo é apagado pelo limite.

Meta opcional em quilômetros por semana para a conta inteira, somando os pets.
Aceita de 0,1 a 999,9 km com até uma casa decimal; vírgula e ponto são aceitos.
Campo vazio ou Remover meta desativa o objetivo. A barra termina em 100%, mesmo
quando a distância ultrapassa a meta. Selecionar um pet não muda esse progresso
global. Salvar/remoção só atualizam a interface depois da escrita confirmada;
erros permitem nova tentativa e preservam a configuração anterior. Falha ao
carregar bloqueia a edição até uma leitura bem-sucedida.

Meta é salva em chave própria no AsyncStorage, por tutor. Exportar meus dados
inclui `meta_semanal_passeios_km`, além dos passeios locais. Troca de conta
continua bloqueando exportação misturada. Remover meta não apaga trajetos;
apagar trajetos na tela do gravador não altera a meta configurada.

Não requer SQL, nova dependência ou configuração nativa. Dados são deste
aparelho, sem sincronização na nuvem. Backend, resumo completo com foto/anotação
e mapa de ruas, gravação em segundo plano e selo de passeios continuam em suas
tasks; esta entrega não encerra esses itens.

## Verificação

157 testes em 26 arquivos passaram, incluindo oito novos testes de histórico
e meta: janela grátis/Premium, troca de benefício, ordem e isolamento de conta,
semanas/meses/virada do ano, filtro por pet, tempo ativo/distância, progresso,
persistência por tutor, falha de escrita e configuração inválida preservada.
O teste de exportação foi ampliado para conferir a meta e a conta correta.
Rodar `npm test`, `npm run typecheck` e `npm run lint` em apps/tutor.

## Conferência no aparelho

1. Concluir pelo menos dois passeios e abrir Histórico e meta semanal.
2. Selecionar pets e períodos; comparar lista, distância, tempo e quantidade.
   Expandir/ocultar um trajeto. Pausados não devem aparecer como concluídos.
3. Salvar meta 2,5, reabrir a tela e conferir persistência; remover a meta e
   confirmar que os passeios continuam disponíveis. Valor inválido deve ser recusado.
4. Trocar de conta e verificar separação dos passeios e da meta. Conferir os
   dois campos locais na exportação de Meus dados.
5. Em grátis, verificar o limite de 30 dias; em Premium confirmado, o histórico
   completo. Erro de rede deve manter só a janela grátis, sem apagar registros.
6. Conferir teclado, fonte ampliada e lista vazia em tela pequena.

Esses testes de aparelho não foram executados nesta entrega. Os testes
automatizados usam registros e armazenamento controlados. A publicação preview
permite a conferência; não comprova recebimento da atualização no aparelho.

## Preview publicado — 24/10/2026

Commit a63b291 enviado para main. Cópia limpa aprovada em 157 testes, TypeScript,
lint e export Metro Android. [Atualização Android preview 2cca3421](https://expo.dev/accounts/codaxi/projects/petlive-tutor/updates/2cca3421-c7db-4baf-82a6-5d80bcd383ea).
Runtime 1264fb8e8b1374172a594db4c6ebbf26fe172e0c, confirmado pelo EAS com o
perfil preview e na publicação; compatível com o
[APK a387fe10](https://expo.dev/accounts/codaxi/projects/petlive-tutor/builds/a387fe10-ae05-406a-aeba-5e372b75689a).
Abrir o APK com internet para baixar a atualização e reabrir após o download.
O histórico está em Passeios → Histórico e meta semanal. O escopo desta task
está implementado, validado automaticamente e entregue no preview; marcado Done.
A homologação real do gravador/GPS continua no item próprio em andamento.

Referências consultadas: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)
e [FlatList do React Native](https://reactnative.dev/docs/flatlist).
