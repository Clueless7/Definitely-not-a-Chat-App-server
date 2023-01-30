import DB from '../config/db.js'

const UserGroupRoles = DB.define('user_group_role', {}, { timestamps: false })

export default UserGroupRoles
