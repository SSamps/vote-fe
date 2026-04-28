import { useState } from 'react'
import styles from './PlanningForm.module.css'

interface ScaleOption {
  id: number
  value: string
}

interface QuestionDraft {
  id: number
  prompt: string
  options: ScaleOption[]
}

interface PlanningFormProps {
  initialQuestions?: Array<{ prompt: string; options: number[] }>
  onStartVoting: (questions: Array<{ prompt: string; options: number[] }>) => void
}

let nextId = 1
const uid = () => nextId++

function makeOption(value = ''): ScaleOption {
  return { id: uid(), value }
}

function makeQuestion(): QuestionDraft {
  return { id: uid(), prompt: '', options: [makeOption(), makeOption()] }
}

function hydrateQuestions(initial: Array<{ prompt: string; options: number[] }>): QuestionDraft[] {
  return initial.map((q) => ({
    id: uid(),
    prompt: q.prompt,
    options: q.options.map((v) => makeOption(String(v))),
  }))
}

function parseOptions(options: ScaleOption[]): number[] {
  return options.map((o) => parseFloat(o.value)).filter((v) => !isNaN(v))
}

function hasDuplicateOptions(q: QuestionDraft): boolean {
  const parsed = parseOptions(q.options)
  return new Set(parsed).size !== parsed.length
}

function isQuestionValid(q: QuestionDraft): boolean {
  return (
    q.prompt.trim().length > 0 &&
    parseOptions(q.options).length >= 2 &&
    !hasDuplicateOptions(q)
  )
}

export default function PlanningForm({ initialQuestions, onStartVoting }: PlanningFormProps) {
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    () => initialQuestions?.length ? hydrateQuestions(initialQuestions) : [makeQuestion()]
  )

  function updatePrompt(id: number, prompt: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, prompt } : q)))
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, makeQuestion()])
  }

  function removeQuestion(id: number) {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  function updateOption(questionId: number, optionId: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.map((o) => (o.id === optionId ? { ...o, value } : o)) }
          : q,
      ),
    )
  }

  function addOption(questionId: number) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, options: [...q.options, makeOption()] } : q)),
    )
  }

  function removeOption(questionId: number, optionId: number) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.filter((o) => o.id !== optionId) }
          : q,
      ),
    )
  }

  function handleSubmit() {
    const payload = questions.map((q) => ({
      prompt: q.prompt.trim(),
      options: parseOptions(q.options),
    }))
    onStartVoting(payload)
  }

  const canSubmit = questions.length > 0 && questions.every(isQuestionValid)

  return (
    <div className={styles.card}>
      <div className={styles.headingRow}>
        <h2 className={styles.heading}>Set up the vote</h2>
        {(initialQuestions?.length ?? 0) > 0 && (
          <button
            className={styles.startOverButton}
            onClick={() => setQuestions([makeQuestion()])}
          >
            Start over
          </button>
        )}
      </div>

      {questions.map((q, qi) => (
        <div key={q.id} className={styles.questionBlock}>
          <div className={styles.questionHeader}>
            <span className={styles.questionLabel}>
              {questions.length > 1 ? `Question ${qi + 1}` : 'Question'}
            </span>
            {questions.length > 1 && (
              <button
                className={styles.removeQuestionButton}
                onClick={() => removeQuestion(q.id)}
                aria-label={`Remove question ${qi + 1}`}
              >
                Remove
              </button>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`prompt-${q.id}`}>
              Prompt
            </label>
            <textarea
              id={`prompt-${q.id}`}
              className={styles.textarea}
              placeholder="What are we voting on?"
              value={q.prompt}
              onChange={(e) => updatePrompt(q.id, e.target.value)}
              rows={3}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Scale points</span>
            <p className={styles.hint}>The numeric values participants can vote on, e.g. 1, 2, 3, 5, 8.</p>
            <ul className={styles.optionList}>
              {q.options.map((option, oi) => (
                <li key={option.id} className={styles.optionRow}>
                  <input
                    className={styles.optionInput}
                    type="number"
                    placeholder={oi === 0 ? 'e.g. 1' : oi === 1 ? 'e.g. 5' : `e.g. ${oi * 5}`}
                    value={option.value}
                    onChange={(e) => updateOption(q.id, option.id, e.target.value)}
                  />
                  <button
                    className={styles.removeButton}
                    onClick={() => removeOption(q.id, option.id)}
                    disabled={q.options.length <= 2}
                    aria-label="Remove option"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button className={styles.addButton} onClick={() => addOption(q.id)}>
              + Add point
            </button>
            {hasDuplicateOptions(q) && (
              <p className={styles.optionError}>Scale points must be unique.</p>
            )}
          </div>
        </div>
      ))}

      <button className={styles.addQuestionButton} onClick={addQuestion}>
        + Add question
      </button>

      <button className={styles.submitButton} onClick={handleSubmit} disabled={!canSubmit}>
        Start voting
      </button>
    </div>
  )
}
