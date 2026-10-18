// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatMarkdown } from '../ChatMarkdown';

describe('ChatMarkdown Component', () => {
  it('renders paragraphs and bold markdown correctly', () => {
    render(<ChatMarkdown content="Hello **Cohort Architect**! Ready to build." />);
    expect(screen.getByText('Cohort Architect').tagName).toBe('STRONG');
    expect(screen.getByText(/Ready to build/).tagName).toBe('P');
  });

  it('renders unordered lists with bullet items', () => {
    const markdown = `- Module 1: Foundations\n- Module 2: Consensus\n- Module 3: Raft`;
    render(<ChatMarkdown content={markdown} />);
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(3);
    expect(listItems[0].textContent).toBe('Module 1: Foundations');
  });

  it('renders inline code and preformatted code blocks', () => {
    const markdown = "Use `add_lesson` tool:\n```ts\nadd_lesson({ title: 'Raft' });\n```";
    render(<ChatMarkdown content={markdown} />);
    expect(screen.getByText('add_lesson').tagName).toBe('CODE');
    expect(screen.getByText(/add_lesson\({ title: 'Raft' }\);/)).toBeTruthy();
  });

  it('renders blockquotes and headings safely', () => {
    const markdown = "### Curriculum Goals\n> Focus on distributed consensus";
    render(<ChatMarkdown content={markdown} />);
    expect(screen.getByText('Curriculum Goals').tagName).toBe('H4');
    expect(screen.getByText(/Focus on distributed consensus/).closest('blockquote')).toBeTruthy();
  });
});
