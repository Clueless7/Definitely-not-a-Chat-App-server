import { DataTypes } from 'sequelize'
import DB from '../config/db.js'

const GroupRoles = DB.define(
  'group_role',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    role_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    emoji: {
      type: DataTypes.CHAR,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role_type: {
      type: DataTypes.ENUM('MODERATOR', 'LEADER', 'MEMBER'),
      allowNull: false,
      defaultValue: 'MEMBER',
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  { timestamps: false }
)

export default GroupRoles
