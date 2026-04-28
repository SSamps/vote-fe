import styles from './VotingScale.module.css'

interface VotingScaleProps {
  prompt: string
  options: number[]
  selected: number | null
  onVote: (value: number) => void
  disabled?: boolean
}

export default function VotingScale({ prompt, options, selected, onVote, disabled = false }: VotingScaleProps) {
  return (
    <div className={styles.wrapper}>
      <p className={styles.prompt}>{prompt}</p>
      <div className={styles.scaleOuter}>
        <div className={styles.track} />
        <div className={styles.nodes}>
          {options.map((value) => (
            <button
              key={value}
              className={`${styles.node} ${selected === value ? styles.nodeSelected : ''}`}
              onClick={() => onVote(value)}
              disabled={disabled}
              aria-pressed={selected === value}
              aria-label={`Vote ${value}`}
            >
              <div className={styles.nodeDot} />
              <span className={styles.nodeLabel}>{value}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
