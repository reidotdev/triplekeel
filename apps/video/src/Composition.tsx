import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

export const TripleKeelIntro = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 24], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame, [0, 24], [32, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        background: "linear-gradient(135deg, #102b2a 0%, #1b4d45 100%)",
        color: "#f5f3ea",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 88,
          fontWeight: 700,
          letterSpacing: -4,
          opacity,
          transform: `translateY(${translateY}px)`,
        }}
      >
        TripleKeel
      </div>
      <div
        style={{
          color: "#c5d8c5",
          fontSize: 30,
          marginTop: 20,
          opacity,
          transform: `translateY(${translateY}px)`,
        }}
      >
        Clearer prompts. Better work.
      </div>
    </AbsoluteFill>
  );
};
