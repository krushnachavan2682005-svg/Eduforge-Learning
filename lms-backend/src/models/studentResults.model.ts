import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface StudentResultsAttributes {
    id: string;
    user_id: string;
    organization_id: string;
    test_name: string;
    achieved_marks: number | null;
    total_marks: number | null;
    exam_date: Date;
    status: "Pass" | "Fail";
    created_at?: Date;
    updated_at?: Date;
}

interface StudentResultsCreationAttributes
    extends Optional<StudentResultsAttributes, "id" | "created_at" | "updated_at"> { }

export class StudentResults
    extends Model<StudentResultsAttributes, StudentResultsCreationAttributes>
    implements StudentResultsAttributes {
    public id!: string;
    public user_id!: string;
    public organization_id!: string;
    public test_name!: string;
    public achieved_marks!: number | null;
    public total_marks!: number | null;
    public exam_date!: Date;
    public status!: "Pass" | "Fail";
    public readonly created_at!: Date;
    public readonly updated_at!: Date;
}

StudentResults.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        organization_id: {
            type: DataTypes.UUID,
            allowNull: false,
    },
        test_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        achieved_marks: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        total_marks: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        exam_date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM("Pass", "Fail"),
            allowNull: false,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        sequelize,
        tableName: "student_results",
        timestamps: false,
    }
);
