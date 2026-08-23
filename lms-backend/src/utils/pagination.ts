import { FindAndCountOptions, Model } from "sequelize";

interface PaginationOptions {
  page?: number; // Page number (starts from 1)
  limit?: number; // Items per page
  filters?: Record<string, any>; // Optional filtering
  order?: any[]; // Sorting e.g. [['created_on', 'DESC']] ||   ["updated_at", "DESC"], ["created_at", "DESC"] ]
  attributes?: string[]; // Columns to return
  include?: any[]; // Associations
}

export async function paginate<T extends Model>(
  model: {
    findAndCountAll: (
      options: FindAndCountOptions,
    ) => Promise<{ count: number; rows: T[] }>;
  },
  options: PaginationOptions,
) {
  const MAX_LIMIT = 50;
  const DEFAULT_LIMIT = 10;

  const page = options?.page && options.page > 0 ? Math.floor(options.page) : 1;

  const parsedLimit = Number(options?.limit);
  const requestedLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? parsedLimit
      : DEFAULT_LIMIT;
  let limit = Math.min(requestedLimit, MAX_LIMIT);

  const offset = (page - 1) * limit;
  if (options.include && options.include.length > 0) {
    limit = Math.min(requestedLimit, 20);
  }
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
    pagination: {
      total: result?.count,
      page,
      limit,
      totalPages: Math.ceil(result.count / limit),
    },
  };
}
