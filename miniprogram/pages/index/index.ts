// pages/index/index.ts
import sessionManager from '../../utils/sessionManager';

Page({
  data: {
    sessionId: '',
    gender: '',
    genderTouchStartX: 0,
    genderTouchStartTime: 0,
    age: '',
    height: '',
    weightInteger: '',
    weightDecimal: '',
    weight: '',
    smokeStartAge: '',
    smokePeriod: ''
  },

  formSubmit(e: any) {
    const formData = { ...e.detail.value }
    formData.gender = this.data.gender || formData.gender
    formData.age = this.data.age || formData.age
    formData.height = this.data.height || formData.height
    formData.smokeStartAge = this.data.smokeStartAge || formData.smokeStartAge
    formData.smokePeriod = this.data.smokePeriod || formData.smokePeriod
    // 组合体重：整数部分 + 小数部分
    const weightInt = this.data.weightInteger || formData.weightInteger || '0'
    const weightDec = this.data.weightDecimal || formData.weightDecimal || '0'
    formData.weight = weightInt + '.' + weightDec

    console.log("提交内容:", formData)

    if (!this.validateForm(formData)) return

    const processed = this.process(formData)

    this.submit(processed)
  },
  onLoad() {
    // 生成唯一会话ID
    const sessionId = sessionManager.generateSessionId();
    this.setData({ sessionId });
    wx.setStorageSync('currentSessionId', sessionId);
    console.log('生成会话ID:', sessionId);
  },
  validateForm(d: any) {
    // 验证年龄：必须是正整数且大于5岁
    if (!d.age || d.age.trim() === '') {
      return this.err("请输入年龄")
    }
    const age = Number(d.age)
    if (isNaN(age) || age <= 0 || !Number.isInteger(age)) {
      return this.err("年龄必须是正整数")
    }
    if (age <= 5) {
      return this.err("年龄必须大于5岁")
    }

    // 验证身高：必须是2-3位正整数，单位为cm
    if (!d.height || d.height.trim() === '') {
      return this.err("请输入身高")
    }
    const height = Number(d.height)
    if (isNaN(height) || height <= 0 || !Number.isInteger(height)) {
      return this.err("身高必须是正整数")
    }
    if (height < 10 || height > 999) {
      return this.err("请输入有效的身高（10-999cm）")
    }

    // 验证体重：必须输入，单位为kg
    const weightInt = d.weightInteger || this.data.weightInteger || '0'
    const weightDec = d.weightDecimal || this.data.weightDecimal || '0'
    const weight = Number(weightInt + '.' + weightDec)
    if (isNaN(weight) || weight <= 0) {
      return this.err("请输入体重")
    }
    if (weight > 500) {
      return this.err("请输入有效的体重（0-500kg）")
    }

    // 验证开始吸烟的年龄：必须输入
    if (!d.smokeStartAge || d.smokeStartAge.trim() === '') {
      return this.err("请输入开始吸烟的年龄")
    }
    const smokeStartAge = Number(d.smokeStartAge)
    if (isNaN(smokeStartAge) || smokeStartAge <= 0 || !Number.isInteger(smokeStartAge)) {
      return this.err("开始吸烟的年龄必须是正整数")
    }
    if (smokeStartAge < 1 || smokeStartAge > 150) {
      return this.err("请输入有效的开始吸烟年龄（1-150岁）")
    }

    // 验证吸烟年限：必须输入
    if (!d.smokePeriod || d.smokePeriod.trim() === '') {
      return this.err("请输入吸烟年限")
    }
    const smokePeriod = Number(d.smokePeriod)
    if (isNaN(smokePeriod) || smokePeriod <= 0 || !Number.isInteger(smokePeriod)) {
      return this.err("吸烟年限必须是正整数")
    }
    if (smokePeriod < 1 || smokePeriod > 150) {
      return this.err("请输入有效的吸烟年限（1-150年）")
    }

    // 验证：吸烟年龄必须小于实际年龄
    if (smokeStartAge >= age) {
      return this.err("开始吸烟的年龄必须小于实际年龄")
    }

    // 验证：吸烟年龄 + 吸烟年限必须小于实际年龄
    if (smokeStartAge + smokePeriod >= age + 1) {
      return this.err("开始吸烟的年龄加上吸烟年限必须小于实际年龄")
    }

    return true
  },

  onInputAge(e: any) {
    let value = e.detail.value || ''
    // 只允许输入数字
    value = value.replace(/[^\d]/g, '')
    // 限制最大长度为3位（最大999岁）
    if (value.length > 3) {
      value = value.slice(0, 3)
    }
    this.setData({ age: value })
  },
  checkSmokePara(age: any, smokeStartAge: any, smokePeriod: any) {
    if(Number(smokePeriod) > 0 && Number(smokeStartAge) + Number(smokePeriod) >= Number(age) + 1) {
      wx.showToast({
        title: '开始吸烟年龄+吸烟年限必须小于实际年龄',
        icon: 'none',
        duration: 2000
      })
    }
  },
  onBlurAge(e: any) {
    const value: string = e.detail.value || '';
    const age: number = Number(value);
    if (value && value !== '') {
      if (age > 0 && age <= 5) {
        wx.showToast({
          title: '年龄必须大于5岁',
          icon: 'none',
          duration: 2000
        });
        this.setData({ age: '' });
      } else if (age > 150) {
         wx.showToast({
          title: '请输入有效年龄',
          icon: 'none',
          duration: 2000
        });
        this.setData({ age: '' });
      } else {
        // 如果已经填写了吸烟年龄和吸烟年限，验证它们
        const smokeStartAge = Number(this.data.smokeStartAge)
        const smokePeriod = Number(this.data.smokePeriod)
        if (smokeStartAge > 0) {
          if (smokeStartAge >= age) {
            wx.showToast({
              title: '开始吸烟的年龄必须小于实际年龄',
              icon: 'none',
              duration: 2000
            })
          } else {
            this.checkSmokePara(age, smokeStartAge, smokePeriod)
          }
        }
      }
    }
  },

  onInputSmokeStartAge(e: any) {
    let value = e.detail.value || ''
    // 只允许输入数字
    value = value.replace(/[^\d]/g, '')
    // 限制最大长度为3位
    if (value.length > 3) {
      value = value.slice(0, 3)
    }
    this.setData({ smokeStartAge: value })
  },

  onBlurSmokeStartAge(e: any) {
    const value: string = e.detail.value || ''
    const smokeStartAge: number = Number(value)
    const age: number = Number(this.data.age)
    
    if (value && value !== '') {
      if (smokeStartAge <= 0 || !Number.isInteger(smokeStartAge)) {
        wx.showToast({
          title: '请输入有效的年龄',
          icon: 'none',
          duration: 2000
        })
        return
      }
      
      if (age && age > 0) {
        if (smokeStartAge >= age) {
          wx.showToast({
            title: '开始吸烟的年龄必须小于实际年龄',
            icon: 'none',
            duration: 2000
          })
        } else {
          // 如果已经填写了吸烟年限，验证总和
          const smokePeriod = Number(this.data.smokePeriod)
          this.checkSmokePara(age, smokeStartAge, smokePeriod)
        }
      }
    }
  },

  onInputSmokePeriod(e: any) {
    let value = e.detail.value || ''
    // 只允许输入数字
    value = value.replace(/[^\d]/g, '')
    // 限制最大长度为3位
    if (value.length > 3) {
      value = value.slice(0, 3)
    }
    this.setData({ smokePeriod: value })
  },

  onBlurSmokePeriod(e: any) {
    const value: string = e.detail.value || ''
    const smokePeriod: number = Number(value)
    const age: number = Number(this.data.age)
    const smokeStartAge: number = Number(this.data.smokeStartAge)
    
    if (value && value !== '') {
      if (smokePeriod <= 0 || !Number.isInteger(smokePeriod)) {
        wx.showToast({
          title: '请输入有效的年限',
          icon: 'none',
          duration: 2000
        })
        return
      }
      
      if (age && age > 0 && smokeStartAge && smokeStartAge > 0) {
        if (smokeStartAge >= age) {
          wx.showToast({
            title: '开始吸烟的年龄必须小于实际年龄',
            icon: 'none',
            duration: 2000
          })
        } else {
          this.checkSmokePara(age, smokeStartAge, smokePeriod)
        }
      }
    }
  },

  onHeightInput(e: any) {
    let value = e.detail.value || ''
    // 只允许输入数字
    value = value.replace(/[^\d]/g, '')
    // 限制最大长度为3位（最大999cm）
    if (value.length > 3) {
      value = value.slice(0, 3)
    }
    this.setData({ height: value })
  },

  onWeightIntegerInput(e: any) {
    let value = e.detail.value || ''
    // 只允许输入数字
    value = value.replace(/[^\d]/g, '')
    // 限制最大长度为3位
    if (value.length > 3) {
      value = value.slice(0, 3)
    }
    this.setData({ weightInteger: value })
    this.updateWeight()
  },

  onWeightDecimalInput(e: any) {
    let value = e.detail.value || ''
    // 只允许输入数字
    value = value.replace(/[^\d]/g, '')
    // 限制最大长度为1位（小数点后1位）
    if (value.length > 1) {
      value = value.slice(0, 1)
    }
    this.setData({ weightDecimal: value })
    this.updateWeight()
  },

  updateWeight() {
    const weightInt = this.data.weightInteger || '0'
    const weightDec = this.data.weightDecimal || '0'
    this.setData({ weight: weightInt + '.' + weightDec })
  },

  onGenderSelect(e: any) {
    const value = e.currentTarget.dataset.value
    this.setData({ gender: value })
  },

  onGenderTouchStart(e: any) {
    this.setData({
      genderTouchStartX: e.touches[0].clientX,
      genderTouchStartTime: Date.now()
    })
  },

  onGenderTouchMove(e: any) {
    // 阻止默认滚动
    e.preventDefault()
  },

  onGenderTouchEnd(e: any) {
    const endX = e.changedTouches[0].clientX
    const startX = this.data.genderTouchStartX
    const deltaX = endX - startX
    const deltaTime = Date.now() - this.data.genderTouchStartTime
    
    // 滑动距离超过30px或滑动时间小于300ms且距离超过10px，则切换
    if (Math.abs(deltaX) > 30 || (deltaTime < 300 && Math.abs(deltaX) > 10)) {
      const currentGender = this.data.gender
      if (deltaX > 0) {
        if (currentGender === '男' || !currentGender) {
          this.setData({ gender: '女' })
        }
      } else {
        if (currentGender === '女' || !currentGender) {
          this.setData({ gender: '男' })
        }
      }
    }
  },

  err(msg: string) {
    wx.showToast({ title: msg, icon: "none" })
    return false
  },

  process(d: any) {
    return {
      name: d.name,
      gender: d.gender || '男',
      age: d.age ? Number(d.age) : null,
      weight: d.weight ? Number(d.weight) : null,
      height: d.height ? Number(d.height) : null,
      education: d.education === "1" ? "小学或小学以下" :
                 d.education === "2" ? "中学" : "大学或大学以上",
      smokeStartAge: d.smokeStartAge ? Number(d.smokeStartAge) : null,
      smokePeriod: d.smokePeriod ? Number(d.smokePeriod) : null,
      bmi: Number((Number(d.weight) / ((Number(d.height)/100)**2)).toFixed(2))
    }
  },

  isNonNegativeNumber(v: any) {
    if (v === undefined || v === null || `${v}`.trim() === '') return false
    const num = Number(v)
    return !isNaN(num) && num >= 0
  },

  parseOptionalNumber(v: any) {
    if (v === undefined || v === null || `${v}`.trim() === '') return null
    const num = Number(v)
    return isNaN(num) ? null : num
  },

  // 提交时带上sessionId
  submit(data: any) {
    wx.showLoading({ title: "提交中..." });

    // 使用sessionManager获取sessionId
    const sessionId = sessionManager.getSessionId();
    
    if (!sessionId) {
      wx.showToast({ title: "会话ID错误，请刷新页面重试", icon: "none" });
      wx.hideLoading();
      return;
    }

    console.log('提交使用的SessionID:', sessionId);

    wx.cloud.callFunction({
      name: "submitForm",
      data: { 
        formData: data,
        sessionid: sessionId
      },
      success: (res) => {
        wx.hideLoading()
        const r = res.result as any
        console.log("云函数返回:", r)

        if (r && r.code === 0) {
          this.success()
        } else {
          wx.showToast({ title: "提交失败，请稍后再试", icon: "none" })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error(err)
        wx.showToast({ title: "网络错误", icon: "none" })
      }
    })
  },

  success() {
    const sessionId = this.data.sessionId;
    console.log('跳转到评估页面，会话ID:', sessionId);
    
    // 使用 redirectTo 确保页面栈清晰
    wx.redirectTo({ 
      url: `/pages/assessment/index?sessionId=${sessionId}`
    })
  }
})
