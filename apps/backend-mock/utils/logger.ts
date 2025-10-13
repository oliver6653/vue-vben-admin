import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// 日志级别枚举
export enum LogLevel {
  ERROR = 'ERROR',
  INFO = 'INFO',
  WARN = 'WARN',
}

// 日志配置 - 支持通过环境变量配置日志目录
const DEFAULT_LOG_DIR = join(homedir(), '.vben', '.cache');
const LOG_DIR = process.env.BACKEND_MOCK_LOG_DIR || DEFAULT_LOG_DIR;

// 确保日志目录存在，如果目录不存在或无法创建，则回退到默认目录
function ensureLogDirectory(): string {
  try {
    // 首先尝试使用配置的目录
    if (existsSync(LOG_DIR)) {
      return LOG_DIR;
    }

    // 如果目录不存在，尝试创建它
    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
      return LOG_DIR;
    }
  } catch {
    // 如果配置的目录无法使用，回退到默认目录
    console.warn(
      `Failed to use configured log directory: ${LOG_DIR}, falling back to default: ${DEFAULT_LOG_DIR}`,
    );
    if (!existsSync(DEFAULT_LOG_DIR)) {
      mkdirSync(DEFAULT_LOG_DIR, { recursive: true });
    }
    return DEFAULT_LOG_DIR;
  }

  return DEFAULT_LOG_DIR;
}

const actualLogDir = ensureLogDirectory();
const actualLogFile = join(actualLogDir, 'backend-mock.log');

/**
 * 日志工具类
 */
export class Logger {
  private static instance;
  private logFile: string;

  private constructor() {
    this.logFile = actualLogFile;
  }

  /**
   * 获取Logger实例（单例模式）
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 记录ERROR级别日志
   * @param message 日志消息
   * @param prefix 日志前缀
   */
  public error(message: string, prefix?: string): void {
    this.log(LogLevel.ERROR, message, prefix);
  }

  /**
   * 记录INFO级别日志
   * @param message 日志消息
   * @param prefix 日志前缀
   */
  public info(message: string, prefix?: string): void {
    this.log(LogLevel.INFO, message, prefix);
  }

  /**
   * 记录WARN级别日志
   * @param message 日志消息
   * @param prefix 日志前缀
   */
  public warn(message: string, prefix?: string): void {
    this.log(LogLevel.WARN, message, prefix);
  }

  /**
   * 记录日志的核心方法
   * @param level 日志级别
   * @param message 日志消息
   * @param prefix 日志前缀
   */
  private log(level: LogLevel, message: string, prefix?: string): void {
    const timestamp = new Date().toISOString();
    const prefixStr = prefix ? `[${prefix}] ` : '';
    const logMessage = `[${level}] ${timestamp} - ${prefixStr}${message}\n`;

    // 输出到控制台
    switch (level) {
      case LogLevel.ERROR: {
        console.error(`${prefixStr}${message}`);
        break;
      }
      case LogLevel.INFO: {
        console.log(`${prefixStr}${message}`);
        break;
      }
      case LogLevel.WARN: {
        console.warn(`${prefixStr}${message}`);
        break;
      }
    }

    // 写入到日志文件
    try {
      appendFileSync(this.logFile, logMessage, { encoding: 'utf8' });
    } catch (error) {
      // 如果写入文件失败，至少保证控制台能输出
      console.error(`Failed to write log to file: ${error.message}`);
    }
  }
}

// 创建默认实例
export const logger = Logger.getInstance();
