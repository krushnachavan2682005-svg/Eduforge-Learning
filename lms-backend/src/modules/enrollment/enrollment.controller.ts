import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { EnrollmentRepsitory } from "./enrollment.repository";
import { Enrollment } from "./enrollment.model";
import { EnrollmentInterface } from "./enrollment.interface";
const enrollmentRepo = new EnrollmentRepsitory();
// type CreateEnrollmenteBody = Partial<Enrollment>;

export class EnrollmentController {
  async getEnrollmentById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { organization_id, id } = req.params as { id: string; organization_id: string };
      const enrollment = await enrollmentRepo.getEnrollmentById(req.user?.organization_id as string, id);

      if (!enrollment) {
        return reply.code(200).send({ message: "Enrollment not found" });
      }
      return reply
        .code(200)
        .send({ data: enrollment, message: "Enrollment fetched successfully" });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch Enrollments");
    }
  }

  async createEnrollment(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as EnrollmentInterface;
      const data = { ...body, organization_id: req.user?.organization_id as string };

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
      throw new InternalServerError("Failed to create Enrollment");
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
      throw new InternalServerError("Failed to update Enrollment");
    }
  }

  async deleteEnrollment(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await enrollmentRepo.deleteEnrollment(id);

      if (!deleted) {
        throw new NotFoundError("Enrollment not found");
      }

      return reply.send({ message: "Enrollment deleted" });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to delete Enrollment");
    }
  }

  async getAllEnrollment(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { page, limit } = req.query as { page?: string; limit?: string };

      const Enrollment = await enrollmentRepo.getEnrollment(
        Number(page),
        Number(limit),
        { organization_id: req.user?.organization_id as string }
      );

      return reply.status(200).send(Enrollment);
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch Enrollment");
    }
  }
}
