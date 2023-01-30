import { DataTypes } from 'sequelize'
import DB from '../config/db.js'

const UserChatReactions = DB.define(
  'userchat_reaction',
  {
    reaction: {
      type: DataTypes.CHAR,
      allowNull: false,
    },
    count: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  { timestamps: false }
)

export default UserChatReactions
