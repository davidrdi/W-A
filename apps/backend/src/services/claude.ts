import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, SpotExplanation, SpotGroundingPayload } from "@w-a/shared";

const MODEL = "claude-opus-5";
// $/1M tokens (tarifas públicas de la API de Anthropic). Solo se usan para la
// estimación de coste que va al log — la factura real manda.
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
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
distancia. Si te preguntan por otra zona, explica que para eso hay que buscarla en el mapa de la
app, donde sí aparecerá con su distancia.`;

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
