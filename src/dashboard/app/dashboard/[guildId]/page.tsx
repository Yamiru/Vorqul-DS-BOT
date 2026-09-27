'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';

export default function GuildDashboard() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const guildId = params.guildId as string;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/');
      return;
    }
    if (status === 'authenticated' && guildId) {
      router.replace(`/dashboard/${guildId}/settings`);
    }
  }, [status, guildId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-discord-darker">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-discord-blurple"></div>
    </div>
  );
}
