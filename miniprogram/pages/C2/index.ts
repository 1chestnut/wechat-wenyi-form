Page({
  data: {
    sessionId: '' // 添加sessionId属性
  } as {
    sessionId: string; // 在类型定义中添加sessionId
  },

  onLoad() {
    // 从存储或全局数据获取sessionId
    const sessionId = wx.getStorageSync('currentSessionId') || (getApp() as any).globalData.currentSessionId;
    this.setData({ sessionId });
    console.log('CO浓度评估页面加载，当前会话ID:', sessionId);
  },

  // 表单提交
  submitCOAssessment(e: any) {
    const formData = e.detail.value;
    const sessionId = this.data.sessionId;
    console.log('CO评估表单数据:', formData);
    console.log('会话ID:', sessionId);
    
    // 数据验证
    if (!this.validateForm(formData)) {
      return;
    }
    
    // 显示加载中
    wx.showLoading({
      title: '提交中...',
    });

    // 调用云函数提交CO评估数据
    wx.cloud.callFunction({
      name: 'submitC2',
      data: {
        formData: formData,
        sessionid: sessionId // 添加sessionId
      },
      success: (res: any) => {
        wx.hideLoading();
        console.log('CO评估云函数返回:', res);
        
        if (res.result.code === 0) {
          this.showResult(res.result.data);
        } else {
          wx.showToast({
            title: res.result.message || '提交失败',
            icon: 'none'
          });
        }
      },
      fail: (err: any) => {
        wx.hideLoading();
        console.error('CO评估云函数调用失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 表单验证
  validateForm(formData: any): boolean {
    // CO浓度验证
    if (!formData.coConcentration || isNaN(Number(formData.coConcentration)) || Number(formData.coConcentration) < 0) {
      this.showError('请输入正确的CO浓度值');
      return false;
    }

    // 最近吸烟时间验证
    if (!formData.lastSmokeTime) {
      this.showError('请选择最近吸烟时间');
      return false;
    }

    return true;
  },

  // 显示结果
  showResult(resultData: any) {
    const content = `评估完成！
    
CO浓度：${resultData.coConcentration} ppm
最近吸烟时间：${resultData.lastSmokeTime}

评估结果：${resultData.assessment}`;
    
    wx.showModal({
      title: 'CO浓度评估结果',
      content: content,
      showCancel: false,
      confirmText: '确定',
      success: (res: any) => {
        if (res.confirm) {
          console.log('用户确认CO评估结果');
          // 跳转到录音页面
          wx.navigateTo({
            url: '/pages/recording/index'
          });
        }
      }
    });
  },

  // 显示错误提示
  showError(message: string) {
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 3000
    });
  }
});