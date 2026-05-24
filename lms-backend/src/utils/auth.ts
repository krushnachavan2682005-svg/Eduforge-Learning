import { FastifyReply, FastifyRequest } from "fastify";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

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

  try {
    const token = authHeader.slice("Bearer ".length).trim();
    req.user = req.server.verifyAccessToken(token);
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return reply.status(401).send({
        success: false,
        message: "Authorization token has expired",
      });
    }

    if (error instanceof JsonWebTokenError) {
      return reply.status(401).send({
        success: false,
        message: "Authorization token is invalid",
      });
    }

    req.log.error(error);
    return reply.status(401).send({
      success: false,
      message: "Authorization failed",
    });
  }
}
