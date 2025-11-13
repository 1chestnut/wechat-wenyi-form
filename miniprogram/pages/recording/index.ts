// index.ts

// 定义接口
interface PageData {
  sessionId: string;
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
    sessionId: '',
    isRecording: false,
    isSaving: false,
    statusText: '',
    recorderReady: false,
    audioSavedPath: '',
    recordingDuration: 0,
    fileSize: 0
  } as PageData,

  recorderManager: null as any,

  onLoad: function() {
    const sessionId = wx.getStorageSync('currentSessionId') || (getApp() as any).globalData.currentSessionId;
    this.setData({ sessionId });
    console.log('录音页面加载，当前会话ID:', sessionId);

    this.initRecorder();
  },

  initRecorder: function() {
    try {
      const manager = wx.getRecorderManager();
      if (!manager) throw new Error('无法获取录音管理器');
      this.recorderManager = manager;
      this.setupRecorder();

      this.setData({
        recorderReady: true,
        statusText: '准备就绪，点击开始录音'
      });

      console.log('录音管理器初始化成功');
    } catch (error) {
      console.error('录音管理器初始化失败:', error);
      this.setData({ statusText: '录音功能初始化失败' });

      wx.showToast({
        title: '录音功能初始化失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  setupRecorder: function() {
    const that = this;
    if (!this.recorderManager) return;

    this.recorderManager.onStart(() => {
      that.setData({ isRecording: true, statusText: '录音中...' });
    });

    this.recorderManager.onStop((res: RecordStopResult) => {
      const tempFilePath = res.tempFilePath;
      that.setData({ isRecording: false, recordingDuration: res.duration, fileSize: res.fileSize, statusText: '正在保存...' });

      that.saveAudioToLocal(tempFilePath);
    });

    this.recorderManager.onError((res: RecordErrorResult) => {
      that.setData({ isRecording: false, statusText: '录音失败，请重试' });
      wx.showToast({ title: `录音失败: ${res.errMsg}`, icon: 'none', duration: 2000 });
    });
  },

  toggleRecord: function() {
    if (!this.recorderManager) {
      console.error('recorderManager 未初始化，尝试重新初始化');
      this.initRecorder();
      if (!this.recorderManager) {
        wx.showToast({ title: '录音功能暂不可用', icon: 'none', duration: 2000 });
        return;
      }
    }

    if (this.data.isSaving) return;

    if (this.data.isRecording) {
      this.recorderManager.stop();
    } else {
      this.setData({ statusText: '准备录音...', audioSavedPath: '' });
      this.recorderManager.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'aac',
        frameSize: 50
      });
    }
  },

  saveAudioToLocal: function(tempFilePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.setData({ isSaving: true });
      const fileSystemManager = wx.getFileSystemManager();

      fileSystemManager.saveFile({
        tempFilePath,
        success: async (res: any) => {
          const savedFilePath = res.savedFilePath;
          console.log('文件保存成功:', savedFilePath);

          this.setData({ audioSavedPath: savedFilePath, isSaving: false, statusText: '录音已保存到本地' });
          wx.showToast({ title: '录音已保存', icon: 'success', duration: 2000 });

          // 上传到云存储
          try {
            const cloudPath = `recordings/${Date.now()}_${Math.floor(Math.random() * 1000)}.aac`;
            const uploadRes = await this.uploadToCloud(savedFilePath, cloudPath);
            console.log('文件上传成功，fileID:', uploadRes.fileID);

            this.setData({ statusText: '录音已上传到云存储' });
            this.submitRecordingToCloud(uploadRes.fileID);
            resolve(true);
          } catch (err) {
            console.error('上传云存储失败:', err);
            wx.showToast({ title: '上传云存储失败', icon: 'none' });
            resolve(false);
          }
        },
        fail: (err: any) => {
          console.error('保存失败:', err);
          this.setData({ isSaving: false, statusText: '保存失败，请重试' });
          wx.showToast({ title: '保存失败', icon: 'none', duration: 2000 });
          resolve(false);
        }
      });
    });
  },

  uploadToCloud: function(localPath: string, cloudPath: string): Promise<{ fileID: string }> {
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath: localPath,
        success: (res) => resolve({ fileID: res.fileID }),
        fail: (err) => reject(err)
      });
    });
  },

  submitRecordingToCloud: function(fileID?: string) {
    if (!this.data.audioSavedPath && !fileID) {
      console.error('没有录音文件可提交');
      return;
    }

    wx.showLoading({ title: '提交录音信息...' });

    const recordingData = {
      filePath: this.data.audioSavedPath,
      fileID: fileID || '',
      duration: this.data.recordingDuration,
      createTime: new Date().toISOString()
    };

    wx.cloud.callFunction({
      name: 'submitRecording',
      data: { recordingData, sessionid: this.data.sessionId },
      success: (res: any) => {
        wx.hideLoading();
        const result = res.result as CloudFunctionResult;
        if (result.code === 0) {
          wx.showToast({ title: '录音信息已保存到云端', icon: 'success', duration: 2000 });
          this.setData({ statusText: '录音已保存并上传到云端' });
        } else {
          wx.showToast({ title: result.message || '提交失败', icon: 'none' });
        }
      },
      fail: (err: any) => {
        wx.hideLoading();
        console.error('录音信息提交失败:', err);
        wx.showToast({ title: '云端保存失败，请重试', icon: 'none' });
      }
    });
  },

  playSavedAudio: function() {
    if (!this.data.audioSavedPath) {
      wx.showToast({ title: '没有可播放的文件', icon: 'none' });
      return;
    }

    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.src = this.data.audioSavedPath;
    innerAudioContext.play();

    innerAudioContext.onPlay(() => wx.showToast({ title: '开始播放录音', icon: 'success' }));
    innerAudioContext.onError((err: any) => {
      console.error('播放失败:', err);
      wx.showToast({ title: '播放失败', icon: 'none' });
    });
  },

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
          content: `📍 虚拟路径: ${that.data.audioSavedPath}\n📊 文件大小: ${sizeKB} KB\n⏱️ 录音时长: ${durationSec} 秒\n🔒 存储位置: 微信小程序沙盒文件系统`,
          showCancel: false
        });

        console.log('文件详情:', { path: that.data.audioSavedPath, size: sizeKB + ' KB', duration: durationSec + ' 秒' });
      },
      fail: (err: any) => console.error('获取文件信息失败:', err)
    });
  },

  viewAllSavedFiles: function() {
    const fileSystemManager = wx.getFileSystemManager();

    fileSystemManager.getSavedFileList({
      success: (res: any) => {
        if (res.fileList.length === 0) {
          wx.showToast({ title: '没有保存的文件', icon: 'none' });
          return;
        }
        res.fileList.forEach((file: any, index: number) => {
          console.log(`${index + 1}. ${file.filePath} - ${(file.size / 1024).toFixed(1)}KB`);
        });
        wx.showModal({ title: '文件列表', content: `共有 ${res.fileList.length} 个文件保存在小程序沙盒中`, showCancel: false });
      },
      fail: (err: any) => {
        console.error('获取文件列表失败:', err);
        wx.showToast({ title: '获取文件列表失败', icon: 'none' });
      }
    });
  },

  onUnload: function() {
    if (this.data.isRecording && this.recorderManager) {
      this.recorderManager.stop();
    }
  }
});
