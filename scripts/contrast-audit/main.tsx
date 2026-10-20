import { createRoot } from 'react-dom/client'
import ThemeProvider from '../../src/components/ThemeProvider'
import Sidebar from '../../src/components/Sidebar'
import Timeline from '../../src/components/timeline/Timeline'
import PeopleClient from '../../src/app/(dashboard)/people/PeopleClient'
import ProjectsClient from '../../src/app/(dashboard)/projects/ProjectsClient'
import CompetenciesClient from '../../src/app/(dashboard)/competencies/CompetenciesClient'
import { allocations, people, projects, tags, timeOffs } from './data'
import '../../src/app/globals.css'

const query = new URLSearchParams(location.search)
const theme = query.get('theme') === 'light' ? 'light' : 'dark'
const view = query.get('view') ?? 'timeline'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider initialTheme={theme} profileId="fixture" className="flex h-screen bg-canvas overflow-hidden">
    <Sidebar profile={null} />
    <main className="flex-1 overflow-auto">
      {view === 'timeline' && <Timeline people={people} projects={projects} allocations={allocations} timeOffs={timeOffs} onRefresh={() => {}} />}
      {view === 'people' && <PeopleClient initialPeople={people} initialAllocations={allocations} initialTimeOff={timeOffs} />}
      {view === 'projects' && <ProjectsClient initialProjects={projects} />}
      {view === 'competencies' && <CompetenciesClient tags={tags} members={people} myMemberId={people[0].id} isAdmin />}
    </main>
  </ThemeProvider>
)
