import { useState } from 'react'
import styles from './PlanningForm.module.css'

interface Option {
  id: number
  value: string
}

interface PlanningFormProps {
  onStartVoting: (prompt: string, options: number[]) => void
}

let nextId = 1

function makeOption(value = ''): Option {
  return { id: nextId++, value }
}

export default function PlanningForm({ onStartVoting }: PlanningFormProps) {
  const [prompt, setPrompt] = useState('')
  const [options, setOptions] = useState<Option[]>([makeOption(), makeOption()])

  function updateOption(id: number, value: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, value } : o)))
  }

  function addOption() {
    setOptions((prev) => [...prev, makeOption()])
  }

  function removeOption(id: number) {
    setOptions((prev) => prev.filter((o) => o.id !== id))
  }

  function handleSubmit() {
    const parsedOptions = options
      .map((o) => parseFloat(o.value))
      .filter((v) => !isNaN(v))

    if (!prompt.trim() || parsedOptions.length < 2) return
    onStartVoting(prompt.trim(), parsedOptions)
  }

  const parsedOptions = options.map((o) => parseFloat(o.value)).filter((v) => !isNaN(v))
  const canSubmit = prompt.trim().length > 0 && parsedOptions.length >= 2

  return (
    <div className={styles.card}>
      <h2 className={styles.heading}>Set up the vote</h2>

      <div className={styles.field}>
        <span className={styles.label}>Vote type</span>
        <label className={styles.voteTypeOption}>
          <input
            type="radio"
            checked
            onChange={() => {}}
            className={styles.radio}
          />
          Sliding scale
        </label>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="vote-prompt">
          Prompt
        </label>
        <textarea
          id="vote-prompt"
          className={styles.textarea}
          placeholder="What are we voting on?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Scale points</span>
        <p className={styles.hint}>The numeric values participants can vote on, e.g. 1, 2, 3, 5, 8.</p>
        <ul className={styles.optionList}>
          {options.map((option, i) => (
            <li key={option.id} className={styles.optionRow}>
              <input
                className={styles.optionInput}
                type="number"
                placeholder={i === 0 ? 'e.g. 1' : i === 1 ? 'e.g. 5' : `e.g. ${i * 5}`}
                value={option.value}
                onChange={(e) => updateOption(option.id, e.target.value)}
              />
              <button
                className={styles.removeButton}
                onClick={() => removeOption(option.id)}
                disabled={options.length <= 2}
                aria-label="Remove option"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <button className={styles.addButton} onClick={addOption}>
          + Add point
        </button>
      </div>

      <button
        className={styles.submitButton}
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        Start voting
      </button>
    </div>
  )
}
