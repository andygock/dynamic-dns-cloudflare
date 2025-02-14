# Private self-hosted Dynamic DNS (DDNS) update service for Cloudflare

A private self-hosted Dynamic DNS (DDNS) update service that updates records via [Cloudflare](https://www.cloudflare.com/). This Node.js Express server allows users to update their A, AAAA, and TXT DNS records dynamically. Inspired by parts of [DuckDNS](https://www.duckdns.org/)'s protocol.

## Features

- **Supports A, AAAA, and TXT Records** – Works with IPv4 and IPv6.
- **Cloudflare Integration** – Updates records via Cloudflare’s API.
- **No Database Required** – Uses a simple text file for domain authentication.
- **Supports No-Parameter Requests** – Ideal for routers with limited capabilities.

---

## Installation

### Clone Repository

    git clone https://github.com/andygock/dynamic-dns-cloudflare.git
    cd dynamic-dns-cloudflare

### Install Dependencies

    npm install

### Create Environment Variables

Create a `.env.local` file and add your Cloudflare API token:

```txt
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
PORT=3000
```

### Create `domains.txt`

This file stores allowed domains and their respective tokens. Format:

```txt
mydomain.something.cc:client_token
anotherdomain.something.cc:another_client_token
```

Edit manually as needed.

Here are some methods to generate a 256 bit key:

    python -c "import os; print(os.urandom(32).hex())"

### Start the Server, for testing

    node server.js

The server runs on port `3000` by default if env `PORT` is not set.

### Start the Server, for production using `pm2`

    pm2 start index.js --name dynamic-dns

Check for errors with `pm2 logs` and save with `pm2 save`.

### NGINX proxy pass

If you want to use NGINX as a reverse proxy, add the following configuration:

```txt
server {
    listen 80;
    server_name mydomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Usage

Replace `localhost:3000` with your domain, `mydomain.something.cc` and `client_token` with your own values.

### Standard Update Request

Auto-detects IPv4 and updates the record.

    curl "http://localhost:3000/update?domains=mydomain.something.cc&token=client_token"

### Update with Specified IPv4 Address

    curl "http://localhost:3000/update?domains=mydomain.something.cc&token=client_token&ip=203.0.113.42"

### Clear All Records (not supported yet)

    curl "http://localhost:3000/update?domains=mydomain.something.cc&token=client_token&clear=true"

### TXT Record Update (not supported yet)

    curl "http://localhost:3000/update?domains=mydomain.something.cc&token=client_token&txt=myverification"

### No-Parameter Request (For Basic Routers)

    curl "http://localhost:3000/update/mydomain.something.cc/client_token/203.0.113.42"

---

## Setting Up Automatic Updates

### Linux (cron)

Edit your crontab:

    crontab -e

Add a job to update the record every 5 minutes:

    */5 * * * * curl -s "http://localhost:8080/update?domains=mydomain.something.cc&token=client_token" > /dev/null

### macOS (launchd)

1. Create a plist file:

    nano ~/Library/LaunchAgents/com.mydomain.ddns.plist

1. Add:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>Label</key>
        <string>com.mydomain.ddns</string>
        <key>ProgramArguments</key>
        <array>
            <string>/usr/bin/curl</string>
            <string>-s</string>
            <string>"http://localhost:8080/update?domains=mydomain.something.cc&token=client_token"</string>
        </array>
        <key>StartInterval</key>
        <integer>300</integer>
    </dict>
</plist>
```

1. Load the job:

    launchctl load ~/Library/LaunchAgents/com.mydomain.ddns.plist

### Windows with PowerShell script

1. Create a PowerShell script:

```ps1
(iwr "http://localhost:8080/update?domains=mydomain.something.cc&token=client_token").content
```

1. Create a scheduled task to run the script every 5 minutes.
2. Set the action to run the PowerShell script.
3. Set the trigger to run every 5 minutes.
4. Set the user account to run the task.
5. Set the task to run whether the user is logged in or not.

### **Windows (Task Scheduler)**

1. Open **Task Scheduler** → **Create Basic Task**.
2. Choose **Run a program** and set **Program/script** to `C:\Windows\System32\curl.exe`.
3. Set **Arguments** to `"http://localhost:8080/update?domains=mydomain.something.cc&token=client_token"`
4. Configure it to run every 5 minutes.

---

## **Security Considerations**

- Ensure `domains.txt` is not exposed to unauthorized users.
- Use HTTPS to secure communications.
- Keep your Cloudflare API token private.
