# Anúncio PetLive (Remotion)

Anúncio vertical (1080×1920, 30 fps, 40 s), sem narração: a mensagem vai em texto
animado, com trilha e efeitos sonoros originais. Recriado como projeto editável a partir de `../petlive-anuncio.mp4`.

Fica fora dos workspaces do pnpm de propósito: instale com npm aqui dentro.

```bash
npm install
npm run dev      # Remotion Studio em http://localhost:3020
npm run render   # gera out/petlive-anuncio.mp4
```

## Onde mexer

- `src/roteiro.ts`: tempos das cenas, frases de apoio, momentos das animações e a
  trilha opcional (`MUSICA`). Quase todo ajuste de ritmo é só aqui.
- `src/cenas/`: uma função por cena (abertura, recursos, fechamento).
- `src/mascote.tsx`: o Rex, com `alegria` de 0 (triste) a 1 (feliz).
- `src/fx.tsx`: confete, corações, brilhos, fundo com patinhas, batimento e radar.
- `src/telas.tsx`: telas do app redesenhadas do protótipo (`prototipo/*.dc.html`),
  com locais e números fictícios de exemplo.
- `src/ui.tsx`: celular 3D, títulos e frases animados, pílulas, câmera e transições.

## Música e efeitos

Trilha e efeitos são originais, sintetizados por `scripts/gerar-audio.mjs` (sem
material de terceiros). Os .wav já estão em `public/`; só rode de novo se mudar o
script ou os tempos das cenas:

```bash
npm run audio
```

Onde cada efeito toca e o volume ficam em `EFEITOS` no `roteiro.ts`; o volume da
trilha em `VOLUME_MUSICA`. Para trocar por uma música licenciada, ponha o arquivo
em `public/` e mude `MUSICA`.

---

# Anúncio motion 30 s (`PetLive-Motion-30s`)

Composição independente, vertical 1080×1920, 30 fps, 30 s, **sem áudio** (nenhum
`<Audio>`; o MP4 sai com `--muted`, sem faixa de som). Código em `src/motion30/`.
O anúncio de 40 s acima continua intacto (`PetLive-Anuncio`).

```bash
npm install
npm run dev              # Studio: escolha "PetLive-Motion-30s"
npm run render:motion    # out/petlive-motion-ad-30s.mp4 (H.264, yuv420p, sem áudio)
npm run still:motion     # capa (quadro 880) em out/petlive-motion-ad-30s-capa.png
npm run quadros:motion -- 0 150 300   # quadros soltos em out/frames para revisão
```

## Onde mexer

- `src/motion30/roteiro.ts`: **textos** (`TEXTOS`), início de cada cena (`CENAS`),
  momentos dos toques e cards (`BATIDAS`) e os dados fictícios das telas (`DADOS`).
  O tamanho do título se ajusta à linha mais longa; prefira linhas de até ~20 letras.
- `src/motion30/palco.tsx`: câmera (quadros-chave `POSES` do celular), o aparelho,
  o fundo e o card que sai do celular (`Destaque`).
- `src/motion30/telas.tsx`: telas recriadas do código de `apps/tutor` (Início,
  perfil do pet, Carteirinha, Medicamentos, Mapa).
- `src/motion30/app.tsx`: cores, ícones, mascotes e peças do app.
- `src/motion30/textos.tsx`: títulos, cards do gancho e o fechamento.
- `src/motion30/efeitos.tsx`: rastro de movimento, luz no vidro, bokeh, grão,
  confirmação de toque, halo do pin e as legendas dos cards ampliados
  (textos em `TEXTOS.destaques`).

O CTA é neutro ("Conheça o PetLive"): sem lojas, link, QR ou "grátis", porque a
disponibilidade nas lojas não está confirmada no projeto. Nome da clínica e
dados são fictícios; o fechamento traz "Telas ilustrativas com dados fictícios".
