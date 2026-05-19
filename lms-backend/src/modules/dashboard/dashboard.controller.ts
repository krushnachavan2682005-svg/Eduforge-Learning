import { FastifyReply, FastifyRequest } from "fastify";
import { AuthRepository } from "../auth/auth.repository";
import { StudentRepository } from "../students/student.repository";

const authRepository = new AuthRepository();
const studentRepository = new StudentRepository();

export class LocalDashboardController {
  async me(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) {
        return reply.code(401).send({
          success: false,
          message: "Authentication required",
        });
      }

      const membership = await authRepository.findUserContext(
        req.user.sub,
        req.user.organization_id,
      );

      if (!membership) {
        return reply.code(404).send({
          success: false,
          message: "Dashboard context was not found",
        });
      }

      const user = (membership as any).user;
      const organization = (membership as any).organization;
      const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
      const counts = await studentRepository.getDashboardCounts(
        req.user.organization_id,
      );

      return reply.code(200).send({
        success: true,
        data: {
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
        },
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to fetch dashboard",
      });
    }
  }
}
