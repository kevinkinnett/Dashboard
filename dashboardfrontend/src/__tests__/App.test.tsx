import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

describe('App navigation and report selection', () => {
  test('renders the Yield Inversion report by default', () => {
    render(<App />);

    expect(
      screen.getByRole('button', { name: 'Yield Inversion' })
    ).toBeInTheDocument();
    expect(screen.getByText('Spread Right Axis')).toBeInTheDocument();
  });

  test('restores last active report from localStorage', () => {
    localStorage.setItem('dashboard:lastReport:v1', 'jobs');

    render(<App />);

    expect(screen.getByText('Labor Market Series')).toBeInTheDocument();
  });

  test('collapsing the navigation updates toggle state', () => {
    render(<App />);

    const toggle = screen.getByRole('button', { name: 'Collapse navigation' });
    fireEvent.click(toggle);

    expect(toggle).toHaveAccessibleName('Expand navigation');
    expect(screen.getByTitle('Yield Inversion')).toHaveTextContent('Y');
  });
});
