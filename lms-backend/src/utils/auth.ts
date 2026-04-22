import { FastifyReply, FastifyRequest } from "fastify";

export async function verifyToken(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return reply.status(401).send({
      message: "Authorization token is missing",
    });
  }

  // Optional: validate token format
  if (!authHeader.startsWith("Bearer ")) {
    return reply.status(400).send({
      message: "Invalid token format. Expected 'Bearer <token>'",
    });
  }
}
