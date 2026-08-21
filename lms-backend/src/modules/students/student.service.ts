import { StudentRepository } from "./student.repository";
import { ForbiddenError, NotFoundError, ConflictError, InternalServerError, ValidationError } from "../../utils/globalErrorHandlingFile";
import { LocalEnrollmentStatus } from "./enrollment.model";
import { OrganizationUser } from "../roles/role.model";
import { User } from "../users/user.model";
import { Course } from "../course/course.model";
import { Op } from "sequelize";

export class StudentService {
  private repository = new StudentRepository();

  async createStudent(userId: string, orgId: string, data: any) {
    const membership = await OrganizationUser.findOne({
      where: {
        organization_id: orgId,
        user_id: userId,
        is_active: true,
      },
    });

    if (!Boolean(membership)) {
      throw new ForbiddenError("Student user does not belong to current organization");
    }

    const studentData = {
      user_id: userId,
      organization_id: orgId,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      status: data.status || "active",
    };

    return this.repository.createStudent(studentData);
  }

  async listStudents(orgId: string) {
    return this.repository.listStudents(orgId);
  }

  async getStudent(orgId: string, id: string) {
    const student = await this.repository.getStudentById(orgId, id);
    if (!student) throw new NotFoundError("Student not found");
    return student;
  }

  async createClass(userId: string, orgId: string, data: any) {
    return this.repository.createClass({
      organization_id: orgId,
      name: data.name,
      description: data.description,
      created_by: userId,
    });
  }

  async listClasses(orgId: string) {
    return this.repository.listClasses(orgId);
  }

  async getClass(orgId: string, id: string) {
    const studentClass = await this.repository.getClassDetail(orgId, id);
    if (!studentClass) throw new NotFoundError("Class not found");

    const studentCount = await this.repository.getStudentCountByClassId(orgId, id);

    return {
      ...studentClass.toJSON(),
      student_count: studentCount,
    };
  }

  async getClassStudents(orgId: string, id: string) {
    const studentClass = await this.repository.getClassById(orgId, id);
    if (!studentClass) throw new NotFoundError("Class not found");

    const mappings = await this.repository.getStudentsByClassId(orgId, id);

    return mappings
      .map((mapping: any) => mapping.student)
      .filter(Boolean)
      .map((student: any) => ({
        id: student.id,
        user_id: student.user_id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        phone: student.phone,
        status: student.status,
      }));
  }

  async addStudentToClass(orgId: string, classId: string, studentId: string) {
    const [studentClass, student] = await Promise.all([
      this.repository.getClassById(orgId, classId),
      this.repository.getStudentById(orgId, studentId),
    ]);

    if (!studentClass || !student) {
      throw new NotFoundError("Class or student not found in current organization");
    }

    return this.repository.addStudentToClass(classId, studentId);
  }

  async removeStudentFromClass(orgId: string, classId: string, studentId: string) {
    const [studentClass, student] = await Promise.all([
      this.repository.getClassById(orgId, classId),
      this.repository.getStudentById(orgId, studentId),
    ]);

    if (!studentClass || !student) {
      throw new NotFoundError("Class or student not found in current organization");
    }

    return this.repository.removeStudentFromClass(classId, studentId);
  }

  async createEnrollment(orgId: string, data: any) {
    const student = await this.repository.getStudentById(orgId, data.student_id);
    if (!student) {
      throw new NotFoundError("Student not found");
    }

    return this.repository.createEnrollment({
      organization_id: orgId,
      student_id: data.student_id,
      course_id: data.course_id,
      status: data.status,
    });
  }

  private async attachCourseSummaries(organizationId: string, enrollments: any[]) {
    const serialized = enrollments.map((enrollment: any) => enrollment.toJSON());
    const courseIds = Array.from(
      new Set(serialized.map((enrollment: any) => enrollment.course_id).filter(Boolean)),
    );

    if (!courseIds.length) return serialized;

    const courses = await Course.findAll({
      where: {
        id: { [Op.in]: courseIds as string[] },
        organization_id: organizationId,
      },
      attributes: ["id", "title", "description", "level", "is_published"],
    });

    const courseById = new Map(
      courses.map((course: any) => [course.id, course.toJSON()]),
    );

    return serialized.map((enrollment: any) => ({
      ...enrollment,
      course: courseById.get(enrollment.course_id) || null,
    }));
  }

  async listEnrollments(orgId: string, query: any) {
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

    const { data: rows, count } = await this.repository.listEnrollments({
      organizationId: orgId,
      page,
      limit,
      search: query.search,
      status,
      student_id: query.student_id,
    });

    const data = await this.attachCourseSummaries(orgId, rows as any[]);

    return {
      data,
      meta: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil(count / limit),
      },
    };
  }

  async getEnrollment(orgId: string, id: string) {
    const enrollment = await this.repository.getEnrollmentById(orgId, id);
    if (!enrollment) throw new NotFoundError("Enrollment not found");

    const [serialized] = await this.attachCourseSummaries(orgId, [enrollment]);
    return serialized;
  }

  async updateEnrollmentStatus(orgId: string, id: string, status: string) {
    const allowedStatuses: LocalEnrollmentStatus[] = [
      "assigned",
      "in_progress",
      "completed",
      "cancelled",
    ];

    if (!status || !allowedStatuses.includes(status as LocalEnrollmentStatus)) {
      throw new ValidationError("Invalid enrollment status");
    }

    const dataToUpdate: any = { status };
    if (status === "completed") {
      dataToUpdate.completed_at = new Date();
    } else {
      dataToUpdate.completed_at = null;
    }

    const updated = await this.repository.updateEnrollment(orgId, id, dataToUpdate);
    if (!updated) throw new NotFoundError("Enrollment not found");

    return this.getEnrollment(orgId, id);
  }

  async getStudentEnrollments(orgId: string, studentId: string) {
    const student = await this.repository.getStudentById(orgId, studentId);
    if (!student) throw new NotFoundError("Student not found");

    const enrollments = await this.repository.getEnrollmentsByStudent(orgId, studentId);
    return this.attachCourseSummaries(orgId, enrollments as any[]);
  }
}

