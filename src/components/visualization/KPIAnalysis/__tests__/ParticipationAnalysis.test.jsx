// src/components/visualization/KPIAnalysis/__tests__/ParticipationAnalysis.test.jsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ParticipationAnalysis from '../Network_Participation/ParticipationAnalysis';

describe('ParticipationAnalysis', () => {
  it('renders the scientific visualization', () => {
    render(<ParticipationAnalysis />);
    expect(screen.getByText(/Figure 1:/)).toBeInTheDocument();
  });
});