'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Icon from '../../../components/Icon';
import { brand } from '../../../../lib/brand';
import { useT } from '../../../components/LanguageProvider';
import GeneralTab from './tabs/GeneralTab';

// Every other tab is code-split: its JS only downloads once the user
// actually clicks that tab, instead of all ~35 tabs loading up front.
const AnalyticsTab = dynamic(() => import('./AnalyticsTab'));
const ApiKeysTab = dynamic(() => import('./ApiKeysTab'));
const AuditTab = dynamic(() => import('./AuditTab'));
const PluginsTab = dynamic(() => import('./PluginsTab'));
const ChannelsTab = dynamic(() => import('./ChannelsTab'));
const LinksTab = dynamic(() => import('./LinksTab'));
const WelcomeTab = dynamic(() => import('./tabs/WelcomeTab'));
const StickyTab = dynamic(() => import('./tabs/StickyTab'));
const BirthdayTab = dynamic(() => import('./tabs/BirthdayTab'));
const ConfessionsTab = dynamic(() => import('./tabs/ConfessionsTab'));
const ReputationTab = dynamic(() => import('./tabs/ReputationTab'));
const CountingTab = dynamic(() => import('./tabs/CountingTab'));
const WebhooksTab = dynamic(() => import('./tabs/WebhooksTab'));
const EmbedTab = dynamic(() => import('./tabs/EmbedTab'));
const AutomodTab = dynamic(() => import('./tabs/AutomodTab'));
const LoggingTab = dynamic(() => import('./tabs/LoggingTab'));
const LevelingTab = dynamic(() => import('./tabs/LevelingTab'));
const EconomyTab = dynamic(() => import('./tabs/EconomyTab'));
const TicketsTab = dynamic(() => import('./tabs/TicketsTab'));
const AppealsTab = dynamic(() => import('./tabs/AppealsTab'));
const ApplicationsTab = dynamic(() => import('./tabs/ApplicationsTab'));
const GiveawaysTab = dynamic(() => import('./tabs/GiveawaysTab'));
const ReactionrolesTab = dynamic(() => import('./tabs/ReactionrolesTab'));
const TempchannelsTab = dynamic(() => import('./tabs/TempchannelsTab'));
const VerificationTab = dynamic(() => import('./tabs/VerificationTab'));
const StarboardTab = dynamic(() => import('./tabs/StarboardTab'));
const GamesTab = dynamic(() => import('./tabs/GamesTab'));
const CryptoTab = dynamic(() => import('./tabs/CryptoTab'));
const SocialsTab = dynamic(() => import('./tabs/SocialsTab'));
const SuggestionsTab = dynamic(() => import('./tabs/SuggestionsTab'));
const AutoresponseTab = dynamic(() => import('./tabs/AutoresponseTab'));
const FeedsTab = dynamic(() => import('./tabs/FeedsTab'));
const RemindersTab = dynamic(() => import('./tabs/RemindersTab'));
const TagsTab = dynamic(() => import('./tabs/TagsTab'));
const WarningsTab = dynamic(() => import('./tabs/WarningsTab'));
const BackupTab = dynamic(() => import('./tabs/BackupTab'));
const HelpTab = dynamic(() => import('./tabs/HelpTab'));

interface Channel { id: string; name: string; type: number; }
interface Role { id: string; name: string; color: number; }

const TABS = [
  { id: 'general', labelKey: 'sx.settings.tab.general', icon: 'settings' },
  { id: 'channels', labelKey: 'sx.settings.tab.channels', icon: 'logs' },
  { id: 'links', labelKey: 'sx.settings.tab.links', icon: 'link' },
  { id: 'analytics', labelKey: 'sx.settings.tab.analytics', icon: 'analytics' },
  { id: 'welcome', labelKey: 'sx.settings.tab.welcome', icon: 'welcome' },
  { id: 'sticky', labelKey: 'sx.settings.tab.sticky', icon: 'sticky' },
  { id: 'birthday', labelKey: 'sx.settings.tab.birthday', icon: 'birthday' },
  { id: 'confessions', labelKey: 'sx.settings.tab.confessions', icon: 'confessions' },
  { id: 'embed', labelKey: 'sx.settings.tab.embed', icon: 'embed' },
  { id: 'automod', labelKey: 'sx.settings.tab.automod', icon: 'automod' },
  { id: 'logging', labelKey: 'sx.settings.tab.logging', icon: 'logs' },
  { id: 'leveling', labelKey: 'sx.settings.tab.leveling', icon: 'leveling' },
  { id: 'economy', labelKey: 'sx.settings.tab.economy', icon: 'economy' },
  { id: 'tickets', labelKey: 'sx.settings.tab.tickets', icon: 'ticket' },
  { id: 'appeals', labelKey: 'sx.settings.tab.appeals', icon: 'appeals' },
  { id: 'applications', labelKey: 'sx.settings.tab.applications', icon: 'applications' },
  { id: 'giveaways', labelKey: 'sx.settings.tab.giveaways', icon: 'gift' },
  { id: 'reactionroles', labelKey: 'sx.settings.tab.reactionroles', icon: 'reactionroles' },
  { id: 'tempchannels', labelKey: 'sx.settings.tab.tempchannels', icon: 'tempchannels' },
  { id: 'verification', labelKey: 'sx.settings.tab.verification', icon: 'check' },
  { id: 'starboard', labelKey: 'sx.settings.tab.starboard', icon: 'starboard' },
  { id: 'games', labelKey: 'sx.settings.tab.games', icon: 'games' },
  { id: 'crypto', labelKey: 'sx.settings.tab.crypto', icon: 'crypto' },
  { id: 'socials', labelKey: 'sx.settings.tab.socials', icon: 'globe' },
  { id: 'suggestions', labelKey: 'sx.settings.tab.suggestions', icon: 'suggestions' },
  { id: 'reputation', labelKey: 'sx.settings.tab.reputation', icon: 'reputation' },
  { id: 'counting', labelKey: 'sx.settings.tab.counting', icon: 'counting' },
  { id: 'autoresponse', labelKey: 'sx.settings.tab.autoresponse', icon: 'autoresponse' },
  { id: 'feeds', labelKey: 'sx.settings.tab.feeds', icon: 'feed' },
  { id: 'reminders', labelKey: 'sx.settings.tab.reminders', icon: 'reminders' },
  { id: 'tags', labelKey: 'sx.settings.tab.tags', icon: 'tags' },
  { id: 'warnings', labelKey: 'sx.settings.tab.warnings', icon: 'warnings' },
  { id: 'backup', labelKey: 'sx.settings.tab.backup', icon: 'backup' },
  { id: 'webhooks', labelKey: 'sx.settings.tab.webhooks', icon: 'webhooks' },
  { id: 'apikeys', labelKey: 'sx.settings.tab.apikeys', icon: 'apikeys' },
  { id: 'plugins', labelKey: 'sx.settings.tab.plugins', icon: 'plugins' },
  { id: 'audit', labelKey: 'sx.settings.tab.audit', icon: 'audit' },
  { id: 'help', labelKey: 'sx.settings.tab.help', icon: 'help' },
] as const;

export default function SettingsPage() {
  const t = useT();
  const { data: session } = useSession();
  const params = useParams();
  const guildId = params.guildId as string;

  const [settings, setSettings] = useState<any>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [guildName, setGuildName] = useState('');
  const [myGuilds, setMyGuilds] = useState<{ id: string; name: string }[]>([]);
  const [premiumTier, setPremiumTier] = useState<string>('free');
  const [gateEnabled, setGateEnabled] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');
  const [embedPreview, setEmbedPreview] = useState<any>({});
  const [embedRole, setEmbedRole] = useState<string>('');
  const [sendingEmbed, setSendingEmbed] = useState(false);
  const [sendingRR, setSendingRR] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stickyForm, setStickyForm] = useState<any>({ channelId: '', content: '', useEmbed: false, color: '#14707A', title: '' });

  const welcomeImageRef = useRef<HTMLInputElement>(null);
  const welcomeCardBgRef = useRef<HTMLInputElement>(null);
  const embedImageRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchData(); }, [guildId]);
  useEffect(() => {
    fetch('/api/gate').then(r => r.json()).then(d => setGateEnabled(!!d?.enabled)).catch((error: unknown) => console.debug('page: suppressed error', error));
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, channelsRes, rolesRes, guildRes, premiumRes] = await Promise.all([
        fetch(`/api/guilds/${guildId}/settings`),
        fetch(`/api/guilds/${guildId}/channels`),
        fetch(`/api/guilds/${guildId}/roles`),
        fetch('/api/me/guilds', { cache: 'no-store' }),
        fetch(`/api/guilds/${guildId}/premium`).catch(() => null)
      ]);
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (channelsRes.ok) setChannels(await channelsRes.json());
      if (rolesRes.ok) setRoles(await rolesRes.json());

      if (guildRes.ok) {
        const data = await guildRes.json();
        const all = Array.isArray(data.guilds) ? data.guilds : [];
        const current = all.find((g: any) => g.id === guildId);
        if (current) setGuildName(current.name);

        setMyGuilds(all.filter((g: any) => g.hasBot).map((g: any) => ({ id: g.id, name: g.name })));
      }

      if (premiumRes?.ok) {
        const p = await premiumRes.json();
        setPremiumTier(p.tier || 'free');
      }
    } catch (err) { console.error('Error:', err); }
    finally { setLoading(false); }
  };

  const saveSettings = async () => {
    if (!settings || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(t('sx.settings.saveFailed', { error: body.error || `HTTP ${res.status}` }));
        return;
      }

      alert(t('sx.settings.saved'));
    } catch (err) { alert(t('sx.settings.saveError')); }
    finally { setSaving(false); }
  };

  const updateSettings = (path: string, value: any) => {
    setSettings((prev: any) => {
      if (!prev) return prev;
      const newSettings = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj: any = newSettings;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  const uploadImage = async (file: File, target: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('target', target);

      const res = await fetch(`/api/guilds/${guildId}/upload`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (target === 'welcomeImage') {
          updateSettings('welcomeEmbed.image', data.url);
        } else if (target === 'welcomeCardBg') {
          updateSettings('welcomeCard.backgroundUrl', data.url);
        } else if (target === 'embedImage') {
          setEmbedPreview({...embedPreview, image: data.url});
        }
        alert(t('sx.settings.imageUploaded'));
      } else {
        alert(t('sx.settings.uploadError'));
      }
    } catch (err) {
      alert(t('sx.settings.uploadError'));
    }
    setUploading(false);
  };

  const createBackup = async () => {
    setBackupStatus(t('sx.settings.backupCreating'));
    try {
      const res = await fetch(`/api/guilds/${guildId}/backup`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBackupStatus(t('sx.settings.backupCreated', { filename: data.filename }));
      } else setBackupStatus(t('sx.settings.error'));
    } catch { setBackupStatus(t('sx.settings.error')); }
  };

  const deployPanel = async (type: string, endpoint: string, data: any): Promise<boolean> => {
    try {
      const res = await fetch(`/api/guilds/${guildId}/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        alert(t('sx.settings.panelSent', { type }));
      } else {
        let msg = t('sx.settings.sendError');
        try {
          const err = await res.json(); if (err?.error) msg = err.error;
        } catch (error) {
          console.debug('page: suppressed error', error);
        }
        alert(`❌ ${msg}`);
      }
      return res.ok;
    } catch { alert(t('sx.settings.error')); return false; }
  };

  const persistSavedMessages = async (list: any[]) => {
    const newSettings: any = { ...(settings || {}), savedMessages: list };
    setSettings(newSettings);
    try {
      await fetch(`/api/guilds/${guildId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
    } catch (error) {
        console.debug('page: suppressed error', error);
      }
  };

  const recordMessage = (sent: boolean) => {
    const list = (settings as any)?.savedMessages || [];
    const entry = {
      id: Date.now().toString(),
      name: embedPreview.title || (embedPreview.content || '').slice(0, 40) || (sent ? t('sx.settings.sentMessage') : t('sx.settings.untitledMessage')),
      data: { ...embedPreview },
      savedAt: new Date().toISOString(),
      sent,
    };
    persistSavedMessages([entry, ...list]);
  };

  const sendEmbed = async () => {
    if (!embedPreview.channel) { alert(t('sx.settings.selectChannel')); return; }
    if (sendingEmbed) return;
    setSendingEmbed(true);
    try {
      const payload = embedPreview.plain
        ? { channel: embedPreview.channel, content: embedPreview.content, plain: true, username: embedPreview.username, avatarUrl: embedPreview.avatarUrl }
        : embedPreview;
      const ok = await deployPanel(t('sx.settings.embedName'), 'embed/send', payload);
      if (ok) recordMessage(true);
    } finally {
      setSendingEmbed(false);
    }
  };

  const saveDraft = () => {
    if (!embedPreview.title && !embedPreview.description && !embedPreview.content) {
      alert(t('sx.settings.nothingToSaveMessage')); return;
    }
    recordMessage(false);
    alert(t('sx.settings.draftSaved'));
  };

  const loadSaved = (m: any) => { setEmbedPreview({ ...m.data }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const duplicateSaved = (m: any) => { setEmbedPreview({ ...m.data, channel: '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const resendSaved = async (m: any) => {
    if (!m.data?.channel) { alert(t('sx.settings.messageNoChannel')); return; }
    if (sendingEmbed) return;
    setSendingEmbed(true);
    try {
      await deployPanel(t('sx.settings.embedName'), 'embed/send', m.data);
    } finally {
      setSendingEmbed(false);
    }
  };
  const deleteSaved = (id: string) => {
    persistSavedMessages(((settings as any)?.savedMessages || []).filter((m: any) => m.id !== id));
  };

  const persistSavedPanels = async (list: any[]) => {
    const newSettings: any = { ...(settings || {}), savedReactionRoles: list };
    setSettings(newSettings);
    try {
      await fetch(`/api/guilds/${guildId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
    } catch (error) {
        console.debug('page: suppressed error', error);
      }
  };

  const panelSnapshot = () => {
    const rr = JSON.parse(JSON.stringify(settings?.reactionRoles || {}));
    delete rr.editing;
    return rr;
  };

  const recordPanel = (sent: boolean, meta?: { messageId?: string; channelId?: string }) => {
    const rr = panelSnapshot();
    const list = (settings as any)?.savedReactionRoles || [];
    const entry = {
      id: Date.now().toString(),
      name: (rr.title || '').trim() || (sent ? t('sx.settings.sentPanel') : t('sx.settings.untitledPanel')),
      data: rr,
      savedAt: new Date().toISOString(),
      sent,
      messageId: meta?.messageId || null,
      channelId: meta?.channelId || null,
    };
    persistSavedPanels([entry, ...list]);
  };

  const deployReactionRoles = async (payload: any): Promise<{ ok: boolean; messageId?: string; channelId?: string }> => {
    try {
      const res = await fetch(`/api/guilds/${guildId}/reactionroles/deploy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        alert(`❌ ${data?.error || t('sx.settings.sendError')}`);
        return { ok: false };
      }
      return { ok: true, messageId: data.messageId, channelId: data.channelId };
    } catch { alert(t('sx.settings.error')); return { ok: false }; }
  };

  const sendReactionRolesPanel = async () => {
    const rr = settings?.reactionRoles || {};
    if (!rr.channel) { alert(t('sx.settings.selectChannel')); return; }
    if (!rr.buttons || rr.buttons.length === 0) { alert(t('sx.settings.addButton')); return; }
    if (sendingRR) return;
    setSendingRR(true);
    try {
      const result = await deployReactionRoles(panelSnapshot());
      if (result.ok) {
        alert(t('sx.settings.reactionRolesSent'));
        recordPanel(true, result);
      }
    } finally {
      setSendingRR(false);
    }
  };

  const updateReactionRolesPanel = async () => {
    const rr = settings?.reactionRoles || {};
    const editing = rr.editing;
    if (!editing?.messageId) { alert(t('sx.settings.noPanelEditing')); return; }
    if (!rr.buttons || rr.buttons.length === 0) { alert(t('sx.settings.addButton')); return; }
    if (sendingRR) return;
    setSendingRR(true);
    try {
      const payload = { ...panelSnapshot(), channel: editing.channelId, editMessageId: editing.messageId };
      const result = await deployReactionRoles(payload);
      if (!result.ok) return;

      alert(t('sx.settings.panelUpdated'));

      const list = ((settings as any)?.savedReactionRoles || []).map((p: any) =>
        p.messageId === editing.messageId
          ? { ...p, data: panelSnapshot(), name: (rr.title || '').trim() || p.name, savedAt: new Date().toISOString() }
          : p
      );
      persistSavedPanels(list);
    } finally {
      setSendingRR(false);
    }
  };

  const saveReactionRolesPanel = () => {
    const rr = settings?.reactionRoles || {};
    if ((!rr.buttons || rr.buttons.length === 0) && !rr.title && !rr.description) {
      alert(t('sx.settings.nothingToSavePanel')); return;
    }
    recordPanel(false);
    alert(t('sx.settings.draftSaved'));
  };

  const loadSavedPanel = (p: any) => {
    const data = JSON.parse(JSON.stringify(p.data || {}));
    if (p.messageId) {
      data.editing = { messageId: p.messageId, channelId: p.channelId || data.channel || '' };
    } else {
      delete data.editing;
    }
    updateSettings('reactionRoles', data);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stopEditingPanel = () => {
    const rr = panelSnapshot();
    updateSettings('reactionRoles', rr);
  };

  const resendSavedPanel = async (p: any) => {
    if (!p.data?.channel) { alert(t('sx.settings.panelNoChannel')); return; }
    if (sendingRR) return;
    setSendingRR(true);
    try {
      const data = JSON.parse(JSON.stringify(p.data));
      delete data.editing;
      const result = await deployReactionRoles(data);
      if (result.ok) alert(t('sx.settings.reactionRolesSent'));
    } finally {
      setSendingRR(false);
    }
  };

  const deleteSavedPanel = (id: string) => {
    persistSavedPanels((((settings as any)?.savedReactionRoles) || []).filter((p: any) => p.id !== id));
  };

  const textChannels = channels.filter(c => c.type === 0);
  const voiceChannels = channels.filter(c => c.type === 2);
  const categories = channels.filter(c => c.type === 4);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#14120F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #14707A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  const inputStyle = { backgroundColor: '#1B1815', border: '1px solid #3A332A', borderRadius: '8px', padding: '10px 12px', color: '#EDE6D8', width: '100%', transition: 'border-color 0.2s, box-shadow 0.2s' };
  const labelStyle = { display: 'block', color: '#EDE6D8', marginBottom: '6px', fontSize: '13px', fontWeight: '500' as const };
  const cardStyle = { backgroundColor: '#221E19', borderRadius: '12px', padding: '20px', border: '1px solid #3A332A', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)' };
  const btnPrimary = { padding: '10px 20px', backgroundColor: '#14707A', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' };
  const btnSuccess = { ...btnPrimary, backgroundColor: '#7FA05B', color: '#1B1815' };
  const btnDanger = { padding: '8px 12px', backgroundColor: '#D06450', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
  const btnSecondary = { padding: '8px 16px', backgroundColor: '#3A332A', color: '#EDE6D8', border: 'none', borderRadius: '4px', cursor: 'pointer' };

  const getPath = (obj: any, path: string) => path.split('.').reduce((o: any, k) => (o == null ? o : o[k]), obj);

  const msgTypeSwitch = (enabledPath: string) => {
    const isEmbed = !!getPath(settings, enabledPath);
    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={() => updateSettings(enabledPath, false)} style={!isEmbed ? btnPrimary : btnSecondary}>{t('sx.settings.plainText')}</button>
        <button type="button" onClick={() => updateSettings(enabledPath, true)} style={isEmbed ? btnPrimary : btnSecondary}>{t('sx.settings.embedBtn')}</button>
      </div>
    );
  };

  const embedFieldset = (prefix: string) => {
    const v = (k: string) => getPath(settings, `${prefix}.${k}`) || '';
    return (
      <div style={{ backgroundColor: '#1B1815', padding: '16px', borderRadius: '8px', display: 'grid', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
          <div><label style={labelStyle}>{t('sx.settings.embedTitle')}</label><input type="text" value={v('title')} onChange={(e) => updateSettings(`${prefix}.title`, e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>{t('sx.settings.embedColor')}</label><input type="color" value={v('color') || '#14707A'} onChange={(e) => updateSettings(`${prefix}.color`, e.target.value)} style={{ width: '100%', height: '38px', border: 'none', borderRadius: '6px' }} /></div>
        </div>
        <div><label style={labelStyle}>{t('sx.settings.embedDescription', { vars: '{user}, {username}, {server}, {memberCount}' })}</label><textarea value={v('description')} onChange={(e) => updateSettings(`${prefix}.description`, e.target.value)} rows={3} style={inputStyle} /></div>
        <div><label style={labelStyle}>{t('sx.settings.embedImageUrl', { avatar: '{avatar}' })}</label><input type="text" value={v('image')} onChange={(e) => updateSettings(`${prefix}.image`, e.target.value)} style={inputStyle} placeholder="https://..." /></div>
        <div><label style={labelStyle}>{t('sx.settings.embedThumbnailUrl', { avatar: '{avatar}' })}</label><input type="text" value={v('thumbnail')} onChange={(e) => updateSettings(`${prefix}.thumbnail`, e.target.value)} style={inputStyle} placeholder="{avatar}" /></div>
        <div><label style={labelStyle}>{t('sx.settings.embedFooter')}</label><input type="text" value={v('footer')} onChange={(e) => updateSettings(`${prefix}.footer`, e.target.value)} style={inputStyle} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!getPath(settings, `${prefix}.timestamp`)} onChange={() => updateSettings(`${prefix}.timestamp`, !getPath(settings, `${prefix}.timestamp`))} style={{ accentColor: '#14707A' }} />
          <span style={{ color: '#EDE6D8' }}>{t('sx.settings.addTimestamp')}</span>
        </label>
      </div>
    );
  };

  const applySavedTo = (prefix: string, enabledPath: string, m: any) => {
    const d = m?.data || {};
    const ns = JSON.parse(JSON.stringify(settings || {}));
    const setIn = (path: string, value: any) => {
      const keys = path.split('.'); let obj: any = ns;
      for (let i = 0; i < keys.length - 1; i++) { if (!obj[keys[i]]) obj[keys[i]] = {}; obj = obj[keys[i]]; }
      obj[keys[keys.length - 1]] = value;
    };
    setIn(`${prefix}.title`, d.title || '');
    setIn(`${prefix}.description`, d.description || '');
    setIn(`${prefix}.color`, d.color || '#14707A');
    setIn(`${prefix}.image`, d.image || '');
    setIn(`${prefix}.thumbnail`, d.thumbnail || '');
    setIn(`${prefix}.footer`, d.footer || '');
    setIn(`${prefix}.author`, d.author || '');
    setIn(`${prefix}.timestamp`, !!d.timestamp);
    setIn(`${prefix}.content`, d.content || '');
    setIn(enabledPath, !d.plain);
    setSettings(ns);
  };

  const saveCurrentAsMessage = (prefix: string, enabledPath: string, defaultName: string) => {
    const cfg = getPath(settings, prefix) || {};
    const entry = {
      id: Date.now().toString(),
      name: cfg.title || defaultName,
      data: {
        plain: !getPath(settings, enabledPath),
        content: cfg.content || '', title: cfg.title || '', description: cfg.description || '',
        color: cfg.color || '#14707A', image: cfg.image || '', thumbnail: cfg.thumbnail || '',
        footer: cfg.footer || '', author: cfg.author || '', timestamp: !!cfg.timestamp,
      },
      savedAt: new Date().toISOString(), sent: false,
    };
    persistSavedMessages([entry, ...(((settings as any)?.savedMessages) || [])]);
    alert(t('sx.settings.savedToLibrary'));
  };

  const savedMsgRow = (prefix: string, enabledPath: string, defaultName: string) => {
    const saved = ((settings as any)?.savedMessages) || [];
    return (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value="" onChange={(e) => { const m = saved.find((x: any) => x.id === e.target.value); if (m) applySavedTo(prefix, enabledPath, m); }} style={{ ...inputStyle, maxWidth: '260px' }}>
          <option value="">{t('sx.settings.loadSaved')}</option>
          {saved.map((m: any) => <option key={m.id} value={m.id}>{m.name || t('sx.settings.untitled')}</option>)}
        </select>
        <button type="button" onClick={() => saveCurrentAsMessage(prefix, enabledPath, defaultName)} style={btnSecondary}>{t('sx.settings.saveAsMessage')}</button>
      </div>
    );
  };

  const saveStickyEntry = () => {
    if (!stickyForm.channelId || !stickyForm.content) { alert(t('sx.settings.stickyIncomplete')); return; }
    const list = Array.isArray((settings as any)?.sticky) ? [...(settings as any).sticky] : [];
    const entry = { channelId: stickyForm.channelId, content: stickyForm.content, useEmbed: !!stickyForm.useEmbed, color: stickyForm.color || '#14707A', title: stickyForm.title || '' };
    const idx = list.findIndex((s: any) => s.channelId === stickyForm.channelId);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    updateSettings('sticky', list);
    setStickyForm({ channelId: '', content: '', useEmbed: false, color: '#14707A', title: '' });
  };

  const removeStickyEntry = (channelId: string) => {
    const list = (Array.isArray((settings as any)?.sticky) ? (settings as any).sticky : []).filter((s: any) => s.channelId !== channelId);
    updateSettings('sticky', list);
  };

  const ctx = {
    activeTab,
    applySavedTo,
    backupStatus,
    btnDanger,
    btnPrimary,
    btnSecondary,
    btnSuccess,
    cardStyle,
    categories,
    channels,
    createBackup,
    deleteSaved,
    deleteSavedPanel,
    deployPanel,
    duplicateSaved,
    embedFieldset,
    embedImageRef,
    embedPreview,
    embedRole,
    fetchData,
    gateEnabled,
    getPath,
    guildId,
    guildName,
    inputStyle,
    labelStyle,
    loadSaved,
    loadSavedPanel,
    loading,
    msgTypeSwitch,
    myGuilds,
    persistSavedMessages,
    premiumTier,
    recordMessage,
    removeStickyEntry,
    resendSaved,
    resendSavedPanel,
    roles,
    saveCurrentAsMessage,
    saveDraft,
    saveReactionRolesPanel,
    sendReactionRolesPanel,
    stopEditingPanel,
    updateReactionRolesPanel,
    saveSettings,
    saveStickyEntry,
    savedMsgRow,
    saving,
    sendEmbed,
    sendingEmbed,
    sendingRR,
    session,
    setActiveTab,
    setBackupStatus,
    setChannels,
    setEmbedPreview,
    setEmbedRole,
    setGateEnabled,
    setGuildName,
    setLoading,
    setMyGuilds,
    setPremiumTier,
    setRoles,
    setSaving,
    setSettings,
    setStickyForm,
    setUploading,
    settings,
    stickyForm,
    textChannels,
    updateSettings,
    uploadImage,
    uploading,
    voiceChannels,
    welcomeImageRef,
    welcomeCardBgRef,
  };

  return (
    <div className="vd-shell" style={{ minHeight: '100vh', backgroundColor: '#14120F', display: 'flex' }}>
      <aside className="vd-sidebar" style={{ width: '220px', backgroundColor: '#1B1815', borderRight: '1px solid #3A332A', padding: '12px', flexShrink: 0, overflowY: 'auto', maxHeight: '100vh' }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', textDecoration: 'none', color: '#948C7C', fontSize: '13px', padding: '8px' }}>
          {t('sx.settings.back')}
        </Link>
        <div style={{ marginBottom: '16px', padding: '0 8px' }}>
          <div style={{ color: '#948C7C', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{brand.name}</div>
          {myGuilds.length > 1 ? (
            <select
              value={guildId}
              onChange={(e) => { if (e.target.value !== guildId) window.location.href = `/dashboard/${e.target.value}/settings`; }}
              style={{ width: '100%', backgroundColor: '#14120F', border: '1px solid #3A332A', color: 'white', borderRadius: '6px', padding: '7px 8px', fontSize: '13px', fontWeight: 600 }}
            >
              {myGuilds.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          ) : (
            <h2 style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>{guildName || t('sx.settings.server')}</h2>
          )}
          {premiumTier !== 'free' && (
            <span style={{ display: 'inline-block', marginTop: '8px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#14120F', backgroundColor: premiumTier === 'pro' ? '#D9A441' : '#B0567E', borderRadius: '999px', padding: '2px 10px' }}>
              {premiumTier}
            </span>
          )}
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', textAlign: 'left',
                backgroundColor: activeTab === tab.id ? '#14707A' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#948C7C'
              }}>
              <Icon name={tab.icon} size={15} /><span>{t(tab.labelKey)}</span>
            </button>
          ))}
        </nav>
        {gateEnabled && (
          <button
            onClick={async () => {
              try {
                await fetch('/api/gate', { method: 'DELETE' });
              } catch (error) {
                console.debug('page: suppressed error', error);
              }
              window.location.href = '/gate';
            }}
            style={{ marginTop: '12px', width: '100%', background: 'none', border: '1px solid #3A332A', color: '#948C7C', borderRadius: '4px', padding: '8px', fontSize: '11px', cursor: 'pointer' }}
          >{t('sx.settings.lockDashboard')}</button>
        )}
      </aside>

      <main className="vd-main" style={{ flex: 1, padding: '20px', overflow: 'auto', maxHeight: '100vh' }}>
        <div className="vd-content" style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ color: 'white', fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name={(TABS.find(t => t.id === activeTab)?.icon) || 'settings'} size={20} /> {(() => { const cur = TABS.find(tb => tb.id === activeTab); return cur ? t(cur.labelKey) : ''; })()}
            </h1>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={fetchData} style={btnSecondary}>{t('sx.settings.refresh')}</button>
              <button onClick={saveSettings} disabled={saving} style={btnSuccess}>
                {saving ? '⏳' : '💾'} {t('sx.settings.save')}
              </button>
            </div>
          </div>

          {activeTab === 'general' && settings && <GeneralTab ctx={ctx} />}

          {activeTab === 'channels' && <ChannelsTab guildId={guildId} />}

          {activeTab === 'links' && <LinksTab guildId={guildId} />}

          {activeTab === 'welcome' && settings && <WelcomeTab ctx={ctx} />}

          {activeTab === 'analytics' && <AnalyticsTab guildId={guildId} />}

          {activeTab === 'sticky' && settings && <StickyTab ctx={ctx} />}

          {activeTab === 'birthday' && settings && <BirthdayTab ctx={ctx} />}

          {activeTab === 'confessions' && settings && <ConfessionsTab ctx={ctx} />}

          {activeTab === 'reputation' && settings && <ReputationTab ctx={ctx} />}

          {activeTab === 'counting' && settings && <CountingTab ctx={ctx} />}

          {activeTab === 'webhooks' && settings && <WebhooksTab ctx={ctx} />}

          {activeTab === 'apikeys' && <ApiKeysTab guildId={guildId} />}

          {activeTab === 'plugins' && <PluginsTab guildId={guildId} />}

          {activeTab === 'audit' && <AuditTab guildId={guildId} />}

          {activeTab === 'embed' && <EmbedTab ctx={ctx} />}

          {activeTab === 'automod' && settings && <AutomodTab ctx={ctx} />}

          {activeTab === 'logging' && settings && <LoggingTab ctx={ctx} />}

          {activeTab === 'leveling' && settings && <LevelingTab ctx={ctx} />}

          {activeTab === 'economy' && settings && <EconomyTab ctx={ctx} />}

          {activeTab === 'tickets' && settings && <TicketsTab ctx={ctx} />}

          {activeTab === 'appeals' && settings && <AppealsTab ctx={ctx} />}

          {activeTab === 'applications' && settings && <ApplicationsTab ctx={ctx} />}

          {activeTab === 'giveaways' && settings && <GiveawaysTab ctx={ctx} />}

          {activeTab === 'reactionroles' && settings && <ReactionrolesTab ctx={ctx} />}

          {activeTab === 'tempchannels' && settings && <TempchannelsTab ctx={ctx} />}

          {activeTab === 'verification' && settings && <VerificationTab ctx={ctx} />}

          {activeTab === 'starboard' && settings && <StarboardTab ctx={ctx} />}

          {activeTab === 'games' && settings && <GamesTab ctx={ctx} />}

          {activeTab === 'crypto' && settings && <CryptoTab ctx={ctx} />}

          {activeTab === 'socials' && settings && <SocialsTab ctx={ctx} />}

          {activeTab === 'suggestions' && settings && <SuggestionsTab ctx={ctx} />}

          {activeTab === 'autoresponse' && settings && <AutoresponseTab ctx={ctx} />}

          {activeTab === 'feeds' && settings && <FeedsTab ctx={ctx} />}

          {activeTab === 'reminders' && settings && <RemindersTab ctx={ctx} />}

          {activeTab === 'tags' && settings && <TagsTab ctx={ctx} />}

          {activeTab === 'warnings' && settings && <WarningsTab ctx={ctx} />}

          {activeTab === 'backup' && <BackupTab ctx={ctx} />}

          {activeTab === 'help' && <HelpTab ctx={ctx} />}

        </div>
      </main>
    </div>
  );
}
