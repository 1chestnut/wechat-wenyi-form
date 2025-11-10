import sessionManager from '../../utils/sessionManager';

Page({
  data: {
    sessionId: ''
  },

  onLoad(options: any) {
    console.log('FTND页面加载参数:', options);
    
    // 使用sessionManager统一管理
    let sessionId = options.sessionId;
    
    if (sessionId) {
      // 如果URL中有sessionId，设置到sessionManager
      sessionManager.setSessionId(sessionId);
    } else {
      // 否则从sessionManager获取
      sessionId = sessionManager.getSessionId();
    }
    
    if (!sessionId) {
      console.error('未找到有效的sessionId');
      this.handleSessionError();
      return;
    }
    
    this.setData({ sessionId });
    console.log('FTND页面SessionID:', sessionId);
  },

  submitAssessment(e: any) {
    const formData = e.detail.value;
    const sessionId = sessionManager.getSessionId();
    
    console.log('FTND提交SessionID:', sessionId);
    console.log('表单数据:', formData);
    
    if (!sessionId) {
      this.handleSessionError();
      return;
    }
    
    if (!this.validateForm(formData)) {
      return;
    }
    
    wx.showLoading({
      title: '提交中...',
    });

    wx.cloud.callFunction({
      name: 'submitFTND',
      data: {
        formData: formData,
        sessionid: sessionId
      },
      success: (res: any) => {
        wx.hideLoading();
        console.log('FTND云函数返回:', res);
        
        if (res.result.code === 0) {
          this.showResult(res.result.data.totalScore, res.result.data.dependencyLevel);
        } else {
          wx.showToast({
            title: res.result.message || '提交失败',
            icon: 'none'
          });
        }
      },
      fail: (err: any) => {
        wx.hideLoading();
        console.error('FTND云函数调用失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  },

  validateForm(formData: any): boolean {
    const questions = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
    for (let i = 0; i < questions.length; i++) {
      if (!formData[questions[i]]) {
        wx.showToast({
          title: `请回答问题${i + 1}`,
          icon: 'none'
        });
        return false;
      }
    }
    return true;
  },

  showResult(score: number, level: string) {
    let message = `您的尼古丁依赖评估得分：${score}分\n依赖水平：${level}`;
    
    if (score > 6) {
      message += '\n\n提示：被认为是尼古丁高度依赖，建议寻求专业戒烟帮助。';
    } else if (score > 3) {
      message += '\n\n提示：中度依赖，可以通过意志力和辅助方法戒烟。';
    } else {
      message += '\n\n提示：依赖程度较低，戒烟相对容易。';
    }
    
    wx.showModal({
      title: 'FTND评估结果',
      content: message,
      showCancel: false,
      confirmText: '确定',
      success: (res: any) => {
        if (res.confirm) {
          const sessionId = sessionManager.getSessionId();
          console.log('跳转到C2页面SessionID:', sessionId);
          
          wx.redirectTo({
            url: `/pages/C2/index?sessionId=${sessionId}&t=${Date.now()}`
          });
        }
      }
    });
  },

  handleSessionError() {
    wx.showToast({
      title: '会话已过期，请重新填写',
      icon: 'none'
    });
    setTimeout(() => {
      wx.redirectTo({
        url: '/pages/index/index'
      });
    }, 2000);
  }
});