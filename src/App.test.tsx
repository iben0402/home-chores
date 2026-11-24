import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from './app/routes'

test('renders the app name (Chours) at /', () => {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />)
  expect(screen.getByRole('heading', { name: 'Chours' })).toBeInTheDocument()
})

test('shows the connected project in dev', () => {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />)
  expect(screen.getByText('Project: demo-home-chores (emulators)')).toBeInTheDocument()
})
