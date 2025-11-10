const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    console.log("收到FTND评估数据:", event)
    
    const { formData, sessionid } = event  // 从event中获取sessionid
    const wxContext = cloud.getWXContext()
    const OPENID = wxContext.OPENID
    
    console.log("用户OpenID:", OPENID)
    console.log("FTND表单数据:", formData)
    console.log("SessionID:", sessionid)  // 添加日志

    // 验证必要数据
    if (!formData) {
      return {
        code: 1,
        message: '评估数据不能为空'
      }
    }

    // 验证sessionid
    if (!sessionid) {
      return {
        code: 1,
        message: 'sessionid不能为空'
      }
    }

    // 计算总分
    const totalScore = calculateFTNDScore(formData)
    
    // 评估依赖水平
    const dependencyLevel = assessFTNDLevel(totalScore)

    console.log("计算得分:", totalScore, "依赖水平:", dependencyLevel)

    // 准备数据库数据 - 将sessionid添加到dbData中
    const dbData = {
      openid: OPENID,
      answers: formData,
      totalScore: totalScore,
      dependencyLevel: dependencyLevel,
      sessionid: sessionid,  // 在这里添加sessionid
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }

    console.log("准备写入数据库的数据:", dbData)

    // 写入数据库 - 移除错误的sessionid参数
    const res = await db.collection('ftnd_records').add({
      data: dbData  // 只保留data参数
    })

    console.log("FTND评估数据写入成功，文档ID:", res._id)

    return {
      code: 0,
      message: 'FTND评估提交成功',
      data: {
        _id: res._id,
        totalScore: totalScore,
        dependencyLevel: dependencyLevel,
        sessionid: sessionid  // 返回给前端确认
      }
    }
    
  } catch (error) {
    console.error("FTND提交失败:", error)
    
    return {
      code: 1,
      message: '提交失败: ' + error.message,
      error: error.message
    }
  }
}

// 计算FTND总分
function calculateFTNDScore(formData) {
  let total = 0
  for (let key in formData) {
    if (formData[key] !== '' && formData[key] !== undefined) {
      total += parseInt(formData[key]) || 0
    }
  }
  console.log("计算总分:", total)
  return total
}

// 评估尼古丁依赖水平
function assessFTNDLevel(score) {
  let level
  if (score <= 2) {
    level = '很低'
  } else if (score <= 4) {
    level = '中度'
  } else if (score <= 7) {
    level = '高'
  } else {
    level = '很高'
  }
  console.log("评估依赖水平:", level)
  return level
}