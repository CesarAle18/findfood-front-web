import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ConnectedRoot } from "./integration/ConnectedRoot";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConnectedRoot />
  </StrictMode>,
);
