import { Composition } from "remotion";
import { Anuncio, DURACAO_TOTAL } from "./Anuncio";
import { FPS } from "./base";
import { AnuncioMotion } from "./motion30/AnuncioMotion";
import { DURACAO as DURACAO_MOTION, FPS as FPS_MOTION } from "./motion30/roteiro";

export const RemotionRoot = () => (
  <>
    <Composition id="PetLive-Anuncio" component={Anuncio} durationInFrames={DURACAO_TOTAL} fps={FPS} width={1080} height={1920} />
    {/* Anúncio motion de 30 s, sem áudio (src/motion30). */}
    <Composition id="PetLive-Motion-30s" component={AnuncioMotion} durationInFrames={DURACAO_MOTION} fps={FPS_MOTION} width={1080} height={1920} />
  </>
);
