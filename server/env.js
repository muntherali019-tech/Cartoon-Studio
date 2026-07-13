// Zero-dependency .env loader (side-effect import).
//
// If a `.env` file exists at the project root, load its KEY=VALUE lines into
// process.env WITHOUT overriding variables that are already set. This makes
// `npm start` honour a local `.env` with no dependency, and it is a complete
// no-op in environments that inject configuration directly (CI, Render, Docker),
// where there is no `.env` file. Import this FIRST in the entrypoint so the
// values are present before any module reads process.env at load time.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = process.env.DOTENV_PATH || path.join(root, ".env");

try {
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, "utf8");
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      // Strip matching surrounding quotes, if any.
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      // Real env always wins over the file.
      if (key && !(key in process.env)) process.env[key] = val;
    }
  }
} catch (e) {
  console.warn("env: could not load .env —", e.message);
}
