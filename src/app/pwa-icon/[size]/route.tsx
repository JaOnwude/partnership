import { ImageResponse } from "next/og";

const SIZES = [180, 192, 512];

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

// App icon: a white "P" on the brand gradient, drawn at build time.
export async function GET(_request: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const size = Number((await ctx.params).size);
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #5b2a86 0%, #e6398f 100%)",
          color: "white",
          fontSize: size * 0.58,
          fontWeight: 800,
        }}
      >
        P
      </div>
    ),
    { width: size, height: size },
  );
}
