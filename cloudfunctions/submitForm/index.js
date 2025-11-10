const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    console.log("收到的参数:", event)

    // 从event中获取formData和sessionid
    const { formData, sessionid } = event
    const { OPENID } = cloud.getWXContext()

    console.log("使用的sessionid:", sessionid)

    // ✅ 写入数据库，使用前端传递的sessionid
    const res = await db.collection('user-list').add({
      data: {
        ...formData,
        openid: OPENID,
        sessionid: sessionid, // 使用前端传递的sessionid
        createTime: db.serverDate()
      }
    })

    console.log("写入成功:", res)

    return {
      code: 0,
      msg: 'success',
      id: res._id,
      sessionid: sessionid // 返回相同的sessionid
    }

  } catch (err) {
    console.error("云函数报错:", err)
    return {
      code: -1,
      msg: err.message
    }
  }
}