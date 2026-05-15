import { FastifyReply, FastifyRequest } from "fastify";
import { TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";
import { getBearerToken } from "../plugins/jwt.plugin";

export async function authenticate(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const token = getBearerToken(req, reply);
  if (!token) return;

  try {
    req.user = req.server.verifyAccessToken(token);
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return reply.code(401).send({
        success: false,
        message: "Authorization token has expired",
      });
    }

    if (error instanceof JsonWebTokenError) {
      return reply.code(401).send({
        success: false,
        message: "Authorization token is invalid",
      });
    }

    req.log.error(error);
    return reply.code(401).send({
      success: false,
      message: "Authorization failed",
    });
  }
}
