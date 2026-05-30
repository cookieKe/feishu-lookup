import type { UserInfo, CalendarData, MeetingRecord, LookupData, ApiResponse } from '../types';

/**
 * 聚合各服务返回的数据，生成统一的 API 响应。
 *
 * 部分服务失败时不影响整体——成功部分正常返回，失败字段置默认值。
 * 只有 user 未找到时才返回 404。
 */
export function aggregateResult(
  user: UserInfo | null,
  calendar: CalendarData | null,
  meetings: MeetingRecord[] | null
): ApiResponse<LookupData> {
  // User 是必要字段，未找到返回 404
  if (!user) {
    return {
      code: 3001,
      message: '未匹配到该手机号关联的飞书用户',
    };
  }

  const data: LookupData = {
    user,
    calendar: calendar || {
      summary: '日程暂不可用',
    },
    meetings: meetings || [],
  };

  return {
    code: 0,
    message: 'ok',
    data,
  };
}
