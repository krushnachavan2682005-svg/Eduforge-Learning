import { Model, ModelStatic, Sequelize, Op } from "sequelize";

export interface ModelWithId extends Model {
  id: string | number;
}

 type UniqueTitleCheckConfig = {
  uniqueTitle: string[]; 
  errorMessage?: string;
  caseInsensitive?: boolean; 
  caseInsensitiveFields?: string[];
};

export function uniqueTitleCheckHook(config: UniqueTitleCheckConfig) {
  const {
    uniqueTitle,
    errorMessage,
    caseInsensitive = true,
    caseInsensitiveFields = ["title", "name"],
  } = config;

  return async function (instance: ModelWithId) {
    if (!instance.isNewRecord) {
      return;
    }

    const where: Record<string, any> = {};

    for (const field of uniqueTitle) {
      const fieldValue = (instance as any)[field];

      if (
        caseInsensitive &&
        caseInsensitiveFields.includes(field) &&
        typeof fieldValue === "string"
      ) {
        where[field] = Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col(field)),
          "=",
          fieldValue.toLowerCase()
        );
      } else {
        where[field] = fieldValue;
      }
    }

    if (Object.values(where).some((v) => v == null)) {
      return;
    }

    const model = instance.constructor as ModelStatic<ModelWithId>;
    
   if (instance.id) {
      where.id = { [Op.ne]: instance.id };
    }
    
    const existing = await model.findOne({ where });
    if (existing) {
      const fieldValues = uniqueTitle
        .map((field) => (instance as any)[field])
        .join(", ");
      throw new Error(
        errorMessage ||
          `Record with ${uniqueTitle.join(
            ", "
          )} (${fieldValues}) already exists.`
      );
    }
  };
}
