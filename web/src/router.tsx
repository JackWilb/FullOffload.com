import { createHashRouter } from "react-router";
import { Layout } from "./components/Layout";
import { AuthCallback } from "./routes/AuthCallback";
import { DevicePage } from "./routes/DevicePage";
import { Home } from "./routes/Home";
import { NotFound } from "./routes/NotFound";
import { Privacy } from "./routes/Privacy";
import { Submit } from "./routes/Submit";

// Hash routes (/#/device/rtx-4090) work on GitHub Pages with no server fallback. Keep them stable:
// they get shared.
export const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "device/:slug", element: <DevicePage /> },
      { path: "submit", element: <Submit /> },
      { path: "privacy", element: <Privacy /> },
      { path: "auth/callback", element: <AuthCallback /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
