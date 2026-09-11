import { sequelize } from "../../config/database";
import { Organization } from "./organization.model";
import { DataTypes, QueryError, QueryTypes } from "sequelize";

export class organizationRepo{
    static async getactiveOrganizations(){
        let active=await Organization.findAll({where:{is_active:true}})
        // let sql=`select * from organization where is_active=True;`
        // let data=sequelize.query(sql,{type:QueryTypes.SELECT})
        return active

    }
}