import sessionManager from '../../utils/sessionManager';

Page({
  data: {sessionId: ''},

  onLoad() {
    // 生成新的sessionId
    const sessionId = sessionManager.generateSessionId();
    this.setData({ sessionId });
    console.log('首页SessionID:', sessionId);
  },

  formSubmit(e: any) {
    const formData = e.detail.value
    console.log("提交内容:", formData)

    if (!this.validateForm(formData)) return

    const processed = this.process(formData)
    this.submit(processed)
  },

  validateForm(d: any) {
    // 保持原有的验证逻辑
    if (!d.name || !d.name.trim()) {
      return this.err("请输入姓名");
    }
    if (!d.gender) return this.err("请选择性别")
    if (!this.num(d.age)) return this.err("请输入正确的年龄")
    if (!this.num(d.weight)) return this.err("请输入正确的体重")
    if (!this.num(d.height)) return this.err("请输入正确的身高")
    if (!d.education) return this.err("请选择文化程度")
    if (!this.num(d.smokeStartAge)) return this.err("请输入开始吸烟年龄")
    if (!this.num(d.smokeYears)) return this.err("请输入吸烟年限")

    const s = Number(d.smokeStartAge)
    const y = Number(d.smokeYears)
    const age = Number(d.age)

    if (s + y > age) return this.err("开始吸烟年龄 + 吸烟年限不能大于当前年龄")
    if (s < 5) return this.err("开始吸烟年龄不能小于5岁")
    return true
  },

  num(v: any) {
    return v && !isNaN(Number(v)) && Number(v) > 0
  },

  err(msg: string) {
    wx.showToast({ title: msg, icon: "none" })
    return false
  },

  process(d: any) {
    return {
      name: d.name.trim(),
      gender: d.gender === "1" ? "男" : "女",
      age: Number(d.age),
      weight: Number(d.weight),
      height: Number(d.height),
      education: d.education === "1" ? "小学或小学以下" :
                 d.education === "2" ? "中学" : "大学或大学以上",
      smokeStartAge: Number(d.smokeStartAge),
      smokeYears: Number(d.smokeYears),
      bmi: Number((Number(d.weight) / ((Number(d.height)/100)**2)).toFixed(2))
    }
  },

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