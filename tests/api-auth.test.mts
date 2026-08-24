import assert from 'node:assert/strict'
import test from 'node:test'
import { requireApiKey } from '../src/lib/api/auth.ts'

function request(key?: string) {
  return new Request('http://localhost/api/competencies', {
    headers: key ? { Authorization: `Bearer ${key}` } : undefined,
  })
}

test('competency API fails closed when no server key is configured', () => {
  const previous = process.env.COMPETENCY_API_KEYS
  delete process.env.COMPETENCY_API_KEYS
  try {
    assert.equal(requireApiKey(request())?.status, 503)
  } finally {
    if (previous === undefined) delete process.env.COMPETENCY_API_KEYS
    else process.env.COMPETENCY_API_KEYS = previous
  }
})

test('competency API rejects a missing or invalid bearer key', () => {
  const previous = process.env.COMPETENCY_API_KEYS
  process.env.COMPETENCY_API_KEYS = 'first-secret,second-secret'
  try {
    assert.equal(requireApiKey(request())?.status, 401)
    assert.equal(requireApiKey(request('wrong-secret'))?.status, 401)
  } finally {
    if (previous === undefined) delete process.env.COMPETENCY_API_KEYS
    else process.env.COMPETENCY_API_KEYS = previous
  }
})

test('competency API accepts any configured bearer key', () => {
  const previous = process.env.COMPETENCY_API_KEYS
  process.env.COMPETENCY_API_KEYS = 'first-secret,second-secret'
  try {
    assert.equal(requireApiKey(request('first-secret')), null)
    assert.equal(requireApiKey(request('second-secret')), null)
  } finally {
    if (previous === undefined) delete process.env.COMPETENCY_API_KEYS
    else process.env.COMPETENCY_API_KEYS = previous
  }
})
