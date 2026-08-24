'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProjectModal from '@/components/projects/ProjectModal'
import { hexToRgba } from '@/lib/utils'
import type { Project } from '@/lib/types'
import { format } from 'date-fns'

interface Props { initialProjects: Project[] }

export default function ProjectsClient({ initialProjects }: Props) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [modal, setModal] = useState<{ open: boolean; project?: Project | null }>({ open: false })

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('projects').select('*').order('name')
    if (data) setProjects(data as Project[])
  }, [])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Projects</h1>
          <p className="text-sm text-slate-400 mt-0.5">{projects.length} active projects</p>
        </div>
        <button
          onClick={() => setModal({ open: true, project: null })}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          New project
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => setModal({ open: true, project })}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer hover:border-slate-600 transition group"
            style={{ borderLeftColor: project.color, borderLeftWidth: 4 }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-3 h-3 rounded-full mt-1 shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{project.name}</p>
                {project.description && (
                  <p className="text-sm text-slate-400 mt-0.5 line-clamp-2">{project.description}</p>
                )}
              </div>
            </div>

            {(project.start_date || project.end_date) && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                {project.start_date && format(new Date(project.start_date), 'MMM d, yyyy')}
                {project.start_date && project.end_date && ' → '}
                {project.end_date && format(new Date(project.end_date), 'MMM d, yyyy')}
              </div>
            )}

            <div
              className="mt-3 px-2 py-1 rounded text-xs font-medium inline-block"
              style={{
                backgroundColor: hexToRgba(project.color, 0.15),
                color: project.color,
              }}
            >
              Active
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-500">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
            </svg>
            <p>No projects yet. Create your first project.</p>
          </div>
        )}
      </div>

      {modal.open && (
        <ProjectModal
          key={modal.project?.id ?? 'new'}
          open
          onClose={() => setModal({ open: false })}
          onSaved={refresh}
          project={modal.project}
        />
      )}
    </div>
  )
}
