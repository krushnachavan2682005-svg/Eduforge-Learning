import { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service";
import { RbacService } from "../rbac/rbac.service";

interface RegisterBody {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  organization_name?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

const authService = new AuthService();
const rbacService = new RbacService();

export class AuthController {
  async register(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as RegisterBody;
      const data = await authService.register(
        {
          ...body,
          user_agent: req.headers["user-agent"] || null,
          ip_address: req.ip || null,
        },
        req.server,
      );

      return reply.code(201).send({
        success: true,
        message: "User registered successfully",
        data,
      });
    } catch (error: any) {
      req.log.error(error);
      return reply.code(error.statusCode || 500).send({
        success: false,
        message: error.message || "Failed to register user",
      });
    }
  }

  async login(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as LoginBody;
      const data = await authService.login(
        {
          ...body,
          user_agent: req.headers["user-agent"] || null,
          ip_address: req.ip || null,
        },
        req.server,
      );

      return reply.code(200).send({
        success: true,
        message: "Logged in successfully",
        data,
      });
    } catch (error: any) {
      req.log.error(error);
      return reply.code(error.statusCode || 500).send({
        success: false,
        message: error.message || "Failed to login",
      });
    }
  }

  async me(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) {
        return reply.code(401).send({
          success: false,
          message: "Authentication required",
        });
      }

      const data = await authService.me(req.user.sub, req.user.organization_id);
      return reply.code(200).send({
        success: true,
        data,
      });
    } catch (error: any) {
      req.log.error(error);
      return reply.code(error.statusCode || 500).send({
        success: false,
        message: error.message || "Failed to fetch authenticated user",
      });
    }
  }

  async permissions(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) {
        return reply.code(401).send({
          success: false,
          message: "Authentication required",
        });
      }

      const [roles, permissions, permissionsVersion] = await Promise.all([
        rbacService.getUserRoles(req.user.sub, req.user.organization_id),
        rbacService.getUserPermissions(req.user.sub, req.user.organization_id),
        rbacService.getPermissionsVersion(req.user.sub, req.user.organization_id),
      ]);

      return reply.code(200).send({
        success: true,
        data: {
          organization_id: req.user.organization_id,
          roles: roles.map((role: any) => ({
            id: role.id,
            code: role.code,
            name: role.name,
          })),
          permissions: permissions.map((permission: any) => ({
            id: permission.id,
            code: permission.code,
            name: permission.name,
            description: permission.description,
          })),
          permission_codes: permissions.map((permission: any) => permission.code),
          permissions_version: permissionsVersion,
        },
      });
    } catch (error: any) {
      req.log.error(error);
      return reply.code(error.statusCode || 500).send({
        success: false,
        message: error.message || "Failed to fetch permissions",
      });
    }
  }
}
