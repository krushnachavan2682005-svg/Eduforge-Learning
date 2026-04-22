import { FastifyReply, FastifyRequest } from "fastify";
import { EnrollmentRepsitory } from "../repositories/enrollment.repositorie";
import { Enrollment } from "../models/enrollment.model";
import { EnrollmentInterface } from "../interfaces/enrollment.interface";
const enrollmentRepo = new EnrollmentRepsitory();
// type CreateEnrollmenteBody = Partial<Enrollment>;

export class EnrollmentController {
  async getEnrollmentById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, id } = req.params as { id: string; client_id: string };
      const enrollment = await enrollmentRepo.getEnrollmentById(client_id, id);

      if (!enrollment) {
        return reply.code(200).send({ message: "Enrollment not found" });
      }
      return reply
        .code(200)
        .send({ data: enrollment, message: "Enrollment fetched successfully" });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to fetch Enrollments",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async createEnrollment(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const body = req.body as EnrollmentInterface;
      const data = { ...body, client_id };

      if (data.enrolled_at) {
        const [day, month, year] = data.enrolled_at?.split(/[\/\-]/)?.map(Number);
        const date = new Date(Date.UTC(year, month - 1, day, 18, 30, 0));
        data.enrolled_at = date?.toISOString();
      } else {
        data.enrolled_at = new Date().toISOString();
      }

      const enrollment = await enrollmentRepo.createEnrollment(data);
      return reply.code(201).send({
        data: {
          id: enrollment?.id,
        },
        message: "Enrollment created successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to create Enrollment",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async updateEnrollment(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<Enrollment>;

      const updated = await enrollmentRepo.updateEnrollment(id, body);

      if (!updated) {
        return reply.code(200).send({ message: "Enrollment not found" });
      }

      return reply.send({
        data: updated?.id,
        message: "Enrollment updated successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to update Enrollment",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async deleteEnrollment(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await enrollmentRepo.deleteEnrollment(id);

      if (!deleted) {
        return reply.code(404).send({ message: "Enrollment not found" });
      }

      return reply.send({ message: "Enrollment deleted" });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to delete Enrollment",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getAllEnrollment(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const { page, limit } = req.query as { page?: string; limit?: string };

      const Enrollment = await enrollmentRepo.getEnrollment(
        Number(page),
        Number(limit),
        { client_id }
      );

      return reply.status(200).send(Enrollment);
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to fetch Enrollment",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
