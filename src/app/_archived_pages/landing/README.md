# Archived Landing Page

## Overview
This folder contains the archived version of the original SideQuestHQ landing page and its associated components, props, and schemas.

## Why Non-Public Facing?
In Next.js App Router, directories prefixed with an underscore (`_`) are designated as **Private Folders**. 
Next.js explicitly excludes private folders from the routing tree. Neither `/_archived_pages` nor `/archived_pages` is routable or exposed publicly to clients.

## Archived Contents
- **`page.tsx`**: Server component including page metadata and JSON-LD structured data.
- **`page.client.tsx`**: Client component managing Capacitor native detection and dynamically loading landing sections.
- **`props.ts`**: Props definitions (`LandingPageProps`, `LandingClientProps`), metadata structures, and JSON-LD schema models.
- **`layout.tsx`**: Landing layout with WebSite JSON-LD metadata.

## Screen Component Dependencies
The landing page renders components from:
- `src/client/screens/landing/01-hero/`
- `src/client/screens/landing/02-ikigai/`
- `src/client/screens/landing/05-Features/`
- `src/client/screens/landing/06-footer/`
