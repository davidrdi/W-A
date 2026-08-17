import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, SpotExplanation, SpotGroundingPayload } from "@w-a/shared";

const MODEL = "claude-opus-5";

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

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude no devolvió una respuesta de texto");
  }
  return textBlock.text;
}
