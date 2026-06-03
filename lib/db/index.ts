import "server-only"

import { d1Repo } from "./d1-driver"
import type { Repo } from "./repo"

// Single repo singleton, server-only. Talks to the Cloudflare D1 production
// database via REST. Client components reach this only through server
// actions (see app/actions/*).
export const repo: Repo = d1Repo

export type { Repo } from "./repo"
