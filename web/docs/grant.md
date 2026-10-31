# The Beacon grant

The grant is the one line you run on a VM or server to raise it to Level 1. It installs the probe and the SSH trust together. Everything it installs is standard software: OpenSSH, the OpenTelemetry Collector, and a shell script you can read before running.

## What it installs

In this order:

1. A user `beacon` with a sudoers drop-in `beacon ALL=(ALL) NOPASSWD: ALL`. Ansible's privilege escalation cannot be limited to commands, so the catalogue and the policy gate are what limit what runs.
2. The tenant's SSH certificate authority **public** key and a principals file allowing `beacon`.
3. An sshd drop-in:

```
Match User beacon
  TrustedUserCAKeys /etc/ssh/beacon/ca.pub
  AuthorizedPrincipalsFile /etc/ssh/beacon/principals
  PasswordAuthentication no
  AllowAgentForwarding no
  AllowTcpForwarding no
Match All
```

validated with `sshd -t` before sshd is reloaded.

4. The probe: the OpenTelemetry Collector and its supervisor as a systemd unit, with a one-time enrollment token.
5. It posts the host's public key and the instance identity (VM id on Azure, server UUID on UpCloud, from the instance metadata service) back to Beacon with the grant token. Beacon pins the host key and cross-checks the identity against the provider.

## How Beacon authenticates afterwards

- No private key is ever stored for a cell. For every run Beacon mints an SSH certificate from the tenant's certificate authority: valid for ten minutes, principal `beacon`, locked to the tenant egress address, with agent forwarding, port forwarding and X11 disabled. Its serial number is the run id, so the host's sshd log names the run.
- Revoking is simply not minting. Rotating the authority is re-running the grant.
- A changed host key takes the channel offline with a finding; Beacon never silently re-trusts a host.

## Requirements on the host

- OpenSSH 8.2 or later, for the configuration drop-in.
- Python 3.9 or later, for Ansible.
- systemd.
- Outbound 443 to your tenant hostname.
- Inbound 22 from the tenant egress address, or the reverse tunnel below.

## If you cannot open port 22

Choose **reverse tunnel** on the cell page before copying the grant line. The grant then also installs a small systemd unit that runs the plain OpenSSH client with `ssh -R`, dialing out from the host to the tenant runtime on 443 and holding a reverse tunnel open. Beacon connects to the host through that tunnel. Nothing inbound, nothing Beacon wrote.

## Revoking the grant

On the host: delete the `beacon` user and the sshd drop-in. Or close port 22. Either works without Beacon.
