# Selo Passeios em dia

Task: `[APP-CLIENTE] Selos: Selo Passeios em dia`.

Regra de BUSINESS.md 5.27: ao menos três passeios por semana durante quatro
semanas. A implementação considera as quatro semanas civis completas anteriores
à atual, de segunda a domingo, no horário do aparelho. A semana em andamento
não entra, evitando retirar o selo toda segunda antes de haver tempo de passear.
O intervalo de cada semana fica visível na tela Meus pets → pet → Selos.

O selo tem um card próprio abaixo dos seis selos calculados no servidor. Usa
os passeios concluídos do pet e da conta autenticada neste aparelho. Não depende
de Premium nem do limite de exibição de histórico: calcula a regra diretamente
nos registros locais. Não grava uma conquista permanente no servidor. Apagar
registros ou virar a semana recalcula o selo. Não envia avisos ou ranking.
Pausados, outros pets/contas, duplicatas e datas inválidas/futuras não contam.
Não há mínimo de distância ou duração adicional à regra de produto.

Recalcula ao focar a tela e a cada minuto enquanto ela está aberta. Troca de
conta/pet desmonta o card; resultados de leituras antigas não atualizam a tela.
Erro de armazenamento mostra falha explícita e nova tentativa, sem exibir
ausência de conquista como se a conferência tivesse funcionado. Erro no RPC
dos outros selos não bloqueia a conferência local dos passeios.

Sem SQL, novas dependências ou alterações na configuração nativa. Sincronização
e encerramento automático permanecem na task de backend de passeios.

## Verificação

Seis testes novos cobrem conquista e perda, distribuição semanal, limite de
segunda/domingo, semana atual excluída, contas e pets, duplicatas, passeios
pausados, datas inválidas, virada de semana/ano e fevereiro bissexto.
Rodar testes, TypeScript e lint em apps/tutor antes de publicar.

## Conferência visual no Android

1. Abrir um pet → Selos e conferir o card com quatro intervalos e contagens.
2. Comparar com passeios concluídos do pet; pausados não devem contar.
3. Trocar de pet e conta e conferir o isolamento. Voltar à tela após salvar ou
   apagar passeios deve recalcular sem depender do RPC dos demais selos.
4. Conferir fonte ampliada, leitura por acessibilidade e tela pequena.

O teste visual no aparelho não foi executado nesta entrega. Os testes puros
usam registros controlados; não comprovam a precisão do GPS real.

Referência consultada: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/).
