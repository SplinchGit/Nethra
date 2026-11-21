#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
    echo "Run this setup as root from the VirtualBox console." >&2
    exit 1
fi
if ! command -v nft >/dev/null 2>&1; then
    echo "Install Debian's official nftables package during the minimal OS setup, before applying offline egress rules." >&2
    exit 1
fi
if ! command -v systemd-run >/dev/null 2>&1 || ! command -v systemctl >/dev/null 2>&1; then
    echo "This runtime requires Debian's systemd service manager and systemd-run." >&2
    exit 1
fi
getent group nethra >/dev/null 2>&1 || groupadd --system nethra
if ! getent passwd nethra >/dev/null 2>&1; then
    useradd --create-home --gid nethra --shell /bin/bash nethra
fi
getent group nethra-code >/dev/null 2>&1 || groupadd --system nethra-code
getent passwd nethra-code >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin nethra-code
usermod --append --groups nethra-code nethra
getent passwd nethra-research >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin nethra-research
if ! command -v python3 >/dev/null 2>&1; then
    echo "Install Debian's official python3 package before applying guest isolation." >&2
    exit 1
fi
install -d -m 0700 -o nethra -g nethra \
    /home/nethra/nethra \
    /home/nethra/nethra/identity \
    /home/nethra/nethra/memory \
    /home/nethra/nethra/goals \
    /home/nethra/nethra/projects \
    /home/nethra/nethra/journal \
    /home/nethra/nethra/diary \
    /home/nethra/nethra/self \
    /home/nethra/nethra/self/tools \
    /home/nethra/nethra/self/prompts \
    /home/nethra/nethra/self/.history \
    /home/nethra/nethra/logs \
    /home/nethra/nethra/state
chown nethra:nethra-code /home/nethra /home/nethra/nethra
chmod 0710 /home/nethra /home/nethra/nethra
chown nethra:nethra-code /home/nethra/nethra/projects
chmod 2770 /home/nethra/nethra/projects
chown -R nethra:nethra-code /home/nethra/nethra/self
chmod 2770 /home/nethra/nethra/self /home/nethra/nethra/self/tools /home/nethra/nethra/self/prompts
chmod 0700 /home/nethra/nethra/self/.history
if [ ! -e /home/nethra/nethra/self/identity.md ]; then
cat > /home/nethra/nethra/self/identity.md <<'EOF'
# Nethra self-description

I am Nethra, running in the persistent Debian VM workspace. The model is a host-brokered inference service. My workspace, shared conversation, diary, projects and scheduler persist across runtime restarts and VM reboots. The Nethra-owned `self/` area is editable; `/usr/lib/nethra-world`, systemd policy, networking and host broker are supervisor-controlled.
EOF
chown nethra:nethra-code /home/nethra/nethra/self/identity.md
chmod 0660 /home/nethra/nethra/self/identity.md
fi
install -d -m 0755 -o root -g root /home/nethra/nethra/projects/.nethra-run
NETHRA_RESEARCH_UID=$(id -u nethra-research)
install -d -m 0700 -o root -g root /etc/nethra-world /var/lib/nethra-world
install -d -m 0750 -o root -g nethra /run/nethra-world
sed "s/@RESEARCH_UID@/${NETHRA_RESEARCH_UID}/g" "$(dirname "$0")/nethra-world.nft" > /etc/nethra-world/firewall.nft
chown root:root /etc/nethra-world/firewall.nft
chmod 0644 /etc/nethra-world/firewall.nft
install -d -m 0755 -o root -g root /usr/lib/nethra-world /usr/local/bin /usr/share/applications
install -m 0755 -o root -g root "$(dirname "$0")/world-service.py" /usr/lib/nethra-world/world-service.py
install -m 0644 -o root -g root "$(dirname "$0")/viewer_history.py" /usr/lib/nethra-world/viewer_history.py
install -m 0644 -o root -g root "$(dirname "$0")/viewer_http.py" /usr/lib/nethra-world/viewer_http.py
install -m 0755 -o root -g root "$(dirname "$0")/research-broker.py" /usr/lib/nethra-world/research-broker.py
install -m 0755 -o root -g root "$(dirname "$0")/agent.py" /usr/lib/nethra-world/agent.py
install -m 0644 -o root -g root "$(dirname "$0")/persistent_runtime.py" /usr/lib/nethra-world/persistent_runtime.py
install -d -m 0755 -o root -g root /usr/lib/nethra-world/viewer
install -m 0644 -o root -g root "$(dirname "$0")/viewer/index.html" /usr/lib/nethra-world/viewer/index.html
install -m 0644 -o root -g root "$(dirname "$0")/viewer/viewer.css" /usr/lib/nethra-world/viewer/viewer.css
install -m 0644 -o root -g root "$(dirname "$0")/viewer/viewer.js" /usr/lib/nethra-world/viewer/viewer.js
install -m 0755 -o root -g root "$(dirname "$0")/open-viewer.sh" /usr/local/bin/nethra-world-viewer
install -m 0755 -o root -g root "$(dirname "$0")/nethra-cli.py" /usr/local/bin/nethra
install -m 0755 -o root -g root "$(dirname "$0")/native-chat.py" /usr/lib/nethra-world/native-chat.py
install -m 0755 -o root -g root "$(dirname "$0")/open-native-chat.sh" /usr/local/bin/nethra-chat
install -m 0644 -o root -g root "$(dirname "$0")/nethra-chat.desktop" /usr/share/applications/nethra-chat.desktop
install -m 0644 -o root -g root "$(dirname "$0")/nethra-world-viewer.desktop" /usr/share/applications/nethra-world-viewer.desktop
install -m 0644 -o root -g root "$(dirname "$0")/nethra-world.service" /etc/systemd/system/nethra-world.service
install -m 0644 -o root -g root "$(dirname "$0")/nethra-world-heartbeat.service" /etc/systemd/system/nethra-world-heartbeat.service
install -m 0644 -o root -g root "$(dirname "$0")/nethra-world-tmpfiles.conf" /etc/tmpfiles.d/nethra-world.conf
install -d -m 0755 -o root -g root /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/nethra-world.conf <<'EOF'
[Journal]
SystemMaxUse=32M
RuntimeMaxUse=16M
EOF
cat > /etc/nftables.conf <<'EOF'
include "/etc/nethra-world/firewall.nft"
EOF
chmod 0644 /etc/nftables.conf
systemctl daemon-reload
systemd-tmpfiles --create /etc/tmpfiles.d/nethra-world.conf
systemctl restart systemd-journald.service
systemctl enable nftables.service nethra-world.service
systemctl restart nftables.service
nft list ruleset
printf '\nNethra World services and deny-by-default firewall are installed. The agent remains host-paused.\n'
