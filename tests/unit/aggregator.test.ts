import { describe, it, expect } from 'vitest';
import { aggregateResult } from '../../src/services/aggregator';
import type { UserInfo, CalendarData, MeetingRecord, LookupData } from '../../src/types';

describe('aggregateResult', () => {
  const mockUser: UserInfo = {
    name: '张三',
    department: '技术部',
    title: '工程师',
    email: 'zhangsan@example.com',
    mobile: '+8613800000000',
  };

  const mockCalendar: CalendarData = {
    summary: '今日 3 个日程',
    events: [{ title: '评审会', start_time: '2026-05-30 14:00', end_time: '2026-05-30 15:00' }],
  };

  const mockMeetings: MeetingRecord[] = [
    { title: '周会', meeting_date: '2026-05-29 10:00', duration_minutes: 60, has_recording: true },
  ];

  it('should aggregate all data successfully', () => {
    const result = aggregateResult(mockUser, mockCalendar, mockMeetings);
    expect(result.code).toBe(0);
    expect(result.message).toBe('ok');
    const data = result.data as LookupData;
    expect(data.user.name).toBe('张三');
    expect(data.calendar.events).toHaveLength(1);
    expect(data.meetings).toHaveLength(1);
  });

  it('should handle null user (not found)', () => {
    const result = aggregateResult(null, mockCalendar, mockMeetings);
    expect(result.code).toBe(3001);
    expect(result.message).toContain('未匹配到');
  });

  it('should handle failed calendar (null)', () => {
    const result = aggregateResult(mockUser, null, mockMeetings);
    expect(result.code).toBe(0);
    const data = result.data as LookupData;
    expect(data.calendar.summary).toContain('暂不可用');
    expect(data.calendar.events).toBeUndefined();
  });

  it('should handle failed meetings (null)', () => {
    const result = aggregateResult(mockUser, mockCalendar, null);
    expect(result.code).toBe(0);
    const data = result.data as LookupData;
    expect(data.meetings).toEqual([]);
  });

  it('should handle all services failed (all null)', () => {
    const result = aggregateResult(null, null, null);
    expect(result.code).toBe(3001);
  });
});
