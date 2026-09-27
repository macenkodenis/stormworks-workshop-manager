import React, { useState, useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';

/**
 * Interactive spoiler component that mimics Steam Workshop spoiler blocks.
 * Clicking reveals/hides the hidden text, and hover dims the mask.
 */
function SpoilerBlock({ children }) {
  const { t } = useI18n();
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      onClick={() => setRevealed(prev => !prev)}
      title={t('bbcode.spoilerTooltip')}
      className={`inline-block px-1.5 py-0.5 rounded transition-all cursor-pointer select-none text-xs ${
        revealed
          ? 'bg-[#1b2838] text-[#c7d5e0] border border-[#2a475e]'
          : 'bg-[#233547] text-transparent hover:text-[#c7d5e0] hover:bg-[#1b2838]'
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Safe external link component with protocol validation.
 */
function SafeLink({ href, children }) {
  const safeHref = (href || '').trim();
  const isSafe = /^https?:\/\//i.test(safeHref) || /^steam:\/\//i.test(safeHref);

  if (!isSafe) {
    return <span className="text-[#66c0f4]">{children}</span>;
  }

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#66c0f4] hover:underline hover:text-[#8bd3fb] transition-colors break-all"
    >
      {children}
    </a>
  );
}

/**
 * Helper to recursively extract plain text from nodes (used for [url] and [img])
 */
function extractText(nodes) {
  if (!nodes || !Array.isArray(nodes)) return '';
  return nodes.map(n => {
    if (n.type === 'text') return n.content;
    if (n.children) return extractText(n.children);
    return '';
  }).join('');
}

/**
 * Helper to render text chunks while autolinking bare URLs
 */
function renderTextWithLinks(text, keyPrefix) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, pIdx) => {
    if (part.match(urlRegex)) {
      return (
        <SafeLink key={`${keyPrefix}-url-${pIdx}`} href={part}>
          {part}
        </SafeLink>
      );
    }
    return part;
  });
}

/**
 * Tokenizer & parser that builds a resilient AST from Steam Workshop BBCode.
 */
function parseBBCode(text) {
  if (!text || typeof text !== 'string') return [];

  // Normalize Windows line endings and self-closing tags
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\[hr\]\[\/hr\]/gi, '[hr]');

  const root = { type: 'root', children: [] };
  const stack = [root];
  let lastIndex = 0;

  // Regex matching [tag], [/tag], [tag=value], [*], [hr]
  const tagRegex = /\[(\/)?([a-z1-6\*]+)(?:=([^\]]+))?\]/gi;
  let match;

  while ((match = tagRegex.exec(normalized)) !== null) {
    const [fullTag, isClosing, rawTagName, attr] = match;
    const tagName = rawTagName.toLowerCase();
    const tagIndex = match.index;

    // Push text before this tag
    if (tagIndex > lastIndex) {
      const textChunk = normalized.slice(lastIndex, tagIndex);
      stack[stack.length - 1].children.push({ type: 'text', content: textChunk });
    }
    lastIndex = tagRegex.lastIndex;

    // Self-closing hr
    if (tagName === 'hr') {
      stack[stack.length - 1].children.push({ type: 'hr' });
      continue;
    }

    if (isClosing) {
      // Find matching tag upwards in stack
      let foundIdx = -1;
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tagName) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx !== -1) {
        stack.length = foundIdx;
      } else {
        stack[stack.length - 1].children.push({ type: 'text', content: fullTag });
      }
    } else {
      // List item tag [*] is self-closing/delimiter inside lists
      if (tagName === '*') {
        stack[stack.length - 1].children.push({ type: 'tag', tag: '*', children: [] });
        continue;
      }

      const newNode = {
        type: 'tag',
        tag: tagName,
        attr: attr ? attr.trim() : null,
        children: []
      };
      stack[stack.length - 1].children.push(newNode);

      const containerTags = new Set([
        'b', 'i', 'u', 'strike', 'h1', 'h2', 'h3',
        'url', 'img', 'quote', 'code', 'spoiler', 'list', 'olist',
        'table', 'tr', 'th', 'td', 'noparse'
      ]);

      if (containerTags.has(tagName)) {
        stack.push(newNode);
      }
    }
  }

  // Trailing text
  if (lastIndex < normalized.length) {
    stack[stack.length - 1].children.push({
      type: 'text',
      content: normalized.slice(lastIndex)
    });
  }

  return root.children;
}

/**
 * Renders list items from children of [list] or [olist]
 */
function renderListItems(children, renderNodeList, t) {
  const items = [];
  let current = [];
  let hasItemTag = false;

  for (const child of children) {
    if (child.type === 'tag' && child.tag === '*') {
      hasItemTag = true;
      if (current.length > 0) {
        items.push(current);
        current = [];
      }
    } else {
      current.push(child);
    }
  }
  if (current.length > 0) {
    items.push(current);
  }

  if (!hasItemTag) {
    return <li className="leading-relaxed pl-1">{renderNodeList(children, 'li-fallback', t)}</li>;
  }

  return items.map((itemNodes, idx) => (
    <li key={`li-${idx}`} className="leading-relaxed pl-1">
      {renderNodeList(itemNodes, `li-${idx}`, t)}
    </li>
  ));
}

/**
 * Recursive renderer for AST nodes
 */
function renderNodes(nodes, keyPrefix = 'node', t = null) {
  if (!nodes || !Array.isArray(nodes)) return null;

  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    if (node.type === 'text') {
      const lines = node.content.split('\n');
      return (
        <React.Fragment key={key}>
          {lines.map((line, lIdx) => (
            <React.Fragment key={`${key}-l-${lIdx}`}>
              {renderTextWithLinks(line, `${key}-l-${lIdx}`)}
              {lIdx < lines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </React.Fragment>
      );
    }

    if (node.type === 'hr') {
      return <hr key={key} className="border-t border-[#233547] my-3.5" />;
    }

    if (node.type === 'tag') {
      const children = renderNodes(node.children, key, t);

      switch (node.tag) {
        case 'b':
          return <strong key={key} className="font-bold text-white">{children}</strong>;
        case 'i':
          return <em key={key} className="italic text-gray-300">{children}</em>;
        case 'u':
          return <span key={key} className="underline decoration-[#66c0f4]/50">{children}</span>;
        case 'strike':
          return <span key={key} className="line-through text-gray-400">{children}</span>;

        case 'h1':
          return (
            <h1 key={key} className="text-sm md:text-base font-bold text-white border-b border-[#233547] pb-1 mt-4 mb-2 first:mt-0 tracking-wide">
              {children}
            </h1>
          );
        case 'h2':
          return (
            <h2 key={key} className="text-xs md:text-sm font-bold text-[#66c0f4] mt-3 mb-1.5 first:mt-0">
              {children}
            </h2>
          );
        case 'h3':
          return (
            <h3 key={key} className="text-xs font-semibold text-gray-200 mt-2.5 mb-1 first:mt-0">
              {children}
            </h3>
          );

        case 'url': {
          const href = node.attr || extractText(node.children);
          return <SafeLink key={key} href={href}>{children || href}</SafeLink>;
        }

        case 'img': {
          const src = (extractText(node.children) || node.attr || '').trim();
          if (!/^https?:\/\//i.test(src)) return null;
          return (
            <img
              key={key}
              src={src}
              alt="Steam Workshop Image"
              loading="lazy"
              className="max-w-full rounded border border-[#233547] my-2 object-contain max-h-96"
            />
          );
        }

        case 'quote':
          return (
            <blockquote
              key={key}
              className="my-2 p-3 bg-[#101822] border-l-4 border-[#66c0f4] rounded text-xs text-gray-300 italic space-y-1"
            >
              {node.attr && (
                <div className="not-italic font-semibold text-[#66c0f4] text-[11px] mb-1">
                  {t ? t('bbcode.quote', { author: node.attr }) : `Quote ${node.attr}:`}
                </div>
              )}
              <div>{children}</div>
            </blockquote>
          );

        case 'code':
          return (
            <pre
              key={key}
              className="p-2.5 bg-[#090d13] border border-[#1b2838] rounded font-mono text-[11.5px] text-[#86a5b8] overflow-x-auto my-2 whitespace-pre"
            >
              {children}
            </pre>
          );

        case 'spoiler':
          return <SpoilerBlock key={key}>{children}</SpoilerBlock>;

        case 'list':
          return (
            <ul key={key} className="list-disc list-inside my-2 space-y-1 text-xs text-[#b8c6d1]">
              {renderListItems(node.children, renderNodes, t)}
            </ul>
          );

        case 'olist':
          return (
            <ol key={key} className="list-decimal list-inside my-2 space-y-1 text-xs text-[#b8c6d1]">
              {renderListItems(node.children, renderNodes, t)}
            </ol>
          );

        case 'table':
          return (
            <div key={key} className="my-2 overflow-x-auto">
              <table className="border-collapse border border-[#233547] text-xs text-[#b8c6d1] w-full">
                {children}
              </table>
            </div>
          );
        case 'tr':
          return <tr key={key} className="border-b border-[#233547]">{children}</tr>;
        case 'th':
          return (
            <th key={key} className="border border-[#233547] p-1.5 bg-[#141d27] font-semibold text-white text-left">
              {children}
            </th>
          );
        case 'td':
          return (
            <td key={key} className="border border-[#233547] p-1.5 bg-[#0e1620]">
              {children}
            </td>
          );

        case 'noparse':
          return <span key={key}>{extractText(node.children)}</span>;

        default:
          return <React.Fragment key={key}>{children}</React.Fragment>;
      }
    }

    return null;
  });
}

/**
 * Main Steam BBCode component
 */
export default function SteamBBCode({ content }) {
  const { t } = useI18n();
  const ast = useMemo(() => {
    if (!content || typeof content !== 'string') return null;
    return parseBBCode(content);
  }, [content]);

  if (!content) {
    return <span className="text-[#8f98a0] italic">{t('bbcode.noDescription')}</span>;
  }

  return (
    <div className="steam-bbcode leading-relaxed space-y-1 break-words select-text">
      {renderNodes(ast, 'node', t)}
    </div>
  );
}
