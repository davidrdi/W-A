import type { FastifyReply, FastifyRequest } from "fastify";

import { getSupabaseAdmin } from "../services/supabaseAdmin.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

// El móvil se autentica DIRECTO contra Supabase Auth (con la anon key) y
// nos manda el JWT resultante — el backend nunca ve ni gestiona
// contraseñas. Aquí solo se verifica ese JWT y se usa el user_id que
// devuelve Supabase, nunca uno que venga del body/query del cliente.
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return reply.status(401).send({ error: "Falta el token de autenticación" });
  }

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) {
    return reply.status(401).send({ error: "Token inválido o caducado" });
  }

  request.userId = data.user.id;
}
