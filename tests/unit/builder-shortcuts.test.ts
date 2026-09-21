import { test } from 'node:test';
import assert from 'node:assert/strict';
import { builderCommand } from '../../client/src/modules/keyboard-builder/services/builder-shortcuts';
const key = (value: string) => ({ key: value, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, repeat: false });
test('builder keys map panels and safe actions', () => {
    for (let i = 1; i <= 7; i++) assert.deepEqual(builderCommand(key(String(i)), false), { type: 'pane', index: i - 1 });
    assert.deepEqual(builderCommand(key('?'), false), { type: 'help' });
    assert.deepEqual(builderCommand(key('A'), false), { type: 'add' });
    assert.equal(builderCommand(key('8'), false), null);
});
test('typing, composition, repeat and browser modifiers never dispatch shortcuts', () => {
    for (const value of ['1', 'a', 'b', '?', 'Escape']) {
        assert.equal(builderCommand(key(value), true), null);
        for (const flag of ['ctrlKey', 'metaKey', 'altKey', 'isComposing', 'repeat']) assert.equal(builderCommand({ ...key(value), [flag]: true }, false), null);
    }
});
