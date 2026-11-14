import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EmotionExplainPanel, { buildSegments, heatStyle } from './EmotionExplainPanel';
import * as api from '../../services/api';

vi.mock('../../services/api', () => ({
  makeApiCall: vi.fn(),
  apiClient: { emotion: { explain: '/api/emotion/explain' } },
}));

const TEXT = 'The road is dangerous, children fall here.';

const EXPLANATION = {
  text: TEXT,
  label: 'NEGATIVE',
  score: 0.9991,
  base_value: 0.4123,
  elapsed_ms: 812,
  words: [
    { text: 'The', start: 0, end: 3, shap: 0.002 },
    { text: 'road', start: 4, end: 8, shap: 0.03 },
    { text: 'is', start: 9, end: 11, shap: 0.0 },
    { text: 'dangerous', start: 12, end: 21, shap: 0.31 },
    { text: ',', start: 21, end: 22, shap: 0.001 },
    { text: 'children', start: 23, end: 31, shap: 0.12 },
    { text: 'fall', start: 32, end: 36, shap: -0.05 },
    { text: 'here', start: 37, end: 41, shap: 0.0 },
    { text: '.', start: 41, end: 42, shap: 0.0 },
  ],
  top_positive: [{ text: 'dangerous', shap: 0.31 }, { text: 'children', shap: 0.12 }],
  top_negative: [{ text: 'fall', shap: -0.05 }],
};

const open = async () => {
  await userEvent.click(screen.getByRole('button', { name: /emotion model explanation/i }));
};

describe('buildSegments', () => {
  it('reproduces the original text exactly, spaces and punctuation included', () => {
    const segments = buildSegments(TEXT, EXPLANATION.words);
    expect(segments.map(s => s.text).join('')).toBe(TEXT);
  });

  it('attaches the SHAP word only to real word segments, not to the gaps', () => {
    const segments = buildSegments(TEXT, EXPLANATION.words);
    const gaps = segments.filter(s => !s.word).map(s => s.text);
    expect(gaps.every(g => g.trim() === '')).toBe(true);
    expect(segments.find(s => s.word?.text === 'dangerous').text).toBe('dangerous');
  });

  it('ignores malformed or overlapping offsets instead of throwing (boundary case)', () => {
    const words = [
      { text: 'a', start: 0, end: 2, shap: 0.1 },
      { text: 'overlap', start: 1, end: 5, shap: 0.2 },
      { text: 'bad', start: 'x', end: 3, shap: 0.3 },
      { text: 'empty', start: 4, end: 4, shap: 0.4 },
    ];
    const segments = buildSegments('abcdef', words);
    expect(segments.map(s => s.text).join('')).toBe('abcdef');
  });

  it('copes with missing words (boundary case)', () => {
    expect(buildSegments('hello', undefined)).toEqual([{ text: 'hello' }]);
  });
});

describe('heatStyle', () => {
  it('is red for words that raise the signal and blue for words that lower it', () => {
    expect(heatStyle(0.3, 0.3).backgroundColor).toMatch(/^rgba\(220, 38, 38/);
    expect(heatStyle(-0.3, 0.3).backgroundColor).toMatch(/^rgba\(37, 99, 235/);
  });

  it('leaves negligible words uncoloured, and never divides by zero', () => {
    expect(heatStyle(0.001, 0.3)).toBeUndefined();
    expect(heatStyle(0.2, 0)).toBeUndefined();
    expect(heatStyle(NaN, 0.3)).toBeUndefined();
  });

  it('is more opaque for stronger words', () => {
    const alpha = s => Number(/,\s*([\d.]+)\)$/.exec(s.backgroundColor)[1]);
    expect(alpha(heatStyle(0.3, 0.3))).toBeGreaterThan(alpha(heatStyle(0.06, 0.3)));
  });
});

describe('EmotionExplainPanel', () => {
  beforeEach(() => {
    api.makeApiCall.mockReset();
  });

  it('renders nothing when there is no complaint text', () => {
    const { container } = render(<EmotionExplainPanel text="   " />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is collapsed by default and never calls the API on its own', async () => {
    render(<EmotionExplainPanel text={TEXT} />);
    expect(screen.queryByRole('button', { name: /explain with shap/i })).not.toBeInTheDocument();
    expect(api.makeApiCall).not.toHaveBeenCalled();
  });

  it('explains that SHAP is English-only for Indic-script complaints and offers no run button', async () => {
    render(<EmotionExplainPanel text="சாலையில் ஆபத்தான குழிகள் உள்ளன" />);
    await open();
    expect(screen.getByText(/english text only/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /explain with shap/i })).not.toBeInTheDocument();
  });

  it('runs SHAP on demand, targeting NEGATIVE, and highlights the influential words', async () => {
    api.makeApiCall.mockResolvedValueOnce({ success: true, data: EXPLANATION });
    render(<EmotionExplainPanel text={TEXT} />);
    await open();
    await userEvent.click(screen.getByRole('button', { name: /explain with shap/i }));

    await waitFor(() => expect(screen.getByTestId('emotion-explain-text')).toBeInTheDocument());

    const [url, options] = api.makeApiCall.mock.calls[0];
    expect(url).toBe('/api/emotion/explain');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ text: TEXT, target: 'NEGATIVE' });

    // the full sentence is intact, and the strongest word is highlighted red with its value in the tooltip
    expect(screen.getByTestId('emotion-explain-text')).toHaveTextContent(TEXT);
    const dangerous = screen.getByTitle('dangerous: +0.310');
    expect(dangerous.style.backgroundColor).toMatch(/^rgba\(220, 38, 38/);
    expect(screen.getByTitle('fall: -0.050').style.backgroundColor).toMatch(/^rgba\(37, 99, 235/);

    expect(screen.getByTestId('emotion-explain-top-positive')).toHaveTextContent('dangerous');
    expect(screen.getByTestId('emotion-explain-top-negative')).toHaveTextContent('fall');
    expect(screen.getByText(/NEGATIVE/)).toBeInTheDocument();
    expect(screen.getByText(/computed in 812 ms/i)).toBeInTheDocument();
  });

  it('shows the service error and a hint when the local model is unavailable', async () => {
    api.makeApiCall.mockRejectedValueOnce(new Error('The local DistilBERT service is not running or has no local model available'));
    render(<EmotionExplainPanel text={TEXT} />);
    await open();
    await userEvent.click(screen.getByRole('button', { name: /explain with shap/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/not running/i);
    expect(alert).toHaveTextContent(/backend\/python_services/);
    expect(screen.queryByTestId('emotion-explain-text')).not.toBeInTheDocument();
  });

  it('discards a stale explanation when the complaint text changes', async () => {
    api.makeApiCall.mockResolvedValueOnce({ success: true, data: EXPLANATION });
    const { rerender } = render(<EmotionExplainPanel text={TEXT} />);
    await open();
    await userEvent.click(screen.getByRole('button', { name: /explain with shap/i }));
    await screen.findByTestId('emotion-explain-text');

    rerender(<EmotionExplainPanel text="A different complaint about garbage." />);
    await waitFor(() => expect(screen.queryByTestId('emotion-explain-text')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /explain with shap/i })).toBeInTheDocument();
  });
});
