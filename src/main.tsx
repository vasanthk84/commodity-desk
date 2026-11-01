import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { readLocal } from "./storage";

document.documentElement.dataset.theme = readLocal("theme", "dark");
createRoot(document.getElementById("root")!).render(<App />);
