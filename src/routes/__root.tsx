import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Gesture Whiteboard — Draw with your hands" },
      { name: "description", content: "AI-powered gesture-controlled whiteboard. Draw, sketch shapes, and recognise handwriting using your webcam — works offline." },
      { name: "author", content: "Gesture Whiteboard" },
      { name: "theme-color", content: "#1a1530" },
      { property: "og:title", content: "Gesture Whiteboard — Draw with your hands" },
      { property: "og:description", content: "AI-powered gesture-controlled whiteboard. Draw, sketch shapes, and recognise handwriting using your webcam — works offline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Gesture Whiteboard — Draw with your hands" },
      { name: "twitter:description", content: "AI-powered gesture-controlled whiteboard. Draw, sketch shapes, and recognise handwriting using your webcam — works offline." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/29edc6d4-4054-4c17-b193-f9fab932078e/id-preview-06897045--9f910314-e5f5-47f3-a37c-7d88b87899a3.lovable.app-1777116900723.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/29edc6d4-4054-4c17-b193-f9fab932078e/id-preview-06897045--9f910314-e5f5-47f3-a37c-7d88b87899a3.lovable.app-1777116900723.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
