import { DataTypes } from 'sequelize'
import DB from '../config/db.js'

const Groups = DB.define(
  'group',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      autoIncrement: true,
    },
    group_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    group_picture: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'default-icon.png',
    },
    is_group: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    last_message_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    has_threat: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  { timestamps: false }
)

export default Groups
