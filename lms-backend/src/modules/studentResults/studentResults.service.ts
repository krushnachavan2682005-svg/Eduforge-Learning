import { StudentResultsRepository } from "./studentResults.repository";
import { StudentRepository } from "../students/student.repository";

export class StudentResultsService {
  private repository: StudentResultsRepository;
  private studentRepository: StudentRepository;

  constructor() {
    this.repository = new StudentResultsRepository();
    this.studentRepository = new StudentRepository();
  }

  async getStudentResults(
    organizationId: string,
    userId: string,
    page: number = 1,
    limit: number = 10,
    reviewStatus?: string,
  ) {
    const studentName = await this.studentRepository.getStudentDisplayName(
      organizationId,
      userId,
    );

    const result = await this.repository.getResultsByUserId(
      organizationId,
      userId,
      page,
      limit,
      reviewStatus,
    );

    return {
      studentName: { name: studentName, location: "", role: "" },
      data: result.data,
      pagination: result.pagination,
    };
  }

  async getAllResults(
    organizationId: string,
    page: number = 1,
    limit: number = 10,
    reviewStatus?: string,
  ) {
    const result = await this.repository.getAllResults(
      organizationId,
      page,
      limit,
      reviewStatus,
    );

    const userIds = [
      ...new Set(result.data.map((r: any) => r.user_id).filter(Boolean)),
    ];

    const nameMap =
      userIds.length > 0
        ? await this.studentRepository.getStudentNamesByUserIds(
            organizationId,
            userIds as string[],
          )
        : {};

    const data = result.data.map((r: any) => ({
      ...r,
      studentName: nameMap[r.user_id] || "",
    }));

    return {
      data,
      pagination: result.pagination,
    };
  }
}
