import { allocations, competencies, experiences, people, projects, results, tags } from './data'

// This browser fixture never connects to Supabase or writes user data.
const tables: Record<string, unknown[]> = {
  allocations, team_member_competencies: competencies, project_experience: experiences,
  team_members: people, projects, competency_tags: tags,
}

export function createClient() {
  return {
    from(table: string) {
      const query = {
        select() { return query }, eq() { return query }, order() { return query },
        update() {
          if (table !== 'profiles') throw new Error('The contrast fixture only allows local theme preference updates')
          return query
        },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: tables[table] ?? [], error: null, count: 1 }).then(resolve) },
      }
      return query
    },
    rpc: async () => ({ data: results, error: null }),
  }
}
