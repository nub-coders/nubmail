'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  html: string;
  className?: string;
}

const FRAME_DOC = (body: string) => `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<base target="_blank">
<style>
  html,body{margin:0;padding:0;background:transparent;color:#111;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.5;word-wrap:break-word;overflow-wrap:anywhere;overflow-x:auto;}
  body{padding:8px;max-width:100%;}
  *{max-width:100%;box-sizing:border-box;}
  img,video,iframe{max-width:100% !important;height:auto;}
  table{max-width:100% !important;width:auto !important;table-layout:auto;}
  td,th{max-width:100%;word-break:break-word;}
  pre{white-space:pre-wrap;word-break:break-word;}
  a{color:#2563eb;}
  @media (prefers-color-scheme: dark){
    html,body{color:#e5e7eb;}
    a{color:#60a5fa;}
  }
</style>
</head><body>${body}</body></html>`;

export function EmailBodyFrame({ html, className }: Props) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(400);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;

    const onLoad = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc) return;
        const measure = () => {
          const h = Math.max(
            doc.documentElement.scrollHeight,
            doc.body.scrollHeight,
          );
          setHeight(h + 16);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(doc.body);
        doc.querySelectorAll('img').forEach((img) => {
          img.addEventListener('load', measure, { once: true });
          img.addEventListener('error', measure, { once: true });
        });
        (frame as unknown as { __ro?: ResizeObserver }).__ro = ro;
      } catch {
        // cross-origin or sandbox isolation; keep default height
      }
    };

    frame.addEventListener('load', onLoad);
    return () => {
      frame.removeEventListener('load', onLoad);
      const ro = (frame as unknown as { __ro?: ResizeObserver }).__ro;
      if (ro) ro.disconnect();
    };
  }, [html]);

  return (
    <iframe
      ref={ref}
      title="Email body"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={FRAME_DOC(html)}
      className={className}
      style={{
        width: '100%',
        border: 0,
        height,
        background: 'transparent',
        colorScheme: 'normal',
      }}
    />
  );
}
