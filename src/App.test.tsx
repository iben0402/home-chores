import { screen } from '@testing-library/react'
import { renderApp } from './test/renderApp'

test('renders the app name (Chours) on the log-in screen', () => {
  renderApp('/')
  expect(screen.getByRole('heading', { name: 'Chours' })).toBeInTheDocument()
})

test('shows the connected project in dev', () => {
  renderApp('/login')
  expect(screen.getByText('Project: demo-home-chores (emulators)')).toBeInTheDocument()
})
