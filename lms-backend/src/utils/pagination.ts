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
      options: FindAndCountOptions
    ) => Promise<{ count: number; rows: T[] }>;
  },
  options: PaginationOptions
) {
  const page = options?.page && options.page > 0 ? options.page : 1;
  const limit = options?.limit && options.limit > 0 ? options.limit : 10;
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
    pagination: {
      total: result?.count,
      page,
      limit,
      totalPages: Math.ceil(result.count / limit),
    },
  };
}
