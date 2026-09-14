/**
 * 内置的腾讯地图 key 默认值。
 *
 * 前端 key 无论如何都会出现在 JS 产物里，混淆没有意义，
 * 唯一的防线是腾讯位置服务控制台里的「域名白名单（Referer）」。
 * 请务必把白名单限制为：
 *   https://chensjfish.github.io
 *   http://localhost:5173   （本地调试用，调完可删）
 *
 * 如需更换：改这里的字符串即可，配置面板里填的 key 优先级更高。
 */
export const DEFAULT_MAP_KEY = 'JA5BZ-ZBD67-S5JXB-HWDC4-67J2K-D2BJ3';
