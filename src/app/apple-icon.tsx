import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#0f766e", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="112" height="112" viewBox="0 0 64 64" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M44 22V17a3 3 0 0 0-3-3H17a4 4 0 0 0 0 8h30a3 3 0 0 1 3 3v6" />
          <path d="M14 18v28a4 4 0 0 0 4 4h29a3 3 0 0 0 3-3v-6" />
          <path d="M52 31v10h-8a5 5 0 0 1 0-10z" />
        </svg>
      </div>
    ),
    size,
  );
}
