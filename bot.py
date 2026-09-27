#!/usr/bin/env python3
"""Vorqul DS BOT - Python launcher.

Finds Node.js and hands over to start.js, which installs dependencies, builds
the bot and dashboard and starts everything. Use it on hosts whose startup
command is `python3 bot.py`; anywhere else `npm start` does the same thing.
"""
import os
import shutil
import signal
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
MIN_NODE_MAJOR = 18


def find_node():
    candidates = [shutil.which("node"), shutil.which("nodejs")]
    candidates += ["/usr/local/bin/node", "/usr/bin/node", os.path.expanduser("~/.nvm/current/bin/node")]
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    return None


def node_major(node):
    try:
        out = subprocess.run([node, "-v"], capture_output=True, text=True, timeout=15).stdout.strip()
        return int(out.lstrip("v").split(".")[0])
    except (OSError, ValueError, subprocess.SubprocessError):
        return 0


def main():
    os.chdir(ROOT)

    node = find_node()
    if not node:
        print("Node.js was not found. Install Node.js %d or newer (https://nodejs.org) or use a Node.js egg." % MIN_NODE_MAJOR)
        return 1

    major = node_major(node)
    if major < MIN_NODE_MAJOR:
        print("Node.js %d+ is required, found %s." % (MIN_NODE_MAJOR, major or "an unknown version"))
        return 1

    if not os.path.isfile(os.path.join(ROOT, "start.js")):
        print("start.js is missing - upload the complete project.")
        return 1

    child = subprocess.Popen([node, "start.js"], cwd=ROOT)

    def forward(signum, _frame):
        if child.poll() is None:
            child.send_signal(signum)

    for name in ("SIGINT", "SIGTERM"):
        if hasattr(signal, name):
            signal.signal(getattr(signal, name), forward)

    return child.wait()


if __name__ == "__main__":
    sys.exit(main())
