import { Composition } from "remotion";
import { TripleKeelIntro } from "./Composition";

export const RemotionRoot = () => (
  <Composition
    id="TripleKeelIntro"
    component={TripleKeelIntro}
    durationInFrames={150}
    fps={30}
    width={1920}
    height={1080}
  />
);
