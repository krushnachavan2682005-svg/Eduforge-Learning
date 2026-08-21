import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { StudentResultsService } from "./studentResults.service";

const service = new StudentResultsService();

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

            const result = await service.getStudentResults(
                storeClientId,
                user_id,
                Number(page),
                Number(limit),
                review_status
            );

            return reply.code(200).send({
                studentName: result.studentName,
                data: result.data,
                pagination: result.pagination,
                message: "Student results fetched successfully",
            });
        } catch (error) {
            req.log.error(error);
            if (error instanceof UnauthorizedError || error instanceof ValidationError) throw error;
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

            const result = await service.getAllResults(
                storeClientId,
                Number(page),
                Number(limit),
                review_status
            );

            return reply.code(200).send({
                data: result.data,
                pagination: result.pagination,
                message: "All student results fetched successfully",
            });
        } catch (error) {
            req.log.error(error);
            if (error instanceof UnauthorizedError) throw error;
            throw new InternalServerError("Failed to fetch all student results");
        }
    }
}
