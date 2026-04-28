import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar from './Sidebar'
import type { ParticipantView } from '../../workers/roomWorkerTypes'

// Two participants used by most tests: a facilitator and a regular participant
const DEFAULT_PARTICIPANTS: ParticipantView[] = [
  { name: 'gentle-otter', role: 'facilitator', voteCount: 0 },
  { name: 'brave-fox', role: 'participant', voteCount: 0 },
]

// Small helper so each test only has to specify what it wants to change.
// Spread syntax applies the override on top of the sensible defaults.
function renderSidebar(
  overrides: Partial<{
    participants: ParticipantView[]
    myName: string | null
    stage: 'planning' | 'voting' | 'review'
    questions: Array<{ prompt: string; options: number[] }>
    expiresAt: number | null
  }> = {},
) {
  render(
    <Sidebar
      participants={DEFAULT_PARTICIPANTS}
      myName="brave-fox"
      stage="planning"
      questions={[]}
      expiresAt={null}
      {...overrides}
    />,
  )
}

describe('Sidebar', () => {
  it('renders every participant by name', () => {
    renderSidebar()
    expect(screen.getByText('gentle-otter')).toBeInTheDocument()
    expect(screen.getByText('brave-fox')).toBeInTheDocument()
  })

  it('marks the current user with a "(you)" label', () => {
    renderSidebar()
    // The (you) span is only shown next to the participant whose name
    // matches the myName prop
    expect(screen.getByText('(you)')).toBeInTheDocument()
  })

  it('shows an F badge next to the facilitator', () => {
    renderSidebar()
    expect(screen.getByText('F')).toBeInTheDocument()
  })

  it('shows vote-progress dots with an accessible label during the voting stage', () => {
    renderSidebar({
      participants: [{ name: 'gentle-otter', role: 'facilitator', voteCount: 1 }],
      myName: 'gentle-otter',
      stage: 'voting',
      questions: [
        { prompt: 'Q1', options: [1, 2, 3] },
        { prompt: 'Q2', options: [1, 2, 3] },
      ],
    })
    // The vote indicator uses aria-label so screen readers can describe progress
    expect(screen.getByLabelText('1 of 2 answered')).toBeInTheDocument()
  })

  it('hides participant content when the toggle button is clicked', async () => {
    renderSidebar()

    // Participants are visible by default
    expect(screen.getByText('gentle-otter')).toBeInTheDocument()

    // Click the collapse button (its aria-label changes on toggle)
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    // After collapsing, the content is unmounted from the DOM
    expect(screen.queryByText('gentle-otter')).not.toBeInTheDocument()
  })

  it('expands again after being collapsed', async () => {
    renderSidebar()

    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(screen.queryByText('gentle-otter')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(screen.getByText('gentle-otter')).toBeInTheDocument()
  })

  it('shows a dash for the countdown timer when expiresAt is null', () => {
    renderSidebar()
    // No expiry set → display "—" rather than a broken timer
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
