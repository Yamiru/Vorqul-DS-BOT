# Security Policy

[vorqul.com](https://vorqul.com) · https://github.com/Yamiru/Vorqul-DS-BOT

## Reporting a vulnerability

Found a security issue? Token leaks, permission bypasses, injection, auth
problems on the dashboard, or anything else that could hurt a server running
this bot. Please don't open a public issue for it.

Instead, report it privately through [yamiru.com](https://yamiru.com), or open
a GitHub security advisory on the repository. Give me a reasonable window to
fix it before any public disclosure.

When you report, include:
- a description of the issue and where it is,
- steps to reproduce (a proof of concept if you have one),
- the potential impact as you see it.

I'll confirm I received it, keep you posted while it's being fixed, and credit
you once a fix is out, unless you'd rather stay anonymous.

## Things to check on your own deployment

A lot of "security issues" are really misconfigurations. Before reporting, make
sure:

- your `.env` is **not** committed or world-readable (it's git-ignored for a reason),
- you rotated `DISCORD_TOKEN` and `DISCORD_CLIENT_SECRET` if they ever leaked,
- `NEXTAUTH_SECRET` is a real random value, not the placeholder,
- `ALLOWED_EMAILS` or `ALLOWED_IDS` is set if your dashboard is reachable from the internet,
- `NEXTAUTH_URL` matches the actual protocol (http vs https) the dashboard is
 served over. A mismatch makes the browser silently drop the login cookie,
 which looks like a login bug. Don't fix it by weakening cookie security.

## Supported versions

Security fixes land on the latest release. Older versions are not patched.
