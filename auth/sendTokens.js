export const sendRefreshToken = (res, token) => {
  res.cookie('refresh-token', token, {
    expiresIn: 60 * 60 * 24 * 7,
    httpOnly: true,
    // sameSite: 'None',
    // secure: true,
  })
}
