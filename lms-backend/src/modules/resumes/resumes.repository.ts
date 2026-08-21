import { ResumeModel } from "./resumes.model";
import { sequelize } from "../../config/database";
import { QueryTypes } from "sequelize";

export class ResumeRepository {
  // Create Resume
  async createResume(data: Partial<ResumeModel>) {
    const resume = await ResumeModel.create(data as any);
    return resume.toJSON(); // return plain object instead of Sequelize instance
  }


  async getResumeByUserId(userId: string) {
    return await ResumeModel.findOne({
      where: { user_id: userId }, // use actual column name
      raw: true
    });
  }

  async updateResume(userId: string, data: any) {
    const [count] = await ResumeModel.update(data, {
      where: { user_id: userId },
    });

    return count;
  }


  //  Delete resume
  async deleteResume(id: string) {
    const deletedCount = await ResumeModel.destroy({
      where: { id },
    });
    return deletedCount > 0;
  }

  // ✅ Example raw query (fetch resume with projects etc.)
  async getResumeWithProjects(id: string) {
    const results = await sequelize.query<ResumeModel>(
      `
      SELECT
        r.id,
        r.name,
        r.email,
        r.phone,
        r.address,
        r.degree,
        r.institution,
        r.graduation_year,
        r.company,
        r.role,
        r.years_of_experience,
        r.skills,
        r.project_title,
        r.project_description,
        r.created_at,
        r.updated_at
      FROM resumes r
      WHERE r.id = :id
      `,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
      }
    );

    return results[0] || null;
  }
}
