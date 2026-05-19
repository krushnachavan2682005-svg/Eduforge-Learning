import { ClassStudent } from "./class-student.model";
import { StudentClass } from "./class.model";
import { LocalEnrollment, LocalEnrollmentStatus } from "./enrollment.model";
import { Student } from "./student.model";
import { OrganizationUser } from "../roles/role.model";

export class StudentRepository {
  async createStudent(data: {
    user_id: string;
    organization_id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
    status?: "active" | "inactive";
  }) {
    return Student.create(data);
  }

  async userBelongsToOrganization(organizationId: string, userId: string) {
    const membership = await OrganizationUser.findOne({
      where: {
        organization_id: organizationId,
        user_id: userId,
        is_active: true,
      },
    });

    return Boolean(membership);
  }

  async listStudents(organizationId: string) {
    return Student.findAll({
      where: { organization_id: organizationId },
      order: [["created_at", "DESC"]],
    });
  }

  async getStudentById(organizationId: string, id: string) {
    return Student.findOne({ where: { id, organization_id: organizationId } });
  }

  async createClass(data: {
    organization_id: string;
    name: string;
    description?: string | null;
    created_by: string;
  }) {
    return StudentClass.create(data);
  }

  async listClasses(organizationId: string) {
    return StudentClass.findAll({
      where: { organization_id: organizationId },
      order: [["created_at", "DESC"]],
    });
  }

  async getClassById(organizationId: string, classId: string) {
    return StudentClass.findOne({
      where: { id: classId, organization_id: organizationId },
    });
  }

  async addStudentToClass(classId: string, studentId: string) {
    const [mapping] = await ClassStudent.findOrCreate({
      where: { class_id: classId, student_id: studentId },
      defaults: { class_id: classId, student_id: studentId },
    });
    return mapping;
  }

  async getUserIdsByClassId(organizationId: string, classId: string) {
    const mappings = await ClassStudent.findAll({
      where: { class_id: classId },
      include: [
        {
          model: Student,
          as: "student",
          where: { organization_id: organizationId, status: "active" },
          attributes: ["id", "user_id"],
        },
      ],
    });

    return mappings
      .map((mapping: any) => mapping.student?.user_id)
      .filter(Boolean);
  }

  async findStudentByUserId(organizationId: string, userId: string) {
    return Student.findOne({
      where: { organization_id: organizationId, user_id: userId },
    });
  }

  async createEnrollment(data: {
    organization_id: string;
    student_id: string;
    course_id: string;
    status?: LocalEnrollmentStatus;
  }) {
    const [enrollment] = await LocalEnrollment.findOrCreate({
      where: {
        organization_id: data.organization_id,
        student_id: data.student_id,
        course_id: data.course_id,
      },
      defaults: {
        organization_id: data.organization_id,
        student_id: data.student_id,
        course_id: data.course_id,
        status: data.status || "assigned",
      },
    });

    return enrollment;
  }

  async getEnrollmentsByStudent(organizationId: string, studentId: string) {
    return LocalEnrollment.findAll({
      where: { organization_id: organizationId, student_id: studentId },
      order: [["enrolled_at", "DESC"]],
    });
  }

  async getDashboardCounts(organizationId: string) {
    const [totalStudents, assignedCourses, completedCourses] = await Promise.all([
      Student.count({ where: { organization_id: organizationId, status: "active" } }),
      LocalEnrollment.count({ where: { organization_id: organizationId } }),
      LocalEnrollment.count({
        where: { organization_id: organizationId, status: "completed" },
      }),
    ]);

    return {
      total_students: totalStudents,
      assigned_courses: assignedCourses,
      completed_courses: completedCourses,
      pending_courses: Math.max(assignedCourses - completedCourses, 0),
    };
  }
}
