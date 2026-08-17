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

## Nota de compatibilidad: `expo` como devDependency en la raíz

`package.json` de la raíz del monorepo declara `expo` como devDependency aunque el código de la
raíz no lo usa directamente. Es intencional: con solo `apps/mobile` dependiendo de `expo`, npm
workspaces a veces hospeda `expo-notifications` en el `node_modules` raíz mientras deja `expo` y
`expo-modules-core` anidados en `apps/mobile/node_modules` — un árbol inconsistente que rompe la
resolución de tipos y el config plugin de `expo-notifications` (`Cannot find module
'expo/config-plugins'`). Declarar `expo` también en la raíz fuerza a npm a hospedar todo junto de
forma consistente. Si en el futuro aparece el mismo error con otro paquete `expo-*`, el arreglo es
el mismo patrón: añadir `expo` (o el paquete conflictivo) como devDependency en la raíz y
reinstalar limpio (`rm -rf node_modules apps/*/node_modules packages/*/node_modules && npm
install`).

## Plan de producto

El desarrollo sigue un plan por fases (scaffold → meteo básico → scoring y mapa → explicación IA
→ resto de deportes → cuestionario en lenguaje natural → auth y favoritos → pulido). El
diferencial frente a apps existentes (Windy, Surfline, Windguru, AllTrails, Komoot, Wikiloc...)
es combinar automáticamente meteo de hoy + ayer, explicar con IA el porqué de una zona concreta,
y responder a un cuestionario en lenguaje natural ceñido a la localidad exacta pedida.
