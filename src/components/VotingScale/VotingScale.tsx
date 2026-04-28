import { useState } from 'react'
import styles from './VotingScale.module.css'

interface VotingScaleProps {
  prompt: string
  options: number[]
  selected: number | null
  onVote: (value: number) => void
  disabled?: boolean
}

export default function VotingScale({ prompt, options, selected, onVote, disabled = false }: VotingScaleProps) {
  const [hoveredValue, setHoveredValue] = useState<number | null>(null)

  function dotClass(value: number): string {
    const isSelected = selected === value
    const isHovered = !disabled && hoveredValue === value
    if (isSelected && isHovered) return styles.nodeDotSelectedHovered
    if (isSelected) return styles.nodeDotSelected
    if (isHovered) return styles.nodeDotHovered
    return styles.nodeDotDefault
  }

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
              onMouseEnter={() => setHoveredValue(value)}
              onMouseLeave={() => setHoveredValue(null)}
              disabled={disabled}
              aria-pressed={selected === value}
              aria-label={`Vote ${value}`}
            >
              <div className={`${styles.nodeDot} ${dotClass(value)}`} />
              <span className={styles.nodeLabel}>{value}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
