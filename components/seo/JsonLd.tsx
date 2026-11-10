import React from 'react';

interface JsonLdProps {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}

/**
 * Safely renders JSON-LD structured data.
 * Escapes angle brackets to prevent script breakout attacks.
 */
export function JsonLd({ data }: JsonLdProps) {
  const sanitizedJson = JSON.stringify(data).replace(/</g, '\\u003c');

  return (
    <script
      id="json-ld-schema"
      key="json-ld-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: sanitizedJson }}
    />
  );
}

export default JsonLd;
