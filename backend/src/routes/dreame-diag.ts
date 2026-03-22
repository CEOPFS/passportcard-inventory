/**
 * Dreame diagnostics endpoint — POST /dreame-diag
 * Body: { username, password }
 * Returns step-by-step raw results from every API call to help debug connectivity.
 */
import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';

const router = Router();

const BASE_URL = 'https://eu.iot.dreame.tech:13267';
const PASSWORD_SALT = 'RAylYC%fmSKp7%Tq';
const BASIC_AUTH = 'Basic ZHJlYW1lX2FwcHYxOkFQXmR2QHpAU1FZVnhOODg=';

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent': 'Dart/3.2 (dart:io)',
  'dreame-meta': 'cv=i_829',
  'dreame-rlc': '1a9bb36e6b22617cf465363ba7c232fb131899d593e8d1a1-1',
  'tenant-id': '000000',
  Authorization: BASIC_AUTH,
};

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

async function get(path: string, token: string): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { ...COMMON_HEADERS, 'dreame-auth': `bearer ${token}` };
  const res = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers });
  const text = await res.text();
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

async function post(path: string, body: object, token?: string, authStyle: 'dreame-header' | 'bearer-replace' | 'both' = 'dreame-header'): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { ...COMMON_HEADERS, 'Content-Type': 'application/json' };
  if (token) {
    if (authStyle === 'dreame-header') {
      headers['dreame-auth'] = `bearer ${token}`;
    } else if (authStyle === 'bearer-replace') {
      headers['Authorization'] = `Bearer ${token}`;
      delete headers['dreame-auth'];
    } else {
      headers['dreame-auth'] = `bearer ${token}`;
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

router.post('/', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });

  const report: any = { steps: [] };

  const step = (name: string, result: any) => {
    report.steps.push({ name, result });
    console.log(`[DIAG] ${name}:`, JSON.stringify(result).substring(0, 300));
  };

  // ── Step 1: Login ─────────────────────────────────────────────────────────
  const hashedPw = md5(password + PASSWORD_SALT);
  const loginParams = new URLSearchParams({
    grant_type: 'password', scope: 'all', platform: 'IOS', type: 'account',
    username, password: hashedPw, country: 'IL', lang: 'en',
  });

  let token: string | null = null;
  try {
    const loginRes = await fetch(`${BASE_URL}/dreame-auth/oauth/token`, {
      method: 'POST',
      headers: { ...COMMON_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', 'dreame-auth': 'bearer' },
      body: loginParams.toString(),
    });
    const loginText = await loginRes.text();
    let loginBody: any;
    try { loginBody = JSON.parse(loginText); } catch { loginBody = loginText; }
    step('1_login', { httpStatus: loginRes.status, body: loginBody });
    token = loginBody?.access_token ?? null;
    report.loginOk = !!token;
  } catch (e: any) {
    step('1_login', { error: e.message });
    return res.json(report);
  }

  if (!token) return res.json(report);

  // ── Step 2: List devices (all known endpoints) ────────────────────────────
  let uid = '';
  try { uid = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())?.uid ?? ''; } catch {}

  type AuthStyle = 'dreame-header' | 'bearer-replace' | 'both';
  const deviceAttempts: { path: string; body: object; auth?: AuthStyle; label?: string }[] = [
    // Standard dreame-auth header
    { path: '/dreame-user-iot/iotuserbind/device/listV2', body: { current: 1, size: 100, lang: 'en', timestamp: Date.now() } },
    { path: '/dreame-user-iot/iotuserbind/device/list',   body: { current: 1, size: 100, lang: 'en' } },
    // Bearer replaces Basic auth
    { path: '/dreame-user-iot/iotuserbind/device/listV2', body: { current: 1, size: 100, lang: 'en', timestamp: Date.now() }, auth: 'bearer-replace', label: 'listV2_bearerReplace' },
    { path: '/dreame-user-iot/iotuserbind/device/list',   body: { current: 1, size: 100, lang: 'en' }, auth: 'bearer-replace', label: 'list_bearerReplace' },
    // Both headers
    { path: '/dreame-user-iot/iotuserbind/device/listV2', body: { current: 1, size: 100, lang: 'en', timestamp: Date.now() }, auth: 'both', label: 'listV2_both' },
  ];
  let did: string | null = null;
  for (const a of deviceAttempts) {
    const r = await post(a.path, a.body, token, a.auth ?? 'dreame-header').catch(e => ({ status: 0, body: e.message }));
    const label = a.label ?? a.path.split('/').pop()!;
    step(`2_devices_${label}`, r);
    if (!did) {
      const records: any[] =
        r.body?.data?.page?.records ?? r.body?.data?.records ??
        r.body?.data?.list ?? r.body?.data ?? r.body?.result?.records ?? [];
      if (Array.isArray(records) && records.length > 0) {
        did = records[0]?.did ?? records[0]?.deviceId ?? null;
        report.foundDid = did;
        report.allDevices = records.map((d: any) => ({ did: d.did || d.deviceId, model: d.model }));
      }
    }
  }

  // ── Step 2b: Try home-based device lookup ─────────────────────────────────
  if (!did) {
    // First get home list, then get devices per home
    const homeR = await post('/dreame-user-iot/home/info/list', { lang: 'en' }, token)
      .catch(e => ({ status: 0, body: e.message }));
    step('2b_home_list', homeR);

    const homes: any[] =
      homeR.body?.data?.list ?? homeR.body?.data ?? homeR.body?.data?.records ?? [];
    if (Array.isArray(homes)) {
      for (const home of homes.slice(0, 3)) {
        const homeId = home.homeId ?? home.id ?? home.familyId;
        if (!homeId) continue;
        const hdR = await post('/dreame-user-iot/home/device/list', { homeId, lang: 'en' }, token)
          .catch(e => ({ status: 0, body: e.message }));
        step(`2b_home_${homeId}_devices`, hdR);
        const devs: any[] =
          hdR.body?.data?.list ?? hdR.body?.data?.records ?? hdR.body?.data ?? [];
        if (Array.isArray(devs) && devs.length > 0) {
          did = devs[0]?.did ?? devs[0]?.deviceId ?? null;
          report.foundDid = did;
          report.allDevices = devs.map((d: any) => ({ did: d.did || d.deviceId, model: d.model }));
          break;
        }
      }
    }
  }

  // ── Step 2c: Try GET endpoints ────────────────────────────────────────────
  if (!did) {
    const getAttempts = [
      '/dreame-user-iot/iotuserbind/device/listV2?current=1&size=100&lang=en',
      '/dreame-user-iot/iotuserbind/device/list?current=1&size=100&lang=en',
      '/dreame-user-iot/home/info/list?lang=en',
    ];
    for (const path of getAttempts) {
      const r = await get(path, token).catch(e => ({ status: 0, body: e.message }));
      step(`2c_GET_${path.split('/').pop()!.split('?')[0]}`, r);
      const records: any[] =
        r.body?.data?.page?.records ?? r.body?.data?.records ??
        r.body?.data?.list ?? r.body?.data ?? [];
      if (Array.isArray(records) && records.length > 0) {
        did = records[0]?.did ?? records[0]?.deviceId ?? null;
        report.foundDid = did;
        report.allDevices = records.map((d: any) => ({ did: d.did || d.deviceId, model: d.model }));
        break;
      }
    }
  }

  if (!did) {
    report.note = 'No device DID found — cannot test commands';
    return res.json(report);
  }

  // ── Step 3: Test beep — multiple siid/aiid combos ─────────────────────────
  const beepCombos = [
    { siid: 7,  aiid: 1 },
    { siid: 17, aiid: 1 },
    { siid: 2,  aiid: 4 },  // some models use siid=2 aiid=4 for locate
  ];
  for (const { siid, aiid } of beepCombos) {
    const id = Math.floor(Math.random() * 9000) + 1000;
    const body = { did, id, method: 'action', params: { did, siid, aiid, in: [] } };
    const r = await post('/dreame-iot-com-10000/device/sendCommand', body, token)
      .catch(e => ({ status: 0, body: e.message }));
    step(`3_beep_siid${siid}_aiid${aiid}`, r);
    if ((r.body as any)?.code === 0) {
      report.beepSuccess = { siid, aiid };
      break;
    }
  }

  // ── Step 4: Get device status / properties ────────────────────────────────
  const statusAttempts = [
    {
      name: '4a_getProperties_siid4',
      path: '/dreame-iot-com-10000/device/getProperties',
      body: {
        did, id: Math.floor(Math.random() * 9000) + 1000,
        method: 'get_properties',
        params: [
          { did, siid: 2, piid: 1 },  // state
          { did, siid: 2, piid: 4 },  // battery
          { did, siid: 4, piid: 1 },  // cleaning mode
        ],
      },
    },
  ];
  for (const a of statusAttempts) {
    const r = await post(a.path, a.body, token).catch(e => ({ status: 0, body: e.message }));
    step(a.name, r);
  }

  // ── Step 5: Get map ────────────────────────────────────────────────────────
  const mapAttempts = [
    { name: '5a_map_info',  path: '/dreame-user-iot/iotuserbind/device/map/info', body: { did, lang: 'en', timestamp: Date.now() } },
    { name: '5b_map_list',  path: '/dreame-user-iot/iotuserbind/device/map/list', body: { did, lang: 'en' } },
    {
      name: '5c_map_props',
      path: '/dreame-iot-com-10000/device/getProperties',
      body: {
        did, id: Math.floor(Math.random() * 9000) + 1000,
        method: 'get_properties',
        params: [
          { did, siid: 6, piid: 1 }, { did, siid: 6, piid: 2 },
          { did, siid: 6, piid: 3 }, { did, siid: 6, piid: 4 },
          { did, siid: 6, piid: 8 },
        ],
      },
    },
  ];
  for (const a of mapAttempts) {
    const r = await post(a.path, a.body, token).catch(e => ({ status: 0, body: e.message }));
    step(a.name, r);
  }

  report.summary = {
    loginOk: report.loginOk,
    foundDid: report.foundDid,
    devices: report.allDevices,
    beepSuccess: report.beepSuccess ?? null,
  };

  return res.json(report);
});

export default router;
