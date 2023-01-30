import Redis from "ioredis";

export const redis = new Redis({
  host: "redis-16006.c54.ap-northeast-1-2.ec2.cloud.redislabs.com",
  port: 16006,
  password: process.env.REDIS_PASSWORD,
});
