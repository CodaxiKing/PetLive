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
