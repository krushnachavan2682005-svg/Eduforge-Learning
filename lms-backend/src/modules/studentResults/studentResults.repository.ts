import { ExamUserMapping, Exam } from "../exam/exam.model";
import { paginate } from "../../utils/pagination";

export class StudentResultsRepository {
  async getResultsByUserId(
    organizationId: string,
    user_id: string,
    page: number = 1,
    limit: number = 10,
    review_status?: string,
    cursor?: string,
  ) {
    const filters: any = {
      organization_id: organizationId,
      user_id: user_id,
      is_completed: true,
    };

    if (review_status === "completed") {
      filters.review_status = "completed";
    }

    const result = await paginate(ExamUserMapping, {
      filters,
      cursor,
      cursorFields: ["submitted_at", "id"],
      limit,
      page,
      include: [
        {
          model: Exam,
          as: "exam",
          attributes: ["title"],
        },
      ],
      order: [
        ["submitted_at", "DESC"],
        ["id", "DESC"],
      ],
    });

    const transformedData = result.data.map((eum: any) => ({
      test_name: eum.exam?.title || null,
      achieved_marks:
        eum.review_status === "pending_review" ? null : eum.total_marks_obtained,
      total_marks: eum.total_possible_marks,
      exam_date: eum.submitted_at,
      review_status: eum.review_status,
      created_on: eum.created_on,
      status: eum.passed ? "Pass" : "Fail",
    }));

    return {
      data: transformedData,
      pagination: result.pagination,
    };
  }

  async getAllResults(
    organizationId: string,
    page: number = 1,
    limit: number = 10,
    review_status?: string,
    cursor?: string,
  ) {
    const filters: any = {
      organization_id: organizationId,
      is_completed: true,
    };

    if (review_status === "completed") {
      filters.review_status = "completed";
    }

    const result = await paginate(ExamUserMapping, {
      filters,
      cursor,
      cursorFields: ["submitted_at", "id"],
      limit,
      page,
      include: [
        {
          model: Exam,
          as: "exam",
          attributes: ["title"],
        },
      ],
      order: [
        ["submitted_at", "DESC"],
        ["id", "DESC"],
      ],
    });

    const transformedData = result.data.map((eum: any) => ({
      user_id: eum.user_id,
      test_name: eum.exam?.title || null,
      achieved_marks:
        eum.review_status === "pending_review" ? null : eum.total_marks_obtained,
      total_marks: eum.total_possible_marks,
      exam_date: eum.submitted_at,
      review_status: eum.review_status,
      created_on: eum.created_on,
      status: eum.passed ? "Pass" : "Fail",
    }));

    return {
      data: transformedData,
      pagination: result.pagination,
    };
  }
}
