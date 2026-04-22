import { QueryTypes } from "sequelize";
import { externalDB, sequelize } from "../config/database";

export class StudentResultsRepository {
  async getResultsByUserId(
    user_id: string,
    client_id: string,
    page: number = 1,
    limit: number = 10,
    review_status?: string
  ) {
    const offset = (page - 1) * limit;

    let whereClause = `WHERE eum.user_id = :user_id
      AND eum.client_id = :client_id
      AND eum.is_completed = true`;

    const replacements: any = { user_id, client_id, limit, offset };

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
    client_id: string,
    page: number = 1,
    limit: number = 10,
    review_status?: string
  ) {
    const offset = (page - 1) * limit;

    let whereClause = `WHERE eum.client_id = :client_id
      AND eum.is_completed = true`;

    const replacements: any = { client_id, limit, offset };

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

  async getStudentName(user_id: string, client_id: string): Promise<{ name: string; location: string; role: string }> {
    const hasRoleCol = (
      await externalDB.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'addmissions'
           AND column_name = 'role'
           AND table_schema = current_schema()`,
        { type: QueryTypes.SELECT },
      )
    ).length > 0;
    const hasCityCol = (
      await externalDB.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'addmissions'
           AND column_name = 'city'
           AND table_schema = current_schema()`,
        { type: QueryTypes.SELECT },
      )
    ).length > 0;
    const hasLocationCol = (
      await externalDB.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'addmissions'
           AND column_name = 'location'
           AND table_schema = current_schema()`,
        { type: QueryTypes.SELECT },
      )
    ).length > 0;
    const hasStateCol = (
      await externalDB.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'addmissions'
           AND column_name = 'state'
           AND table_schema = current_schema()`,
        { type: QueryTypes.SELECT },
      )
    ).length > 0;

    let selectCols = [`first_name`, `middle_name`, `last_name`];
    if (hasCityCol) selectCols.push(`city`);
    if (hasLocationCol) selectCols.push(`location`);
    if (hasStateCol) selectCols.push(`state`);
    if (hasRoleCol) selectCols.push(`role`);

    const studentNameQuery = `
      SELECT ${selectCols.join(", ")}
      FROM addmissions
      WHERE user_id = :user_id AND client_id = :client_id
      LIMIT 1;
    `;
    const [studentResult]: any[] = await externalDB.query(studentNameQuery, {
      replacements: { user_id, client_id },
      type: QueryTypes.SELECT,
    });

    const name = studentResult
      ? [
        studentResult.first_name,
        studentResult.middle_name,
        studentResult.last_name,
      ]
        .filter(Boolean)
        .join(" ")
      : "";

    let location = "";
    let role = "";
    if (studentResult) {
      if (hasCityCol && studentResult.city) location = studentResult.city;
      if (!location && hasLocationCol && studentResult.location)
        location = studentResult.location;
      if (!location && hasStateCol && studentResult.state)
        location = studentResult.state;
      if (hasRoleCol && studentResult.role) {
        role = studentResult.role;
      }
    }

    return { name, location, role };
  }

  async getStudentNamesBulk(
    user_ids: string[],
    client_id: string,
  ): Promise<Record<string, string>> {
    if (!user_ids.length) return {};

    const studentNamesQuery = `
      SELECT user_id, first_name, middle_name, last_name
      FROM addmissions
      WHERE user_id IN (:user_ids) AND client_id = :client_id;
    `;
    const results: any[] = await externalDB.query(studentNamesQuery, {
      replacements: { user_ids, client_id },
      type: QueryTypes.SELECT,
    });

    const nameMap: Record<string, string> = {};
    results.forEach((row) => {
      nameMap[row.user_id] = [row.first_name, row.middle_name, row.last_name]
        .filter(Boolean)
        .join(" ");
    });
    return nameMap;
  }
}
