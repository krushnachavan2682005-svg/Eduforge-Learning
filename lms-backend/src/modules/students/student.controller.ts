import { FastifyReply, FastifyRequest } from "fastify";
import { LocalEnrollmentStatus } from "./enrollment.model";
import { StudentRepository } from "./student.repository";

const repository = new StudentRepository();

export class StudentController {
  async createStudent(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const body = req.body as {
        user_id?: string;
        first_name: string;
        last_name: string;
        email: string;
        phone?: string;
        status?: "active" | "inactive";
      };
      const userId = body.user_id || req.user.sub;
      const userIsInOrganization = await repository.userBelongsToOrganization(
        req.user.organization_id,
        userId,
      );

      if (!userIsInOrganization) {
        return reply.code(403).send({
          success: false,
          message: "Student user does not belong to current organization",
        });
      }

      const student = await repository.createStudent({
        user_id: userId,
        organization_id: req.user.organization_id,
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email,
        phone: body.phone,
        status: body.status || "active",
      });

      return reply.code(201).send({ success: true, data: student });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({ success: false, message: "Failed to create student" });
    }
  }

  async listStudents(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const students = await repository.listStudents(req.user.organization_id);
    return reply.code(200).send({ success: true, data: students });
  }

  async getStudent(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const student = await repository.getStudentById(req.user.organization_id, id);
    if (!student) {
      return reply.code(404).send({ success: false, message: "Student not found" });
    }
    return reply.code(200).send({ success: true, data: student });
  }

  async createClass(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const body = req.body as { name: string; description?: string };
      const studentClass = await repository.createClass({
        organization_id: req.user.organization_id,
        name: body.name,
        description: body.description,
        created_by: req.user.sub,
      });
      return reply.code(201).send({ success: true, data: studentClass });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({ success: false, message: "Failed to create class" });
    }
  }

  async listClasses(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const classes = await repository.listClasses(req.user.organization_id);
    return reply.code(200).send({ success: true, data: classes });
  }

  async getClass(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const studentClass = await repository.getClassDetail(req.user.organization_id, id);

    if (!studentClass) {
      return reply.code(404).send({ success: false, message: "Class not found" });
    }

    return reply.code(200).send({ success: true, data: studentClass });
  }

  async getClassStudents(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const students = await repository.getStudentsByClassId(
      req.user.organization_id,
      id,
    );

    if (!students) {
      return reply.code(404).send({ success: false, message: "Class not found" });
    }

    return reply.code(200).send({ success: true, data: students });
  }

  async addStudentToClass(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { class_id, student_id } = req.params as {
      class_id: string;
      student_id: string;
    };

    const [studentClass, student] = await Promise.all([
      repository.getClassById(req.user.organization_id, class_id),
      repository.getStudentById(req.user.organization_id, student_id),
    ]);

    if (!studentClass || !student) {
      return reply.code(404).send({
        success: false,
        message: "Class or student not found in current organization",
      });
    }

    const mapping = await repository.addStudentToClass(class_id, student_id);
    return reply.code(201).send({ success: true, data: mapping });
  }

  async removeStudentFromClass(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { class_id, student_id } = req.params as {
      class_id: string;
      student_id: string;
    };

    const result = await repository.removeStudentFromClass(
      req.user.organization_id,
      class_id,
      student_id,
    );

    if (!result) {
      return reply.code(404).send({
        success: false,
        message: "Class or student not found in current organization",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Student removed from class",
      data: result,
    });
  }

  async createEnrollment(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const body = req.body as {
      student_id: string;
      course_id: string;
      status?: LocalEnrollmentStatus;
    };

    const student = await repository.getStudentById(
      req.user.organization_id,
      body.student_id,
    );
    if (!student) {
      return reply.code(404).send({ success: false, message: "Student not found" });
    }

    const enrollment = await repository.createEnrollment({
      organization_id: req.user.organization_id,
      student_id: body.student_id,
      course_id: body.course_id,
      status: body.status,
    });
    return reply.code(201).send({ success: true, data: enrollment });
  }

  async listEnrollments(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const query = req.query as {
      page?: string;
      limit?: string;
      search?: string;
      status?: LocalEnrollmentStatus;
      student_id?: string;
    };

    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
    const allowedStatuses: LocalEnrollmentStatus[] = [
      "assigned",
      "in_progress",
      "completed",
      "cancelled",
    ];
    const status = allowedStatuses.includes(query.status as LocalEnrollmentStatus)
      ? query.status
      : undefined;

    const result = await repository.listEnrollments({
      organizationId: req.user.organization_id,
      page,
      limit,
      search: query.search,
      status,
      student_id: query.student_id,
    });

    return reply.code(200).send({ success: true, ...result });
  }

  async getEnrollment(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const enrollment = await repository.getEnrollmentById(
      req.user.organization_id,
      id,
    );

    if (!enrollment) {
      return reply.code(404).send({ success: false, message: "Enrollment not found" });
    }

    return reply.code(200).send({ success: true, data: enrollment });
  }

  async updateEnrollmentStatus(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const body = req.body as { status?: LocalEnrollmentStatus };
    const allowedStatuses: LocalEnrollmentStatus[] = [
      "assigned",
      "in_progress",
      "completed",
      "cancelled",
    ];

    if (!body.status || !allowedStatuses.includes(body.status)) {
      return reply.code(400).send({
        success: false,
        message: "Invalid enrollment status",
      });
    }

    const enrollment = await repository.updateEnrollmentStatus(
      req.user.organization_id,
      id,
      body.status,
    );

    if (!enrollment) {
      return reply.code(404).send({ success: false, message: "Enrollment not found" });
    }

    return reply.code(200).send({ success: true, data: enrollment });
  }

  async getStudentEnrollments(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { student_id } = req.params as { student_id: string };
    const student = await repository.getStudentById(
      req.user.organization_id,
      student_id,
    );
    if (!student) {
      return reply.code(404).send({ success: false, message: "Student not found" });
    }

    const enrollments = await repository.getEnrollmentsByStudent(
      req.user.organization_id,
      student_id,
    );
    return reply.code(200).send({ success: true, data: enrollments });
  }
}
