import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/dashboard/lib/auth', () => ({ getAppSession: vi.fn() }));

import { botOwners, isBotOwner, resetOwnerCache } from '../src/dashboard/lib/guildAuth';

function stubApplication(body: unknown, status = 200) {
  const fetchMock = vi.fn(async (input: string, _init?: RequestInit) => {
    if (String(input).includes('/applications/@me')) return new Response(JSON.stringify(body), { status });
    return new Response('{}', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  resetOwnerCache();
  delete process.env.BOT_OWNER_ID;
  process.env.DISCORD_TOKEN = 'bot-token';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BOT_OWNER_ID;
  delete process.env.DISCORD_TOKEN;
  resetOwnerCache();
});

describe('bot owner detection', () => {
  it('recognises the owner of the Discord application without BOT_OWNER_ID', async () => {
    stubApplication({ owner: { id: '111' } });
    expect(await isBotOwner('111')).toBe(true);
    expect(await isBotOwner('222')).toBe(false);
  });

  it('recognises the owner and admins of a team application', async () => {
    stubApplication({
      owner: { id: 'team-user' },
      team: {
        owner_user_id: '111',
        members: [
          { role: 'admin', user: { id: '222' } },
          { role: 'developer', user: { id: '333' } }
        ]
      }
    });
    expect(await botOwners()).toEqual(['111', '222']);
    expect(await isBotOwner('333')).toBe(false);
  });

  it('still honours BOT_OWNER_ID, and combines it with the application owner', async () => {
    process.env.BOT_OWNER_ID = '555, 666';
    stubApplication({ owner: { id: '111' } });
    expect(await botOwners()).toEqual(['555', '666', '111']);
    expect(await isBotOwner('666')).toBe(true);
  });

  it('asks Discord only once within the cache window', async () => {
    const fetchMock = stubApplication({ owner: { id: '111' } });
    await isBotOwner('111');
    await isBotOwner('111');
    await isBotOwner('999');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'Bot bot-token' } });
  });

  it('fails closed when Discord cannot be reached or there is no token', async () => {
    stubApplication({}, 500);
    expect(await isBotOwner('111')).toBe(false);

    resetOwnerCache();
    delete process.env.DISCORD_TOKEN;
    const fetchMock = stubApplication({ owner: { id: '111' } });
    expect(await isBotOwner('111')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never treats a missing or non-string user as an owner', async () => {
    stubApplication({ owner: { id: '111' } });
    expect(await isBotOwner(undefined)).toBe(false);
    expect(await isBotOwner('')).toBe(false);
    expect(await isBotOwner(111)).toBe(false);
  });
});
