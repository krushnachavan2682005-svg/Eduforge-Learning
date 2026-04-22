import { FastifyInstance } from "fastify";
import { StudentResultsController } from "../controllers/studentResults.controller";
import { verifyToken } from "../utils/auth";

const studentResultsController = new StudentResultsController();

// Pagination and filter schema
const paginationSchema = {
    querystring: {
        type: "object",
        properties: {
            page: {
                type: "number",
                minimum: 1,
                default: 1,
                description: "Page number for pagination"
            },
            limit: {
                type: "number",
                minimum: 1,
                maximum: 100,
                default: 10,
                description: "Number of records per page"
            },
            review_status: {
                type: "string",
                enum: ["completed"],
                description: "Filter by review status (only 'completed' is supported)"
            }
        }
    }
};

export default async function studentResultsRoutes(fastify: FastifyInstance) {
    fastify.get(
        "/get-all-results",
        { 
            preHandler: verifyToken,
            schema: paginationSchema
        },
        (req, reply) => studentResultsController.getAllResults(req, reply)
    );

    fastify.get(
        "/get-student-results/:user_id",
        { 
            preHandler: verifyToken,
            schema: paginationSchema
        },
        (req, reply) => studentResultsController.getStudentResults(req, reply)
    );
}
