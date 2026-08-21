import { FastifyReply, FastifyRequest } from "fastify";
import { UserService } from "./user.service";
import { InternalServerError, NotFoundError, UnauthorizedError } from "../../utils/globalErrorHandlingFile";

const userService = new UserService();

export class UserController {
  async me(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user || !req.user.organization_id) {
        throw new UnauthorizedError("Authentication required");
      }

      const data = await userService.getCurrentUser(
        req.user.sub,
        req.user.organization_id,
      );

      return reply.code(200).send({
        success: true,
        data,
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof NotFoundError || error instanceof UnauthorizedError) throw error;
      throw new InternalServerError("Failed to fetch current user");
    }
  }
}

