import { runLarkCliJson } from './cli';
import type { CalendarData, CalendarEvent } from '../types';

/**
 * 查询用户日程。
 * 如果有时间范围，返回日程标题列表；否则只返回摘要。
 */
export async function lookupCalendar(
  userId: string,
  timeFrom?: string,
  timeTo?: string
): Promise<CalendarData> {
  const args: string[] = [
    'calendar', '+agenda',
    '--user-id', userId,
    '--json',
  ];

  if (timeFrom && timeTo) {
    args.push('--start', timeFrom);
    args.push('--end', timeTo);
  }

  const result = await runLarkCliJson<{
    summary?: string;
    events?: Array<{
      summary?: string;
      start_time?: string;
      end_time?: string;
    }>;
  }>(args);

  if (!result.success) {
    // 日程查询失败不应阻断整个请求
    return {
      summary: '日程查询失败',
      ...(timeFrom && timeTo ? { events: [] } : {}),
    };
  }

  const data = result.data;

  const events: CalendarEvent[] | undefined = timeFrom && timeTo
    ? (data?.events || []).map((e) => ({
        title: e.summary || '无标题',
        start_time: e.start_time || '',
        end_time: e.end_time || '',
      }))
    : undefined;

  return {
    summary: data?.summary || '暂无日程',
    ...(events !== undefined ? { events } : {}),
  };
}
