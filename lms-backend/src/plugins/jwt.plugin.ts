import fp from "fastify-plugin";
import jwt, { SignOptions } from "jsonwebtoken";
import { FastifyReply, FastifyRequest } from "fastify";

export interface JwtPayload {
  sub: string;
  email: string;
  organization_id: string;
  role: string;
}

export interface AuthenticatedUser extends JwtPayload {
  session_id?: string;
}

declare module "fastify" {
  interface FastifyInstance {
    generateAccessToken: (payload: JwtPayload) => string;
    verifyAccessToken: (token: string) => AuthenticatedUser;
  }

  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

export default fp(async (fastify) => {
  fastify.decorate("generateAccessToken", (payload: JwtPayload) => {
    const options: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN ||
        "1h") as SignOptions["expiresIn"],
    };

    return jwt.sign(payload, getJwtSecret(), options);
  });

  fastify.decorate("verifyAccessToken", (token: string) => {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;

    if (
      !decoded ||
      !decoded.sub ||
      !decoded.email ||
      !decoded.organization_id ||
      !decoded.role
    ) {
      throw new Error("Invalid token payload");
    }

    return decoded;
  });
});

export function getBearerToken(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    reply.code(401).send({ success: false, message: "Authorization token is missing" });
    return null;
  }

  if (!authHeader.startsWith("Bearer ")) {
    reply.code(400).send({
      success: false,
      message: "Invalid token format. Expected 'Bearer <token>'",
    });
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}
