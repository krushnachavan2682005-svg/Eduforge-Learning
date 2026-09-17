import { sequelize } from "../../config/database";
import { Organization } from "./organization.model";
import { DataTypes, QueryError, QueryTypes } from "sequelize";

export class organizationRepo {
  static async getactiveOrganizations() {
    let active = await Organization.findAll({ where: { is_active: true },raw:true });
    // let sql=`select * from organization where is_active=True;`
    // let data=sequelize.query(sql,{type:QueryTypes.SELECT})
    return active;
  }
  static async getOrganizationCounts(organization_id: string) {
    const sql = `
        SELECT 
            o.id, o.name,
            COUNT(CASE WHEN r.code = 'student' THEN 1 END) AS student_count,
            COUNT(CASE WHEN r.code = 'teacher' THEN 1 END) AS teacher_count,
            COUNT(CASE WHEN r.code = 'organization_admin' THEN 1 END) AS admin_count
        FROM organizations o
        LEFT JOIN user_roles ur ON o.id = ur.organization_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE o.id = :organization_id
        GROUP BY o.id, o.name;
    `;

    const result = await sequelize.query(sql, {
      replacements: { organization_id },
      type: QueryTypes.SELECT,
    });

    return result[0];
  }
}
