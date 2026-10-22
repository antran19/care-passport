---
name: Care Passport Clinical & Vault Design Spec
version: 1.0.0
description: Design tokens and aesthetic guidelines for Care Passport zero-trust healthcare vault
colors:
  primary: "#0f6e6e"
  primary-hover: "#148585"
  primary-light: "#5eead4"
  bg-app: "#0a0a0a"
  bg-card: "#171717"
  bg-card-subtle: "#1f1f1f"
  border-subtle: "#2a2a2a"
  border-highlight: "#0f6e6e"
  text-main: "#f3f4f6"
  text-muted: "#9ca3af"
  text-mono: "#6ee7b7"
  accent-success: "#10b981"
  accent-success-bg: "#064e3b"
  accent-danger: "#dc2626"
  accent-danger-bg: "#450a0a"
  accent-warning: "#f59e0b"
typography:
  font-sans: "Inter, system-ui, -apple-system, sans-serif"
  font-mono: "ui-monospace, Consolas, monospace"
  size-title: "1.75rem"
  size-heading: "1.25rem"
  size-body: "0.95rem"
  size-small: "0.825rem"
spacing:
  container-max: "780px"
  card-padding: "1.25rem"
  radius-card: "10px"
  radius-btn: "6px"
---

# Care Passport — Design Specification

## Overview
Care Passport is an end-to-end encrypted medical record vault with Emergent Authority governance. The design conveys clinical trust, cryptographic rigor, and uncompromising clarity.

## Visual Identity & Palette
- **Core Clinical Teal (`#0f6e6e`):** Represents healthcare security and life sciences.
- **Obsidian Vault Background (`#0a0a0a` & `#171717`):** High contrast, sleek dark-mode interface reducing visual fatigue.
- **Alert Red (`#dc2626`):** Reserved exclusively for cryptographic refusals, emergency actions, and the `/admin-attack` Zero-Trust demonstration.
- **Emerald Green (`#10b981`):** Indicates client-side decrypted health plaintext and verified policy grants.

## Typography & Hierarchy
- Clean sans-serif hierarchy for all administrative and clinical UI elements.
- Monospace font (`font-mono`) strictly applied to ciphertexts, record identifiers (`rec-*`), cryptographic hashes, and audit trace payloads.

## Key Screens
1. **Patient View (`/patient`):** Patient-centric control center for encrypting local records and granting Care Team sharing requests.
2. **Clinician Views (`/gp`, `/physio`):** Decryption workstation with clear access state banners.
3. **Admin Governance (`/admin`):** Care Steward enclave approval terminal with real-time Audit Trail.
4. **Zero-Trust Demonstration (`/admin-attack`):** Unambiguous proof of Emergent Authority with prominent refusal alert banners.
