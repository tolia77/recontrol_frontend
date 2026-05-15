import { describe, expect, it } from 'vitest';

import {
  IRREVERSIBLE_IDS,
  IRREVERSIBLE_PATTERNS,
  isIrreversible,
} from '../irreversibleIntentCatalog';

describe('IRREVERSIBLE_IDS', () => {
  it('matches the canonical backend id list character-for-character', () => {
    expect(IRREVERSIBLE_IDS).toEqual([
      'rm',
      'truncate',
      'dd_of_dev',
      'mkfs',
      'systemctl_destruct',
      'kill_9',
      'find_delete',
      'chmod_777_recursive',
      'chown_recursive',
    ]);
  });

  it('has length 9', () => {
    expect(IRREVERSIBLE_IDS.length).toBe(9);
  });
});

describe('IRREVERSIBLE_PATTERNS ordering parity', () => {
  it('PATTERNS length equals IDS length', () => {
    expect(IRREVERSIBLE_PATTERNS.length).toBe(IRREVERSIBLE_IDS.length);
  });

  it('each PATTERN.id matches IDS at the same index', () => {
    IRREVERSIBLE_PATTERNS.forEach((p, i) => {
      expect(p.id).toBe(IRREVERSIBLE_IDS[i]);
    });
  });
});

describe('isIrreversible — positive cases', () => {
  it('rm -rf /tmp flags', () => {
    expect(isIrreversible({ binary: 'rm', args: ['-rf', '/tmp'] })).toBe(true);
  });

  it('truncate -s 0 flags', () => {
    expect(isIrreversible({ binary: 'truncate', args: ['-s', '0'] })).toBe(true);
  });

  it('dd of=/dev/sda flags', () => {
    expect(isIrreversible({ binary: 'dd', args: ['of=/dev/sda'] })).toBe(true);
  });

  it('mkfs.ext4 /dev/sdb1 flags', () => {
    expect(isIrreversible({ binary: 'mkfs.ext4', args: ['/dev/sdb1'] })).toBe(true);
  });

  it('systemctl stop nginx flags', () => {
    expect(isIrreversible({ binary: 'systemctl', args: ['stop', 'nginx'] })).toBe(true);
  });

  it('kill -9 1234 flags', () => {
    expect(isIrreversible({ binary: 'kill', args: ['-9', '1234'] })).toBe(true);
  });

  it('find /tmp -delete flags', () => {
    expect(isIrreversible({ binary: 'find', args: ['/tmp', '-delete'] })).toBe(true);
  });

  it('chmod -R 777 /var/www flags', () => {
    expect(isIrreversible({ binary: 'chmod', args: ['-R', '777', '/var/www'] })).toBe(true);
  });

  it('chown -R root:root /etc flags', () => {
    expect(isIrreversible({ binary: 'chown', args: ['-R', 'root:root', '/etc'] })).toBe(true);
  });
});

describe('isIrreversible — negative cases', () => {
  it('ls -la does not flag', () => {
    expect(isIrreversible({ binary: 'ls', args: ['-la'] })).toBe(false);
  });

  it('dd if=/dev/zero of=/tmp/data does not flag (no of=/dev/)', () => {
    expect(isIrreversible({ binary: 'dd', args: ['if=/dev/zero', 'of=/tmp/data'] })).toBe(false);
  });

  it('systemctl status nginx does not flag', () => {
    expect(isIrreversible({ binary: 'systemctl', args: ['status', 'nginx'] })).toBe(false);
  });

  it('kill -TERM 1234 does not flag (not -9)', () => {
    expect(isIrreversible({ binary: 'kill', args: ['-TERM', '1234'] })).toBe(false);
  });

  it('chmod -R 644 /var/www does not flag (not 777)', () => {
    expect(isIrreversible({ binary: 'chmod', args: ['-R', '644', '/var/www'] })).toBe(false);
  });
});

describe('isIrreversible — edges', () => {
  it('find with empty args does not flag (arg_match required)', () => {
    expect(isIrreversible({ binary: 'find', args: [] })).toBe(false);
  });

  it('RM (uppercase) does not flag — case-sensitive', () => {
    expect(isIrreversible({ binary: 'RM', args: ['-rf'] })).toBe(false);
  });

  it('empty binary does not flag', () => {
    expect(isIrreversible({ binary: '', args: [] })).toBe(false);
  });

  it('chmod -R 777 (777 in different order) still flags — args are commutative', () => {
    expect(isIrreversible({ binary: 'chmod', args: ['777', '-R', '/etc'] })).toBe(true);
  });

  it('chmod -R only (no 777) does not flag', () => {
    expect(isIrreversible({ binary: 'chmod', args: ['-R', '644'] })).toBe(false);
  });
});
