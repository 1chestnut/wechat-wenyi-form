const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    console.log("收到录音数据:", event)
    
    const { recordingData,sessionid } = event
    const wxContext = cloud.getWXContext()
    const OPENID = wxContext.OPENID
    
    console.log("用户OpenID:", OPENID)
    console.log("录音数据:", recordingData)
    console.log("SessionID:", sessionid)  // 添加日志

    // 验证必要数据
    if (!recordingData) {
      return {
        code: 1,
        message: '录音数据不能为空'
      }
    }

    if (!sessionid) {
      return {
        code: 1,
        message: 'sessionid不能为空'
      }
    }

    // 数据验证
    const validationResult = validateRecordingData(recordingData)
    if (!validationResult.valid) {
      return {
        code: 1,
        message: validationResult.message
      }
    }

    // 处理数据
    const processedData = processRecordingData(recordingData)
    
    // 准备数据库数据
    const dbData = {
      openid: OPENID,
      filePath: recordingData.filePath,
      fileID: recordingData.fileID,
      duration: recordingData.duration,
      fileSize: recordingData.fileSize,
      durationFormatted: processedData.durationFormatted,
      fileSizeFormatted: processedData.fileSizeFormatted,
      recordingType: processedData.recordingType,
      sessionid: sessionid,  // 在这里添加sessionid
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }

    console.log("准备写入数据库的数据:", dbData)

    // 写入数据库
    const res = await db.collection('recording_records').add({
      data: dbData
    })

    console.log("录音数据写入成功，文档ID:", res._id)

    return {
      code: 0,
      message: '录音信息提交成功',
      data: {
        _id: res._id,
        filePath: recordingData.filePath,
        fileID: recordingData.fileID,
        duration: recordingData.duration,
        fileSize: recordingData.fileSize,
        durationFormatted: processedData.durationFormatted,
        fileSizeFormatted: processedData.fileSizeFormatted,
        recordingType: processedData.recordingType,
        sessionid: sessionid  // 返回给前端确认
      }
    }
    
  } catch (error) {
    console.error("录音信息提交失败:", error)
    
    return {
      code: 1,
      message: '提交失败: ' + error.message,
      error: error.message
    }
  }
}

// 录音数据验证
function validateRecordingData(recordingData) {
  // 文件路径验证
  if (!recordingData.filePath || recordingData.filePath.trim() === '') {
    return {
      valid: false,
      message: '录音文件路径不能为空'
    }
  }

  // 时长验证
  if (typeof recordingData.duration !== 'number' || isNaN(recordingData.duration)) {
    return {
      valid: false,
      message: '录音时长必须是数字'
    }
  }

  if (recordingData.duration < 0) {
    return {
      valid: false,
      message: '录音时长不能为负数'
    }
  }

  if (recordingData.duration > 60000) {
    return {
      valid: false,
      message: '录音时长超过限制'
    }
  }

  // 文件大小验证
  if (typeof recordingData.fileSize !== 'number' || isNaN(recordingData.fileSize)) {
    return {
      valid: false,
      message: '文件大小必须是数字'
    }
  }

  if (recordingData.fileSize < 0) {
    return {
      valid: false,
      message: '文件大小不能为负数'
    }
  }

  if (recordingData.fileSize > 10 * 1024 * 1024) { // 10MB限制
    return {
      valid: false,
      message: '文件大小超过限制'
    }
  }

  return {
    valid: true,
    message: '验证通过'
  }
}

// 处理录音数据
function processRecordingData(recordingData) {
  // 格式化时长（毫秒转秒）
  const durationInSeconds = (recordingData.duration / 1000).toFixed(1)
  const durationFormatted = `${durationInSeconds}秒`
  
  // 格式化文件大小（字节转KB/MB）
  let fileSizeFormatted
  if (recordingData.fileSize < 1024) {
    fileSizeFormatted = `${recordingData.fileSize}B`
  } else if (recordingData.fileSize < 1024 * 1024) {
    fileSizeFormatted = `${(recordingData.fileSize / 1024).toFixed(1)}KB`
  } else {
    fileSizeFormatted = `${(recordingData.fileSize / (1024 * 1024)).toFixed(1)}MB`
  }
  
  // 根据时长判断录音类型
  let recordingType
  if (recordingData.duration < 5000) {
    recordingType = '短录音'
  } else if (recordingData.duration < 30000) {
    recordingType = '中等录音'
  } else {
    recordingType = '长录音'
  }

  return {
    durationFormatted,
    fileSizeFormatted,
    recordingType
  }
}

// 获取录音质量评估
function assessRecordingQuality(duration, fileSize) {
  if (duration < 1000) {
    return '录音过短'
  }
  
  const bitrate = (fileSize * 8) / (duration / 1000) // 计算比特率 (bps)
  
  if (bitrate < 32000) {
    return '低质量'
  } else if (bitrate < 64000) {
    return '中等质量'
  } else if (bitrate < 128000) {
    return '高质量'
  } else {
    return '极高质量'
  }
}