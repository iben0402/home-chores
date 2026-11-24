import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from './routes'

function renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
}

test('/h/abc renders Today', () => {
  renderAt('/h/abc')
  expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
})

test('/h/abc/history renders History', () => {
  renderAt('/h/abc/history')
  expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument()
})

test('/join/XYZ12345 renders Join household', () => {
  renderAt('/join/XYZ12345')
  expect(screen.getByRole('heading', { name: 'Join household' })).toBeInTheDocument()
})

test('/does-not-exist renders Not found', () => {
  renderAt('/does-not-exist')
  expect(screen.getByText('Not found')).toBeInTheDocument()
})
