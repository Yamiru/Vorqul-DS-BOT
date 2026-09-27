import axios from 'axios';

export interface McStatus {
  online: boolean;
  host: string;
  port?: number;
  hostname?: string;
  version?: string;
  playersOnline: number;
  playersMax: number;
  playerList: string[];
  motd?: string;
  iconUrl?: string;
}

const API = 'https://api.mcsrvstat.us';

export async function fetchMcStatus(host: string, port?: number, bedrock = false): Promise<McStatus> {
  const target = port ? `${host}:${port}` : host;
  const url = bedrock ? `${API}/bedrock/3/${target}` : `${API}/3/${target}`;

  const fallback: McStatus = {
    online: false, host, port, playersOnline: 0, playersMax: 0, playerList: [],
  };

  try {
    const { data } = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'VorqulDSBot' } });
    if (!data || data.online !== true) return fallback;

    const motd: string | undefined = Array.isArray(data.motd?.clean)
      ? data.motd.clean.join('\n').trim()
      : undefined;

    const list: string[] = Array.isArray(data.players?.list)
      ? data.players.list.map((p: any) => (typeof p === 'string' ? p : p?.name)).filter(Boolean)
      : [];

    return {
      online: true,
      host,
      port,
      hostname: data.hostname || host,
      version: typeof data.version === 'string' ? data.version : (data.version?.name || undefined),
      playersOnline: data.players?.online ?? 0,
      playersMax: data.players?.max ?? 0,
      playerList: list,
      motd,
      iconUrl: `${API}/icon/${target}`,
    };
  } catch {
    return fallback;
  }
}
