import { Link } from 'react-router-dom'

type WorkspacePageId = 'solver' | 'dataset' | 'editor'

type WorkspaceHeaderProps = {
  title: string
  description: string
  activePage: WorkspacePageId
}

const GITHUB_REPOSITORY_URL = 'https://github.com/SmilingWayne/puzzlekit-web'

const navItems: Array<{ id: WorkspacePageId; label: string; to: string }> = [
  { id: 'solver', label: 'Solver', to: '/' },
  { id: 'dataset', label: 'Dataset', to: '/dataset' },
  { id: 'editor', label: 'Editor', to: '/editor' },
]

export const WorkspaceHeader = ({
  title,
  description,
  activePage,
}: WorkspaceHeaderProps) => (
  <header className="workspace-title">
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    <nav className="workspace-nav" aria-label="Workspace navigation">
      {navItems.map((item) => (
        <Link key={item.id} aria-current={activePage === item.id ? 'page' : undefined} to={item.to}>
          {item.label}
        </Link>
      ))}
      <a
        className="workspace-nav-source"
        href={GITHUB_REPOSITORY_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Open PuzzleKit Web on GitHub"
      >
        GitHub
      </a>
    </nav>
  </header>
)
