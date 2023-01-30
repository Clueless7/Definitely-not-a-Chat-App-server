import DB from '../config/db.js'
import GroupRoles from './GroupRoles.js'
import Groups from './Groups.js'
import UserChatReactions from './UserChatReactions.js'
import UserChats from './UserChats.js'
import UserGroupRoles from './UserGroupRoles.js'
import UserGroups from './UserGroups.js'
import Users from './Users.js'
import UserLogs from './UserLogs.js'
import AdminLogs from './AdminLogs.js'
import Reports from './Reports.js'
import Sections from './Sections.js'

const createAssociation = async () => {
  Users.hasMany(UserChats, { foreignKey: { name: 'user_id' } })
  UserChats.belongsTo(Users, {
    foreignKey: { name: 'user_id', allowNull: false },
  })

  Users.hasMany(Reports, { foreignKey: { name: 'user_id' } })
  Reports.belongsTo(Users, {
    foreignKey: { name: 'user_id', allowNull: false },
  })

  Sections.hasMany(Users, { foreignKey: { name: 'section_id' } })
  Users.belongsTo(Sections, {
    foreignKey: { name: 'section_id', allowNull: false },
  })

  Groups.hasMany(Reports, { foreignKey: { name: 'group_id' } })
  Reports.belongsTo(Groups, {
    foreignKey: { name: 'group_id', allowNull: false },
  })

  Users.hasMany(UserLogs, { foreignKey: { name: 'user_id' } })
  UserLogs.belongsTo(Users, {
    foreignKey: { name: 'user_id', allowNull: false },
  })

  Users.hasMany(AdminLogs, { foreignKey: { name: 'user_id' } })
  AdminLogs.belongsTo(Users, {
    foreignKey: { name: 'user_id', allowNull: false },
  })

  Groups.hasMany(GroupRoles, { foreignKey: { name: 'group_id' } })
  GroupRoles.belongsTo(Groups, {
    foreignKey: { name: 'group_id', allowNull: false },
  })

  UserChats.hasMany(UserChatReactions, { foreignKey: { name: 'userchat_id' } })
  UserChatReactions.belongsTo(UserChats, {
    foreignKey: { name: 'userchat_id', allowNull: false },
  })

  Groups.hasMany(UserChats, {
    foreignKey: { name: 'receiver' },
  })
  UserChats.belongsTo(Groups, {
    foreignKey: { name: 'receiver', allowNull: false },
  })

  Groups.belongsToMany(Users, { through: UserGroups, foreignKey: 'group_id' })
  Users.belongsToMany(Groups, { through: UserGroups, foreignKey: 'user_id' })

  try {
    await UserGroups.sync()
  } catch (error) {}

  GroupRoles.belongsToMany(UserGroups, {
    through: UserGroupRoles,
    foreignKey: 'group_role_id',
  })
  UserGroups.belongsToMany(GroupRoles, {
    through: UserGroupRoles,
    foreignKey: 'user_group_id',
  })
}

const syncModels = async () => {
  try {
    await DB.sync()
  } catch (error) {
    console.log(error)
  }
}

export { createAssociation, syncModels }
