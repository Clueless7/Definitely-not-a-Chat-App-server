import DB from '../config/db.js'
import { DataTypes } from 'sequelize'

const Reports = DB.define(
  'reports',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    group_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    report_reason: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    is_resolved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    remarks: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    date_resolved: {
      type: DataTypes.DATE,
    },
  },
  { createdAt: true, updatedAt: false }
)

export default Reports
