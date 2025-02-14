const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const morgan = require("morgan");
require("@dotenvx/dotenvx").config();

const app = express();
const PORT = process.env.PORT || 3000;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const RECORDS_FILE = path.join(__dirname, "domains.txt");

app.use(morgan("dev"));

const debug = process.env.DEBUG || false;

if (!CLOUDFLARE_API_TOKEN) {
  console.error("Cloudflare API token is missing!");
  process.exit(1);
}

// Load domain-token pairs into memory
const loadRecords = () => {
  const records = {};
  const lines = fs.readFileSync(RECORDS_FILE, "utf-8").split(/\r?\n/);
  lines.forEach((line) => {
    const [domain, token] = line.split(":");
    if (domain && token) {
      records[domain.trim()] = token.trim();
    }
  });
  return records;
};

const records = loadRecords();

// if (debug) console.log("Loaded records:", records);

// Fetch Cloudflare Zone ID
const getZoneId = async (domain) => {
  try {
    const response = await axios.get(
      `https://api.cloudflare.com/client/v4/zones?name=${domain}`,
      {
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.result.length ? response.data.result[0].id : null;
  } catch (e) {
    if (debug) console.error("Error fetching zone ID:", e.message);
    return null;
  }
};

// Fetch DNS Record ID
const getRecordId = async (zoneId, subdomain) => {
  try {
    const response = await axios.get(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${subdomain}`,
      {
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.result.length ? response.data.result[0].id : null;
  } catch (e) {
    if (debug) console.error("Error fetching record ID:", e.message);
    return null;
  }
};

// Update DNS Record on Cloudflare
// https://developers.cloudflare.com/api/resources/dns/subresources/records/methods/export/
const updateDnsRecord = async (zoneId, recordId, type, name, content) => {
  try {
    const payload = {
      type,
      name,
      content,
      ttl: 120,
      proxied: false,
    };
    if (debug) console.log("Updating DNS record with payload:", payload);
    const response = await axios.put(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (debug) console.log("Update response:", response.data);
    return response.data?.success ?? false;
  } catch (e) {
    if (debug) console.error("Error updating DNS record:", e.message);
    return false;
  }
};

// Handle Updates
app.get(["/update", "/update/:domain/:token/:ip?"], async (req, res) => {
  try {
    let { domains, token, ip, ipv6, verbose, clear, txt } = req.query;
    let requestedDomain = req.params.domain || domains;
    let providedToken = req.params.token || token;
    let providedIp = req.params.ip || ip;

    if (!requestedDomain || !providedToken) {
      if (debug) console.log("Missing domain or token");
      return res.send("KO");
    }

    // Handle No-Parameter Format
    if (req.params.domain && req.params.token) {
      domains = requestedDomain;
      token = providedToken;
      ip = providedIp || req.socket.remoteAddress;
    }

    // Validate domain ownership
    const domainList = domains.split(",");
    for (let domain of domainList) {
      if (!records[domain] || records[domain] !== token) {
        if (debug)
          console.log(
            "Domain not found in records or token incorrect:",
            domain
          );
        return res.send("KO");
      }
    }

    // clear is not supported
    if (clear) {
      if (debug) console.log("Clear is not supported");
      return res.send("KO");
    }

    if (!providedIp) {
      providedIp = req.socket.remoteAddress;
      if (debug) console.log("providedIp:", providedIp);
    }

    const results = [];
    const errors = [];
    for (let domain of domainList) {
      // get zone id
      const topDomain = domain.split(".").slice(-2).join(".");
      const zoneId = await getZoneId(topDomain);
      if (!zoneId) {
        errors.push(`Zone ID not found for domain: ${domain}`);
        continue;
      }
      if (debug) console.log(topDomain, "Zone ID:", zoneId);

      if (txt) {
        // TXT Record Handling
        // currently not supported
        errors.push(`TXT Record handling not supported for domain: ${domain}`);
        continue;
      } else {
        // A & AAAA Record Handling

        // get record id
        const recordId = await getRecordId(zoneId, domain);
        if (!recordId) {
          errors.push(`Record ID not found for domain: ${domain}`);
          continue;
        }
        if (debug) console.log(domain, "Record ID:", recordId);

        let result = false;
        if (ipv6) {
          result = await updateDnsRecord(
            zoneId,
            recordId,
            "AAAA",
            domain,
            ipv6
          );
        } else {
          result = await updateDnsRecord(
            zoneId,
            recordId,
            "A",
            domain,
            providedIp
          );
        }
        if (result === false) {
          errors.push(`Error updating DNS record for domain: ${domain}`);
          continue;
        }

        results.push(`OK\n${providedIp}\n${ipv6 || ""}\nUPDATED`);
      }
    } // end domainList

    // report errors
    if (errors.length > 0) {
      if (debug) console.log("Errors:", errors);
    }

    if (results.length > 0) {
      // return OK even when there were some errors
      if (debug) console.log("Results:", results);
      return res.send("OK");
    } else {
      return res.send("KO");
    }
  } catch (error) {
    if (debug) console.error("Unspected error:", error.message);
    return res.send("KO");
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
