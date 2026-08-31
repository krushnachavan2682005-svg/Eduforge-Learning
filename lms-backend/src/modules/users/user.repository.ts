import { User } from "./user.model";

export class UserRepository {
  async findByEmail(email: string) {
    return User.findOne({
      where: { email: email.trim().toLowerCase(), is_active: true },
      attributes: { exclude: ["password_hash"] },
    });
  }

  async findById(id: string) {
    return User.findOne({
      where: { id, is_active: true },
      attributes: { exclude: ["password_hash"] },
    });
  }
}
