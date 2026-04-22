import { FastifyReply, FastifyRequest } from "fastify";
import { StudentResultsRepository } from "../repositories/studentResults.repository";

const resultsRepo = new StudentResultsRepository();

export class StudentResultsController {
    async getStudentResults(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { user_id } = req.params as { user_id: string };
            const { client_id } = req.params as { client_id: string };
            const { page = 1, limit = 10, review_status } = req.query as {
                page?: number;
                limit?: number;
                review_status?: string;
            };

            if (!user_id || !client_id) {
                return reply
                    .code(400)
                    .send({ message: "user_id and client_id are required" });
            }

            const studentName = await resultsRepo.getStudentName(user_id, client_id);
            const result = await resultsRepo.getResultsByUserId(
                user_id, 
                client_id, 
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
            return reply.status(500).send({
                message: "Failed to fetch student results",
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async getAllResults(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { client_id } = req.params as { client_id: string };
            const { page = 1, limit = 10, review_status } = req.query as {
                page?: number;
                limit?: number;
                review_status?: string;
            };

            if (!client_id) {
                return reply.code(400).send({ message: "client_id is required" });
            }

            const result = await resultsRepo.getAllResults(
                client_id, 
                Number(page), 
                Number(limit),
                review_status
            );

            // Fetch names in bulk for all unique users in these results
            const userIds = [
                ...new Set(result.data.map((r: any) => r.user_id).filter(Boolean)),
            ];
            const nameMap = await resultsRepo.getStudentNamesBulk(userIds, client_id);

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
            return reply.status(500).send({
                message: "Failed to fetch all student results",
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
