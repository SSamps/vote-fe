import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Register jest-dom matchers (toBeInTheDocument, toBeDisabled, etc.)
expect.extend(matchers)

// Unmount React components and clear the DOM after every test.
// Without this, renders from different tests accumulate in the same document
// body and cause "found multiple elements" errors.
afterEach(() => cleanup())
