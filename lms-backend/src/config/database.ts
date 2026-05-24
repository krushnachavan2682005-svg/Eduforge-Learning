import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
// main database
const sequelize = new Sequelize(
  process.env.DB_NAME ?? "baap_lms_dev",
  process.env.DB_USER ?? "postgres",
  process.env.DB_PASS ?? "krushna123",
  {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT) ?? 5432,
    dialect: "postgres",
    logging: false,
  }
);

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(" Connected to main database");
  } catch (error: any) {
    console.error(" Database connection failed:", error.message);
  }
};

export { sequelize };
