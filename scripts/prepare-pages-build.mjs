import fs from "fs";
import path from "path";

const distPath = path.resolve("dist");
const buildFile = path.join(distPath, "build.html");
const indexFile = path.join(distPath, "index.html");

if (fs.existsSync(buildFile)) {
  fs.copyFileSync(buildFile, indexFile);
  console.log("build.html copiado a index.html");
} else {
  console.warn("build.html no encontrado en dist");
}
