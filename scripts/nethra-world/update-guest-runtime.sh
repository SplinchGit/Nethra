#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
    echo "Run this update as root from the Debian console." >&2
    exit 1
fi
SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
(cd "$SOURCE_DIR" && sha256sum -c SHA256SUMS)
if ! command -v systemctl >/dev/null 2>&1 || [ ! -x /usr/bin/python3 ]; then
    echo "The Debian Nethra World runtime is unavailable." >&2
    exit 1
fi
if [ ! -f /etc/systemd/system/nethra-world.service ]; then
    echo "The existing Nethra World supervisor was not found." >&2
    exit 1
fi

FILES="agent.py
persistent_runtime.py
world-service.py
viewer_history.py
viewer_http.py
research-broker.py
open-viewer.sh
nethra-cli.py
native-chat.py
open-native-chat.sh
nethra-chat.desktop
nethra-world-viewer.desktop
nethra-world.service
nethra-world-heartbeat.service
nethra-world-tmpfiles.conf
viewer/index.html
viewer/viewer.css
viewer/viewer.js"
for file in $FILES; do
    if [ ! -f "$SOURCE_DIR/$file" ]; then
        echo "Required runtime update file is missing: $file" >&2
        exit 1
    fi
done

backup_dir=$(mktemp -d /var/backups/nethra-world-runtime.XXXXXX)
chmod 0700 "$backup_dir"
TARGETS="/usr/lib/nethra-world/agent.py
/usr/lib/nethra-world/persistent_runtime.py
/usr/lib/nethra-world/world-service.py
/usr/lib/nethra-world/viewer_history.py
/usr/lib/nethra-world/viewer_http.py
/usr/lib/nethra-world/research-broker.py
/usr/lib/nethra-world/viewer/index.html
/usr/lib/nethra-world/viewer/viewer.css
/usr/lib/nethra-world/viewer/viewer.js
/usr/local/bin/nethra-world-viewer
/usr/local/bin/nethra
/usr/local/bin/nethra-chat
/usr/lib/nethra-world/native-chat.py
/usr/share/applications/nethra-chat.desktop
/usr/share/applications/nethra-world-viewer.desktop
/etc/systemd/system/nethra-world.service
/etc/systemd/system/nethra-world-heartbeat.service
/etc/tmpfiles.d/nethra-world.conf"
while IFS= read -r target; do
    relative=${target#/}
    if [ -e "$target" ]; then
        install -d -m 0700 "$backup_dir/$(dirname "$relative")"
        cp -p "$target" "$backup_dir/$relative"
    fi
done <<EOF
$TARGETS
EOF

rollback() {
    result=$?
    [ "$result" -eq 0 ] && return
    trap - EXIT
    echo "Runtime update failed; restoring the previous protected files." >&2
    systemctl stop nethra-world-heartbeat.service >/dev/null 2>&1 || true
    while IFS= read -r target; do
        relative=${target#/}
        if [ -e "$backup_dir/$relative" ]; then
            install -D -m "$(stat -c '%a' "$backup_dir/$relative")" -o root -g root "$backup_dir/$relative" "$target" || true
        else
            rm -f -- "$target"
        fi
    done <<EOF
$TARGETS
EOF
    systemctl daemon-reload || true
    systemd-tmpfiles --create /etc/tmpfiles.d/nethra-world.conf || true
    systemctl restart nethra-world.service || true
    exit "$result"
}
trap rollback EXIT

systemctl stop nethra-world-heartbeat.service
install -d -m 0755 -o root -g root /usr/lib/nethra-world /usr/lib/nethra-world/viewer /usr/local/bin /usr/share/applications /etc/tmpfiles.d
for file in agent.py persistent_runtime.py world-service.py research-broker.py; do
    install -m 0755 -o root -g root "$SOURCE_DIR/$file" "/usr/lib/nethra-world/$file"
done
for file in viewer_history.py viewer_http.py; do
    install -m 0644 -o root -g root "$SOURCE_DIR/$file" "/usr/lib/nethra-world/$file"
done
for file in viewer/index.html viewer/viewer.css viewer/viewer.js; do
    install -m 0644 -o root -g root "$SOURCE_DIR/$file" "/usr/lib/nethra-world/$file"
done
install -m 0755 -o root -g root "$SOURCE_DIR/open-viewer.sh" /usr/local/bin/nethra-world-viewer
install -m 0755 -o root -g root "$SOURCE_DIR/nethra-cli.py" /usr/local/bin/nethra
install -m 0755 -o root -g root "$SOURCE_DIR/native-chat.py" /usr/lib/nethra-world/native-chat.py
install -m 0755 -o root -g root "$SOURCE_DIR/open-native-chat.sh" /usr/local/bin/nethra-chat
install -m 0644 -o root -g root "$SOURCE_DIR/nethra-chat.desktop" /usr/share/applications/nethra-chat.desktop
install -m 0644 -o root -g root "$SOURCE_DIR/nethra-world-viewer.desktop" /usr/share/applications/nethra-world-viewer.desktop
install -m 0644 -o root -g root "$SOURCE_DIR/nethra-world.service" /etc/systemd/system/nethra-world.service
install -m 0644 -o root -g root "$SOURCE_DIR/nethra-world-heartbeat.service" /etc/systemd/system/nethra-world-heartbeat.service
install -m 0644 -o root -g root "$SOURCE_DIR/nethra-world-tmpfiles.conf" /etc/tmpfiles.d/nethra-world.conf

install -d -m 0700 -o nethra -g nethra /home/nethra/nethra/state /home/nethra/nethra/memory /home/nethra/nethra/diary /home/nethra/nethra/self /home/nethra/nethra/self/tools /home/nethra/nethra/self/prompts /home/nethra/nethra/self/.history
chown -R nethra:nethra-code /home/nethra/nethra/self
chown nethra:nethra-code /home/nethra/nethra/self
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
if [ ! -e /var/lib/nethra-world/viewer-history.json ]; then
    printf '[]\n' > /var/lib/nethra-world/viewer-history.json
    chmod 0600 /var/lib/nethra-world/viewer-history.json
fi

systemctl daemon-reload
systemd-tmpfiles --create /etc/tmpfiles.d/nethra-world.conf
systemctl restart nethra-world.service
healthy=false
attempt=0
while [ "$attempt" -lt 30 ]; do
    if systemctl is-active --quiet nethra-world.service && systemctl is-active --quiet nethra-world-heartbeat.service && /usr/bin/python3 -c 'import json, urllib.request; r=urllib.request.urlopen("http://127.0.0.1:43131/v1/ui/snapshot", timeout=2); d=json.load(r); assert r.status == 200 and isinstance(d.get("events"), list) and isinstance(d.get("paused"), bool) and "status" in d' && systemctl is-active --quiet nethra-world.service; then
        healthy=true
        break
    fi
    attempt=$((attempt + 1))
    sleep 1
done
if [ "$healthy" != true ]; then
    echo "The Nethra runtime did not become healthy." >&2
    exit 1
fi
trap - EXIT
rm -rf -- "$backup_dir"
echo "Persistent Nethra runtime installed. Supervisor and persistent agent are active; host control still determines whether Nethra is paused. Run nethra chat from a Debian terminal."
