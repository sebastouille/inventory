import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 36,
          background:
            "linear-gradient(135deg, #0b2a45 0%, #12456f 48%, #18a7bf 100%)",
          color: "white",
          fontSize: 84,
          fontWeight: 700
        }}
      >
        I
      </div>
    ),
    size
  );
}
