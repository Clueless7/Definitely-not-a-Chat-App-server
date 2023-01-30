import DB from '../config/db.js'
import { DataTypes } from 'sequelize'

const Users = DB.define(
  'user',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    first_name: { type: DataTypes.STRING, allowNull: false },
    last_name: { type: DataTypes.STRING, allowNull: false },
    birthdate: { type: DataTypes.DATE, allowNull: false },
    address: { type: DataTypes.STRING, allowNull: false },
    gender: { type: DataTypes.STRING, allowNull: false },
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    access_level: {
      type: DataTypes.ENUM('USER', 'MODERATOR', 'ADMIN'),
      allowNull: false,
      defaultValue: 'USER',
    },
    profile_img: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'default-icon.png',
    },
    token_version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    disabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  { timestamps: false }
)

export default Users
