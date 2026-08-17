import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { store } from "./core/store";
import { buildEmptyFiles } from "./core/seed";
import "./index.css";

/**
 * Boot order matters: the store has to be open before React renders, otherwise
 * the first paint is an empty list that fills in a tick later — which reads as
 * "my data is gone" on a cold start.
 */
async function boot() {
  await store.init();

  // First run on this device with nothing to pull from yet: lay down an empty
  // scaffold so there is somewhere to file the first task. Once GitHub is
  // connected, a real repo's contents replace this.
  if (store.allFiles().length === 0) {
    store.seed(buildEmptyFiles());
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

void boot();

// Update in the background; the new version is picked up on next launch rather
// than reloading mid-edit.
registerSW({ immediate: false });
