import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { StudentRepository } from "../modules/students/student.repository";
import { asyncLocalStorage as cls } from "../constants/request-context";

const studentRepository = new StudentRepository();

export class StudentResultsRepository {
  async getResultsByUserId(
    user_id: string,
    page: number = 1,
    limit: number = 10,
    review_status?: string
  ) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    if (!organizationId) throw new Error("Tenant context missing");
    const offset = (page - 1) * limit;

    let whereClause = `WHERE eum.user_id = :user_id
      AND eum.organization_id = :organizationId
      AND eum.is_completed = true`;

    const replacements: any = { user_id, organizationId, limit, offset };

    if (review_status === 'completed') {
      whereClause += ` AND eum.review_status = :review_status`;
      replacements.review_status = 'completed';
    }

    const query = `
    SELECT 
      e.title as test_name,
    CASE 
  WHEN eum.review_status = 'pending_review' THEN NULL
  ELSE eum.total_marks_obtained
END AS achieved_marks,
      eum.total_possible_marks as total_marks,
      eum.submitted_at as exam_date,
      eum.review_status,
      eum.created_on,
      CASE 
        WHEN eum.passed = true THEN 'Pass'
 ELSE 'Fail'
      END as status
    FROM exam_user_mappings eum
    LEFT JOIN exams e ON e.id = eum.exam_id
    ${whereClause}
    ORDER BY eum.submitted_at DESC, eum.created_on DESC
    LIMIT :limit OFFSET :offset;
  `;

    const countQuery = `
    SELECT COUNT(*) as total
    FROM exam_user_mappings eum
    LEFT JOIN exams e ON e.id = eum.exam_id
    ${whereClause};
  `;

    const [results, countResult] = await Promise.all([
      sequelize?.query(query, {
        replacements,
        type: QueryTypes.SELECT,
      }),
      sequelize?.query(countQuery, {
        replacements,
        type: QueryTypes.SELECT,
      })
    ]);

    const total = (countResult as any[])[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: results,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: total,
        records_per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    };
  }

  async getAllResults(
    page: number = 1,
    limit: number = 10,
    review_status?: string
  ) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    if (!organizationId) throw new Error("Tenant context missing");
    const offset = (page - 1) * limit;

    let whereClause = `WHERE eum.organization_id = :organizationId
      AND eum.is_completed = true`;

    const replacements: any = { organization_id: organizationId, limit, offset };

    if (review_status === 'completed') {
      whereClause += ` AND eum.review_status = :review_status`;
      replacements.review_status = 'completed';
    }

    const query = `
    SELECT 
      eum.user_id,
      e.title AS test_name,
      CASE 
  WHEN eum.review_status = 'pending_review' THEN NULL
  ELSE eum.total_marks_obtained
END AS achieved_marks,
      eum.total_possible_marks AS total_marks,
      eum.submitted_at AS exam_date,
      eum.review_status,
      eum.created_on,
      CASE 
        WHEN eum.passed = true THEN 'Pass'
        ELSE 'Fail'
      END AS status
    FROM exam_user_mappings eum
    LEFT JOIN exams e ON e.id = eum.exam_id
    ${whereClause}
    ORDER BY eum.submitted_at DESC, eum.created_on DESC
    LIMIT :limit OFFSET :offset;
  `;

    const countQuery = `
    SELECT COUNT(*) as total
    FROM exam_user_mappings eum
    LEFT JOIN exams e ON e.id = eum.exam_id
    ${whereClause};
  `;

    const [results, countResult] = await Promise.all([
      sequelize.query(query, {
        replacements,
        type: QueryTypes.SELECT,
      }),
      sequelize.query(countQuery, {
        replacements,
        type: QueryTypes.SELECT,
      })
    ]);

    const total = (countResult as any[])[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: results,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: total,
        records_per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    };
  }

  async getStudentName(user_id: string): Promise<{ name: string; location: string; role: string }> {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    if (!organizationId) throw new Error("Tenant context missing");
    const name = await studentRepository.getStudentDisplayName(organizationId, user_id);
    return { name, location: "", role: "" };
  }

  async getStudentNamesBulk(
    user_ids: string[]
  ): Promise<Record<string, string>> {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    if (!organizationId) throw new Error("Tenant context missing");
    if (!user_ids.length) return {};

    return studentRepository.getStudentNamesByUserIds(organizationId, user_ids);
  }
}
