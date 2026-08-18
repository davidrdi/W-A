import Anthropic from "@anthropic-ai/sdk";
import type {
  ChatMessage,
  MarineSnapshot,
  QueryFilters,
  ScoreBand,
  SpotAmenities,
  SpotExplanation,
  SpotGroundingPayload,
  Sport,
  WeatherSnapshot,
} from "@w-a/shared";

import { SPORT_VALUES } from "../lib/sport.js";

const MODEL = "claude-opus-5";
// Barato y rápido — solo para extraer intención del cuestionario, sin
// razonar sobre meteo. La calidad de la explicación (donde importa el
// diferencial del producto) usa siempre el modelo grande.
const INTENT_MODEL = "claude-haiku-4-5-20251001";
// El ranking es la llamada más cara del producto (manda todos los candidatos
// enriquecidos en el prompt) y la tarea es de ordenación + resumen sobre datos
// ya calculados, no de razonamiento fino: el tier Sonnet la resuelve igual de
// bien a menos de la mitad de coste que Opus.
const RANK_MODEL = "claude-sonnet-5";

// $/1M tokens (tarifas públicas de la API de Anthropic). Solo se usan para la
// estimación de coste que va al log — la factura real manda. Sonnet 5 tiene
// precio de lanzamiento más bajo hasta el 31/08/2026; aquí se deja la tarifa
// estándar para no infraestimar.
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

interface UsageLike {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

function estimateCostUsd(model: string, usage: UsageLike): number | null {
  const price = PRICING_PER_MTOK[model];
  if (!price) return null;
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  // Escribir en caché cuesta ~1.25x el input; leer de caché ~0.1x.
  const usd =
    (input * price.input + cacheWrite * price.input * 1.25 + cacheRead * price.input * 0.1 + output * price.output) /
    1_000_000;
  return Number(usd.toFixed(6));
}

// Una línea JSON por llamada al API, a stdout (donde ya escribe el logger de
// Fastify). Sirve para medir con datos reales: agregando por "operation" y
// "model" sale el coste por consulta sin tocar la consola de Anthropic.
function logUsage(operation: string, model: string, usage: UsageLike | undefined): void {
  if (!usage) return;
  console.log(
    JSON.stringify({
      event: "claude_usage",
      operation,
      model,
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
      estimatedCostUsd: estimateCostUsd(model, usage),
    }),
  );
}

const SYSTEM_PROMPT = `Eres el asistente de una app que recomienda dónde practicar deporte al
aire libre en España. Se te da un payload JSON con datos reales ya calculados (meteo de hoy,
lluvia de ayer, viento, un score 0-100 ya decidido) para UNA zona concreta de un deporte. Tu
trabajo es explicar en 1-3 frases, en español, por qué esa puntuación, citando los datos que la
explican (ej. "ha llovido 18mm ayer, probablemente haya barro en los tramos de tierra"). No
inventes geografía ni datos meteorológicos que no estén en el payload — si te preguntan algo que
no puedes responder con esos datos, dilo explícitamente en vez de inventar. Sé concreto y
práctico, como alguien que conoce bien la zona.

Si el payload trae "amenities" (nudismo, admisión de mascotas), menciónalo solo si es relevante
para la pregunta o si es información que alguien querría saber antes de ir (ej. "es una playa
nudista" o "no se admiten perros aquí"). Si "amenities" no trae un dato concreto (ej. no dice nada
de mascotas), no afirmes nada al respecto — la ausencia de dato no es un "no".

En las preguntas de seguimiento (chat), razona SOLO sobre la zona de este payload — no
recomiendes ni menciones otras zonas, spots o localidades alternativas aunque te las pidan: no
tienes sus datos ni sus coordenadas, y la app no podría mostrarlas en el mapa ni calcular su
distancia. Si te preguntan por otra zona, explica que para eso hay que buscarla en el buscador o
en el cuestionario de la app, donde sí aparecerá en el mapa con su distancia.`;

// Cliente perezoso: si no hay ANTHROPIC_API_KEY el servidor debe poder
// arrancar igualmente (solo falla al llamar de verdad a /explain).
let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cachedClient;
}

const EXPLAIN_TOOL = {
  name: "explicar_zona",
  description: "Devuelve la explicación estructurada de por qué una zona tiene ese score",
  input_schema: {
    type: "object" as const,
    properties: {
      headline: { type: "string", description: "Titular corto, ej. 'Buen día para correr aquí'" },
      reasoning: { type: "string", description: "1-3 frases explicando el porqué, citando los datos del payload" },
      cautions: {
        type: "array",
        items: { type: "string" },
        description: "Avisos concretos si los hay (barro, viento racheado...); array vacío si no hay ninguno",
      },
    },
    required: ["headline", "reasoning", "cautions"],
  },
};

type ExplanationFields = Pick<SpotExplanation, "headline" | "reasoning" | "cautions">;

export async function explainSpot(payload: SpotGroundingPayload): Promise<ExplanationFields> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    tools: [EXPLAIN_TOOL],
    tool_choice: { type: "tool", name: EXPLAIN_TOOL.name },
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });
  logUsage("explainSpot", MODEL, message.usage);

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude no devolvió una explicación estructurada");
  }
  return toolUse.input as ExplanationFields;
}

export async function askFollowUp(
  payload: SpotGroundingPayload,
  priorMessages: ChatMessage[],
  question: string,
): Promise<string> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: `Datos de la zona: ${JSON.stringify(payload)}` },
      { role: "assistant", content: "Entendido, tengo los datos de esta zona." },
      ...priorMessages,
      { role: "user", content: question },
    ],
  });
  logUsage("askFollowUp", MODEL, message.usage);

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude no devolvió una respuesta de texto");
  }
  return textBlock.text;
}

const INTENT_SYSTEM_PROMPT = `Extraes la intención de peticiones en español sobre dónde
practicar deporte al aire libre en España. Deportes válidos: running, paseo, senderismo, bici,
playa, surf, windsurf.

- "correr"/"salir a correr" sin mencionar monte/trail → running (zonas urbanas: parques, sendas).
  "correr por el monte", "trail running" → senderismo.
- "andar"/"pasear"/"caminar" sin más → paseo.
- locality_text: la localidad más concreta y real que puedas identificar (ciudad, pueblo o
  comarca reconocible) para poder geocodificarla con un servicio real. Si el usuario da una zona
  compuesta ("sur de Galicia", "costa de Cádiz"), elige la interpretación más razonable de una
  localidad real dentro de esa zona — nunca inventes un topónimo que no existe.
- Marca require_dogs_allowed=true SOLO si pide explícitamente que se admitan perros/mascotas.
- Marca exclude_naturist=true SOLO si pide explícitamente evitar playas nudistas.
- Marca require_naturist=true SOLO si pide explícitamente una playa nudista.
No marques ningún filtro si la petición no lo menciona.`;

const INTENT_TOOL = {
  name: "extraer_intencion",
  description: "Extrae deporte, localidad y filtros de una petición en lenguaje natural",
  input_schema: {
    type: "object" as const,
    properties: {
      sport: { type: "string", enum: SPORT_VALUES as unknown as string[] },
      locality_text: {
        type: "string",
        description: "Localidad real y concreta a geocodificar, en el idioma/forma que use el usuario",
      },
      require_dogs_allowed: { type: "boolean" },
      require_naturist: { type: "boolean" },
      exclude_naturist: { type: "boolean" },
    },
    required: ["sport", "locality_text"],
  },
};

export interface ParsedIntent {
  sport: Sport;
  localityText: string;
  filters: QueryFilters;
}

export async function parseQueryIntent(text: string): Promise<ParsedIntent> {
  const message = await getClient().messages.create({
    model: INTENT_MODEL,
    max_tokens: 300,
    system: INTENT_SYSTEM_PROMPT,
    tools: [INTENT_TOOL],
    tool_choice: { type: "tool", name: INTENT_TOOL.name },
    messages: [{ role: "user", content: text }],
  });
  logUsage("parseQueryIntent", INTENT_MODEL, message.usage);

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude no pudo interpretar la petición");
  }
  const input = toolUse.input as {
    sport: Sport;
    locality_text: string;
    require_dogs_allowed?: boolean;
    require_naturist?: boolean;
    exclude_naturist?: boolean;
  };

  return {
    sport: input.sport,
    localityText: input.locality_text,
    filters: {
      requireDogsAllowed: input.require_dogs_allowed,
      requireNaturist: input.require_naturist,
      excludeNaturist: input.exclude_naturist,
    },
  };
}

export interface RankingCandidate {
  spotId: string;
  spotName: string;
  score: number;
  scoreBand: ScoreBand;
  weather: WeatherSnapshot;
  marine?: MarineSnapshot;
  amenities?: SpotAmenities;
}

export interface RankingResult {
  spotId: string;
  headline: string;
  reasoning: string;
}

const RANK_SYSTEM_PROMPT = `Eres el asistente de una app que recomienda dónde practicar deporte
al aire libre en España. Se te da la petición original del usuario y una lista de zonas
candidatas ya enriquecidas con datos reales (score 0-100 ya calculado, meteo, y si aplica datos
marinos y amenidades). Devuelve esas MISMAS zonas — todas, identificadas por su spot_id exacto,
sin inventar ninguna ni omitir ninguna — ordenadas de mejor a peor ajuste a la petición original,
cada una con un titular corto y 1-2 frases de explicación en español citando los datos reales del
payload. No inventes geografía ni datos que no estén en el payload.`;

const RANK_TOOL = {
  name: "rankear_zonas",
  description: "Devuelve las zonas candidatas ordenadas de mejor a peor ajuste, con explicación",
  input_schema: {
    type: "object" as const,
    properties: {
      rankings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            spot_id: { type: "string" },
            headline: { type: "string" },
            reasoning: { type: "string" },
          },
          required: ["spot_id", "headline", "reasoning"],
        },
      },
    },
    required: ["rankings"],
  },
};

export async function rankSpots(
  originalText: string,
  sport: Sport,
  candidates: RankingCandidate[],
): Promise<RankingResult[]> {
  const message = await getClient().messages.create({
    model: RANK_MODEL,
    max_tokens: 1500,
    system: RANK_SYSTEM_PROMPT,
    tools: [RANK_TOOL],
    tool_choice: { type: "tool", name: RANK_TOOL.name },
    messages: [{ role: "user", content: JSON.stringify({ request: originalText, sport, candidates }) }],
  });
  logUsage("rankSpots", RANK_MODEL, message.usage);

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude no devolvió un ranking estructurado");
  }
  const { rankings } = toolUse.input as { rankings: { spot_id: string; headline: string; reasoning: string }[] };

  return rankings.map((r) => ({ spotId: r.spot_id, headline: r.headline, reasoning: r.reasoning }));
}
