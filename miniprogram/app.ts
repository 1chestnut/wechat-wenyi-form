App({
  globalData: {
    currentSessionId: '' // 存储当前会话ID
  },
  onLaunch() {
    wx.cloud.init({
      env: "cloudbase-6gi3o3wsc74d144e",   
      traceUser: true
    })
  }
})
