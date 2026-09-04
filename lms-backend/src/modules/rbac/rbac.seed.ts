import { PermissionRepository } from "./permission.repository";
import { RoleRepository } from "./role.repository";
import { OrganizationUser } from "../roles/role.model";
import { UserRole } from "./user-role.model";
import "./role-permission.model";
import "./user-role.model";

const permissions = [
  ["LMS_VIEW", "View LMS"],
  ["LMS_CREATE", "Create LMS records"],
  ["LMS_UPDATE", "Update LMS records"],
  ["LMS_DELETE", "Delete LMS records"],
  ["LMS_R", "Legacy LMS read"],
  ["LMS_C", "Legacy LMS create"],
  ["LMS_U", "Legacy LMS update"],
  ["LMS_D", "Legacy LMS delete"],
  ["LMS_AI", "Legacy LMS AI access"],
  ["LMS_ML", "Legacy my learning access"],
  ["LMS_CT", "Legacy tests access"],
  ["LMS_L", "Legacy list access"],
  ["LMS_LB", "Legacy leaderboard access"],
  ["LMS_CS", "Legacy credit score access"],
  ["COURSE_CREATE", "Create courses"],
  ["COURSE_UPDATE", "Update courses"],
  ["COURSE_DELETE", "Delete courses"],
  ["COURSE_ASSIGN", "Assign courses"],
  ["EXAM_CREATE", "Create exams"],
  ["EXAM_UPDATE", "Update exams"],
  ["EXAM_DELETE", "Delete exams"],
  ["EXAM_ASSIGN", "Assign exams"],
  ["STUDENT_VIEW", "View students"],
  ["STUDENT_CREATE", "Create students"],
  ["CLASS_CREATE", "Create classes"],
  ["CLASS_UPDATE", "Update classes"],
  ["ENROLLMENT_CREATE", "Create enrollments"],
  ["ENROLLMENT_UPDATE", "Update enrollments"],
  ["MEMBER_VIEW", "View organization members"],
  ["MEMBER_CREATE", "Create organization members"],
  ["MEMBER_UPDATE", "Update organization members"],
  ["MEMBER_DELETE", "Deactivate organization members"],
  ["ROLE_ASSIGN", "Assign roles to members"],
  ["ACTION_ITEM_ASSIGN", "Assign action items"],
  ["AI_ACCESS", "Access AI features"],
  ["ORG_ADMIN", "Manage organization"],
  ["AI_DOCUMENT_CREATE", "Create Student AI Documents"],
  ["AI_DOCUMENT_VIEW", "View Student AI Documents"],
  ["AI_DOCUMENT_DELETE", "Delete Student AI Documents"],
] as const;

const rolePermissions: Record<string, string[]> = {
  super_admin: permissions.map(([code]) => code),
  organization_admin: permissions.map(([code]) => code),
  teacher: [
    "LMS_VIEW",
    "LMS_R",
    "LMS_C",
    "LMS_U",
    "LMS_AI",
    "LMS_ML",
    "LMS_CT",
    "LMS_L",
    "LMS_LB",
    "LMS_CS",
    "COURSE_CREATE",
    "COURSE_UPDATE",
    "COURSE_ASSIGN",
    "EXAM_CREATE",
    "EXAM_UPDATE",
    "EXAM_ASSIGN",
    "STUDENT_VIEW",
    "STUDENT_CREATE",
    "CLASS_CREATE",
    "CLASS_UPDATE",
    "ENROLLMENT_CREATE",
    "ENROLLMENT_UPDATE",
    "MEMBER_VIEW",
    "ACTION_ITEM_ASSIGN",
    "AI_ACCESS",
  ],
  student: [
    "LMS_VIEW",
    "LMS_R",
    "LMS_ML",
    "LMS_CT",
    "AI_DOCUMENT_CREATE",
    "AI_DOCUMENT_VIEW",
    "AI_DOCUMENT_DELETE",
  ],
  reviewer: ["LMS_VIEW", "LMS_R", "EXAM_UPDATE", "STUDENT_VIEW"],
};

const roleNames: Record<string, string> = {
  super_admin: "Super Admin",
  organization_admin: "Organization Admin",
  teacher: "Teacher",
  student: "Student",
  reviewer: "Reviewer",
};

export async function seedRbac() {
  const permissionRepository = new PermissionRepository();
  const roleRepository = new RoleRepository();

  const permissionByCode = new Map<string, string>();
  for (const [code, name] of permissions) {
    const permission = await permissionRepository.findOrCreate({ code, name });
    permissionByCode.set(permission.code, permission.id);
  }

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissions)) {
    const role = await roleRepository.findOrCreateRole({
      code: roleCode,
      name: roleNames[roleCode] || roleCode,
      is_system_role: true,
    });

    for (const permissionCode of permissionCodes) {
      const permissionId = permissionByCode.get(permissionCode);
      if (permissionId) {
        await roleRepository.assignPermission(role.id, permissionId);
      }
    }
  }

  await backfillUserRoles(roleRepository);
}

async function backfillUserRoles(roleRepository: RoleRepository) {
  const memberships = await OrganizationUser.findAll({
    where: { is_active: true },
  });

  for (const membership of memberships) {
    const roleCode =
      membership.role === "student"
        ? "student"
        : membership.role === "tutor"
          ? "teacher"
          : "organization_admin";
    const role = await roleRepository.findRoleByCode(
      roleCode,
      membership.organization_id,
    );

    if (!role) continue;

    await UserRole.findOrCreate({
      where: {
        user_id: membership.user_id,
        organization_id: membership.organization_id,
        role_id: role.id,
      },
      defaults: {
        user_id: membership.user_id,
        organization_id: membership.organization_id,
        role_id: role.id,
      },
    });
  }
}
