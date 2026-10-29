# Protótipo, nova versão (proposta)

Recriação das 124 telas do app do tutor (Fases 1 a 5), posicionadas no canvas ao lado das originais, na mesma linha, 9400 px à direita. Cada seção tem o título original com "(nova versão)". Ficaram de fora o app do lojista, o painel admin e o site.

O que mantém da marca: Plus Jakarta Sans, o azul-céu `#9AD6F8` e as cores com significado de `paleta.json` (rosa saúde, lilás rotina, azul lugares, verde e amarelo só para estado, vermelho só no SOS).

O que muda:

- Fotos reais dos pets no lugar dos mascotes vetoriais e das ondas.
- Fundo papel frio `#F2F4F7` com cartões brancos; hierarquia por peso e tamanho, não por cor.
- Barra de abas flutuante escura, com o SOS sempre à mão no centro.
- Dados visuais: linha do tempo das vacinas, barra das doses do dia, semana dos lembretes.
- Mapa com mapa de verdade (OpenStreetMap) e cartão do lugar mais perto.
- Ícones Phosphor (regular) e uma escala única de cantos: cartões 24 px, campos 16 px, botões e selos em pílula.

Arquivos: `estilo.css` (tokens e componentes) e uma página HTML por tela. Miniaturas em `../imagens/tutor-v2/`.

Toda tela nova tem o mesmo nome da original (`Nome.dc.html` vira `v2/Nome.html`), menos estas três:

| Nova | Original |
| --- | --- |
| BoasVindas | Welcome |
| CriarConta | Login |
| CadastroPet | Main |

Lojas, pessoas e preços são dados de exemplo.

Fotos: Unsplash. Mapa: © OpenStreetMap.
