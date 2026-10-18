'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ChatMarkdown.module.css';

interface ChatMarkdownProps {
  content: string;
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className={styles.markdownBody}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className={styles.paragraph}>{children}</p>,
          ul: ({ children }) => <ul className={styles.unorderedList}>{children}</ul>,
          ol: ({ children }) => <ol className={styles.orderedList}>{children}</ol>,
          li: ({ children }) => <li className={styles.listItem}>{children}</li>,
          strong: ({ children }) => <strong className={styles.bold}>{children}</strong>,
          em: ({ children }) => <em className={styles.italic}>{children}</em>,
          h1: ({ children }) => <h3 className={styles.heading}>{children}</h3>,
          h2: ({ children }) => <h4 className={styles.heading}>{children}</h4>,
          h3: ({ children }) => <h4 className={styles.heading}>{children}</h4>,
          blockquote: ({ children }) => <blockquote className={styles.blockquote}>{children}</blockquote>,
          code: ({ className, children, ...props }) => {
            const isInline = !className && typeof children === 'string' && !children.includes('\n');
            if (isInline) {
              return (
                <code className={styles.inlineCode} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className={styles.codeBlock}>
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
