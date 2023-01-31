import Groups from '../models/Groups.js'
import UserGroups from '../models/UserGroups.js'
import UserChats from '../models/UserChats.js'
import Users from '../models/Users.js'
import UserChatReactions from '../models/UserChatReactions.js'
import GroupRoles from '../models/GroupRoles.js'
import UserGroupRoles from '../models/UserGroupRoles.js'
import AdminLogs from '../models/AdminLogs.js'
import UserLogs from '../models/UserLogs.js'
import Reports from '../models/Reports.js'
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { GraphQLError } from 'graphql'
import jwt from 'jsonwebtoken'
import { signAccessToken, signRefreshToken } from '../auth/signTokens.js'
import { authMiddleware } from '../auth/middlewares/authMiddleware.js'
import { createAssociation, syncModels } from '../models/Associations.js'
import { v4 as uuid } from 'uuid'
import { Op } from 'sequelize'
import { withFilter } from 'graphql-subscriptions'
import { DateTimeResolver, DateResolver } from 'graphql-scalars'
import bcrypt from 'bcrypt'
import Sections from '../models/Sections.js'
import { randomColor } from 'randomcolor'
import Filter from 'bad-words'
import filipinoBadWords from 'filipino-badwords-list'

try {
  await createAssociation()
  await syncModels()
} catch (error) {
  console.log(error)
}

const filter = new Filter({ list: filipinoBadWords.array })

const resolvers = {
  User: {
    section: async ({ section_id }) => {
      const section = await Sections.findOne({ where: { id: section_id } })

      return section
    },
    age: async ({ birthdate }) => {
      const difference = new Date() - birthdate

      let age = Math.floor(difference / (1000 * 3600 * 24 * 365))

      return age
    },
  },
  GraphData: {
    color: () => {
      return randomColor({ luminosity: 'dark' })
    },
  },
  Upload: GraphQLUpload,
  DateTime: DateTimeResolver,
  Date: DateResolver,
  AccessLevel: {
    USER: 'USER',
    MODERATOR: 'MODERATOR',
    ADMIN: 'ADMIN',
  },
  MessageType: {
    TEXT: 'TEXT',
    IMAGE: 'IMAGE',
    OTHER: 'OTHER',
  },
  RoleType: {
    MODERATOR: 'MODERATOR',
    LEADER: 'LEADER',
    MEMBER: 'MEMBER',
  },
  Query: {
    userChat: (_, { id }) => {
      return UserChats.findOne({ where: { id } })
    },
    userChatSender: (_, { user_id }, context) => {
      authMiddleware(context)

      if (!user_id) return
      return Users.findOne({ where: { id: user_id } })
    },
    user: (_, __, context) => {
      const { data: user } = authMiddleware(context)

      return Users.findOne({ where: { id: user.user_id } })
    },
    userProfile: (_, { id }, context) => {
      authMiddleware(context)
      return Users.findOne({ where: { id } })
    },
    group: async (_, { id }, context) => {
      const { data: user } = authMiddleware(context)

      const validation = await UserGroups.findOne({
        where: { user_id: user.user_id, group_id: id },
      })

      if (!validation) {
        throw new GraphQLError('user does not belong to chat')
      }

      let group = await Groups.findOne({ where: { id } })

      if (group.is_group === true) return group

      const userGroups = await UserGroups.findAll({ where: { group_id: id } })

      const otherUserId = userGroups.filter(
        (usergroup) => usergroup.user_id !== user.user_id
      )

      const otherUser = await Users.findOne({
        where: { id: otherUserId[0].user_id },
      })

      const otherUserFullName = `${otherUser.first_name} ${otherUser.last_name}`

      group.group_name = otherUserFullName
      group.group_picture = otherUser.profile_img

      return group
    },
    userGroup: (_, { user_id, group_id }) => {
      if (user_id) {
        return UserGroups.findOne({ where: { user_id } })
      } else {
        return UserGroups.findOne({ where: { group_id } })
      }
    },
    users: async (_, { limit }, context) => {
      authMiddleware(context)

      if (limit) {
        const users = await Users.findAll({ limit })
        return users
      }

      return Users.findAll()
    },
    userChats: async (_, __, context) => {
      const { data: user } = authMiddleware(context)

      const userGroups = await UserGroups.findAll({
        where: { user_id: user.user_id },
      })

      const groupIds = userGroups.map((usergroup) => usergroup.group_id)

      const validation = await Users.findOne({
        where: { id: user.user_id },
      })

      if (!validation) {
        throw new GraphQLError('user does not exist')
      }

      const userChats = await UserChats.findAll({
        where: { receiver: groupIds },
      })

      const filteredUserChats = userChats.map((userchat) => {
        userchat.message = filter.clean(userchat.message)
        return userchat
      })

      return filteredUserChats
    },
    groups: async (_, { limit, offset }, context) => {
      const { data: user } = authMiddleware(context)

      const validation = await UserGroups.findAll({
        where: { user_id: user.user_id },
      })

      const userGroupIds = validation.map((usergroup) => usergroup.id)

      const userGroupRoles = await UserGroupRoles.findAll({
        where: { user_group_id: userGroupIds },
      })

      const groupRolesIds = userGroupRoles.map(
        (usergrouprole) => usergrouprole.group_role_id
      )

      const groupRoles = await GroupRoles.findAll({
        where: { id: groupRolesIds },
      })

      let groups = []

      for (const usergroup of validation) {
        const hasChat = await UserChats.findAll({
          where: { receiver: usergroup.group_id },
        })

        if (hasChat.length > 0) {
          groups.push(usergroup.group_id)
        }
      }

      for (const groupRole of groupRoles) {
        if (groupRole.role_type === 'MODERATOR') {
          groups.push(groupRole.group_id)
        }
      }

      const returnVal = await Groups.findAll({
        where: { id: groups },
        // limit,
        // offset,
        order: [['last_message_date', 'DESC']],
      })

      return returnVal
    },
    userGroups: () => {
      return UserGroups.findAll()
    },
    currentUser: async (_, __, context) => {
      const { data } = authMiddleware(context)

      const user = await Users.findOne({ where: { id: data.user_id } })

      return user
    },
    isLoggedIn: async (_, __, context) => {
      const refreshToken = context.req.session.refresh_token

      const refreshTokenData = jwt.verify(
        refreshToken,
        process.env.REFRESH_SECRET
      )

      const refreshTokenUser = await Users.findOne({
        where: { id: refreshTokenData.user_id },
      })

      if (refreshTokenUser)
        return { isLogged: true, currentUser: refreshTokenUser }
      else return { isLogged: false, currentUser: null }
    },
    userRoles: async (_, { group_role_id }, context) => {
      authMiddleware(context)
      let userGroupIds = []
      let userIds = []
      const userGroupRoles = await UserGroupRoles.findAll({
        where: { group_role_id },
      })

      userGroupRoles.forEach((usergrouprole) => {
        userGroupIds.push(usergrouprole.user_group_id)
      })

      const users = await UserGroups.findAll({
        where: { id: userGroupIds },
      })

      users.forEach((user) => {
        userIds.push(user.user_id)
      })

      return Users.findAll({ where: { id: userIds } })
    },
    groupRolesList: async (_, { group_id }, context) => {
      authMiddleware(context)

      const groupRoles = await GroupRoles.findAll({ where: { group_id } })

      return groupRoles
    },
    latestChats: async (_, __, context) => {
      const { data: user } = authMiddleware(context)

      const groups = await UserGroups.findAll({
        where: { user_id: user.user_id },
      })

      let latestChats = await Promise.all(
        groups.map(async (group) => {
          const latestGroupChat = await UserChats.findOne({
            where: {
              receiver: group.group_id,
            },
            order: [['createdAt', 'DESC']],
          })

          return latestGroupChat
        })
      )

      const filterLatestChats = latestChats
        .map((latestchat) => {
          if (!latestchat) {
            return null
          }
          latestchat.message
          latestchat.message = filter.clean(latestchat.message)
          return latestchat
        })
        .filter((userchat) => userchat !== null)

      return filterLatestChats
    },
    addMemberList: async (_, { group_id, form }, context) => {
      const { data: currUser } = authMiddleware(context)

      const userGroups = await (
        await UserGroups.findAll({ where: { group_id } })
      ).map((usergroup) => usergroup.user_id)

      const users = await Users.findAll()

      if (form === 'memberList') {
        const kvUsers = users.map((user) => {
          if (!userGroups.includes(user.id))
            return {
              key: user.id,
              value: `${user.first_name} ${user.last_name}`,
            }
        })
        return kvUsers
      } else if (form === 'userList') {
        const filteredUser = users.filter(
          (user) => user.id !== currUser.user_id
        )

        const kvUsers = filteredUser.map((user) => {
          return {
            key: user.id,
            value: `${user.first_name} ${user.last_name}`,
          }
        })
        return kvUsers
      }
    },
    adminLogs: async (_, __, context) => {
      const { data: user } = authMiddleware(context)

      const adminLogs = await AdminLogs.findAll({
        order: [['createdAt', 'DESC']],
      })

      return adminLogs
    },
    userLogs: async (_, { limit, offset }, context) => {
      const { data: user } = authMiddleware(context)

      const userLogs = await UserLogs.findAll({
        order: [['createdAt', 'DESC']],
        limit,
        offset: offset * 10,
      })

      const filterWords = userLogs.map((userlog) => {
        userlog.action_description = filter.clean(userlog.action_description)

        return userlog
      })

      return filterWords
    },
    currentUserGroupRoles: async (_, { group_id }, context) => {
      const { data } = authMiddleware(context)

      const user = await Users.findOne({ where: { id: data.user_id } })

      const userGroups = await UserGroups.findAll({
        where: { user_id: user.id },
      })

      const userGroupIds = userGroups.map((usergroup) => usergroup.id)

      const userGroupRoles = await UserGroupRoles.findAll({
        where: { user_group_id: userGroupIds },
      })

      const groupRoleIds = userGroupRoles.map(
        (usergrouprole) => usergrouprole.group_role_id
      )

      const groupRoles = await GroupRoles.findAll({
        where: { id: groupRoleIds },
      })

      const rolesInGroup = groupRoles.filter(
        (grouprole) => grouprole.group_id === group_id
      )

      const roles = rolesInGroup.map((rolesingroup) => rolesingroup.role_type)

      return { roles }
    },
    otherUser: async (_, { group_id }, context) => {
      const { data: user } = authMiddleware(context)

      const group = await Groups.findOne({ where: { id: group_id } })

      const userGroup = await UserGroups.findAll({
        where: { group_id: group.id },
      })

      const userGroupFilter = userGroup.filter(
        (usergroup) => usergroup.user_id !== user.user_id
      )

      const otherUser = await Users.findOne({
        where: { id: userGroupFilter[0].user_id },
      })

      return otherUser
    },
    groupList: async (_, { limit }, context) => {
      authMiddleware(context)
      if (limit) {
        return Groups.findAll({ limit })
      }
      return Groups.findAll()
    },
    groupMembers: async (_, { group_id }, context) => {
      authMiddleware(context)

      const userGroup = await UserGroups.findAll({ where: { group_id } })

      const userIds = userGroup.map((usergroup) => usergroup.user_id)

      return Users.findAll({ where: { id: userIds } })
    },
    systemStats: async (_, __, context) => {
      authMiddleware(context)

      const users = await Users.findAll()
      const groups = await Groups.findAll()
      const userChats = await UserChats.findAll()
      const reports = await Reports.findAll()

      const filterReports = reports.filter(
        (report) => report.is_resolved === false
      )

      const adminLog = await AdminLogs.findOne({
        order: [['createdAt', 'DESC']],
      })

      return {
        userCount: users.length,
        groupCount: groups.length,
        userChatsCount: userChats.length,
        pendingReportCount: filterReports.length,
        latestAdminLog: adminLog,
      }
    },
    userGroupRoles: async (_, { group_id, user_id }, context) => {
      authMiddleware(context)

      const userGroups = await UserGroups.findAll({
        where: { group_id, user_id },
      })

      const userGroupIds = userGroups.map((usergroup) => usergroup.id)

      const userGroupRoles = await UserGroupRoles.findAll({
        where: { user_group_id: userGroupIds },
      })

      const groupRolesIds = userGroupRoles.map(
        (usergrouprole) => usergrouprole.group_role_id
      )

      const groupRoles = await GroupRoles.findAll({
        where: { id: groupRolesIds },
      })

      return groupRoles.map((grouprole) => grouprole.id)
    },
    reports: async (_, __, context) => {
      authMiddleware(context)

      const reports = await Reports.findAll()

      return reports
    },
    report: async (_, { report_id }, context) => {
      authMiddleware(context)

      const report = await Reports.findOne({ where: { id: report_id } })

      const sender = await Users.findOne({ where: { id: report.user_id } })
      const chat_reported = await Groups.findOne({
        where: { id: report.group_id },
      })

      return {
        report,
        sender,
        chat_reported,
      }
    },
    reportedChat: async (_, { group_id }, context) => {
      authMiddleware(context)

      const userGroups = await UserGroups.findAll({ where: { group_id } })

      const userIds = userGroups.map((usergroup) => usergroup.user_id)

      const allMembers = await Users.findAll({ where: { id: userIds } })

      const group_data = await Groups.findOne({ where: { id: group_id } })

      const groupRoles = await GroupRoles.findAll({ where: { group_id } })

      const roleMembers = await Promise.all(
        groupRoles.map(async (role) => {
          const userGroupRoles = await UserGroupRoles.findAll({
            where: { group_role_id: role.id },
          })

          const userGroupIds = userGroupRoles.map(
            (usergrouprole) => usergrouprole.user_group_id
          )

          const userGroups = await UserGroups.findAll({
            where: { id: userGroupIds },
          })

          const userIds = userGroups.map((usergroup) => usergroup.user_id)

          const members = await Users.findAll({ where: { id: userIds } })

          return {
            role,
            members,
          }
        })
      )

      return {
        group_data,
        allMembers,
        roleMembers,
      }
    },
    sections: async (_, __, context) => {
      authMiddleware(context)
      return Sections.findAll()
    },
    graphData: async (_, __, context) => {
      authMiddleware(context)

      const allSections = await Sections.findAll()

      const sections = await Promise.all(
        allSections.map(async (section) => {
          const users = await Users.findAll({
            where: { section_id: section.id },
          })

          if (users.length === 0) return

          return {
            title: section.section_name,
            value: users.length,
          }
        })
      )

      return sections.filter((section) => section)
    },
  },
  Mutation: {
    addUser: async (_, { user_data }, context) => {
      const { data: user } = authMiddleware(context)

      const actionUser = await Users.findOne({ where: { id: user.user_id } })

      if (actionUser.access_level !== 'ADMIN') {
        return { registered: false, username: null }
      }

      const hashedPassword = await bcrypt.hash(user_data.password, 10)

      await Users.create({
        username: user_data.username,
        access_level: user_data.access_level,
        password: hashedPassword,
        first_name: user_data.first_name,
        last_name: user_data.last_name,
        birthdate: user_data.birthdate,
        section_id: user_data.section_id,
        address: user_data.address,
        gender: user_data.gender,
      })

      await AdminLogs.create({
        full_name: `${actionUser.first_name} ${actionUser.last_name}`,
        action_description: `Registered user: ${user_data.username}`,
        user_id: actionUser.id,
      })

      return {
        registered: true,
        username: user_data.username,
      }
    },
    addUserChat: async (_, { file, message, receiver }, context) => {
      const { data: user, pubsub } = authMiddleware(context)

      const actionUser = await Users.findOne({ where: { id: user.user_id } })
      const group = await Groups.findOne({ where: { id: receiver } })

      const validation = await UserGroups.findOne({
        where: { user_id: user.user_id, group_id: receiver },
      })
      if (validation) {
        let messageType = ''
        if (file) {
          const { createReadStream, filename, mimetype } = await file
          let filepath = '../files'
          if (mimetype.includes('image')) {
            filepath = '../files/message/images'
            messageType = 'IMAGE'
          } else {
            filepath = '../files/message/documents'
            messageType = 'OTHER'
          }

          let newFileName = `${uuid()} ${filename}`

          await new Promise((res) =>
            createReadStream()
              .pipe(
                createWriteStream(path.join('__dirname', filepath, newFileName))
              )
              .on('close', res)
          )

          const userChat = await UserChats.create({
            message: newFileName,
            user_id: user.user_id,
            receiver,
            message_type: messageType,
          })

          await Groups.update(
            { last_message_date: Date.now() },
            {
              where: {
                id: receiver,
              },
            }
          )

          const actionUserSection = await Sections.findOne({
            where: { id: actionUser.section_id },
          })

          await UserLogs.create({
            full_name: `${actionUser.first_name} ${actionUser.last_name}`,
            section: `${actionUserSection.section_name}`,
            action_description: `sent file: ${filename} to group ${group.group_name}`,
            user_id: user.user_id,
          })

          pubsub.publish('CHAT_ADDED', {
            chatAdded: userChat.dataValues,
          })
          return userChat
        } else {
          if (message !== '') {
          }
          const userChat = await UserChats.create({
            message,
            user_id: user.user_id,
            receiver,
          })

          await Groups.update(
            { last_message_date: Date.now() },
            {
              where: {
                id: receiver,
              },
            }
          )

          const actionUserSection = await Sections.findOne({
            where: { id: actionUser.section_id },
          })

          await UserLogs.create({
            full_name: `${actionUser.first_name} ${actionUser.last_name}`,
            section: `${actionUserSection.section_name}`,
            action_description: `sent message: "${message}" to group ${group.group_name}`,
            user_id: user.user_id,
          })

          pubsub.publish('CHAT_ADDED', {
            chatAdded: userChat.dataValues,
          })
          return userChat
        }
      } else {
        throw new GraphQLError(
          `userId ${user.user_id} does not belong to groupId ${receiver}`
        )
      }
    },
    createGroup: async (_, { user_id }, context) => {
      const { data: user, pubsub } = authMiddleware(context)
      const actionUser = await Users.findOne({ where: { id: user.user_id } })

      if (user_id.length === 1) {
        const otherUser = await Users.findOne({ where: { id: user_id[0] } })

        const checkGroup = await Groups.findOne({
          where: {
            [Op.or]: [
              { group_name: `${otherUser.username}${actionUser.username}` },
              { group_name: `${actionUser.username}${otherUser.username}` },
            ],
          },
        })

        if (checkGroup) return checkGroup

        const users = [user.user_id, user_id[0]]

        const pmGroup = await Groups.create({
          group_name: `${actionUser.username}${otherUser.username}`,
          group_picture: `${otherUser.profile_img}`,
          last_message_date: Date.now(),
        })

        await Promise.all(
          users.map(async (user) => {
            await UserGroups.create({ user_id: user, group_id: pmGroup.id })
          })
        )

        const actionUserSection = await Sections.findOne({
          where: { id: actionUser.section_id },
        })

        await UserLogs.create({
          full_name: `${actionUser.first_name} ${actionUser.last_name}`,
          section: `${actionUserSection.section_name}`,
          action_description: `Started a new conversation with ${otherUser.first_name} ${otherUser.last_name}`,
          user_id: user.user_id,
        })

        pubsub.publish('GROUP_CREATED', {
          groupCreated: {
            blame: actionUser,
            group: pmGroup,
          },
        })

        return pmGroup
      }
      if (user_id.length > 1) {
        const userIds = [...user_id, user.user_id]

        const newGroup = await Groups.create({
          group_name: 'New Group',
          last_message_date: Date.now(),
          group_picture: 'default-icon.png',
          is_group: true,
        })

        const createUserGroups = await Promise.all(
          userIds.map(async (user) => {
            const userGroup = await UserGroups.create({
              user_id: user,
              group_id: newGroup.id,
            })
            return userGroup
          })
        )

        const defaultGroupRole = await GroupRoles.create({
          role_name: 'Member',
          emoji: ' ',
          description: ' ',
          group_id: newGroup.id,
          is_default: true,
        })

        const defaultCreatorRole = await GroupRoles.create({
          role_name: 'Group Creator',
          emoji: ' ',
          description: 'Group Creator',
          group_id: newGroup.id,
          role_type: 'MODERATOR',
          is_default: true,
        })

        await Promise.all(
          createUserGroups.map(async (usergroup) => {
            if (usergroup.user_id === user.user_id) {
              await UserGroupRoles.create({
                user_group_id: usergroup.id,
                group_role_id: defaultCreatorRole.id,
              })
              await UserGroupRoles.create({
                user_group_id: usergroup.id,
                group_role_id: defaultGroupRole.id,
              })
            } else {
              await UserGroupRoles.create({
                user_group_id: usergroup.id,
                group_role_id: defaultGroupRole.id,
              })
            }
          })
        )

        const actionUserSection = await Sections.findOne({
          where: { id: actionUser.section_id },
        })

        await UserLogs.create({
          full_name: `${actionUser.first_name} ${actionUser.last_name}`,
          section: `${actionUserSection.section_name}`,
          action_description: `Started a new group conversation with ${user_id.length} people`,
          user_id: user.user_id,
        })

        pubsub.publish('GROUP_CREATED', {
          groupCreated: {
            blame: actionUser,
            group: newGroup,
          },
        })

        return newGroup
      }
    },
    addUserGroup: (_, { user_id, group_id }) => {
      return UserGroups.create({ user_id, group_id })
    },
    addGroupRole: async (_, { role_name, emoji, description, group_id }) => {
      const validation = await GroupRoles.findOne({
        where: { role_name, group_id },
      })

      if (!validation) {
        return GroupRoles.create({ role_name, emoji, description, group_id })
      } else {
        throw new GraphQLError('role already exist')
      }
    },
    addUserGroupRole: (_, { user_group_id, group_role_id }) => {
      return UserGroupRoles.create({
        user_group_id,
        group_role_id,
      })
    },
    addUserChatReaction: (_, { reaction, count, userchat_id }) => {
      return UserChatReactions.create({
        reaction,
        count,
        userchat_id,
      })
    },
    login: async (_, { username, password }, context) => {
      const user = await Users.findOne({
        where: { username },
      })

      if (!user) {
        throw new GraphQLError('Username or password does not match')
      }

      const checkPassword = await bcrypt.compare(password, user.password)

      if (user.disabled) {
        throw new GraphQLError('User Disabled')
      }

      if (!checkPassword) {
        throw new GraphQLError('Username or password does not match')
      }

      const refreshToken = signRefreshToken(user)

      context.req.session.refresh_token = refreshToken
      context.req.session.save()
      context.res.status(400)

      const userSection = await Sections.findOne({
        where: { id: user.section_id },
      })

      await UserLogs.create({
        full_name: `${user.first_name} ${user.last_name}`,
        section: `${userSection.section_name}`,
        action_description: `Has logged in`,
        user_id: user.id,
      })

      return { access_token: signAccessToken(user) }
    },
    revokeRefreshToken: async (_, { user_id }, context) => {
      authMiddleware(context)

      const increment = await Users.increment(
        { token_version: 1 },
        { where: { id: user_id } }
      )

      if (increment) return true
      else return false
    },
    logout: async (_, __, context) => {
      const { res, data: user, req } = authMiddleware(context)

      const actionUser = await Users.findOne({ where: { id: user.user_id } })

      const actionUserSection = await Sections.findOne({
        where: { id: actionUser.section_id },
      })

      await UserLogs.create({
        full_name: `${actionUser.first_name} ${actionUser.last_name}`,
        section: `${actionUserSection.section_name}`,
        action_description: `Has logged out`,
        user_id: user.user_id,
      })

      return new Promise((resolve, reject) =>
        req.session.destroy((error) => {
          if (error) {
            console.log(error)
            reject(false)
          }
          res.clearCookie('session')
          resolve(true)
        })
      )
    },
    addMember: async (_, { group_id, user_id }, context) => {
      const { pubsub, data: user } = authMiddleware(context)

      const usersAdded = await Users.findAll({ where: { id: user_id } })
      const group = await Groups.findOne({ where: { id: group_id } })

      const initialUserIds = await Promise.all(
        user_id.map(async (id) => {
          const validate = await UserGroups.findOne({
            where: { user_id: id, group_id },
          })

          if (validate) return null
          return { user_id: id, group_id }
        })
      )

      const userIds = initialUserIds.filter((id) => id !== null)

      if (group.is_group === true) {
        if (userIds.length > 0) {
          const bulkUserGroups = await Promise.all(
            userIds.map(async (user) => {
              const userGroup = await UserGroups.create(user)
              return userGroup
            })
          )

          const defaultRole = await GroupRoles.findOne({
            where: { role_name: 'Member', group_id },
          })

          let users = []
          const usergroup_roles = await Promise.all(
            bulkUserGroups.map(async (user_group_id) => {
              const usergroup_role = await UserGroupRoles.create({
                user_group_id: user_group_id.id,
                group_role_id: defaultRole.id,
              })

              const user = await Users.findOne({
                where: { id: user_group_id.user_id },
              })

              users.push({
                user,
                role: defaultRole,
              })
              return usergroup_role
            })
          )
          const blame = await Users.findOne({ where: { id: user.user_id } })

          const addedUsers = usersAdded.map((user) => {
            return `${user.first_name} ${user.last_name}`
          })

          const blameSection = await Sections.findOne({
            where: { id: blame.id },
          })

          await UserLogs.create({
            full_name: `${blame.first_name} ${blame.last_name}`,
            section: `${blameSection.section_name}`,
            action_description: `Added ${addedUsers.toString()} to ${
              group.group_name
            }`,
            user_id: user.user_id,
          })
          pubsub.publish('MEMBER_ADDED', {
            memberAdded: {
              users,
              group,
              group_roles: [defaultRole],
              usergroups: bulkUserGroups,
              usergroup_roles,
              blame,
            },
          })

          return bulkUserGroups
        }
      } else {
        const userGroup = await UserGroups.findAll({ where: { group_id } })
        const pmUsers = userGroup.map((user) => user.user_id)

        const newGroupUsers = pmUsers.concat(user_id)

        const newGroupUsersData = await Users.findAll({
          where: { id: newGroupUsers },
        })

        const newGroup = await Groups.create({
          group_name: 'New Group',
          is_group: true,
          last_message_date: Date.now(),
        })

        const createUserGroups = await Promise.all(
          newGroupUsersData.map(async (userdata) => {
            const createUserGroup = await UserGroups.create({
              group_id: newGroup.id,
              user_id: userdata.id,
            })

            return createUserGroup
          })
        )

        const defaultGroupRole = await GroupRoles.create({
          role_name: 'Member',
          emoji: ' ',
          description: ' ',
          group_id: newGroup.id,
          is_default: true,
        })

        const defaultCreatorRole = await GroupRoles.create({
          role_name: 'Group Creator',
          emoji: ' ',
          description: 'Group Creator',
          group_id: newGroup.id,
          role_type: 'MODERATOR',
          is_default: true,
        })

        const createDefaultUserGroupRoles = await Promise.all(
          createUserGroups.map(async (usergroup) => {
            if (usergroup.user_id === user.user_id) {
              const createDefaultUserGroupRole = await UserGroupRoles.create({
                user_group_id: usergroup.id,
                group_role_id: defaultCreatorRole.id,
              })
              await UserGroupRoles.create({
                user_group_id: usergroup.id,
                group_role_id: defaultGroupRole.id,
              })

              return createDefaultUserGroupRole
            } else {
              const createDefaultUserGroupRole = await UserGroupRoles.create({
                user_group_id: usergroup.id,
                group_role_id: defaultGroupRole.id,
              })
              return createDefaultUserGroupRole
            }
          })
        )

        const blame = await Users.findOne({ where: { id: user.user_id } })

        const addedUsers = usersAdded.map((user) => {
          return `${user.first_name} ${user.last_name}`
        })

        const blameSection = await Sections.findOne({
          where: { id: blame.id },
        })

        await UserLogs.create({
          full_name: `${blame.first_name} ${blame.last_name}`,
          section: `${blameSection.section_name}`,
          action_description: `Added ${addedUsers.toString()} to ${
            newGroup.group_name
          }`,
          user_id: blame.id,
        })
        pubsub.publish('MEMBER_ADDED', {
          memberAdded: {
            users: newGroupUsersData,
            group: newGroup,
            group_roles: [defaultCreatorRole, defaultGroupRole],
            usergroups: createUserGroups,
            usergroup_roles: createDefaultUserGroupRoles,
            blame,
          },
        })
        return createUserGroups
      }
    },
    updateGroup: async (
      _,
      { group_name, group_id, group_picture },
      context
    ) => {
      const { pubsub, data: user } = authMiddleware(context)

      if (group_picture) {
        const { createReadStream, filename } = await group_picture
        let filepath = '../files/grouppfp'
        let newFileName = `${uuid()} ${filename}`

        await new Promise((res) =>
          createReadStream()
            .pipe(
              createWriteStream(path.join('__dirname', filepath, newFileName))
            )
            .on('close', res)
        )
        await Groups.update(
          { group_picture: newFileName, group_name },
          { where: { id: group_id } }
        )
      } else {
        await Groups.update({ group_name }, { where: { id: group_id } })
      }

      const updatedGroup = await Groups.findOne({ where: { id: group_id } })

      const actionUser = await Users.findOne({ where: { id: user.user_id } })

      const actionUserSection = await Sections.findOne({
        where: { id: actionUser.id },
      })

      await UserLogs.create({
        full_name: `${actionUser.first_name} ${actionUser.last_name}`,
        section: `${actionUserSection.section_name}`,
        action_description: `Updated the group_name of group ${updatedGroup.id} from ${group_name} to ${updatedGroup.group_name}`,
        user_id: user.user_id,
      })

      pubsub.publish('GROUP_UPDATE', {
        groupUpdate: updatedGroup,
      })

      return updatedGroup
    },
    removeMember: async (_, { group_id, user_id }, context) => {
      const { pubsub, data: user } = authMiddleware(context)

      const userGroup = await UserGroups.findOne({
        where: { group_id, user_id },
      })

      const userGroupRoles = await UserGroupRoles.findAll({
        where: { user_group_id: userGroup.id },
      })

      const groupRoles = (
        await GroupRoles.findAll({
          where: {
            id: userGroupRoles.map(
              (usergrouprole) => usergrouprole.group_role_id
            ),
          },
        })
      ).map((role) => role.role_name)

      if (groupRoles.includes('Group Creator')) return null

      const removedUser = await Users.findOne({ where: { id: user_id } })

      const group = await Groups.findOne({ where: { id: group_id } })
      const blame = await Users.findOne({ where: { id: user.user_id } })

      await UserGroups.destroy({ where: { group_id, user_id } })

      const blameSection = await Sections.findOne({
        where: { id: blame.id },
      })

      await UserLogs.create({
        full_name: `${blame.first_name} ${blame.last_name}`,
        section: `${blameSection.section_name}`,
        action_description: `Removed ${removedUser.first_name} ${removedUser.last_name} from group ${group.id}`,
        user_id: user.user_id,
      })

      pubsub.publish('MEMBER_REMOVED', {
        memberRemoved: {
          blame,
          group,
          user: removedUser,
        },
      })

      return removedUser
    },
    updateUserProfile: async (
      _,
      {
        username,
        address,
        section_id,
        gender,
        profile_img,
        birthdate,
        current_confirmation,
        new_password,
      },
      context
    ) => {
      const { data: user } = authMiddleware(context)

      const initialUser = await Users.findOne({ where: { id: user.user_id } })

      const checkPassword = await bcrypt.compare(
        current_confirmation,
        initialUser.password
      )

      if (!checkPassword) return null

      let password = await bcrypt.hash(new_password, 10)
      if (!new_password || new_password === '') {
        password = initialUser.password
      }

      let newImage = initialUser.profile_img

      if (profile_img) {
        const { createReadStream, filename } = await profile_img
        let filepath = '../files/pfp'
        newImage = `${uuid()} ${filename}`

        await new Promise((res) =>
          createReadStream()
            .pipe(createWriteStream(path.join('__dirname', filepath, newImage)))
            .on('close', res)
        )
      }

      await Users.update(
        {
          username,
          address,
          section_id,
          gender,
          profile_img: newImage,
          password,
          birthdate,
        },
        { where: { id: user.user_id } }
      )

      const updatedUser = await Users.findOne({ where: { id: user.user_id } })

      const initialUserSection = await Sections.findOne({
        where: { id: initialUser.section_id },
      })
      await UserLogs.create({
        full_name: `${initialUser.first_name} ${initialUser.last_name}`,
        section: `${initialUserSection.section_name}`,
        action_description: `Updated their User Profile`,
        user_id: initialUser.id,
      })

      return updatedUser
    },
    updateGroupRoles: async (
      _,
      { roles_to_edit, roles_to_delete, group_id },
      context
    ) => {
      const { data: user, pubsub } = authMiddleware(context)

      const actionUser = await Users.findOne({ where: { id: user.user_id } })

      const rolesToUpdate = roles_to_edit.filter((role) => role.id !== null)
      const rolesToCreate = roles_to_edit.filter((role) => role.id === null)

      const createRoles = await Promise.all(
        rolesToCreate.map(async (role) => {
          const createRole = await GroupRoles.create({
            role_name: role.role_name,
            role_type: role.role_type,
            description: role.description,
            emoji: role.emoji,
            group_id,
          })
          return createRole
        })
      )

      const updateRoles = await Promise.all(
        rolesToUpdate.map(async (role) => {
          await GroupRoles.update(
            {
              role_name: role.role_name,
              emoji: role.emoji,
              description: role.description,
              role_type: role.role_type,
            },
            { where: { id: role.id } }
          )
          const updatedRole = await GroupRoles.findOne({
            where: { id: role.id },
          })

          return updatedRole
        })
      )
      let deleteRoles
      const rolesToDelete = roles_to_delete.filter((role) => role !== null)
      if (rolesToDelete.length > 0) {
        deleteRoles = await Promise.all(
          rolesToDelete.map(async (role) => {
            const deleteRole = await GroupRoles.destroy({
              where: { id: role },
            })
            return deleteRole
          })
        )
      }

      const actionUserSection = await Sections.findOne({
        where: { id: actionUser.section_id },
      })

      await UserLogs.create({
        full_name: `${actionUser.first_name} ${actionUser.last_name}`,
        section: `${actionUserSection.section_name}`,
        action_description: `Updated the Group roles of group ${group_id}`,
        user_id: actionUser.id,
      })

      const newRoles = updateRoles.concat(createRoles)
      pubsub.publish('GROUP_ROLES_UPDATED', {
        groupRolesUpdated: {
          newRoles: newRoles,
          group_id,
        },
      })

      return newRoles
    },
    updateUserGroupRoles: async (
      _,
      { group_id, roles, user_id, roles_ids },
      context
    ) => {
      const { data: user, pubsub } = authMiddleware(context)
      const targetUser = await Users.findOne({ where: { id: user_id } })
      const actionUser = await Users.findOne({ where: { id: user.user_id } })

      const userGroup = await UserGroups.findOne({
        where: { group_id, user_id },
      })

      const currentUserGroupRoles = await UserGroupRoles.findAll({
        where: { user_group_id: userGroup.id },
      })

      const filterDeleteRoles = await Promise.all(
        currentUserGroupRoles.map(async (usergrouprole) => {
          const groupRole = await GroupRoles.findOne({
            where: { id: usergrouprole.group_role_id },
          })

          if (!roles.includes(groupRole.role_name)) {
            await UserGroupRoles.destroy({
              where: {
                user_group_id: usergrouprole.user_group_id,
                group_role_id: usergrouprole.group_role_id,
              },
            })
          }

          return groupRole.role_name
        })
      )

      const rolesToAdd = roles.filter(
        (role) => !filterDeleteRoles.includes(role)
      )

      await Promise.all(
        rolesToAdd.map(async (role) => {
          const groupRole = await GroupRoles.findOne({
            where: { group_id, role_name: role },
          })

          await UserGroupRoles.create({
            user_group_id: userGroup.id,
            group_role_id: groupRole.id,
          })
        })
      )
      const actionUserSection = await Sections.findOne({
        where: { id: actionUser.section_id },
      })

      await UserLogs.create({
        full_name: `${actionUser.first_name} ${actionUser.last_name}`,
        section: `${actionUserSection.section_name}`,
        action_description: `Updated the Group roles of User ${targetUser.id} in Group ${group_id}`,
        user_id: actionUser.id,
      })

      pubsub.publish('MEMBER_ROLES_UPDATED', {
        memberRolesUpdated: {
          newRoles: roles,
          user: targetUser,
          group_id,
          roles_ids,
        },
      })

      return {
        newRoles: roles,
        user: targetUser,
      }
    },
    submitReport: async (_, { group_id, reasons }, context) => {
      const { data: user } = authMiddleware(context)

      const reportIssuer = await Users.findOne({ where: { id: user.user_id } })

      const reportReasons = reasons
        .filter((reason) => reason !== 'Others')
        .toString()
        .replace(/,/g, ', ')

      const submit = await Reports.create({
        report_reason: reportReasons,
        group_id,
        user_id: user.user_id,
      })

      const reportIssuerSection = await Sections.findOne({
        where: { id: reportIssuer.section_id },
      })

      await UserLogs.create({
        full_name: `${reportIssuer.first_name} ${reportIssuer.last_name}`,
        section: `${reportIssuerSection.section_name}`,
        action_description: `Submitted a report on Group ${group_id}`,
        user_id: reportIssuer.id,
      })

      return submit
    },
    updateReportStatus: async (_, { report_status, report_id }, context) => {
      const { data: user } = authMiddleware(context)

      const actionUser = await Users.findOne({ where: { id: user.user_id } })

      const report = await Reports.findOne({ where: { id: report_id } })

      if (actionUser.access_level !== 'ADMIN') return
      if (report_status === report.is_resolved) return

      await Reports.update(
        { is_resolved: report_status, date_resolved: Date.now() },
        { where: { id: report_id } }
      )

      await AdminLogs.create({
        full_name: `${actionUser.first_name} ${actionUser.last_name}`,
        action_description: `Changed the status of report ${report_id} from ${
          report.is_resolved ? 'Resolved' : 'Pending'
        } to ${!report.is_resolved ? 'Resolved' : 'Pending'}`,
        user_id: actionUser.id,
      })

      const newReport = await Reports.findOne({ where: { id: report_id } })

      return newReport
    },
    toggleUserStatus: async (_, { user_id, user_status }, context) => {
      const { data: user } = authMiddleware(context)

      const actionUser = await Users.findOne({ where: { id: user.user_id } })

      if (actionUser.access_level !== 'ADMIN') return false

      await Users.update({ disabled: user_status }, { where: { id: user_id } })

      const targetUser = await Users.findOne({ where: { id: user_id } })

      await AdminLogs.create({
        full_name: `${actionUser.first_name} ${actionUser.last_name}`,
        action_description: `${user_status ? 'Enabled' : 'Disabled'} ${
          targetUser.username
        }'s account`,
        user_id: actionUser.id,
      })

      if (user_status === true) {
        await Users.increment({ token_version: 1 }, { where: { id: user_id } })
      }

      return true
    },
    adminUpdateUserProfile: async (_, { userData }, context) => {
      const { data: user } = authMiddleware(context)

      const actionUser = await Users.findOne({
        where: { id: user.user_id },
      })

      const initialUser = await Users.findOne({
        where: { id: userData.user_id },
      })

      if (actionUser.access_level !== 'ADMIN') return

      let newImage = initialUser.profile_img
      if (userData.profile_img) {
        const { createReadStream, filename } = await userData.profile_img
        let filepath = '../files/pfp'
        newImage = `${uuid()} ${filename}`

        await new Promise((res) =>
          createReadStream()
            .pipe(createWriteStream(path.join('__dirname', filepath, newImage)))
            .on('close', res)
        )
      }

      const new_password = await bcrypt.hash(userData.new_password, 10)

      await Users.update(
        {
          username: userData.username,
          first_name: userData.first_name,
          last_name: userData.last_name,
          access_level: userData.access_level,
          password: new_password,
          profile_img: newImage,
        },
        { where: { id: userData.user_id } }
      )

      const updatedUser = await Users.findOne({
        where: { id: userData.user_id },
      })

      await AdminLogs.create({
        full_name: `${actionUser.first_name} ${actionUser.last_name}`,
        action_description: `Updated the profile of user ${userData.user_id}`,
        user_id: actionUser.id,
      })

      return updatedUser
    },
    createSection: async (_, { section_name }, context) => {
      const { data: user } = authMiddleware(context)

      const actionUser = await Users.findOne({ where: { id: user.user_id } })

      if (actionUser.access_level !== 'ADMIN') {
        throw new GraphQLError('Current User is not an Admin')
      }

      const newSection = await Sections.create({ section_name })

      await AdminLogs.create({
        full_name: `${actionUser.first_name} ${actionUser.last_name}`,
        action_description: `Created a new section ${newSection.section_name} with id ${newSection.id}`,
        user_id: actionUser.id,
      })

      return newSection
    },
    toggleSectionStatus: async (_, { section_id, status }, context) => {
      const { data: user } = authMiddleware(context)

      const actionUser = await Users.findOne({ where: { id: user.user_id } })

      if (actionUser.access_level !== 'ADMIN') {
        throw new GraphQLError('Current User is not an Admin')
      }

      await Sections.update({ disabled: status }, { where: { id: section_id } })

      const updatedSection = await Sections.findOne({
        where: { id: section_id },
      })

      await AdminLogs.create({
        full_name: `${actionUser.first_name} ${actionUser.last_name}`,
        action_description: `${status ? 'Disabled' : 'Enabled'} section ${
          updatedSection.section_name
        } with id ${updatedSection.id}`,
        user_id: actionUser.id,
      })

      return updatedSection
    },
    updateSection: async (_, { section_name, section_id }, context) => {
      const { data: user } = authMiddleware(context)

      const actionUser = await Users.findOne({ where: { id: user.user_id } })

      if (actionUser.access_level !== 'ADMIN') {
        throw new GraphQLError('Current User is not an Admin')
      }

      const prevSection = await Sections.findOne({ where: { id: section_id } })

      await Sections.update({ section_name }, { where: { id: section_id } })

      const updatedSection = await Sections.findOne({
        where: { id: section_id },
      })

      await AdminLogs.create({
        full_name: `${actionUser.first_name} ${actionUser.last_name}`,
        action_description: `Updated the name of section ${updatedSection.id} from ${prevSection.section_name} to ${updatedSection.section_name}`,
        user_id: actionUser.id,
      })

      return updatedSection
    },
  },
  Subscription: {
    memberRolesUpdated: {
      subscribe: withFilter(
        (_, __, { pubsub }) => pubsub.asyncIterator('MEMBER_ROLES_UPDATED'),
        async (payload, variables) => {
          const userGroup = await UserGroups.findOne({
            where: {
              user_id: variables.user,
              group_id: payload.memberRolesUpdated.group_id,
            },
          })

          if (userGroup) {
            return true
          }
          return false
        }
      ),
    },
    groupCreated: {
      subscribe: withFilter(
        (_, __, { pubsub }) => pubsub.asyncIterator('GROUP_CREATED'),
        async (payload, variables) => {
          const userGroup = await UserGroups.findOne({
            where: {
              user_id: variables.user,
              group_id: payload.groupCreated.group.id,
            },
          })

          if (userGroup) {
            return true
          }
          return false
        }
      ),
    },
    memberAdded: {
      subscribe: withFilter(
        (_, __, { pubsub }) => pubsub.asyncIterator('MEMBER_ADDED'),
        async (payload, variables) => {
          const userGroup = await UserGroups.findOne({
            where: {
              user_id: variables.user,
              group_id: payload.memberAdded.group.id,
            },
          })

          if (userGroup) {
            return true
          }
          return false
        }
      ),
    },
    chatAdded: {
      subscribe: withFilter(
        (_, __, { pubsub }) => pubsub.asyncIterator('CHAT_ADDED'),
        async (payload, variables) => {
          const userGroup = await UserGroups.findOne({
            where: {
              user_id: variables.user,
              group_id: payload.chatAdded.receiver,
            },
          })

          if (userGroup) {
            return true
          }
          return false
        }
      ),
    },
    groupUpdate: {
      subscribe: withFilter(
        (_, __, { pubsub }) => pubsub.asyncIterator('GROUP_UPDATE'),
        async (payload, variables) => {
          const userGroup = await UserGroups.findOne({
            where: {
              user_id: variables.user,
              group_id: payload.groupUpdate.id,
            },
          })

          if (userGroup) {
            return true
          }
          return false
        }
      ),
    },
    memberRemoved: {
      subscribe: withFilter(
        (_, __, { pubsub }) => pubsub.asyncIterator('MEMBER_REMOVED'),
        async (payload, variables) => {
          const userGroup = await UserGroups.findOne({
            where: {
              user_id: variables.user,
              group_id: payload.memberRemoved.group.id,
            },
          })

          const removedUser = await Users.findOne({
            where: { id: payload.memberRemoved.user.id },
          })

          if (userGroup || removedUser.id === variables.user) {
            return true
          }
          return false
        }
      ),
    },
    groupRolesUpdated: {
      subscribe: withFilter(
        (_, __, { pubsub }) => pubsub.asyncIterator('GROUP_ROLES_UPDATED'),
        async (payload, variables) => {
          const userGroup = await UserGroups.findOne({
            where: {
              user_id: variables.user,
              group_id: payload.groupRolesUpdated.group_id,
            },
          })

          if (userGroup) {
            return true
          }
          return false
        }
      ),
    },
  },
}

export default resolvers
