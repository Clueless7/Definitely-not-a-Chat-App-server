import jwt from 'jsonwebtoken'

const authMiddleware = (context) => {
  const { req, res, pubsub } = context

  const authorization = req.headers.authorization
  let data

  if (!authorization) {
    data = null
    throw new Error('not authenticated')
  }
  if (authorization.startsWith('bearer') === false) {
    throw new Error('not authenticated')
  }

  try {
    const token = authorization.split(' ')[1]
    const tokendata = jwt.verify(token, process.env.ACCESS_SECRET)
    data = tokendata
  } catch (err) {
    data = null
    throw new Error('not authenticated')
  }

  return { req, res, data, pubsub }
}

export { authMiddleware }
