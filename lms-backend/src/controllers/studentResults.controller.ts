import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { StudentResultsRepository } from "../repositories/studentResults.repository";

const resultsRepo = new StudentResultsRepository();

export class StudentResultsController {
    async getStudentResults(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { user_id } = req.params as { user_id: string };
            const { page = 1, limit = 10, review_status } = req.query as {
                page?: number;
                limit?: number;
                review_status?: string;
            };

            const storeClientId = req.user?.organization_id;
            if (!storeClientId) {
                throw new UnauthorizedError("Tenant context missing");
            }
            if (!user_id) {
                throw new ValidationError("user_id is required");
            }

            const studentName = await resultsRepo.getStudentName(user_id);
            const result = await resultsRepo.getResultsByUserId(
                user_id, 
                Number(page), 
                Number(limit),
                review_status
            );

            return reply.code(200).send({
                studentName,
                data: result.data,
                pagination: result.pagination,
                message: "Student results fetched successfully",
            });
        } catch (error) {
            req.log.error(error);
            throw new InternalServerError("Failed to fetch student results");
        }
    }

    async getAllResults(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { page = 1, limit = 10, review_status } = req.query as {
                page?: number;
                limit?: number;
                review_status?: string;
            };
            
            const storeClientId = req.user?.organization_id;
            if (!storeClientId) {
                throw new UnauthorizedError("Tenant context missing");
            }

            const result = await resultsRepo.getAllResults(
                Number(page), 
                Number(limit),
                review_status
            );

            // Fetch names in bulk for all unique users in these results
            const userIds = [
                ...new Set(result.data.map((r: any) => r.user_id).filter(Boolean)),
            ];
            const nameMap = await resultsRepo.getStudentNamesBulk(userIds as string[]);

            const data = result.data.map((r: any) => ({
                ...r,
                studentName: nameMap[r.user_id] || "",
            }));

            return reply.code(200).send({
                data,
                pagination: result.pagination,
                message: "All student results fetched successfully",
            });
        } catch (error) {
            req.log.error(error);
            throw new InternalServerError("Failed to fetch all student results");
        }
    }
}
