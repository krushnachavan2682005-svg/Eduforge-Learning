import { AssiginCourseRepositorie } from "./assignCourse.repositorie";
import { AssiginActionItemsrepositorie } from "./assignActionItems.repositorie";
import { StudentResultsRepository } from "./studentResults.repository";
import { ResumeRepository } from "./resumes.repositorie";
import { sequelize, externalDB } from "../config/database";
import { QueryTypes } from "sequelize";

export class DashboardRepository {
  private courseRepo = new AssiginCourseRepositorie();
  private actionRepo = new AssiginActionItemsrepositorie();
  private resultsRepo = new StudentResultsRepository();

  async getUserDashboard(client_id: string, user_id: string) {
    const [courses, testsResult, actionItems] = await Promise.all([
      this.courseRepo.getCourseByUserId(client_id, user_id),
      this.resultsRepo.getResultsByUserId(user_id, client_id),
      this.actionRepo.getApprovedActionItemsByUserId(user_id, client_id),
    ]);

    const tests = testsResult?.data || [];

    const {
      name: studentName,
      location: studentLocation,
      role: studentRole,
    } = await this.resultsRepo.getStudentName(user_id, client_id);

    const profile = {
      name: studentName || "",
      role: studentRole || "",
      location: studentLocation || "",
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

  async getTutorCounts(client_id: string, user_id: string): Promise<any> {
    // profile section
    let profile: any = { name: "", role: "", location: "" };

    const hasRoleCol: boolean =
      (
        await externalDB.query(
          `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'addmissions'
           AND column_name = 'role'
           AND table_schema = current_schema()`,
          { type: QueryTypes.SELECT },
        )
      ).length > 0;

    const hasLocationCol: boolean =
      (
        await externalDB.query(
          `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'addmissions'
           AND column_name = 'location'
           AND table_schema = current_schema()`,
          { type: QueryTypes.SELECT },
        )
      ).length > 0;

    const selectFields: string[] = ["first_name", "middle_name", "last_name"];
    if (hasLocationCol) selectFields.push("location");
    if (hasRoleCol) selectFields.push("role");

    const row: any[] = await externalDB.query(
      `SELECT ${selectFields.join(", ")}
         FROM addmissions
         WHERE user_id = :userId
           AND client_id = :client_id
         LIMIT 1`,
      {
        replacements: { userId: user_id, client_id },
        type: QueryTypes.SELECT,
      },
    );

    if (!profile?.name) {
      const resumeRepo = new ResumeRepository();
      const resume: any = await resumeRepo.getResumeByUserId(user_id);
      if (resume && resume?.name) {
        profile.name = resume?.name;
      }
    }

    const hasCreatedByExam: boolean =
      (
        await sequelize.query(
          `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'exams'
           AND column_name = 'created_by'
           AND table_schema = current_schema()`,
          { type: QueryTypes.SELECT },
        )
      ).length > 0;

    const hasCreatedByCourse: boolean =
      (
        await sequelize.query(
          `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'courses'
           AND column_name = 'created_by'
           AND table_schema = current_schema()`,
          { type: QueryTypes.SELECT },
        )
      ).length > 0;

    const examsCreatedSql = `
      SELECT id
      FROM exams
      WHERE client_id = :client_id
      ${user_id && hasCreatedByExam ? "AND created_by = :user_id" : ""}
    `;
    const examRows: any[] = await sequelize.query(examsCreatedSql, {
      replacements: { client_id, user_id },
      type: QueryTypes.SELECT,
    });
    const examIds = examRows.map((r) => r?.id);

    let testStats: any = {
      created: examIds?.length,
      assigned: 0,
      totalStudentsAssigned: 0,
      submittedByStudents: 0,
      pendingSubmission: 0,
      reviewedByTutor: 0,
      pendingReview: 0,
    };

    if (examIds.length > 0) {
      const assignRows: any[] = await sequelize.query(
        `SELECT exam_id 
   FROM exam_assignments 
   WHERE exam_id IN (:examIds)`,
        {
          replacements: { examIds },
          type: QueryTypes.SELECT,
        },
      );
      const assignedExamSet = new Set(assignRows.map((r) => r.exam_id));
      testStats.assigned = assignedExamSet.size;
      testStats.totalStudentsAssigned = assignRows.length;

      let submissionRows: any[] = [];
      try {
        submissionRows = await sequelize.query(
          `SELECT submitted_at, review_status 
   FROM exam_user_mappings
   WHERE exam_id IN (:examIds)`,
          {
            replacements: { examIds },
            type: QueryTypes.SELECT,
          },
        );
      } catch (err: any) {
        console.warn(
          "dashboard: fallback exam_user_mappings query",
          err.message,
        );
        try {
          submissionRows = await sequelize.query(
            `SELECT review_status
    FROM exam_user_mappings
    WHERE exam_id IN (:examIds)`,
            { replacements: { examIds }, type: QueryTypes.SELECT },
          );
        } catch (err2: any) {
          console.error("dashboard: failed secondary query", err2.message);
          submissionRows = [];
        }
      }

      if (submissionRows.length) {
        if (submissionRows[0].hasOwnProperty("submitted_at")) {
          testStats.submittedByStudents = submissionRows.filter(
            (r) => r.submitted_at != null,
          ).length;
          testStats.pendingSubmission =
            testStats.totalStudentsAssigned - testStats.submittedByStudents;
        }
        testStats.reviewedByTutor = submissionRows.filter(
          (r) => r.review_status === "completed",
        ).length;
        testStats.pendingReview =
          testStats.submittedByStudents - testStats.reviewedByTutor;
      }
    }

    let actionItemIds: string[] = [];
    if (user_id) {
      const ids: any[] = await sequelize.query(
        `SELECT id FROM action_items
         WHERE client_id = :client_id
           AND reviewer @> :userFilter::jsonb`,
        {
          replacements: {
            client_id,
            userFilter: JSON.stringify([{ id: user_id }]),
          },
          type: QueryTypes.SELECT,
        },
      );
      actionItemIds = ids.map((r) => r.id);
    }

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
      const aRows: any[] = await sequelize.query(
        `SELECT action_item_id, user_id, status FROM assigned_action_items
         WHERE client_id = :client_id`,
        { replacements: { client_id }, type: QueryTypes.SELECT },
      );

      aRows.forEach((r) => {
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

    // use pre-computed hasCreatedByCourse
    const courseCountRow: any[] = await sequelize.query(
      `SELECT COUNT(*) as cnt FROM courses WHERE client_id = :client_id
           ${user_id && hasCreatedByCourse ? "AND created_by = :user_id" : ""}`,
      { replacements: { client_id, user_id }, type: QueryTypes.SELECT },
    );
    const createdCourses = Number(courseCountRow[0]?.cnt || 0);

    // restrict to courses created by tutor if supplied
    let tutorCourseIds: string[] = [];
    if (user_id && hasCreatedByCourse) {
      const courseRows: any[] = await sequelize.query(
        `SELECT id FROM courses
               WHERE client_id = :client_id
               AND created_by = :user_id`,
        { replacements: { client_id, user_id }, type: QueryTypes.SELECT },
      );
      tutorCourseIds = courseRows.map((r) => r.id);
    }

    let courseAssignRows: any[] = await sequelize.query(
      `SELECT course_id, user_id
       FROM course_user_mapping
       WHERE client_id = :client_id`,
      { replacements: { client_id }, type: QueryTypes.SELECT },
    );
    if (tutorCourseIds.length > 0) {
      courseAssignRows = courseAssignRows.filter((r) =>
        (r.course_id || []).some((cid: string) => tutorCourseIds.includes(cid)),
      );
    }

    let assignedCourses = new Set<string>();
    let totalCourseStudents = 0;
    let completedByStudents = 0;

    courseAssignRows.forEach((r) => {
      const courseIds: string[] = r.course_id || [];
      courseIds.forEach((cid) => assignedCourses.add(cid));

      const studentCount = (r.user_id || []).length;
      totalCourseStudents += studentCount;
    });

    // count unique student-course completions via section_user_mapping
    try {
      let sectionRows: any[] = await sequelize.query(
        `SELECT course_id, user_id, is_completed
         FROM section_user_mapping
         WHERE client_id = :client_id`,
        { replacements: { client_id }, type: QueryTypes.SELECT },
      );
      if (tutorCourseIds.length > 0) {
        sectionRows = sectionRows.filter((r) =>
          tutorCourseIds.includes(r.course_id),
        );
      }
      const completedSet = new Set<string>();
      sectionRows.forEach((r) => {
        if (r.is_completed) {
          const ids: string[] = r.user_id ? [r.user_id] : [];
          ids.forEach((uid) => {
            const key = `${r.course_id}_${uid}`;
            if (!completedSet.has(key)) {
              completedSet.add(key);
            }
          });
        }
      });
      completedByStudents = completedSet.size;
    } catch (err: any) {
      console.warn("dashboard: section_user_mapping query failed", err.message);
    }

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
