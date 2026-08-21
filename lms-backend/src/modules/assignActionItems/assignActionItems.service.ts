import { NotFoundError, ValidationError } from "../../utils/globalErrorHandlingFile";
import { AssiginActionItemsrepositorie } from "./assignActionItems.repository";

import { StudentRepository } from "../students/student.repository";

export class AssignActionItemsService {
  private readonly repository = new AssiginActionItemsrepositorie();
  private readonly studentRepository = new StudentRepository();

  constructor() {}

  async getAssignedActionItems(organizationId: string, userId: string, classId?: string) {
    // We maintain the existing query count/shape:
    // 1 query to find the first record for this user to extract the org ID if not provided?
    // Wait, the prompt says "organizationId must flow explicitly: Controller -> Service -> Repository".
    // If the controller has it, we just pass it. But we must still run the exact same query if we are not to optimize or change queries.
    // Actually, the controller ran `AssignedActionItemsModel.findAll` to get `organization_id` if we didn't have it.
    // We'll run it just to keep query counts identical.
    
    // Original code:
    const { AssignedActionItemsModel } = await import("./assignActionItems.model");
    const { Op } = await import("sequelize");
    const assignedRecords = await AssignedActionItemsModel.findAll({
      where: {
        user_id: { [Op.contains]: [userId] },
        ...(classId && { class_id: classId }),
      },
    });

    if (!assignedRecords.length) {
      return [];
    }

    // Use explicit organizationId if we have it, otherwise fallback to the one from DB to preserve behavior
    const orgId = organizationId || assignedRecords[0].organization_id;

    return await this.repository.getActionItemsByUserId(orgId, userId, classId);
  }

  async getAssignedPublishTimeline(organizationId: string, userId?: string, publishOnly: boolean = false) {
    if (!organizationId) throw new Error("Tenant context missing");

    const rawAction = await this.repository.getPublishTimelineByUser(
      organizationId,
      userId,
      publishOnly
    );

    const { ExamRepository } = await import("../exam/exam.repository");
    const examRepo = new ExamRepository();
    // examRepo does not accept organizationId explicitly yet (it's from exam refactor), but we call it with existing signature
    const rawExam = await examRepo.getExamPublishTimelineByUser(
      userId,
      publishOnly
    );

    const rawTimeline = [...rawAction, ...rawExam];

    rawTimeline.sort((a: any, b: any) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (db !== da) return db - da;
      if (b.id && a.id) {
        return b.id.localeCompare(a.id);
      }
      return 0;
    });

    let studentNameMap: Record<string, string> = {};
    if (rawTimeline.length) {
      const uniqueUserIds = [...new Set(rawTimeline.map((item: any) => item.user_id))];
      studentNameMap = await this.studentRepository.getStudentNamesByUserIds(
        organizationId,
        uniqueUserIds
      );
    }

    return rawTimeline.map((item: any) => {
      if (item.task_name !== undefined) {
        return {
          studentName: studentNameMap[item.user_id] || "",
          type: "Action Item",
          title: item.task_name || "",
          description: item.description || "",
          date: item.created_at ? item.created_at.toISOString().split("T")[0] : null,
          level: item.level || "",
          marks: item.score !== null && item.total_score ? `${item.score}/${item.total_score}` : "",
          status: item.status || "",
          notes: item.notes || "",
          comment: item.comment || "",
          attachment: item.attachment || [],
          raw: item,
        };
      } else {
        return {
          studentName: studentNameMap[item.user_id] || "",
          type: "Exam",
          title: item.title || "",
          description: item.subject || "",
          date: item.created_at ? item.created_at.toISOString().split("T")[0] : null,
          marks: item?.total_marks ? `${item?.total_marks}` : "",
          raw: item,
        };
      }
    });
  }

  async getApprovedActionItemsByLevel(organizationId: string, userId: string) {
    if (!organizationId) throw new Error("Tenant context missing");

    const rawItems = await this.repository.getApprovedActionItemsByUserId(organizationId, userId);
    if (!rawItems.length) {
      return { levels: [], data: [] };
    }

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

      if (item.score) {
        group.obtained_score += item.score;
      }
    });

    return {
      levels: Array.from(groupedMap.keys()),
      data: Array.from(groupedMap.values()),
    };
  }

  async getApprovedActionItemsForTutor(organizationId: string) {
    if (!organizationId) throw new Error("Tenant context missing");

    const rawItems = await this.repository.getApprovedActionItems(organizationId);

    if (!rawItems.length) {
      return { levels: [], data: [] };
    }

    const userIds = [...new Set((rawItems as any[]).map((i) => i.user_id))];
    const studentMap = new Map(
      Object.entries(await this.studentRepository.getStudentNamesByUserIds(organizationId, userIds))
    );

    const mappedItems = rawItems.map((item) => ({
      ...item,
      student_name: studentMap.get(item.user_id) ?? "",
    }));

    const levelMap = new Map<string, any>();

    mappedItems.forEach((item) => {
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

    return {
      levels: data.map((d) => d.level),
      data,
    };
  }

  async createAssiginCourse(
    organizationId: string | null,
    client: string | undefined,
    action_item_id: string[],
    user_id: string[] | undefined,
    classIds: string[]
  ) {
    let resolvedClientId: string | null = organizationId || null;
    let newAssignments = 0;

    const { ActionItems } = await import("../actionItems/actionItems.model");
    const { AssignedActionItemsModel } = await import("./assignActionItems.model");
    const { StudentClass } = await import("../students/class.model");
    const { Student } = await import("../students/student.model");
    const { OrganizationUser } = await import("../roles/role.model");
    const { Op } = await import("sequelize");

    // Assign to specific users
    if (user_id?.length) {
      if (!resolvedClientId) {
        const localStudent = await Student.findOne({ where: { user_id: user_id[0] } });
        resolvedClientId = localStudent?.organization_id || null;
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
          const count = await ActionItems.count({ where: { id: itemId, organization_id: resolvedClientId } });
          if (count !== 1) {
            throw new Error("One or more action items do not belong to the current organization");
          }

          const exists = await AssignedActionItemsModel.findOne({
            where: {
              organization_id: resolvedClientId,
              user_id: { [Op.contains]: [user] },
              action_item_id: { [Op.contains]: [itemId] },
            },
          });
          if (!exists) {
            await this.repository.createAssignCourse({
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
        let classClientId = resolvedClientId;
        if (!classClientId) {
          const localClass = await StudentClass.findByPk(cid);
          classClientId = localClass?.organization_id || null;
        }

        if (!classClientId) {
          throw new ValidationError(`Invalid or unknown class_id: ${cid}`);
        }
        resolvedClientId = classClientId;

        const classUsers = await this.studentRepository.getUserIdsByClassId(
          classClientId,
          cid
        );
        if (!classUsers.length) {
          throw new ValidationError(`No students found for class_id: ${cid}`);
        }

        for (const user of classUsers) {
          for (const itemId of action_item_id) {
            const count = await ActionItems.count({ where: { id: itemId, organization_id: classClientId } });
            if (count !== 1) {
              throw new Error("One or more action items do not belong to the current organization");
            }

            const exists = await AssignedActionItemsModel.findOne({
              where: {
                organization_id: classClientId,
                class_id: cid,
                user_id: { [Op.contains]: [user] },
                action_item_id: { [Op.contains]: [itemId] },
              },
            });
            if (!exists) {
              await this.repository.createAssignCourse({
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

      const localStudents = await this.studentRepository.listStudents(client);
      const clientUsers = localStudents.map((s) => s.user_id).filter(Boolean);

      for (const user of clientUsers) {
        for (const itemId of action_item_id) {
          const count = await ActionItems.count({ where: { id: itemId, organization_id: client } });
          if (count !== 1) {
            throw new Error("One or more action items do not belong to the current organization");
          }

          const exists = await AssignedActionItemsModel.findOne({
            where: {
              organization_id: client,
              user_id: { [Op.contains]: [user] },
              action_item_id: { [Op.contains]: [itemId] },
            },
          });
          if (!exists) {
            await this.repository.createAssignCourse({
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

    return newAssignments;
  }

  async publishAssignedItem(
    assigned_id: string,
    assignment_id: string,
    user_id: string,
    publish: boolean
  ) {
    const { AssignedActionItemsModel } = await import("./assignActionItems.model");
    const assignedRecord = await AssignedActionItemsModel.findOne({
      where: { id: assigned_id },
    });

    if (assignedRecord) {
      await this.repository.logPublishEvent({
        assigned_id,
        assignment_id,
        user_id,
        publish,
      });
    } else {
      const { ExamAssignment } = await import("../exam/exam.model");
      const examRecord = await ExamAssignment.findOne({
        where: { id: assigned_id },
      });
      if (!examRecord) {
        throw new NotFoundError("Assigned record not found");
      }

      const { ExamRepository } = await import("../exam/exam.repository");
      const examRepo = new ExamRepository();
      await examRepo.logExamPublishEvent({
        assigned_id,
        assignment_id,
        user_id,
        publish,
      });
    }

    return { assigned_id, assignment_id, publish };
  }

  async updateAssignedActionStatus(
    organizationId: string | undefined,
    userId: string,
    assignedActionItemId: string,
    status: "ASSIGNED" | "SUBMITTED" | "APPROVED" | "REJECTED",
    notes?: string,
    comment?: string,
    attachment?: string[],
    score?: number
  ) {
    if (!userId) throw new ValidationError("user_id is required in URL");
    if (!assignedActionItemId) throw new ValidationError("assigned_action_item_id is required");
    if (!status) throw new ValidationError("status is required");

    const record = await this.repository.getAssignedRecordById(assignedActionItemId, organizationId, userId);

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

    await this.repository.updateAssignedRecord(assignedActionItemId, updateData, organizationId);

    return {
      user_id: userId,
      assigned_action_item_id: assignedActionItemId,
      status,
      notes: notes !== undefined ? (notes ?? null) : record.notes,
      score: status === "APPROVED" ? score : null,
      comment: comment !== undefined ? (comment ?? null) : record.comment,
      attachment: attachment !== undefined ? finalAttachments : record.attachment,
    };
  }

  async getAttachments(organizationId: string | undefined, id: string) {
    if (!id) {
      throw new ValidationError("id is required in URL params");
    }

    const record = await this.repository.getAssignedRecordById(id, organizationId);

    if (!record) {
      throw new NotFoundError("Assigned action item not found");
    }

    const attachmentKeys: string[] = record.attachment || [];

    return {
      id: record.id,
      attachment: attachmentKeys,
      count: attachmentKeys.length,
    };
  }

  async updateAttachments(
    organizationId: string | undefined,
    id: string,
    attachment: string[],
    action?: "add" | "replace"
  ) {
    if (!id) throw new ValidationError("id is required in URL params");

    if (!attachment || !Array.isArray(attachment) || attachment.length === 0) {
      throw new ValidationError("attachment array is required and must not be empty");
    }

    const record = await this.repository.getAssignedRecordById(id, organizationId);

    if (!record) {
      throw new NotFoundError("Assigned action item not found");
    }

    const existingAttachmentKeys: string[] = record.attachment || [];
    let updatedAttachmentKeys: string[];

    if (action === "replace") {
      updatedAttachmentKeys = attachment;
    } else {
      updatedAttachmentKeys = [...existingAttachmentKeys];
      attachment.forEach((key) => {
        if (!updatedAttachmentKeys.includes(key)) {
          updatedAttachmentKeys.push(key);
        }
      });
    }

    const updatedCount = await this.repository.updateAssignedRecord(id, { attachment: updatedAttachmentKeys }, organizationId);

    if (updatedCount === 0) {
      throw new NotFoundError("Assigned action item not found or could not be updated");
    }

    return {
      attachments: updatedAttachmentKeys,
      count: updatedAttachmentKeys.length,
    };
  }

  async deleteAttachments(
    organizationId: string | undefined,
    id: string,
    deleteKeys: string[]
  ) {
    if (!id) throw new ValidationError("id is required in URL params");

    if (!deleteKeys || !Array.isArray(deleteKeys) || deleteKeys.length === 0) {
      throw new ValidationError("delete_keys array is required and must not be empty");
    }

    const record = await this.repository.getAssignedRecordById(id, organizationId);

    if (!record) {
      throw new NotFoundError("Assigned action item not found");
    }

    const existingAttachmentKeys: string[] = record.attachment || [];

    if (existingAttachmentKeys.length === 0) {
      throw new ValidationError("No attachments found to delete");
    }

    const updatedAttachmentKeys = existingAttachmentKeys.filter(
      (key) => !deleteKeys.includes(key)
    );

    if (updatedAttachmentKeys.length === existingAttachmentKeys.length) {
      throw new ValidationError("None of the specified keys were found in attachments");
    }

    const updatedCount = await this.repository.updateAssignedRecord(id, { attachment: updatedAttachmentKeys }, organizationId);

    if (updatedCount === 0) {
      throw new NotFoundError("Assigned action item not found or could not be updated");
    }

    return {
      deleted_keys: deleteKeys.filter((key) => existingAttachmentKeys.includes(key)),
      remaining_attachments: updatedAttachmentKeys,
      remaining_count: updatedAttachmentKeys.length,
    };
  }
}
