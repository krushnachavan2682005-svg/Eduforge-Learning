import { Permission } from "./permission.model";

export class PermissionRepository {
  async findByCode(code: string) {
    return Permission.findOne({ where: { code: code.trim().toUpperCase() } });
  }

  async findOrCreate(input: {
    code: string;
    name: string;
    description?: string | null;
  }) {
    const [permission] = await Permission.findOrCreate({
      where: { code: input.code.trim().toUpperCase() },
      defaults: {
        code: input.code.trim().toUpperCase(),
        name: input.name,
        description: input.description || null,
      },
    });

    return permission;
  }
}
