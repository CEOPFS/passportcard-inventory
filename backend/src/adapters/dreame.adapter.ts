import * as crypto from 'crypto';

const BASE_URL = 'https://eu.iot.dreame.tech:13267';
const PASSWORD_SALT = 'RAylYC%fmSKp7%Tq';
const BASIC_AUTH = 'Basic ZHJlYW1lX2FwcHYxOkFQXmR2QHpAU1FZVnhOODg=';

const COMMON_HEADERS = {
  'User-Agent': 'Dart/3.2 (dart:io)',
  'dreame-meta': 'cv=i_829',
  'dreame-rlc': '1a9bb36e6b22617cf465363ba7c232fb131899d593e8d1a1-1',
  'tenant-id': '000000',
  Authorization: BASIC_AUTH,
};

interface DreameSession {
  accessToken: string;
  refreshToken: string;
  uid: string;
  expiresAt: number;
}

interface DreameDevice {
  did: string;
  model: string;
  customName: string;
  displayName: string;
  bindDomain: string;
}

// In-memory token cache keyed by username
const sessionCache = new Map<string, DreameSession>();

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

async function dreamePost(path: string, body: object, accessToken?: string): Promise<any> {
  const headers: Record<string, string> = {
    ...COMMON_HEADERS,
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['dreame-auth'] = `bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Dreame API error ${res.status}: ${text}`);
  }

  return res.json();
}

export class DreameAdapter {
  static async login(username: string, password: string): Promise<DreameSession> {
    const hashedPassword = md5(password + PASSWORD_SALT);

    const params = new URLSearchParams({
      grant_type: 'password',
      scope: 'all',
      platform: 'IOS',
      type: 'account',
      username,
      password: hashedPassword,
      country: 'IL',
      lang: 'en',
    });

    const res = await fetch(`${BASE_URL}/dreame-auth/oauth/token`, {
      method: 'POST',
      headers: {
        ...COMMON_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'dreame-auth': 'bearer',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = text;
      try {
        const json = JSON.parse(text);
        msg = json.msg || json.message || json.error || text;
      } catch {}
      if (res.status === 401 || msg.includes('access_token_denied') || msg.includes('invalid_grant')) {
        throw new Error('האימייל או הסיסמה שגויים. אנא בדוק את פרטי הכניסה לאפליקציית DreameHome.');
      }
      throw new Error(`Dreame login failed (${res.status}): ${msg}`);
    }

    const data = await res.json() as Record<string, unknown>;
    if (!data.access_token) {
      throw new Error('Dreame login failed: no access token returned');
    }

    const session: DreameSession = {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string | undefined,
      uid: (data.uid || data.userId || '') as string,
      expiresAt: Date.now() + ((data.expires_in as number) || 3600) * 1000,
    };

    sessionCache.set(username, session);
    return session;
  }

  static async getSession(username: string, password: string): Promise<DreameSession> {
    const cached = sessionCache.get(username);
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached;
    }
    return this.login(username, password);
  }

  static async getDevices(accessToken: string): Promise<DreameDevice[]> {
    const data = await dreamePost(
      '/dreame-user-iot/iotuserbind/device/listV2',
      { sharedStatus: 1, current: 1, size: 100, lang: 'en', timestamp: Date.now() },
      accessToken
    );

    const records: any[] = data?.data?.page?.records ?? [];
    return records.map((r: any) => ({
      did: r.did,
      model: r.model,
      customName: r.customName || r.deviceInfo?.displayName || r.model,
      displayName: r.deviceInfo?.displayName || r.customName || r.model,
      bindDomain: r.bindDomain || '',
    }));
  }

  static async sendCommand(
    accessToken: string,
    did: string,
    siid: number,
    aiid: number,
    params: object[] = []
  ): Promise<any> {
    const id = Math.floor(Math.random() * 9000) + 1000;
    return dreamePost(
      '/dreame-iot-com-10000/device/sendCommand',
      {
        did,
        id,
        data: {
          did,
          id,
          method: 'action',
          params: { did, siid, aiid, in: params },
          from: 'XXXXXX',
        },
      },
      accessToken
    );
  }

  // Navigate to coordinates (uses map update action siid=6, aiid=2)
  static async navigateTo(accessToken: string, did: string, x: number, y: number): Promise<void> {
    await this.sendCommand(accessToken, did, 6, 2, [{ piid: 1, value: JSON.stringify({ x, y }) }]);
  }

  // Play locator beep / audio (siid=7, aiid=2)
  static async playAudio(accessToken: string, did: string): Promise<void> {
    await this.sendCommand(accessToken, did, 7, 2);
  }

  // Locate (short beep, siid=7, aiid=1)
  static async locate(accessToken: string, did: string): Promise<void> {
    await this.sendCommand(accessToken, did, 7, 1);
  }

  // Stop (siid=4, aiid=2)
  static async stop(accessToken: string, did: string): Promise<void> {
    await this.sendCommand(accessToken, did, 4, 2);
  }

  // Return to dock (siid=3, aiid=1)
  static async returnToDock(accessToken: string, did: string): Promise<void> {
    await this.sendCommand(accessToken, did, 3, 1);
  }
}
