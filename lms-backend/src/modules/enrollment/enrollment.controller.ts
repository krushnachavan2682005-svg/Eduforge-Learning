import { FastifyReply, FastifyRequest } from "fastify";
import { EnrollmentService } from "./enrollment.service";
import { EnrollmentInterface } from "./enrollment.interface";
import { Enrollment } from "./enrollment.model";

const enrollmentService = new EnrollmentService();

export class EnrollmentController {
  async getEnrollmentById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const organizationId = req.user?.organization_id as string;
    
    const enrollment = await enrollmentService.getEnrollmentById(organizationId, id);

    if (!enrollment) {
      return reply.code(200).send({ message: "Enrollment not found" });
    }
    return reply
      .code(200)
      .send({ data: enrollment, message: "Enrollment fetched successfully" });
  }

  async createEnrollment(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as EnrollmentInterface;
    const organizationId = req.user?.organization_id as string;
    
    const enrollment = await enrollmentService.createEnrollment(organizationId, body);
    
    return reply.code(201).send({
      data: {
        id: enrollment?.id,
      },
      message: "Enrollment created successfully",
    });
  }

  async updateEnrollment(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const organizationId = req.user?.organization_id as string;
    const body = req.body as Partial<Enrollment>;

    const updated = await enrollmentService.updateEnrollment(organizationId, id, body);

    if (!updated) {
      return reply.code(200).send({ message: "Enrollment not found" });
    }

    return reply.send({
      data: updated?.id,
      message: "Enrollment updated successfully",
    });
  }

  async deleteEnrollment(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const organizationId = req.user?.organization_id as string;
    
    await enrollmentService.deleteEnrollment(organizationId, id);

    return reply.send({ message: "Enrollment deleted" });
  }

  async getAllEnrollment(req: FastifyRequest, reply: FastifyReply) {
    const { page, limit, cursor } = req.query as { 
      page?: string; 
      limit?: string;
      cursor?: string;
    };
    const organizationId = req.user?.organization_id as string;

    const enrollment = await enrollmentService.getAllEnrollment(
      organizationId,
      Number(page),
      Number(limit),
      cursor
    );

    return reply.status(200).send(enrollment);
  }
}
