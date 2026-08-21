import { FastifyReply, FastifyRequest } from "fastify";
import { StudentService } from "./student.service";

const service = new StudentService();

export class StudentController {
  async createStudent(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const body = req.body as any;
    const userId = body.user_id || req.user.sub;
    
    const student = await service.createStudent(userId, req.user.organization_id, body);
    return reply.code(201).send({ success: true, data: student });
  }

  async listStudents(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const students = await service.listStudents(req.user.organization_id);
    return reply.code(200).send({ success: true, data: students });
  }

  async getStudent(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const student = await service.getStudent(req.user.organization_id, id);
    return reply.code(200).send({ success: true, data: student });
  }

  async createClass(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const body = req.body as any;
    const studentClass = await service.createClass(req.user.sub, req.user.organization_id, body);
    return reply.code(201).send({ success: true, data: studentClass });
  }

  async listClasses(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const classes = await service.listClasses(req.user.organization_id);
    return reply.code(200).send({ success: true, data: classes });
  }

  async getClass(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const studentClass = await service.getClass(req.user.organization_id, id);
    return reply.code(200).send({ success: true, data: studentClass });
  }

  async getClassStudents(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const students = await service.getClassStudents(req.user.organization_id, id);
    return reply.code(200).send({ success: true, data: students });
  }

  async addStudentToClass(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { class_id, student_id } = req.params as { class_id: string; student_id: string };
    const mapping = await service.addStudentToClass(req.user.organization_id, class_id, student_id);
    return reply.code(201).send({ success: true, data: mapping });
  }

  async removeStudentFromClass(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { class_id, student_id } = req.params as { class_id: string; student_id: string };
    const result = await service.removeStudentFromClass(req.user.organization_id, class_id, student_id);
    return reply.code(200).send({ success: true, message: "Student removed from class", data: result });
  }

  async createEnrollment(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const body = req.body as any;
    const enrollment = await service.createEnrollment(req.user.organization_id, body);
    return reply.code(201).send({ success: true, data: enrollment });
  }

  async listEnrollments(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const result = await service.listEnrollments(req.user.organization_id, req.query);
    return reply.code(200).send({ success: true, ...result });
  }

  async getEnrollment(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const enrollment = await service.getEnrollment(req.user.organization_id, id);
    return reply.code(200).send({ success: true, data: enrollment });
  }

  async updateEnrollmentStatus(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const body = req.body as { status?: string };
    
    const enrollment = await service.updateEnrollmentStatus(req.user.organization_id, id, body.status || "");
    return reply.code(200).send({ success: true, data: enrollment });
  }

  async getStudentEnrollments(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { student_id } = req.params as { student_id: string };
    const enrollments = await service.getStudentEnrollments(req.user.organization_id, student_id);
    return reply.code(200).send({ success: true, data: enrollments });
  }
}
