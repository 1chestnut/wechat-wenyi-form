// index.ts

// 定义接口
interface PageData {
  sessionId: string; // 添加sessionId
  isRecording: boolean;
  isSaving: boolean;
  statusText: string;
  recorderReady: boolean;
  audioSavedPath: string;
  recordingDuration: number;
  fileSize: number;
}

// 定义录音相关类型
interface RecordErrorResult {
  errMsg: string;
}

interface RecordStopResult {
  tempFilePath: string;
  duration: number;
  fileSize: number;
}

// 云函数返回类型
interface CloudFunctionResult {
  code: number;
  message: string;
  data?: any;
  error?: string;
}

Page({
  data: {
    sessionId: '', // 添加sessionId
    isRecording: false,
    isSaving: false,
    statusText: '',
    recorderReady: false,
    audioSavedPath: '',
    recordingDuration: 0,
    fileSize: 0
  } as PageData,

  // 使用 any 避免复杂的类型问题
  recorderManager: null as any,

  onLoad: function() {
    // 从存储或全局数据获取sessionId
    const sessionId = wx.getStorageSync('currentSessionId') || (getApp() as any).globalData.currentSessionId;
    this.setData({ sessionId });
    console.log('录音页面加载，当前会话ID:', sessionId);
    
    this.initRecorder();
  },

  initRecorder: function() {
    try {
      const manager = wx.getRecorderManager();
      
      if (!manager) {
        throw new Error('无法获取录音管理器');
      }
      
      this.recorderManager = manager;
      this.setupRecorder();
      
      this.setData({
        recorderReady: true,
        statusText: '准备就绪，点击开始录音'
      });
      
      console.log('录音管理器初始化成功');
    } catch (error) {
      console.error('录音管理器初始化失败:', error);
      this.setData({
        statusText: '录音功能初始化失败'
      });
      
      wx.showToast({
        title: '录音功能初始化失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  setupRecorder: function() {
    const that = this;
    
    if (!this.recorderManager) {
      console.error('recorderManager 未初始化');
      return;
    }
    
    // 监听录音开始事件
    this.recorderManager.onStart(() => {
      that.setData({
        isRecording: true,
        statusText: '录音中...'
      });
    });

    // 监听录音停止事件 - 修复参数类型
    this.recorderManager.onStop((res: RecordStopResult) => {
      const tempFilePath = res.tempFilePath;
      that.setData({
        isRecording: false,
        recordingDuration: res.duration,
        fileSize: res.fileSize,
        statusText: '正在保存...'
      });
      
      that.saveAudioToLocal(tempFilePath);
    });

    // 监听录音错误事件 - 修复参数类型
    this.recorderManager.onError((res: RecordErrorResult) => {
      that.setData({
        isRecording: false,
        statusText: '录音失败，请重试'
      });
      
      wx.showToast({
        title: `录音失败: ${res.errMsg}`,
        icon: 'none',
        duration: 2000
      });
    });
  },

  toggleRecord: function() {
    if (!this.recorderManager) {
      console.error('recorderManager 未初始化，尝试重新初始化');
      this.initRecorder();
      
      if (!this.recorderManager) {
        wx.showToast({
          title: '录音功能暂不可用',
          icon: 'none',
          duration: 2000
        });
        return;
      }
    }

    if (this.data.isSaving) {
      return;
    }

    if (this.data.isRecording) {
      this.recorderManager.stop();
    } else {
      this.setData({
        statusText: '准备录音...',
        audioSavedPath: '' // 清除之前的录音路径
      });
      
      if (this.recorderManager) {
        this.recorderManager.start({
          duration: 60000,
          sampleRate: 16000,
          numberOfChannels: 1,
          encodeBitRate: 48000,
          format: 'aac',
          frameSize: 50
        });
      } else {
        this.setData({
          statusText: '录音功能异常，请重试'
        });
      }
    }
  },

  saveAudioToLocal: function(tempFilePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.setData({ isSaving: true });
      
      const fileSystemManager = wx.getFileSystemManager();
      
      fileSystemManager.saveFile({
        tempFilePath: tempFilePath,
        success: (res: any) => {
          const savedFilePath = res.savedFilePath;
          console.log('文件保存成功:', savedFilePath);
          
          this.setData({
            audioSavedPath: savedFilePath,
            isSaving: false,
            statusText: '录音已保存到本地'
          });
          
          wx.showToast({
            title: '录音已保存',
            icon: 'success',
            duration: 2000
          });
          
          // 保存成功后自动提交录音信息到云端
          this.submitRecordingToCloud();
          resolve(true);
        },
        fail: (err: any) => {
          console.error('保存失败:', err);
          this.setData({
            isSaving: false,
            statusText: '保存失败，请重试'
          });
          
          wx.showToast({
            title: '保存失败',
            icon: 'none',
            duration: 2000
          });
          resolve(false);
        }
      });
    });
  },

  // 提交录音信息到云端数据库
  submitRecordingToCloud: function() {
    if (!this.data.audioSavedPath) {
      console.error('没有录音文件可提交');
      return;
    }

    wx.showLoading({
      title: '提交录音信息...',
    });

    // 获取文件详细信息
    const fileSystemManager = wx.getFileSystemManager();
    const that = this;
    
    fileSystemManager.getFileInfo({
      filePath: this.data.audioSavedPath,
      success: (res: any) => {
        const recordingData = {
          filePath: that.data.audioSavedPath,
          duration: that.data.recordingDuration,
          fileSize: res.size,
          createTime: new Date().toISOString()
        };

        console.log('准备提交的录音数据:', recordingData);
        console.log('会话ID:', that.data.sessionId);

        // 调用云函数提交录音信息
        wx.cloud.callFunction({
          name: 'submitRecording',
          data: {
            recordingData: recordingData,
            sessionid: that.data.sessionId // 添加sessionId
          },
          success: (res: any) => {
            wx.hideLoading();
            console.log('录音信息提交成功:', res);
            
            const result = res.result as CloudFunctionResult;
            if (result.code === 0) {
              wx.showToast({
                title: '录音信息已保存到云端',
                icon: 'success',
                duration: 2000
              });
              that.setData({
                statusText: '录音已保存并上传到云端'
              });
            } else {
              wx.showToast({
                title: result.message || '提交失败',
                icon: 'none'
              });
            }
          },
          fail: (err: any) => {
            wx.hideLoading();
            console.error('录音信息提交失败:', err);
            wx.showToast({
              title: '云端保存失败，请重试',
              icon: 'none'
            });
          }
        });
      },
      fail: (err: any) => {
        wx.hideLoading();
        console.error('获取文件信息失败:', err);
        wx.showToast({
          title: '获取文件信息失败',
          icon: 'none'
        });
      }
    });
  },

  // 手动提交录音信息到云端（备用方法）
  manualSubmitToCloud: function() {
    if (!this.data.audioSavedPath) {
      wx.showToast({
        title: '请先完成录音',
        icon: 'none'
      });
      return;
    }
    
    this.submitRecordingToCloud();
  },

  // 播放保存的录音
  playSavedAudio: function() {
    if (!this.data.audioSavedPath) {
      wx.showToast({
        title: '没有可播放的文件',
        icon: 'none'
      });
      return;
    }
    
    console.log('正在播放文件:', this.data.audioSavedPath);
    
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.src = this.data.audioSavedPath;
    innerAudioContext.play();
    
    innerAudioContext.onPlay(() => {
      console.log('开始播放录音');
      wx.showToast({
        title: '开始播放录音',
        icon: 'success'
      });
    });
    
    innerAudioContext.onError((err: any) => {
      console.error('播放失败:', err);
      wx.showToast({
        title: '播放失败',
        icon: 'none'
      });
    });
  },

  // 获取文件详细信息
  getFileDetails: function() {
    if (!this.data.audioSavedPath) return;
    
    const fileSystemManager = wx.getFileSystemManager();
    const that = this;
    
    fileSystemManager.getFileInfo({
      filePath: this.data.audioSavedPath,
      success: (res: any) => {
        const sizeKB = (res.size / 1024).toFixed(1);
        const durationSec = (that.data.recordingDuration / 1000).toFixed(1);
        
        wx.showModal({
          title: '文件详细信息',
          content: `📍 虚拟路径: ${that.data.audioSavedPath}\n\n📊 文件大小: ${sizeKB} KB\n\n⏱️ 录音时长: ${durationSec} 秒\n\n🔒 存储位置: 微信小程序沙盒文件系统\n\n💡 访问方式: 只能通过小程序代码访问`,
          showCancel: false
        });
        
        console.log('文件详情:', {
          虚拟路径: that.data.audioSavedPath,
          文件大小: sizeKB + ' KB',
          录音时长: durationSec + ' 秒',
          文件哈希: res.digest,
          存储类型: '微信沙盒永久存储'
        });
      },
      fail: (err: any) => {
        console.error('获取文件信息失败:', err);
      }
    });
  },

  // 查看所有保存的文件 - 修复废弃API
  viewAllSavedFiles: function() {
    const fileSystemManager = wx.getFileSystemManager();
    
    fileSystemManager.getSavedFileList({
      success: (res: any) => {
        console.log('=== 所有保存的文件 ===');
        
        if (res.fileList.length === 0) {
          console.log('没有找到任何文件');
          wx.showToast({
            title: '没有保存的文件',
            icon: 'none'
          });
          return;
        }
        
        // 在控制台显示所有文件
        res.fileList.forEach((file: any, index: number) => {
          const sizeKB = (file.size / 1024).toFixed(1);
          console.log(`${index + 1}. ${file.filePath} - ${sizeKB}KB`);
        });
        
        // 显示给用户
        const fileCount = res.fileList.length;
        wx.showModal({
          title: '文件列表',
          content: `共有 ${fileCount} 个文件保存在小程序沙盒中`,
          showCancel: false
        });
      },
      fail: (err: any) => {
        console.error('获取文件列表失败:', err);
        wx.showToast({
          title: '获取文件列表失败',
          icon: 'none'
        });
      }
    });
  },
  
  onUnload: function() {
    if (this.data.isRecording && this.recorderManager) {
      this.recorderManager.stop();
    }
  }
});