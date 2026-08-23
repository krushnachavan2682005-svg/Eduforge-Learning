import { FastifyReply, FastifyRequest } from "fastify";
import { MemberService } from "./member.service";

const service = new MemberService();

export class MemberController {
  async create(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const member = await service.createMember(
        req.user.organization_id,
        req.body as any,
      );
      return reply.code(201).send({
        success: true,
        data: member,
        message: "Member created successfully",
      });
    } catch (error: any) {
      req.log.error(error);
      return reply.code(error.statusCode || 500).send({
        success: false,
        message: error.message || "Failed to create member",
      });
    }
  }

  async list(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const members = await service.listMembers(
        req.user.organization_id,
        req.query as any,
      );
      return reply.code(200).send({ success: true, data: members });
    } catch (error: any) {
      req.log.error(error);
      return reply
        .code(500)
        .send({ success: false, message: "Failed to fetch members" });
    }
  }

  async get(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const { id } = req.params as { id: string };
      const member = await service.getMember(req.user.organization_id, id);
      if (!member) {
        return reply
          .code(404)
          .send({ success: false, message: "Member not found" });
      }
      return reply.code(200).send({ success: true, data: member });
    } catch (error: any) {
      req.log.error(error);
      return reply
        .code(500)
        .send({ success: false, message: "Failed to fetch member" });
    }
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const { id } = req.params as { id: string };
      const member = await service.updateMember(
        req.user.organization_id,
        id,
        req.body as any,
      );
      if (!member) {
        return reply
          .code(404)
          .send({ success: false, message: "Member not found" });
      }
      return reply.code(200).send({
        success: true,
        data: member,
        message: "Member updated successfully",
      });
    } catch (error: any) {
      req.log.error(error);
      return reply.code(error.statusCode || 500).send({
        success: false,
        message: error.message || "Failed to update member",
      });
    }
  }

  async resetPassword(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const { id } = req.params as { id: string };
      const { password, confirm_password } = req.body as {
        password: string;
        confirm_password?: string;
      };

      const updated = await service.resetPassword(
        req.user.organization_id,
        id,
        {
          password,
          confirm_password,
        },
      );

      if (!updated) {
        return reply
          .code(404)
          .send({ success: false, message: "Member not found" });
      }

      return reply.code(200).send({
        success: true,
        message: "Password updated successfully",
      });
    } catch (error: any) {
      req.log.error(error);
      return reply.code(error.statusCode || 500).send({
        success: false,
        message: error.message || "Failed to update password",
      });
    }
  }

  async deactivate(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const { id } = req.params as { id: string };
      const member = await service.deactivateMember(
        req.user.organization_id,
        id,
      );
      if (!member) {
        return reply
          .code(404)
          .send({ success: false, message: "Member not found" });
      }
      return reply.code(200).send({
        success: true,
        data: member,
        message: "Member deactivated successfully",
      });
    } catch (error: any) {
      req.log.error(error);
      return reply
        .code(500)
        .send({ success: false, message: "Failed to deactivate member" });
    }
  }

  async assignRole(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const { id } = req.params as { id: string };
      const { role_code } = req.body as { role_code: string };
      const member = await service.assignRole(
        req.user.organization_id,
        id,
        role_code,
      );
      if (!member) {
        return reply
          .code(404)
          .send({ success: false, message: "Member not found" });
      }
      return reply.code(200).send({
        success: true,
        data: member,
        message: "Role assigned successfully",
      });
    } catch (error: any) {
      req.log.error(error);
      return reply.code(error.statusCode || 500).send({
        success: false,
        message: error.message || "Failed to assign role",
      });
    }
  }

  async removeRole(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const { id, role_id } = req.params as { id: string; role_id: string };
      const result = await service.removeRole(
        req.user.organization_id,
        id,
        role_id,
      );
      if (!result) {
        return reply
          .code(404)
          .send({ success: false, message: "Member not found" });
      }
      return reply.code(200).send({
        success: true,
        data: result,
        message: "Role removed successfully",
      });
    } catch (error: any) {
      req.log.error(error);
      return reply
        .code(500)
        .send({ success: false, message: "Failed to remove role" });
    }
  }

  async roles(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const roles = await service.listRoles(req.user.organization_id);
    return reply.code(200).send({ success: true, data: roles });
  }

  async permissions(_req: FastifyRequest, reply: FastifyReply) {
    const permissions = await service.listPermissions();
    return reply.code(200).send({ success: true, data: permissions });
  }
}
