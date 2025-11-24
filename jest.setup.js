// 抑制 bigint-buffer 的原生绑定加载警告
// 这个警告不影响功能，bigint-buffer 会自动回退到纯 JS 实现
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args[0];
  // 过滤掉 bigint-buffer 的警告
  if (typeof message === 'string' && message.includes('bigint') && message.includes('Failed to load bindings')) {
    return;
  }
  originalWarn.apply(console, args);
};

