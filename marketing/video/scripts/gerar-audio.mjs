/**
 * Gera a trilha (public/musica.wav) e os efeitos (public/sfx/*.wav) do anúncio,
 * sintetizados aqui mesmo: nada de terceiros, sem questão de direitos.
 *
 *   node scripts/gerar-audio.mjs
 *
 * A trilha segue as cenas de src/roteiro.ts (tempos repetidos em CENA abaixo):
 * tensa em lá menor no gancho, vira alegre em dó maior na marca, segura a
 * tensão na emergência e fecha grande no final. Mudou o tempo de uma cena lá?
 * Ajuste aqui e rode de novo.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SR = 44100;
const DUR = 40;

const CENA = { marca: 4.6, emergencia: 21.2, socorros: 24.6, cta: 35.6 };

/* ── Utilidades ──────────────────────────────────────────────────────────── */

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
let semente = 7;
const ruido = () => {
  // Gerador simples e determinístico: o arquivo sai igual a cada execução.
  semente = (semente * 1103515245 + 12345) & 0x7fffffff;
  return (semente / 0x7fffffff) * 2 - 1;
};

const novo = (s) => new Float32Array(Math.ceil(s * SR));

/** Soma `fn(t)` em `buf` a partir de `ini` segundos, por `dur` segundos. */
const soma = (buf, ini, dur, fn) => {
  const a = Math.max(0, Math.floor(ini * SR));
  const b = Math.min(buf.length, Math.floor((ini + dur) * SR));
  for (let i = a; i < b; i++) buf[i] += fn((i - a) / SR, i / SR);
};

/** Passa-baixa de um polo, in-place. */
const passaBaixa = (buf, corte) => {
  const k = 1 - Math.exp((-2 * Math.PI * corte) / SR);
  let y = 0;
  for (let i = 0; i < buf.length; i++) buf[i] = y += k * (buf[i] - y);
  return buf;
};

const salvarWav = (arquivo, buf, ganho = 1) => {
  // Normaliza o pico em -1 dB e satura de leve para não estourar.
  let pico = 0;
  for (const v of buf) pico = Math.max(pico, Math.abs(v));
  const alvo = 0.89 * ganho;
  const dados = Buffer.alloc(44 + buf.length * 2);
  dados.write("RIFF", 0);
  dados.writeUInt32LE(36 + buf.length * 2, 4);
  dados.write("WAVEfmt ", 8);
  dados.writeUInt32LE(16, 16);
  dados.writeUInt16LE(1, 20);
  dados.writeUInt16LE(1, 22);
  dados.writeUInt32LE(SR, 24);
  dados.writeUInt32LE(SR * 2, 28);
  dados.writeUInt16LE(2, 32);
  dados.writeUInt16LE(16, 34);
  dados.write("data", 36);
  dados.writeUInt32LE(buf.length * 2, 40);
  for (let i = 0; i < buf.length; i++) {
    const v = Math.tanh((buf[i] / (pico || 1)) * 1.1) * alvo;
    dados.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  mkdirSync(dirname(arquivo), { recursive: true });
  writeFileSync(arquivo, dados);
};

/* ── Instrumentos ────────────────────────────────────────────────────────── */

const env = (t, ataque, queda) => Math.min(1, t / ataque) * Math.exp(-t * queda);

/** Pluck brilhante (seno + triângulo, levemente desafinados). */
const pluck = (buf, ini, m, vol = 0.22, dur = 0.5) => {
  const f = midi(m);
  soma(buf, ini, dur, (t) => {
    const tri = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * 1.003 * t));
    return (Math.sin(2 * Math.PI * f * t) * 0.6 + tri * 0.4) * env(t, 0.004, 7) * vol;
  });
};

/** Sino suave (para a melodia do final e acentos). */
const sino = (buf, ini, m, vol = 0.18, dur = 1.6) => {
  const f = midi(m);
  soma(buf, ini, dur, (t) => (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 6)) * env(t, 0.003, 2.6) * vol);
};

/** Pad de acorde: harmônicos ímpares, ataque lento e trêmulo. */
const pad = (buf, ini, notas, dur, vol = 0.05) => {
  soma(buf, ini, dur, (t) => {
    const a = Math.min(1, t / 0.25) * Math.min(1, (dur - t) / 0.3);
    let s = 0;
    for (const m of notas) {
      const f = midi(m);
      s += Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t) + 0.12 * Math.sin(2 * Math.PI * f * 3 * t + 1);
    }
    return s * a * vol * (0.85 + 0.15 * Math.sin(2 * Math.PI * 4 * t));
  });
};

const baixo = (buf, ini, m, dur = 0.24, vol = 0.32) => {
  const f = midi(m);
  soma(buf, ini, dur, (t) => (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.4) * env(t, 0.005, 6) * vol);
};

const bumbo = (buf, ini, vol = 0.7) => {
  let fase = 0;
  soma(buf, ini, 0.35, (t) => {
    fase += (2 * Math.PI * (45 + 90 * Math.exp(-t * 28))) / SR;
    return Math.sin(fase) * Math.exp(-t * 9) * vol;
  });
};

const palma = (buf, ini, vol = 0.28) => {
  const n = novo(0.25);
  soma(n, 0, 0.25, (t) => ruido() * (Math.exp(-t * 22) + 0.5 * Math.exp(-Math.abs(t - 0.012) * 300)));
  // Tira o grave do ruído para soar como palma.
  const g = passaBaixa(Float32Array.from(n), 900);
  soma(buf, ini, 0.25, (t) => (n[Math.floor(t * SR)] - g[Math.floor(t * SR)]) * vol);
};

const chimbal = (buf, ini, vol = 0.07, queda = 60) => {
  let ant = 0;
  soma(buf, ini, 0.12, (t) => {
    const r = ruido();
    const h = r - ant;
    ant = r;
    return h * Math.exp(-t * queda) * vol;
  });
};

const prato = (buf, ini, vol = 0.14) => {
  let ant = 0;
  soma(buf, ini, 2.2, (t) => {
    const r = ruido();
    const h = r - ant * 0.6;
    ant = r;
    return h * Math.exp(-t * 2.2) * vol;
  });
};

/** Subida de ruído + tom, para preparar uma virada. */
const subida = (buf, ini, dur, vol = 0.12) => {
  let fase = 0;
  soma(buf, ini, dur, (t) => {
    const p = t / dur;
    fase += (2 * Math.PI * (200 + 1400 * p * p)) / SR;
    return (ruido() * 0.6 + Math.sin(fase) * 0.4) * p * p * vol;
  });
};

/* ── Trilha ──────────────────────────────────────────────────────────────── */

const musica = () => {
  const m = novo(DUR);
  const COLCHEIA = 0.25; // 120 bpm

  // Gancho (0 → marca): lá menor tenso, relógio tiquetaqueando e coração.
  pad(m, 0, [45, 57, 60, 64], CENA.marca, 0.045);
  for (let t = 0.0; t < CENA.marca - 0.5; t += 0.5) chimbal(m, t, (Math.round(t * 2) % 2 ? 0.05 : 0.09), 90);
  for (const t of [0.35, 1.25, 2.05, 2.85, 3.65]) {
    bumbo(m, t, 0.55);
    bumbo(m, t + 0.2, 0.3);
  }
  [69, 67, 65, 64].forEach((n, i) => pluck(m, 1.3 + i * 0.8, n, 0.16, 0.8));
  subida(m, CENA.marca - 1.0, 1.0);

  // Daqui em diante: dó maior, C G Am F, um acorde por compasso (2 s).
  const ACORDES = [
    { b: 36, p: [60, 64, 67] },
    { b: 43, p: [59, 62, 67] },
    { b: 45, p: [60, 64, 69] },
    { b: 41, p: [60, 65, 69] },
  ];
  const TENSO = [
    { b: 45, p: [57, 60, 64] },
    { b: 41, p: [57, 60, 65] },
  ];
  // Melodia de 4 compassos (colcheia, nota).
  const MELODIA = [
    [0, 72], [2, 76], [3, 79], [5, 76], [6, 74],
    [8, 74], [10, 79], [11, 83], [13, 79], [14, 74],
    [16, 76], [18, 81], [19, 84], [21, 81], [22, 79],
    [24, 77], [26, 81], [27, 84], [29, 79], [30, 77],
  ];

  const fim = DUR - 1.0;
  for (let c = 0; ; c++) {
    const t0 = CENA.marca + c * 2;
    if (t0 >= fim) break;
    const tenso = t0 >= CENA.emergencia - 0.01 && t0 < CENA.socorros - 0.01;
    const leve = t0 < 8.6; // marca: sem bateria cheia ainda
    const final = t0 >= CENA.cta - 0.01;
    const ac = tenso ? TENSO[c % 2] : ACORDES[c % 4];
    pad(m, t0, ac.p, 2.05, tenso ? 0.05 : 0.04);

    for (let e = 0; e < 8; e++) {
      const t = t0 + e * COLCHEIA;
      if (t >= fim) break;
      if (tenso) {
        // Coração: tum-tum a cada tempo forte.
        if (e % 4 === 0) {
          bumbo(m, t, 0.6);
          bumbo(m, t + 0.18, 0.32);
        }
        if (e % 2 === 0) baixo(m, t, ac.b, 0.3, 0.22);
        continue;
      }
      if (e % 2 === 0) bumbo(m, t, leve ? 0.45 : 0.65);
      if (!leve && (e === 2 || e === 6)) palma(m, t);
      if (!leve) chimbal(m, t + (e % 2 ? 0.0 : 0.0), e % 2 ? 0.08 : 0.045);
      baixo(m, t, ac.b + (e % 4 === 3 ? 12 : 0));
    }

    if (!tenso) {
      // Melodia: no final, dobrada uma oitava acima em sino.
      const bloco = c % 4;
      for (const [e, n] of MELODIA) {
        if (Math.floor(e / 8) !== bloco) continue;
        const t = t0 + (e % 8) * COLCHEIA;
        if (t >= fim) continue;
        pluck(m, t, n, leve ? 0.14 : 0.18);
        if (final) sino(m, t, n + 12, 0.07, 1.0);
      }
    }
  }

  // Viradas e pratos nas mudanças grandes.
  for (const t of [CENA.marca, 8.6, CENA.socorros, CENA.cta]) prato(m, t);
  subida(m, CENA.emergencia - 0.8, 0.8, 0.08);
  subida(m, CENA.cta - 1.0, 1.0);

  // Acorde final de dó, aberto, morrendo até o fim.
  pad(m, fim, [48, 60, 64, 67, 72], 1.0, 0.06);
  bumbo(m, fim, 0.8);
  prato(m, fim, 0.16);
  [72, 76, 79, 84].forEach((n, i) => sino(m, fim + i * 0.06, n, 0.12, 1.0));

  // Leve abertura e fechamento de volume.
  for (let i = 0; i < m.length; i++) {
    const t = i / SR;
    m[i] *= Math.min(1, t / 0.05) * Math.min(1, (DUR - t) / 0.6);
  }
  return m;
};

/* ── Efeitos ─────────────────────────────────────────────────────────────── */

const EFEITOS = {
  /** Carimbo: pancada grave com estalo. */
  carimbo: () => {
    const b = novo(0.6);
    bumbo(b, 0, 1);
    soma(b, 0, 0.05, (t) => ruido() * Math.exp(-t * 90) * 0.8);
    soma(b, 0, 0.6, (t) => Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 6) * 0.4);
    return b;
  },
  /** Passagem de ar, para transições. */
  whoosh: () => {
    const d = 0.5;
    const b = novo(d);
    soma(b, 0, d, (t) => ruido() * Math.sin((Math.PI * t) / d) ** 2);
    passaBaixa(b, 2400);
    return b;
  },
  /** Pop curto e agudo (palavras, pílulas, marcadores). */
  pop: () => {
    const b = novo(0.12);
    let fase = 0;
    soma(b, 0, 0.12, (t) => {
      fase += (2 * Math.PI * (500 + 900 * Math.min(1, t / 0.03))) / SR;
      return Math.sin(fase) * env(t, 0.002, 38);
    });
    return b;
  },
  /** Notificação: dois toques de sino. */
  notificacao: () => {
    const b = novo(1.4);
    sino(b, 0, 88, 0.6, 1.3);
    sino(b, 0.14, 93, 0.6, 1.2);
    return b;
  },
  /** Toque na tela. */
  clique: () => {
    const b = novo(0.06);
    soma(b, 0, 0.06, (t) => (ruido() * 0.5 + Math.sin(2 * Math.PI * 2200 * t)) * Math.exp(-t * 120));
    return b;
  },
  /** Conquista: arpejo de sinos subindo. */
  sucesso: () => {
    const b = novo(1.6);
    [72, 76, 79, 84].forEach((n, i) => sino(b, i * 0.07, n + 12, 0.5, 1.4));
    return b;
  },
  /** Confete: estalinhos agudos espalhados. */
  confete: () => {
    const b = novo(1.0);
    for (let k = 0; k < 26; k++) {
      const t0 = Math.abs(ruido()) * 0.8;
      const f = 2500 + Math.abs(ruido()) * 3500;
      soma(b, t0, 0.05, (t) => Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 90) * (1 - t0));
    }
    return b;
  },
  /** Brilho: glissando agudo cintilante. */
  brilho: () => {
    const b = novo(0.7);
    [96, 100, 103, 108].forEach((n, i) => sino(b, i * 0.05, n, 0.25, 0.6));
    return b;
  },
  /** Farejada: três fungadas curtas. */
  fareja: () => {
    const b = novo(0.7);
    for (let k = 0; k < 3; k++) soma(b, k * 0.18, 0.12, (t) => ruido() * Math.sin((Math.PI * t) / 0.12) * 0.8);
    passaBaixa(b, 1800);
    return b;
  },
  /** Coração: tum-tum. */
  batimento: () => {
    const b = novo(0.7);
    bumbo(b, 0, 1);
    bumbo(b, 0.2, 0.6);
    return b;
  },
  /** Chave de lembrete ligando. */
  chave: () => {
    const b = novo(0.2);
    soma(b, 0, 0.02, (t) => ruido() * Math.exp(-t * 200));
    let fase = 0;
    soma(b, 0.03, 0.15, (t) => {
      fase += (2 * Math.PI * (700 + 600 * Math.min(1, t / 0.05))) / SR;
      return Math.sin(fase) * env(t, 0.003, 25) * 0.7;
    });
    return b;
  },
  /** Pulo do Rex. */
  boing: () => {
    const b = novo(0.45);
    let fase = 0;
    soma(b, 0, 0.45, (t) => {
      fase += (2 * Math.PI * (220 + 380 * Math.min(1, t / 0.2)) * (1 + 0.04 * Math.sin(2 * Math.PI * 18 * t))) / SR;
      return Math.sin(fase) * env(t, 0.005, 6);
    });
    return b;
  },
  /** "Ownn": tom triste descendo, para o Rex no gancho. */
  triste: () => {
    const b = novo(1.1);
    let fase = 0;
    soma(b, 0, 1.1, (t) => {
      fase += (2 * Math.PI * (330 - 90 * (t / 1.1)) * (1 + 0.02 * Math.sin(2 * Math.PI * 6 * t))) / SR;
      const s = Math.sin(fase) + 0.3 * Math.sin(2 * fase);
      return s * Math.min(1, t / 0.06) * Math.min(1, (1.1 - t) / 0.3) * 0.6;
    });
    return b;
  },
  /** Impacto grande do "Baixe grátis". */
  impacto: () => {
    const b = novo(1.6);
    bumbo(b, 0, 1);
    prato(b, 0, 0.5);
    soma(b, 0, 1.2, (t) => Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 3) * 0.5);
    return b;
  },
};

salvarWav(join(RAIZ, "public", "musica.wav"), musica());
for (const [nome, fn] of Object.entries(EFEITOS)) salvarWav(join(RAIZ, "public", "sfx", `${nome}.wav`), fn());
console.log(`ok: musica.wav + ${Object.keys(EFEITOS).length} efeitos`);
