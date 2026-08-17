# W-A

App móvil que recomienda dónde y cuándo practicar deporte al aire libre en España (playa, surf,
windsurf, senderismo, paseo, running, bici), combinando meteorología de hoy, el tiempo que hizo
ayer (estado del terreno) y una recomendación de zona generada por IA a partir de datos reales.

## Estructura

```
apps/
  mobile/    # App Expo (React Native + TypeScript)
  backend/   # API Fastify (Node + TypeScript)
packages/
  shared/    # Tipos compartidos entre mobile y backend
```

El móvil nunca llama directo a APIs externas (meteo, geodatos, Anthropic) — todo pasa por el
backend, que agrega, cachea y normaliza antes de responder.

## Desarrollo

Requisitos: Node 20+, npm 10+.

```bash
npm install

# Backend (http://localhost:3000)
npm run backend:dev

# App móvil (Expo Go)
npm run mobile:start
```

Copia `apps/backend/.env.example` a `apps/backend/.env` y rellena las claves (Anthropic,
Supabase). El móvil apunta al backend vía `EXPO_PUBLIC_API_URL` (por defecto
`http://localhost:3000`).

```bash
npm run typecheck
npm run test
```

## Diseño de mapa

Los pines del mapa reutilizan el lenguaje visual de [Trebo](https://github.com/davidrdi/trebo)
(otra app del mismo autor): forma de lágrima (`border-radius 50% 50% 50% 0` + rotación),
icono blanco de 20x20 dentro. Aquí el color del pin codifica el **score** de la zona
(verde/ámbar/rojo) en vez del deporte — el deporte lo identifica el icono. Los SVG están en
`apps/mobile/src/mapIcons.ts`; el de playa es nuevo, en ese mismo estilo.

## Plan de producto

El desarrollo sigue un plan por fases (scaffold → meteo básico → scoring y mapa → explicación IA
→ resto de deportes → cuestionario en lenguaje natural → auth y favoritos → pulido). El
diferencial frente a apps existentes (Windy, Surfline, Windguru, AllTrails, Komoot, Wikiloc...)
es combinar automáticamente meteo de hoy + ayer, explicar con IA el porqué de una zona concreta,
y responder a un cuestionario en lenguaje natural ceñido a la localidad exacta pedida.
