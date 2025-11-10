const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    console.log("收到CO浓度评估数据:", event)
    
    const { formData, sessionid } = event
    const wxContext = cloud.getWXContext()
    const OPENID = wxContext.OPENID
    
    console.log("用户OpenID:", OPENID)
    console.log("CO评估表单数据:", formData)
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
    // 数据验证
    const validationResult = validateFormData(formData)
    if (!validationResult.valid) {
      return {
        code: 1,
        message: validationResult.message
      }
    }

    // 处理数据
    const processedData = processFormData(formData)
    
    // 评估CO浓度水平
    const assessment = assessCOLevel(Number(formData.coConcentration))

    // 准备数据库数据
    const dbData = {
      openid: OPENID,
      coConcentration: Number(formData.coConcentration),
      lastSmokeTime: processedData.lastSmokeTime,
      assessment: assessment,
      riskLevel: getRiskLevel(Number(formData.coConcentration)),
      sessionid: sessionid,  // 在这里添加sessionid
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }

    console.log("准备写入数据库的数据:", dbData)

    // 写入数据库
    const res = await db.collection('C2_records').add({
      data: dbData
    })

    console.log("CO浓度评估数据写入成功，文档ID:", res._id)

    return {
      code: 0,
      message: 'CO浓度评估提交成功',
      data: {
        _id: res._id,
        coConcentration: Number(formData.coConcentration),
        lastSmokeTime: processedData.lastSmokeTime,
        assessment: assessment,
        riskLevel: dbData.riskLevel,
        sessionid: sessionid  // 返回给前端确认
      }
    }
    
  } catch (error) {
    console.error("CO浓度评估提交失败:", error)
    
    return {
      code: 1,
      message: '提交失败: ' + error.message,
      error: error.message
    }
  }
}

// 表单数据验证
function validateFormData(formData) {
  // CO浓度验证
  if (!formData.coConcentration || formData.coConcentration.trim() === '') {
    return {
      valid: false,
      message: '请输入CO浓度值'
    }
  }

  const coValue = Number(formData.coConcentration)
  if (isNaN(coValue)) {
    return {
      valid: false,
      message: 'CO浓度必须是数字'
    }
  }

  if (coValue < 0) {
    return {
      valid: false,
      message: 'CO浓度不能为负数'
    }
  }

  if (coValue > 100) {
    return {
      valid: false,
      message: 'CO浓度值过高，请检查输入'
    }
  }

  // 最近吸烟时间验证
  if (!formData.lastSmokeTime) {
    return {
      valid: false,
      message: '请选择最近吸烟时间'
    }
  }

  return {
    valid: true,
    message: '验证通过'
  }
}

// 处理表单数据
function processFormData(formData) {
  // 吸烟时间转换
  const timeMap = {
    '1': '1小时之内',
    '2': '1-12小时之间',
    '3': '12小时-24小时之间',
    '4': '24小时之前'
  };
  
  return {
    lastSmokeTime: timeMap[formData.lastSmokeTime] || formData.lastSmokeTime
  }
}

// 评估CO浓度水平
function assessCOLevel(coValue) {
  if (coValue < 6) {
    return '正常水平（非吸烟者水平）'
  } else if (coValue <= 10) {
    return '轻度吸烟暴露'
  } else if (coValue <= 20) {
    return '中度吸烟暴露'
  } else if (coValue <= 30) {
    return '重度吸烟暴露'
  } else {
    return '极高吸烟暴露'
  }
}

// 获取风险等级
function getRiskLevel(coValue) {
  if (coValue < 6) {
    return '低风险'
  } else if (coValue <= 10) {
    return '轻度风险'
  } else if (coValue <= 20) {
    return '中度风险'
  } else if (coValue <= 30) {
    return '高度风险'
  } else {
    return '极高风险'
  }
}