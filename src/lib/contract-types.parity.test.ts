import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTRACT_TYPES } from './types'

// Guards against drift between the TypeScript `CONTRACT_TYPES` list and the SQL
// CHECK constraints on `team_members`. The SQL is hand-run in the Supabase
// editor and cannot import TS, so we compare instead of generating.
//
// For each constraint the LAST `add constraint` wins: migrations are replayed in
// filename (date) order and `supabase-schema.sql` in file order. That is why the
// three-value constraint in 2026-09-25-team-member-contract-type.sql (and the
// stale first block in supabase-schema.sql) is intentionally not compared: it is
// superseded by 2026-09-30-entra-contract-sync.sql, which re-adds it with all
// values.

const ROOT = path.resolve(__dirname, '../..')
const CONSTRAINTS = ['team_members_contract_type_check', 'team_members_entra_contract_type_check']

function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '')
}

/** Effective value set per constraint name; the last definition in `sql` wins. */
function lastDefinitions(sql: string, into: Map<string, Set<string>>): void {
  const re = /add\s+constraint\s+(\w+)\s+check\s*\(([\s\S]*?)\)\s*;/gi
  for (const match of stripSqlComments(sql).matchAll(re)) {
    const name = match[1]
    if (!CONSTRAINTS.includes(name)) continue
    const values = [...match[2].matchAll(/'((?:[^']|'')*)'/g)].map(m => m[1].replace(/''/g, "'"))
    into.set(name, new Set(values))
  }
}

function effectiveFromMigrations(): Map<string, Set<string>> {
  const dir = path.join(ROOT, 'migrations')
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  const result = new Map<string, Set<string>>()
  for (const file of files) lastDefinitions(readFileSync(path.join(dir, file), 'utf8'), result)
  return result
}

function effectiveFromSchema(): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  lastDefinitions(readFileSync(path.join(ROOT, 'supabase-schema.sql'), 'utf8'), result)
  return result
}

function diff(actual: Set<string>, expected: Set<string>) {
  return {
    missingInSql: [...expected].filter(v => !actual.has(v)).sort(),
    extraInSql: [...actual].filter(v => !expected.has(v)).sort(),
  }
}

describe('contract type parity: CONTRACT_TYPES vs SQL CHECK constraints', () => {
  const tsSet = new Set<string>(CONTRACT_TYPES)
  const sources: [string, Map<string, Set<string>>][] = [
    ['migrations', effectiveFromMigrations()],
    ['supabase-schema.sql', effectiveFromSchema()],
  ]

  it('CONTRACT_TYPES has no duplicates', () => {
    expect(CONTRACT_TYPES.length).toBe(tsSet.size)
  })

  for (const [sourceName, effective] of sources) {
    for (const constraint of CONSTRAINTS) {
      it(`${constraint} in ${sourceName} matches CONTRACT_TYPES`, () => {
        const set = effective.get(constraint)
        expect(set, `no definition of ${constraint} found in ${sourceName}`).toBeDefined()
        expect(set!.size, `${constraint} in ${sourceName} has no values`).toBeGreaterThan(0)
        expect(diff(set!, tsSet)).toEqual({ missingInSql: [], extraInSql: [] })
      })
    }
  }

  it('migration chain and supabase-schema.sql agree', () => {
    for (const constraint of CONSTRAINTS) {
      const fromMigrations = sources[0][1].get(constraint) ?? new Set<string>()
      const fromSchema = sources[1][1].get(constraint) ?? new Set<string>()
      expect(diff(fromSchema, fromMigrations), constraint).toEqual({ missingInSql: [], extraInSql: [] })
    }
  })
})
