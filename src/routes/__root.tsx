import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppFrame } from "@/components/sb/frame";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Super Bola Pizzaria" },
      { name: "theme-color", content: "#7A0000" },
      { property: "og:title", content: "Super Bola Pizzaria" },
      { property: "og:description", content: "Escolha sua pizza favorita, monte seu pedido e aproveite!" },
      { property: "og:image", content: "https://superbola.vercel.app/og.jpg?v=2" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:type", content: "website" },
      {
        name: "description",
        content: "Peça na Super Bola Pizzaria. Monte sua pizza, acompanhe o pedido e retire ou receba em casa.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <AppFrame>
            <Outlet />
          </AppFrame>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
