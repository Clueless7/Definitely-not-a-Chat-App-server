import { redis } from '../../config/redis.js'

const rateLimitMiddleware = async (context) => {
  const { req } = context

  const key = `rate limit for ${req.ip}`

  const limit = 5
  const currentRate = await redis.incr(key)

  if (currentRate > limit) {
    await redis.expire(key, 60 * 20)
    return 'You have reached the limit for logging in, please try again in 20 minutes'
  }
  return null
}

export { rateLimitMiddleware }
