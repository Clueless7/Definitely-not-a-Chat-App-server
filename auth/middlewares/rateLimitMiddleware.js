import { GraphQLError } from 'graphql'
import { redis } from '../../config/redis.js'

const rateLimitMiddleware = async (context) => {
  const { req } = context

  const key = `rate limit for ${req.ip}`

  const limit = 5
  const currentRate = await redis.incr(key)

  if (currentRate > limit) {
    await redis.expire(key, 60 * 20)
    return {limitReached: true}
  }

  return {limitReached:false}
}

export { rateLimitMiddleware }
