import { redis } from '../../config/redis.js'

const rateLimitMiddleware = async (context) => {
  const { req } = context
  console.log('hi')

  const key = `rate limit for ${req.ip}`

  const limit = 5
  const currentRate = await redis.incr(key)

  if (currentRate > limit) {
    console.log('limite reached')
    throw new Error('You have reached the limit for logging in, please try again in 20 minutes')
  }
}

export { rateLimitMiddleware }
