import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 将 datetime-local 输入的本地时间字符串转换为带时区的 ISO 8601 格式
 * 例如："2025-02-01T17:05" -> "2025-02-01T17:05:00+08:00"
 */
export function toISOStringWithTimezone(localDateTime: string): string {
  // 创建本地时间的 Date 对象
  const date = new Date(localDateTime)
  
  // 获取时区偏移（分钟）
  const timezoneOffset = date.getTimezoneOffset()
  const offsetHours = Math.abs(Math.floor(timezoneOffset / 60))
  const offsetMinutes = Math.abs(timezoneOffset % 60)
  const offsetSign = timezoneOffset <= 0 ? '+' : '-'
  
  // 格式化为 +08:00 格式
  const pad = (n: number) => n.toString().padStart(2, '0')
  const timezone = `${offsetSign}${pad(offsetHours)}:${pad(offsetMinutes)}`
  
  // 构建 ISO 8601 字符串（本地时间部分 + 时区）
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${timezone}`
}

export function format(dateInput: Date | string, formatStr: string): string {
  // 处理 ISO 8601 字符串（带时区），转换为本地时间
  let date: Date
  if (typeof dateInput === 'string') {
    // 直接解析 ISO 字符串，保留时区信息
    date = new Date(dateInput)
  } else {
    date = dateInput
  }
  
  const pad = (n: number) => n.toString().padStart(2, '0')
  
  const map: Record<string, string> = {
    'yyyy': date.getFullYear().toString(),
    'MM': pad(date.getMonth() + 1),
    'dd': pad(date.getDate()),
    'HH': pad(date.getHours()),
    'mm': pad(date.getMinutes()),
    'ss': pad(date.getSeconds()),
  }
  
  return formatStr.replace(/yyyy|MM|dd|HH|mm|ss/g, match => map[match] || match)
}
