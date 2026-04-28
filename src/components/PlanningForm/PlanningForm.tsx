import { useState } from 'react'
import styles from './PlanningForm.module.css'

interface Option {
  id: number
  text: string
}

let nextId = 1

function makeOption(text = ''): Option {
  return { id: nextId++, text }
}

export default function PlanningForm() {
  const [prompt, setPrompt] = useState('')
  const [options, setOptions] = useState<Option[]>([makeOption(), makeOption()])

  function updateOption(id: number, text: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)))
  }

  function addOption() {
    setOptions((prev) => [...prev, makeOption()])
  }

  function removeOption(id: number) {
    setOptions((prev) => prev.filter((o) => o.id !== id))
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.heading}>Set up the vote</h2>

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
        <span className={styles.label}>Options</span>
        <ul className={styles.optionList}>
          {options.map((option, i) => (
            <li key={option.id} className={styles.optionRow}>
              <input
                className={styles.optionInput}
                type="text"
                placeholder={`Option ${i + 1}`}
                value={option.text}
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
          + Add option
        </button>
      </div>
    </div>
  )
}
