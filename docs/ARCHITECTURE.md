# SyncD — Architecture

> This document describes the actual architecture and conventions of the
> SyncD codebase. The codebase is the source of truth.
>
> Keep this document concise. Update it only when the architecture or an
> important architectural decision changes.

---

# 1. Project Overview

SyncD is a full-stack TypeScript application for synchronized social
music-listening.

The application consists of:

```text
SyncD
├── client/    → frontend application
└── server/    → backend application