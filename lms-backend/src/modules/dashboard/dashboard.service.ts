import { DashboardRepository } from "./dashboard.repository";
import { AuthRepository } from "../auth/auth.repository";
import { StudentRepository } from "../students/student.repository";
import { AssiginCourseRepositorie } from "../assignCourse/assignCourse.repository";
import { StudentResultsRepository } from "../studentResults/studentResults.repository";
import { AssiginActionItemsrepositorie } from "../assignActionItems/assignActionItems.repository";
import { NotFoundError } from "../../utils/globalErrorHandlingFile";

export class DashboardService {
  private repository: DashboardRepository;
  private authRepository: AuthRepository;
  private studentRepository: StudentRepository;
  private courseRepo: AssiginCourseRepositorie;
  private actionRepo: AssiginActionItemsrepositorie;
  private resultsRepo: StudentResultsRepository;

  constructor() {
    this.repository = new DashboardRepository();
    this.authRepository = new AuthRepository();
    this.studentRepository = new StudentRepository();
    this.courseRepo = new AssiginCourseRepositorie();
    this.actionRepo = new AssiginActionItemsrepositorie();
    this.resultsRepo = new StudentResultsRepository();
  }

  async getMeDashboard(userId: string, organizationId: string) {
    const membership = await this.authRepository.findUserContext(
      userId,
      organizationId
    );

    if (!membership) {
      throw new NotFoundError("Dashboard context was not found");
    }

    const user = (membership as any).user;
    const organization = (membership as any).organization;
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
    const counts = await this.studentRepository.getDashboardCounts(
      organizationId
    );

    return {
      profile: {
        id: user.id,
        name,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: membership.role,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        },
        profileViews: 0,
      },
      stats: {
        courses_created: 0,
        courses_assigned: counts.assigned_courses,
        assigned_courses: counts.assigned_courses,
        total_students: counts.total_students,
        completed_students: counts.completed_courses,
        completed_courses: counts.completed_courses,
        pending_students: counts.pending_courses,
        pending_courses: counts.pending_courses,
      },
      timeline: [],
    };
  }

  async getUserDashboard(organizationId: string, userId: string) {
    const [courses, testsResult, actionItems] = await Promise.all([
      this.courseRepo.getCourseByUserId(organizationId, userId),
      this.resultsRepo.getResultsByUserId(organizationId, userId),
      this.actionRepo.getApprovedActionItemsByUserId(organizationId, userId),
    ]);

    const tests = testsResult?.data || [];
    const studentNameStr = await this.studentRepository.getStudentDisplayName(organizationId, userId);

    const profile = {
      name: studentNameStr || "",
      role: "",
      location: "",
      profileViews: (tests?.length || 0) + (actionItems?.length || 0),
    };

    const timeline: any[] = [];
    const makeEntryDate = (raw: any) => {
      if (!raw) {
        return { date: "", sortDate: 0 };
      }
      const d = new Date(raw);
      const iso = isNaN(d.getTime()) ? "" : d.toISOString();
      return {
        date: iso ? iso.split("T")[0] : "",
        sortDate: d.getTime() || 0,
      };
    };

    tests?.forEach((t: any) => {
      const { date, sortDate } = makeEntryDate(t.exam_date);
      timeline.push({
        studentName: profile.name,
        type: "Test",
        title: t.test_name,
        description: t.description || "",
        date,
        sortDate,
        marks: `${t.achieved_marks}/${t.total_marks}`,
        link: "",
      });
    });

    (courses || [])
      .filter((c: any) => c.progress_percentage >= 100)
      .forEach((c: any) => {
        const { date, sortDate } = makeEntryDate(c?.updated_at);
        timeline.push({
          studentName: profile.name,
          type: "Course",
          title: c.title,
          description: "",
          date,
          sortDate,
          marks: "",
          link: "",
        });
      });

    actionItems?.forEach((ai: any) => {
      const { date, sortDate } = makeEntryDate(ai?.end_date);
      timeline.push({
        studentName: profile.name,
        type: "Action Item",
        title: ai.task_name,
        description: ai.description || "",
        date,
        sortDate,
        marks: ai.score != null ? ai.score.toString() : "",
        link: "",
      });
    });

    timeline.sort((a, b) => b?.sortDate - a?.sortDate);

    const recentCompletedActivity = {
      courses: (courses || []).map((c: any) => ({
        name: c.title,
        percentage: c.progress_percentage,
      })),
      tests: (tests || []).map((t: any) => ({
        name: t.test_name,
        status: t.status,
      })),
      actionItems: (actionItems || []).map((ai: any) => ({
        name: ai.task_name,
        percentage: ai.score || 0,
      })),
    };

    const cleanedTimeline = timeline.map(({ sortDate, ...rest }) => rest);

    return {
      profile,
      timeline: cleanedTimeline,
      recentCompletedActivity,
    };
  }

  async getTutorDashboard(organizationId: string, userId: string) {
    const ResumeRepository = (await import("../resumes/resumes.repository")).ResumeRepository;
    const resumeRepo = new ResumeRepository();

    // profile section
    const studentNameStr = await this.studentRepository.getStudentDisplayName(organizationId, userId);
    let profile: any = { name: studentNameStr, location: "", role: "" };

    if (!profile.name) {
      const resume: any = await resumeRepo.getResumeByUserId(userId);
      if (resume && resume.name) {
        profile.name = resume.name;
      }
    }

    const hasCreatedByExam = await this.repository.hasCreatedByColumn('exams');
    const hasCreatedByCourse = await this.repository.hasCreatedByColumn('courses');

    const examIds = await this.repository.getExamIdsCreatedByTutor(organizationId, userId, hasCreatedByExam);

    let testStats: any = {
      created: examIds.length,
      assigned: 0,
      totalStudentsAssigned: 0,
      submittedByStudents: 0,
      pendingSubmission: 0,
      reviewedByTutor: 0,
      pendingReview: 0,
    };

    if (examIds.length > 0) {
      const assignRows = await this.repository.getExamAssignmentsByExamIds(examIds);
      const assignedExamSet = new Set(assignRows.map((r: any) => r.exam_id));
      testStats.assigned = assignedExamSet.size;
      testStats.totalStudentsAssigned = assignRows.length;

      const submissionRows = await this.repository.getExamSubmissionsByExamIds(examIds);

      if (submissionRows.length) {
        if (submissionRows[0].hasOwnProperty("submitted_at")) {
          testStats.submittedByStudents = submissionRows.filter(
            (r: any) => r.submitted_at != null,
          ).length;
          testStats.pendingSubmission =
            testStats.totalStudentsAssigned - testStats.submittedByStudents;
        }
        testStats.reviewedByTutor = submissionRows.filter(
          (r: any) => r.review_status === "completed",
        ).length;
        testStats.pendingReview =
          testStats.submittedByStudents - testStats.reviewedByTutor;
      }
    }

    const actionItemIds = await this.repository.getActionItemIdsAssignedToReviewer(organizationId, userId);

    const actionStats: any = {
      created: actionItemIds.length,
      assigned: 0,
      totalStudentsAssigned: 0,
      submittedByStudents: 0,
      pendingSubmission: 0,
      reviewedByTutor: 0,
      pendingReview: 0,
    };

    if (actionItemIds.length > 0) {
      const aRows = await this.repository.getAssignedActionItems(organizationId);

      aRows.forEach((r: any) => {
        const ids: string[] = r.action_item_id || [];
        const common = ids.filter((id) => actionItemIds.includes(id));
        if (common.length > 0) {
          actionStats.assigned += common.length; // count of items assigned
          actionStats.totalStudentsAssigned += (r.user_id || []).length;
          if (r.status === "SUBMITTED")
            actionStats.submittedByStudents += (r.user_id || []).length;
          if (r.status === "ASSIGNED")
            actionStats.pendingSubmission += (r.user_id || []).length;
          if (r.status === "APPROVED")
            actionStats.reviewedByTutor += (r.user_id || []).length;
          if (r.status === "SUBMITTED")
            actionStats.pendingReview +=
              (r.user_id || []).length -
              (r.status === "APPROVED" ? (r.user_id || []).length : 0);
        }
      });
    }

    const createdCourses = await this.repository.getCreatedCoursesCount(organizationId, userId, hasCreatedByCourse);
    const tutorCourseIds = await this.repository.getCourseIdsCreatedByTutor(organizationId, userId, hasCreatedByCourse);

    let courseAssignRows = await this.repository.getCourseUserMappings(organizationId);
    
    if (tutorCourseIds.length > 0) {
      courseAssignRows = courseAssignRows.filter((r: any) =>
        (r.course_id || []).some((cid: string) => tutorCourseIds.includes(cid)),
      );
    }

    let assignedCourses = new Set<string>();
    let totalCourseStudents = 0;
    let completedByStudents = 0;

    courseAssignRows.forEach((r: any) => {
      const courseIds: string[] = r.course_id || [];
      courseIds.forEach((cid: string) => assignedCourses.add(cid));
      const studentCount = (r.user_id || []).length;
      totalCourseStudents += studentCount;
    });

    let sectionRows = await this.repository.getSectionUserMappings(organizationId);
    if (tutorCourseIds.length > 0) {
      sectionRows = sectionRows.filter((r: any) =>
        tutorCourseIds.includes(r.course_id),
      );
    }
    const completedSet = new Set<string>();
    sectionRows.forEach((r: any) => {
      if (r.is_completed) {
        const ids: string[] = r.user_id ? [r.user_id] : [];
        ids.forEach((uid: string) => {
          const key = `${r.course_id}_${uid}`;
          if (!completedSet.has(key)) {
            completedSet.add(key);
          }
        });
      }
    });
    completedByStudents = completedSet.size;

    const courseStats = {
      created: createdCourses,
      assigned: assignedCourses.size,
      totalStudentsAssigned: totalCourseStudents,
      completedByStudents,
      pendingCompletion: totalCourseStudents - completedByStudents,
    };

    return {
      profile,
      testProgress: {
        tests: testStats,
        actionItems: actionStats,
        courses: courseStats,
      },
    };
  }
}
