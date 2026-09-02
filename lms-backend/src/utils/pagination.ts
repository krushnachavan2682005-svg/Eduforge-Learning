import { FindAndCountOptions, Model, FindOptions, Op } from "sequelize";
import { decodeCursor, encodeCursor } from "./cursor";
import { ValidationError } from "./globalErrorHandlingFile";

interface PaginationOptions {
  page?: number;
  limit?: number;
  filters?: Record<string, any>;
  order?: any[];
  attributes?: string[];
  include?: any[];
  
  // Cursor specific fields
  cursor?: string;
  cursorFields?: string[]; // e.g. ['created_at', 'id']
  useCursorPagination?: boolean;
}

export async function paginate<T extends Model>(
  model: {
    findAndCountAll: (options: FindAndCountOptions) => Promise<{ count: number; rows: T[] }>;
    findAll: (options: FindOptions) => Promise<T[]>;
  },
  options: PaginationOptions,
) {
  const MAX_LIMIT = 50;
  const DEFAULT_LIMIT = 10;
  
  const parsedLimit = Number(options?.limit);
  const requestedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT;
  
  let limit = Math.min(requestedLimit, MAX_LIMIT);
  if (options.include && options.include.length > 0) {
    limit = Math.min(limit, 20);
  }

  // Handle Cursor Pagination
  if (options.useCursorPagination || options.cursor !== undefined) {
    const where: any = { ...options?.filters };
    
    if (options.cursor) {
      const cursorData: any = decodeCursor(options.cursor);
      
      if (options.cursorFields && options.cursorFields.length > 0) {
        // Validate all required cursor fields are present and valid
        for (const field of options.cursorFields) {
          const val = cursorData[field];
          if (val === undefined || val === null || val === "") {
            throw new ValidationError(`Invalid cursor payload: missing or empty required field '${field}'`);
          }
        }

        if (options.cursorFields.length === 2) {
          const field1 = options.cursorFields[0];
          const field2 = options.cursorFields[1];
          const val1 = cursorData[field1];
          const val2 = cursorData[field2];
          
          where[Op.or as any] = [
            { [field1]: { [Op.lt]: val1 } },
            {
              [field1]: val1,
              [field2]: { [Op.lt]: val2 },
            }
          ];
        }
      }
    }

    const order = options.order || [
      ["created_at", "DESC"],
      ["id", "DESC"]
    ];

    // Fetch limit + 1
    const rows = await model.findAll({
      where,
      limit: limit + 1,
      order,
      attributes: options?.attributes,
      include: options?.include,
    });

    const hasNext = rows.length > limit;
    if (hasNext) {
      rows.pop(); // Remove the extra record
    }

    let nextCursor = null;
    if (hasNext && rows.length > 0 && options.cursorFields) {
      const lastRow = rows[rows.length - 1] as any;
      const payload: any = {};
      for (const field of options.cursorFields) {
        payload[field] = lastRow.dataValues ? lastRow.dataValues[field] : lastRow[field];
      }
      nextCursor = encodeCursor(payload);
    }

    // Returning backward compatible structure as much as possible
    return {
      items: rows,
      data: rows,
      pagination: {
        limit,
        next_cursor: nextCursor,
        has_next: hasNext,
      }
    };
  }

  // Legacy Page Pagination
  const page = options?.page && options.page > 0 ? Math.floor(options.page) : 1;
  const offset = (page - 1) * limit;

  const result = await model.findAndCountAll({
    where: options?.filters || {},
    limit,
    offset,
    order: options?.order || [
      ["updated_at", "DESC"],
      ["created_at", "DESC"],
    ],
    attributes: options?.attributes,
    include: options?.include,
  });

  return {
    items: result?.rows,
    data: result?.rows, // add data for uniformity
    pagination: {
      total: result?.count,
      page,
      limit,
      totalPages: Math.ceil(result.count / limit),
    },
  };
}
