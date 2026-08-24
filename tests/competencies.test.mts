import assert from 'node:assert/strict'
import test from 'node:test'
import { slugify } from '../src/lib/competencies.ts'

test('slugify preserves distinct technology suffixes', () => {
  assert.equal(slugify('C#'), 'c-sharp')
  assert.equal(slugify('C++'), 'c-plus-plus')
  assert.notEqual(slugify('C#'), slugify('C++'))
})

test('slugify transliterates Polish competency names', () => {
  assert.equal(slugify('Zarządzanie zespołem'), 'zarzadzanie-zespolem')
  assert.equal(slugify('Łączność i współbieżność'), 'lacznosc-i-wspolbieznosc')
})

test('slugify normalizes punctuation and whitespace', () => {
  assert.equal(slugify('  UI/UX Design  '), 'ui-ux-design')
  assert.equal(slugify('Next.js'), 'next-js')
})
