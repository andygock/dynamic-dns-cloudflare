# Private self-hosted Dynamic DNS (DDNS) update service for Cloudflare

A private self-hosted Dynamic DNS (DDNS) update service that updates records via [Cloudflare](https://www.cloudflare.com/). This Node.js Express server allows users to update their A, AAAA, and TXT DNS records dynamically. Inspired by parts of [DuckDNS](https://www.duckdns.org/)'s protocol.

## Features

- **Supports A, AAAA, and TXT Records** – Works with IPv4 and IPv6.
- **Cloudflare Integration** – Updates records via Cloudflare’s API.
- **No Database Required** – Uses a simple text file for domain authentication.
- **Supports No-Parameter Requests** – Ideal for routers with limited capabilities.

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
    server_name something.cc;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Usage

Replace `something.cc` with your domain, `mydomain.something.cc` and `client_token` with your own values.

### Standard Update Request

Auto-detects IPv4 and updates the record.

    curl "https://something.cc/update?domains=mydomain.something.cc&token=client_token"

### Update with Specified IPv4 Address

    curl "https://something.cc/update?domains=mydomain.something.cc&token=client_token&ip=203.0.113.42"

### Clear All Records (not supported yet)

    curl "https://something.cc/update?domains=mydomain.something.cc&token=client_token&clear=true"

### TXT Record Update (not supported yet)

    curl "https://something.cc/update?domains=mydomain.something.cc&token=client_token&txt=myverification"

### No-Parameter Request (For Basic Routers)

    curl "https://something.cc/update/mydomain.something.cc/client_token"
    curl "https://something.cc/update/mydomain.something.cc/client_token/203.0.113.42"

## Setting Up Automatic Updates

### Windows (Task Scheduler)

Create a new task which runs the command `C:\Windows\System32\curl.exe` with the following arguments:

    https://something.cc/update?domains=mydomain.something.cc&token=client_token

Configure it to run every 5 minutes.

### Linux (cron)

Edit your crontab:

    crontab -e

Add a job to update the record every 5 minutes:

    */5 * * * * curl -s "https://something.cc/update?domains=mydomain.something.cc&token=client_token" > /dev/null

### macOS (launchd)

Create a plist file:

    nano ~/Library/LaunchAgents/cc.something.ddns.plist

Add:

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
            <string>"https://something.cc/update?domains=mydomain.something.cc&token=client_token"</string>
        </array>
        <key>StartInterval</key>
        <integer>300</integer>
    </dict>
</plist>
```

Load the job:

    launchctl load ~/Library/LaunchAgents/cc.something.ddns.plist

### Troubleshooting

If you encounter issues, check the following:

- Ensure the `CLOUDFLARE_API_TOKEN` is set in `.env.local` and is correct.
- Ensure the API token is correct and matches that defined in `domains.txt`.
- Verify that your domains are listed in `domains.txt`.
- Confirm that the server is running and accessible.

## Security Considerations

- Ensure `domains.txt` is not exposed to unauthorized users.
- Use only HTTPS to secure communications.
- Keep your Cloudflare API token private.
