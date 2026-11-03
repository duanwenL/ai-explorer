import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createDemoProvider } from '../src/providers.mjs';
import { CONTEXT, openLearningAgent, runInput } from '../src/session.mjs';

test('离线模型经过真实工具与 SQLite，重启后同一请求复用结果', { timeout: 60_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ai-explorer-agent-test-'));
  const databasePath = join(directory, 'session.sqlite');
  const messages = [];
  let session;
  try {
    const firstProvider = createDemoProvider(message => messages.push(message));
    session = await openLearningAgent({
      databasePath, provider: firstProvider.provider, modelId: firstProvider.getModel().id,
    });
    const first = await runInput(session.root, '请用工具计算 18 × 7。', 'offline-test-v1');
    assert.match(first.text, /126/);
    assert.equal(firstProvider.state.callCount, 2);
    assert.ok(messages.some(message => message.includes('实际工具结果：126')));
    await session.harness.close(CONTEXT);
    session = undefined;

    const secondProvider = createDemoProvider();
    session = await openLearningAgent({
      databasePath, provider: secondProvider.provider, modelId: secondProvider.getModel().id,
    });
    const second = await runInput(session.root, '请用工具计算 18 × 7。', 'offline-test-v1');
    assert.equal(second.text, first.text);
    assert.equal(second.submissionId, first.submissionId);
    assert.equal(secondProvider.state.callCount, 0);
  } finally {
    if (session) await session.harness.close(CONTEXT);
    await rm(directory, { recursive: true, force: true });
  }
});
