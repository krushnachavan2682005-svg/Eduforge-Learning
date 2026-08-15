import Fastify from "fastify";
import { connectDB, sequelize } from "./config/database";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fastifyMultipart from "@fastify/multipart";
import s3Plugin from "./plugins/s3-upload-plugins";
import publicExamRoutes from "./routes/publicExam.route";
import jwtPlugin from "./plugins/jwt.plugin";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/user.routes";
import organizationRoutes from "./modules/organizations/organization.routes";
import localDashboardRoutes from "./modules/dashboard/dashboard.routes";
import studentRoutes from "./modules/students/student.routes";
import memberRoutes from "./modules/members/member.routes";
import { seedRbac } from "./modules/rbac/rbac.seed";
import "./modules/roles/role.model";
import "./modules/sessions/session.model";
import './models/model_join_association'
import { asyncLocalStorage as cls} from "./constants/request-context";
export const buildApp = async () => {
  const app = Fastify({ logger: true });
  app.addHook("onRequest",(request,reply,done)=>{
    cls.run({queryCount:0},()=>{
      done()
    })
  })
app.addHook("onResponse",(request,reply,done)=>{
const store=cls.getStore();
if(store){
  reply.header('x-query-count',store.queryCount)
}
done();
})
  await connectDB();
  // Sync Sequelize models with the database
  await sequelize.sync()
  await seedRbac();

  await registerS3Plugin();
  await app.register(jwtPlugin);
  // Swagger Docs
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Credit Portal",
        description: "",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await app.register(fastifyMultipart, {
    attachFieldsToBody: false,
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });

  async function registerS3Plugin() {
    await app.register(s3Plugin, {
      bucketName: process.env.AWS_BUCKET_NAME!,
      region: process.env.AWS_REGION || "ap-south-1",
    });
  }



  const routes = (await import("./routes/index")).default;
  app.register(authRoutes, { prefix: "/auth" });
  app.register(userRoutes, { prefix: "/users" });
  app.register(organizationRoutes, { prefix: "/organizations" });
  app.register(localDashboardRoutes, { prefix: "/dashboard" });
  app.register(studentRoutes);
  app.register(memberRoutes);
  app.register(routes, { prefix: "/eduforge/api" });
  app.register(publicExamRoutes,{prefix:"/eduforge/api"})
  return app;
};
