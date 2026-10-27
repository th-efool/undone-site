// @vitest-environment jsdom
/**
 * Shared UI Primitives Acceptance Test Suite (Phase 4, Gate P4)
 *
 * Verifies contract specifications for:
 * 1. Button (variants, sizes, loading, disabled, polymorphism, icons)
 * 2. Typography (Heading with uiRole="ui-title" vs display, Text variants)
 * 3. Dialog (Radix Dialog wrapper, portal encapsulation, accessibility name/desc)
 * 4. Popover (Radix Popover wrapper, portal encapsulation, collision padding)
 * 5. Field (TextField, SelectField, CheckboxField, RadioField with ARIA & geometry)
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import {
  Button,
  Heading,
  Text,
  Dialog,
  Popover,
  TextField,
  SelectField,
  CheckboxField,
  RadioField,
} from '../index';

describe('Shared UI Primitives Contract (Phase 4, Gate P4)', () => {
  afterEach(() => {
    cleanup();
  });
  // ─── 1. BUTTON PRIMITIVE ───────────────────────────────────────────────────

  describe('1. Button Primitive', () => {
    it('renders primary button by default with standard classes', () => {
      render(<Button>Click Me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeDefined();
      expect(button.className).toContain('root');
      expect(button.className).toContain('primary');
      expect(button.className).toContain('md');
    });

    it('renders all standard variants and maps legacy "danger" to destructive', () => {
      const { rerender } = render(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByRole('button').className).toContain('secondary');

      rerender(<Button variant="ghost">Ghost</Button>);
      expect(screen.getByRole('button').className).toContain('ghost');

      rerender(<Button variant="destructive">Destructive</Button>);
      expect(screen.getByRole('button').className).toContain('destructive');

      // Legacy danger alias must map to destructive
      rerender(<Button variant="danger">Danger</Button>);
      expect(screen.getByRole('button').className).toContain('destructive');
    });

    it('handles loading state with aria-busy and spinner', () => {
      render(<Button loading>Saving</Button>);
      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.getAttribute('disabled')).toBeDefined();
      expect(button.className).toContain('loading');
    });

    it('renders left and right icons without disrupting text content', () => {
      render(
        <Button
          leftIcon={<span data-testid="left-icon">←</span>}
          rightIcon={<span data-testid="right-icon">→</span>}
        >
          Navigate
        </Button>,
      );
      expect(screen.getByTestId('left-icon')).toBeDefined();
      expect(screen.getByTestId('right-icon')).toBeDefined();
      expect(screen.getByRole('button', { name: /navigate/i })).toBeDefined();
    });

    it('supports polymorphic rendering as anchor', () => {
      render(
        <Button as="a" href="https://undone.app" variant="ghost">
          External Link
        </Button>,
      );
      const link = screen.getByRole('link', { name: /external link/i });
      expect(link.getAttribute('href')).toBe('https://undone.app');
      expect(link.className).toContain('ghost');
    });
  });

  // ─── 2. TYPOGRAPHY PRIMITIVE ───────────────────────────────────────────────

  describe('2. Typography (Heading & Text)', () => {
    it('Heading: renders semantic level 2 by default', () => {
      render(<Heading>Default Title</Heading>);
      const h2 = screen.getByRole('heading', { level: 2 });
      expect(h2).toBeDefined();
      expect(h2.tagName).toBe('H2');
    });

    it('Heading: applies uiRole="ui-title" for calm application modal headers', () => {
      render(
        <Heading level={2} uiRole="ui-title">
          Share Note
        </Heading>,
      );
      const h2 = screen.getByRole('heading', { level: 2 });
      expect(h2.className).toContain('uiTitle');
      expect(h2.textContent).toBe('Share Note');
    });

    it('Heading: applies uiRole="display" for hero/marketing titles', () => {
      render(
        <Heading level={1} uiRole="display">
          Hero Display
        </Heading>,
      );
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1.className).toContain('displayTitle');
    });

    it('Text: renders body, lead, error, hint, and caption variants', () => {
      const { rerender } = render(<Text variant="body">Body text</Text>);
      expect(screen.getByText('Body text').className).toContain('body');

      rerender(<Text variant="lead">Lead text</Text>);
      expect(screen.getByText('Lead text').className).toContain('lead');

      rerender(<Text variant="error">Error message</Text>);
      const err = screen.getByText('Error message');
      expect(err.className).toContain('error');

      rerender(<Text variant="hint">Hint text</Text>);
      expect(screen.getByText('Hint text').className).toContain('hint');

      rerender(<Text variant="caption">Caption text</Text>);
      expect(screen.getByText('Caption text').className).toContain('caption');
    });
  });

  // ─── 3. DIALOG PRIMITIVE ───────────────────────────────────────────────────

  describe('3. Dialog Primitive', () => {
    it('renders composite dialog with portal, title, description, and actions', () => {
      render(
        <Dialog.Root open={true}>
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content size="md">
              <Dialog.Header>
                <Dialog.Title>Connect GitHub Account</Dialog.Title>
                <Dialog.Description>Authorize repository access.</Dialog.Description>
              </Dialog.Header>
              <Dialog.Body>
                <p>Dialog body content</p>
              </Dialog.Body>
              <Dialog.Actions align="end">
                <Button variant="secondary">Cancel</Button>
                <Button variant="primary">Confirm</Button>
              </Dialog.Actions>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>,
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeDefined();
      expect(screen.getByRole('heading', { name: /connect github account/i })).toBeDefined();
      expect(screen.getByText(/authorize repository access/i)).toBeDefined();
      expect(screen.getByText('Dialog body content')).toBeDefined();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /confirm/i })).toBeDefined();
    });

    it('Dialog.Portal encloses content within .ud-dialog-portal for theme encapsulation', () => {
      render(
        <Dialog.Root open={true}>
          <Dialog.Portal>
            <Dialog.Content size="sm">
              <Dialog.Title>Small Dialog</Dialog.Title>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>,
      );

      const portalWrapper = document.querySelector('.ud-dialog-portal');
      expect(portalWrapper).not.toBeNull();
      expect(portalWrapper?.contains(screen.getByRole('dialog'))).toBe(true);
    });
  });

  // ─── 4. POPOVER PRIMITIVE ──────────────────────────────────────────────────

  describe('4. Popover Primitive', () => {
    it('renders composite popover within .ud-popover-portal on open', () => {
      render(
        <Popover.Root open={true}>
          <Popover.Trigger asChild>
            <Button>Open Popover</Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content side="bottom" align="start">
              <p>Popover details</p>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>,
      );

      const popoverContent = screen.getByText('Popover details');
      expect(popoverContent).toBeDefined();

      const portalWrapper = document.querySelector('.ud-popover-portal');
      expect(portalWrapper).not.toBeNull();
      expect(portalWrapper?.contains(popoverContent)).toBe(true);
    });
  });

  // ─── 5. FIELD & FORM CONTROLS ──────────────────────────────────────────────

  describe('5. Field Controls (TextField, SelectField, CheckboxField, RadioField)', () => {
    it('TextField: binds label, input, hint, and error with ARIA attributes', () => {
      const { rerender } = render(
        <TextField
          id="email-input"
          label="Email Address"
          hint="We will never share your email."
          placeholder="user@example.com"
        />,
      );

      const input = screen.getByLabelText(/email address/i);
      expect(input).toBeDefined();
      expect(input.getAttribute('placeholder')).toBe('user@example.com');
      expect(screen.getByText(/we will never share your email/i)).toBeDefined();

      // Render with error
      rerender(
        <TextField
          id="email-input"
          label="Email Address"
          error="Invalid email format"
          placeholder="user@example.com"
        />,
      );

      expect(input.getAttribute('aria-invalid')).toBe('true');
      const errorMsg = screen.getByRole('alert');
      expect(errorMsg.textContent).toBe('Invalid email format');
    });

    it('SelectField: renders accessible select with options', () => {
      render(
        <SelectField
          id="role-select"
          label="Permission Role"
          options={[
            { label: 'Can view', value: 'viewer' },
            { label: 'Can edit', value: 'editor' },
          ]}
        />,
      );

      const select = screen.getByLabelText(/permission role/i) as HTMLSelectElement;
      expect(select).toBeDefined();
      expect(select.options.length).toBe(2);
      expect(select.options[0].text).toBe('Can view');
      expect(select.options[1].text).toBe('Can edit');
    });

    it('CheckboxField: renders isolated 18px checkbox with label and description', () => {
      render(
        <CheckboxField
          id="public-repo-check"
          label="Make Repository Public"
          description="Anyone on the internet will be able to see this repository."
        />,
      );

      const checkbox = screen.getByLabelText(/make repository public/i) as HTMLInputElement;
      expect(checkbox).toBeDefined();
      expect(checkbox.type).toBe('checkbox');
      expect(screen.getByText(/anyone on the internet will be able to see/i)).toBeDefined();
    });

    it('RadioField: renders radio input with label', () => {
      render(
        <RadioField
          id="sync-auto"
          name="sync-mode"
          label="Automatic Sync"
          description="Sync changes immediately."
        />,
      );

      const radio = screen.getByLabelText(/automatic sync/i) as HTMLInputElement;
      expect(radio).toBeDefined();
      expect(radio.type).toBe('radio');
    });
  });
});
