# Protótipo, nova versão (proposta)

Recriação de todas as telas do protótipo: as 124 do app do tutor, o painel admin, o app e o painel do lojista, o site e a identidade visual (186 no total). Cada tela fica no canvas ao lado da original, na mesma linha, 9400 px à direita, e cada seção tem o título original com "(nova versão)".

O que mantém da marca: Plus Jakarta Sans, o azul-céu `#9AD6F8` e as cores com significado de `paleta.json` (rosa saúde, lilás rotina, azul lugares, verde e amarelo só para estado, vermelho só no SOS).

O que muda:

- Fotos reais dos pets no lugar dos mascotes vetoriais e das ondas.
- Fundo papel frio `#F2F4F7` com cartões brancos; hierarquia por peso e tamanho, não por cor.
- Barra de abas flutuante escura, com o SOS sempre à mão no centro.
- Dados visuais: linha do tempo das vacinas, barra das doses do dia, semana dos lembretes.
- Mapa com mapa de verdade (OpenStreetMap) e cartão do lugar mais perto.
- Ícones Phosphor (regular) e uma escala única de cantos: cartões 24 px, campos 16 px, botões e selos em pílula.

No computador (painel admin e painel do lojista) a base é a mesma, com barra lateral escura na cor da barra de abas do app, faixa de números, tabelas e um painel de detalhe à direita.

Arquivos: `estilo.css` (tokens e componentes), `web.css` (moldura das telas de computador) e uma página HTML por tela. Miniaturas: app do tutor em `../imagens/tutor-v2/`, o resto em `../imagens/v2/`.

Toda tela nova tem o mesmo nome da original (`Nome.dc.html` vira `v2/Nome.html`), menos estas três:

| Nova | Original |
| --- | --- |
| BoasVindas | Welcome |
| CriarConta | Login |
| CadastroPet | Main |

Lojas, pessoas e preços são dados de exemplo.

Fotos: Unsplash. Mapa: © OpenStreetMap.
