import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import path from "path";
import { asyncLocalStorage } from "../constants/request-context";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
// main database
const sequelize = new Sequelize(
  "eduforge_learning",
  process.env.DB_USER ?? "postgres",
  process.env.DB_PASS ?? "krushna123",
  {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT) ?? 5432,
    dialect: "postgres",
    logging: (sql,timing)=>{
      const store=asyncLocalStorage.getStore();
 
      let timestamp=new Date().toISOString()
      if(store){
        store.queryCount++
      }
     console.log(`[${timestamp}] ${sql}`);    },
  }
);

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(" Connected to main database");
    await sequelize.sync();
    console.log("new tables created succeafully")

  } catch (error: any) {
    console.error(" Database connection failed:", error.message);
  }
};

export { sequelize };
