import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function downloadBindFile(domainName: string, records: any[]) {
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];
  
  let content = `;;
;; Domain:     ${domainName}.
;; Exported:   ${now}
;;
;; This file is intended for use for informational and archival
;; purposes ONLY and MUST be edited before use on a production
;; DNS server.
;;
;; Use at your own risk.
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
        if (host !== '@' && !host.endsWith('.')) {
          host += '.';
        } else if (host === '@') {
          host = `${domainName}.`;
        }

        let value = r.expectedValue;
        if (type === 'TXT' && !value.startsWith('"')) {
          value = `"${value}"`;
        }
        
        let priority = '';
        if (type === 'MX' && typeof r.priority === 'number') {
          if (!value.startsWith(r.priority.toString())) {
            priority = `${r.priority} `;
          }
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
