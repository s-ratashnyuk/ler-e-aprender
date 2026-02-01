import "./styles/main.css";
import RenderApp from "./ui/RenderApp";

const Root = document.getElementById("app");

if (!Root) {
  throw new Error("Missing #app element.");
}

RenderApp(Root);
