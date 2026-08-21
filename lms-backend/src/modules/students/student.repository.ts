import { Op } from "sequelize";
import { ClassStudent } from "./class-student.model";
import { StudentClass } from "./class.model";
import { LocalEnrollment, LocalEnrollmentStatus } from "./enrollment.model";
import { Student } from "./student.model";

type EnrollmentListFilters = {
  organizationId: string;
  page: number;
  limit: number;
  search?: string;
  status?: LocalEnrollmentStatus;
  student_id?: string;
};

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

  async getClassDetail(organizationId: string, classId: string) {
    return this.getClassById(organizationId, classId);
  }
  
  async getStudentCountByClassId(organizationId: string, classId: string) {
    return ClassStudent.count({
      where: { class_id: classId },
      include: [
        {
          model: Student,
          as: "student",
          where: { organization_id: organizationId },
          attributes: [],
          required: true,
        },
      ],
    });
  }

  async addStudentToClass(classId: string, studentId: string) {
    const [mapping] = await ClassStudent.findOrCreate({
      where: { class_id: classId, student_id: studentId },
      defaults: { class_id: classId, student_id: studentId },
    });
    return mapping;
  }

  async getStudentsByClassId(organizationId: string, classId: string) {
    return ClassStudent.findAll({
      where: { class_id: classId },
      include: [
        {
          model: Student,
          as: "student",
          where: { organization_id: organizationId },
          required: true,
        },
      ],
      order: [["created_at", "DESC"]],
    });
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

  async removeStudentFromClass(classId: string, studentId: string) {
    const deleted = await ClassStudent.destroy({
      where: { class_id: classId, student_id: studentId },
    });

    return { deleted };
  }

  async findStudentByUserId(organizationId: string, userId: string) {
    return Student.findOne({
      where: { organization_id: organizationId, user_id: userId },
    });
  }

  async getStudentDisplayName(organizationId: string, userId: string) {
    const student = await Student.findOne({
      where: { organization_id: organizationId, user_id: userId },
    });

    if (student) {
      return [student.first_name, student.last_name].filter(Boolean).join(" ");
    }
    return "";
  }

  async getStudentNamesByUserIds(organizationId: string, userIds: string[]) {
    if (!userIds.length) return {};

    const students = await Student.findAll({
      where: { organization_id: organizationId, user_id: { [Op.in]: userIds } },
    });

    const names: Record<string, string> = {};

    students.forEach((student) => {
      names[student.user_id] = [student.first_name, student.last_name]
        .filter(Boolean)
        .join(" ");
    });

    return names;
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
      include: [{ model: Student, as: "student" }],
    });
  }

  async listEnrollments(filters: EnrollmentListFilters) {
    const offset = (filters.page - 1) * filters.limit;
    const where: Record<string, unknown> = {
      organization_id: filters.organizationId,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.student_id) {
      where.student_id = filters.student_id;
    }

    const studentWhere = filters.search
      ? {
          [Op.or]: [
            { first_name: { [Op.iLike]: `%${filters.search}%` } },
            { last_name: { [Op.iLike]: `%${filters.search}%` } },
            { email: { [Op.iLike]: `%${filters.search}%` } },
          ],
        }
      : undefined;

    const { rows, count } = await LocalEnrollment.findAndCountAll({
      where,
      include: [
        {
          model: Student,
          as: "student",
          where: studentWhere,
          required: Boolean(studentWhere),
        },
      ],
      order: [["enrolled_at", "DESC"]],
      limit: filters.limit,
      offset,
      distinct: true,
    });

    return {
      data: rows,
      count,
    };
  }

  async getEnrollmentById(organizationId: string, enrollmentId: string) {
    return LocalEnrollment.findOne({
      where: { id: enrollmentId, organization_id: organizationId },
      include: [{ model: Student, as: "student" }],
    });
  }

  async updateEnrollment(
    organizationId: string,
    enrollmentId: string,
    data: any,
  ) {
    const enrollment = await LocalEnrollment.findOne({
      where: { id: enrollmentId, organization_id: organizationId },
    });

    if (!enrollment) return null;

    await enrollment.update(data);
    return enrollment;
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
