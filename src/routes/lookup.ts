import { Router, type Request, type Response } from 'express';
import { validateLookupRequest, ValidationError } from '../utils/validate';
import { lookupUserByPhone } from '../services/contact';
import { lookupCalendar } from '../services/calendar';
import { lookupMeetings } from '../services/meeting';
import { aggregateResult } from '../services/aggregator';
import { logger, maskSensitive } from '../utils/logger';
import { ErrorCode } from '../types';

const router = Router();

router.post('/lookup', async (req: Request, res: Response) => {
  const startTime = Date.now();

  // 1. 参数校验
  const validated = validateLookupRequest(req.body as Record<string, unknown>);
  if (validated instanceof ValidationError) {
    res.status(validated.httpStatus).json({
      code: validated.code,
      message: validated.message,
    });
    return;
  }

  const { phone, time_from, time_to } = validated;

  logger.info('Lookup request', {
    ip: req.ip,
    phone: maskSensitive(phone),
    hasTimeRange: !!(time_from && time_to),
  });

  try {
    // 2. 查询用户
    const userResult = await lookupUserByPhone(phone);
    if (!userResult) {
      res.status(404).json({
        code: ErrorCode.USER_NOT_FOUND,
        message: '未匹配到该手机号关联的飞书用户',
      });
      return;
    }

    const { userId, userInfo } = userResult;

    // 3. 并行查询日程和会议（使用 userId，非 phone）
    const [calendar, meetings] = await Promise.all([
      lookupCalendar(userId, time_from, time_to),
      lookupMeetings(userId),
    ]);

    // 4. 聚合响应
    const response = aggregateResult(userInfo, calendar, meetings);

    const duration = Date.now() - startTime;
    logger.info('Lookup completed', {
      ip: req.ip,
      phone: maskSensitive(phone),
      statusCode: response.code,
      durationMs: duration,
    });

    const httpStatus = response.code === 3001 ? 404 : response.code === 0 ? 200 : 500;
    res.status(httpStatus).json(response);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    logger.error('Lookup error', {
      ip: req.ip,
      phone: maskSensitive(phone),
      error: errMsg,
    });

    res.status(502).json({
      code: ErrorCode.CLI_FAILED,
      message: `飞书 CLI 调用失败: ${errMsg}`,
    });
  }
});

export default router;
