import { FastifyRequest, FastifyReply } from "fastify";
import { LevelRepository } from "../repositories/level.repositorie";
const levelRep = new LevelRepository();

export class LevelController {
  async createLevel(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const { level_name, start_date, end_date } = req.body as {
        level_name: string;
        start_date?: string;
        end_date?: string;
      };

      const data: any = {
        client_id,
        level_name,
      };

      if (start_date) {
        data.start_date = start_date;
      }
      if (end_date) {
        data.end_date = end_date;
      }

      const item = await levelRep.createLevel(data);

      return reply.code(201).send({
        data: {
          id: item.id,
        },
        message: "Level created successfully",
      });
    } catch (error: any) {
      req.log.error(error);

      // Check for duplicate level name error from repository
      if (error instanceof Error && error.message.includes("already exists")) {
        return reply.code(409).send({
          message: "Failed to create level",
          error: "This level name already exists for this client",
        });
      }

      return reply.code(500).send({
        message: "Failed to create level",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getAllLevels(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const { page = "1", limit = "10" } = req.query as {
        page?: string;
        limit?: string;
      };

      const items = await levelRep.getLevels(Number(page), Number(limit), {
        client_id,
      });

      return reply.code(200).send({
        data: items,
        message: "Levels fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        message: "Failed to fetch levels",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getLevelById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id, client_id } = req.params as { id: string; client_id: string };
      const item = await levelRep.getLevelById(client_id, id);

      if (!item) return reply.code(404).send({ message: "Level not found" });

      return reply.code(200).send({
        data: item,
        message: "Level fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        message: "Failed to fetch level",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async updateLevel(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<any>;

      const updated = await levelRep.updateLevel(id, body);

      if (!updated) return reply.code(404).send({ message: "Level not found" });

      return reply.code(200).send({
        data: updated.id,
        message: "Level updated successfully",
      });
    } catch (error: any) {
      req.log.error(error);

      // Handle validation error for assigned levels
      if (error.statusCode === 403) {
        return reply.code(403).send({
          message: error.message,
        });
      }

      return reply.code(500).send({
        message: "Failed to update level",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async deleteLevel(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await levelRep.deleteLevel(id);

      if (!deleted) return reply.code(404).send({ message: "Level not found" });

      return reply.code(200).send({
        message: "Level deleted successfully",
      });
    } catch (error: any) {
      req.log.error(error);

      if (error.statusCode === 403) {
        return reply.code(403).send({
          message: error.message,
        });
      }

      return reply.code(500).send({
        message: "Failed to delete level",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
