import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VotingScale from './VotingScale'

// render() mounts the component into a virtual DOM (jsdom).
// screen gives us queries to find elements by role, text, label, etc.
// userEvent simulates real user interactions (clicks, typing).

describe('VotingScale', () => {
  const options = [1, 2, 3, 5, 8]
  const prompt = 'How big is this task?'

  it('renders the prompt and every option as a button', () => {
    render(<VotingScale prompt={prompt} options={options} selected={null} onVote={() => {}} />)

    expect(screen.getByText(prompt)).toBeInTheDocument()
    // Each option value has its own labelled button
    for (const value of options) {
      expect(screen.getByRole('button', { name: `Vote ${value}` })).toBeInTheDocument()
    }
  })

  it('fires onVote with the value of the button that was clicked', async () => {
    // vi.fn() creates a mock function that records every call it receives
    const onVote = vi.fn()
    render(<VotingScale prompt={prompt} options={options} selected={null} onVote={onVote} />)

    await userEvent.click(screen.getByRole('button', { name: 'Vote 3' }))

    expect(onVote).toHaveBeenCalledWith(3)
    expect(onVote).toHaveBeenCalledTimes(1)
  })

  it('sets aria-pressed="true" on the currently selected option only', () => {
    render(<VotingScale prompt={prompt} options={options} selected={5} onVote={() => {}} />)

    expect(screen.getByRole('button', { name: 'Vote 5' })).toHaveAttribute('aria-pressed', 'true')
    // Every other button should be unpressed
    expect(screen.getByRole('button', { name: 'Vote 1' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Vote 8' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not fire onVote when the scale is disabled', async () => {
    const onVote = vi.fn()
    render(
      <VotingScale prompt={prompt} options={options} selected={null} onVote={onVote} disabled />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Vote 1' }))

    expect(onVote).not.toHaveBeenCalled()
  })

  it('fires onVote when clicking the already-selected option (toggle is handled by the parent)', async () => {
    // VotingScale always fires onVote on click; the parent decides whether to
    // treat a repeated click as an unvote.
    const onVote = vi.fn()
    render(<VotingScale prompt={prompt} options={options} selected={3} onVote={onVote} />)

    await userEvent.click(screen.getByRole('button', { name: 'Vote 3' }))

    expect(onVote).toHaveBeenCalledWith(3)
  })
})
