import { DataTypes } from 'sequelize'
import DB from '../config/db.js'

const UserGroups = DB.define(
  'user_group',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
  },
  { timestamps: false }
)

export default UserGroups
