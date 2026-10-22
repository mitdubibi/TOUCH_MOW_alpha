# TOUCH Meals-on-Wheels Volunteer App

## Context
Student prototype for TOUCH Community Services' Meals-on-Wheels (MOW).
Volunteers deliver meals to homebound elderly in HDB blocks (e.g. Jurong West).
Today: staff allocate volunteers and routes by hand, delivery lists are sent
as photos on WhatsApp, volunteers cross out units with photo Markup, and
elderly cannot see if their meal is coming.

## Users (three roles)
- **Volunteer**: sees assigned session, route on a map, checklist of units.
- **Organiser** (TOUCH staff/coordinator): uploads delivery lists, assigns
  volunteers, monitors progress, messages volunteers.
- **Elderly recipient**: sees live ETA of their meal; can message TOUCH.
  Must work WITHOUT login via a simple link (e.g. sent by SMS).

## Core features (build in this order)
1. Organiser uploads delivery list CSV (columns: Date, Session, Block,
   Unit, Postal Code, Meal Type, Remarks). Volunteer sees it as a
   checklist grouped by block and ticks units off.
2. Split one list across a volunteer team by block.
3. Route optimiser: geocode postal codes with OneMap, walking-time matrix,
   shortest one-way route from the collection centre. Same-block units are
   one stop, sorted by floor. Show numbered pins and path on a map.
4. Live ETA: volunteer shares location during a session; recipient link
   shows "volunteer is N stops away, about X minutes".
5. Session reminders to volunteers (time + location) and an in-app
   message channel between organiser and volunteers.

## Tech stack
- Next.js (App Router) + TypeScript + Tailwind, installable as a PWA
- Supabase: Postgres database, auth, realtime
- Maps: Leaflet with OneMap tiles; OneMap Search + Routing APIs
- Route ordering: brute force under 10 stops, else nearest-neighbour + 2-opt
- Deploy on Vercel

## Rules
- FAKE DATA ONLY. Never use real names, addresses or phone numbers of
  elderly recipients (PDPA). Seed with made-up Jurong West units.
- Mobile first: design for a 380px wide phone screen.
- Elderly view: very large text, high contrast, one screen, no login.
- Keep API keys in .env.local, never commit them.
- After each feature: explain how to test it, then wait for me.
- Do not use em dashes in UI text.
