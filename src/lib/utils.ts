import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Names that reference another host (CNAME/MX/NS targets) must be fully
// qualified with a trailing dot, otherwise a strict BIND parser treats them
// as relative to $ORIGIN (e.g. "mails.nubcoders.com" -> "mails.nubcoders.com.nubcoders.com").
function ensureTrailingDot(value: string): string {
  return value.endsWith('.') ? value : `${value}.`;
}

export function downloadBindFile(domainName: string, records: any[]) {
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];

  // Mirror the Cloudflare BIND export format: full RFC 1035 header, SOA + NS
  // placeholders the operator must edit, per-record TTLs, and grouped records.
  let content = `;;
;; Domain:     ${domainName}.
;; Exported:   ${now}
;;
;; This file is intended for use for informational and archival
;; purposes ONLY and MUST be edited before use on a production
;; DNS server.  In particular, you must:
;;   -- update the SOA record with the correct authoritative name server
;;   -- update the SOA record with the contact e-mail address information
;;   -- update the NS record(s) with the authoritative name servers for this domain.
;;
;; For further information, please consult the BIND documentation
;; located on the following website:
;;
;; http://www.isc.org/
;;
;; And RFC 1035:
;;
;; http://www.ietf.org/rfc/rfc1035.txt
;;
;; Please note that we do NOT offer technical support for any use
;; of this zone data, the BIND name server, or any other third-party
;; DNS software.
;;
;; Use at your own risk.
;; SOA Record
${domainName}.	3600	IN	SOA	ns1.${domainName}. hostmaster.${domainName}. 1 10000 2400 604800 3600

;; NS Records
${domainName}.	86400	IN	NS	ns1.${domainName}.
${domainName}.	86400	IN	NS	ns2.${domainName}.
`;

  const grouped: Record<string, any[]> = {};
  records.forEach(r => {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  });

  const typesOrder = ['A', 'CNAME', 'MX', 'TXT'];

  for (const type of typesOrder) {
    if (grouped[type] && grouped[type].length > 0) {
      content += `\n;; ${type} Records\n`;
      grouped[type].forEach(r => {
        let host = r.host;
        if (host === '@') {
          host = `${domainName}.`;
        } else if (!host.endsWith('.')) {
          host += '.';
        }

        let value = r.expectedValue;
        if (type === 'TXT' && !value.startsWith('"')) {
          value = `"${value}"`;
        } else if (type === 'CNAME') {
          // CNAME targets are hostnames and must be fully qualified.
          value = ensureTrailingDot(value);
        }

        let priority = '';
        if (type === 'MX' && typeof r.priority === 'number') {
          // MX RDATA is "<priority> <exchange>", and the exchange is a
          // hostname that must end with a trailing dot. Strip any priority the
          // source value already carries so it isn't duplicated.
          const exchange = value.replace(new RegExp(`^${r.priority}\\s+`), '');
          priority = `${r.priority} `;
          value = ensureTrailingDot(exchange);
        }

        content += `${host}\t1\tIN\t${r.type}\t${priority}${value}\n`;
      });
    }
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${domainName}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
