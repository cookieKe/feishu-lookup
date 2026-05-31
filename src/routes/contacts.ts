import { Router, type Request, type Response } from 'express';
import { checkContact, listContacts } from '../services/contacts';
import { logger } from '../utils/logger';
import { ErrorCode } from '../types';

const router = Router();

router.post('/contacts/check', async (req: Request, res: Response) => {
  const { phone, contact_phone } = req.body as Record<string, unknown>;

  // 参数校验
  if (typeof phone !== 'string' || !phone.trim()) {
    res.status(400).json({ code: ErrorCode.MISSING_PHONE, message: '缺少 phone 参数' });
    return;
  }
  if (typeof contact_phone !== 'string' || !contact_phone.trim()) {
    res.status(400).json({ code: ErrorCode.MISSING_PHONE, message: '缺少 contact_phone 参数' });
    return;
  }

  try {
    const result = await checkContact(phone.trim(), contact_phone.trim());

    if (!result.is_contact || !result.contact) {
      res.status(404).json({
        code: ErrorCode.USER_NOT_FOUND,
        message: '未在通讯录中匹配到该号码',
      });
      return;
    }

    res.json({
      code: 0,
      message: 'ok',
      data: result,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    logger.error('Contacts check error', { phone, contact_phone, error: errMsg });
    res.status(502).json({
      code: ErrorCode.CLI_FAILED,
      message: `查询失败: ${errMsg}`,
    });
  }
});

router.post('/contacts', async (req: Request, res: Response) => {
  const { phone } = req.body as Record<string, unknown>;

  if (typeof phone !== 'string' || !phone.trim()) {
    res.status(400).json({ code: ErrorCode.MISSING_PHONE, message: '缺少 phone 参数' });
    return;
  }

  try {
    const result = await listContacts(phone);
    res.json({ code: 0, message: 'ok', data: result });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    logger.error('Contacts list error', { phone, error: errMsg });
    res.status(502).json({ code: ErrorCode.CLI_FAILED, message: `查询失败: ${errMsg}` });
  }
});

export default router;
