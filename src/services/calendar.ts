import { runLarkCliJson } from './cli';
import type { CalendarData, CalendarEvent } from '../types';

/**
 * calendar events instance_view API 返回结构
 */
interface InstanceViewItem {
  event_id?: string;
  summary?: string;
  start_time?: {
    date_time?: string;
    timestamp?: string;
  };
  end_time?: {
    date_time?: string;
    timestamp?: string;
  };
}

interface InstanceViewResponse {
  code: number;
  msg?: string;
  data?: {
    items?: InstanceViewItem[];
  };
}

/**
 * 将 "2026-05-01 09:00" 格式转为 ISO 8601 "2026-05-01T09:00:00+08:00"
 */
function toISO8601(timeStr: string): string {
  // 如果已经是 ISO 8601 格式，直接返回
  if (timeStr.includes('T')) {
    return timeStr;
  }
  // 补齐秒和时区
  return `${timeStr}:00+08:00`;
}

/**
 * 获取默认时间范围（今天）
 */
function defaultTimeRange(): { start: string; end: string } {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return {
    start: `${yyyy}-${mm}-${dd}T00:00:00+08:00`,
    end: `${yyyy}-${mm}-${dd}T23:59:59+08:00`,
  };
}

/**
 * 查询用户日程。
 * +agenda shortcut 不支持查询其他用户，因此使用 calendar events instance_view API。
 */
export async function lookupCalendar(
  userId: string,
  timeFrom?: string,
  timeTo?: string,
): Promise<CalendarData> {
  const actualStart = timeFrom ? toISO8601(timeFrom) : defaultTimeRange().start;
  const actualEnd = timeTo ? toISO8601(timeTo) : defaultTimeRange().end;

  const params = JSON.stringify({
    user_id: userId,
    start_time: actualStart,
    end_time: actualEnd,
  });

  const result = await runLarkCliJson<InstanceViewResponse>([
    'calendar', 'events', 'instance_view',
    '--params', params,
    '--format', 'json',
  ]);

  if (!result.success) {
    return {
      summary: '日程查询失败',
      ...(timeFrom && timeTo ? { events: [] } : {}),
    };
  }

  const items = result.data?.data?.items;
  if (!items || items.length === 0) {
    return {
      summary: '暂无日程',
      ...(timeFrom && timeTo ? { events: [] } : {}),
    };
  }

  const events: CalendarEvent[] = (timeFrom && timeTo)
    ? items.map((e) => ({
        title: e.summary || '无标题',
        start_time: e.start_time?.date_time || e.start_time?.timestamp || '',
        end_time: e.end_time?.date_time || e.end_time?.timestamp || '',
      }))
    : [];

  return {
    summary: `共 ${items.length} 个日程`,
    ...(events.length > 0 ? { events } : {}),
  };
}
