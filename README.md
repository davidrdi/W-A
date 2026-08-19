# W-A

App móvil que recomienda dónde y cuándo practicar deporte al aire libre en España (playa, surf,
windsurf, senderismo, paseo, running, bici), combinando meteorología de hoy, el tiempo que hizo
ayer (estado del terreno) y una recomendación de zona generada por IA a partir de datos reales.

## Estructura

```
apps/
  mobile/    # App Expo (React Native + TypeScript) — producto principal
  web/       # App Next.js (React + TypeScript) — preview/uso desde navegador
  backend/   # API Fastify (Node + TypeScript)
packages/
  shared/    # Tipos y utilidades compartidas entre mobile, web y backend
```

Ni mobile ni web llaman directo a APIs externas (meteo, geodatos, Anthropic) — todo pasa por el
backend, que agrega, cachea y normaliza antes de responder.

## Desarrollo

Requisitos: Node 20+, npm 10+.

```bash
npm install

# Backend (http://localhost:3000)
npm run backend:dev

# App móvil (Expo Go)
npm run mobile:start

# App web (http://localhost:4000 — puerto distinto al backend, :3000)
npm run web:dev
```

Copia `apps/backend/.env.example` a `apps/backend/.env` y rellena las claves (Anthropic,
Supabase). El móvil apunta al backend vía `EXPO_PUBLIC_API_URL`, la web vía
`NEXT_PUBLIC_API_URL` (copiar `apps/web/.env.example` a `.env.local`) — ambas por defecto
`http://localhost:3000`.

```bash
npm run typecheck
npm run test

# Tests de navegador de la web (Playwright, levanta él solo el build de producción)
npm run test:e2e --workspace apps/web
```

> **Los tests e2e sirven los tiles del mapa ellos mismos** (`page.route` en
> `apps/web/e2e/map-overlay.spec.ts`), y eso no es un detalle: `leaflet.css` deja los tiles
> en `visibility: hidden` hasta que cargan de verdad, así que en cualquier entorno sin
> salida al CDN de CARTO el mapa no pinta nada y los bugs de superposición del mapa sobre
> la UI se vuelven **invisibles**. Un test que dependa del CDN real da falsos verdes. Por
> eso las aserciones son por píxeles y no con `elementFromPoint`: los tiles de Leaflet no
> capturan el puntero, así que el hit-testing pasa "a través" de ellos aunque tapen la UI
> por completo.

### App web (apps/web)

Next.js (App Router) + Tailwind + Leaflet vanilla, con la misma arquitectura que
[Trebo](https://github.com/davidrdi/trebo) (mismo autor): mapa Leaflet imperativo con tiles de
CARTO Voyager, pines por `L.divIcon` con HTML generado desde `buildPinHtml` (shared), sin Google
Maps. Dos pestañas: **Mapa** y **Favoritos**.

**Mapa** tiene dos modos:
- *Vista general* (la que se ve al entrar, sin buscar nada): un pin por zona de todo el país,
  coloreado por score, para el deporte elegido con el toggle. Playa/surf/windsurf usan TODAS las
  playas de España en vivo desde OSM (`GET /overview`, ver más abajo); running/paseo/senderismo/bici
  usan el conjunto precalculado de `data/seedZones.ts` (representativo, no exhaustivo).
- *Búsqueda por localidad*: acción explícita que sustituye la vista general por datos reales de
  OSM para esa localidad concreta (`GET /spots`), con un enlace "← Ver todo el país" para volver.

**Favoritos** lista tarjetas con el score actual de cada zona guardada (`GET /spot-scores`, ligero,
sin el desglose completo de `/explain`); tocar una abre el mismo panel de detalle que en el mapa.

El buscador en lenguaje natural (antigua pestaña "Buscar") se retiró de la navegación — el
endpoint `POST /query` sigue existiendo en el backend por si se retoma más adelante, pero no hay
ninguna pantalla de la web que lo llame ahora mismo.

`@w-a/shared` es un paquete `"type": "module"` con `moduleResolution: nodenext` (lo exige
ejecutar el backend directo con `tsx`/Node) — sus re-exports internos usan extensión `.js` aunque
el archivo real sea `.ts` (`./types.js` → `types.ts`). Metro (mobile) y tsx (backend) resuelven
eso solos; Turbopack no. Por eso `packages/shared` tiene un `npm run build` (`tsc -p
tsconfig.build.json` → `dist/`, real JS sin ambigüedad de extensión) que `apps/web` ejecuta como
`predev`/`prebuild` y consume vía `turbopack.resolveAlias` en `next.config.ts` — mobile y backend
siguen consumiendo `src/index.ts` sin tocar, no hay build que mantener sincronizado para ellos.

## Despliegue

`apps/web` en Vercel, `apps/backend` en Render. Ningún token vive en el repo — solo en Secrets de
GitHub (para el deploy de Vercel) o en el dashboard de Render (que despliega solo, sin GitHub
Actions).

### apps/web → Vercel (automático, sin GitHub Actions)

Igual que Render: la integración nativa de Vercel con GitHub clona el repo entero y entiende
monorepos (workspaces de npm) de fábrica. Se probó primero con un workflow de GitHub Actions
corriendo `vercel deploy`/`vercel build` por CLI — falló repetidamente porque, subido así, Vercel
solo ve los archivos de `apps/web` (no la raíz del monorepo ni `packages/shared`), y por separado
porque su empaquetado de la función serverless no encontraba dependencias hoisteadas fuera de
`apps/web`. La integración por GitHub no tiene ese problema: build y deploy corren en la propia
infraestructura de Vercel con el repo completo.

1. [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo `davidrdi/w-a`.
2. **Root Directory**: `apps/web` (Vercel detecta automáticamente que es un monorepo de npm
   workspaces y instala desde la raíz antes de compilar solo `apps/web`).
3. Framework preset: Next.js (autodetectado).
4. **Environment Variables** → añade `NEXT_PUBLIC_API_URL` apuntando a la URL de Render del paso
   siguiente (ej. `https://w-a-backend.onrender.com`) — sin esto, la web no encuentra el backend
   en producción.
5. Deploy. A partir de aquí, cada push a la rama conectada despliega solo.

### apps/backend → Render (automático, sin GitHub Actions)

Render tiene integración nativa con GitHub — no hace falta workflow, despliega solo en cada push
una vez conectado:

1. [render.com](https://render.com) → **New → Web Service** → conecta el repo `davidrdi/w-a`.
2. **Root Directory**: déjalo vacío (raíz del monorepo — el backend depende de `@w-a/shared` vía
   npm workspaces, necesita instalarse desde la raíz).
3. **Build Command**: `npm install`
4. **Start Command**: `npm start --workspace apps/backend`
5. **Plan**: Free.
6. Variables de entorno (mismas que `apps/backend/.env.example`): `ANTHROPIC_API_KEY`,
   `OVERPASS_ENDPOINT` (`https://overpass-api.de/api/interpreter`), `INTERNAL_JOB_SECRET`
   (genera uno con `openssl rand -hex 32`). `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` se añaden
   más adelante, cuando exista el proyecto Supabase (ver "Auth y favoritos" — sin ellos, todo
   funciona salvo login/favoritos). No hace falta fijar `PORT`: Render lo inyecta solo y el
   backend ya lee `process.env.PORT`.
7. Copia la URL que te da Render (`https://<nombre-del-servicio>.onrender.com`) y ponla como
   `NEXT_PUBLIC_API_URL` en Vercel (paso 4 de arriba).

El plan Free de Render "duerme" el servicio tras ~15 min sin tráfico — la primera petición
después de dormido tarda ~30s en responder mientras arranca.

### Caché persistente (tabla `api_cache` en Supabase)

Todo lo caro y lento se cachea en Supabase, no solo en memoria: geocodificación
(Nominatim/Photon), zonas de Overpass y respuestas de la IA. **Esto no es una optimización,
es lo que hace que la app funcione**: como Render duerme el servicio cada 15 min, con caché
solo en memoria cada despertar volvía a pegarle desde cero a las APIs públicas de OSM —que
limitan por IP, y en Render la IP de salida es compartida— y devolvía 429/406. La geografía
no cambia, así que se resuelve una vez y queda guardada (TTL: 30 días localidades, 7 días
zonas, 3 h explicaciones de IA).

Presupuesto de IA: las llamadas a Claude se cachean por el contenido exacto de la petición,
así que abrir diez veces el mismo pin cuesta una sola llamada, y repetir una búsqueda no
vuelve a pagar el parseo de intención. Los errores nunca se cachean. El SDK va con
`maxRetries: 1` (por defecto son 2, es decir hasta 3 llamadas facturadas por cada fallo).

**Claves acotadas (`hashKey`)**: `key` es primary key de texto en Postgres, y un índice btree
tiene un límite duro (~2.7 KB) por valor indexado. Las claves de meteo/marino se construían
uniendo las coordenadas de la petición — con la vista general de "todas las playas de España"
(miles de coordenadas) eso revienta el límite. `lib/cache.ts#hashKey` las deja siempre cortas
(hash de 32 caracteres) pase lo que pase de larga la lista de partes.

**Troceado de peticiones a Open-Meteo**: por el mismo motivo (miles de coordenadas), una sola
URL con todas ellas supera límites prácticos de longitud. `weather.ts`/`marine.ts` trocean en
lotes de 100 y piden (y cachean) cada lote por separado.

## Diseño de mapa

Los pines del mapa reutilizan el lenguaje visual de [Trebo](https://github.com/davidrdi/trebo)
(otra app del mismo autor): forma de lágrima (`border-radius 50% 50% 50% 0` + rotación),
icono blanco de 20x20 dentro. Aquí el color del pin codifica el **score** de la zona en vez del
deporte — el deporte lo identifica el icono. Los SVG y `buildPinHtml` están en
`packages/shared/src/mapIcons.ts` (una sola fuente para web y mobile); el de playa es nuevo, en
ese mismo estilo.

**Bandas de score**: 4, no 3 — verde (75-100) / amarillo (50-74) / naranja (25-49) / rojo (0-24),
`ScoreBand` en `packages/shared/src/types.ts`, umbrales en `scoreBandFor()`
(`apps/backend/src/scoring/rules.ts`). Con solo 3 bandas y el corte de verde en 70, en días de
buen tiempo casi todas las zonas puntuaban por encima de 70 y el mapa se veía todo verde sin
diferenciar bien entre "bien" y "muy bien".

**Flecha de viento en el pin**: cada `ScoredSpot` lleva `windDirectionDeg`/`windAvgKmh` (de
`weatherSnapshots[i].windDirectionMiddayDeg`, ya se pedía para el scoring — no es una llamada
nueva). `buildPinHtml` pinta un badge circular en la esquina del pin rotado a
`windDirectionDeg + 180`: `windDirectionDeg` es de dónde SOPLA el viento (convención
meteorológica estándar de Open-Meteo), pero una flecha de mapa se lee más intuitivamente
señalando hacia dónde VA el viento (mismo criterio que Windy). `cardinalDirection()` da el rumbo
en texto (N/NE/E/SE/S/SO/O/NO) para el panel de detalle y el popup del pin.

## Bandera Azul: investigado, no integrado todavía

Existen datasets abiertos reales — confirmado por búsqueda web, no inventado: un catálogo
nacional en datos.gob.es (`a01002820-banderas-azules`) y varios autonómicos con CSV/WFS/WMS
(Andalucía, Comunitat Valenciana, Galicia...). No se ha integrado porque desde este entorno de
desarrollo el acceso saliente a internet está bloqueado incluso para `WebFetch` (herramienta del
agente, aparte del proxy que ya bloquea las llamadas del propio backend) — no ha sido posible
inspeccionar la estructura real de ningún recurso (columnas, sistema de coordenadas, si hay uno
nacional actualizado o hay que agregar varios autonómicos) para escribir un importador fiable sin
arriesgarse a acertar por casualidad. Antes de intentarlo: alguien con acceso normal a internet
tendría que abrir uno de esos enlaces y pegar la URL directa del recurso descargable (CSV/JSON) o
unas filas de ejemplo.

OSM tiene un tag `blue_flag=yes` que ya se leería gratis con el mismo patrón que
`naturist`/`dog`/`lifeguard` (`parseAmenities` en `apps/backend/src/services/spots.ts`), pero su
cobertura es muy incompleta — mostraría "no tiene" en playas que sí la tienen, peor que no
mostrar nada. Descartado como fuente principal por eso.

## Deportes soportados

`running`, `paseo`, `senderismo`, `bici`, `playa`, `surf`, `windsurf` — los tres últimos comparten
la búsqueda de spots en Overpass (todos son `natural=beach`) pero tienen scoring distinto
(`apps/backend/src/scoring/rules.ts`) y usan además datos marinos (Open-Meteo Marine API: oleaje,
temperatura del mar) además de la meteo normal. Cada deporte de tierra tiene sus propios pesos de
penalización (ej. senderismo penaliza el barro de ayer más que running; bici penaliza más el firme
mojado de hoy). Consulta general del tiempo (sin recomendación de zona) en `GET /weather`, por
localidad o por coordenadas.

## Cuestionario en lenguaje natural

`POST /query` con `{ text: "quiero playa en el sur de Galicia que admita perros" }`:

1. Claude Haiku (`services/claude.ts#parseQueryIntent`) extrae `{sport, localityText, filters}` — barato,
   solo interpreta intención, no razona sobre meteo.
2. Se geocodifica `localityText` igual que en `/spots` (límite administrativo real).
3. Se buscan spots del deporte, se filtran por `filters` (amenidades) — solo el filtro `requireNaturist`
   es estricto; los demás excluyen únicamente cuando OSM dice explícitamente lo contrario, porque exigir
   confirmación positiva dejaría casi todo fuera (la mayoría de spots no tienen esos tags).
4. Se enriquecen los candidatos (meteo + marino si aplica) y se puntúan con las mismas reglas deterministas
   de `/spots`.
5. Claude Opus (`rankSpots`) los ordena de mejor a peor ajuste con un titular + explicación cada uno —
   nunca decide el score, solo explica el orden.

Limitación conocida: para regiones compuestas ("sur de Galicia") Claude elige la localidad real más
razonable dentro de esa zona, no hay un gazetteer de "sur/norte de X" — documentado en el plan de producto.

## Auth y favoritos

Autenticación: el móvil habla DIRECTO con Supabase Auth (email/contraseña) usando la anon key —
el backend nunca ve contraseñas. El móvil manda el JWT resultante al backend en cada petición a
`/favorites`, que lo verifica (`lib/auth.ts#requireAuth`) y solo entonces lee/escribe filtrando
siempre por el `user_id` verificado (nunca uno que venga del cliente).

- `GET /favorites`, `POST /favorites`, `DELETE /favorites/:id` — todas requieren
  `Authorization: Bearer <token>`.
- El botón de favorito (♡/♥) del modal de detalle de spot solo aparece si hay sesión iniciada.
- La pestaña "Favoritos" muestra login/registro si no hay sesión, o la lista guardada si la hay.

### Crear el proyecto Supabase desde cero

1. Crea una cuenta y un proyecto nuevo en [supabase.com](https://supabase.com) (plan gratuito
   vale para desarrollo).
2. En el proyecto, ve a **SQL Editor > New query**, pega el contenido de
   `apps/backend/supabase/schema.sql` y dale a **Run**. Esto crea la tabla `favorites` con Row
   Level Security activado.
3. Ve a **Project Settings > API** y copia:
   - **Project URL** → `SUPABASE_URL` (backend) y `EXPO_PUBLIC_SUPABASE_URL` (móvil).
   - **anon public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY` (móvil; es pública por diseño, la
     protege RLS).
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (**solo backend**, nunca en el móvil ni
     en un repo).
4. Rellena `apps/backend/.env` y `apps/mobile/.env` (copiados de sus `.env.example`) con esos
   valores.
5. Por defecto, Supabase pide confirmación de email al registrarse. Para probar rápido en
   desarrollo: **Authentication > Providers > Email > Confirm email → desactivar** (actívalo de
   nuevo antes de producción).

Sin estas variables configuradas, el resto de la app (mapa, cuestionario, tiempo) sigue
funcionando con normalidad — la pestaña Favoritos simplemente avisa de que Supabase no está
configurado en vez de fallar.

## Onboarding y leyenda

Primer uso: `OnboardingGate` (`src/components/OnboardingGate.tsx`) comprueba un flag en
AsyncStorage y muestra una pantalla de bienvenida de 3 puntos (scoring por colores, cuestionario
en lenguaje natural, favoritos) antes de entrar a la app — se guarda para no repetirla.
`ScoreLegend` (verde/ámbar/rojo + qué significa cada uno) aparece junto a cualquier lista de
resultados con pines coloreados (mapa y cuestionario).

## V2: notificaciones push de favoritos

`POST /internal/notify-favorites` (protegida por cabecera `x-internal-secret`, no por
`requireAuth` — no hay un usuario detrás, es un job de sistema): recorre todos los favoritos no
evaluados hoy, calcula su score con las mismas reglas deterministas de siempre y manda un push
("hoy es buen día para tu playa favorita") solo si está en verde. Se marca como evaluado el mismo
día se envíe push o no, para no recalcular dos veces si el job corre más de una vez.

- No hay scheduler propio corriendo dentro de este backend — hay que llamar a ese endpoint una
  vez al día desde algo externo (un cron del hosting, una Supabase scheduled function, GitHub
  Actions con `schedule`...). Genera `INTERNAL_JOB_SECRET` (ej. `openssl rand -hex 32`) y
  configúralo tanto en el backend como en quien dispare el job.
- El móvil pide permiso de notificaciones y registra el token (`POST /push-tokens`) al iniciar
  sesión — falla en silencio (no hay notificaciones, pero tampoco rompe el login) si no hay
  permiso, no es un dispositivo físico, o no hay proyecto EAS configurado en `app.json`
  (`expo-notifications` necesita un `projectId` de EAS para pedir el token en producción).
- Requiere las migraciones nuevas de `apps/backend/supabase/schema.sql` (tabla `push_tokens` +
  columna `last_notified_date` en `favorites`) — vuelve a pegar el archivo completo en el SQL
  Editor si ya creaste el proyecto antes de esta versión.

### Lo que NO se ha construido en V2, y por qué

- **AEMET avisos oficiales**: el endpoint real de AEMET devuelve los avisos en formato CAP dentro
  de un `.tar` (XML comprimido), no JSON simple. No hay forma de verificar esa integración contra
  una respuesta real sin acceso de red a `opendata.aemet.es`, y el riesgo de parsear un binario a
  ciegas y que quede silenciosamente roto es alto. Pendiente de construir con acceso real a la API.
- **Mareas de precisión (Copernicus Marine / Puertos del Estado)**: mismo problema — APIs con
  formatos menos estandarizados (NetCDF, XML propio) que tampoco se han podido probar en vivo.
- **Self-host de Overpass**: es infraestructura de despliegue, no código de la app —
  `OVERPASS_ENDPOINT` ya es configurable por variable de entorno desde el primer día, solo hay
  que apuntarlo a una instancia propia cuando exista.
- **Redis**: `apps/backend/src/lib/cache.ts` ya aísla toda la caché detrás de una única función
  (`getOrSet`) — cambiar el `Map` en memoria por un cliente Redis es un cambio contenido a ese
  archivo, no hay que tocar los servicios que lo usan. No se ha instalado el cliente porque no hay
  un Redis real corriendo contra el que probarlo.

## Anillos de score multi-deporte

Al tocar un pin, además de la explicación de ESE deporte, si el spot sirve para más de uno (una
playa sirve para playa/surf/windsurf; un parque para running/paseo — ver `SPORT_GROUPS` en
`packages/shared/src/types.ts`) se muestra una fila de anillos (`ScoreRing`, SVG con
`react-native-svg`): 100% de aro relleno y en verde es el deporte recomendado ahí ahora mismo, y
va vaciándose según baja el score de cada uno. Tocar un anillo cambia el deporte activo del modal
(recalcula la explicación con `GET /explain` para ese deporte, en la misma zona). El backend
(`GET /spot-scores`) puntúa todo el grupo con una sola llamada a meteo/marino, no una por deporte.

## Nota de compatibilidad: paquetes duplicados por hoisting de npm

`package.json` de la raíz declara `expo`, `react` y `@types/react` como devDependencies aunque el
código de la raíz no los usa directamente. Es intencional: con estos paquetes declarados solo en
`apps/mobile`, npm workspaces a veces hospeda un paquete que los necesita (`expo-notifications`,
`react-native-svg`...) en el `node_modules` raíz mientras deja `expo`/`react`/`@types/react`
anidados en `apps/mobile/node_modules` — un árbol inconsistente que rompe tanto la resolución de
tipos de TypeScript como, en el caso de `expo-notifications`, su config plugin (`Cannot find
module 'expo/config-plugins'`). Declarar el paquete conflictivo también en la raíz fuerza a npm a
hospedar todo junto de forma consistente.

Si en el futuro aparece el mismo patrón de error con otro paquete nuevo (típicamente `tsc` quejándose
de que un componente "no es un JSX component válido", o Metro/`expo export` sin poder resolver un
módulo), el arreglo es el mismo: añadir el paquete que falta como devDependency en la raíz y
reinstalar limpio:

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
npm install --legacy-peer-deps
```

## Plan de producto

El desarrollo sigue un plan por fases (scaffold → meteo básico → scoring y mapa → explicación IA
→ resto de deportes → cuestionario en lenguaje natural → auth y favoritos → pulido). El
diferencial frente a apps existentes (Windy, Surfline, Windguru, AllTrails, Komoot, Wikiloc...)
es combinar automáticamente meteo de hoy + ayer, explicar con IA el porqué de una zona concreta,
y responder a un cuestionario en lenguaje natural ceñido a la localidad exacta pedida.
