import { createConsola, LogLevels, type LogLevel, type LogObject } from 'consola';

export type UndoneLogLevel = 'FATAL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export interface RecordedIssue {
  id: string;
  timestamp: string;
  severity: UndoneLogLevel;
  component: string;
  title: string;
  details?: string;
  latencyMs?: number;
  error?: string;
  workaround?: string;
  context?: Record<string, unknown>;
}

export interface StoredLogEntry {
  id: string;
  timestamp: string;
  level: UndoneLogLevel;
  tag: string;
  message: string;
  data?: unknown;
  runtime: 'browser' | 'node-server' | 'worker';
}

const LEVEL_MAP: Record<UndoneLogLevel, LogLevel> = {
  FATAL: LogLevels.fatal, // 0
  ERROR: LogLevels.error, // 0
  WARN: LogLevels.warn,   // 1
  INFO: LogLevels.info,   // 3
  DEBUG: LogLevels.debug, // 4
};

const REVERSE_LEVEL_MAP: Record<number, UndoneLogLevel> = {
  0: 'ERROR',
  1: 'WARN',
  2: 'INFO',
  3: 'INFO',
  4: 'DEBUG',
  5: 'DEBUG',
};

function getRuntimeType(): 'browser' | 'node-server' | 'worker' {
  if (typeof window !== 'undefined') return 'browser';
  if (process.env.UNDONE_WORKER_TYPE || process.argv.some(a => a.includes('worker'))) return 'worker';
  return 'node-server';
}

function shouldEnableLogsByDefault(): { enabled: boolean; level: UndoneLogLevel } {
  if (typeof window === 'undefined') {
    const configured = process.env.UNDONE_LOG_LEVEL as UndoneLogLevel | undefined;
    return { enabled: true, level: configured && configured in LEVEL_MAP ? configured : 'INFO' };
  }
  const isDev = process.env.NODE_ENV !== 'production';
  const forceEnable = process.env.NEXT_PUBLIC_ENABLE_LOGS === '1' ||
    process.env.NEXT_PUBLIC_ENABLE_LOGS === 'true' ||
    process.env.NEXT_PUBLIC_FORCE_DEV_LOGS === 'true';

  let defaultLevel: UndoneLogLevel = (process.env.NEXT_PUBLIC_DEV_LOG_LEVEL as UndoneLogLevel) || (isDev ? 'INFO' : 'WARN');

  if (typeof window !== 'undefined') {
    // Check browser query params & localStorage
    try {
      const search = window.location.search;
      if (search.includes('debug=1') || search.includes('debug=true') || search.includes('undone_debug=1')) {
        return { enabled: true, level: 'DEBUG' };
      }
      const paramMatch = search.match(/log_level=([A-Za-z]+)/i);
      if (paramMatch && paramMatch[1].toUpperCase() in LEVEL_MAP) {
        return { enabled: true, level: paramMatch[1].toUpperCase() as UndoneLogLevel };
      }
      const stored = localStorage.getItem('UNDONE_DEBUG');
      if (stored === 'true') {
        const storedLevel = (localStorage.getItem('UNDONE_LOG_LEVEL') as UndoneLogLevel) || 'DEBUG';
        return { enabled: true, level: storedLevel };
      }
    } catch {
      // Ignore security errors in sandboxes
    }
  }

  return { enabled: isDev || forceEnable, level: defaultLevel };
}

class UndoneDevLogger {
  private consolaInstance;
  private ringBuffer: StoredLogEntry[] = [];
  private maxBufferSize = 1000;
  private issueRegistry: RecordedIssue[] = [];
  private maxIssueRegistrySize = 200;
  private activeTimers = new Map<string, number>();
  private currentLevel: UndoneLogLevel = 'INFO';
  private isEnabled = true;
  private runtime: 'browser' | 'node-server' | 'worker';

  constructor() {
    this.runtime = getRuntimeType();
    const config = shouldEnableLogsByDefault();
    this.isEnabled = config.enabled;
    this.currentLevel = config.level;

    const initialLogLevel = this.isEnabled ? LEVEL_MAP[this.currentLevel] : (LogLevels.silent ?? -Infinity);

    this.consolaInstance = createConsola({
      level: initialLogLevel,
      formatOptions: {
        date: true,
        colors: true,
        columns: 120,
      },
    });

    // Custom reporter for buffer retention & issue analysis
    this.consolaInstance.addReporter({
      log: (logObj: LogObject) => {
        this.captureToBuffer(logObj);
      },
    });

    if (this.runtime === 'browser') {
      this.bindBrowserWindow();
    }
  }

  private captureToBuffer(logObj: LogObject) {
    const rawLevel = logObj.level ?? 3;
    const levelStr = logObj.type === 'fatal'
      ? 'FATAL'
      : (REVERSE_LEVEL_MAP[rawLevel] || 'INFO');

    const firstArg = logObj.args?.[0];
    const message = typeof firstArg === 'string' ? firstArg : JSON.stringify(firstArg ?? '');
    const data = logObj.args && logObj.args.length > 1
      ? (logObj.args.length === 2 ? logObj.args[1] : logObj.args.slice(1))
      : undefined;

    const entry: StoredLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level: levelStr,
      tag: logObj.tag || 'App',
      message,
      data,
      runtime: this.runtime,
    };

    this.ringBuffer.push(entry);
    if (this.ringBuffer.length > this.maxBufferSize) {
      this.ringBuffer.shift();
    }
  }

  public setLevel(level: UndoneLogLevel) {
    this.currentLevel = level;
    this.isEnabled = true;
    this.consolaInstance.level = LEVEL_MAP[level];

    if (this.runtime === 'browser') {
      try {
        localStorage.setItem('UNDONE_DEBUG', 'true');
        localStorage.setItem('UNDONE_LOG_LEVEL', level);
      } catch {}
      this.consolaInstance.success(`[Logger] Debug level set to ${level}`);
    }
  }

  public enable(level: UndoneLogLevel = 'DEBUG') {
    this.setLevel(level);
  }

  public disable() {
    this.isEnabled = false;
    this.consolaInstance.level = LogLevels.silent ?? -Infinity;
    if (this.runtime === 'browser') {
      try {
        localStorage.removeItem('UNDONE_DEBUG');
        localStorage.removeItem('UNDONE_LOG_LEVEL');
      } catch {}
      console.log('🔇 [Logger] UNDONE Debug Logger disabled.');
    }
  }

  public debug(tag: string, message: string, ...args: unknown[]) {
    this.consolaInstance.withTag(tag).debug(message, ...args);
  }

  public info(tag: string, message: string, ...args: unknown[]) {
    this.consolaInstance.withTag(tag).info(message, ...args);
  }

  public warn(tag: string, message: string, ...args: unknown[]) {
    this.consolaInstance.withTag(tag).warn(message, ...args);
  }

  public error(tag: string, message: string, ...args: unknown[]) {
    this.consolaInstance.withTag(tag).error(message, ...args);
  }

  public fatal(tag: string, message: string, ...args: unknown[]) {
    this.consolaInstance.withTag(tag).fatal(message, ...args);
  }

  public time(tag: string, label: string) {
    const key = `${tag}:${label}`;
    this.activeTimers.set(key, (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  }

  public timeEnd(tag: string, label: string, warnThresholdMs = 1500): number {
    const key = `${tag}:${label}`;
    const start = this.activeTimers.get(key);
    if (!start) return 0;
    this.activeTimers.delete(key);
    const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const duration = end - start;

    if (duration > warnThresholdMs) {
      this.warn(
        tag,
        `⏱️ SLOW OPERATION: "${label}" took ${duration.toFixed(1)}ms (exceeded ${warnThresholdMs}ms threshold)`
      );
      this.recordIssue({
        severity: 'WARN',
        component: tag,
        title: `High latency on "${label}"`,
        details: `Operation took ${duration.toFixed(1)}ms against threshold of ${warnThresholdMs}ms`,
        latencyMs: duration,
      });
    } else {
      this.debug(tag, `⏱️ "${label}" completed in ${duration.toFixed(1)}ms`);
    }
    return duration;
  }

  public recordIssue(issue: Omit<RecordedIssue, 'id' | 'timestamp'>): RecordedIssue {
    const fullIssue: RecordedIssue = {
      ...issue,
      id: `issue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.issueRegistry.push(fullIssue);
    if (this.issueRegistry.length > this.maxIssueRegistrySize) {
      this.issueRegistry.shift();
    }

    const logFn = {
      FATAL: this.fatal,
      ERROR: this.error,
      WARN: this.warn,
      INFO: this.info,
      DEBUG: this.debug,
    }[issue.severity].bind(this);

    logFn(
      `IssueTracker:${issue.component}`,
      `[${issue.severity}] ${issue.title}${issue.details ? ` - ${issue.details}` : ''}`,
      {
        latencyMs: issue.latencyMs,
        workaround: issue.workaround,
        context: issue.context,
        error: issue.error,
      }
    );

    return fullIssue;
  }

  public getRecentLogs(filter?: { tag?: string; level?: UndoneLogLevel; limit?: number }): StoredLogEntry[] {
    let result = [...this.ringBuffer];
    if (filter?.tag) {
      result = result.filter(l => l.tag.toLowerCase().includes(filter.tag!.toLowerCase()));
    }
    if (filter?.level) {
      result = result.filter(l => l.level === filter.level);
    }
    if (filter?.limit && filter.limit > 0) {
      result = result.slice(-filter.limit);
    }
    return result;
  }

  public getIssues(severity?: UndoneLogLevel): RecordedIssue[] {
    if (severity) {
      return this.issueRegistry.filter(i => i.severity === severity);
    }
    return [...this.issueRegistry];
  }

  public clear() {
    this.ringBuffer = [];
    this.issueRegistry = [];
    this.activeTimers.clear();
  }

  public exportReport(): string {
    const severities: UndoneLogLevel[] = ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG'];
    let md = `# UNDONE System Diagnostic & Issue Report\n`;
    md += `**Generated**: ${new Date().toISOString()}\n`;
    md += `**Runtime**: ${this.runtime}\n`;
    md += `**Active Log Level**: ${this.currentLevel}\n`;
    md += `**Total Recorded Inconveniences/Issues**: ${this.issueRegistry.length}\n`;
    md += `**Total Buffer Logs**: ${this.ringBuffer.length}\n\n`;

    md += `## Issues & Inconveniences by Severity\n\n`;
    for (const sev of severities) {
      const items = this.issueRegistry.filter(i => i.severity === sev);
      md += `### ${sev} (${items.length})\n`;
      if (items.length === 0) {
        md += `*None recorded.*\n\n`;
        continue;
      }
      for (const item of items) {
        md += `#### [${item.component}] ${item.title}\n`;
        md += `- **Time**: ${item.timestamp}\n`;
        if (item.details) md += `- **Details**: ${item.details}\n`;
        if (item.latencyMs) md += `- **Latency**: ${item.latencyMs.toFixed(1)}ms\n`;
        if (item.error) md += `- **Error**: \`${item.error}\`\n`;
        if (item.workaround) md += `- **Workaround / Status**: ${item.workaround}\n`;
        if (item.context) md += `- **Context**: \`\`\`json\n${JSON.stringify(item.context, null, 2)}\n\`\`\`\n`;
        md += `\n`;
      }
    }

    md += `## Recent Log Stream (Last 50 entries)\n\n`;
    md += `| Time | Level | Component | Message |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    const lastLogs = this.ringBuffer.slice(-50);
    for (const l of lastLogs) {
      const cleanTime = l.timestamp.split('T')[1]?.replace('Z', '') || l.timestamp;
      const cleanMsg = (l.message || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      md += `| ${cleanTime} | \`${l.level}\` | **${l.tag}** | ${cleanMsg} |\n`;
    }

    return md;
  }

  public scoped(tag: string) {
    return {
      debug: (message: string, ...args: unknown[]) => this.debug(tag, message, ...args),
      info: (message: string, ...args: unknown[]) => this.info(tag, message, ...args),
      warn: (message: string, ...args: unknown[]) => this.warn(tag, message, ...args),
      error: (message: string, ...args: unknown[]) => this.error(tag, message, ...args),
      fatal: (message: string, ...args: unknown[]) => this.fatal(tag, message, ...args),
      time: (label: string) => this.time(tag, label),
      timeEnd: (label: string, warnThresholdMs?: number) => this.timeEnd(tag, label, warnThresholdMs),
      recordIssue: (issue: Omit<RecordedIssue, 'id' | 'timestamp' | 'component'>) =>
        this.recordIssue({ ...issue, component: tag }),
    };
  }

  private bindBrowserWindow() {
    if (typeof window === 'undefined') return;
    const globalObj = window as unknown as {
      __UNDONE_LOGGER__?: unknown;
    };
    globalObj.__UNDONE_LOGGER__ = {
      enable: (level?: UndoneLogLevel) => this.enable(level),
      disable: () => this.disable(),
      setLevel: (level: UndoneLogLevel) => this.setLevel(level),
      getLogs: (filter?: { tag?: string; level?: UndoneLogLevel; limit?: number }) => this.getRecentLogs(filter),
      getIssues: (severity?: UndoneLogLevel) => this.getIssues(severity),
      exportReport: () => {
        const report = this.exportReport();
        console.log(report);
        return report;
      },
      clear: () => this.clear(),
      help: () => {
        console.log(
          `%c🛠️ UNDONE DevLogger Cheatsheet:
- __UNDONE_LOGGER__.setLevel('DEBUG'|'INFO'|'WARN'|'ERROR'|'FATAL')
- __UNDONE_LOGGER__.getLogs({ tag: 'workspace', limit: 20 })
- __UNDONE_LOGGER__.getIssues()
- __UNDONE_LOGGER__.exportReport()
- __UNDONE_LOGGER__.disable()`,
          'color: #3b82f6; font-weight: bold;'
        );
      },
    };

    // Greet developer on console if enabled
    if (this.isEnabled) {
      setTimeout(() => {
        console.log(
          `%c🛠️ UNDONE DevLogger Active%c [Level: ${this.currentLevel}] %cInspect logs via window.__UNDONE_LOGGER__`,
          'background: #2563eb; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
          'background: #1e293b; color: #38bdf8; padding: 2px 6px; border-radius: 4px;',
          'color: #94a3b8; font-style: italic;'
        );
      }, 500);
    }
  }
}

export const devLogger = new UndoneDevLogger();
export default devLogger;
