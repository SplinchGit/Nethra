!macro customInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Nethra LAN Relay"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Nethra LAN Discovery"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Nethra LAN Relay" dir=in action=allow program="$INSTDIR\Nethra.exe" protocol=TCP localport=43111 remoteip=localsubnet profile=any enable=yes'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Nethra LAN Discovery" dir=in action=allow program="$INSTDIR\Nethra.exe" protocol=UDP localport=5353 remoteip=localsubnet profile=any enable=yes'
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Nethra LAN Relay"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Nethra LAN Discovery"'
!macroend
