import { screen } from '@testing-library/react'
import { findInvite } from '../data/households'
import { ANNA, renderApp } from '../test/renderApp'

test('/h/abc renders Today inside the household shell', () => {
  renderApp('/h/abc', ANNA)
  expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
})

test('/h/abc/history renders History', () => {
  renderApp('/h/abc/history', ANNA)
  expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument()
})

test('/join/:code is public: a bad code explains itself to a signed-out visitor', async () => {
  vi.mocked(findInvite).mockResolvedValue({ status: 'not-found' })
  renderApp('/join/XYZ12345')
  expect(await screen.findByRole('heading', { name: 'This invite doesn’t work' })).toBeInTheDocument()
})

test('/does-not-exist renders Not found', () => {
  renderApp('/does-not-exist')
  expect(screen.getByText('Not found')).toBeInTheDocument()
})
