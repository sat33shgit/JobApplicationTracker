const isDev = typeof import.meta !== 'undefined' ? (import.meta.env && import.meta.env.MODE !== 'production') : true;

function safeConsole(method: 'log' | 'warn' | 'error', ...args: any[]) {
  if (typeof console !== 'undefined' && console[method]) {
    // always show errors, but gate info/warn in non-production
    if (method === 'error' || isDev) {
      // eslint-disable-next-line no-console
      (console as any)[method](...args);
    }
  }
}

export const logger = {
  info: (...args: any[]) => safeConsole('log', ...args),
  warn: (...args: any[]) => safeConsole('warn', ...args),
  error: (...args: any[]) => safeConsole('error', ...args),
};

export default logger;
