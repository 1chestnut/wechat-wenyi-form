// utils/sessionManager.ts

class SessionManager {
  private currentSessionId: string;

  constructor() {
    this.currentSessionId = '';
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // 生成新的sessionId
  generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    const sessionId = `session_${timestamp}_${random}`;
    
    this.currentSessionId = sessionId;
    wx.setStorageSync('currentSessionId', sessionId);
    
    const app = getApp() as any;
    app.globalData.currentSessionId = sessionId;
    
    console.log('生成新SessionID:', sessionId);
    return sessionId;
  }

  // 获取当前sessionId
  getSessionId(): string {
    if (this.currentSessionId) {
      return this.currentSessionId;
    }

    // 尝试从多个来源获取
    const app = getApp() as any;
    const fromMemory = this.currentSessionId;
    const fromGlobal = app.globalData.currentSessionId;
    const fromStorage = wx.getStorageSync('currentSessionId');

    let sessionId = fromMemory || fromGlobal || fromStorage;
    
    if (sessionId) {
      this.currentSessionId = sessionId;
      console.log('获取到SessionID:', sessionId);
    } else {
      console.warn('未找到SessionID，需要生成新的');
    }
    
    return sessionId;
  }

  // 设置sessionId（主要用于页面间同步）
  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
    wx.setStorageSync('currentSessionId', sessionId);
    
    const app = getApp() as any;
    app.globalData.currentSessionId = sessionId;
    
    console.log('设置SessionID:', sessionId);
  }

  // 验证sessionId是否存在
  hasValidSession(): boolean {
    return !!this.getSessionId();
  }

  // 添加静态实例属性
  private static instance: SessionManager;
}

export default SessionManager.getInstance();