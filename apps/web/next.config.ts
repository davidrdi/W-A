import type { NextConfig } from "next";

// @w-a/shared es "type": "module" con moduleResolution nodenext (lo exige
// ejecutar el backend directo con tsx/Node) y sus re-exports internos usan
// extensión .js aunque el archivo real sea .ts (./types.js -> types.ts).
// Metro (mobile) y tsx (backend) resuelven eso sin problema; Turbopack no.
// En vez de perseguir un alias de extensión, apuntamos aquí al build
// compilado del paquete (packages/shared/dist, real JS, sin ambigüedad),
// generado por `npm run build --workspace @w-a/shared`. mobile/backend
// siguen consumiendo el código fuente sin tocar (su "main" sigue siendo
// src/index.ts) — este alias solo afecta a apps/web. Turbopack quiere una
// ruta relativa a la raíz del proyecto (monorepo), no absoluta de SO.
const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "@w-a/shared": "../../packages/shared/dist/index.js",
    },
  },
};

export default nextConfig;
