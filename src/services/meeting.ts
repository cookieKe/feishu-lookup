import { runLarkCliJson } from './cli';
import type { MeetingRecord } from '../types';

/**
 * 查询用户会议记录。
 * 默认查询最近 30 天。
 */
export async function lookupMeetings(userId: string): Promise<MeetingRecord[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const formatDate = (d: Date) =>
    d.toISOString().slice(0, 10).replace(/-/g, '');

  const result = await runLarkCliJson<
    Array<{
      subject?: string;
      meeting_start_time?: string;
      duration?: number;
      has_recording?: boolean;
    }>
  >([
    'vc', '+search',
    '--user-id', userId,
    '--start', formatDate(thirtyDaysAgo),
    '--end', formatDate(now),
    '--json',
  ]);

  if (!result.success) {
    // 会议查询失败不阻断整个请求
    return [];
  }

  const data = result.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((m) => ({
    title: m.subject || '无标题会议',
    meeting_date: m.meeting_start_time || '',
    duration_minutes: m.duration || 0,
    has_recording: !!m.has_recording,
  }));
}
