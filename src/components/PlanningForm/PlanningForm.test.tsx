import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanningForm from './PlanningForm'

describe('PlanningForm', () => {
  it('renders with the Start voting button disabled because the form is blank', () => {
    render(<PlanningForm onStartVoting={() => {}} />)
    // toBeDisabled checks the HTML disabled attribute
    expect(screen.getByRole('button', { name: 'Start voting' })).toBeDisabled()
  })

  it('enables Start voting once a prompt and two different numeric options are filled in', async () => {
    render(<PlanningForm onStartVoting={() => {}} />)

    await userEvent.type(screen.getByPlaceholderText('What are we voting on?'), 'Task size')

    // Number inputs have the ARIA role "spinbutton"
    const [first, second] = screen.getAllByRole('spinbutton')
    await userEvent.type(first, '3')
    await userEvent.type(second, '5')

    expect(screen.getByRole('button', { name: 'Start voting' })).toBeEnabled()
  })

  it('calls onStartVoting with the correct questions array when the form is submitted', async () => {
    const onStartVoting = vi.fn()
    render(<PlanningForm onStartVoting={onStartVoting} />)

    await userEvent.type(screen.getByPlaceholderText('What are we voting on?'), 'Task size')
    const [first, second] = screen.getAllByRole('spinbutton')
    await userEvent.type(first, '3')
    await userEvent.type(second, '5')

    await userEvent.click(screen.getByRole('button', { name: 'Start voting' }))

    // onStartVoting should receive the parsed, trimmed questions
    expect(onStartVoting).toHaveBeenCalledWith([{ prompt: 'Task size', options: [3, 5] }])
  })

  it('shows a validation error and keeps the button disabled when options are duplicates', async () => {
    render(<PlanningForm onStartVoting={() => {}} />)

    await userEvent.type(screen.getByPlaceholderText('What are we voting on?'), 'Task size')
    const [first, second] = screen.getAllByRole('spinbutton')
    await userEvent.type(first, '3')
    await userEvent.type(second, '3') // same value — not allowed

    expect(screen.getByText('Scale points must be unique.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start voting' })).toBeDisabled()
  })

  it('pre-populates the form from initialQuestions and shows a Start over button', () => {
    render(
      <PlanningForm
        initialQuestions={[{ prompt: 'Complexity', options: [1, 2, 3] }]}
        onStartVoting={() => {}}
      />,
    )
    // The textarea should contain the pre-populated prompt text
    expect(screen.getByDisplayValue('Complexity')).toBeInTheDocument()
    // Start over only appears when the form has initial data
    expect(screen.getByRole('button', { name: 'Start over' })).toBeInTheDocument()
  })

  it('adds a second question when the + Add question button is clicked', async () => {
    render(<PlanningForm onStartVoting={() => {}} />)

    // With a single question the label shows "Question" (not "Question 1")
    expect(screen.queryByText('Question 1')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '+ Add question' }))

    // With two questions the labels switch to "Question 1" / "Question 2"
    expect(screen.getByText('Question 1')).toBeInTheDocument()
    expect(screen.getByText('Question 2')).toBeInTheDocument()
  })
})
