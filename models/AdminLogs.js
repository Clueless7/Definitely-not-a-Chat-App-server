import DB from '../config/db.js'
import { DataTypes } from 'sequelize'

const AdminLogs = DB.define(
  'admin_logs',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    action_description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  { createdAt: true, updatedAt: false }
)

export default AdminLogs
