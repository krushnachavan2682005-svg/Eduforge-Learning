import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../utils/globalErrorHandlingFile";
import { AssignedActionItemsModel } from "../models/assignActionItems.model";
import { AssiginActionItemsrepositorie } from "../repositories/assignActionItems.repositorie";
import { FastifyReply, FastifyRequest } from "fastify";
import { Op, QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { StudentRepository } from "../modules/students/student.repository";
import { OrganizationUser } from "../modules/roles/role.model";

const repositorie = new AssiginActionItemsrepositorie();
const studentRepository = new StudentRepository();

export class AssiginActionItemsController {
  async createAssiginCourse(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client, action_item_id, user_id, class_id } = req.body as {
        client?: string;
        action_item_id: string[];
        user_id?: string[];
        class_id?: string | string[];
      };

      if (!action_item_id?.length) {
        throw new ValidationError("action_item_id is required");
      }

      const classIds: string[] = class_id
        ? Array.isArray(class_id)
          ? class_id
          : [class_id]
        : [];

      let resolvedClientId: string | null = req.user?.organization_id || null;
      let newAssignments = 0;

      // Assign to specific users
      if (user_id?.length) {
        if (!resolvedClientId) {
          resolvedClientId = await repositorie.getClientIdByUserId(user_id[0]);
        }
        if (!resolvedClientId)
          throw new ValidationError("Invalid user_id");

        const validMembers = await OrganizationUser.findAll({
          where: {
            organization_id: resolvedClientId,
            user_id: { [Op.in]: user_id },
            is_active: true
          }
        });
        if (validMembers.length !== user_id.length) {
          throw new ValidationError("One or more users do not belong to this organization or are inactive.");
        }

        for (const user of user_id) {
          for (const itemId of action_item_id) {
            const exists = await AssignedActionItemsModel.findOne({
              where: {
                organization_id: resolvedClientId,
                user_id: { [Op.contains]: [user] },
                action_item_id: { [Op.contains]: [itemId] },
              },
            });
            if (!exists) {
              await repositorie.createAssignCourse({
                action_item_id: [itemId],
                user_id: [user],
                organization_id: resolvedClientId,
                status: "ASSIGNED",
              });
              newAssignments++;
            }
          }
        }
      }

      // Assign to users by class
      if (classIds.length) {
        for (const cid of classIds) {
          const classClientId =
            resolvedClientId || (await repositorie.getClientIdByClassId(cid));
          if (!classClientId) {
            throw new ValidationError(`Invalid or unknown class_id: ${cid}`);
          }
          resolvedClientId = classClientId;

          const classUsers = await repositorie.getUsersByClassId(
            cid,
            classClientId,
          );
          if (!classUsers.length) {
            throw new ValidationError(`No students found for class_id: ${cid}`);
          }

          for (const user of classUsers) {
            for (const itemId of action_item_id) {
              const exists = await AssignedActionItemsModel.findOne({
                where: {
                  organization_id: classClientId,
                  class_id: cid,
                  user_id: { [Op.contains]: [user] },
                  action_item_id: { [Op.contains]: [itemId] },
                },
              });
              if (!exists) {
                await repositorie.createAssignCourse({
                  action_item_id: [itemId],
                  user_id: [user],
                  class_id: cid,
                  organization_id: classClientId,
                  status: "ASSIGNED",
                });
                newAssignments++;
              }
            }
          }
        }
      }

      // Assign to all users of client if no specific user/class
      if (!user_id?.length && !classIds.length) {
        if (!client)
          throw new ValidationError("client is required for organization assignment");

        const clientUsers = await repositorie.getUsersByClientId(client);
        for (const user of clientUsers) {
          for (const itemId of action_item_id) {
            const exists = await AssignedActionItemsModel.findOne({
              where: {
                organization_id: client,
                user_id: { [Op.contains]: [user] },
                action_item_id: { [Op.contains]: [itemId] },
              },
            });
            if (!exists) {
              await repositorie.createAssignCourse({
                action_item_id: [itemId],
                user_id: [user],
                organization_id: client,
                status: "ASSIGNED",
              });
              newAssignments++;
            }
          }
        }
      }

      return reply.code(201).send({
        message: newAssignments
          ? "Action items assigned successfully"
          : "Action item already assigned",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to assign action items");
    }
  }

  // Get assigned action items
  async getAssignedActionItems(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id } = req.params as { user_id: string };
      const { class_id } = req.query as { class_id?: string };

      if (!user_id)
        throw new ValidationError("user_id is required");

      const assignedRecords = await AssignedActionItemsModel.findAll({
        where: {
          user_id: { [Op.contains]: [user_id] },
          ...(class_id && { class_id }),
        },
      });

      if (!assignedRecords.length) {
        return reply
          .code(200)
          .send({ data: [], message: "No action items assigned" });
      }

      const organization_id = assignedRecords[0].organization_id;

      const actionItems = await repositorie.getActionItemsByUserId(
        organization_id,
        user_id,
        class_id,
      );

      return reply.code(200).send({
        data: actionItems,
        message: "Action items fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch assigned action items");
    }
  }

  async updateAssignedActionStatus(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id } = req.params as { user_id: string };

      const {
        assigned_action_item_id,
        status,
        notes,
        comment,
        attachment,
        score,
      } = req.body as {
        assigned_action_item_id: string;
        status: "ASSIGNED" | "SUBMITTED" | "APPROVED" | "REJECTED";
        comment?: string;
        notes?: string;
        attachment?: string[];
        score?: number;
      };

      if (!user_id) {
        throw new ValidationError("user_id is required in URL");
      }

      if (!assigned_action_item_id) {
        throw new ValidationError("assigned_action_item_id is required");
      }

      if (!status) {
        throw new ValidationError("status is required");
      }
      
      const storeClientId = req.user?.organization_id;

      // Record check (user_id + assigned_action_item_id)
      const record = await AssignedActionItemsModel.findOne({
        where: storeClientId ? {
          id: assigned_action_item_id,
          user_id: { [Op.contains]: [user_id] },
          organization_id: storeClientId
        } : {
          id: assigned_action_item_id,
          user_id: { [Op.contains]: [user_id] },
        },
      });

      if (!record) {
        throw new NotFoundError("Assigned action item not found for this user");
      }

      const finalAttachments = Array.isArray(attachment) ? attachment : [];

      if (status === "REJECTED" && (!comment || comment.trim() === "")) {
        throw new ValidationError("Comment is required when rejecting");
      }

      const updateData: any = {
        status,
        updated_at: new Date(),
      };

      if (status === "APPROVED") {
        updateData.score = score;
      }

      if (comment !== undefined) updateData.comment = comment ?? null;
      if (notes !== undefined) updateData.notes = notes ?? null;
      if (attachment !== undefined) updateData.attachment = finalAttachments;

      await AssignedActionItemsModel.update(updateData, {
        where: {
          id: assigned_action_item_id,
        },
      });

      return reply.code(200).send({
        message: "Status updated successfully",
        data: {
          user_id,
          assigned_action_item_id,
          status,
          notes: notes !== undefined ? (notes ?? null) : record?.notes,
          score: status === "APPROVED" ? score : null,
          comment: comment !== undefined ? (comment ?? null) : record?.comment,
          attachment:
            attachment !== undefined ? finalAttachments : record?.attachment,
        },
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to update assigned action item");
    }
  }

  // GET - Get attachments for a specific assigned action item
  async getAttachments(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        throw new ValidationError("id is required in URL params");
      }

      const existingRecord = await AssignedActionItemsModel.findOne({
        where: {
          id: id,
        },
        attributes: ["id", "attachment"],
      });

      if (!existingRecord) {
        throw new NotFoundError("Assigned action item not found");
      }

      const attachmentKeys: string[] = existingRecord.attachment || [];

      return reply.code(200).send({
        data: {
          id: existingRecord.id,
          attachment: attachmentKeys,
          count: attachmentKeys.length,
        },
        message: "Attachments fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch attachments");
    }
  }

  // PUT - Update attachments (add/replace)
  async updateAttachments(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const { attachment, action } = req.body as {
        attachment: string[];
        action?: "add" | "replace";
      };

      if (!id) {
        throw new ValidationError("id is required in URL params");
      }

      if (
        !attachment ||
        !Array.isArray(attachment) ||
        attachment.length === 0
      ) {
        throw new ValidationError("attachment array is required and must not be empty");
      }

      // First check if the record exists
      const existingRecord = await AssignedActionItemsModel.findOne({
        where: {
          id: id,
        },
      });

      if (!existingRecord) {
        throw new NotFoundError("Assigned action item not found");
      }

      // Get existing attachments array or initialize empty array
      const existingAttachmentKeys: string[] = existingRecord?.attachment || [];
      let updatedAttachmentKeys: string[];

      // Handle different actions
      if (action === "replace") {
        // Replace entire array with new keys
        updatedAttachmentKeys = attachment;
      } else {
        // Default: add new keys to existing array (avoid duplicates)
        updatedAttachmentKeys = [...existingAttachmentKeys];
        attachment.forEach((key) => {
          if (!updatedAttachmentKeys.includes(key)) {
            updatedAttachmentKeys.push(key);
          }
        });
      }

      const [updatedCount] = await AssignedActionItemsModel.update(
        {
          attachment: updatedAttachmentKeys,
        },
        {
          where: {
            id: id,
          },
        },
      );

      if (updatedCount === 0) {
        throw new NotFoundError("Assigned action item not found or could not be updated");
      }

      return reply.code(200).send({
        message:
          action === "replace"
            ? "Attachments replaced successfully"
            : "Attachments added successfully",
        data: {
          attachments: updatedAttachmentKeys,
          count: updatedAttachmentKeys.length,
        },
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to update attachments");
    }
  }

  // DELETE - Delete specific attachments
  async deleteAttachments(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const { delete_keys } = req.body as {
        delete_keys: string[];
      };

      if (!id) {
        throw new ValidationError("id is required in URL params");
      }

      if (
        !delete_keys ||
        !Array.isArray(delete_keys) ||
        delete_keys.length === 0
      ) {
        throw new ValidationError("delete_keys array is required and must not be empty");
      }

      // First check if the record exists
      const existingRecord = await AssignedActionItemsModel.findOne({
        where: {
          id: id,
        },
      });

      if (!existingRecord) {
        throw new NotFoundError("Assigned action item not found");
      }

      // Get existing attachments array
      const existingAttachmentKeys: string[] = existingRecord?.attachment || [];

      if (existingAttachmentKeys.length === 0) {
        throw new ValidationError("No attachments found to delete");
      }

      // Remove specified keys from array
      const updatedAttachmentKeys = existingAttachmentKeys.filter(
        (key) => !delete_keys.includes(key),
      );

      // Check if any keys were actually deleted
      if (updatedAttachmentKeys.length === existingAttachmentKeys.length) {
        throw new ValidationError("None of the specified keys were found in attachments");
      }

      const [updatedCount] = await AssignedActionItemsModel.update(
        {
          attachment: updatedAttachmentKeys,
        },
        {
          where: {
            id: id,
          },
        },
      );

      if (updatedCount === 0) {
        throw new NotFoundError("Assigned action item not found or could not be updated");
      }

      return reply.code(200).send({
        message: "Attachments deleted successfully",
        data: {
          deleted_keys: delete_keys.filter((key) =>
            existingAttachmentKeys.includes(key),
          ),
          remaining_attachments: updatedAttachmentKeys,
          remaining_count: updatedAttachmentKeys.length,
        },
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to delete attachments");
    }
  }

  async publishAssignedItem(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { assigned_id, assignment_id, user_id, publish } = req.body as {
        assigned_id: string;
        assignment_id: string;
        user_id: string;
        publish: boolean;
      };

      if (!assigned_id || !assignment_id || !user_id) {
        throw new ValidationError("assigned_id, assignment_id and user_id are required");
      }

      const assignedRecord = await AssignedActionItemsModel.findOne({
        where: { id: assigned_id },
      });

      if (assignedRecord) {
        await repositorie.logPublishEvent({
          assigned_id,
          assignment_id,
          user_id,
          publish,
        });
      } else {
        const { ExamAssignment } = await import("../models/exam.model");
        const examRecord = await ExamAssignment.findOne({
          where: { id: assigned_id },
        });
        if (!examRecord) {
          throw new NotFoundError("Assigned record not found");
        }

        const { ExamRepository } =
          await import("../repositories/exam.repository");
        const examRepo = new ExamRepository();
        await examRepo.logExamPublishEvent({
          assigned_id,
          assignment_id,
          user_id,
          publish,
        });
      }

      return reply.code(201).send({
        message: "Publish status recorded",
        data: { assigned_id, assignment_id, publish },
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to record publish status");
    }
  }

  async getAssignedPublishTimeline(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id } = req.params as { user_id?: string };
      const publishOnly = !user_id;

      // fetch both action-item and exam timelines
      const rawAction = await repositorie.getPublishTimelineByUser(
        user_id,
        publishOnly,
      );

      // lazily import exam repository to avoid circular deps
      const { ExamRepository } =
        await import("../repositories/exam.repository");
      const examRepo = new ExamRepository();
      const rawExam = await examRepo.getExamPublishTimelineByUser(
        user_id,
        publishOnly,
      );

      let rawTimeline = [...rawAction, ...rawExam];
      // ensure newest entries appear first regardless of type
      rawTimeline.sort((a: any, b: any) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (db !== da) return db - da;
        if (b.id && a.id) {
          return b.id.localeCompare(a.id);
        }
        return 0;
      });

      // build a map of user_id -> student name by fetching all unique users
      let studentNameMap: Record<string, string> = {};
      if (rawTimeline.length) {
        const uniqueUserIds = [
          ...new Set(rawTimeline.map((item: any) => item.user_id)),
        ];
        const orgId = req.user?.organization_id as string;
        if (!orgId) throw new Error("Tenant context missing");
        studentNameMap = await studentRepository.getStudentNamesByUserIds(
          orgId,
          uniqueUserIds,
        );
      }

      const timeline = rawTimeline.map((item: any) => {
        if (item.task_name !== undefined) {
          return {
            studentName: studentNameMap[item.user_id] || "",
            type: "Action Item",
            title: item.task_name || "",
            description: item.description || "",
            date: item.created_at
              ? item.created_at.toISOString().split("T")[0]
              : null,
            level: item.level || "",
            marks:
              item.score !== null && item.total_score
                ? `${item.score}/${item.total_score}`
                : "",
            status: item.status || "",
            notes: item.notes || "",
            comment: item.comment || "",
            attachment: item.attachment || [],
            raw: item,
          };
        } else {
          // exam entry
          return {
            studentName: studentNameMap[item.user_id] || "",
            type: "Exam",
            title: item.title || "",
            description: item.subject || "",
            date: item.created_at
              ? item.created_at.toISOString().split("T")[0]
              : null,
            marks: item?.total_marks ? `${item?.total_marks}` : "",
            raw: item,
          };
        }
      });

      return reply.code(200).send({
        data: timeline,
        message: "Publish timeline fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch publish timeline");
    }
  }

  async getApprovedActionItemsByLevel(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { user_id } = req.params as { user_id: string; };
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new Error("Tenant context missing");

      if (!user_id || !organization_id) {
        throw new ValidationError("user_id and organization_id are required");
      }

      const rawItems = await repositorie.getApprovedActionItemsByUserId(
        user_id
      );
      if (!rawItems.length) {
        return reply.code(200).send({
          levels: [],
          data: [],
          message: "No approved action items found",
        });
      }

      // Group by level
      const groupedMap = new Map<string, any>();

      rawItems.forEach((item) => {
        const levelName = item?.level || "";

        if (!groupedMap.has(levelName)) {
          groupedMap.set(levelName, {
            level: levelName,
            start_date: item?.start_date,
            end_date: item?.end_date,
            obtained_score: 0,
            action_items: [],
          });
        }

        const group = groupedMap.get(levelName);
        group.action_items.push({
          id: item?.id,
          task_name: item?.task_name,
          total_score: item?.total_score,
          score: item?.score,
          status: item?.status,
        });

        // Add to obtained score if score exists
        if (item.score) {
          group.obtained_score += item.score;
        }
      });

      const levels = Array.from(groupedMap.keys());
      const data = Array.from(groupedMap.values());

      return reply.code(200).send({
        levels,
        data,
        message: "Approved action items fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch approved action items");
    }
  }

  async getApprovedActionItemsForTutor(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new Error("Tenant context missing");

      if (!organization_id) {
        throw new ValidationError("organization_id is required");
      }

      const rawItems =
        await repositorie.getApprovedActionItemsWithStudentName();

      if (!rawItems.length) {
        return reply.code(200).send({
          levels: [],
          data: [],
          message: "No approved action items found",
        });
      }

      const levelMap = new Map<string, any>();

      rawItems.forEach((item) => {
        if (!levelMap.has(item?.level)) {
          levelMap.set(item?.level, {
            level: item?.level,
            start_date: item?.start_date,
            end_date: item?.end_date,
            students: new Map<string, any>(),
          });
        }

        const levelGroup = levelMap.get(item?.level);

        if (!levelGroup.students.has(item?.user_id)) {
          levelGroup.students.set(item?.user_id, {
            user_id: item?.user_id,
            student_name: item?.student_name,
            obtained_score: 0,
            action_items: [],
          });
        }

        const student = levelGroup.students.get(item?.user_id);

        student.action_items.push({
          id: item?.assigned_id,
          task_name: item?.task_name,
          total_score: item?.total_score,
          score: item?.score,
          status: item?.status,
        });

        if (item.score) {
          student.obtained_score += item?.score;
        }
      });

      const data = Array.from(levelMap.values()).map((lvl) => ({
        level: lvl?.level,
        start_date: lvl?.start_date,
        end_date: lvl?.end_date,
        total_score: lvl?.total_score,
        students: Array.from(lvl?.students?.values()),
      }));

      return reply.code(200).send({
        levels: data.map((d) => d.level),
        data,
        message:
          "Approved action items with student names fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch tutor approved action items");
    }
  }
}
