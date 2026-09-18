import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createColourSelection } from '../src/colourSelection.ts';

const start = { head: '#e63946', body: '#2a9d3f', eyes: '#ffffff' };

test('body is selected by default', () => {
  assert.equal(createColourSelection(start).selectedPart, 'body');
});

test('select changes the selected part', () => {
  const selection = createColourSelection(start);
  selection.select('eyes');
  assert.equal(selection.selectedPart, 'eyes');
});

test('pick commits to the selected part only and keeps it selected', () => {
  const selection = createColourSelection(start);
  selection.select('head');
  selection.pick('#111111');
  selection.pick('#7b2cbf');

  assert.deepEqual(selection.colours, { head: '#7b2cbf', body: '#2a9d3f', eyes: '#ffffff' });
  assert.equal(selection.selectedPart, 'head');
});

test('the outlined colour follows the committed colour of the selected part', () => {
  const selection = createColourSelection(start);
  assert.equal(selection.outlinedColour(), '#2a9d3f');

  selection.select('head');
  assert.equal(selection.outlinedColour(), '#e63946');

  selection.pick('#111111');
  assert.equal(selection.outlinedColour(), '#111111');
});

test('setColours replaces the committed colours', () => {
  const selection = createColourSelection(start);
  selection.setColours({ head: '#111111', body: '#222222', eyes: '#333333' });
  assert.equal(selection.outlinedColour(), '#222222');
});
