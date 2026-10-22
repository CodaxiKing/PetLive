import { Composition } from "remotion";
import { Anuncio, DURACAO_TOTAL } from "./Anuncio";
import { FPS } from "./base";

export const RemotionRoot = () => (
  <Composition id="PetLive-Anuncio" component={Anuncio} durationInFrames={DURACAO_TOTAL} fps={FPS} width={1080} height={1920} />
);
