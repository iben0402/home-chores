import { screen } from '@testing-library/react'
import { ANNA, renderApp } from '../test/renderApp'

test('/h/abc renders Today', () => {
  renderApp('/h/abc', ANNA)
  expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
})

test('/h/abc/history renders History', () => {
  renderApp('/h/abc/history', ANNA)
  expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument()
})

test('/join/XYZ12345 renders Join household, signed out too', () => {
  renderApp('/join/XYZ12345')
  expect(screen.getByRole('heading', { name: 'Join household' })).toBeInTheDocument()
})

test('/does-not-exist renders Not found', () => {
  renderApp('/does-not-exist')
  expect(screen.getByText('Not found')).toBeInTheDocument()
})
