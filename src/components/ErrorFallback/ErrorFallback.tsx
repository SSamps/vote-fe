import type { FallbackProps } from 'react-error-boundary'

import styles from './ErrorFallback.module.css'

export default function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.message}>An unexpected error occurred. Please try again.</p>
      <button className="primary" onClick={resetErrorBoundary}>
        Try again
      </button>
    </div>
  )
}
