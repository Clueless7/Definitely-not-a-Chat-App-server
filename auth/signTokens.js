import jwt from 'jsonwebtoken'

function signAccessToken(user) {
  return jwt.sign({ user_id: user.id }, process.env.ACCESS_SECRET, {
    expiresIn: '120s',
  })
}
function signRefreshToken(user) {
  return jwt.sign(
    { user_id: user.id, token_version: user.token_version },
    process.env.REFRESH_SECRET,
    {
      expiresIn: '7d',
    }
  )
}

export { signAccessToken, signRefreshToken }
