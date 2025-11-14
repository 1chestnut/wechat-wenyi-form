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
  waveBars: any[];
  waveInterval: any;
  currentVolume: number;
  maxVolume: number;
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

interface RecordFrameResult {
  frameBuffer: ArrayBuffer;
  isLastFrame: boolean;
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
    fileSize: 0,
    waveBars: [],
    waveInterval: null,
    currentVolume: 0,
    maxVolume: 1000
  } as PageData,

  recorderManager: null as any,
  recordingStartTime: 0,
  recordingTimer: null as any,
  volumeUpdateInterval: null as any,

  onLoad: function() {
    const sessionId = wx.getStorageSync('currentSessionId') || (getApp() as any).globalData.currentSessionId;
    this.setData({ sessionId });
    console.log('录音页面加载，当前会话ID:', sessionId);

    this.initRecorder();
    this.initWaveBars();
  },

  // 初始化波形条
  initWaveBars: function() {
    const bars = [];
    for (let i = 0; i < 20; i++) {
      bars.push({
        height: '20rpx',
        delay: Math.random() * 1000
      });
    }
    this.setData({ waveBars: bars });
  },

  // 开始波形动画 - 基于音量
  startWaveAnimation: function() {
    const that = this;
    
    if (this.volumeUpdateInterval) {
      clearInterval(this.volumeUpdateInterval);
    }
    
    this.volumeUpdateInterval = setInterval(() => {
      if (!that.data.isRecording) return;
      
      const newBars = that.data.waveBars.map((bar, index) => {
        const baseHeight = 20 + (that.data.currentVolume / that.data.maxVolume) * 80;
        const randomFactor = 0.7 + Math.random() * 0.6;
        const wavePattern = Math.sin(Date.now() / 200 + index * 0.3) * 10;
        
        const height = Math.max(20, Math.min(100, baseHeight * randomFactor + wavePattern));
        
        return {
          height: height + 'rpx',
          delay: bar.delay
        };
      });
      
      that.setData({ waveBars: newBars });
    }, 100);
  },

  // 停止波形动画
  stopWaveAnimation: function() {
    if (this.volumeUpdateInterval) {
      clearInterval(this.volumeUpdateInterval);
      this.volumeUpdateInterval = null;
    }
    
    const resetBars = this.data.waveBars.map(bar => ({
      height: '20rpx',
      delay: bar.delay
    }));
    this.setData({ 
      waveBars: resetBars,
      currentVolume: 0 
    });
  },

  // 计算音频数据的音量（RMS）
  calculateVolume: function(arrayBuffer: ArrayBuffer): number {
    const data = new Int16Array(arrayBuffer);
    let sum = 0;
    
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    
    const rms = Math.sqrt(sum / data.length);
    return rms;
  },

  // 格式化时间显示
  formatTime: function(milliseconds: number) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  },

  initRecorder: function() {
    try {
      const manager = wx.getRecorderManager();
      if (!manager) throw new Error('无法获取录音管理器');
      this.recorderManager = manager;
      this.setupRecorder();

      this.setData({
        recorderReady: true,
        statusText: '准备就绪，长按开始录音'
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
      that.setData({ 
        isRecording: true, 
        statusText: '录音中...',
        recordingDuration: 0
      });
      that.startWaveAnimation();
      
      that.recordingStartTime = Date.now();
      that.recordingTimer = setInterval(() => {
        const duration = Date.now() - that.recordingStartTime;
        that.setData({ recordingDuration: duration });
      }, 1000);
    });

    this.recorderManager.onStop((res: RecordStopResult) => {
      const tempFilePath = res.tempFilePath;
      that.setData({ 
        isRecording: false, 
        recordingDuration: res.duration, 
        fileSize: res.fileSize, 
        statusText: '正在保存...' 
      });
      
      that.stopWaveAnimation();
      if (that.recordingTimer) {
        clearInterval(that.recordingTimer);
        that.recordingTimer = null;
      }

      that.saveAudioToLocal(tempFilePath);
    });

    this.recorderManager.onError((res: RecordErrorResult) => {
      that.setData({ isRecording: false, statusText: '录音失败，请重试' });
      that.stopWaveAnimation();
      if (that.recordingTimer) {
        clearInterval(that.recordingTimer);
        that.recordingTimer = null;
      }
      wx.showToast({ title: `录音失败: ${res.errMsg}`, icon: 'none', duration: 2000 });
    });

    // 监听音频帧数据，用于计算音量
    this.recorderManager.onFrameRecorded((res: RecordFrameResult) => {
      if (!that.data.isRecording) return;
      
      const { frameBuffer } = res;
      if (frameBuffer) {
        const volume = that.calculateVolume(frameBuffer);
        
        let maxVolume = that.data.maxVolume;
        if (volume > maxVolume * 0.8) {
          maxVolume = volume * 1.2;
        } else if (volume < maxVolume * 0.1 && maxVolume > 1000) {
          maxVolume = Math.max(1000, maxVolume * 0.95);
        }
        
        const smoothVolume = that.data.currentVolume * 0.7 + volume * 0.3;
        
        that.setData({ 
          currentVolume: smoothVolume,
          maxVolume: maxVolume
        });
      }
    });
  },

  // 开始录音（长按）
  startRecord: function() {
    if (!this.recorderManager || this.data.isSaving) {
      if (!this.recorderManager) {
        this.initRecorder();
      }
      return;
    }
    
    if (this.data.isRecording) return;
    
    this.setData({ 
      statusText: '准备录音...', 
      audioSavedPath: '',
      currentVolume: 0,
      maxVolume: 1000
    });
    this.recorderManager.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'aac',
      frameSize: 50
    });
  },

  // 停止录音
  stopRecord: function() {
    if (this.data.isRecording && this.recorderManager) {
      this.recorderManager.stop();
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

          this.setData({ 
            audioSavedPath: savedFilePath, 
            isSaving: false, 
            statusText: '录音已保存到本地' 
          });
          wx.showToast({ title: '录音已保存', icon: 'success', duration: 2000 });

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
          content: `保存路径: ${that.data.audioSavedPath}\n
          文件大小: ${sizeKB} KB\n
          录音时长: ${durationSec} 秒\n`,
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
        wx.showModal({ title: '文件列表', content: `共有 ${res.fileList.length} 个文件已保存`, showCancel: false });
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
    this.stopWaveAnimation();
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
    if (this.volumeUpdateInterval) {
      clearInterval(this.volumeUpdateInterval);
      this.volumeUpdateInterval = null;
    }
  }
});